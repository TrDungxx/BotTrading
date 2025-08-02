import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  IChartApi,
  UTCTimestamp,
  ISeriesApi,
  TimeRange,
} from 'lightweight-charts';
import { ExtendedCandle } from '../../utils/types';

interface Props {
  data: ExtendedCandle[];
  syncChart: IChartApi | null;
  syncRange?: TimeRange | null;
}

export default function VolumeChart({ data, syncChart, syncRange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  useEffect(() => {
    if (!ref.current || !syncChart) return;

    const chart = createChart(ref.current, {
      layout: { background: { type: ColorType.Solid, color: '#0b0e11' }, textColor: '#cbd5e1' },
      grid: { vertLines: { color: '#1e2329' }, horzLines: { color: '#1e2329' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        visible: true,
        scaleMargins: { top: 0.2, bottom: 0 },
      },
      timeScale: {
        borderColor: '#1e2329',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      overlay: true,
      scaleMargins: { top: 0.9, bottom: 0 },
    });

    volumeSeriesRef.current = volumeSeries;

    const validData = data
      .filter((c) => typeof c.volume === 'number')
      .map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? '#26A69A' : '#EF5350',
      }));

    volumeSeries.setData(validData);

    const resize = () => {
      chart.applyOptions({
        width: ref.current!.clientWidth,
        height: ref.current!.clientHeight,
      });
    };

    window.addEventListener('resize', resize);
    resize();

    return () => {
      chart.remove();
      window.removeEventListener('resize', resize);
    };
  }, [syncChart]);

  // Sync từ MainChart → VolumeChart
  useEffect(() => {
    if (!chartRef.current || !syncRange) return;

    try {
      chartRef.current.timeScale().setVisibleRange({
        from: syncRange.from,
        to: syncRange.to,
      });
    } catch (err) {
      console.warn('[VolumeChart] ❌ Failed to set visible range:', err);
    }
  }, [syncRange]);

  // Realtime update
  useEffect(() => {
    const series = volumeSeriesRef.current;
    if (!series) return;

    const mapped = data
      .filter((c) => typeof c.volume === 'number')
      .map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? '#26A69A' : '#EF5350',
      }));

    series.setData(mapped);
  }, [data]);

  return <div ref={ref} className="w-full h-full" />;
}
