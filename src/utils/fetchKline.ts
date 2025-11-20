// ✅ fetchKlines chuẩn trả ra candles có volume
import { CandlestickData } from 'lightweight-charts';

export interface Kline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchHistoricalKlines(
  symbol: string,
  interval: string = '1m',
  limit: number = 500
): Promise<Kline[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  const rawData = await res.json();

  return rawData.map((candle: any[]) => ({
    time: candle[0] / 1000,               // Unix timestamp in seconds
    open: parseFloat(candle[1]),
    high: parseFloat(candle[2]),
    low: parseFloat(candle[3]),
    close: parseFloat(candle[4]),
    volume: parseFloat(candle[5]),       // ✅ Volume đúng định dạng
  }));
}
