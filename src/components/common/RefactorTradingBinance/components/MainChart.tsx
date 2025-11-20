import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ColorType,
  LineStyle,
} from 'lightweight-charts';
import { Candle, ChartType, SymbolMeta } from '../types';
import { setupCanvasOverlay, drawBollFill, debounceRAF } from '../utils/canvasDrawing';

interface MainChartProps {
  candles: Candle[];
  chartType: ChartType;
  symbolMeta: SymbolMeta | undefined;
  onCrosshairMove?: (param: any) => void;
  onClick?: (param: any) => void;
}

export interface MainChartHandle {
  chart: IChartApi | null;
  candleSeries: ISeriesApi<'Candlestick'> | null;
  addLineSeries: (color: string, visible: boolean) => ISeriesApi<'Line'>;
  drawBollingerFill: (upperData: any[], lowerData: any[], color?: string) => void;
  clearBollingerFill: () => void;
}

/**
 * Main chart component with candlestick/line series
 */
export const MainChart = forwardRef<MainChartHandle, MainChartProps>(
  ({ candles, chartType, symbolMeta, onCrosshairMove, onClick }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rafRef = useRef<number | null>(null);

    /**
     * Initialize chart
     */
    useEffect(() => {
      if (!containerRef.current) return;

      const chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
        layout: {
          background: { type: ColorType.Solid, color: '#16171B' },
          textColor: '#B2B5BE',
        },
        grid: {
          vertLines: { color: '#2B2B43', style: LineStyle.Solid },
          horzLines: { color: '#2B2B43', style: LineStyle.Solid },
        },
        rightPriceScale: {
          borderColor: '#2B2B43',
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: {
          borderColor: '#2B2B43',
          timeVisible: true,
          secondsVisible: false,
        },
        crosshair: {
          mode: 1,
          vertLine: {
            color: '#758696',
            width: 1,
            style: LineStyle.Dashed,
            labelBackgroundColor: '#4E5969',
          },
          horzLine: {
            color: '#758696',
            width: 1,
            style: LineStyle.Dashed,
            labelBackgroundColor: '#4E5969',
          },
        },
      });

      chartRef.current = chart;

      // Create candlestick series
      const candleSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });

      candleSeriesRef.current = candleSeries;

      // Setup canvas overlay for Bollinger Bands fill
      canvasRef.current = setupCanvasOverlay(containerRef.current, chart);

      // Handle resize
      const handleResize = () => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      };

      window.addEventListener('resize', handleResize);

      // Subscribe to events
      if (onCrosshairMove) {
        chart.subscribeCrosshairMove(onCrosshairMove);
      }
      if (onClick) {
        chart.subscribeClick(onClick);
      }

      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
        
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
        }
      };
    }, [onCrosshairMove, onClick]);

    /**
     * Update candle data
     */
    useEffect(() => {
      if (!candleSeriesRef.current || !candles.length) return;
      candleSeriesRef.current.setData(candles);
    }, [candles]);

    /**
     * Update price precision
     */
    useEffect(() => {
      if (!chartRef.current || !symbolMeta) return;
      
      chartRef.current.applyOptions({
        localization: {
          priceFormatter: (price: number) => price.toFixed(symbolMeta.precision),
        },
      });
      
      if (candleSeriesRef.current) {
        candleSeriesRef.current.applyOptions({
          priceFormat: {
            type: 'price',
            precision: symbolMeta.precision,
            minMove: symbolMeta.tickSize,
          },
        });
      }
    }, [symbolMeta]);

    /**
     * Expose methods via ref
     */
    useImperativeHandle(ref, () => ({
      chart: chartRef.current,
      candleSeries: candleSeriesRef.current,
      
      addLineSeries: (color: string, visible: boolean) => {
        if (!chartRef.current) throw new Error('Chart not initialized');
        
        return chartRef.current.addLineSeries({
          color,
          lineWidth: 1,
          visible,
          lastValueVisible: false,
          priceLineVisible: false,
        });
      },
      
      drawBollingerFill: (upperData: any[], lowerData: any[], color?: string) => {
        if (!canvasRef.current || !chartRef.current || !candleSeriesRef.current) return;
        
        // Debounced redraw
        const redraw = debounceRAF(() => {
          if (canvasRef.current && chartRef.current && candleSeriesRef.current) {
            drawBollFill(
              canvasRef.current,
              chartRef.current,
              candleSeriesRef.current,
              upperData,
              lowerData,
              color
            );
          }
        });
        
        redraw();
      },
      
      clearBollingerFill: () => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      },
    }));

    return (
      <div 
        ref={containerRef} 
        className="relative w-full h-full"
      />
    );
  }
);

MainChart.displayName = 'MainChart';