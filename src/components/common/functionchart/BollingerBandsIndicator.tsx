import React, { useRef, useEffect, useCallback } from 'react';
import {
  IChartApi,
  ISeriesApi,
  LineData,
  CandlestickData,
  UTCTimestamp,
} from 'lightweight-charts';

/**
 * Props for BollingerBandsIndicator component
 */
export interface BollingerBandsProps {
  chart: IChartApi | null;
  candleSeries: ISeriesApi<'Candlestick'> | null;
  candles: CandlestickData<UTCTimestamp>[];
  visible: boolean;
  period: number;
  stdDev: number;
  colors: {
    upper: string;
    middle: string;
    lower: string;
    fill: string;
  };
  fillVisible: boolean;
  onValuesUpdate?: (values: { upper: number; middle: number; lower: number } | null) => void;
}

/**
 * Calculate Bollinger Bands
 */
function calculateBollingerBands(
  data: CandlestickData[],
  period: number,
  stdDev: number
): { upper: LineData[]; middle: LineData[]; lower: LineData[] } {
  const upper: LineData[] = [];
  const middle: LineData[] = [];
  const lower: LineData[] = [];

  for (let i = period - 1; i < data.length; i++) {
    // Calculate SMA (middle band)
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close || 0;
    }
    const sma = sum / period;

    // Calculate standard deviation
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = (data[j].close || 0) - sma;
      variance += diff * diff;
    }
    const std = Math.sqrt(variance / period);

    // Calculate bands
    const upperBand = sma + stdDev * std;
    const lowerBand = sma - stdDev * std;

    // High precision for low-value cryptocurrencies
    middle.push({ time: data[i].time, value: +sma.toFixed(8) });
    upper.push({ time: data[i].time, value: +upperBand.toFixed(8) });
    lower.push({ time: data[i].time, value: +lowerBand.toFixed(8) });
  }

  return { upper, middle, lower };
}

/**
 * Draw BOLL filled background on canvas overlay
 */
