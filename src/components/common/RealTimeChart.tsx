import React, { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';

export default function RealTimeChart() {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const candleSeriesRef = useRef<any>(null);
  const binanceWSRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { type: ColorType.Solid, color: '#1e1e2f' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2B2B43' },
        horzLines: { color: '#363C4E' },
      },
      crosshair: { mode: 0 },
      priceScale: { borderColor: '#485c7b' },
      timeScale: {
        borderColor: '#485c7b',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    candleSeriesRef.current = candleSeries;

    // Fetch historical data (1m candles)
    fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100')
      .then(res => res.json())
      .then(data => {
        const formattedData = data.map((d: any) => ({
          time: d[0] / 1000,
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
        }));
        candleSeries.setData(formattedData);
      });

    // Open WebSocket for real-time updates
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m');
    binanceWSRef.current = ws;

    ws.onmessage = event => {
  const message = JSON.parse(event.data);
  const candlestick = message.k;

  if (!candlestick.x) return; // ❗ Skip nếu nến chưa hoàn thành

  const newCandle = {
    time: (candlestick.t / 1000) as UTCTimestamp,
    open: parseFloat(candlestick.o),
    high: parseFloat(candlestick.h),
    low: parseFloat(candlestick.l),
    close: parseFloat(candlestick.c),
  };

  console.log('[BINANCE] Closed candle:', newCandle);
  candleSeries.update(newCandle);
};

    // Resize handler
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      ws.close();
    };
  }, []);

  return (
    <div
      ref={chartContainerRef}
      className="w-full rounded-lg overflow-hidden"
      style={{ height: '500px' }}
    />
  );
}
