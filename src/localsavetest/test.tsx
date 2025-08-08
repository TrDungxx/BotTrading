type MarketType = 'spot' | 'futures';
class BinanceWebSocketService {
  private socket: WebSocket | null = null;
  private messageQueue: any[] = [];
  private messageHandlers: ((data: any) => void)[] = [];
  private currentAccountId: number | null = null;
  private orderUpdateHandler: ((order: any) => void) | null = null;
private positionUpdateHandler: ((positions: any[]) => void) | null = null;
// ** Thêm hai thuộc tính này để lưu subscriptions và callbacks **
  private subscriptions: Map<string, any> = new Map();
  private callbacks: Map<string, (data: any) => void> = new Map();
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

public subscribeMarkPrice(symbol: string, market: MarketType = "futures", callback?: (data: any) => void) {
  const subscriptionId = `markPrice_${symbol}_${market}`;
  const message = { action: "subscribeMarkPrice", market, symbol };
console.log("📤 Gửi subscribeMarkPrice:", message);
  if (callback) {
    this.callbacks.set(subscriptionId, callback);
  }

  this.subscriptions.set(subscriptionId, {
    id: subscriptionId,
    action: "subscribeMarkPrice",
    symbol,
    market,
    timestamp: Date.now(),
  });

  
  this.send(message);
  return subscriptionId;
}

subscribePublicMiniTicker(symbol: string, callback: (data: any) => void) {
  const id = `miniTicker_${symbol}`;
  this.callbacks.set(id, callback);

  const message = {
    action: 'subscribePublicMiniTicker',
    symbol,
  };

  console.log('📤 Gửi subscribePublicMiniTicker:', message);
  this.send(message);
  return id;
}



  public setCurrentAccountId(id: number) {
    this.currentAccountId = id;
  }

  public getCurrentAccountId(): number | null {
    return this.currentAccountId;
  }
setPositionUpdateHandler(handler: (positions: any[]) => void) {
  this.positionUpdateHandler = handler;
}
 setOrderUpdateHandler(handler: (order: any) => void) {
  this.orderUpdateHandler = handler;
}

  onMessage(handler: (data: any) => void) {
    this.messageHandlers.push(handler);
  }

  isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  connect(token: string, onMessage: (data: any) => void) {
    this.socket = new WebSocket('ws://45.77.33.141/w-binance-trading/signalr/connect');

    this.socket.onopen = () => {
      console.log('✅ WebSocket connected');
      this.flushMessageQueue(); // ✅ Gửi tất cả lệnh đã queue (authenticate...)

      const selectedId = localStorage.getItem("selectedBinanceAccountId");
if (selectedId) {
  const accountId = parseInt(selectedId, 10);
  this.setCurrentAccountId(accountId); // 🧠 Ghi nhớ lại accountId
  this.send({ action: "selectBinanceAccount", binanceAccountId: accountId });

  // ⏱ Delay nhỏ rồi mới subscribe
  setTimeout(() => {
    this.send({
      action: "subscribeAccountUpdates",
      types: ["balance", "positions", "orders"],
    });
  }, 300); // 300-500ms là hợp lý
}

      // ✅ Bắt buộc gán lại handler vì connect có thể gọi nhiều lần
      if (!this.messageHandlers.includes(onMessage)) {
        this.messageHandlers.push(onMessage);
      }
    };

    this.socket.onmessage = (event) => {
      console.log('📥 RAW WS MSG:', event.data); // ✅ GIỮ LẠI LOG UI GỐC
      try {
        const data = JSON.parse(event.data);
        console.log('📥 WS Parsed:', data);
// ====== HANDLE getPositions ======
if (Array.isArray(data) && data[0]?.symbol && data[0]?.positionAmt) {
  console.log('✅ Nhận được positions:', data);
  localStorage.setItem('positions', JSON.stringify(data));

  if (this.positionUpdateHandler) {
    this.positionUpdateHandler(data); // ✅ Gọi cập nhật UI tại đây
  }

  return;
}
if (data.e === '24hrMiniTicker' || data.action === 'miniTickerUpdate') {
  const id = `miniTicker_${data.s || data.symbol}`;
  const cb = this.callbacks.get(id);
  if (cb) {
    cb(data);
  } else {
    console.warn('⚠️ Không có callback cho miniTicker:', id);
  }
  return;
}

if (data.action === 'markPriceUpdate') {
      this.handleMarkPriceData(data);
      return; // không xử lý tiếp
    }
        // ====== ORDER UPDATE (futures) ======
        if (data.e === 'ORDER_TRADE_UPDATE' && data.o && this.orderUpdateHandler) {
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

          // 🧠 Tự huỷ TP/SL đối ứng nếu 1 cái khớp
          if (['TAKE_PROFIT_MARKET', 'STOP_MARKET'].includes(order.type) && order.status === 'FILLED') {
            const oppositeType = order.type === 'TAKE_PROFIT_MARKET' ? 'STOP_MARKET' : 'TAKE_PROFIT_MARKET';
            const opposite = currentOrders.find(
              (o) => o.symbol === order.symbol && o.type === oppositeType && o.status === 'NEW'
            );
            if (opposite) {
              console.log('🤖 Huỷ lệnh đối ứng TP/SL:', oppositeType, 'orderId:', opposite.orderId);
              this.send({
                action: 'cancelOrder',
                symbol: order.symbol,
                orderId: opposite.orderId,
                market: 'futures',
              });
            }
          }

          if (Array.isArray(data) && data[0]?.symbol && data[0]?.positionAmt) {
  console.log('✅ Nhận được positions:', data);
  localStorage.setItem('positions', JSON.stringify(data));

  if (this.positionUpdateHandler) {
    this.positionUpdateHandler(data);
  }

  return; // Không xử lý tiếp
}

          // 🧹 Cập nhật openOrders local
          if (['FILLED', 'CANCELED', 'REJECTED', 'EXPIRED'].includes(order.status)) {
  currentOrders = currentOrders.filter((o) => o.orderId !== order.orderId);
}

// ⚠️ Cập nhật positions (nếu là order FILLED)
else {
            const idx = currentOrders.findIndex((o) => o.orderId === order.orderId);
            if (idx !== -1) {
              currentOrders[idx] = order;
            } else {
              currentOrders.push(order);
            }
          }

          console.log('📦 Final openOrders:', currentOrders); // ✅ LOG UI
          localStorage.setItem('openOrders', JSON.stringify(currentOrders));
          this.orderUpdateHandler(currentOrders);
        }

        // ====== ACCOUNT UPDATE (Spot/Futures) ======
        if (data.type === 'update' && data.channel === 'account') {
  if (data.orders && this.orderUpdateHandler) {
    console.log('🟢 [WS] Gửi orders từ server về UI:', data.orders);
    localStorage.setItem('openOrders', JSON.stringify(data.orders));
    this.orderUpdateHandler(data.orders);
  }

  // ✅ NEW: xử lý positions trong account update
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

        // ====== HANDLE multiAssetsMargin (HEDGE / ONEWAY) ======
        if (
          data.type === 'getMultiAssetsMode' ||
          data.type === 'changeMultiAssetsMode'
        ) {
          console.log('📥 [WS] Nhận multiAssetsMode:', data); // ✅ GIỮ COMMENT GỐC UI

          if (data.positions) {
            localStorage.setItem('positions', JSON.stringify(data.positions)); // ✅ GIỮ COMMENT GỐC UI
          }

          if (data.multiAssetsMargin !== undefined && this.currentAccountId) {
            localStorage.setItem(
              `multiAssetsMode_${this.currentAccountId}`,
              String(data.multiAssetsMargin)
            );
          }

          this.messageHandlers.forEach((h) => h(data));
          return;
        }

        // ====== FORWARD TẤT CẢ CÒN LẠI ======
        this.messageHandlers.forEach((h) => h(data));
      } catch (error) {
        console.error('❌ WS parse error:', error);
      }
    };

    this.socket.onerror = (event) => {
      console.error('❌ WebSocket error:', event);
    };

    this.socket.onclose = (event) => {
      console.warn('🔌 WebSocket closed:', event.reason || 'no reason');
    };

    // ✅ Queue 2 lệnh đầu tiên
    this.send({ action: 'authenticate', token });
    this.send({ action: 'getMyBinanceAccounts' });
  }

  send(data: any) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log('📤 WS Sending:', data);
      this.socket.send(JSON.stringify(data));
    } else {
      console.warn('⛔ WS not ready (state = ' + this.socket?.readyState + '), queued message:', data);
      this.messageQueue.push(data);
      console.log('🟡 Total queued messages:', this.messageQueue.length);
    }
  }

  private flushMessageQueue() {
    this.messageQueue.forEach((msg) => {
      console.log('📤 WS Sending from queue:', msg);
      this.socket?.send(JSON.stringify(msg));
    });
    this.messageQueue = [];
  }

  removeMessageHandler(handler: (data: any) => void) {
    this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
  }

  changeMultiAssetsMode(
    multiAssetsMargin: boolean,
    onSuccess?: (res: any) => void,
    onError?: (err: string) => void
  ) {
    const payload = {
      action: 'changeMultiAssetsMode',
      multiAssetsMargin,
    };

    this.send(payload);

    const tempHandler = (msg: any) => {
      if (msg?.msg === 'success' && typeof msg.multiAssetsMargin === 'boolean') {
        onSuccess?.(msg);
      } else if (msg?.success === false && msg?.error) {
        onError?.(msg.error);
      }
      this.messageHandlers = this.messageHandlers.filter((h) => h !== tempHandler);
    };

    this.onMessage(tempHandler);
  }

  cancelAllOrders(symbol: string, market: 'spot' | 'futures') {
    const payload = {
      action: 'cancelAllOrders',
      symbol,
      market,
    };
    console.log('🛑 Gửi yêu cầu huỷ tất cả lệnh:', payload);
    this.send(payload);
  }

  getMyBinanceAccounts() {
    this.send({ action: 'getMyBinanceAccounts' });
  }

  selectAccount(id: number) {
    console.log('⚙️ Selecting account with ID:', id);
    this.send({ action: 'selectBinanceAccount', binanceAccountId: id });
  }

  getBalances(market: 'spot' | 'futures' | 'both') {
    console.log('🔎 Getting balances for market:', market);
    this.send({ action: 'getBalances', market });
  }

  subscribeAccountUpdates(
    onOrderUpdate: (orders: any[]) => void,
    types: string[] = ['orders', 'positions', 'balance']
  ) {
    console.log('✅ Đăng ký cập nhật realtime account updates');
    this.orderUpdateHandler = onOrderUpdate;

    const payload = {
      action: 'subscribeAccountUpdates',
      types,
    };

    console.log('📡 Gửi subscribeAccountUpdates:', payload);
    this.send(payload);
  }

  unsubscribeAccountUpdates(types: string[] = []) {
    const payload = {
      action: 'unsubscribeAccountUpdates',
      types,
    };
    console.log('🔕 Hủy đăng ký cập nhật real-time:', payload);
    this.send(payload);
  }
}

