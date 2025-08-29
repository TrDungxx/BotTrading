// BinanceWebSocketService.ts
// Clean API: state machine + 2 queues (preAuth/authed), no generic send(), full wrappers

type MarketType = 'spot' | 'futures';
type WsState = 'closed' | 'connecting' | 'open' | 'authenticated';

class BinanceWebSocketService {
  private socket: WebSocket | null = null;
  private wsUrl = 'ws://45.77.33.141/w-binance-trading/signalr/connect';
  // ===== add fields =====
private authInFlight = false;
private authedOnceKeys = new Set<string>();

private pushAuthedUnique(key: string, msg: any) {
  if (this.authedOnceKeys.has(key)) return;
  this.authedOnceKeys.add(key);
  this.authedQueue.push(msg);
}

  // ===== State & queues =====
  private state: WsState = 'closed';
  private openResolvers: Array<() => void> = [];
  private authResolvers: Array<() => void> = [];
  private preAuthQueue: any[] = []; // gửi khi state >= 'open'
  private authedQueue: any[] = [];  // gửi khi state === 'authenticated'

  // ===== Handlers & caches =====
  private messageHandlers: ((data: any) => void)[] = [];
  private currentAccountId: number | null = null;
  private orderUpdateHandler: ((orders: any[]) => void) | null = null;
  private positionUpdateHandler: ((positions: any[]) => void) | null = null;

  // Subscriptions / callbacks cho stream
  private subscriptions: Map<string, any> = new Map();
  private callbacks: Map<string, (data: any) => void> = new Map();

  // ========= Helpers =========
  private waitForOpen(): Promise<void> {
    if (this.state === 'open' || this.state === 'authenticated') return Promise.resolve();
    return new Promise(res => this.openResolvers.push(res));
  }
  private waitForAuth(): Promise<void> {
    if (this.state === 'authenticated') return Promise.resolve();
    return new Promise(res => this.authResolvers.push(res));
  }

  public setCurrentAccountId(id: number) {
    this.currentAccountId = id;
  }
  public getCurrentAccountId(): number | null {
    return this.currentAccountId;
  }

  public setPositionUpdateHandler(handler: (positions: any[]) => void) {
    this.positionUpdateHandler = handler;
  }
  public setOrderUpdateHandler(handler: ((orders: any[]) => void) | null) {
    this.orderUpdateHandler = handler;
  }

  public onMessage(handler: (data: any) => void) {
    this.messageHandlers.push(handler);
  }
  public removeMessageHandler(handler: (data: any) => void) {
    this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
  }

  public isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }
