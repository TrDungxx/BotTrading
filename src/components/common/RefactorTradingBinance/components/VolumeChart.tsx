import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ColorType,
  LineStyle,
} from 'lightweight-charts';
import { VolumeBar } from '../types';

interface VolumeChartProps {
  volumeData: VolumeBar[];
  timeScale?: any; // Sync with main chart if needed
}

export interface VolumeChartHandle {
  chart: IChartApi | null;
  volumeSeries: ISeriesApi<'Histogram'> | null;
  addLineSeries: (color: string, visible: boolean) => ISeriesApi<'Line'>;
}

/**
 * Volume chart component
 */
export const VolumeChart = forwardRef<VolumeChartHandle, VolumeChartProps>(
  ({ volumeData, timeScale }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

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
          scaleMargins: { top: 0.1, bottom: 0 },
        },
        timeScale: {
          visible: false, // Hide time scale for volume chart
          borderColor: '#2B2B43',
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

      // Create histogram series for volume
      const volumeSeries = chart.addHistogramSeries({
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
      });

      volumeSeriesRef.current = volumeSeries;

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

      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
        chartRef.current = null;
        volumeSeriesRef.current = null;
      };
    }, []);

    /**
     * Update volume data
     */
    useEffect(() => {
      if (!volumeSeriesRef.current || !volumeData.length) return;
      volumeSeriesRef.current.setData(volumeData);
    }, [volumeData]);

    /**
     * Sync time scale with main chart
     */
    useEffect(() => {
      if (!chartRef.current || !timeScale) return;
      
      // Sync visible logical range
      const handleVisibleLogicalRangeChange = (range: any) => {
        if (chartRef.current) {
          chartRef.current.timeScale().setVisibleLogicalRange(range);
        }
      };
      
      timeScale.subscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);
      
      return () => {
        timeScale.unsubscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);
      };
    }, [timeScale]);

    /**
     * Expose methods via ref
     */
    useImperativeHandle(ref, () => ({
      chart: chartRef.current,
      volumeSeries: volumeSeriesRef.current,
      
      addLineSeries: (color: string, visible: boolean) => {
        if (!chartRef.current) throw new Error('Chart not initialized');
        
        return chartRef.current.addLineSeries({
          color,
          lineWidth: 1,
          visible,
          lastValueVisible: false,
          priceLineVisible: false,
          priceScaleId: 'volume',
        });
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

VolumeChart.displayName = 'VolumeChart';