import { useEffect, useRef } from 'react';
import { ISeriesApi, IPriceLine } from 'lightweight-charts';

interface CandleCountdownProps {
  /** Interval string như "1m", "5m", "15m", "1h", "4h", "1d", ... */
  interval: string;
  /** Giá hiện tại để hiển thị */
  currentPrice: number;
  /** Series để tạo price line */
  series: ISeriesApi<'Candlestick'> | null;
  /** Màu nền dựa trên candle tăng/giảm */
  isUp?: boolean;
}

// Parse interval string thành milliseconds
const parseIntervalToMs = (interval: string): number => {
  const value = parseInt(interval);
  const unit = interval.replace(/\d+/g, '').toLowerCase();
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'w': return value * 7 * 24 * 60 * 60 * 1000;
    case 'M': return value * 30 * 24 * 60 * 60 * 1000;
    default: return 60 * 1000;
  }
};

// Format countdown time
const formatCountdown = (ms: number): string => {
  if (ms <= 0) return '00:00';
  
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const CandleCountdown: React.FC<CandleCountdownProps> = ({
  interval,
  currentPrice,
  series,
  isUp = true,
}) => {
  const priceLineRef = useRef<IPriceLine | null>(null);
  const intervalMs = useRef(parseIntervalToMs(interval));
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Update interval khi prop thay đổi
  useEffect(() => {
    intervalMs.current = parseIntervalToMs(interval);
  }, [interval]);

  // Main effect: tạo và update price line
  useEffect(() => {
    if (!series || !Number.isFinite(currentPrice) || currentPrice <= 0) {
      return;
    }

    const color = isUp ? '#0ECB81' : '#F6465D';

    // Xóa price line cũ nếu có
    if (priceLineRef.current) {
      try {
        series.removePriceLine(priceLineRef.current);
      } catch (e) {}
      priceLineRef.current = null;
    }

    // Tạo price line mới
    priceLineRef.current = series.createPriceLine({
      price: currentPrice,
      color: color,
      lineWidth: 1,
      lineStyle: 2, // Dashed
      axisLabelVisible: true,
      title: '', // Sẽ update bằng countdown
    });

    // Update countdown function
    const updateCountdown = () => {
      if (!priceLineRef.current) return;
      
      const now = Date.now();
      const intervalDuration = intervalMs.current;
      const currentCandleStart = Math.floor(now / intervalDuration) * intervalDuration;
      const currentCandleEnd = currentCandleStart + intervalDuration;
      const remaining = currentCandleEnd - now;
      const countdown = formatCountdown(remaining);

      try {
        priceLineRef.current.applyOptions({
          price: currentPrice,
          color: color,
          title: countdown,
        });
      } catch (e) {}
    };

    // Clear timer cũ
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Update ngay và set interval
    updateCountdown();
    timerRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [series, currentPrice, isUp, interval]);

  // Cleanup khi unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (priceLineRef.current && series) {
        try {
          series.removePriceLine(priceLineRef.current);
        } catch (e) {}
        priceLineRef.current = null;
      }
    };
  }, []);

  // Component không render UI - chỉ quản lý price line
  return null;
};

export default CandleCountdown;