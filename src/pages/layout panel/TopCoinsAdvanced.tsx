import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { TrendingUp, TrendingDown, Search, X, Filter } from "lucide-react";

interface CoinData {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
}

// WebSocket ticker data format
interface WsTicker {
  s: string;   // symbol
  c: string;   // close price (current price)
  p: string;   // price change
  P: string;   // price change percent
  v: string;   // volume
  q: string;   // quote volume
  h: string;   // high price
  l: string;   // low price
}

interface TopCoinsAdvancedProps {
  onSymbolClick?: (symbol: string) => void;
  market?: "spot" | "futures";
}

type FilterType = "all" | "high-volume" | "mid-volume";
type SortType = "change" | "volume" | "price";

const TopCoinsAdvanced: React.FC<TopCoinsAdvancedProps> = ({ 
  onSymbolClick, 
  market = "futures" 
}) => {
  const [activeTab, setActiveTab] = useState<"gainers" | "losers">("gainers");
  const [coinsData, setCoinsData] = useState<Map<string, CoinData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortType, setSortType] = useState<SortType>("change");
  const [showFilters, setShowFilters] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Fetch initial data
  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      
      const endpoint = market === "futures" 
        ? "https://fapi.binance.com/fapi/v1/ticker/24hr"
        : "https://api.binance.com/api/v3/ticker/24hr";

      const response = await fetch(endpoint);
      const data: CoinData[] = await response.json();

      // Filter USDT pairs with minimum volume and create Map
      const coinsMap = new Map<string, CoinData>();
      data.forEach(coin => {
        if (coin.symbol.endsWith("USDT") && parseFloat(coin.quoteVolume) > 500000) {
          coinsMap.set(coin.symbol, coin);
        }
      });

      setCoinsData(coinsMap);
      setLoading(false);
    } catch (error) {
      console.error("❌ Error fetching initial data:", error);
      setLoading(false);
    }
  }, [market]);

  // Connect WebSocket for real-time updates
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = market === "futures"
      ? "wss://fstream.binance.com/ws/!ticker@arr"
      : "wss://stream.binance.com:9443/ws/!ticker@arr";

    console.log("🔌 Connecting TopCoinsAdvanced WebSocket:", wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✅ TopCoinsAdvanced WebSocket connected");
      setWsConnected(true);
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const tickers: WsTicker[] = JSON.parse(event.data);
        
        setCoinsData(prevData => {
          const newData = new Map(prevData);
          let hasUpdates = false;

          tickers.forEach(ticker => {
            // Only update USDT pairs with sufficient volume
            if (ticker.s.endsWith("USDT") && parseFloat(ticker.q) > 500000) {
              hasUpdates = true;
              const existing = newData.get(ticker.s);
              newData.set(ticker.s, {
                symbol: ticker.s,
                price: ticker.c,
                priceChange: ticker.p,
                priceChangePercent: ticker.P,
                volume: ticker.v,
                quoteVolume: ticker.q,
                highPrice: ticker.h,
                lowPrice: ticker.l
              });
            }
          });

          return hasUpdates ? newData : prevData;
        });
      } catch (err) {
        console.error("❌ Error parsing WebSocket data:", err);
      }
    };

    ws.onerror = (error) => {
      console.error("❌ TopCoinsAdvanced WebSocket error:", error);
      setWsConnected(false);
    };

    ws.onclose = (event) => {
      console.log("🔌 TopCoinsAdvanced WebSocket closed:", event.code, event.reason);
      setWsConnected(false);
      wsRef.current = null;

      // Reconnect logic with exponential backoff
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connectWebSocket();
        }, delay);
      }
    };
  }, [market]);

  // Initial fetch and WebSocket connection
  useEffect(() => {
    fetchInitialData().then(() => {
      connectWebSocket();
    });

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [fetchInitialData, connectWebSocket]);

  // Compute sorted gainers and losers from coinsData
  const { topGainers, topLosers } = useMemo(() => {
    const coins = Array.from(coinsData.values());

    const sortedByGain = [...coins].sort(
      (a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent)
    );
    
    const sortedByLoss = [...coins].sort(
      (a, b) => parseFloat(a.priceChangePercent) - parseFloat(b.priceChangePercent)
    );

    return {
      topGainers: sortedByGain.slice(0, 50),
      topLosers: sortedByLoss.slice(0, 50)
    };
  }, [coinsData]);

  // Apply filters and sorting
  const filteredCoins = useMemo(() => {
    let coins = activeTab === "gainers" ? topGainers : topLosers;

    // Apply search filter
    if (searchQuery) {
      coins = coins.filter(coin =>
        coin.symbol.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply volume filter
    if (filterType === "high-volume") {
      coins = coins.filter(coin => parseFloat(coin.quoteVolume) > 10000000); // > 10M
    } else if (filterType === "mid-volume") {
      coins = coins.filter(coin => {
        const vol = parseFloat(coin.quoteVolume);
        return vol >= 1000000 && vol <= 10000000; // 1M - 10M
      });
    }

    // Apply sorting
    if (sortType === "volume") {
      coins = [...coins].sort((a, b) => 
        parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume)
      );
    } else if (sortType === "price") {
      coins = [...coins].sort((a, b) => 
        parseFloat(b.price) - parseFloat(a.price)
      );
    }

    return coins.slice(0, 20); // Show top 20
  }, [activeTab, topGainers, topLosers, searchQuery, filterType, sortType]);

  const handleCoinClick = (symbol: string) => {
    if (onSymbolClick) {
      onSymbolClick(symbol);
    }
  };

  const formatVolume = (volume: string) => {
    const vol = parseFloat(volume);
    if (vol >= 1000000000) return `${(vol / 1000000000).toFixed(2)}B`;
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(2)}M`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(2)}K`;
    return vol.toFixed(2);
  };

  const renderCoinList = (coins: CoinData[], isGainers: boolean) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full py-8">
          <div className="text-center">
            <div className="text-fluid-sm text-dark-400">Đang tải dữ liệu...</div>
            <div className="text-fluid-sm text-dark-500 mt-1">Fetching from Binance</div>
          </div>
        </div>
      );
    }

    if (coins.length === 0) {
      return (
        <div className="flex items-center justify-center h-full py-8">
          <div className="text-center">
            <div className="text-fluid-sm text-dark-400">Không tìm thấy kết quả</div>
            <div className="text-fluid-sm text-dark-500 mt-1">
              Thử thay đổi bộ lọc hoặc tìm kiếm
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-0">
        {coins.map((coin, index) => {
          const changePercent = parseFloat(coin.priceChangePercent);
          const isPositive = changePercent >= 0;
          
          return (
            <div
              key={coin.symbol}
              className="flex items-center justify-between p-fluid-3 hover:bg-dark-700 cursor-pointer transition-colors border-b border-dark-700/50 group"
              onClick={() => handleCoinClick(coin.symbol)}
            >
              {/* Rank & Symbol */}
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <span className="text-fluid-sm text-dark-400 font-mono w-5 flex-shrink-0">
                  {index + 1}
                </span>
                
                <div className="flex items-center gap-fluid-2 min-w-0">
                  {/* Coin Icon */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-fluid-sm font-bold flex-shrink-0 ${
                    isGainers ? 'bg-success-500/20 text-success-400' : 'bg-danger-500/20 text-danger-400'
                  }`}>
                    {coin.symbol.substring(0, 2)}
                  </div>
                  
                  <div className="min-w-0">
                    <div className="text-fluid-sm font-medium truncate">
                      {coin.symbol.replace("USDT", "")}
                    </div>
                    <div className="text-fluid-sm text-dark-400">
                      Vol: {formatVolume(coin.quoteVolume)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Price */}
              <div className="text-right mr-4 flex-shrink-0">
                <div className="text-fluid-sm font-medium">
                  {parseFloat(coin.price) > 1 
                    ? parseFloat(coin.price).toFixed(2)
                    : parseFloat(coin.price).toFixed(6)}
                </div>
                <div className="text-fluid-sm text-dark-400">
                  ${parseFloat(coin.price) > 1 
                    ? parseFloat(coin.price).toFixed(2)
                    : parseFloat(coin.price).toFixed(4)}
                </div>
              </div>

              {/* 24h Change */}
              <div className="text-right min-w-[80px] flex-shrink-0">
                <div
                  className={`text-fluid-sm font-bold transition-colors ${
                    isPositive ? "text-success-500" : "text-danger-500"
                  } group-hover:text-white`}
                >
                  {isPositive ? "+" : ""}
                  {changePercent.toFixed(2)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search Bar */}
      <div className="p-fluid-3 border-b border-dark-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-dark-400" />
          <input
            type="text"
            placeholder="Tìm kiếm coin..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 bg-dark-700 text-fluid-sm text-dark-100 rounded-lg border border-dark-600 focus:border-primary-500 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-dark-400 hover:text-dark-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs with Filter Button */}
      <div className="flex items-center border-b border-dark-700">
        <div className="flex flex-1">
          <button
            className={`flex-1 px-fluid-4 py-fluid-3 text-fluid-sm font-medium transition-colors relative ${
              activeTab === "gainers"
                ? "text-success-500"
                : "text-dark-400 hover:text-dark-200"
            }`}
            onClick={() => setActiveTab("gainers")}
          >
            <div className="flex items-center justify-center gap-fluid-1.5">
              <TrendingUp className="h-4 w-4" />
              <span>Tăng giá</span>
            </div>
            {activeTab === "gainers" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-success-500" />
            )}
          </button>
          
          <button
            className={`flex-1 px-fluid-4 py-fluid-3 text-fluid-sm font-medium transition-colors relative ${
              activeTab === "losers"
                ? "text-danger-500"
                : "text-dark-400 hover:text-dark-200"
            }`}
            onClick={() => setActiveTab("losers")}
          >
            <div className="flex items-center justify-center gap-fluid-1.5">
              <TrendingDown className="h-4 w-4" />
              <span>Giảm giá</span>
            </div>
            {activeTab === "losers" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-danger-500" />
            )}
          </button>
        </div>

        {/* WebSocket Status + Filter Button */}
        <div className="flex items-center">
          <span className={`w-2 h-2 rounded-full mr-2 ${wsConnected ? 'bg-success-500' : 'bg-danger-500'}`} 
                title={wsConnected ? 'Real-time connected' : 'Disconnected'} />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-fluid-3 py-fluid-3 text-dark-400 hover:text-dark-200 transition-colors ${
              showFilters ? 'text-primary-400' : ''
            }`}
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-fluid-3 bg-dark-700/50 border-b border-dark-700 space-y-3">
          {/* Volume Filter */}
          <div>
            <div className="text-fluid-sm text-dark-400 mb-1.5">Volume Filter</div>
            <div className="flex gap-fluid-2">
              <button
                onClick={() => setFilterType("all")}
                className={`px-fluid-3 py-fluid-1.5 text-fluid-sm rounded transition-colors ${
                  filterType === "all"
                    ? "bg-primary-500 text-white"
                    : "bg-dark-700 text-dark-300 hover:bg-dark-600"
                }`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setFilterType("high-volume")}
                className={`px-fluid-3 py-fluid-1.5 text-fluid-sm rounded transition-colors ${
                  filterType === "high-volume"
                    ? "bg-primary-500 text-white"
                    : "bg-dark-700 text-dark-300 hover:bg-dark-600"
                }`}
              >
                &gt; 10M
              </button>
              <button
                onClick={() => setFilterType("mid-volume")}
                className={`px-fluid-3 py-fluid-1.5 text-fluid-sm rounded transition-colors ${
                  filterType === "mid-volume"
                    ? "bg-primary-500 text-white"
                    : "bg-dark-700 text-dark-300 hover:bg-dark-600"
                }`}
              >
                1M - 10M
              </button>
            </div>
          </div>

          {/* Sort By */}
          <div>
            <div className="text-fluid-sm text-dark-400 mb-1.5">Sắp xếp theo</div>
            <div className="flex gap-fluid-2">
              <button
                onClick={() => setSortType("change")}
                className={`px-fluid-3 py-fluid-1.5 text-fluid-sm rounded transition-colors ${
                  sortType === "change"
                    ? "bg-primary-500 text-white"
                    : "bg-dark-700 text-dark-300 hover:bg-dark-600"
                }`}
              >
                % Thay đổi
              </button>
              <button
                onClick={() => setSortType("volume")}
                className={`px-fluid-3 py-fluid-1.5 text-fluid-sm rounded transition-colors ${
                  sortType === "volume"
                    ? "bg-primary-500 text-white"
                    : "bg-dark-700 text-dark-300 hover:bg-dark-600"
                }`}
              >
                Volume
              </button>
              <button
                onClick={() => setSortType("price")}
                className={`px-fluid-3 py-fluid-1.5 text-fluid-sm rounded transition-colors ${
                  sortType === "price"
                    ? "bg-primary-500 text-white"
                    : "bg-dark-700 text-dark-300 hover:bg-dark-600"
                }`}
              >
                Giá
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {renderCoinList(filteredCoins, activeTab === "gainers")}
      </div>

      {/* Stats Footer */}
      <div className="p-fluid-2 border-t border-dark-700 bg-dark-700/30">
        <div className="flex justify-between text-fluid-sm text-dark-400">
          <span>Hiển thị: {filteredCoins.length} coins</span>
          <span className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-success-500' : 'bg-danger-500'}`} />
            <span>{wsConnected ? 'Real-time' : 'Offline'}</span>
            <span>• {market.toUpperCase()}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default TopCoinsAdvanced;