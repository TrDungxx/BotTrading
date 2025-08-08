// binancePublicWS.ts
class BinancePublicWebSocketService {
  private socket: WebSocket | null = null;
  private callbacks: Map<string, (price: string) => void> = new Map();
  private isConnected = false;

  connect() {
    if (this.isConnected) return;

    this.socket = new WebSocket("wss://fstream.binance.com/ws/!markPrice@arr");

    this.socket.onopen = () => {
      this.isConnected = true;
      console.log("✅ Connected to Binance !markPrice@arr stream");

      // Gửi lại callback sau reconnect
      this.callbacks.forEach((cb, symbol) => {
        console.log(`📡 Resubscribed to ${symbol}`);
        // cb("0"); // tuỳ bạn
      });
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (Array.isArray(data)) {
          data.forEach((item) => {
            const symbol = item.s;
            const markPrice = item.p;
            const cb = this.callbacks.get(symbol);
            if (cb && markPrice) {
              cb(markPrice);
            }
          });
        } else if (data.e === "markPriceUpdate") {
          const symbol = data.s;
          const markPrice = data.p;
          const cb = this.callbacks.get(symbol);
          if (cb && markPrice) {
            cb(markPrice);
          }
        }
      } catch (err) {
        console.error("❌ Failed to parse markPrice data:", err);
      }
    };

    this.socket.onclose = () => {
      console.warn("🔌 Public WebSocket closed");
      this.isConnected = false;
      setTimeout(() => this.connect(), 2000);
    };

    this.socket.onerror = (err) => {
      console.error("❌ WebSocket error:", err);
    };
  }

  subscribeMarkPrice(symbol: string, callback: (price: string) => void): string {
    this.connect(); // ✅ Fix quan trọng nhất
    this.callbacks.set(symbol, callback);
    return `markPrice_${symbol}`;
  }

  unsubscribeMarkPrice(symbol: string) {
    this.callbacks.delete(symbol);
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.callbacks.clear();
    this.isConnected = false;
  }
}

export const binancePublicWS = new BinancePublicWebSocketService();
