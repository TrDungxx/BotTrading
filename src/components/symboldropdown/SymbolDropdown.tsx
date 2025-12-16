import React, { useEffect, useMemo, useRef, useState } from "react";
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
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

const BASE = {
  spot: "https://api.binance.com",
  futures: "https://fapi.binance.com",
};

type ExchangeInfo = {
  symbols: Array<{
    symbol: string;
    status: string;
    baseAsset: string;
    quoteAsset: string;
  }>;
};

type Ticker24hr = {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
};

const EXCHANGE_INFO_CACHE_KEY = "tw_exchange_info_cache";
const EXCHANGE_INFO_TTL_MS = 60 * 60 * 1000;

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

// Format số compact (11.86B → 11.86B)
function compactNumber(n?: number) {
  if (!Number.isFinite(n || NaN)) return "--";
  const v = n as number;
  if (v >= 1e12) return (v / 1e12).toFixed(2) + "T";
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(2) + "K";
  return v.toFixed(0);
}

// Format giá với số thập phân phù hợp
function formatPrice(price: number): string {
  if (!Number.isFinite(price)) return "--";
  if (price >= 1000) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(3);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
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
  isOpen,
  onOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const favoriteKey = React.useMemo(
    () => `favoriteSymbols_${user?.id ?? "guest"}`,
    [user?.id]
  );

  const [favoriteSymbols, setFavoriteSymbols] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(favoriteKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');

  useEffect(() => {
    localStorage.setItem(favoriteKey, JSON.stringify(favoriteSymbols));
  }, [favoriteSymbols, favoriteKey]);

  const [fetchedSymbols, setFetchedSymbols] = useState<SymbolItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  // ✅ Detect dropdown position when opened
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        if (!dropdownRef.current) return;
        
        const rect = dropdownRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.top;
        const spaceAbove = rect.top;
        const dropdownHeight = 600; // approximate total height
        
        // If not enough space below and more space above, position upward
        if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
          setDropdownPosition('top');
        } else {
          setDropdownPosition('bottom');
        }
      }, 0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (symbols && symbols.length > 0) return;

    const ctrl = new AbortController();
    const run = async () => {
      setLoading(true);
      setErr(null);
      try {
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

        const valid = new Set(
          info.symbols
            .filter((s) => s.status === "TRADING" && s.quoteAsset === quote)
            .map((s) => s.symbol)
        );

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

  const sourceSymbols = useMemo<SymbolItem[]>(() => {
    if (symbols && symbols.length > 0) return symbols;
    return fetchedSymbols;
  }, [symbols, fetchedSymbols]);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };
  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      onClose();
    }, 200);
  };
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  if ((!symbols || symbols.length === 0) && loading) {
    return (
      <div className="symbol-dropdown w-[460px] bg-[#1e2329] border border-[#2b3139] rounded-lg shadow-2xl p-fluid-4">
        <div className="flex items-center justify-center py-8 text-[#848e9c] text-fluid-sm">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#fcd535] border-t-transparent mr-3"></div>
          Đang tải...
        </div>
      </div>
    );
  }
  
  if ((!symbols || symbols.length === 0) && err) {
    return (
      <div className="symbol-dropdown w-[460px] bg-[#1e2329] border border-[#cf304a] rounded-lg shadow-2xl p-fluid-4">
        <div className="text-[#f6465d] text-fluid-sm py-fluid-4 text-center">Lỗi: {err}</div>
      </div>
    );
  }

  const filtered = sourceSymbols.filter((s) =>
    s.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const favoriteList = filtered.filter((s) => favoriteSymbols.includes(s.symbol));
  const listToRender = activeTab === "favorites" ? favoriteList : filtered;

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className={`symbol-dropdown w-[460px] bg-[#1e2329] border border-[#2b3139] rounded-lg shadow-2xl overflow-hidden ${
        dropdownPosition === 'top' ? 'origin-bottom' : 'origin-top'
      }`}
      style={{ 
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header với search và tabs */}
      <div className="px-fluid-4 pt-4 pb-3 border-b border-[#2b3139]">
        {/* Search Bar */}
        <div className="relative mb-3">
          <input
            type="text"
            placeholder="Tìm kiếm"
            className="w-full h-9 pl-9 pr-3 text-fluid-sm bg-[#2b3139] text-[#eaecef] rounded border border-transparent 
                     hover:border-[#474d57] focus:outline-none focus:border-[#fcd535] transition-colors"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <svg className="absolute left-3 top-fluid-2.5 w-4 h-4 text-[#848e9c]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-fluid-4 text-fluid-sm">
          <button
            onClick={() => onTabChange("favorites")}
            className={`relative pb-2 transition-colors ${
              activeTab === "favorites"
                ? "text-[#eaecef] font-medium"
                : "text-[#848e9c] hover:text-[#eaecef]"
            }`}
          >
            <Star className={`inline w-3.5 h-3.5 mr-1 mb-0.5 ${activeTab === "favorites" ? "fill-[#fcd535] text-[#fcd535]" : ""}`} />
            Yêu thích
            {activeTab === "favorites" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#fcd535]"></div>
            )}
          </button>
          <button
            onClick={() => onTabChange("all")}
            className={`relative pb-2 transition-colors ${
              activeTab === "all"
                ? "text-[#eaecef] font-medium"
                : "text-[#848e9c] hover:text-[#eaecef]"
            }`}
          >
            Tất cả
            {activeTab === "all" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#fcd535]"></div>
            )}
          </button>
          <div className="ml-auto px-2 py-0.5 text-xs text-[#848e9c] bg-[#2b3139] rounded">
            {market === "futures" ? "USDⓈ-M" : "SPOT"}
          </div>
        </div>
      </div>

      {/* Column Headers */}
      <div className="sticky top-0 z-10 bg-[#1e2329] px-fluid-4 py-2 border-b border-[#2b3139]">
        <div className="grid grid-cols-[32px_minmax(140px,1fr)_100px_100px] gap-fluid-3 text-xs text-[#848e9c]">
          <div></div>
          <div>Hợp đồng</div>
          <div className="text-right">Giá gần nhất</div>
          <div className="text-right">Biến động 24h</div>
        </div>
      </div>

      {/* Symbol List */}
      <div className="max-h-[440px] overflow-y-auto">
        <style>{`
          .symbol-dropdown ::-webkit-scrollbar {
            width: 6px;
          }
          .symbol-dropdown ::-webkit-scrollbar-track {
            background: transparent;
          }
          .symbol-dropdown ::-webkit-scrollbar-thumb {
            background: #474d57;
            border-radius: 3px;
          }
          .symbol-dropdown ::-webkit-scrollbar-thumb:hover {
            background: #5e6673;
          }
        `}</style>

        {listToRender.length === 0 ? (
          <div className="py-fluid-12 text-center text-[#848e9c] text-fluid-sm">
            {activeTab === "favorites" ? "Chưa có mục yêu thích" : "Không tìm thấy kết quả"}
          </div>
        ) : (
          listToRender.map((item) => {
            const base = item.symbol.replace(/USDT$/, "");
            const isActive = item.symbol === selectedSymbol;
            const isFav = favoriteSymbols.includes(item.symbol);
            const pct = item.percentChange;
            const isPositive = pct >= 0;

            return (
              <div
                key={item.symbol}
                className={`grid grid-cols-[32px_minmax(140px,1fr)_100px_100px] gap-fluid-3 items-center px-fluid-4 py-2.5 cursor-pointer transition-colors
                  ${isActive ? "bg-[#2b3139]" : "hover:bg-[#2b3139]/60"}`}
                onClick={() => {
                  onSelect(item.symbol);
                  onClose();
                }}
              >
                {/* Star Icon */}
                <div 
                  className="flex items-center justify-center cursor-pointer group"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFavoriteSymbols((prev) =>
                      prev.includes(item.symbol)
                        ? prev.filter((s) => s !== item.symbol)
                        : [...prev, item.symbol]
                    );
                  }}
                >
                  <Star
                    className={`w-4 h-4 transition-all ${
                      isFav 
                        ? "text-[#fcd535] fill-[#fcd535]" 
                        : "text-[#474d57] group-hover:text-[#848e9c]"
                    }`}
                  />
                </div>

                {/* Symbol & Volume */}
                <div className="flex items-center gap-fluid-2.5 min-w-0">
                  {coinIcons[base] ? (
                    <img 
                      src={coinIcons[base]} 
                      alt={base} 
                      className="w-6 h-6 rounded-full flex-shrink-0" 
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#fcd535] text-[#1e2329] text-fluid-2xs font-bold 
                                  flex items-center justify-center flex-shrink-0">
                      {base[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-fluid-1.5">
                      <span className="text-[#eaecef] font-medium text-fluid-sm truncate">
                        {item.symbol}
                      </span>
                      {market === "futures" && (
                        <span className="px-1 py-0.5 text-[9px] leading-none bg-[#2b3139] text-[#848e9c] rounded flex-shrink-0">
                          Vĩnh cửu
                        </span>
                      )}
                    </div>
                    <div className="text-fluid-xs text-[#848e9c] mt-0.5">
                      KL {compactNumber(item.volume)}
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="text-right text-[#eaecef] text-fluid-sm font-medium tabular-nums">
                  {formatPrice(item.price)}
                </div>

                {/* Change Percent */}
                <div className="text-right">
                  <span
                    className={`inline-block text-fluid-sm font-medium tabular-nums ${
                      isPositive ? "text-[#0ecb81]" : "text-[#f6465d]"
                    }`}
                  >
                    {isPositive ? "+" : ""}{pct.toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SymbolDropdown;