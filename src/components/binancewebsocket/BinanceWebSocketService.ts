// BinanceWebSocketService.ts
// Clean API: state machine + 2 queues (preAuth/authed), no generic send(), full wrappers

type MarketType = 'spot' | 'futures';
type WsState = 'closed' | 'connecting' | 'open' | 'authenticated';
type PositionsCb = (rows: any[]) => void;
export const OPEN_ORDERS_LS_KEY = 'openOrders';
export const OPEN_ORDERS_EVENT  = 'tw:open-orders-changed';
// ==== Types for placing orders ====
export type WorkingType = 'MARK_PRICE' | 'LAST';
export const POSITIONS_LS_KEY = 'positions';
export const POSITIONS_EVENT  = 'tw:positions-changed';

function readPositionsLS(): any[] {
  try { return JSON.parse(localStorage.getItem(POSITIONS_LS_KEY) || '[]'); }
  catch { return []; }
}
function writePositionsLS(list: any[]) {
  localStorage.setItem(POSITIONS_LS_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(POSITIONS_EVENT, { detail: { list } }));
}
// ✅ THÊM MỚI:
export type PlaceOrderType =
  | 'MARKET'
  | 'LIMIT'
  | 'STOP_MARKET'         // futures
  | 'TAKE_PROFIT_MARKET'  // futures
  | 'STOP_LOSS_LIMIT'     // spot
  | 'TAKE_PROFIT_LIMIT';  // spot (để dành, nếu cần)

export interface PlaceOrderPayload {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: PlaceOrderType;                 // ⬅️ đổi từ union cũ sang type mới
  market: 'futures' | 'spot';

  // qty/price
  quantity?: number;
  price?: number;     // LIMIT, *_LIMIT (Spot)
  stopPrice?: number; // *_MARKET (Futures), *_LIMIT (Spot)

  // futures-only (optional)
  reduceOnly?: boolean;
  positionSide?: 'LONG' | 'SHORT' | 'BOTH';
  timeInForce?: 'GTC' | 'IOC' | 'FOK';

  // trigger theo Binance Futures
  workingType?: WorkingType; // 'MARK' | 'LAST'
  
  // ✅ THÊM MỚI: closePosition cho TP/SL toàn bộ vị thế
  // Khi closePosition='true' → KHÔNG được truyền quantity (Binance tự đóng hết)
  closePosition?: 'true' | 'false';
}

// === OpenOrders LS + Event bus ===


function readOpenOrdersLS(): any[] {
  try { return JSON.parse(localStorage.getItem(OPEN_ORDERS_LS_KEY) || '[]'); }
  catch { return []; }
}

function writeOpenOrdersLS(list: any[]) {
  console.log('💾 writeOpenOrdersLS called:', list);  // ✅ THÊM
  localStorage.setItem(OPEN_ORDERS_LS_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent('tw:open-orders-changed', { detail: { list } }));
}


class BinanceWebSocketService {
  private socket: WebSocket | null = null;
  private wsUrl = 'ws://45.77.33.141/w-binance-trading/signalr/connect';
  private onMaintenanceCallback: (() => void) | null = null;

  // ===== NEW: anti-spam / idempotent helpers =====
  private lastSelectSent?: { id: number; ts: number };
  private initialPulled = new Set<number>();       // per-account initial snapshot guard
  private snapshotCooldownMs = 250;
  private lastPositionsPullAt = 0;

  private lastAccountInfoEmit: number = 0;
  private refreshTimer: any = null;

  private authInFlight = false;
  private authedOnceKeys = new Set<string>();
  private pushAuthedUnique(key: string, msg: any) {
    if (this.authedOnceKeys.has(key)) return;
    this.authedOnceKeys.add(key);
    this.authedQueue.push(msg);
  }
private pendingApiCalls = new Map<string, number>(); // Track pending calls
private apiDebounceMs = 200; // 200ms debounce
  private noPositionRiskSupport = true;

  // ===== State & queues =====
  private state: WsState = 'closed';
  private openResolvers: Array<() => void> = [];
  private authResolvers: Array<() => void> = [];
  private preAuthQueue: any[] = []; // gửi khi state >= 'open'
  private authedQueue: any[] = [];  // gửi khi state === 'authenticated'
  
  // ===== Account Selection Tracking =====
  private accountSelectedResolvers: Array<() => void> = [];
  private accountSelected: boolean = false;
  private accountSelectedOnServer: boolean = false;  // ✅ NEW: Server đã nhận selectAccount chưa

  // ===== Handlers & caches =====
  private messageHandlers: ((data: any) => void)[] = [];
  private currentAccountId: number | null = null;
  private orderUpdateHandler: ((orders: any[]) => void) | null = null;
  private positionUpdateHandler: ((positions: any[]) => void) | null = null;

  // Subscriptions / callbacks cho stream
  private subscriptions: Map<string, any> = new Map();
  private callbacks: Map<string, (data: any) => void> = new Map();

  // ==== NEW: coalesce risk requests ====
  private pendingRiskSymbols = new Set<string>();
  private riskDebounceTimer: number | null = null;

  // ---- cache leverage theo symbol ----
  private symbolLeverage = new Map<string, number>(); // ex: "DOGEUSDT" -> 10

  // ====== LocalStorage helpers cho Leverage ======
  private levKey(accountId: number | null | undefined, market: MarketType, symbol: string) {
    return `tw_leverage_${accountId ?? 'na'}_${market}_${symbol.toUpperCase()}`;
  }

  private saveLeverageLS(symbol: string, lev: number, market: MarketType = 'futures') {
    try {
      const key = this.levKey(this.currentAccountId, market, symbol);
      localStorage.setItem(key, String(lev));
    } catch {}
  }

