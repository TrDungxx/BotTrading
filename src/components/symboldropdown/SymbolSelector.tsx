// Public Binance API helpers (spot & USDT-M futures)
export type Market = 'spot' | 'futures';

type ExchangeInfo = {
  symbols: Array<{
    symbol: string;
    status: 'TRADING' | string;
    baseAsset: string;
    quoteAsset: string;
    permissions?: string[];
  }>;
};

type Ticker24hr = {
  symbol: string;
  lastPrice: string;            // e.g. "67250.10"
  priceChangePercent: string;   // e.g. "2.45"
  quoteVolume: string;          // e.g. "123456789.01"
};

const BASE = {
  spot: 'https://api.binance.com',
  futures: 'https://fapi.binance.com', // USDT-M
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// Cache nhẹ cho exchangeInfo (1 giờ)
const EXCHANGE_INFO_CACHE_KEY = 'tw_exchange_info_cache';
const EXCHANGE_INFO_CACHE_TTL_MS = 60 * 60 * 1000;

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > EXCHANGE_INFO_CACHE_TTL_MS) return null;
    return data as T;
  } catch {
    return null;
  }
}
function writeCache<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
}

export async function getExchangeSymbols(
  market: Market,
  quote: string = 'USDT'
): Promise<string[]> {
  const cacheKey = `${EXCHANGE_INFO_CACHE_KEY}_${market}`;
  let info = readCache<ExchangeInfo>(cacheKey);

  if (!info) {
    const url =
      market === 'spot'
        ? `${BASE.spot}/api/v3/exchangeInfo`
        : `${BASE.futures}/fapi/v1/exchangeInfo`;
    info = await fetchJSON<ExchangeInfo>(url);
    writeCache(cacheKey, info);
  }

  // Lọc symbol đang TRADING + cặp có quote mong muốn (mặc định USDT)
  return info.symbols
    .filter(s => s.status === 'TRADING' && s.quoteAsset === quote)
    .map(s => s.symbol);
}

export async function getTickers24h(market: Market): Promise<Ticker24hr[]> {
  const url =
    market === 'spot'
      ? `${BASE.spot}/api/v3/ticker/24hr`
      : `${BASE.futures}/fapi/v1/ticker/24hr`;
  return fetchJSON<Ticker24hr[]>(url);
}

/**
 * Trả về mảng {symbol, price, percentChange, volume} đúng với SymbolItem bạn đang dùng.
 * Tự động giao cắt giữa exchangeInfo (để chắc chắn symbol hợp lệ) và 24h tickers (để lấy giá/biến động/khối lượng).
 */
export async function getSymbolItems(
  market: Market = 'futures',
  quote: string = 'USDT'
): Promise<
  Array<{ symbol: string; price: number; percentChange: number; volume: number }>
> {
  const [validSymbols, tickers] = await Promise.all([
    getExchangeSymbols(market, quote),
    getTickers24h(market),
  ]);

  const valid = new Set(validSymbols);
  return tickers
    .filter(t => valid.has(t.symbol))
    .map(t => ({
      symbol: t.symbol,
      price: Number(t.lastPrice),
      percentChange: Number(t.priceChangePercent),
      volume: Number(t.quoteVolume), // dùng quoteVolume để đồng nhất theo USDT
    }))
    // optional: sort theo volume giảm dần cho “Tất cả”
    .sort((a, b) => b.volume - a.volume);
}
