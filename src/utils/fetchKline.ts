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
  limit: number = 500,
  market: 'spot' | 'futures' = 'spot'  // ✅ THÊM PARAM NÀY
): Promise<Kline[]> {
  // ✅ Chọn đúng endpoint theo market
  const baseUrl = market === 'futures'
    ? 'https://fapi.binance.com/fapi/v1/klines'   // Futures
    : 'https://api.binance.com/api/v3/klines';    // Spot
    
  const url = `${baseUrl}?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`;
  
  console.log('[fetchKlines]', market.toUpperCase(), symbol, interval);
  
  const res = await fetch(url);
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('[fetchKlines] ❌ Error:', res.status, errorText);
    throw new Error(`Failed to fetch klines: ${res.status}`);
  }
  
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