  private hydrateLeverageCacheFromLS(market: MarketType = 'futures') {
    if (!this.currentAccountId) return;
    const prefix = `tw_leverage_${this.currentAccountId}_${market}_`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const sym = k.slice(prefix.length).toUpperCase();
      const v = localStorage.getItem(k);
      const n = v ? Number(v) : NaN;
      if (sym && Number.isFinite(n) && n > 0) {
        this.symbolLeverage.set(sym, n);
      }
    }
  }

  private loadLeverageLS(symbol: string, market: MarketType = 'futures'): number | undefined {
    try {
      const key = this.levKey(this.currentAccountId, market, symbol);
      const v = localStorage.getItem(key);
      const n = v ? Number(v) : NaN;
      return Number.isFinite(n) && n > 0 ? n : undefined;
    } catch {
      return undefined;
    }
  }

  private setLeverageFor(symbol: string, lev: any, market: MarketType = 'futures') {
    const n = Number(lev);
    if (Number.isFinite(n) && n > 0) {
      const sym = symbol.toUpperCase();
      this.symbolLeverage.set(sym, n);
      this.saveLeverageLS(sym, n, market);   // persist
      console.log('LEV CACHE SET ✅', sym, n);
    }
  }

  // ========= Account info emitter =========
  private emitAccountInformation(payload: {
    availableBalance?: number;
    totalWalletBalance?: number;
    totalMarginBalance?: number;
    totalUnrealizedProfit?: number;
    multiAssetsMargin?: boolean;
    source: 'ws-live' | 'snapshot' | 'database-cache';
  }) {
    const toNum = (v: any) => (typeof v === 'string' ? parseFloat(v) : Number(v ?? 0));
    const info = {
      availableBalance: toNum(payload.availableBalance),
      totalWalletBalance: toNum(payload.totalWalletBalance),
      totalMarginBalance: toNum(payload.totalMarginBalance),
      totalUnrealizedProfit: toNum(payload.totalUnrealizedProfit),
      multiAssetsMargin: !!payload.multiAssetsMargin,
      source: payload.source,
    };
    this.lastAccountInfoEmit = Date.now();
    this.messageHandlers.forEach(h => h({ type: 'accountInformation', data: info }));
  }

  // Debounce refresh snapshot (hạn chế spam)
  private scheduleAccountRefresh(ms = 350) {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.refreshTimer = setTimeout(() => {
      this.getFuturesAccount();
    }, ms);
  }

  // ========= Helpers =========
  private waitForOpen(): Promise<void> {
    if (this.state === 'open' || this.state === 'authenticated') return Promise.resolve();
    return new Promise(res => this.openResolvers.push(res));
  }
  private waitForAuth(): Promise<void> {
    if (this.state === 'authenticated') return Promise.resolve();
    return new Promise(res => this.authResolvers.push(res));
  }
  
  private waitForAccountSelected(): Promise<void> {
    if (this.accountSelected) return Promise.resolve();
    return new Promise(res => this.accountSelectedResolvers.push(res));
  }
