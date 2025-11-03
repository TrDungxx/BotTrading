import React, { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import coinIcons from "../../utils/coinIcons";
import { useAuth } from "../../context/AuthContext";

type Market = "spot" | "futures";

interface SymbolItem {
  symbol: string;
  price: number;
  percentChange: number;
  volume: number;
}

interface Props {
  symbols?: SymbolItem[];
  selectedSymbol: string;
  searchTerm: string;
  activeTab: "favorites" | "all";
  onSelect: (symbol: string) => void;
  onSearchChange: (term: string) => void;
  onTabChange: (tab: "favorites" | "all") => void;
  market?: Market;
  quote?: string;
}

const BASE = {
  spot: "https://api.binance.com",
  futures: "https://fapi.binance.com", // USDT-M futures
};

type ExchangeInfo = {
  symbols: Array<{
    symbol: string;
    status: string; // 'TRADING' | ...
    baseAsset: string;
    quoteAsset: string;
  }>;
};

type Ticker24hr = {
  symbol: string;
  lastPrice: string; // e.g. "67250.10"
  priceChangePercent: string; // e.g. "2.45"
  quoteVolume: string; // e.g. "123456789.01"
};

const EXCHANGE_INFO_CACHE_KEY = "tw_exchange_info_cache";
const EXCHANGE_INFO_TTL_MS = 60 * 60 * 1000; // 1h

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > EXCHANGE_INFO_TTL_MS) return null;
    return data as T;
  } catch {
    return null;
  }
}
function writeCache<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
}

async function fetchJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