//changeposition
public changePositionMode(dualSidePosition: boolean, onDone?: (ok: boolean, raw:any)=>void) {
  this.sendAuthed({ action: 'changePositionMode', dualSidePosition });

  if (!onDone) return;
  const once = (m:any) => {
    // BE của bạn có thể trả { type:'changePositionMode', dualSidePosition, success:true }
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

public getPositionMode(onResult?: (dual: boolean)=>void) {
  this.sendAuthed({ action: 'getPositionMode' });
  if (!onResult) return;
  const once = (m:any) => {
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
  this.openResolvers.splice(0); // bỏ pending resolvers
  this.authResolvers.splice(0);
  this.preAuthQueue = [];
  this.authedQueue = [];
  this.accountSubActive = false;
  this.messageHandlers = [];
  this.callbacks.clear();
  this.subscriptions.clear();
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
  await new Promise(res => setTimeout(res, settleMs)); // khớp với flushAuthed (120ms)
}


  // ========= Connect (idempotent) =========
  public connect(token: string, onMessage: (data: any) => void) {
    // Nếu đã có socket CONNECTING/OPEN: không tạo thêm
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
      if (!this.messageHandlers.includes(onMessage)) this.messageHandlers.push(onMessage);
      if (token) this.authenticate(token); // tự auth nếu chưa
      return;
    }

    this.state = 'connecting';
    const sock = new WebSocket(this.wsUrl);
    this.socket = sock;

    sock.onopen = () => {
      if (this.socket !== sock) return;
      this.state = 'open';
      console.log('✅ WebSocket connected');

      // Resolve những promise chờ OPEN
      this.openResolvers.splice(0).forEach(r => r());

      // Flush những job KHÔNG cần auth
      this.flushPreAuth();

      // Auth nếu có token
      if (token) this.authenticate(token);

      // Gắn handler global
      if (!this.messageHandlers.includes(onMessage)) this.messageHandlers.push(onMessage);

      // Khôi phục accountId từ localStorage (chỉ set state; gửi select sau khi authenticated)
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
        console.log('📥 WS Parsed:', data);

        // ===== AUTHENTICATED =====
        if (data?.type === 'authenticated') {
  this.state = 'authenticated';
  this.authInFlight = false;
  this.authResolvers.splice(0).forEach(r => r());
  this.flushAuthed();

  // ❌ Đừng auto select/subscribe ở đây
  // ❌ Đừng auto getPositions/getFuturesAccount ở đây
  return;
}

        // ====== HANDLE getPositions (array) ======
        if (Array.isArray(data) && data[0]?.symbol && data[0]?.positionAmt) {
          console.log('✅ Nhận được positions:', data);
          localStorage.setItem('positions', JSON.stringify(data));
          if (this.positionUpdateHandler) this.positionUpdateHandler(data);
          // forward cho listeners khác nếu cần
          this.messageHandlers.forEach((h) => h(data));
          return;
        }

        // ====== MiniTicker (public) ======
        if (data.e === '24hrMiniTicker' || data.action === 'miniTickerUpdate') {
          const id = `miniTicker_${data.s || data.symbol}`;
          const cb = this.callbacks.get(id);
          if (cb) cb(data);
          else console.warn('⚠️ Không có callback cho miniTicker:', id);
          return;
        }

        // ====== MarkPrice Update (custom action) ======
        if (data.action === 'markPriceUpdate') {
          this.handleMarkPriceData(data);
          return;
        }

        // ====== ORDER UPDATE (futures) ======
        if (data.e === 'ORDER_TRADE_UPDATE' && data.o) {
          const o = data.o;
          const order = {
            orderId: o.i,
            symbol: o.s,
            side: o.S,
            type: o.o,
            price: o.p,
            origQty: o.q,
            status: o.X,
          };

          let currentOrders: typeof order[] = JSON.parse(localStorage.getItem('openOrders') || '[]');

          // Tự huỷ TP/SL đối ứng khi một cái FILLED
          if (['TAKE_PROFIT_MARKET', 'STOP_MARKET'].includes(order.type) && order.status === 'FILLED') {
            const oppositeType = order.type === 'TAKE_PROFIT_MARKET' ? 'STOP_MARKET' : 'TAKE_PROFIT_MARKET';
            const opposite = currentOrders.find(
              (x) => x.symbol === order.symbol && x.type === oppositeType && x.status === 'NEW'
            );
            if (opposite) {
              console.log('🤖 Huỷ lệnh đối ứng TP/SL:', oppositeType, 'orderId:', opposite.orderId);
              this.sendAuthed({
                action: 'cancelOrder',
                symbol: order.symbol,
                orderId: opposite.orderId,
                market: 'futures',
              });
            }
          }

          // Cập nhật openOrders local
          if (['FILLED', 'CANCELED', 'REJECTED', 'EXPIRED'].includes(order.status)) {
            currentOrders = currentOrders.filter((x) => x.orderId !== order.orderId);
          } else {
            const idx = currentOrders.findIndex((x) => x.orderId === order.orderId);
            if (idx !== -1) currentOrders[idx] = order;
            else currentOrders.push(order);
          }

          console.log('📦 Final openOrders:', currentOrders);
          localStorage.setItem('openOrders', JSON.stringify(currentOrders));
          if (this.orderUpdateHandler) this.orderUpdateHandler(currentOrders);
          // Không return: để các handler khác vẫn nhận
        }

        // ====== ACCOUNT UPDATE (Spot/Futures) ======
        if (data.type === 'update' && data.channel === 'account') {
          if (data.orders && this.orderUpdateHandler) {
            console.log('🟢 [WS] Gửi orders từ server về UI:', data.orders);
            localStorage.setItem('openOrders', JSON.stringify(data.orders));
            this.orderUpdateHandler(data.orders);
          }

          // positions từ account update
          if (data.a?.P && this.positionUpdateHandler) {
            const positions = data.a.P.map((p: any) => ({
              symbol: p.s,
              positionAmt: p.pa,
              entryPrice: p.ep,
            }));
            console.log('📦 [WS] Cập nhật positions từ account:', positions);
            localStorage.setItem('positions', JSON.stringify(positions));
            this.positionUpdateHandler(positions);
          }
        }

        // ====== Multi Assets Mode ======
        if (data.type === 'getMultiAssetsMode' || data.type === 'changeMultiAssetsMode') {
          console.log('📥 [WS] Nhận multiAssetsMode:', data);
          if (data.positions) {
            localStorage.setItem('positions', JSON.stringify(data.positions));
          }
          if (data.multiAssetsMargin !== undefined && this.currentAccountId) {
            localStorage.setItem(`multiAssetsMode_${this.currentAccountId}`, String(data.multiAssetsMargin));
          }
          this.messageHandlers.forEach((h) => h(data));
          return;
        }

        // ====== Forward còn lại ======
        this.messageHandlers.forEach((h) => h(data));
      } catch (error) {
        console.error('❌ WS parse error:', error);
      }
    };

    sock.onerror = (event) => {
      console.error('❌ WebSocket error:', event);
    };

    sock.onclose = (event) => {
      console.warn('🔌 WebSocket closed:', event.reason || 'no reason');
      this.state = 'closed';
      // (tuỳ chọn) giữ queue để reconnect sau vẫn flush được
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
      // đưa lên đầu + khử trùng
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
    // đợi server “ghi” xong account, rồi mới bắn phần còn lại
    setTimeout(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.state !== 'authenticated') {
        this.authedQueue.push(...subs, ...others);
        return;
      }
      subs.forEach(send);
      others.forEach(send);
    }, 120);
  } else {
    // không có select thì flush bình thường
    [...subs, ...others].forEach(send);
  }
}

  // ========= Auth & session =========
  public authenticate(token: string) {
  if (this.state === 'authenticated' || this.authInFlight) return;
  this.authInFlight = true;

  // chỉ gửi auth 1 lần
  this.sendOpen({ action: 'authenticate', token });

  // chỉ xếp hàng getMyBinanceAccounts 1 lần
  this.pushAuthedUnique('getMyBinanceAccounts', { action: 'getMyBinanceAccounts' });
}

  public getMyBinanceAccounts() {
    this.sendAuthed({ action: 'getMyBinanceAccounts' });
  }

  public selectAccount(id: number) {
    console.log('⚙️ Selecting account with ID:', id);
    this.currentAccountId = id;
    localStorage.setItem('selectedBinanceAccountId', String(id));
    this.sendAuthed({ action: 'selectBinanceAccount', binanceAccountId: id });
  }

  public getBalances(market: 'spot' | 'futures' | 'both') {
    console.log('🔎 Getting balances for market:', market);
    this.sendAuthed({ action: 'getBalances', market });
  }

  // ========= Accounts / Positions (wrappers sạch) =========
  public getPositions(binanceAccountId?: number) {
    const savedIdStr = localStorage.getItem('selectedBinanceAccountId');
    const savedId = savedIdStr !== null ? Number(savedIdStr) : undefined;
    const id: number | undefined = binanceAccountId ?? this.currentAccountId ?? savedId;
    if (!id) { console.warn('[WS] getPositions: missing binanceAccountId'); return; }
    this.sendAuthed({ action: 'getPositions', binanceAccountId: id });
  }

  public getFuturesAccount(id?: number) {
  const target = id ?? this.currentAccountId ?? Number(localStorage.getItem('selectedBinanceAccountId') || 0);
  if (!target) return console.warn('[WS] getFuturesAccount: missing binanceAccountId');
  this.sendAuthed({ action: 'getFuturesAccount', binanceAccountId: target });
}

  public getSpotAccount(id?: number) {
  const target = id ?? this.currentAccountId ?? Number(localStorage.getItem('selectedBinanceAccountId') || 0);
  if (!target) return console.warn('[WS] getSpotAccount: missing binanceAccountId');
  this.sendAuthed({ action: 'getSpotAccount', binanceAccountId: target });
}

  public getMultiAssetsMode(
  onResult?: (isMulti: boolean, raw: any) => void
) {
  // gửi yêu cầu
  this.sendAuthed({ action: 'getMultiAssetsMode' });

  if (!onResult) return;

  // one-shot handler
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
  public placeOrder(payload: {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
    quantity: number;
    price?: number;
    market: 'futures' | 'spot';
    reduceOnly?: boolean;
    positionSide?: 'LONG' | 'SHORT';
  }) {
    this.sendAuthed({ action: 'placeOrder', ...payload });
  }

  /** Lấy danh sách lệnh mở theo market (và optional symbol) */
  public getOpenOrders(market: 'spot' | 'futures', symbol?: string) {
    const payload: any = { action: 'getOpenOrders', market };
    if (symbol) payload.symbol = symbol;
    this.sendAuthed(payload);
  }

  /** Huỷ 1 lệnh theo orderId/symbol/market */
  public cancelOrder(symbol: string, orderId: number, market: 'spot' | 'futures') {
    const payload = { action: 'cancelOrder', symbol, orderId, market };
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
  public subscribeAccountUpdates(onOrderUpdate: (orders:any[]) => void, types = ['orders','positions','balance']) {
  if (this.accountSubActive) return;
  this.accountSubActive = true;
  this.orderUpdateHandler = onOrderUpdate;
  this.sendAuthed({ action: 'subscribeAccountUpdates', types });
}

  public unsubscribeAccountUpdates(types: string[] = []) {
  const payload = { action: 'unsubscribeAccountUpdates', types };
  console.log('🔕 Hủy đăng ký cập nhật real-time:', payload);
  this.sendAuthed(payload);
  this.accountSubActive = false; // ⬅️ thêm dòng này
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

    // BE của bạn hình như yêu cầu auth → dùng authed
    this.sendAuthed(message);
    return subscriptionId;
  }

  public subscribePublicMiniTicker(symbol: string, callback: (data: any) => void) {
    const id = `miniTicker_${symbol}`;
    this.callbacks.set(id, callback);

    const message = { action: 'subscribePublicMiniTicker', symbol };
    console.log('📤 Gửi subscribePublicMiniTicker:', message);

    // Nếu thực sự public thì có thể sendOpen; hiện để authed cho chắc
    this.sendAuthed(message);
    return id;
  }
}

export const binanceWS = new BinanceWebSocketService();
