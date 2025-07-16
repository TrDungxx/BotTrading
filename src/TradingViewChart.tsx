import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  UTCTimestamp,
} from 'lightweight-charts';

interface ExtendedCandle extends CandlestickData {
  volume: number;
}

interface TradingViewChartProps {
  data: ExtendedCandle[];
}

export default function TradingViewChart({ data }: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const maSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const calculateMA = (
    candles: ExtendedCandle[],
    period: number
  ): { time: UTCTimestamp; value: number }[] => {
    const result = [];
    for (let i = period - 1; i < candles.length; i++) {
      const slice = candles.slice(i - period + 1, i + 1);
      const avg = slice.reduce((sum, d) => sum + d.close, 0) / period;
      result.push({
        time: candles[i].time as UTCTimestamp,
        value: parseFloat(avg.toFixed(2)),
      });
    }
    return result;
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#1e293b' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#334155' },
        horzLines: { color: '#334155' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#475569',
          width: 1,
          style: 3,
          labelBackgroundColor: '#475569',
        },
        horzLine: {
          color: '#475569',
          width: 1,
          style: 3,
          labelBackgroundColor: '#475569',
        },
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#334155',
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    // ✅ Set scaleMargins cho chart chính (candlestick)
    chart.priceScale('right').applyOptions({
      scaleMargins: {
        top: 0.05,
        bottom: 0.15,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#00C9A7',
      downColor: '#E63757',
      borderVisible: false,
      wickUpColor: '#00C9A7',
      wickDownColor: '#E63757',
    });

    const volumeSeries = chart.addHistogramSeries({
      priceScaleId: '', // dùng overlay scale (không đè trục riêng)
      priceFormat: { type: 'volume' },
      scaleMargins: {
        top: 0.85,
        bottom: 0,
      },
    });

    const maSeries = chart.addLineSeries({
      color: '#FFD700',
      lineWidth: 1,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;
    maSeriesRef.current = maSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) chartRef.current.remove();
    };
  }, []);

  useEffect(() => {
    if (
      !candleSeriesRef.current ||
      !volumeSeriesRef.current ||
      !maSeriesRef.current ||
      data.length === 0
    )
      return;

    if (data.length === 1) {
      const c = data[0];
      candleSeriesRef.current.update(c);
      volumeSeriesRef.current.update({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? '#00C9A7' : '#E63757',
      });
    } else {
      candleSeriesRef.current.setData(data);
      volumeSeriesRef.current.setData(
        data.map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.volume,
          color: c.close >= c.open ? '#00C9A7' : '#E63757',
        }))
      );
      const maData = data.length >= 20 ? calculateMA(data, 20) : [];
      maSeriesRef.current.setData(maData);

      chartRef.current?.timeScale().fitContent();
    }
  }, [data]);

  return <div ref={chartContainerRef} className="w-full h-full min-h-[300px]" />;
}
