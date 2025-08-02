import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
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
  onChartReady?: (chart: IChartApi) => void;
  onTimeRangeChange?: (range: TimeRange | null) => void;
}

const MainChart = forwardRef<IChartApi | null, Props>(({ data, onChartReady, onTimeRangeChange }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const maSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  useImperativeHandle(ref, () => chartRef.current!);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#0b0e11' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#1e2329' }, horzLines: { color: '#1e2329' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { scaleMargins: { top: 0.05, bottom: 0.15 } },
      timeScale: {
        borderColor: '#1e2329',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;
    onChartReady?.(chart);

    // 2 chiều đồng bộ
    chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
      onTimeRangeChange?.(range);
    });

    candleSeriesRef.current = chart.addCandlestickSeries({
      upColor: '#26A69A',
      downColor: '#EF5350',
      borderUpColor: '#26A69A',
      borderDownColor: '#EF5350',
      wickUpColor: '#26A69A',
      wickDownColor: '#EF5350',
      borderVisible: false,
    });

    maSeriesRef.current = chart.addLineSeries({
      color: '#FFD700',
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    const resize = () => {
      chart.applyOptions({
        width: containerRef.current!.clientWidth,
        height: containerRef.current!.clientHeight,
      });
    };

    window.addEventListener('resize', resize);
    resize();

    return () => {
      chart.remove();
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || !maSeriesRef.current) return;

    candleSeriesRef.current.setData(data);

    const maData = data.length >= 20
      ? data.slice(19).map((_, i) => {
          const slice = data.slice(i, i + 20);
          const avg = slice.reduce((sum, d) => sum + d.close, 0) / 20;
          return { time: data[i + 19].time as UTCTimestamp, value: +avg.toFixed(6) };
        })
      : [];

    maSeriesRef.current.setData(maData);
  }, [data]);

  useEffect(() => {
    chartRef.current?.timeScale().fitContent();
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
});

export default MainChart;
