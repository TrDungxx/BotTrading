import React, { useEffect, useRef } from 'react';
import {
  createChart,
  CrosshairMode,
  ColorType,
  CandlestickData,
  HistogramData,
} from 'lightweight-charts';

interface Props {
  candles: CandlestickData[];
  volumes: HistogramData[];
}

const MergedChart: React.FC<Props> = ({ candles, volumes }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e11' },
        textColor: '#ccc',
      },
      grid: {
        vertLines: { color: '#2b2b2b' },
        horzLines: { color: '#2b2b2b' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        borderColor: '#485c7b',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#485c7b',
      },
      height: 500,
    });

    // === MainChart UI ===
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    candleSeries.setData(candles);

    // === VolumeChart UI ===
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '', // attach to separate scale
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });
    volumeSeries.setData(volumes);

    // Resize on container resize
    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: chartContainerRef.current!.clientWidth });
    });
    observer.observe(chartContainerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [candles, volumes]);

  return <div ref={chartContainerRef} style={{ width: '100%', height: '500px' }} />;
};

export default MergedChart;
