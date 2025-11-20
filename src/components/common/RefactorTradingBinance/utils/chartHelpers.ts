import { UTCTimestamp } from 'lightweight-charts';

export type SymbolMeta = {
  tickSize: number;
  stepSize?: number;
  precision: number;
};

export const symbolMetaCache = new Map<string, SymbolMeta>();

export const countDecimals = (n: number): number => {
  const s = n.toString();
  if (s.includes('e-')) return parseInt(s.split('e-')[1], 10);
  return s.split('.')[1]?.length ?? 0;
};

export async function getSymbolMeta(
  symbol: string, 
  market: 'spot' | 'futures'
): Promise<SymbolMeta> {
  const key = `${market}:${symbol.toUpperCase()}`;
  const cached = symbolMetaCache.get(key);
  if (cached) return cached;

  const base =
    market === 'futures'
      ? 'https://fapi.binance.com/fapi/v1/exchangeInfo'
      : 'https://api.binance.com/api/v3/exchangeInfo';

  const res = await fetch(`${base}?symbol=${symbol.toUpperCase()}`);
  const json = await res.json();
  const info = json?.symbols?.[0];
  if (!info) throw new Error('exchangeInfo not found');

  const PRICE_FILTER = (info.filters || []).find((f: any) => f.filterType === 'PRICE_FILTER');
  const LOT_FILTER = (info.filters || []).find((f: any) =>
    ['MARKET_LOT_SIZE', 'LOT_SIZE'].includes(f.filterType),
  );

  const tickSize = PRICE_FILTER?.tickSize ? parseFloat(PRICE_FILTER.tickSize) : 0.01;
  const stepSize = LOT_FILTER?.stepSize ? parseFloat(LOT_FILTER.stepSize) : undefined;
  const precision = countDecimals(tickSize);

  const meta: SymbolMeta = { tickSize, stepSize, precision };
  symbolMetaCache.set(key, meta);
  return meta;
}

export const toTs = (ms: number): UTCTimestamp => 
  Math.floor(ms / 1000) as UTCTimestamp;

export function formatPrice(price: number, precision: number = 2): string {
  return price.toFixed(precision);
}

export function roundQuantity(quantity: number, stepSize: number): number {
  const stepDec = String(stepSize).includes('.') 
    ? String(stepSize).split('.')[1]!.length 
    : 0;
  return Number((Math.floor(quantity / stepSize) * stepSize).toFixed(stepDec));
}

export function hlineKey(symbol: string, market: string): string {
  return `hlines:${market}:${symbol.toUpperCase()}`;
}

export function parseStoredHLines(key: string): number[] {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHLinesToStorage(key: string, prices: number[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(prices));
  } catch (error) {
    console.error('Failed to save H-lines:', error);
  }
}