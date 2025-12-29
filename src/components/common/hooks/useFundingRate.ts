import { useState, useEffect, useRef, useCallback } from 'react';

interface FundingRateData {
  fundingRate: string;
  nextFundingTime: number;
  countdown: string;
  intervalHours: number;
}

interface PositionData {
  symbol: string;
  positionAmt: string;
  markPrice?: string;
  positionSide?: string;
}

// ✅ Cache fundingInfo toàn cục (vì data này ít thay đổi)
let fundingInfoCache: Record<string, number> = {};
let fundingInfoLastFetch = 0;
const FUNDING_INFO_CACHE_TTL = 5 * 60 * 1000; // 5 phút

export function useFundingRate(symbol: string, market: 'spot' | 'futures') {
  const [fundingData, setFundingData] = useState<FundingRateData | null>(null);
  const [positions, setPositions] = useState<PositionData[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextFundingTimeRef = useRef<number>(0);

  // Format countdown HH:MM:SS
  const formatCountdown = useCallback((ms: number): string => {
    if (ms <= 0) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // ✅ Lấy funding interval từ cache hoặc fetch mới
  const getFundingInterval = useCallback(async (sym: string): Promise<number> => {
    const now = Date.now();

    // Nếu cache còn hạn và có data của symbol này
    if (fundingInfoCache[sym] && now - fundingInfoLastFetch < FUNDING_INFO_CACHE_TTL) {
      return fundingInfoCache[sym];
    }

    // Refresh cache nếu hết hạn hoặc chưa có
    if (now - fundingInfoLastFetch >= FUNDING_INFO_CACHE_TTL || Object.keys(fundingInfoCache).length === 0) {
      try {
        // ✅ API không nhận param symbol, trả về tất cả symbols
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
    }

    return fundingInfoCache[sym] || 8; // Mặc định 8h
  }, []);

  // Fetch funding rate + interval từ Binance
  const fetchFundingRate = useCallback(async () => {
    if (market !== 'futures' || !symbol) {
      setFundingData(null);
      return;
    }

    try {
      // Gọi 2 API song song
      const [premiumRes, intervalHours] = await Promise.all([
        fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`),
        getFundingInterval(symbol)
      ]);

      if (!premiumRes.ok) {
        console.error('Failed to fetch premium index:', premiumRes.status);
        return;
      }

      const premiumData = await premiumRes.json();

      nextFundingTimeRef.current = premiumData.nextFundingTime;

      setFundingData({
        fundingRate: premiumData.lastFundingRate,
        nextFundingTime: premiumData.nextFundingTime,
        countdown: formatCountdown(premiumData.nextFundingTime - Date.now()),
        intervalHours,
      });
    } catch (error) {
      console.error('Failed to fetch funding rate:', error);
    }
  }, [symbol, market, formatCountdown, getFundingInterval]);

  // Load positions từ localStorage
  const loadPositions = useCallback(() => {
    try {
      const saved = localStorage.getItem('positions');
      if (saved) {
        const parsed = JSON.parse(saved);
        setPositions(Array.isArray(parsed) ? parsed : []);
      } else {
        setPositions([]);
      }
    } catch {
      setPositions([]);
    }
  }, []);

  // Fetch funding rate khi mount và mỗi 60 giây
  useEffect(() => {
    fetchFundingRate();
    intervalRef.current = setInterval(fetchFundingRate, 60000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchFundingRate]);

  // Update countdown mỗi giây
  useEffect(() => {
    if (market !== 'futures') return;

    countdownRef.current = setInterval(() => {
      const remaining = nextFundingTimeRef.current - Date.now();

      setFundingData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          countdown: formatCountdown(remaining),
        };
      });

      // Refetch khi countdown về 0
      if (remaining <= 0) {
        fetchFundingRate();
      }
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [market, formatCountdown, fetchFundingRate]);

  // Load positions và lắng nghe thay đổi
  useEffect(() => {
    loadPositions();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'positions') loadPositions();
    };
    window.addEventListener('storage', handleStorage);

    const posInterval = setInterval(loadPositions, 2000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(posInterval);
    };
  }, [loadPositions]);

  // Tính estimated funding fee cho symbol đang chọn
  const estimatedFundingFee = useCallback((): number | null => {
    if (!fundingData || !positions.length) return null;

    const rate = parseFloat(fundingData.fundingRate);
    const symbolPositions = positions.filter(pos => pos.symbol === symbol);

    if (symbolPositions.length === 0) return null;

    const totalFee = symbolPositions.reduce((total, pos) => {
      const amt = parseFloat(pos.positionAmt || "0");
      const mark = parseFloat(pos.markPrice || "0");

      if (!amt || !mark) return total;

      return total + (-1 * amt * mark * rate);
    }, 0);

    return totalFee;
  }, [fundingData, positions, symbol]);

  return {
    fundingData,
    positions,
    estimatedFundingFee: estimatedFundingFee(),
  };
}