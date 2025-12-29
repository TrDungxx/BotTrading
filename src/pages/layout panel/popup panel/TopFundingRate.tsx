import React, { useState, useEffect, useRef, useCallback } from "react";
import "../../../style/trading/top-funding-rate.css";

interface FundingRateData {
  symbol: string;
  fundingRate: string;
  markPrice: string;
  nextFundingTime: number;
  indexPrice?: string;
  intervalHours?: number;
  countdown?: string;
}

interface TopFundingRateProps {
  onSymbolClick?: (symbol: string) => void;
}

// Cache fundingInfo toàn cục
let fundingInfoCache: Record<string, number> = {};
let fundingInfoLastFetch = 0;
const FUNDING_INFO_CACHE_TTL = 5 * 60 * 1000; // 5 phút

const TopFundingRate: React.FC<TopFundingRateProps> = ({ onSymbolClick }) => {
  const [fundingData, setFundingData] = useState<FundingRateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Format countdown HH:MM:SS
  const formatCountdown = (ms: number): string => {
    if (ms <= 0) return "00:00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Fetch fundingInfo để lấy interval của từng symbol
  const fetchFundingInfo = async (): Promise<Record<string, number>> => {
    const now = Date.now();
    
    if (Object.keys(fundingInfoCache).length > 0 && now - fundingInfoLastFetch < FUNDING_INFO_CACHE_TTL) {
      return fundingInfoCache;
    }

    try {
      const res = await fetch('https://fapi.binance.com/fapi/v1/fundingInfo');
      if (res.ok) {
        const list = await res.json();
        fundingInfoCache = {};
        list.forEach((item: any) => {
          fundingInfoCache[item.symbol] = item.fundingIntervalHours || 8;
        });
        fundingInfoLastFetch = now;
      }
    } catch (e) {
      console.error('Failed to fetch funding info:', e);
    }

    return fundingInfoCache;
  };

  // Fetch funding rate data from API
  const fetchFundingData = useCallback(async () => {
    try {
      // Fetch cả 2 API song song
      const [premiumRes, intervalMap] = await Promise.all([
        fetch("https://fapi.binance.com/fapi/v1/premiumIndex"),
        fetchFundingInfo()
      ]);
      
      const data = await premiumRes.json();
      
      // Filter USDT perpetual contracts only
      const filtered: FundingRateData[] = data
        .filter((item: any) => 
          item.symbol.endsWith("USDT") && 
          item.lastFundingRate !== undefined
        )
        .map((item: any) => ({
          symbol: item.symbol,
          fundingRate: item.lastFundingRate || "0",
          markPrice: item.markPrice || "0",
          nextFundingTime: item.nextFundingTime || Date.now(),
          indexPrice: item.indexPrice,
          intervalHours: intervalMap[item.symbol] || 8,
          countdown: formatCountdown(item.nextFundingTime - Date.now())
        }));

      setFundingData(filtered);
      setLoading(false);
      setError("");
    } catch (err) {
      console.error("❌ Error fetching funding rate:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch data");
      setLoading(false);
    }
  }, []);

  // Update countdown mỗi giây cho tất cả symbols
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setFundingData(prev => prev.map(item => ({
        ...item,
        countdown: formatCountdown(item.nextFundingTime - Date.now())
      })));
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  // Initial fetch and polling setup
  useEffect(() => {
    fetchFundingData();
    intervalRef.current = setInterval(fetchFundingData, 60000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchFundingData]);

  // Sort by absolute funding rate (highest first)
  const sortedFundingData = React.useMemo(() => {
    return [...fundingData]
      .sort((a, b) => Math.abs(parseFloat(b.fundingRate)) - Math.abs(parseFloat(a.fundingRate)))
      .slice(0, 20);
  }, [fundingData]);

  const handleCoinClick = (symbol: string) => {
    if (onSymbolClick) {
      onSymbolClick(symbol);
    }
  };

  const formatFundingRate = (rate: string) => {
    const r = Math.abs(parseFloat(rate)) * 100;
    return r.toFixed(4) + "%";
  };

  const renderFundingList = () => {
    if (loading) {
      return (
        <div className="top-funding-loading">
          <div className="loading-text">Đang tải...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="top-funding-empty">
          <div className="empty-text" style={{ color: '#f6465d' }}>Lỗi: {error}</div>
        </div>
      );
    }

    if (sortedFundingData.length === 0) {
      return (
        <div className="top-funding-empty">
          <div className="empty-text">Không có dữ liệu</div>
        </div>
      );
    }

    return (
      <div className="top-funding-list">
        {sortedFundingData.map((item, index) => {
          const fundingRate = parseFloat(item.fundingRate);
          const isPositive = fundingRate >= 0;
          const displaySymbol = item.symbol.replace("USDT", "");
          const iconClass = isPositive ? "positive" : "negative";

          return (
            <div
              key={item.symbol}
              className="top-funding-item"
              onClick={() => handleCoinClick(item.symbol)}
            >
              {/* 1. Rank */}
              <span className="funding-rank">{index + 1}</span>

              {/* 2. Icon */}
              <div className={`funding-icon ${iconClass}`}>
                {displaySymbol.substring(0, 2)}
              </div>

              {/* 3. Symbol + Interval */}
              <div className="funding-info">
                <span className="funding-symbol">{displaySymbol}</span>
                <span className="funding-type">Vĩnh cửu</span>
              </div>

              {/* 4. Funding Rate % */}
              <div className="funding-rate-section">
                <span className={`funding-rate ${isPositive ? 'positive' : 'negative'}`}>
                  {formatFundingRate(item.fundingRate)}
                </span>
              </div>

              {/* 5. Countdown riêng cho từng symbol */}
              <div className="funding-countdown-section">
                <span className="funding-countdown">
                  {item.countdown || "00:00:00"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="top-funding-container">
      {/* Header - Binance style (không có countdown chung) */}
      

      {/* Content */}
      {renderFundingList()}
    </div>
  );
};

export default TopFundingRate;