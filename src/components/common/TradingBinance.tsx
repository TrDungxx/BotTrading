import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  Time,
  CandlestickData,
  HistogramData,
  LineData,
  ColorType,
  UTCTimestamp,
  ISeriesApi,
} from 'lightweight-charts';
import MAHeader from './popupchart/MAHeader';
import MASettings from './popupchart/MASetting';
import FloatingPositionTag from '../tabposition/FloatingPositionTag';
import { binanceWS } from '../binancewebsocket/BinanceWebSocketService';
import ToolTpSl from './popupchart/ToolTpSl';
import ToolMini from './popupchart/ToolMini';

type Candle = CandlestickData<UTCTimestamp>;
type VolumeBar = HistogramData<UTCTimestamp>;
type KlineMessage = {
  k: { t: number; o: string; h: string; l: string; c: string; v: string; x?: boolean };
};
type PositionForTag = {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice?: string;
};

interface Props {
  selectedSymbol: string;
  selectedInterval: string;
  market: 'spot' | 'futures';
  floating?: { pnl: number; roi: number; price: number; positionAmt: number } | null;
  showPositionTag?: boolean;
}

const toTs = (ms: number) => Math.floor(ms / 1000) as UTCTimestamp;

function calculateMA(data: CandlestickData<Time>[], period: number): LineData<Time>[] {
  const out: LineData<Time>[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j].close || 0;
    const avg = sum / period;
    if (!Number.isNaN(avg)) out.push({ time: data[i].time, value: +avg.toFixed(5) });
  }
  return out;
}

