import { useState, useRef, useEffect, useCallback } from 'react';
import { ISeriesApi, IChartApi, CandlestickData, LineData, UTCTimestamp } from 'lightweight-charts';
import { calculateBollingerBands } from '../utils/calculations';

interface UseBollingerBandsProps {
  chartRef: React.MutableRefObject<IChartApi | null>;
  candleSeriesRef: React.MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  mainChartContainerRef: React.MutableRefObject<HTMLDivElement | null>;
  visible: boolean;
  fillVisible: boolean;
  period: number;
  stdDev: number;
  colors: {
    upper: string;
    middle: string;
    lower: string;
    fill: string;
  };
}

/**
 * Hook to manage Bollinger Bands indicator with canvas overlay for fill
 */
export function useBollingerBands({
  chartRef,
  candleSeriesRef,
  mainChartContainerRef,
  visible,
  fillVisible,
  period,
  stdDev,
  colors,
}: UseBollingerBandsProps) {
  // State for BOLL data
  const [bollData, setBollData] = useState<{
    upper: LineData[];
    middle: LineData[];
    lower: LineData[];
  } | null>(null);

  // Refs for BOLL series
  const bollUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bollMiddleRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bollLowerRef = useRef<ISeriesApi<'Line'> | null>(null);
  
  // Canvas overlay for fill
  const bollCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // ✅ Refs to track state in closures
  const bollDataRef = useRef(bollData);
  const fillVisibleRef = useRef(fillVisible);
  const visibleRef = useRef(visible);
  const periodRef = useRef(period);
  const stdDevRef = useRef(stdDev);
  
  // Animation frame ref
  const redrawAnimationFrameRef = useRef<number | null>(null);

  // ✅ Sync refs with state/props
  useEffect(() => {
    bollDataRef.current = bollData;
  }, [bollData]);

  useEffect(() => {
    fillVisibleRef.current = fillVisible;
  }, [fillVisible]);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    periodRef.current = period;
  }, [period]);

  useEffect(() => {
    stdDevRef.current = stdDev;
  }, [stdDev]);

  /**
   * Draw BOLL fill on canvas overlay
   */
  const drawBollFill = useCallback(
    (
      canvas: HTMLCanvasElement,
      chart: IChartApi,
      series: ISeriesApi<'Candlestick'>,
      upperData: LineData[],
      lowerData: LineData[],
      fillColor: string = 'rgba(179, 133, 248, 0.1)'
    ) => {
      if (!upperData.length || !lowerData.length || !series) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const timeScale = chart.timeScale();

      // Get visible range
      const visibleRange = timeScale.getVisibleRange();
      if (!visibleRange) return;

      // Clip to chart area only (exclude price scale)
      ctx.save();
      const priceScale = chart.priceScale('right');
      const priceScaleWidth = priceScale.width();
      const chartWidth = canvas.width - priceScaleWidth;

      // Create clipping region
      ctx.beginPath();
      ctx.rect(0, 0, chartWidth, canvas.height);
      ctx.clip();

      ctx.fillStyle = fillColor;
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
      ctx.restore();
    },
    []
  );

  /**
   * Redraw BOLL fill (debounced with requestAnimationFrame)
   */
  const redrawBollFill = useCallback(() => {
    // Cancel previous animation frame
    if (redrawAnimationFrameRef.current !== null) {
      cancelAnimationFrame(redrawAnimationFrameRef.current);
      redrawAnimationFrameRef.current = null;
    }

    // Get current values from refs (to avoid closure issues)
    const currentBollData = bollDataRef.current;
    const currentFillVisible = fillVisibleRef.current;
    const currentVisible = visibleRef.current;

    if (!bollCanvasRef.current || !chartRef.current || !candleSeriesRef.current) {
      return;
    }

    // Schedule redraw on next animation frame
    redrawAnimationFrameRef.current = requestAnimationFrame(() => {
      if (!bollCanvasRef.current) return;

      const ctx = bollCanvasRef.current.getContext('2d');
      if (!ctx) return;

      // Always clear canvas first
      ctx.clearRect(0, 0, bollCanvasRef.current.width, bollCanvasRef.current.height);

      // Only proceed to redraw if we should be showing the fill
      if (
        !currentBollData ||
        !currentVisible ||
        !currentFillVisible ||
        !chartRef.current ||
        !candleSeriesRef.current
      ) {
        return; // Exit after clearing
      }

      const timeScale = chartRef.current.timeScale();
      const visibleRange = timeScale.getVisibleRange();
      if (!visibleRange) {
        return;
      }

      drawBollFill(
        bollCanvasRef.current,
        chartRef.current,
        candleSeriesRef.current,
        currentBollData.upper,
        currentBollData.lower,
        colors.fill
      );
    });
  }, [chartRef, candleSeriesRef, colors.fill, drawBollFill]);

  /**
   * Initialize canvas overlay
   */
  const initializeCanvas = useCallback(() => {
    const mainEl = mainChartContainerRef.current;
    if (!mainEl) return null;

    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1';
    canvas.width = mainEl.clientWidth;
    canvas.height = mainEl.clientHeight;
    mainEl.style.position = 'relative';
    mainEl.appendChild(canvas);
    bollCanvasRef.current = canvas;

    return canvas;
  }, [mainChartContainerRef]);

  /**
   * ✅ FIX: Calculate and update BOLL data
   * ALWAYS calculate and setData (regardless of visibility)
   * Visibility is controlled via applyOptions({ visible: ... })
   */
  const updateBollingerBands = useCallback(
    (candles: CandlestickData[]) => {
      const currentPeriod = periodRef.current;
      const currentStdDev = stdDevRef.current;

      // ✅ Only check if we have enough data, NOT visibility
      if (candles.length < currentPeriod) {
        return;
      }

      const calculated = calculateBollingerBands(candles, currentPeriod, currentStdDev);

      // ✅ ALWAYS setData - visibility is controlled separately
      if (bollUpperRef.current) bollUpperRef.current.setData(calculated.upper);
      if (bollMiddleRef.current) bollMiddleRef.current.setData(calculated.middle);
      if (bollLowerRef.current) bollLowerRef.current.setData(calculated.lower);

      setBollData(calculated);

      // Redraw fill if visible
      if (fillVisibleRef.current && visibleRef.current) {
        setTimeout(() => {
          redrawBollFill();
        }, 50);
      }
    },
    [redrawBollFill]
  );

  /**
   * Clear BOLL data
   */
  const clearBollingerBands = useCallback(() => {
    bollUpperRef.current?.setData([]);
    bollMiddleRef.current?.setData([]);
    bollLowerRef.current?.setData([]);
    setBollData(null);

    // Clear canvas
    if (bollCanvasRef.current) {
      const ctx = bollCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, bollCanvasRef.current.width, bollCanvasRef.current.height);
      }
    }
  }, []);

  /**
   * Cleanup canvas on unmount
   */
  useEffect(() => {
    return () => {
      if (bollCanvasRef.current && bollCanvasRef.current.parentElement) {
        bollCanvasRef.current.parentElement.removeChild(bollCanvasRef.current);
        bollCanvasRef.current = null;
      }
      if (redrawAnimationFrameRef.current !== null) {
        cancelAnimationFrame(redrawAnimationFrameRef.current);
      }
    };
  }, []);

  return {
    bollData,
    setBollData,
    bollUpperRef,
    bollMiddleRef,
    bollLowerRef,
    bollCanvasRef,
    initializeCanvas,
    updateBollingerBands,
    clearBollingerBands,
    redrawBollFill,
    drawBollFill,
  };
}