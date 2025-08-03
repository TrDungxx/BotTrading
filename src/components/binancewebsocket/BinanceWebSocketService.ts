class BinanceWebSocketService {
  private socket: WebSocket | null = null;
  private messageQueue: any[] = [];
  private messageHandlers: ((data: any) => void)[] = [];
  
 private orderUpdateHandler: ((orders: any[]) => void) | null = null;

setOrderUpdateHandler(handler: ((orders: any[]) => void) | null) {
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

      // ✅ Bắt buộc gán lại handler vì connect có thể gọi nhiều lần
      if (!this.messageHandlers.includes(onMessage)) {
        this.messageHandlers.push(onMessage);
      }
    };

    this.socket.onmessage = (event) => {
      console.log('📥 RAW WS MSG:', event.data);
      try {
        const data = JSON.parse(event.data);
        console.log('📥 WS Parsed:', data);

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

  // 🧠 Tự huỷ lệnh TP/SL đối ứng nếu một trong hai đã khớp
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

  // 🧹 Cập nhật local openOrders
  if (['FILLED', 'CANCELED', 'REJECTED', 'EXPIRED'].includes(order.status)) {
    currentOrders = currentOrders.filter((o) => o.orderId !== order.orderId);
  } else {
    const idx = currentOrders.findIndex((o) => o.orderId === order.orderId);
    if (idx !== -1) {
      currentOrders[idx] = order;
    } else {
      currentOrders.push(order);
    }
  }

  console.log('📦 Final openOrders:', currentOrders);
  localStorage.setItem('openOrders', JSON.stringify(currentOrders));
  this.orderUpdateHandler(currentOrders);
}
        

        if (data.type === 'update' && data.channel === 'account') {
          if (data.orders && this.orderUpdateHandler) {
            console.log('🟢 [WS] Gửi orders từ server về UI:', data.orders);
            localStorage.setItem('openOrders', JSON.stringify(data.orders));
            this.orderUpdateHandler(data.orders);
          }
        }

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

  // ✅ Gửi hoặc queue nếu chưa mở kết nối
  send(data: any) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log('📤 WS Sending:', data);
      this.socket.send(JSON.stringify(data));
    } else {
      console.warn('⛔ WS not ready (state = ' + this.socket?.readyState + '), queued message:', data);
      this.messageQueue.push(data);
    }
  }

  // ✅ Flush queue sau khi socket open
  private flushMessageQueue() {
    this.messageQueue.forEach((msg) => {
      console.log('📤 WS Sending from queue:', msg);
      this.socket?.send(JSON.stringify(msg));
    });
    this.messageQueue = [];
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