const TradingBinance: React.FC<Props> = ({
  selectedSymbol,
  selectedInterval,
  market,
  floating,
  showPositionTag = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const candleSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeries = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ma7Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma25Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma99Ref = useRef<ISeriesApi<'Line'> | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const sessionRef = useRef(0);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const lastSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const [floatingPos, setFloatingPos] = useState<PositionForTag | undefined>(undefined);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [maHeaderVisible, setMaHeaderVisible] = useState(true);
  const [showMASettings, setShowMASettings] = useState(false);
  const [maVisible, setMaVisible] = useState({ ma7: true, ma25: true, ma99: true });
  
//tool tplsl
const [tpSlEnabled, setTpSlEnabled] = useState(false);
const lastCandleTime = (candles.at(-1)?.time ?? null) as UTCTimestamp | null;
// lấy lastPrice từ cây nến cuối
const lastPrice: number | null = candles.length ? candles[candles.length - 1].close : null;

// suy ra side từ vị thế hiện tại (dương = LONG, âm = SHORT). Không có vị thế thì mặc định LONG.
const positionSide: 'LONG' | 'SHORT' =
  parseFloat(floatingPos?.positionAmt ?? '0') < 0 ? 'SHORT' : 'LONG';

  // --- chỉ khởi tạo chart 1 lần
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: { background: { type: ColorType.Solid, color: '#181a20' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#2b2b43' }, horzLines: { color: '#2b2b43' } },
      width: el.clientWidth,
      height: el.clientHeight,
      timeScale: { borderVisible: false },
      rightPriceScale: { visible: true },
      crosshair: { mode: 1 },
    });
    chartRef.current = chart;

    candleSeries.current = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    ma7Ref.current = chart.addLineSeries({
      color: '#f0b90b',
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: maVisible.ma7,
    });
    ma25Ref.current = chart.addLineSeries({
      color: '#eb40b5',
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: maVisible.ma25,
    });
    ma99Ref.current = chart.addLineSeries({
      color: '#b385f8',
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: maVisible.ma99,
    });

    volumeSeries.current = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.current.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const ro = new ResizeObserver(() => {
      const { clientWidth: w, clientHeight: h } = el;
      const { w: lw, h: lh } = lastSizeRef.current;
      if (w !== lw || h !== lh) {
        chart.applyOptions({ width: w, height: h });
        lastSizeRef.current = { w, h };
      }
    });
    ro.observe(el);
    resizeObsRef.current = ro;
    lastSizeRef.current = { w: el.clientWidth, h: el.clientHeight };

    return () => {
      try { resizeObsRef.current?.disconnect(); } catch {}
      try { wsRef.current?.close(); } catch {}
      chart.remove();
      chartRef.current = null;
      candleSeries.current = null;
      volumeSeries.current = null;
      ma7Ref.current = null;
      ma25Ref.current = null;
      ma99Ref.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // NOTE: mount once

  // --- chọn position để hiển thị phao
  const pickPos = (list: any[]) => {
    const pos = list.find(
      (p) => (p.symbol || p.s) === selectedSymbol && parseFloat((p.positionAmt ?? p.pa) || '0') !== 0,
    );
    if (!pos) {
      setFloatingPos(undefined);
      return;
    }
    setFloatingPos({
      symbol: pos.symbol ?? pos.s,
      positionAmt: (pos.positionAmt ?? pos.pa) || '0',
      entryPrice: (pos.entryPrice ?? pos.ep) || '0',
      markPrice: pos.markPrice ?? pos.mp,
    });
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('positions');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) pickPos(arr);
      } else {
        setFloatingPos(undefined);
      }
    } catch {}
  }, [selectedSymbol]);

  useEffect(() => {
    const handler = (msg: any) => {
      if (Array.isArray(msg) && msg[0]?.symbol && msg[0]?.positionAmt !== undefined) {
        pickPos(msg);
        return;
      }
      if (msg?.a?.P && Array.isArray(msg.a.P)) {
        pickPos(msg.a.P);
        return;
      }
    };
    binanceWS.onMessage(handler);
    return () => binanceWS.removeMessageHandler(handler);
  }, [selectedSymbol]);

  // --- load lịch sử + subscribe WS khi đổi symbol/interval/market (KHÔNG tái tạo chart)
  useEffect(() => {
    if (!candleSeries.current || !volumeSeries.current || !chartRef.current) return;

    // tăng session để vô hiệu hóa update muộn
    const mySession = ++sessionRef.current;

    // đóng WS cũ (nếu còn)
    try { wsRef.current?.close(); } catch {}

    const restBase = market === 'futures' ? 'https://fapi.binance.com' : 'https://api.binance.com';
    const wsBase = market === 'futures' ? 'wss://fstream.binance.com/ws' : 'wss://stream.binance.com:9443/ws';

    const controller = new AbortController();

    const loadHistory = async () => {
      const path = market === 'futures' ? '/fapi/v1/klines' : '/api/v3/klines';
      const url = `${restBase}${path}?symbol=${selectedSymbol.toUpperCase()}&interval=${selectedInterval}&limit=500`;
      const res = await fetch(url, { signal: controller.signal });
      const data = await res.json();

      if (sessionRef.current !== mySession) return; // đã đổi symbol khác

      const cs: Candle[] = data.map((d: any) => ({
        time: toTs(d[0]),
        open: +d[1],
        high: +d[2],
        low: +d[3],
        close: +d[4],
      }));

      const vs: VolumeBar[] = data.map((d: any) => ({
        time: toTs(d[0]),
        value: +d[5],
        color: +d[4] >= +d[1] ? '#26a69a' : '#ef5350',
      }));

      candleSeries.current!.setData(cs);
      volumeSeries.current!.setData(vs);
      chartRef.current!.timeScale().fitContent();

      if (cs.length >= 7 && ma7Ref.current) ma7Ref.current.setData(calculateMA(cs, 7));
      if (cs.length >= 25 && ma25Ref.current) ma25Ref.current.setData(calculateMA(cs, 25));
      if (cs.length >= 99 && ma99Ref.current) ma99Ref.current.setData(calculateMA(cs, 99));

      setCandles(cs);

      // mở WS mới sau khi đã có lịch sử
      const ws = new WebSocket(`${wsBase}/${selectedSymbol.toLowerCase()}@kline_${selectedInterval}`);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        if (sessionRef.current !== mySession) return;
        const parsed = JSON.parse(ev.data) as KlineMessage;
        const k = parsed.k;
        const t = toTs(k.t);

        const candle: Candle = { time: t, open: +k.o, high: +k.h, low: +k.l, close: +k.c };
        candleSeries.current?.update(candle);

        const vol: VolumeBar = { time: t, value: +k.v, color: +k.c >= +k.o ? '#26a69a' : '#ef5350' };
        volumeSeries.current?.update(vol);

        // cập nhật MA khi đủ dữ liệu (setData 3 series: nhẹ với 500 điểm, không gây flicker)
        setCandles((prev) => {
          if (sessionRef.current !== mySession) return prev;
          const i = prev.findIndex((c) => c.time === candle.time);
          const next = i >= 0 ? [...prev.slice(0, i), candle, ...prev.slice(i + 1)] : [...prev, candle];
          if (next.length > 500) next.shift();

          if (next.length >= 7 && ma7Ref.current) ma7Ref.current.setData(calculateMA(next, 7));
          if (next.length >= 25 && ma25Ref.current) ma25Ref.current.setData(calculateMA(next, 25));
          if (next.length >= 99 && ma99Ref.current) ma99Ref.current.setData(calculateMA(next, 99));

          return next;
        });
      };

      ws.onerror = () => {
        // tránh spam, có thể thêm retry nếu cần
      };
    };

    loadHistory().catch(() => {});

    return () => {
      controller.abort();
      // chỉ đóng nếu vẫn là WS của phiên này
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
    };
  }, [selectedSymbol, selectedInterval, market]);

  const toggleAllMA = () => {
    const next = !(maVisible.ma7 || maVisible.ma25 || maVisible.ma99);
    setMaVisible({ ma7: next, ma25: next, ma99: next });
    ma7Ref.current?.applyOptions({ visible: next });
    ma25Ref.current?.applyOptions({ visible: next });
    ma99Ref.current?.applyOptions({ visible: next });
  };

  const maValues = [
    maVisible.ma7 && { period: 7, value: candles.at(-1)?.close ?? 0, color: '#f0b90b' },
    maVisible.ma25 && { period: 25, value: candles.at(-1)?.close ?? 0, color: '#eb40b5' },
    maVisible.ma99 && { period: 99, value: candles.at(-1)?.close ?? 0, color: '#b385f8' },
  ].filter(Boolean) as { period: number; value: number; color: string }[];

  return (
    <div className="h-full w-full min-w-0 relative">
      {maHeaderVisible && (
        <MAHeader
          maValues={maValues}
          visible={maVisible.ma7 || maVisible.ma25 || maVisible.ma99}
          onToggleVisible={toggleAllMA}
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
          onChange={(v) => {
            setMaVisible(v);
            ma7Ref.current?.applyOptions({ visible: v.ma7 });
            ma25Ref.current?.applyOptions({ visible: v.ma25 });
            ma99Ref.current?.applyOptions({ visible: v.ma99 });
          }}
          onClose={() => setShowMASettings(false)}
        />
      )}
      {/* Mini header Tool – ngay dưới MAHeader */}
<ToolMini
  chart={chartRef.current}
  series={candleSeries.current}
  containerEl={containerRef.current}
  lastPrice={candles.length ? candles[candles.length - 1].close : null}
  lastCandleTime={lastCandleTime}
  positionSide={parseFloat(floatingPos?.positionAmt ?? '0') < 0 ? 'SHORT' : 'LONG'}
  topOffsetClass="top-10"
  onTrigger={(type, price) => {
    console.log('[TP/SL trigger]', type, price);
    // gửi lệnh reduceOnly MARKET nếu bạn muốn
  }}
/>


      {/* Phao PnL */}
      <FloatingPositionTag
        visible={!!floating && showPositionTag}
        price={floating?.price ?? 0}
        positionAmt={floating?.positionAmt ?? 0}
        pnl={floating?.pnl ?? 0}
        roi={floating?.roi ?? 0}
        series={candleSeries.current ?? undefined}
        containerRef={containerRef}
        offset={12}
      />

      <div ref={containerRef} className="w-full h-full min-h-0 min-w-0" />
    </div>
  );
};

export default TradingBinance;
