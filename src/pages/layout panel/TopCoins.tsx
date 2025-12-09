import React, { useState, useEffect } from "react";
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

interface TopCoinsProps {
  onSymbolClick?: (symbol: string) => void;
  market?: "spot" | "futures";
}

type TabType = "gainers" | "losers" | "volume";

const TopCoins: React.FC<TopCoinsProps> = ({ onSymbolClick, market = "futures" }) => {
  const [activeTab, setActiveTab] = useState<TabType>("gainers");
  const [topGainers, setTopGainers] = useState<CoinData[]>([]);
  const [topLosers, setTopLosers] = useState<CoinData[]>([]);
  const [topVolume, setTopVolume] = useState<CoinData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const fetchTopCoins = async () => {
      try {
        setLoading(true);
        setError("");

        if (market === "futures") {
          // Step 1: Lấy danh sách symbols THỰC SỰ có futures contract
          const exchangeInfoRes = await fetch("https://fapi.binance.com/fapi/v1/exchangeInfo");
          const exchangeInfo = await exchangeInfoRes.json();

          const validFuturesSymbols = new Set(
            exchangeInfo.symbols
              .filter((s: any) =>
                s.contractType === "PERPETUAL" &&
                s.status === "TRADING" &&
                s.quoteAsset === "USDT"
              )
              .map((s: any) => s.symbol)
          );

          // Step 2: Lấy ticker data
          const tickerRes = await fetch("https://fapi.binance.com/fapi/v1/ticker/24hr");
          const tickerData: CoinData[] = await tickerRes.json();

          // Step 3: Filter chỉ lấy symbols có trong validFuturesSymbols
          const validCoins = tickerData.filter(coin =>
            validFuturesSymbols.has(coin.symbol) &&
            parseFloat(coin.quoteVolume) > 1000000
          );

          const normalizedData = validCoins.map(coin => ({
            ...coin,
            price: coin.lastPrice || coin.price
          }));

          // Sort by gain
          const sortedByGain = [...normalizedData].sort(
            (a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent)
          );
          
          // Sort by loss
          const sortedByLoss = [...normalizedData].sort(
            (a, b) => parseFloat(a.priceChangePercent) - parseFloat(b.priceChangePercent)
          );

          // Sort by volume
          const sortedByVolume = [...normalizedData].sort(
            (a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume)
          );

          setTopGainers(sortedByGain.slice(0, 12));
          setTopLosers(sortedByLoss.slice(0, 12));
          setTopVolume(sortedByVolume.slice(0, 12));

        } else {
          // Spot market
          const response = await fetch("https://api.binance.com/api/v3/ticker/24hr");
          const data: CoinData[] = await response.json();

          const usdtPairs = data.filter(coin =>
            coin.symbol.endsWith("USDT") &&
            parseFloat(coin.quoteVolume) > 1000000
          );

          const sortedByGain = [...usdtPairs].sort(
            (a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent)
          );
          const sortedByLoss = [...usdtPairs].sort(
            (a, b) => parseFloat(a.priceChangePercent) - parseFloat(b.priceChangePercent)
          );
          const sortedByVolume = [...usdtPairs].sort(
            (a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume)
          );

          setTopGainers(sortedByGain.slice(0, 12));
          setTopLosers(sortedByLoss.slice(0, 12));
          setTopVolume(sortedByVolume.slice(0, 12));
        }

        setLoading(false);
      } catch (error) {
        console.error("❌ Error fetching top coins:", error);
        setError(error instanceof Error ? error.message : "Failed to fetch data");
        setLoading(false);
      }
    };

    fetchTopCoins();
    const interval = setInterval(fetchTopCoins, 30000);
    return () => clearInterval(interval);
  }, [market]);

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

      {/* Content */}
      {renderCoinList(getActiveCoins(), activeTab)}
    </div>
  );
};

export default TopCoins;