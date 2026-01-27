import React, { useEffect, useState, useRef } from 'react';
import { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';

type Candle = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

interface HighLowMarkersProps {
  chartRef: React.RefObject<IChartApi | null>;
  candleSeries: ISeriesApi<'Candlestick'> | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  candles: Candle[];
  visible?: boolean;
}

// ✅ Helper: Smart decimals based on price magnitude
const getSmartDecimals = (price: number): number => {
  if (price >= 10000) return 1;
  if (price >= 1000) return 2;
  if (price >= 100) return 3;
  if (price >= 10) return 4;
  if (price >= 1) return 5;
  if (price >= 0.1) return 5;
  if (price >= 0.01) return 6;
  if (price >= 0.0001) return 7;
  return 8;
};

interface MarkerPosition {
  x: number;
  y: number;
  price: number;
  type: 'high' | 'low';
  time: UTCTimestamp;
}

const HighLowMarkers: React.FC<HighLowMarkersProps> = ({
  chartRef,
  candleSeries,
  containerRef,
  candles,
  visible = true,
}) => {
  const [markers, setMarkers] = useState<MarkerPosition[]>([]);
  const rafRef = useRef<number | null>(null);

  // Format price với smart decimals
  const formatPrice = (price: number) => {
    const decimals = getSmartDecimals(price);
    return price.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // Tìm high/low trong visible range
  const findHighLow = () => {
    const chart = chartRef.current;
    if (!chart || !candleSeries || candles.length === 0 || !containerRef.current) {
      setMarkers([]);
      return;
    }

    try {
      const timeScale = chart.timeScale();
      const visibleRange = timeScale.getVisibleLogicalRange();
      
      if (!visibleRange) {
        setMarkers([]);
        return;
      }

      // Lấy các candles trong visible range
      const startIdx = Math.max(0, Math.floor(visibleRange.from));
      const endIdx = Math.min(candles.length - 1, Math.ceil(visibleRange.to));
      
      if (startIdx > endIdx || endIdx < 0) {
        setMarkers([]);
        return;
      }

      const visibleCandles = candles.slice(startIdx, endIdx + 1);
      
      if (visibleCandles.length === 0) {
        setMarkers([]);
        return;
      }

      // Tìm high và low
      let highCandle = visibleCandles[0];
      let lowCandle = visibleCandles[0];
      
      visibleCandles.forEach(candle => {
        if (candle.high > highCandle.high) {
          highCandle = candle;
        }
        if (candle.low < lowCandle.low) {
          lowCandle = candle;
        }
      });

      const newMarkers: MarkerPosition[] = [];
      const containerRect = containerRef.current.getBoundingClientRect();

      // Tính position cho High marker
      const highX = timeScale.timeToCoordinate(highCandle.time);
      const highY = candleSeries.priceToCoordinate(highCandle.high);
      
      if (highX !== null && highY !== null && 
          highX >= 0 && highX <= containerRect.width &&
          highY >= 0 && highY <= containerRect.height) {
        newMarkers.push({
          x: highX,
          y: highY,
          price: highCandle.high,
          type: 'high',
          time: highCandle.time,
        });
      }

      // Tính position cho Low marker
      const lowX = timeScale.timeToCoordinate(lowCandle.time);
      const lowY = candleSeries.priceToCoordinate(lowCandle.low);
      
      if (lowX !== null && lowY !== null &&
          lowX >= 0 && lowX <= containerRect.width &&
          lowY >= 0 && lowY <= containerRect.height) {
        newMarkers.push({
          x: lowX,
          y: lowY,
          price: lowCandle.low,
          type: 'low',
          time: lowCandle.time,
        });
      }

      setMarkers(newMarkers);
    } catch (e) {
      console.warn('[HighLowMarkers] Error:', e);
      setMarkers([]);
    }
  };

  // Subscribe to chart changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !visible) {
      setMarkers([]);
      return;
    }

    const handleUpdate = () => {
      // Debounce với requestAnimationFrame
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(findHighLow);
    };

    // Subscribe to visible range changes
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleUpdate);
    
    // Subscribe to crosshair move để update khi price scale thay đổi
    chart.subscribeCrosshairMove(handleUpdate);

    // Initial calculation
    handleUpdate();

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      try {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleUpdate);
        chart.unsubscribeCrosshairMove(handleUpdate);
      } catch (e) {
        // Chart might be destroyed
      }
    };
  }, [chartRef.current, candleSeries, candles, visible]);

  // Re-calculate khi candles thay đổi
  useEffect(() => {
    if (visible && chartRef.current && candleSeries) {
      findHighLow();
    }
  }, [candles, visible]);

  if (!visible || markers.length === 0) {
    return null;
  }

  return (
    <>
      {markers.map((marker, index) => {
        const isHigh = marker.type === 'high';
        const lineLength = 35; // Đường gạch ngắn như Binance
        
        return (
          <div
            key={`${marker.type}-${marker.time}-${index}`}
            className="absolute pointer-events-none select-none"
            style={{
              left: marker.x,
              top: marker.y,
              // Đường kẻ + số nằm ngang, kéo sang phải từ nến
              transform: 'translate(0, -50%)',
              zIndex: 20,
            }}
          >
            {/* Container ngang: đường kẻ + số */}
            <div 
              className="flex items-center"
              style={{ gap: 4 }}
            >
              {/* Đường gạch ngang từ nến sang */}
              <div
                style={{
                  width: lineLength,
                  height: 1,
                  backgroundColor: '#e2e2e2',
                }}
              />
              
              {/* Số giá */}
              <span
                style={{
                  color: '#e2e2e2',
                  fontSize: '11px',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {formatPrice(marker.price)}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
};

export default HighLowMarkers;