import { Time } from 'lightweight-charts';

export type Candle = {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

let socket: WebSocket | null = null;

export const connectToBinanceKline = (
  symbol: string,
  interval: string,
  onCandle: (candle: Candle) => void
) => {
  const wsUrl = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`;
  socket = new WebSocket(wsUrl);

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const k = data.k;

    const candle: Candle = {
      time: (k.t / 1000) as Time, // Epoch seconds as Time
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c),
      volume: parseFloat(k.v),
    };

    onCandle(candle);
  };

  socket.onopen = () => console.log('[Binance WS] Connected');
  socket.onerror = (err) => console.error('[Binance WS] Error:', err);
  socket.onclose = () => console.log('[Binance WS] Disconnected');
};

export const disconnectBinanceWS = () => {
  if (socket) {
    socket.close();
    socket = null;
  }
};