const SymbolDropdown: React.FC<Props> = ({
  symbols,
  selectedSymbol,
  
  searchTerm,
  activeTab,
  onSelect,
  
  onSearchChange,
  onTabChange,
  market = "futures",
  quote = "USDT",
}) => {
  const { user } = useAuth();
  const favoriteKey = React.useMemo(
    () => `favoriteSymbols_${user?.id ?? "guest"}`,
    [user?.id]
  );

  // 2) State từ localStorage
  const [favoriteSymbols, setFavoriteSymbols] = useState<string[]>(() => {
  try {
    const raw = localStorage.getItem(favoriteKey);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
});
 

  useEffect(() => {
    localStorage.setItem(favoriteKey, JSON.stringify(favoriteSymbols));
  }, [favoriteSymbols, favoriteKey]);

  // Tự fetch từ public API nếu không nhận được symbols từ props
  const [fetchedSymbols, setFetchedSymbols] = useState<SymbolItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (symbols && symbols.length > 0) return; // đã có props.symbols thì bỏ qua fetch

    const ctrl = new AbortController();
    const run = async () => {
      setLoading(true);
      setErr(null);
      try {
        // 1) lấy exchangeInfo (dùng cache 1h)
        const cacheKey = `${EXCHANGE_INFO_CACHE_KEY}_${market}`;
        let info = readCache<ExchangeInfo>(cacheKey);
        if (!info) {
          const url =
            market === "spot"
              ? `${BASE.spot}/api/v3/exchangeInfo`
              : `${BASE.futures}/fapi/v1/exchangeInfo`;
          info = await fetchJSON<ExchangeInfo>(url, ctrl.signal);
          writeCache(cacheKey, info);
        }

        // Lọc symbol theo TRADING + quote (mặc định USDT)
        const valid = new Set(
          info.symbols
            .filter((s) => s.status === "TRADING" && s.quoteAsset === quote)
            .map((s) => s.symbol)
        );

        // 2) lấy 24h tickers và map về SymbolItem
        const tickersUrl =
          market === "spot"
            ? `${BASE.spot}/api/v3/ticker/24hr`
            : `${BASE.futures}/fapi/v1/ticker/24hr`;
        const tickers = await fetchJSON<Ticker24hr[]>(tickersUrl, ctrl.signal);

        const list = tickers
          .filter((t) => valid.has(t.symbol))
          .map<SymbolItem>((t) => ({
            symbol: t.symbol,
            price: Number(t.lastPrice),
            percentChange: Number(t.priceChangePercent),
            volume: Number(t.quoteVolume),
          }))
          .sort((a, b) => b.volume - a.volume);

        setFetchedSymbols(list);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setErr(e?.message || "Load symbols failed");
        }
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => ctrl.abort();
  }, [symbols, market, quote]);

  // Quyết định nguồn dữ liệu hiển thị
  const sourceSymbols = useMemo<SymbolItem[]>(() => {
    if (symbols && symbols.length > 0) return symbols;
    return fetchedSymbols;
  }, [symbols, fetchedSymbols]);

  // Loading / Error khi dùng dữ liệu fetch nội bộ
  if ((!symbols || symbols.length === 0) && loading) {
    return (
      <div className="symbol-dropdown w-[350px] max-h-[500px] overflow-y-scroll bg-dark-800 border border-dark-700 rounded shadow-lg text-sm p-4">
        Đang tải danh sách symbol {market.toUpperCase()}…
      </div>
    );
  }
  if ((!symbols || symbols.length === 0) && err) {
    return (
      <div className="symbol-dropdown w-[350px] max-h-[500px] overflow-y-scroll bg-dark-800 border border-danger-700 rounded shadow-lg text-sm p-4 text-danger-400">
        Lỗi: {err}
      </div>
    );
  }

  const filtered = sourceSymbols.filter((s) =>
    s.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const favoriteList = filtered.filter((s) =>
    favoriteSymbols.includes(s.symbol)
  );
  const allList = filtered;
  const listToRender = activeTab === "favorites" ? favoriteList : allList;

  return (
    <div className="symbol-dropdown w-[350px] bg-dark-800 border border-dark-700 rounded shadow-lg text-sm">
      {/* Search */}
      <div className="p-2">
        <input
          type="text"
          placeholder={`Search ${quote} symbols...`}
          className="w-full px-3 py-2 text-xs rounded bg-dark-700 text-white border border-dark-600 focus:outline-none focus:border-primary-500"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-700 text-xs text-dark-400">
        <button
          onClick={() => onTabChange("favorites")}
          className={`flex-1 py-2 text-center ${
            activeTab === "favorites"
              ? "border-b-2 border-warning-300 text-warning-300 font-semibold"
              : "hover:text-white"
          }`}
        >
          ⭐ Yêu thích
        </button>
        <button
          onClick={() => onTabChange("all")}
          className={`flex-1 py-2 text-center ${
            activeTab === "all"
              ? "border-b-2 border-primary-500 text-primary-500 font-semibold"
              : "hover:text-white"
          }`}
        >
          Tất cả
        </button>
      </div>

      {/* Symbol List: chỉ phần này cuộn */}
      <div
        className="max-h-[420px] overflow-y-scroll tw-scroll pr-2"
        style={{ scrollbarGutter: "stable both-edges" }}
      >
        {listToRender.map((item) => {
          const base = item.symbol.replace(/USDT$/, "");
          const isActive = item.symbol === selectedSymbol;
          const isFav = favoriteSymbols.includes(item.symbol);

          return (
            <div
              key={item.symbol}
              className={`flex items-center px-3 py-2 cursor-pointer hover:bg-dark-700 ${
                isActive ? "bg-dark-700" : ""
              }`}
              onClick={() => onSelect(item.symbol)}
            >
              {coinIcons[base] ? (
                <img
                  src={coinIcons[base]}
                  alt={base}
                  className="w-5 h-5 mr-2"
                />
              ) : (
                <div className="w-5 h-5 mr-2 bg-warning-300 text-dark-800 text-xs flex items-center justify-center rounded-full font-bold">
                  {base[0]}
                </div>
              )}

              <div className="flex-1">
                <div className="font-semibold">{item.symbol}</div>
                <div className="text-xs text-dark-400">
                  Vol:{" "}
                  {Number.isFinite(item.volume)
                    ? item.volume.toLocaleString()
                    : "--"}
                </div>
              </div>

              <div className="text-right pr-1">
                <div className="font-mono">
                  {Number.isFinite(item.price)
                    ? item.price.toLocaleString(undefined, {
                        maximumFractionDigits: 8,
                      })
                    : "--"}
                </div>
                <div
                  className={`text-xs ${
                    item.percentChange >= 0
                      ? "text-success-500"
                      : "text-danger-500"
                  }`}
                >
                  {Number.isFinite(item.percentChange)
                    ? `${
                        item.percentChange >= 0 ? "+" : ""
                      }${item.percentChange.toFixed(2)}%`
                    : "--"}
                </div>
              </div>

              <Star
                className={`h-4 w-4 ml-2 ${
                  isFav ? "text-warning-300" : "text-dark-400"
                }`}
                fill={isFav ? "currentColor" : "none"}
                onClick={(e) => {
                  e.stopPropagation();
                  setFavoriteSymbols((prev) =>
                    prev.includes(item.symbol)
                      ? prev.filter((s) => s !== item.symbol)
                      : [...prev, item.symbol]
                  );
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SymbolDropdown;
