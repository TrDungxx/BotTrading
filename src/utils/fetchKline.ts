// utils/fetchKline.ts
import { CandlestickData } from 'lightweight-charts';

export async function fetchHistoricalKlines(
  symbol: string,
  interval: string = '1m',
  limit: number = 500
): Promise<CandlestickData[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  const rawData = await res.json();

  return rawData.map((candle: any[]) => ({
    time: candle[0] / 1000,
    open: parseFloat(candle[1]),
    high: parseFloat(candle[2]),
    low: parseFloat(candle[3]),
    close: parseFloat(candle[4]),
    volume: parseFloat(candle[5]), // ✅ thêm dòng này
  }));
}
