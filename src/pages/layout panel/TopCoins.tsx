import React, { useState, useEffect, useRef, useCallback } from "react";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import "../../style/trading/top-coins.css";

interface CoinData {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
  lastPrice?: string;
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

interface TopCoinsProps {
  onSymbolClick?: (symbol: string) => void;
  market?: "spot" | "futures";
}

type TabType = "gainers" | "losers" | "volume";

const TopCoins: React.FC<TopCoinsProps> = ({ onSymbolClick, market = "futures" }) => {
  const [activeTab, setActiveTab] = useState<TabType>("gainers");
  const [coinsData, setCoinsData] = useState<Map<string, CoinData>>(new Map());
  const [validSymbols, setValidSymbols] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [wsConnected, setWsConnected] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Fetch initial data
  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      if (market === "futures") {
        // Step 1: Get valid futures symbols
        const exchangeInfoRes = await fetch("https://fapi.binance.com/fapi/v1/exchangeInfo");
        const exchangeInfo = await exchangeInfoRes.json();

        const validFuturesSymbols = new Set<string>(
          exchangeInfo.symbols
            .filter((s: any) =>
              s.contractType === "PERPETUAL" &&
              s.status === "TRADING" &&
              s.quoteAsset === "USDT"
            )
            .map((s: any) => s.symbol)
        );
        setValidSymbols(validFuturesSymbols);

        // Step 2: Fetch ticker data
        const tickerRes = await fetch("https://fapi.binance.com/fapi/v1/ticker/24hr");
        const tickerData: CoinData[] = await tickerRes.json();

        // Step 3: Filter and create map
        const coinsMap = new Map<string, CoinData>();
        tickerData.forEach(coin => {
          if (validFuturesSymbols.has(coin.symbol) && parseFloat(coin.quoteVolume) > 1000000) {
            coinsMap.set(coin.symbol, {
              ...coin,
              price: coin.lastPrice || coin.price
            });
          }
        });
        setCoinsData(coinsMap);

      } else {
        // Spot market
        const response = await fetch("https://api.binance.com/api/v3/ticker/24hr");
        const data: CoinData[] = await response.json();

        const coinsMap = new Map<string, CoinData>();
        const symbols = new Set<string>();
        
        data.forEach(coin => {
          if (coin.symbol.endsWith("USDT") && parseFloat(coin.quoteVolume) > 1000000) {
            coinsMap.set(coin.symbol, coin);
            symbols.add(coin.symbol);
          }
        });
        
        setCoinsData(coinsMap);
        setValidSymbols(symbols);
      }

      setLoading(false);
    } catch (error) {
      console.error("❌ Error fetching initial data:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch data");
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

    console.log("🔌 Connecting TopCoins WebSocket:", wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✅ TopCoins WebSocket connected");
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
            // Only update coins we're tracking
            if (newData.has(ticker.s)) {
              hasUpdates = true;
              const existing = newData.get(ticker.s)!;
              newData.set(ticker.s, {
                ...existing,
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
      console.error("❌ TopCoins WebSocket error:", error);
      setWsConnected(false);
    };

    ws.onclose = (event) => {
      console.log("🔌 TopCoins WebSocket closed:", event.code, event.reason);
      setWsConnected(false);
      wsRef.current = null;

      // Reconnect logic
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

  // Compute sorted lists from coinsData
  const { topGainers, topLosers, topVolume } = React.useMemo(() => {
    const coins = Array.from(coinsData.values());

    const sortedByGain = [...coins].sort(
      (a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent)
    );

    const sortedByLoss = [...coins].sort(
      (a, b) => parseFloat(a.priceChangePercent) - parseFloat(b.priceChangePercent)
    );

    const sortedByVolume = [...coins].sort(
      (a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume)
    );

    return {
      topGainers: sortedByGain.slice(0, 12),
      topLosers: sortedByLoss.slice(0, 12),
      topVolume: sortedByVolume.slice(0, 12)
    };
  }, [coinsData]);

  const handleCoinClick = (symbol: string) => {
    if (onSymbolClick) {
      onSymbolClick(symbol);
    }
  };

  const formatVolume = (vol: string) => {
    const v = parseFloat(vol);
    if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
    if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
    if (v >= 1e3) return (v / 1e3).toFixed(2) + "K";
    return v.toFixed(2);
  };

  const renderCoinList = (coins: CoinData[], type: TabType) => {
    if (loading) {
      return (
        <div className="top-coins-loading">
          <div className="loading-text">Đang tải...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="top-coins-empty">
          <div className="empty-text" style={{ color: '#f6465d' }}>Lỗi: {error}</div>
        </div>
      );
    }

    if (coins.length === 0) {
      return (
        <div className="top-coins-empty">
          <div className="empty-text">Không có dữ liệu</div>
        </div>
      );
    }

    return (
      <div className="top-coins-list">
        {coins.map((coin, index) => {
          const changePercent = parseFloat(coin.priceChangePercent);
          const isPositive = changePercent >= 0;
          const displaySymbol = coin.symbol.replace("USDT", "");
          const price = parseFloat(coin.price);

          // Determine icon color based on tab type
          const iconClass = type === "losers" ? "loser" : "gainer";

          return (
            <div
              key={coin.symbol}
              className="top-coin-item"
              onClick={() => handleCoinClick(coin.symbol)}
            >
              {/* 1. Rank */}
              <span className="coin-rank">{index + 1}</span>

              {/* 2. Icon */}
              <div className={`coin-icon ${iconClass}`}>
                {displaySymbol.substring(0, 2)}
              </div>

              {/* 3. Symbol + Type */}
              <div className="coin-info">
                <span className="coin-symbol">{displaySymbol}</span>
                <span className="coin-type">
                  {type === "volume" ? formatVolume(coin.quoteVolume) : "Vĩnh cửu"}
                </span>
              </div>

              {/* 4. Price */}
              <div className="coin-price-section">
                <span className="coin-price">
                  {price >= 1 ? price.toFixed(2) : price.toFixed(6)}
                </span>
                <span className="coin-price-usd">
                  ${price >= 1 ? price.toFixed(2) : price.toFixed(4)}
                </span>
              </div>

              {/* 5. Change % */}
              <div className="coin-change-section">
                <span className={`coin-change ${isPositive ? 'positive' : 'negative'}`}>
                  {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const getActiveCoins = () => {
    switch (activeTab) {
      case "gainers": return topGainers;
      case "losers": return topLosers;
      case "volume": return topVolume;
      default: return topGainers;
    }
  };

  return (
    <div className="top-coins-container">
      {/* Tabs - 3 tabs */}
      <div className="top-coins-tabs">
        <button
          className={`top-coins-tab ${activeTab === "gainers" ? "active" : ""}`}
          onClick={() => setActiveTab("gainers")}
        >
          <TrendingUp size={14} />
          <span>Tăng</span>
          {activeTab === "gainers" && <div className="top-coins-tab-indicator" />}
        </button>

        <button
          className={`top-coins-tab ${activeTab === "losers" ? "active losers" : "losers"}`}
          onClick={() => setActiveTab("losers")}
        >
          <TrendingDown size={14} />
          <span>Giảm</span>
          {activeTab === "losers" && <div className="top-coins-tab-indicator" />}
        </button>

        <button
          className={`top-coins-tab ${activeTab === "volume" ? "active volume" : "volume"}`}
          onClick={() => setActiveTab("volume")}
        >
          <BarChart3 size={14} />
          <span>Vol</span>
          {activeTab === "volume" && <div className="top-coins-tab-indicator" />}
        </button>
      </div>

      {/* WebSocket Status Indicator (optional - có thể bỏ nếu không cần) */}
      {/* <div className={`ws-status ${wsConnected ? 'connected' : 'disconnected'}`}>
        {wsConnected ? '🟢' : '🔴'}
      </div> */}

      {/* Content */}
      {renderCoinList(getActiveCoins(), activeTab)}
    </div>
  );
};

export default TopCoins;