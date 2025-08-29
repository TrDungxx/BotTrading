// TVChartBinance.tsx
import React, { useEffect, useRef } from "react";
import {
  createChart, ColorType, IChartApi,
  CandlestickData, HistogramData, UTCTimestamp, ISeriesApi,
} from "lightweight-charts";

type Kline = { open:number; high:number; low:number; close:number; volume:number; start:number; };

export type TVReadyCtx = {
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  containerRef: React.RefObject<HTMLDivElement>;
};

type TF = string;

interface TVChartProps {
  symbol?: string;
  interval?: TF;
  market?: "spot" | "futures";
  onKline?: (k: Kline) => void;
  onReady?: (ctx: TVReadyCtx) => void;
  onPickPrice?: (p: { price: number; x: number; y: number }) => void;
}

const TVChartBinance: React.FC<TVChartProps> = ({
  symbol = "ETHUSDT",
  interval = "1h",
  market = "spot",
  onKline,
  onReady,
  onPickPrice,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ReturnType<IChartApi["addCandlestickSeries"]> | null>(null);
  const volumeSeriesRef = useRef<ReturnType<IChartApi["addHistogramSeries"]> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const resizeObs = useRef<ResizeObserver | null>(null);

  // NEW: giữ callback bằng ref để không tạo lại chart vì đổi identity
  const onKlineRef = React.useRef(onKline);
const onReadyRef = React.useRef(onReady);
const onPickRef  = React.useRef(onPickPrice);
React.useEffect(()=>{ onKlineRef.current = onKline; }, [onKline]);
React.useEffect(()=>{ onReadyRef.current = onReady; }, [onReady]);
React.useEffect(()=>{ onPickRef.current  = onPickPrice; }, [onPickPrice]);

  const restHost = market === "futures" ? "https://fapi.binance.com" : "https://api.binance.com";
  const restPath = market === "futures" ? "/fapi/v1/klines" : "/api/v3/klines";
  const wsBase  = market === "futures" ? "wss://fstream.binance.com/ws" : "wss://stream.binance.com:9443/ws";
  const toTs = (ms: number) => (ms / 1000) as UTCTimestamp;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // create chart
    const chart = createChart(el, {
      layout: { background: { type: ColorType.Solid, color: "#181a20" }, textColor: "#d1d4dc" },
      grid: { vertLines: { color: "#2b2b43" }, horzLines: { color: "#2b2b43" } },
      width: el.clientWidth,
      height: el.clientHeight,
      timeScale: { borderVisible: false },
      rightPriceScale: { visible: true, borderVisible: false, minimumWidth: 64 },
      crosshair: { mode: 1 },
    });
    chartRef.current = chart;

    const candle = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });
    candleSeriesRef.current = candle;

    const volume = chart.addHistogramSeries({
      color: "#26a69a",
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    volumeSeriesRef.current = volume;

    // expose cho overlay
    onReadyRef.current?.({ chart, series: candle, containerRef });

    // resize observer (throttle bằng rAF)
    let raf = 0;
    const ro = new ResizeObserver((entries) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const { width, height } = entries[0].contentRect;
        if (width <= 0 || height <= 0) return;
        chart.applyOptions({ width, height });
      });
    });
    ro.observe(el);
    resizeObs.current = ro;

    // fetch history
    const ctrl = new AbortController();
    fetch(`${restHost}${restPath}?symbol=${symbol}&interval=${interval}&limit=500`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        const candles: CandlestickData[] = data.map((d: any) => ({
          time: toTs(d[0]), open:+d[1], high:+d[2], low:+d[3], close:+d[4],
        }));
        const volumes: HistogramData[] = data.map((d: any) => ({
          time: toTs(d[0]), value:+d[5], color: +d[4] >= +d[1] ? "#26a69a" : "#ef5350",
        }));
        candle.setData(candles);
        volume.setData(volumes);

        const last = data[data.length - 1];
        if (last) onKlineRef.current?.({ open:+last[1], high:+last[2], low:+last[3], close:+last[4], volume:+last[5], start:last[0] });
      })
      .catch(() => {});

    // websocket
    const ws = new WebSocket(`${wsBase}/${symbol.toLowerCase()}@kline_${interval}`);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      const k = JSON.parse(ev.data)?.k;
      if (!k) return;
      const t = (k.t / 1000) as UTCTimestamp;
      candle.update({ time: t, open:+k.o, high:+k.h, low:+k.l, close:+k.c });
      volume.update({ time: t, value:+k.v, color: +k.c >= +k.o ? "#26a69a" : "#ef5350" });
      onKlineRef.current?.({ open:+k.o, high:+k.h, low:+k.l, close:+k.c, volume:+k.v, start:k.t });
    };

    // right‑click pick price
    const onCtxMenu = (e: MouseEvent) => {
      const s = candleSeriesRef.current;
      if (!s || !onPickRef.current) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const localY = e.clientY - rect.top;
      const localX = e.clientX - rect.left;
      const price = s.coordinateToPrice(localY);
      if (typeof price === "number" && Number.isFinite(price)) {
        onPickRef.current({ price, x: localX, y: localY });
      }
    };
    el.addEventListener("contextmenu", onCtxMenu);

    // cleanup
    return () => {
      try { ctrl.abort(); } catch {}
      try { ws.close(); } catch {}
      try { ro.disconnect(); } catch {}
      el.removeEventListener("contextmenu", onCtxMenu);
      cancelAnimationFrame(raf);
      try { chart.remove(); } catch {}
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      wsRef.current = null;
      resizeObs.current = null;
    };
    // 🔴 CHỈ phụ thuộc vào các giá trị thật sự cần re‑init
  }, [symbol, interval, market]);

  return <div ref={containerRef} className="w-full h-full relative" />;
};

export default TVChartBinance;
