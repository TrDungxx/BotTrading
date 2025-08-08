import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  Time,
  CandlestickData,
  HistogramData,
  LineData,
  ColorType,
} from 'lightweight-charts';
import MAHeader from './popupchart/MAHeader';
import MASettings from './popupchart/MASetting';
import FloatingPositionTag from '../tabposition/FloatingPositionTag';
interface Props {
  selectedSymbol: string;
  selectedInterval: string;
  market: 'spot' | 'futures';
  position?: {
    entryPrice: string;
    positionAmt: string;
  };
}
interface PositionData {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
}

type KlineMessage = {
  e: string;
  E: number;
  s: string;
  k: {
    t: number;
    o: string;
    h: string;
    l: string;
    c: string;
    v: string;
    x: boolean;
  };
};

const TradingBinance: React.FC<Props> = ({ selectedSymbol, selectedInterval, market, position }) => {
  const mainChartRef = useRef<IChartApi | null>(null);
  const volumeChartRef = useRef<IChartApi | null>(null);
  const mainChartContainer = useRef<HTMLDivElement>(null);
  const volumeChartContainer = useRef<HTMLDivElement>(null);
const [showFloatingPnL, setShowFloatingPnL] = useState(true);
const [floatingPosition, setFloatingPosition] = useState<PositionData | null>(null);

  const candleSeries = useRef<any>(null);
  const volumeSeries = useRef<any>(null);
  const ma7Ref = useRef<any>(null);
  const ma25Ref = useRef<any>(null);
  const ma99Ref = useRef<any>(null);
const [showMASettings, setShowMASettings] = useState(false);
  const [candles, setCandles] = useState<CandlestickData<Time>[]>([]);
  const [maHeaderVisible, setMaHeaderVisible] = useState(true);
  const [maVisible, setMaVisible] = useState({
    ma7: true,
    ma25: true,
    ma99: true,
  });

  const fetchHistoricalKlines = async () => {
    const endpoint =
      market === 'futures'
        ? 'https://fapi.binance.com/fapi/v1/klines'
        : 'https://api.binance.com/api/v3/klines';

    const url = `${endpoint}?symbol=${selectedSymbol.toUpperCase()}&interval=${selectedInterval}&limit=500`;
    const res = await fetch(url);
    const data = await res.json();

    const formatted = data.map((d: any) => ({
      time: d[0] / 1000,
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
    }));

    const volumes = data.map((d: any) => ({
      time: d[0] / 1000,
      value: parseFloat(d[5]),
      color: parseFloat(d[1]) > parseFloat(d[4]) ? '#ef5350' : '#26a69a',
    }));

    candleSeries.current?.setData(formatted);
    volumeSeries.current?.setData(volumes);

    if (formatted.length >= 99) {
      ma7Ref.current?.setData(calculateMA(formatted, 7));
      ma25Ref.current?.setData(calculateMA(formatted, 25));
      ma99Ref.current?.setData(calculateMA(formatted, 99));
    }

    setCandles(formatted);
  };
useEffect(() => {
  const raw = localStorage.getItem('positions');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setFloatingPosition(parsed[0]); // chỉ hiện 1 vị thế đầu tiên
      }
    } catch {}
  }
}, []);
  

  useEffect(() => {
    const mainContainer = mainChartContainer.current;
    const volumeContainer = volumeChartContainer.current;
    if (!mainContainer || !volumeContainer) return;

    // CHART
    mainChartRef.current = createChart(mainContainer, {
      layout: { background: { type: ColorType.Solid, color: '#181a20' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#2b2b43' }, horzLines: { color: '#2b2b43' } },
      height: 570,
      width: mainContainer.clientWidth,
      timeScale: { borderVisible: false, visible: true },
      rightPriceScale: { visible: true },
      crosshair: { mode: 1 },
    });

    candleSeries.current = mainChartRef.current.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
let positionLine: any = null;
if (position && candleSeries.current) {
  const entry = parseFloat(position.entryPrice || '0');
  const amt = parseFloat(position.positionAmt || '0');

  if (entry !== 0 && amt !== 0) {
    positionLine = candleSeries.current.createPriceLine({
      price: entry,
      color: amt > 0 ? '#0ecb81' : '#f6465d', // xanh nếu LONG, đỏ nếu SHORT
      lineWidth: 1,
      lineStyle: 2, // dashed
      axisLabelVisible: true,
      title: 'Entry',
    });
  }
}
    ma7Ref.current = mainChartRef.current.addLineSeries({
  color: '#f0b90b',
  lineWidth: 1,
  priceLineVisible: false,     // ẩn line nhỏ bám giá
  lastValueVisible: false,     // ⛔ ẩn giá bên phải
});

ma25Ref.current = mainChartRef.current.addLineSeries({
  color: '#eb40b5',
  lineWidth: 1,
  priceLineVisible: false,
  lastValueVisible: false,
});

ma99Ref.current = mainChartRef.current.addLineSeries({
  color: '#b385f8',
  lineWidth: 1,
  priceLineVisible: false,
  lastValueVisible: false,
});

    // Áp dụng trạng thái ẩn/hiện
    ma7Ref.current.applyOptions({ visible: maVisible.ma7 });
    ma25Ref.current.applyOptions({ visible: maVisible.ma25 });
    ma99Ref.current.applyOptions({ visible: maVisible.ma99 });

    // VOLUME
    volumeChartRef.current = createChart(volumeContainer, {
      layout: { background: { type: ColorType.Solid, color: '#181a20' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#2b2b43' }, horzLines: { color: '#2b2b43' } },
      height: 120,
      width: volumeContainer.clientWidth,
      timeScale: { visible: true, borderVisible: false },
      crosshair: { mode: 1 },
      rightPriceScale: { visible: true },
    });

    volumeSeries.current = volumeChartRef.current.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
    });

    // Sync
    const timeScale = mainChartRef.current.timeScale();
    const volTimeScale = volumeChartRef.current.timeScale();
    timeScale.subscribeVisibleTimeRangeChange((range) => volTimeScale.setVisibleRange(range));

    fetchHistoricalKlines();

    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${selectedSymbol.toLowerCase()}@kline_${selectedInterval}`);
    ws.onmessage = (event) => {
      const msg: KlineMessage = JSON.parse(event.data);
      const k = msg.k;
      const candle = {
        time: k.t / 1000,
        open: +k.o,
        high: +k.h,
        low: +k.l,
        close: +k.c,
      };
      const volume = {
        time: k.t / 1000,
        value: +k.v,
        color: +k.o > +k.c ? '#ef5350' : '#26a69a',
      };

      candleSeries.current?.update(candle);
      volumeSeries.current?.update(volume);

      setCandles((prev) => {
        const exists = prev.find((c) => c.time === candle.time);
        let updated = exists
          ? prev.map((c) => (c.time === candle.time ? candle : c))
          : [...prev, candle];
        if (updated.length > 500) updated = updated.slice(-500);

        if (updated.length >= 99) {
          ma7Ref.current?.setData(calculateMA(updated, 7));
          ma25Ref.current?.setData(calculateMA(updated, 25));
          ma99Ref.current?.setData(calculateMA(updated, 99));
        }

        return updated;
      });
    };

    return () => {
      ws.close();
      mainChartRef.current?.remove();
      volumeChartRef.current?.remove();
    };
    
  }, [selectedSymbol, selectedInterval, market]);

  const handleToggleAllMA = () => {
    const next = !(maVisible.ma7 || maVisible.ma25 || maVisible.ma99);
    setMaVisible({ ma7: next, ma25: next, ma99: next });
    ma7Ref.current?.applyOptions({ visible: next });
    ma25Ref.current?.applyOptions({ visible: next });
    ma99Ref.current?.applyOptions({ visible: next });
  };

  const maValues = [
  maVisible.ma7 && {
    period: 7,
    value: candles.length ? candles[candles.length - 1].close : 0,
    color: '#f0b90b',
  },
  maVisible.ma25 && {
    period: 25,
    value: candles.length ? candles[candles.length - 1].close : 0,
    color: '#eb40b5',
  },
  maVisible.ma99 && {
    period: 99,
    value: candles.length ? candles[candles.length - 1].close : 0,
    color: '#b385f8',
  },
].filter(Boolean);

  return (
    <div className="flex flex-col h-full w-full">
      <div ref={mainChartContainer} className="flex-1 w-full relative">
        {maHeaderVisible && (
          <MAHeader
            maValues={maValues}
            visible={maVisible.ma7 || maVisible.ma25 || maVisible.ma99}
            onToggleVisible={handleToggleAllMA}
            onOpenSetting={() => setShowMASettings(true)}
            onClose={() => {
              setMaHeaderVisible(false);
              setMaVisible({ ma7: false, ma25: false, ma99: false });
              ma7Ref.current?.applyOptions({ visible: false });
              ma25Ref.current?.applyOptions({ visible: false });
              ma99Ref.current?.applyOptions({ visible: false });
            }}
          />
        )}
        {showMASettings && (
  <MASettings
    visibleSettings={maVisible}
    onChange={(nextVisible) => {
      setMaVisible(nextVisible);
      ma7Ref.current?.applyOptions({ visible: nextVisible.ma7 });
      ma25Ref.current?.applyOptions({ visible: nextVisible.ma25 });
      ma99Ref.current?.applyOptions({ visible: nextVisible.ma99 });
    }}
    onClose={() => setShowMASettings(false)}
  />
)}
{/* <FloatingPositionTag
  position={floatingPosition}
  visible={showFloatingPnL}
/>*/}
      </div>


      <div className="h-[1px] bg-dark-400" />
      <div ref={volumeChartContainer} className="h-[100px] w-full" />
    </div>
  );
};

export default TradingBinance;

// Helpers
function calculateMA(data: CandlestickData<Time>[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const avg = slice.reduce((acc, val) => acc + (val.close || 0), 0) / period;
    if (!isNaN(avg)) {
      result.push({ time: data[i].time, value: +avg.toFixed(5) });
    }
  }
  return result;
}

function calculateLastMA(data: CandlestickData<Time>[], period: number): number {
  if (data.length < period) return 0;
  const slice = data.slice(-period);
  const sum = slice.reduce((acc, val) => acc + (val.close || 0), 0);
  return +(sum / period).toFixed(5);
}