public setMaintenanceCallback(callback: (() => void) | null) {
  this.onMaintenanceCallback = callback;
  console.log('🔧 Maintenance callback registered:', !!callback);
  
  // ✅ NẾU ĐÃ CÓ WEBSOCKET ĐANG CHẠY, THÊM CALLBACK VÀO ĐÓ LUÔN
  if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
    console.log('🔧 Attaching callback to existing WebSocket connection');
    
    const existingWs = this.socket;
    
    // Backup existing handlers
    const originalOnError = existingWs.onerror;
    const originalOnClose = existingWs.onclose;
    
    // Replace with new handlers that include callback
    existingWs.onerror = (event) => {
      console.error('❌ WebSocket error (existing connection):', event);
      
      if (this.onMaintenanceCallback) {
        console.log('🚨 Triggering maintenance modal from existing connection error');
        this.onMaintenanceCallback();
      }
      
      // Call original handler if exists
      if (originalOnError && originalOnError !== existingWs.onerror) {
        originalOnError.call(existingWs, event);
      }
    };
    
    existingWs.onclose = (event) => {
      console.warn('🔌 WebSocket closed (existing connection):', event.code, event.reason);
      
      if (event.code !== 1000 && event.code !== 1001) {
        if (this.onMaintenanceCallback) {
          console.log('🚨 Triggering maintenance modal from existing connection close');
          this.onMaintenanceCallback();
        }
      }
      
      // Call original handler if exists
      if (originalOnClose && originalOnClose !== existingWs.onclose) {
        originalOnClose.call(existingWs, event);
      }
    };
  }
}
  // Client fallback: server không support -> dùng futures snapshot
  public requestPositionRisk(symbols?: string[]) {
    this.getFuturesAccount(); // kéo leverage/isolatedWallet qua snapshot
  }
  public getAccountInformation() {
    this.getFuturesAccount();
  }
  private _sendGetPositionRisk(symbols?: string[]) {
    // no-op
  }

  public setCurrentAccountId(id: number) {
    this.currentAccountId = id;
  }
  public getCurrentAccountId(): number | null {
    return this.currentAccountId;
  }

  public setPositionUpdateHandler(handler: (positions: any[]) => void) {
    this.positionUpdateHandler = handler;
    if (Array.isArray(this.lastPositions) && this.lastPositions.length) {
      try { handler(this.lastPositions); } catch {}
    }
  }
  public setOrderUpdateHandler(handler: ((orders: any[]) => void) | null) {
    this.orderUpdateHandler = handler;
  }

  public onMessage(handler: (data: any) => void) {
    this.messageHandlers.push(handler);
  }
  public removeMessageHandler(handler: (data: any) => void) {
    this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
  }

  public isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  // ========= Position mode =========
  public changePositionMode(dualSidePosition: boolean, onDone?: (ok: boolean, raw: any) => void) {
    this.sendAuthed({ action: 'changePositionMode', dualSidePosition });

    if (!onDone) return;
    const once = (m: any) => {
      if (m?.type === 'changePositionMode' && typeof m.dualSidePosition === 'boolean') {
        onDone(true, m);
        this.removeMessageHandler(once);
      } else if (m?.success === false && m?.error) {
        onDone(false, m);
        this.removeMessageHandler(once);
      }
    };
    this.onMessage(once);
  }

  public getPositionMode(onResult?: (dual: boolean) => void) {
    this.sendAuthed({ action: 'getPositionMode' });
    if (!onResult) return;
    const once = (m: any) => {
      if (m?.type === 'getPositionMode' && typeof m.dualSidePosition === 'boolean') {
        onResult(m.dualSidePosition);
        this.removeMessageHandler(once);
      }
    };
    this.onMessage(once);
  }

  // Public: đóng WS + dọn state
  public disconnect(reason?: string) {
    try { this.socket?.close(1000, reason || 'client disconnect'); } catch {}
    this.socket = null;
    this.state = 'closed';
    this.authInFlight = false;
    this.openResolvers.splice(0);
    this.authResolvers.splice(0);
    this.preAuthQueue = [];
    this.authedQueue = [];
    this.accountSubActive = false;
    this.messageHandlers = [];
    this.callbacks.clear();
    this.subscriptions.clear();
    this.pendingRiskSymbols.clear();
    this.accountSelected = false;
    this.accountSelectedOnServer = false;  // ✅ Reset
    this.accountSelectedResolvers = [];
    if (this.riskDebounceTimer != null) {
      clearTimeout(this.riskDebounceTimer);
      this.riskDebounceTimer = null;
    }
  }

  // Public: chờ tới khi AUTHENTICATED (dùng được cho select)
  public async waitUntilAuthenticated() {
    if (this.state === 'authenticated') return;
    await this.waitForOpen();
    await this.waitForAuth();
  }

  // Public: gửi select rồi chờ 1 nhịp cho server “ghi” account
  public async selectAccountAndWait(id: number, settleMs = 160) {
    this.selectAccount(id);
    await new Promise(res => setTimeout(res, settleMs));
  }

  // ========= Connect (idempotent) =========
  public connect(token: string, onMessage: (data: any) => void) {
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
      if (!this.messageHandlers.includes(onMessage)) this.messageHandlers.push(onMessage);
      if (token) this.authenticate(token);
      return;
    }

    this.state = 'connecting';
    const sock = new WebSocket(this.wsUrl);
    this.socket = sock;

    sock.onopen = () => {
      if (this.socket !== sock) return;
      this.state = 'open';
      console.log('✅ WebSocket connected');

      this.openResolvers.splice(0).forEach(r => r());
      this.flushPreAuth();

      if (token) this.authenticate(token);

      if (!this.messageHandlers.includes(onMessage)) this.messageHandlers.push(onMessage);

      const saved = localStorage.getItem('selectedBinanceAccountId');
      if (saved !== null) {
        const parsed = Number(saved);
        if (!Number.isNaN(parsed)) this.setCurrentAccountId(parsed);
      }
    };

    sock.onmessage = (event) => {
      if (this.socket !== sock) return;
      console.log('📥 RAW WS MSG:', event.data);
      try {
        const data = JSON.parse(event.data);

        // EARLY: futures account-like packet (emit account info)
        if (
          (typeof (data as any)?.availableBalance === 'string' || typeof (data as any)?.availableBalance === 'number') &&
          ((data as any)?.multiAssetsMargin !== undefined || (data as any)?.totalWalletBalance !== undefined || (data as any)?.assets !== undefined)
        ) {
          this.emitAccountInformation({
            availableBalance: (data as any).availableBalance,
            totalWalletBalance: (data as any).totalWalletBalance,
            totalMarginBalance: (data as any).totalMarginBalance,
            totalUnrealizedProfit: (data as any).totalUnrealizedProfit,
            multiAssetsMargin: !!(data as any).multiAssetsMargin,
            source: 'ws-live',
          });
        }

        // Detect "account selected" response from server
        // Format: {"id":30,"name":"trdungrun","binanceId":"1120488512","binanceWebSocketConnected":true,...}
        if (data && typeof data.id === 'number' && data.binanceId && data.binanceWebSocketConnected !== undefined) {
          if (!this.currentAccountId) this.currentAccountId = Number(data.id);
          
          // ✅ MARK ACCOUNT AS SELECTED ON SERVER
          console.log('✅ Account selected on server:', data.id, data.name);
          this.accountSelected = true;
          this.accountSelectedOnServer = true;  // ✅ Server đã xác nhận
          this.accountSelectedResolvers.splice(0).forEach(r => r());
          
          // Forward to message handlers để TradingForm biết
          this.messageHandlers.forEach(h => h({ type: 'accountSelected', account: data }));
          
          return;
        }

        // Futures/spot data loaded — safe to ensure initial once
        if (data?.type === 'futuresDataLoaded' || data?.type === 'spotDataLoaded') {
          // ❌ FIX: Don't auto-trigger snapshot
          //           this.ensureInitialSnapshot(0);
        }

        // FORWARD SNAPSHOT POSITIONS
        if (Array.isArray(data) && data.length && data[0] && typeof data[0].symbol === 'string' && data[0].positionAmt !== undefined) {
          console.log('📥 WS positions[] snapshot:', data);
          this.lastPositions = data;
           writePositionsLS(data);
          this.positionUpdateHandler?.(data);
          this.onPositions?.(data);
          return;
        }
        if (data && Array.isArray((data as any).positions)) {
          const rows = (data as any).positions;
          console.log('📥 WS positions snapshot (wrapped):', rows);
          this.lastPositions = rows;
          writePositionsLS(rows); 
          this.positionUpdateHandler?.(rows);
          this.onPositions?.(rows);
          // ➕ emit snapshot event cho UI (Map store sẽ applySnapshot)
  this.messageHandlers.forEach(h => h({ type: 'positionsSnapshot', data: rows }));
          return;
        }
        if ((data?.type === 'getPositions' || data?.type === 'positions' || data?.type === 'futuresPositions') &&
            Array.isArray((data as any).data)) {
          const rows = (data as any).data;
          console.log('📥 WS positions snapshot (data):', rows);
          this.lastPositions = rows;
           writePositionsLS(rows); 
          this.positionUpdateHandler?.(rows);
          this.onPositions?.(rows);
           // ➕ emit snapshot event cho UI (Map store sẽ applySnapshot)
  this.messageHandlers.forEach(h => h({ type: 'positionsSnapshot', data: rows }));
          return;
        }

        if (data?.symbol && Number.isFinite(data?.leverage)) {
          this.setLeverageFor(data.symbol, data.leverage);
          this.messageHandlers.forEach(h => h({ type: 'leverageUpdate', symbol: data.symbol, leverage: data.leverage }));
        }

        console.log('📥 WS Parsed:', data);

        // Forward snapshot futures account để UI merge leverage/iw
        if ((data?.type === 'getFuturesAccount' || data?.type === 'futuresAccount')) {
          if (Array.isArray(data.positions)) {
            for (const r of data.positions) {
              const sym = String(r.symbol ?? r.s ?? '');
              if (!sym) continue;
              const lev = Number(r.leverage ?? r.l);
              if (Number.isFinite(lev) && lev > 0) this.setLeverageFor(sym, lev, 'futures');
            }
          }

          this.emitAccountInformation({
            availableBalance: (data as any).availableBalance,
            totalWalletBalance: (data as any).totalWalletBalance,
            totalMarginBalance: (data as any).totalMarginBalance,
            totalUnrealizedProfit: (data as any).totalUnrealizedProfit,
            multiAssetsMargin: !!(data as any).multiAssetsMargin,
            source: 'snapshot',
          });

          this.messageHandlers.forEach(h => h(data));
          return;
        }

        // Fallback when server doesn't support getPositionRisk
        if (data?.type === 'error' && data?.action === 'getPositionRisk') {
          this.noPositionRiskSupport = true;
          console.warn('[WS] getPositionRisk not supported → fallback to getFuturesAccount()');
          this.getFuturesAccount();
          return;
        }

        // ===== AUTHENTICATED =====
        if (data?.type === 'authenticated') {
          this.state = 'authenticated';
          this.authInFlight = false;
          this.authResolvers.splice(0).forEach(r => r());
          this.flushAuthed();
          return;
        }

        // ===== RAW array positions with leverage backfill =====
        if (Array.isArray(data) && data[0]?.symbol && data[0]?.positionAmt) {
          try {
            for (const r of data) {
              const sym = String(r.symbol ?? '');
              const lev = Number(r.leverage ?? r.l);
              if (sym && Number.isFinite(lev) && lev > 0) this.setLeverageFor(sym, lev);
            }
          } catch {}

          if (this.positionUpdateHandler) this.positionUpdateHandler(data);

          try {
            const symbols = Array.from(new Set(data.map((p: any) => p.symbol))).filter(Boolean);
            if (symbols.length) {
              if (this.noPositionRiskSupport) this.getFuturesAccount();
              else this.requestPositionRisk(symbols);
            }
          } catch {}

          this.messageHandlers.forEach(h => h(data));
          return;
        }

        // ===== MiniTicker (public) =====
        if (data.e === '24hrMiniTicker' || data.action === 'miniTickerUpdate') {
          const id = `miniTicker_${data.s || data.symbol}`;
          const cb = this.callbacks.get(id);
          if (cb) cb(data);
          else console.warn('⚠️ Không có callback cho miniTicker:', id);
          return;
        }

        // ===== MarkPrice Update (custom action) =====
        if (data.action === 'markPriceUpdate') {
          this.handleMarkPriceData(data);
          return;
        }

        /// ===== ORDER UPDATE (futures) =====
if (data.e === 'ORDER_TRADE_UPDATE' && data.o) {
  this.scheduleAccountRefresh(350);

  const o = data.o;
  const order = {
    orderId: o.i,
    symbol: o.s,
    side: o.S,
    type: o.o,
    price: o.p,
    origQty: o.q,
    executedQty: o.z ?? o.q ?? '0',
    status: o.X,
    stopPrice: o.sp,
    workingType: o.wt,
    time: o.T ?? data.T ?? Date.now(),
    updateTime: data.T ?? o.T ?? Date.now(),
  };

  // Đọc LS hiện tại
  let currentOrders: typeof order[] = readOpenOrdersLS();

  // Auto-cancel lệnh đối ứng khi 1 cái FILLED
  if (['TAKE_PROFIT_MARKET', 'STOP_MARKET'].includes(order.type) && order.status === 'FILLED') {
    const oppositeType = order.type === 'TAKE_PROFIT_MARKET' ? 'STOP_MARKET' : 'TAKE_PROFIT_MARKET';
    const opposite = currentOrders.find(
      (x) => x.symbol === order.symbol && x.type === oppositeType && x.status === 'NEW'
    );
    if (opposite) {
      console.log('🤖 Huỷ lệnh đối ứng TP/SL:', oppositeType, 'orderId:', opposite.orderId);
      this.sendAuthed({ action: 'cancelOrder', symbol: order.symbol, orderId: opposite.orderId, market: 'futures' });
    }
  }

  // ===== Reconcile với optimistic tmp_* nếu cần =====
  let idx = currentOrders.findIndex((x) => String(x.orderId) === String(order.orderId));
  if (idx < 0) {
    idx = currentOrders.findIndex((x: any) =>
      x._optimistic &&
      x.symbol === order.symbol &&
      x.type === order.type &&
      x.side === order.side &&
      String(x.stopPrice ?? x.price) === String(order.stopPrice ?? order.price) &&
      String(x.origQty) === String(order.origQty)
    );
  }

  // Cập nhật danh sách theo status
  if (['FILLED', 'CANCELED', 'REJECTED', 'EXPIRED'].includes(order.status)) {
    // remove
    currentOrders = currentOrders.filter((x, i) => i !== idx && x.orderId !== order.orderId);
  } else {
    if (idx !== -1) {
  currentOrders[idx] = { ...currentOrders[idx], ...order };
  delete (currentOrders[idx] as any)._optimistic;
}
    else currentOrders.unshift(order);
  }

  console.log('📦 Final openOrders:', currentOrders);
  writeOpenOrdersLS(currentOrders);            // <— phát sự kiện cho UI
  this.orderUpdateHandler?.(currentOrders); 
  setTimeout(() => this.getPositions(), 300);   // giữ callback cũ
  // (tiếp tục forward nếu bạn muốn)
}
// ===== ALGO ORDER UPDATE (TP/SL conditional orders) =====
if (data.e === 'ALGO_UPDATE' && data.o) {
  this.scheduleAccountRefresh(350);

  const o = data.o;
  
  // Map từ algo format sang standard format
  const order = {
    orderId: o.aid,           // algoId -> orderId
    symbol: o.s,              // symbol
    side: o.S,                // side
    type: o.o,                // orderType -> type
    price: o.p,               // price
    origQty: o.q,             // quantity
    executedQty: '0',         // algo orders chưa khớp
    status: o.X,              // algoStatus -> status (NEW, FILLED, CANCELLED)
    stopPrice: o.tp,          // triggerPrice -> stopPrice
    workingType: o.wt,        // workingType
    time: data.T ?? Date.now(),
    updateTime: data.E ?? data.T ?? Date.now(),
    closePosition: o.cp,      // closePosition
    reduceOnly: o.R,          // reduceOnly
    positionSide: o.ps,       // positionSide
    _isAlgo: true,            // ✅ Đánh dấu là algo order
  };

  console.log('📥 ALGO_UPDATE mapped:', order);

  // Đọc LS hiện tại
  let currentOrders: typeof order[] = readOpenOrdersLS();

  // Auto-cancel lệnh đối ứng khi 1 cái FILLED
  if (['TAKE_PROFIT_MARKET', 'STOP_MARKET'].includes(order.type) && order.status === 'FILLED') {
    const oppositeType = order.type === 'TAKE_PROFIT_MARKET' ? 'STOP_MARKET' : 'TAKE_PROFIT_MARKET';
    const opposite = currentOrders.find(
      (x) => x.symbol === order.symbol && x.type === oppositeType && x.status === 'NEW'
    );
    if (opposite) {
      console.log('🤖 Huỷ lệnh đối ứng TP/SL (algo):', oppositeType, 'orderId:', opposite.orderId);
      this.sendAuthed({ action: 'cancelOrder', symbol: order.symbol, orderId: opposite.orderId, market: 'futures', isAlgo: true });
    }
  }

  // Tìm order đã tồn tại theo algoId
  let idx = currentOrders.findIndex((x) => String(x.orderId) === String(order.orderId));
  
  // Fallback: tìm theo optimistic tmp_*
  if (idx < 0) {
    idx = currentOrders.findIndex((x: any) =>
      x._optimistic &&
      x.symbol === order.symbol &&
      x.type === order.type &&
      x.side === order.side &&
      Math.abs(Number(x.stopPrice) - Number(order.stopPrice)) < 0.0001
    );
  }

  // Cập nhật danh sách theo status
  if (['FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(order.status)) {
    // remove
    currentOrders = currentOrders.filter((x, i) => i !== idx && x.orderId !== order.orderId);
  } else {
    if (idx !== -1) {
  currentOrders[idx] = { ...currentOrders[idx], ...order };
  delete (currentOrders[idx] as any)._optimistic;
}
    else currentOrders.unshift(order);
  }

  console.log('📦 Final openOrders (with algo):', currentOrders);
  writeOpenOrdersLS(currentOrders);
  this.orderUpdateHandler?.(currentOrders);
  setTimeout(() => this.getPositions(), 300);
}

// ===== ALGO ORDER RESPONSE (khi vừa đặt xong) =====
if (data.algoId && data.algoType === 'CONDITIONAL' && data.algoStatus) {
  console.log('📥 Algo order placed response:', data);
  
  const order = {
    orderId: data.algoId,
    symbol: data.symbol,
    side: data.side,
    type: data.orderType,
    price: data.price,
    origQty: data.quantity,
    executedQty: '0',
    status: data.algoStatus,
    stopPrice: data.triggerPrice,
    workingType: data.workingType,
    time: data.createTime ?? Date.now(),
    updateTime: data.updateTime ?? Date.now(),
    closePosition: data.closePosition,
    reduceOnly: data.reduceOnly,
    positionSide: data.positionSide,
    _isAlgo: true,
  };

  let currentOrders = readOpenOrdersLS();
  
  // Tìm và thay thế optimistic order
  const idx = currentOrders.findIndex((x: any) =>
    x._optimistic &&
    x.symbol === order.symbol &&
    x.type === order.type &&
    x.side === order.side &&
    Math.abs(Number(x.stopPrice) - Number(order.stopPrice)) < 0.0001
  );

  if (idx !== -1) {
    currentOrders[idx] = { ...order, _optimistic: undefined };
  } else {
    // Kiểm tra xem đã có chưa
    const exists = currentOrders.some(x => String(x.orderId) === String(order.orderId));
    if (!exists) {
      currentOrders.unshift(order);
    }
  }

  console.log('📦 Final openOrders (algo placed):', currentOrders);
  writeOpenOrdersLS(currentOrders);
  this.orderUpdateHandler?.(currentOrders);
}

        // ===== ACCOUNT UPDATE (Spot/Futures) =====
        if (data?.type === 'update' && data?.channel === 'account') {
          if (data.availableBalance !== undefined || data.totalWalletBalance !== undefined) {
            this.emitAccountInformation({
              availableBalance: data.availableBalance,
              totalWalletBalance: data.totalWalletBalance,
              totalMarginBalance: data.totalMarginBalance,
              totalUnrealizedProfit: data.totalUnrealizedProfit,
              multiAssetsMargin: data.multiAssetsMargin,
              source: 'ws-live',
            });
          } else {
            this.scheduleAccountRefresh(350);
          }

          if (data.orders && this.orderUpdateHandler) {
  console.log('🟢 [WS] Gửi orders từ server về UI:', data.orders);
  writeOpenOrdersLS(data.orders);          // <— thay cho setItem
  this.orderUpdateHandler(data.orders);
}


          if (Array.isArray(data?.a?.P) && this.positionUpdateHandler) {
            const positions = data.a.P.map((p: any) => {
              const sym = String(p.s);
              const levFromPacket = Number(p.l);
              const lev = (Number.isFinite(levFromPacket) && levFromPacket > 0)
                ? levFromPacket
                : (this.getLeverage(p.s, 'futures') || undefined);

              return {
                symbol: sym,
                positionAmt: p.pa,
                entryPrice: p.ep,
                breakEvenPrice: p.bep,
                marginType: (p.mt || '').toString().toLowerCase(),
                isolatedWallet: typeof p.iw === 'number' ? p.iw : undefined,
                positionSide: p.ps,
                leverage: lev,
              };
            });

            console.log('ACCOUNT_UPDATE ENRICH', positions.map(p => ({ s: p.symbol, lev: p.leverage })));
            this.positionUpdateHandler(positions);
  // gửi delta event để UI merge từng phần
  this.messageHandlers.forEach(h => h({ type: 'positionsDelta', data: positions }));
const merged = positions; // (tuỳ bạn merge với lastPositions; tạm thời replace)
writePositionsLS(merged);
            try {
              const needBackfill = positions.some((x: any) => !(Number(x.leverage) > 0));
              if (needBackfill) this.getFuturesAccount();
            } catch (e) {
              console.warn('position backfill check err:', e);
            }
          }

          this.messageHandlers.forEach(h => h(data));
          return;
        }

        if (data.e === 'ACCOUNT_CONFIG_UPDATE' && data.ac) {
          const { s: symbol, l: leverage } = data.ac || {};
          if (symbol && Number.isFinite(leverage)) {
            this.setLeverageFor(symbol, leverage, 'futures');
            this.messageHandlers.forEach(h => h({ type: 'leverageUpdate', symbol, leverage }));
          }
          return;
        }

        // ===== Multi Assets Mode =====
        if (data.type === 'getMultiAssetsMode' || data.type === 'changeMultiAssetsMode') {
          console.log('📥 [WS] Nhận multiAssetsMode:', data);
          if (data.positions) {
            if (data.positions) writePositionsLS(data.positions);
          }
          if (data.multiAssetsMargin !== undefined && this.currentAccountId) {
            localStorage.setItem(`multiAssetsMode_${this.currentAccountId}`, String(data.multiAssetsMargin));
          }
          this.messageHandlers.forEach(h => h(data));
          return;
        }

        // ===== POSITION RISK (backfill leverage/IM) =====
        if (data?.type === 'positionRisk' && Array.isArray(data.data)) {
          this.messageHandlers.forEach(h => h(data));
          return;
        }

         // ===== ERROR HANDLING - CHECK TRƯỚC KHI FORWARD =====
        if (data?.type === 'error' && data?.message) {
  console.log('🚨 Error from BinanceWS:', data);
  
  // ✅ ENHANCED: Thêm action context nếu có thể detect
  const enhancedError = { ...data };
  
  // Detect order-related errors
  if (data.message.includes('Order') || 
      data.message.includes('order') ||
      data.message.includes('exceeds') ||
      data.message.includes('Insufficient') ||
      data.message.includes('position') ||
      data.message.includes('PRICE_FILTER') ||
      data.message.includes('LOT_SIZE')) {
    enhancedError.action = enhancedError.action || 'placeOrder';
  }
  
  // Forward error để TradingTerminal bắt được
  this.messageHandlers.forEach(h => h(enhancedError));
  return;
}

        // ===== Forward còn lại =====
        this.messageHandlers.forEach(h => h(data));
      } catch (error) {
        console.error('❌ WS parse error:', error);
      }
    };

    sock.onerror = (event) => {
      console.error('❌ WebSocket error:', event);
      
      // ✅ THÊM - Trigger maintenance modal
      if (this.onMaintenanceCallback) {
        console.log('🚨 Triggering maintenance modal from WebSocket error');
        this.onMaintenanceCallback();
      }
    };

    sock.onclose = (event) => {
      console.warn('🔌 WebSocket closed:', event.code, event.reason || 'no reason');
      this.state = 'closed';
      
      // ✅ THÊM - Trigger maintenance modal nếu đóng bất thường
      // Code 1000 = Normal closure, 1001 = Going away
      if (event.code !== 1000 && event.code !== 1001) {
        if (this.onMaintenanceCallback) {
          console.log('🚨 Triggering maintenance modal (abnormal close, code:', event.code, ')');
          this.onMaintenanceCallback();
        }
      }
    };
  }

  // ========= Low-level senders =========
  private sendOpen(data: any) {
    if (!this.socket) {
      console.warn('⛔ WS null, queue preAuth:', data);
      this.preAuthQueue.push(data);
      return;
    }
    if (this.socket.readyState === WebSocket.OPEN && (this.state === 'open' || this.state === 'authenticated')) {
      console.log('📤 WS Sending (open):', data);
      this.socket.send(JSON.stringify(data));
    } else {
      console.warn('⛔ WS not open, queue preAuth:', data);
      this.preAuthQueue.push(data);
    }
  }

  private sendAuthed(data: any) {
    if (!this.socket || this.state !== 'authenticated' || this.socket.readyState !== WebSocket.OPEN) {
      if (data?.action === 'selectBinanceAccount') {
        this.authedQueue = [data, ...this.authedQueue.filter(m => m.action !== 'selectBinanceAccount')];
      } else {
        this.authedQueue.push(data);
      }
      return;
    }
    console.log('📤 WS Sending (authed):', data);
    this.socket.send(JSON.stringify(data));
  }

  private flushPreAuth() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const q = this.preAuthQueue;
    this.preAuthQueue = [];
    q.forEach(msg => {
      try { this.socket!.send(JSON.stringify(msg)); }
      catch { this.preAuthQueue.push(msg); }
    });
  }

  private flushAuthed() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.state !== 'authenticated') return;

    const q = this.authedQueue;
    this.authedQueue = [];

    const selects = q.filter(m => m.action === 'selectBinanceAccount');
    const subs    = q.filter(m => m.action === 'subscribeAccountUpdates');
    const others  = q.filter(m => m.action !== 'selectBinanceAccount' && m.action !== 'subscribeAccountUpdates');

    const send = (m: any) => this.socket!.send(JSON.stringify(m));

    if (selects.length) {
      selects.forEach(send);
      setTimeout(() => {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.state !== 'authenticated') {
          this.authedQueue.push(...subs, ...others);
          return;
        }
        subs.forEach(send);
        others.forEach(send);
      }, 120);
    } else {
      [...subs, ...others].forEach(send);
    }
  }

  // ========= Auth & session =========
  public authenticate(token: string) {
    if (this.state === 'authenticated' || this.authInFlight) return;
    this.authInFlight = true;

    this.sendOpen({ action: 'authenticate', token });

    // Queue ONLY ONCE
    this.pushAuthedUnique('getMyBinanceAccounts', { action: 'getMyBinanceAccounts' });
    this.pushAuthedUnique('getFuturesAccount',    { action: 'getFuturesAccount' });
  }

  public getMyBinanceAccounts() {
    this.sendAuthed({ action: 'getMyBinanceAccounts' });
  }

  // ========= Accounts / Positions (wrappers sạch) =========
  public selectAccount(id: number) {
    // Guard duplicate select within short window
    if (this.currentAccountId === id && this.lastSelectSent && (Date.now() - this.lastSelectSent.ts) < 1500) {
      console.debug('[WS] selectAccount suppressed (same id, cooldown)');
      return;
    }

    console.log('⚙️ Selecting account with ID:', id);
    this.currentAccountId = id;
    localStorage.setItem('selectedBinanceAccountId', String(id));
    this.hydrateLeverageCacheFromLS('futures');

    this.lastSelectSent = { id, ts: Date.now() };
    this.sendAuthed({ action: 'selectBinanceAccount', binanceAccountId: id });
  }

  public getLeverage(symbol: string, market: MarketType = 'futures', fallback = 2): number {
    const sym = symbol.toUpperCase();
    const cache = this.symbolLeverage.get(sym);
    if (Number.isFinite(cache) && (cache as number) > 0) return cache as number;

    const fromLS = this.loadLeverageLS(sym, market);
    if (Number.isFinite(fromLS) && (fromLS as number) > 0) {
      this.symbolLeverage.set(sym, fromLS as number);
      return fromLS as number;
    }
    return fallback;
  }

  public getBalances(market: 'spot' | 'futures' | 'both') {
    console.log('🔎 Getting balances for market:', market);
    this.sendAuthed({ action: 'getBalances', market });
  }

  public async getPositions(binanceAccountId?: number) {
  // ✅ GUARD CỨNG: Check account ID trước
  const savedIdStr = localStorage.getItem('selectedBinanceAccountId');
  const savedId = savedIdStr !== null ? Number(savedIdStr) : undefined;
  const id: number | undefined = binanceAccountId ?? this.currentAccountId ?? savedId;
  
  // Không có account ID → skip ngay
  if (!id) {
    console.warn('⏭️ getPositions skipped - no account ID available');
    return;
  }
  
  // WebSocket chưa ready → skip ngay  
  if (!this.isConnected() || this.state !== 'authenticated') {
    console.warn('⏭️ getPositions skipped - WebSocket not ready');
    return;
  }
  
  // ✅ NEW: Server chưa nhận selectAccount → skip
  if (!this.accountSelectedOnServer) {
    console.warn('⏭️ getPositions skipped - account not yet selected on server');
    return;
  }
  
  // ✅ DEBOUNCE: Skip if called recently  
  const callKey = 'getPositions';
  const lastCall = this.pendingApiCalls.get(callKey) || 0;
  const now = Date.now();
  
  if (now - lastCall < this.apiDebounceMs) {
    console.log('⏭️ Skipping getPositions (debounced)');
    return;
  }
  
  this.pendingApiCalls.set(callKey, now);
  
  // throttle snapshots to avoid bursts
  if (now - this.lastPositionsPullAt < this.snapshotCooldownMs) {
    return console.debug('[WS] getPositions suppressed (cooldown)');
  }
  this.lastPositionsPullAt = now;

  this.sendAuthed({ action: 'getPositions', binanceAccountId: id });
}

  public async getFuturesAccount(id?: number) {
  // ✅ GUARD CỨNG: Check account ID trước
  const target = id ?? this.currentAccountId ?? Number(localStorage.getItem('selectedBinanceAccountId') || 0);
  
  // Không có account ID → skip ngay
  if (!target) {
    console.warn('⏭️ getFuturesAccount skipped - no account ID available');
    return;
  }
  
  // WebSocket chưa ready → skip ngay
  if (!this.isConnected() || this.state !== 'authenticated') {
    console.warn('⏭️ getFuturesAccount skipped - WebSocket not ready');
    return;
  }
  
  // ✅ NEW: Server chưa nhận selectAccount → skip
  if (!this.accountSelectedOnServer) {
    console.warn('⏭️ getFuturesAccount skipped - account not yet selected on server');
    return;
  }
  
  // ✅ DEBOUNCE: Skip if called recently
  const callKey = 'getFuturesAccount';
  const lastCall = this.pendingApiCalls.get(callKey) || 0;
  const now = Date.now();
  
  if (now - lastCall < this.apiDebounceMs) {
    console.log('⏭️ Skipping getFuturesAccount (debounced)');
    return;
  }
  
  this.pendingApiCalls.set(callKey, now);
  
  this.sendAuthed({ action: 'getFuturesAccount', binanceAccountId: target });
}
  public async getSpotAccount(id?: number) {
  // ✅ GUARD CỨNG: Check account ID trước
  const target = id ?? this.currentAccountId ?? Number(localStorage.getItem('selectedBinanceAccountId') || 0);
  
  // Không có account ID → skip ngay
  if (!target) {
    console.warn('⏭️ getSpotAccount skipped - no account ID available');
    return;
  }
  
  // WebSocket chưa ready → skip ngay
  if (!this.isConnected() || this.state !== 'authenticated') {
    console.warn('⏭️ getSpotAccount skipped - WebSocket not ready');
    return;
  }
  
  // ✅ NEW: Server chưa nhận selectAccount → skip
  if (!this.accountSelectedOnServer) {
    console.warn('⏭️ getSpotAccount skipped - account not yet selected on server');
    return;
  }
  
  this.sendAuthed({ action: 'getSpotAccount', binanceAccountId: target });
}

  public async getMultiAssetsMode(onResult?: (isMulti: boolean, raw: any) => void) {
  // ✅ GUARD CỨNG: WebSocket phải ready
  if (!this.isConnected() || this.state !== 'authenticated') {
    console.warn('⏭️ getMultiAssetsMode skipped - WebSocket not ready');
    return;
  }
  
  // Phải có account ID
  const accountId = this.currentAccountId ?? Number(localStorage.getItem('selectedBinanceAccountId') || 0);
  if (!accountId) {
    console.warn('⏭️ getMultiAssetsMode skipped - no account ID available');
    return;
  }
  
  // ✅ NEW: Server chưa nhận selectAccount → skip
  if (!this.accountSelectedOnServer) {
    console.warn('⏭️ getMultiAssetsMode skipped - account not yet selected on server');
    return;
  }
  
  this.sendAuthed({ action: 'getMultiAssetsMode' });
  if (!onResult) return;

  const once = (msg: any) => {
    if (msg?.type === 'getMultiAssetsMode') {
      const isMulti = !!msg.multiAssetsMargin;
      onResult(isMulti, msg);
      this.removeMessageHandler(once);
    }
  };
  this.onMessage(once);
}

  // ========= Orders =========
  public placeOrder(
  payload: PlaceOrderPayload, 
  onSuccess?: (data: any) => void, 
  onError?: (error: { message: string; code?: number }) => void
) {
  // ✅ FIX: Binance rule - khi closePosition='true', KHÔNG được truyền quantity
  const finalPayload = { ...payload };
  if (finalPayload.closePosition === 'true') {
    delete finalPayload.quantity;
  }
  
  // ✅ NEW: Setup error handler nếu có callback
  if (onSuccess || onError) {
    const requestId = `placeOrder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const handler = (msg: any) => {
      // Check error response
      if (msg?.type === 'error') {
        // Check nếu error liên quan đến order này
        const isOrderError = 
          msg.action === 'placeOrder' ||
          msg.symbol === payload.symbol ||
          (msg.message && (
            msg.message.includes('Order') ||
            msg.message.includes('order') ||
            msg.message.includes('exceeds') ||
            msg.message.includes('Insufficient') ||
            msg.message.includes('position')
          ));
        
        if (isOrderError) {
          console.log('🚨 placeOrder error detected:', msg);
          onError?.({ message: msg.message || 'Order failed', code: msg.code });
          this.removeMessageHandler(handler);
          return;
        }
      }
      
      // Check ORDER_TRADE_UPDATE response
      if (msg?.e === 'ORDER_TRADE_UPDATE' && msg?.o) {
        const orderData = msg.o;
        
        // Check nếu là order của mình
        if (orderData.s !== payload.symbol) return;
        
        const isSameOrder = 
          orderData.S === payload.side &&
          (payload.quantity === undefined || Math.abs(parseFloat(orderData.q) - payload.quantity) < 0.0001);
        
        if (!isSameOrder) return;
        
        const status = orderData.X;
        
        if (status === 'NEW' || status === 'FILLED' || status === 'PARTIALLY_FILLED') {
          console.log('✅ placeOrder success:', status);
          onSuccess?.({ status, orderData });
          this.removeMessageHandler(handler);
        } else if (status === 'REJECTED' || status === 'CANCELED' || status === 'EXPIRED') {
          console.log('❌ placeOrder failed:', status, orderData.rj);
          onError?.({ message: orderData.rj || `Order ${status}`, code: -1 });
          this.removeMessageHandler(handler);
        }
      }
      
      // Check orderPlaced response từ backend
      if (msg?.type === 'orderPlaced' && msg?.data?.symbol === payload.symbol) {
        console.log('✅ placeOrder confirmed by backend');
        onSuccess?.(msg.data);
        this.removeMessageHandler(handler);
      }
    };
    
    this.onMessage(handler);
    
    // Timeout sau 15 giây
    setTimeout(() => {
      this.removeMessageHandler(handler);
    }, 15000);
  }
  
  this.sendAuthed({ action: 'placeOrder', ...finalPayload });
  setTimeout(() => this.getPositions(), 400);
}

  /** Lấy danh sách lệnh mở theo market (và optional symbol) */
  public getOpenOrders(market: 'spot' | 'futures', symbol?: string, onResult?: (orders: any[]) => void) {
  const payload: any = { action: 'getOpenOrders', market };
  if (symbol) payload.symbol = symbol;
  
  if (onResult) {
    const requestId = `getOpenOrders_${Date.now()}`;
    const handler = (msg: any) => {
      // Check nếu là response cho getOpenOrders
      if (msg?.type === 'openOrders' || msg?.type === 'getOpenOrders' || 
          (Array.isArray(msg) && (msg.length === 0 || msg[0]?.orderId !== undefined))) {
        const orders = Array.isArray(msg) ? msg : (Array.isArray(msg?.data) ? msg.data : []);
        onResult(orders);
        this.removeMessageHandler(handler);
      }
    };
    this.onMessage(handler);
    
    // Timeout để cleanup handler
    setTimeout(() => this.removeMessageHandler(handler), 5000);
  }
  
  this.sendAuthed(payload);
}

public getAllOpenOrders(
  symbol?: string, 
  market: 'spot' | 'futures' = 'futures',
  onResult?: (data: { regular: any[]; algo: any[]; all: any[]; total: number }) => void
) {
  const payload: any = { action: 'getAllOpenOrders', market };
  if (symbol) payload.symbol = symbol;
  
  console.log('📤 Gửi getAllOpenOrders:', payload);
  
  if (onResult) {
    const handler = (msg: any) => {
      console.log('📥 getAllOpenOrders handler received:', msg);
      
      // Check nhiều format response có thể từ backend
      const isAllOrdersResponse = 
        msg?.type === 'getAllOpenOrders' || 
        msg?.type === 'allOpenOrders' ||
        (msg?.regular !== undefined && msg?.algo !== undefined);
      
      if (isAllOrdersResponse) {
        const regular: any[] = Array.isArray(msg?.regular) ? msg.regular : [];
        // ✅ Đánh dấu _isAlgo cho algo orders
        const algo: any[] = Array.isArray(msg?.algo) 
          ? msg.algo.map((o: any) => ({ ...o, _isAlgo: true })) 
          : [];
        
        const result = {
          regular,
          algo,
          all: [...regular, ...algo] as any[],
          total: regular.length + algo.length
        };
        
        console.log('✅ getAllOpenOrders parsed:', result);
        onResult(result);
        this.removeMessageHandler(handler);
      }
    };
    
    this.onMessage(handler);
    
    // Timeout cleanup handler sau 5s
    setTimeout(() => this.removeMessageHandler(handler), 5000);
  }
  
  this.sendAuthed(payload);
}

/** 
 * Cancel order thông minh - tự detect regular/algo
 */
public cancelOrderSmart(
  symbol: string, 
  orderId: number, 
  market: 'spot' | 'futures' = 'futures',
  isAlgo?: boolean
) {
  const payload: any = { 
    action: 'cancelOrderSmart', 
    symbol, 
    orderId, 
    market 
  };
  
  // Nếu biết chắc là algo order
  if (isAlgo !== undefined) {
    payload.isAlgo = isAlgo;
  }
  
  console.log('🛑 Gửi cancelOrderSmart:', payload);
  this.sendAuthed(payload);
}

/** 
 * Cancel TẤT CẢ orders (cả regular + algo)
 */
public cancelAllOrdersSmart(
  symbol: string, 
  market: 'spot' | 'futures' = 'futures',
  onResult?: (result: { regularCancelled: number; algoCancelled: number }) => void
) {
  const payload = { action: 'cancelAllOrdersSmart', symbol, market };
  
  console.log('🛑 Gửi cancelAllOrdersSmart:', payload);
  
  if (onResult) {
    const handler = (msg: any) => {
      if (msg?.type === 'cancelAllOrdersSmart' || msg?.type === 'cancelAllOrdersSmartResult') {
        onResult({
          regularCancelled: msg?.regularCancelled ?? 0,
          algoCancelled: msg?.algoCancelled ?? 0
        });
        this.removeMessageHandler(handler);
      }
    };
    this.onMessage(handler);
    setTimeout(() => this.removeMessageHandler(handler), 5000);
  }
  
  this.sendAuthed(payload);
}

  /** Huỷ 1 lệnh theo orderId/symbol/market */
 public cancelOrder(symbol: string, orderId: number, market: 'spot' | 'futures', isAlgo?: boolean) {
  const payload: any = { action: 'cancelOrder', symbol, orderId, market };
  
  // ✅ Thêm flag isAlgo nếu có
  if (isAlgo) {
    payload.isAlgo = true;
  }
  
  console.log('🛑 Gửi yêu cầu huỷ lệnh:', payload);
  this.sendAuthed(payload);
}

  public cancelAllOrders(symbol: string, market: 'spot' | 'futures') {
    const payload = { action: 'cancelAllOrders', symbol, market };
    console.log('🛑 Gửi yêu cầu huỷ tất cả lệnh:', payload);
    this.sendAuthed(payload);
  }

  private accountSubActive = false;

  // ========= Realtime account updates =========
  public async subscribeAccountUpdates(onOrderUpdate: (orders: any[]) => void, types = ['orders', 'positions', 'balance']) {
  // ✅ GUARD: Wait for account selected
  if (!this.accountSelected) {
    console.warn('⚠️ subscribeAccountUpdates called before account selected, waiting...');
    await this.waitForAccountSelected();
  }
  
  if (this.accountSubActive) return;
  this.accountSubActive = true;
  this.orderUpdateHandler = onOrderUpdate;
  this.sendAuthed({ action: 'subscribeAccountUpdates', types });

  // ❌ FIX: Don't auto-trigger snapshot - prevents spam
  // this.ensureInitialSnapshot(160);
}

  public unsubscribeAccountUpdates(types: string[] = []) {
    const payload = { action: 'unsubscribeAccountUpdates', types };
    console.log('🔕 Hủy đăng ký cập nhật real-time:', payload);
    this.sendAuthed(payload);
    this.accountSubActive = false;
  }

  public changeMultiAssetsMode(
    multiAssetsMargin: boolean,
    onSuccess?: (res: any) => void,
    onError?: (err: string) => void
  ) {
    const payload = { action: 'changeMultiAssetsMode', multiAssetsMargin };
    this.sendAuthed(payload);

    const tempHandler = (msg: any) => {
      if (msg?.msg === 'success' && typeof msg.multiAssetsMargin === 'boolean') {
        onSuccess?.(msg);
        this.removeMessageHandler(tempHandler);
      } else if (msg?.success === false && msg?.error) {
        onError?.(msg.error);
        this.removeMessageHandler(tempHandler);
      }
    };
    this.onMessage(tempHandler);
  }

  // ========= Public/Futures streams =========
  private handleMarkPriceData(data: any) {
    const subscriptionId = `markPrice_${data.symbol}_${data.market}`;
    console.log('Handle MarkPriceData for subscriptionId:', subscriptionId);
    const callback = this.callbacks.get(subscriptionId);
    if (callback) {
      console.log('Callback found, calling with data:', data);
      callback(data);
    } else {
      console.warn('No callback found for subscriptionId:', subscriptionId);
    }
  }

  public subscribeMarkPrice(symbol: string, market: MarketType = 'futures', callback?: (data: any) => void) {
    const subscriptionId = `markPrice_${symbol}_${market}`;

    // Guard: already subscribed
    if (this.subscriptions.has(subscriptionId)) {
      if (callback) this.callbacks.set(subscriptionId, callback);
      return subscriptionId;
    }

    const message = { action: 'subscribeMarkPrice', market, symbol };
    console.log('📤 Gửi subscribeMarkPrice:', message);

    if (callback) this.callbacks.set(subscriptionId, callback);
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: 'subscribeMarkPrice',
      symbol,
      market,
      timestamp: Date.now(),
    });

    this.sendAuthed(message);
    return subscriptionId;
  }

  public subscribePublicMiniTicker(symbol: string, callback: (data: any) => void) {
    const id = `miniTicker_${symbol}`;
    if (this.subscriptions.has(id)) {
      this.callbacks.set(id, callback);
      return id;
    }
    this.callbacks.set(id, callback);

    const message = { action: 'subscribePublicMiniTicker', symbol };
    console.log('📤 Gửi subscribePublicMiniTicker:', message);

    this.subscriptions.set(id, { id, action: 'miniTicker', symbol, timestamp: Date.now() });
    this.sendAuthed(message);
    return id;
  }

  // ===== Positions cache & subscription =====
  private lastPositions: any[] = [];
  public onPositions?: PositionsCb;

  private handlePositions(msg: any) {
    const rows = Array.isArray(msg.positions) ? msg.positions : [];
    this.lastPositions = rows;
    this.onPositions?.(rows);
  }

  public subscribePositions(cb: PositionsCb) {
    this.onPositions = cb;
    if (this.lastPositions.length) cb(this.lastPositions);
    return () => {
      if (this.onPositions === cb) this.onPositions = undefined;
    };
  }

  // ===== App init helper (optional use) =====
  public async initAfterConnect() {
  await this.waitUntilAuthenticated();

  const saved = localStorage.getItem('selectedBinanceAccountId');
  if (saved) {
    await this.selectAccountAndWait(Number(saved), 200);
    
    // ✅ AWAIT để guards chặn spam
    await this.subscribeAccountUpdates((orders) => {
      writeOpenOrdersLS(orders || []);
      this.orderUpdateHandler?.(orders || []);
    });

    await this.getFuturesAccount();
    await this.getPositions();
  }
}

  // ===== Ensure initial snapshot once per account =====
  private ensureInitialSnapshot(delayMs = 150) {
    const id = this.currentAccountId ?? Number(localStorage.getItem('selectedBinanceAccountId') || 0);
    if (!id || this.initialPulled.has(id)) return;
    this.initialPulled.add(id);

    setTimeout(() => {
      this.getFuturesAccount(id);
      this.getPositions(id);
      this.getOpenOrders('futures');
    }, delayMs);
  }
  
 
}

export const binanceWS = new BinanceWebSocketService();