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
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  useImperativeHandle(ref, () => chartRef.current!);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e11' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2b3139' },
        horzLines: { color: '#2b3139' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        scaleMargins: {
          top: 0.05,
          bottom: 0.05,
        },
        borderVisible: false,
      },
      timeScale: {
        borderColor: '#2b3139',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;
    onChartReady?.(chart);

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

    volumeSeriesRef.current = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      overlay: false, // ✅ scale riêng cho volume
      scaleMargins: {
        top: 0,
        bottom: 0.2, // ✅ đủ chỗ cho volume mà không phá scale
      },
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
    if (!candleSeriesRef.current || !maSeriesRef.current || !volumeSeriesRef.current) return;

    // Set Candlestick data
    candleSeriesRef.current.setData(
      data.filter(
        (c) =>
          typeof c.open === 'number' &&
          typeof c.high === 'number' &&
          typeof c.low === 'number' &&
          typeof c.close === 'number' &&
          !isNaN(c.open) &&
          !isNaN(c.high) &&
          !isNaN(c.low) &&
          !isNaN(c.close)
      )
    );

    // Set MA line
    const maData = data.length >= 20
      ? data.slice(19).map((_, i) => {
          const slice = data.slice(i, i + 20);
          const avg = slice.reduce((sum, d) => sum + d.close, 0) / 20;
          return { time: data[i + 19].time as UTCTimestamp, value: +avg.toFixed(6) };
        })
      : [];

    maSeriesRef.current.setData(maData);

    // Set Volume data
    const volumeData = data
      .filter((c) => typeof c.volume === 'number')
      .map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? '#26A69A' : '#EF5350',
      }));

    volumeSeriesRef.current.setData(volumeData);
  }, [data]);

  useEffect(() => {
    chartRef.current?.timeScale().fitContent();
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
});

export default MainChart;
