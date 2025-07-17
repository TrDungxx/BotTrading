import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  IChartApi,
  UTCTimestamp,
  ISeriesApi,
} from 'lightweight-charts';
import { ExtendedCandle } from '../../utils/types';

interface Props {
  data: ExtendedCandle[];
  syncChart: IChartApi | null;
}

export default function VolumeChart({ data, syncChart }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const isSyncing = useRef(false);

  // Create chart
  useEffect(() => {
    if (!ref.current || !syncChart) return;

    const chart = createChart(ref.current, {
      layout: { background: { type: ColorType.Solid, color: '#1e293b' }, textColor: '#cbd5e1' },
      grid: { vertLines: { color: '#334155' }, horzLines: { color: '#334155' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        visible: true,
        scaleMargins: {
          top: 0.2,
          bottom: 0,
        },
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
    });

    volumeSeriesRef.current = volumeSeries;

    // Set initial data safely
    if (data.length > 0) {
      const mappedData = data
        .filter((c) => typeof c.volume === 'number' && !isNaN(c.volume))
        .map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.volume,
          color: c.close >= c.open ? '#00C9A7' : '#E63757',
        }));

      if (mappedData.length === 0) {
        console.warn('[VolumeChart] ❌ No valid volume data to render');
        return;
      }

      volumeSeries.setData(mappedData);
    }

    // ✅ Sync timeScale MAIN → VOLUME (1 chiều, chống crash)
    syncChart.timeScale().subscribeVisibleTimeRangeChange((range) => {
      if (
        !range ||
        !volumeSeriesRef.current ||
        typeof range.from !== 'number' ||
        typeof range.to !== 'number' ||
        isNaN(range.from) ||
        isNaN(range.to) ||
        isSyncing.current
      ) {
        return;
      }

      const safeRange = {
        from: +range.from,
        to: +range.to,
      };

      isSyncing.current = true;

      setTimeout(() => {
        try {
          chart.timeScale().setVisibleRange(safeRange);
        } catch (err) {
          console.warn('[VolumeChart] ❌ setVisibleRange failed:', err, safeRange);
        } finally {
          isSyncing.current = false;
        }
      }, 0);
    });

    // Resize
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

  // Update data realtime
  useEffect(() => {
    const series = volumeSeriesRef.current;
    if (!series || !Array.isArray(data)) return;

    const mappedData = data
      .filter((c) => typeof c.volume === 'number' && !isNaN(c.volume))
      .map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? '#00C9A7' : '#E63757',
      }));

    if (mappedData.length === 0) {
      console.warn('[VolumeChart] ❌ No valid volume data to render (realtime)');
      return;
    }

    series.setData(mappedData);
  }, [data]);

  return <div ref={ref} className="w-full h-full" />;
}