function drawBollFill(
  canvas: HTMLCanvasElement,
  chart: IChartApi,
  series: ISeriesApi<'Candlestick'>,
  upperData: LineData[],
  lowerData: LineData[],
  color: string
) {
  if (!upperData.length || !lowerData.length || !series) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const timeScale = chart.timeScale();

  // Get visible range
  const visibleRange = timeScale.getVisibleRange();
  if (!visibleRange) return;

  ctx.fillStyle = color;
  ctx.beginPath();

  // Draw upper line (left to right)
  let started = false;
  for (let i = 0; i < upperData.length; i++) {
    const point = upperData[i];
    const x = timeScale.timeToCoordinate(point.time as UTCTimestamp);
    const y = series.priceToCoordinate(point.value);

    if (x === null || y === null) continue;

    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }

  // Draw lower line (right to left) to close the polygon
  for (let i = lowerData.length - 1; i >= 0; i--) {
    const point = lowerData[i];
    const x = timeScale.timeToCoordinate(point.time as UTCTimestamp);
    const y = series.priceToCoordinate(point.value);

    if (x === null || y === null) continue;

    ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.fill();
}

/**
 * BollingerBandsIndicator Component
 * Manages all BOLL-related logic including calculation, rendering, and canvas overlay
 */
const BollingerBandsIndicator: React.FC<BollingerBandsProps> = ({
  chart,
  candleSeries,
  candles,
  visible,
  period,
  stdDev,
  colors,
  fillVisible,
  onValuesUpdate,
}) => {
  // 🐛 DEBUG: Log component props
  console.log('🟣 [BOLL] Component render:', {
    visible,
    hasChart: !!chart,
    hasCandleSeries: !!candleSeries,
    candlesCount: candles.length,
    period,
    stdDev,
    colors,
    fillVisible,
  });

  // Refs for line series
  const upperBandRef = useRef<ISeriesApi<'Line'> | null>(null);
  const middleBandRef = useRef<ISeriesApi<'Line'> | null>(null);
  const lowerBandRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Refs for canvas and data
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const upperDataRef = useRef<LineData[]>([]);
  const lowerDataRef = useRef<LineData[]>([]);
  const rafIdRef = useRef<number | null>(null);

  // Refs for current state (to avoid closure issues)
  const fillVisibleRef = useRef(fillVisible);
  const colorsRef = useRef(colors);
  const visibleRef = useRef(visible);

  // Update refs when props change
  useEffect(() => {
    fillVisibleRef.current = fillVisible;
    colorsRef.current = colors;
    visibleRef.current = visible;
  }, [fillVisible, colors, visible]);

  /**
   * Initialize BOLL series and canvas
   */
  useEffect(() => {
    if (!chart || !candleSeries || !visible) return;

    console.log('🎨 [BOLL] Creating series...');

    // Create line series for upper, middle, lower bands
    upperBandRef.current = chart.addLineSeries({
      color: colors.upper,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    middleBandRef.current = chart.addLineSeries({
      color: colors.middle,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    lowerBandRef.current = chart.addLineSeries({
      color: colors.lower,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    // Create canvas overlay for fill
    const chartContainer = (chart as any).chartElement?.() as HTMLElement | undefined;
    if (chartContainer) {
      const canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '0'; // Below lines but above chart background

      const rect = chartContainer.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';

      chartContainer.appendChild(canvas);
      canvasRef.current = canvas;
    }

    // Cleanup function
    return () => {
      if (upperBandRef.current) {
        chart.removeSeries(upperBandRef.current);
        upperBandRef.current = null;
      }
      if (middleBandRef.current) {
        chart.removeSeries(middleBandRef.current);
        middleBandRef.current = null;
      }
      if (lowerBandRef.current) {
        chart.removeSeries(lowerBandRef.current);
        lowerBandRef.current = null;
      }
      if (canvasRef.current) {
        canvasRef.current.remove();
        canvasRef.current = null;
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [chart, candleSeries, visible]);

  /**
   * Update colors when they change
   */
  useEffect(() => {
    if (!visible) return;
    
    upperBandRef.current?.applyOptions({ color: colors.upper });
    middleBandRef.current?.applyOptions({ color: colors.middle });
    lowerBandRef.current?.applyOptions({ color: colors.lower });
  }, [colors, visible]);

  /**
   * Calculate and update BOLL data when candles, period, or stdDev change
   */
  useEffect(() => {
    if (!visible || !candles.length || candles.length < period) {
      onValuesUpdate?.(null);
      return;
    }
    if (!upperBandRef.current || !middleBandRef.current || !lowerBandRef.current) return;

    const { upper, middle, lower } = calculateBollingerBands(candles, period, stdDev);

    upperBandRef.current.setData(upper);
    middleBandRef.current.setData(middle);
    lowerBandRef.current.setData(lower);

    // Store data for canvas rendering
    upperDataRef.current = upper;
    lowerDataRef.current = lower;

    // Expose current values via callback
    if (upper.length > 0 && middle.length > 0 && lower.length > 0) {
      const lastUpper = upper[upper.length - 1];
      const lastMiddle = middle[middle.length - 1];
      const lastLower = lower[lower.length - 1];
      
      onValuesUpdate?.({
        upper: lastUpper.value,
        middle: lastMiddle.value,
        lower: lastLower.value,
      });
    }

    // Trigger initial canvas draw
    if (fillVisible && chart && candleSeries && canvasRef.current) {
      requestRedraw();
    }
  }, [candles, period, stdDev, visible, fillVisible]);

  /**
   * Redraw canvas with debouncing
   */
  const requestRedraw = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    // Check if we should redraw
    if (!fillVisibleRef.current || !visibleRef.current) {
      return;
    }

    rafIdRef.current = requestAnimationFrame(() => {
      if (
        fillVisibleRef.current &&
        visibleRef.current &&
        canvasRef.current &&
        chart &&
        candleSeries &&
        upperDataRef.current.length &&
        lowerDataRef.current.length
      ) {
        drawBollFill(
          canvasRef.current,
          chart,
          candleSeries,
          upperDataRef.current,
          lowerDataRef.current,
          colorsRef.current.fill
        );
      }
      rafIdRef.current = null;
    });
  }, [chart, candleSeries]);

  /**
   * Subscribe to chart events for canvas redraw
   */
  useEffect(() => {
    if (!chart || !visible || !fillVisible) return;

    const handleVisibleRangeChange = () => requestRedraw();

    chart.timeScale().subscribeVisibleTimeRangeChange(handleVisibleRangeChange);

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleRangeChange);
    };
  }, [chart, visible, fillVisible, requestRedraw]);

  /**
   * Handle canvas resize
   */
  useEffect(() => {
    if (!chart || !canvasRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (canvasRef.current) {
          canvasRef.current.width = width;
          canvasRef.current.height = height;
          canvasRef.current.style.width = width + 'px';
          canvasRef.current.style.height = height + 'px';
          requestRedraw();
        }
      }
    });

    const chartContainer = (chart as any).chartElement?.() as HTMLElement | undefined;
    if (chartContainer) {
      resizeObserver.observe(chartContainer);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [chart, requestRedraw]);

  /**
   * Redraw when fillVisible changes
   */
  useEffect(() => {
    if (!chart || !visible) return;
    requestRedraw();
  }, [fillVisible, chart, visible, requestRedraw]);

  // This component doesn't render anything visible - it manages chart series
  return null;
};

export default React.memo(BollingerBandsIndicator, (prevProps, nextProps) => {
  // Return true if props are equal (should NOT re-render)
  // Return false if props changed (should re-render)
  
  // Don't re-render if chart/series references are the same and visible state unchanged
  const chartSame = prevProps.chart === nextProps.chart;
  const seriesSame = prevProps.candleSeries === nextProps.candleSeries;
  const visibleSame = prevProps.visible === nextProps.visible;
  const periodSame = prevProps.period === nextProps.period;
  const stdDevSame = prevProps.stdDev === nextProps.stdDev;
  const fillVisibleSame = prevProps.fillVisible === nextProps.fillVisible;
  const colorsSame = prevProps.colors === nextProps.colors;
  
  // Only check if candles length changed or last candle changed
  const candlesLengthSame = prevProps.candles.length === nextProps.candles.length;
  const lastCandleSame = 
    prevProps.candles.length > 0 && nextProps.candles.length > 0
      ? prevProps.candles[prevProps.candles.length - 1]?.time === nextProps.candles[nextProps.candles.length - 1]?.time
      : prevProps.candles.length === nextProps.candles.length;
  
  const shouldNotRerender = 
    chartSame &&
    seriesSame &&
    visibleSame &&
    periodSame &&
    stdDevSame &&
    fillVisibleSame &&
    colorsSame &&
    candlesLengthSame &&
    lastCandleSame;
  
  if (!shouldNotRerender) {
    console.log('🔄 [BOLL] Re-rendering because:', {
      chartSame,
      seriesSame,
      visibleSame,
      periodSame,
      stdDevSame,
      fillVisibleSame,
      colorsSame,
      candlesLengthSame,
      lastCandleSame,
    });
  }
  
  return shouldNotRerender;
});