export const binanceWS = new BinanceWebSocketService();


import React, { useEffect, useState } from "react";
import { binancePublicWS } from "../binancewebsocket/binancePublicWS";
import { binanceWS } from "../binancewebsocket/BinanceWebSocketService";
interface PositionData {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice?: string;
}

interface PositionProps {
  positions?: PositionData[];
  market?: "spot" | "futures";
}

const Position: React.FC<PositionProps> = ({ positions: externalPositions, market }) => {
  const [positions, setPositions] = useState<PositionData[]>([]);

  // Load từ props hoặc localStorage
  useEffect(() => {
    if (!externalPositions || externalPositions.length === 0) {
      const raw = localStorage.getItem("positions");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setPositions(parsed);
        } catch {}
      }
    } else {
      setPositions(externalPositions);
    }
  }, [externalPositions]);


useEffect(() => {
  binanceWS.setPositionUpdateHandler((rawPositions) => {
    // ⚠️ Nếu không có vị thế nào hoặc toàn bộ đã đóng
    if (!Array.isArray(rawPositions) || rawPositions.length === 0) {
      setPositions([]);
      localStorage.removeItem("positions");
      return;
    }

    // ⚠️ Lọc bỏ vị thế đã đóng
    const filtered = rawPositions.filter((p: any) => parseFloat(p.positionAmt) !== 0);

    if (filtered.length === 0) {
      setPositions([]);
      localStorage.removeItem("positions");
      return;
    }

    // ✅ Chuẩn hóa dữ liệu
    const cleaned = filtered.map((p: any) => ({
      symbol: p.symbol,
      positionAmt: p.positionAmt ?? "0",
      entryPrice: p.entryPrice ?? "0",
      markPrice: undefined, // sẽ được cập nhật từ WS public
    }));

    setPositions(cleaned);
    localStorage.setItem("positions", JSON.stringify(cleaned));
  });

  // ✅ Lấy danh sách vị thế ngay khi mount
  binanceWS.send({ action: "getPositions" });

  return () => {
    binanceWS.setPositionUpdateHandler(() => {}); // cleanup
  };
}, []);
// 🔁 Lắng nghe WS để bắt ACCOUNT_UPDATE.a.P
useEffect(() => {
  const handler = (msg: any) => {
    // ✅ Nếu có vị thế trong update từ server
    if (msg?.a?.P && Array.isArray(msg.a.P)) {
      const rawPositions = msg.a.P;

      const filtered = rawPositions.filter((p: any) => parseFloat(p.pa) !== 0);

      if (filtered.length === 0) {
        setPositions([]);
        localStorage.removeItem("positions");
        return;
      }

      const cleaned = filtered.map((p: any) => ({
        symbol: p.s,
        positionAmt: p.pa ?? "0",
        entryPrice: p.ep ?? "0",
        markPrice: undefined,
      }));

      setPositions(cleaned);
      localStorage.setItem("positions", JSON.stringify(cleaned));
    }
  };

  binanceWS.onMessage(handler);
  return () => binanceWS.removeMessageHandler(handler);
}, []);


  // Subscribe markPrice theo từng symbol
  useEffect(() => {
  if (!positions || positions.length === 0) return;
  if (market !== "futures") return;

  const subscribed: string[] = [];

  positions.forEach((pos) => {
    const symbol = pos.symbol;
    if (!symbol || subscribed.includes(symbol)) return;
    subscribed.push(symbol);

    binancePublicWS.subscribeMarkPrice(symbol, (markPrice) => {
      setPositions((prev) =>
        prev.map((p) =>
          p.symbol === symbol ? { ...p, markPrice } : p
        )
      );
    });
  });

  return () => {
    subscribed.forEach((symbol) => {
      binancePublicWS.unsubscribeMarkPrice(symbol);
    });
  };
}, [positions, market]);


  const calculatePnl = (pos: PositionData) => {
    const entry = parseFloat(pos.entryPrice || "0");
    const size = parseFloat(pos.positionAmt || "0");
    const mark = parseFloat(pos.markPrice || "0");

    if (size === 0 || entry === 0 || mark === 0) return 0;

    return size > 0
      ? (mark - entry) * size
      : (entry - mark) * Math.abs(size);
  };

  return (
    <div className="card">
      <div className="card-header">Positions</div>
      <div className="card-body overflow-x-auto">
        <table className="min-w-full text-sm text-left">
          <thead>
            <tr className="text-dark-400 border-b border-dark-700">
              <th className="px-4 py-2">Symbol</th>
              <th className="px-4 py-2">Size</th>
              <th className="px-4 py-2">Entry</th>
              <th className="px-4 py-2">Mark Price</th>
              <th className="px-4 py-2">PNL</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => {
              const size = parseFloat(pos.positionAmt || "0");
              const pnl = calculatePnl(pos);

              const pnlClass =
                pnl > 0 ? "text-success-500" : pnl < 0 ? "text-danger-500" : "";
              const sizeClass =
                size > 0 ? "text-success-500" : size < 0 ? "text-danger-500" : "";

              return (
                <tr key={pos.symbol} className="border-b border-dark-700">
                  <td className="px-4 py-3 font-medium">{pos.symbol}</td>
                  <td className={`px-4 py-3 font-medium ${sizeClass}`}>
                    {size > 0 ? "" : "-"} {Math.abs(size)}
                  </td>
                  <td className="px-4 py-3">{pos.entryPrice}</td>
                  <td className="px-4 py-3">{pos.markPrice ?? "--"}</td>
                  <td className={`px-4 py-3 font-medium ${pnlClass}`}>
                    {pnl.toFixed(4)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Position;
