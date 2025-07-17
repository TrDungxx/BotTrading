import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
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
  onChartReady?: (chart: IChartApi) => void;
}

const MainChart = forwardRef<IChartApi | null, Props>(({ data, onChartReady }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const maSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  useImperativeHandle(ref, () => chartRef.current!);

  // Init chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#1e293b' }, textColor: '#cbd5e1' },
      grid: { vertLines: { color: '#334155' }, horzLines: { color: '#334155' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        scaleMargins: { top: 0.05, bottom: 0.15 },
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;
    onChartReady?.(chart);

    candleSeriesRef.current = chart.addCandlestickSeries({
      upColor: '#00C9A7',
      downColor: '#E63757',
      wickUpColor: '#00C9A7',
      wickDownColor: '#E63757',
      borderVisible: false,
    });

    const maSeries = chart.addLineSeries({
  color: '#FFD700',
  lineWidth: 1,
  lastValueVisible: false,
  priceLineVisible: false,
});

maSeriesRef.current = maSeries;

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

  // Update data
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const maSeries = maSeriesRef.current;

    if (!candleSeries || !maSeries) return;

    candleSeries.setData(data);

    const maData = data.length >= 20
      ? data.slice(19).map((_, i) => {
          const slice = data.slice(i, i + 20);
          const avg = slice.reduce((sum, d) => sum + d.close, 0) / 20;
          return { time: data[i + 19].time as UTCTimestamp, value: +avg.toFixed(6) };
        })
      : [];

    maSeries.setData(maData);
  }, [data]);

  // Fit chart on first load only
  useEffect(() => {
    chartRef.current?.timeScale().fitContent();
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
});

export default MainChart;
