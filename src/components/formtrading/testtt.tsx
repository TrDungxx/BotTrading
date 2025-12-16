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
import ToolMini from './popupchart/ToolMini';
import { copyPrice } from '../clickchart/CopyPrice';
import { addHLine, clearAllHLines, getAllLinePrices } from '../clickchart/hline';
import AlertModal from '../clickchart/AlertModal';
import NewOrderModal from '../clickchart/NewOrderModal';

export type ChartType = 
  | 'Bars'
  | 'Candles'
  | 'Hollow candles'
  | 'Line'
  | 'Line with markers'
  | 'Step line'
  | 'Area'
  | 'HLC area'
  | 'Baseline'
  | 'Columns'
  | 'High-low';

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
  market: "spot" | "futures";
  floating?: { pnl: number; roi: number; price: number; positionAmt: number } | null;
  showPositionTag?: boolean;
  onRequestSymbolChange?: (symbol: string) => void;
  chartType?: ChartType;
  onChartTypeChange?: (t: ChartType) => void;
}

const toTs = (ms: number) => Math.floor(ms / 1000) as UTCTimestamp;

/* ============================
   MAs
   ============================ */
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

/* ============================
   AUTO TICK-SIZE / PRECISION
   ============================ */
type SymbolMeta = {
  tickSize: number;
  stepSize?: number;
  precision: number;
};
const symbolMetaCache = new Map<string, SymbolMeta>();

const countDecimals = (n: number) => {
  const s = n.toString();
  if (s.includes('e-')) return parseInt(s.split('e-')[1], 10);
  return s.split('.')[1]?.length ?? 0;
};

async function getSymbolMeta(symbol: string, market: 'spot' | 'futures'): Promise<SymbolMeta> {
  const key = `${market}:${symbol.toUpperCase()}`;
  const cached = symbolMetaCache.get(key);
  if (cached) return cached;

  const base =
    market === 'futures'
      ? 'https://fapi.binance.com/fapi/v1/exchangeInfo'
      : 'https://api.binance.com/api/v3/exchangeInfo';

  const res = await fetch(`${base}?symbol=${symbol.toUpperCase()}`);
  const json = await res.json();
  const info = json?.symbols?.[0];
  if (!info) throw new Error('exchangeInfo not found');

  const PRICE_FILTER = (info.filters || []).find((f: any) => f.filterType === 'PRICE_FILTER');
  const LOT_FILTER = (info.filters || []).find((f: any) =>
    ['MARKET_LOT_SIZE', 'LOT_SIZE'].includes(f.filterType),
  );

  const tickSize = Number(PRICE_FILTER?.tickSize ?? '0.01') || 0.01;
  const stepSize = Number(LOT_FILTER?.stepSize ?? '0.00000001') || 0.00000001;
  const precision = Math.max(countDecimals(tickSize), 0);

  const meta: SymbolMeta = { tickSize, stepSize, precision };
  symbolMetaCache.set(key, meta);
  return meta;
}

function heuristicMetaFromPrice(lastPrice?: number): SymbolMeta {
  const p = lastPrice ?? 1;
  let tick = 0.01;
  let precision = 2;

  if (p >= 1000) {
    tick = 10;
    precision = 0;
  } else if (p >= 100) {
    tick = 1;
    precision = 0;
  } else if (p >= 10) {
    tick = 0.1;
    precision = 1;
  } else if (p >= 1) {
    tick = 0.01;
    precision = 2;
  } else if (p >= 0.1) {
    tick = 0.0001;
    precision = 4;
  } else {
    tick = 0.00001;
    precision = 5;
  }

  return { tickSize: tick, precision };
}

const hlineKey = (symbol: string, market: 'spot' | 'futures') =>
  `tw_hlines_${market}_${symbol.toUpperCase()}`;

const TradingBinance: React.FC<Props> = ({
   selectedSymbol,
  selectedInterval,
  market,
  floating,
  showPositionTag,
  onRequestSymbolChange,
  chartType: controlledChartType,
  onChartTypeChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mainChartContainerRef = useRef<HTMLDivElement | null>(null);
  const volumeChartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const volumeChartRef = useRef<IChartApi | null>(null);
  const [innerChartType, setInnerChartType] = useState<ChartType>("Candles");
const chartType = controlledChartType ?? innerChartType;
const setChartType = (t: ChartType) => {
    if (onChartTypeChange) onChartTypeChange(t);
    else setInnerChartType(t);
  };
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

  const [ctxOpen, setCtxOpen] = useState(false);
  const [ctxPos, setCtxPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [ctxSubOpen, setCtxSubOpen] = useState(false);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<UTCTimestamp | null>(null);
  const ctxOpenRef = useRef(false);
  const ctxClickYRef = useRef<number | null>(null);
  const ctxClickPriceRef = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
type PresetType = 'LIMIT' | 'STOP';
  const [orderOpen, setOrderOpen] = useState(false);
const [orderSeedPrice, setOrderSeedPrice] = useState<number | null>(null);
const [orderPresetType, setOrderPresetType] = useState<PresetType>('LIMIT');
const snapToTick = (price: number) => {
  const cacheKey = `${market}:${selectedSymbol.toUpperCase()}`;
  const meta = symbolMetaCache.get(cacheKey) ?? heuristicMetaFromPrice(price);

  let tick = meta.tickSize ?? heuristicMetaFromPrice(price).tickSize;

  if (price < 10 && tick >= 0.05) tick = heuristicMetaFromPrice(price).tickSize;

  const precision =
    Math.max(
      (String(tick).split('.')[1]?.length ?? 0),
      meta.precision ?? 0
    );
  return Number((Math.round(price / tick) * tick).toFixed(precision));
};
  const [alertOpen, setAlertOpen] = useState(false);

  const lastCandleTime = (candles.at(-1)?.time ?? null) as UTCTimestamp | null;

  const positionSide: 'LONG' | 'SHORT' =
    parseFloat(floatingPos?.positionAmt ?? '0') < 0 ? 'SHORT' : 'LONG';

    useEffect(() => {
  const chart = chartRef.current;
  if (!chart) return;

  if (candleSeries.current) {
    try { chart.removeSeries(candleSeries.current); } catch {}
    candleSeries.current = null as any;
  }

  switch (chartType) {
    case 'Candles':
      candleSeries.current = chart.addCandlestickSeries({
        upColor: '#0ECB81', downColor: '#F6465D',
        borderUpColor: '#0ECB81', borderDownColor: '#F6465D',
        wickUpColor: '#0ECB81', wickDownColor: '#F6465D',
        borderVisible: false, priceScaleId: 'right',
        lastValueVisible: true, priceLineVisible: true,
      });
      break;

    case 'Hollow candles':
      candleSeries.current = chart.addCandlestickSeries({
        upColor: 'transparent', downColor: '#F6465D',
        borderUpColor: '#0ECB81', borderDownColor: '#F6465D',
        wickUpColor: '#0ECB81', wickDownColor: '#F6465D',
        borderVisible: true, priceScaleId: 'right',
        lastValueVisible: true, priceLineVisible: true,
      });
      break;

    case 'Line': {
      const s = chart.addLineSeries({ 
        priceScaleId: 'right',
        color: '#2962FF',
        lineWidth: 2,
      });
      candleSeries.current = s as unknown as ISeriesApi<'Candlestick'>;
      break;
    }

    case 'Line with markers': {
      const s = chart.addLineSeries({ 
        priceScaleId: 'right',
        color: '#2962FF',
        lineWidth: 2,
        lastValueVisible: true,
        priceLineVisible: true,
      });
      candleSeries.current = s as unknown as ISeriesApi<'Candlestick'>;
      break;
    }

    case 'Area': {
      const s = chart.addAreaSeries({
        priceScaleId: 'right',
        lineColor: '#2962FF',
        topColor: 'rgba(41,98,255,0.35)',
        bottomColor: 'rgba(41,98,255,0.00)',
      });
      candleSeries.current = s as unknown as ISeriesApi<'Candlestick'>;
      break;
    }

    case 'HLC area': {
      const s = chart.addAreaSeries({
        priceScaleId: 'right',
        lineColor: '#2962FF',
        topColor: 'rgba(41,98,255,0.25)',
        bottomColor: 'rgba(41,98,255,0.00)',
        lineWidth: 2,
      });
      candleSeries.current = s as unknown as ISeriesApi<'Candlestick'>;
      break;
    }

    case 'Baseline': {
      const s = chart.addBaselineSeries({
        priceScaleId: 'right',
        topLineColor: '#0ECB81',
        topFillColor1: 'rgba(14,203,129,0.28)',
        topFillColor2: 'rgba(14,203,129,0.05)',
        bottomLineColor: '#F6465D',
        bottomFillColor1: 'rgba(246,70,93,0.05)',
        bottomFillColor2: 'rgba(246,70,93,0.28)',
      });
      candleSeries.current = s as unknown as ISeriesApi<'Candlestick'>;
      break;
    }

    case 'Bars': {
      const s = chart.addBarSeries({
        priceScaleId: 'right', 
        upColor: '#0ECB81', 
        downColor: '#F6465D',
        thinBars: false,
      });
      candleSeries.current = s as unknown as ISeriesApi<'Candlestick'>;
      break;
    }

    case 'Columns': {
      const s = chart.addHistogramSeries({
        priceScaleId: 'right',
        color: '#2962FF',
      });
      candleSeries.current = s as unknown as ISeriesApi<'Candlestick'>;
      break;
    }

    case 'Step line': {
      const s = chart.addLineSeries({ 
        priceScaleId: 'right',
        color: '#2962FF',
        lineWidth: 2,
        lineStyle: 0,
      });
      candleSeries.current = s as unknown as ISeriesApi<'Candlestick'>;
      break;
    }

    case 'High-low': {
      const s = chart.addBarSeries({
        priceScaleId: 'right', 
        upColor: '#0ECB81', 
        downColor: '#F6465D',
        thinBars: true,
      });
      candleSeries.current = s as unknown as ISeriesApi<'Candlestick'>;
      break;
    }

    default:
      candleSeries.current = chart.addCandlestickSeries({ priceScaleId: 'right' });
  }

  if (candles.length && candleSeries.current) {
    const needsLineData = [
      'Line', 
      'Line with markers', 
      'Area', 
      'HLC area', 
      'Baseline',
      'Step line'
    ].includes(chartType);

    const needsHistogramData = chartType === 'Columns';

    const needsBarData = [
      'Bars', 
      'High-low'
    ].includes(chartType);

    if (needsLineData) {
      const lineData = candles.map(c => ({ time: c.time, value: c.close }));
      (candleSeries.current as unknown as ISeriesApi<'Line'>).setData(lineData as any);
    } else if (needsHistogramData) {
      const histData = candles.map(c => ({
        time: c.time,
        value: c.close,
        color: c.close >= c.open ? '#0ECB81' : '#F6465D'
      }));
      (candleSeries.current as unknown as ISeriesApi<'Histogram'>).setData(histData as any);
    } else if (needsBarData) {
      const barData = candles.map(c => ({ 
        time: c.time, 
        open: c.open, 
        high: c.high, 
        low: c.low, 
        close: c.close 
      }));
      (candleSeries.current as unknown as ISeriesApi<'Bar'>).setData(barData as any);
    } else {
      candleSeries.current.setData(candles);
    }

    try {
      const raw = localStorage.getItem(hlineKey(selectedSymbol, market));
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        clearAllHLines(candleSeries.current);
        arr.forEach((p: number) => addHLine(candleSeries.current!, p));
      }
    } catch {}

    updatePriceFormat(candles);
  }
}, [chartType, candles, selectedSymbol, market]);

    
function getDisplayStep(lastPrice: number | undefined, exchangeTick: number): { step: number; precision: number } {
  const p = Number.isFinite(lastPrice as number) ? (lastPrice as number) : 1;

  if (p >= 0.1 && p < 1) return { step: 0.01, precision: 2 };
  if (p < 0.1)          return { step: 0.001, precision: 3 };

  const step = Math.max(exchangeTick || 0.01, 0.01);
  const precision = Math.max(String(step).split('.')[1]?.length ?? 0, 2);
  return { step, precision: Math.min(precision, 8) };
}

const updatePriceFormat = async (candles: Candle[]) => {
  const chart = chartRef.current;
  const cs = candleSeries.current;
  
  if (!chart || !cs || candles.length === 0) {
    return;
  }

  const lastPrice = candles.at(-1)?.close;
  
  if (!lastPrice || !Number.isFinite(lastPrice) || lastPrice <= 0) {
    return;
  }

  let meta: SymbolMeta;
  try {
    meta = await getSymbolMeta(selectedSymbol, market);
  } catch {
    meta = heuristicMetaFromPrice(lastPrice);
  }

  let { tickSize, precision } = meta;

  if (lastPrice < 1) {
    if (lastPrice >= 0.1 && lastPrice < 1) {
      tickSize = 0.00005;
      precision = 4;
    } else if (lastPrice < 0.1) {
      tickSize = Math.min(tickSize, 0.00001);
      precision = 5;
    }
  } else if (lastPrice >= 1 && lastPrice < 10) {
    tickSize = Math.max(tickSize, 0.01);
    precision = Math.max(precision, 2);
  } else if (lastPrice >= 10 && lastPrice < 100) {
    tickSize = Math.max(tickSize, 0.1);
    precision = 1;
  } else if (lastPrice >= 100) {
    tickSize = Math.max(tickSize, 1);
    precision = 0;
  }

cs.applyOptions({ priceFormat: { type: 'price', minMove: tickSize, precision } });
ma7Ref.current?.applyOptions({ priceFormat: { type: 'price', minMove: tickSize, precision } });
ma25Ref.current?.applyOptions({ priceFormat: { type: 'price', minMove: tickSize, precision } });
ma99Ref.current?.applyOptions({ priceFormat: { type: 'price', minMove: tickSize, precision } });

const displayPrecision = Math.max(precision, 2);
chart.applyOptions({
  localization: {
    locale: 'vi-VN',
    priceFormatter: (p: number) => {
      const rounded = Math.round(p / tickSize) * tickSize;
      return rounded.toLocaleString('vi-VN', {
        minimumFractionDigits: displayPrecision,
        maximumFractionDigits: displayPrecision,
      });
    },
  },
});
};

  useEffect(() => {
    const mainEl = mainChartContainerRef.current;
    const volumeEl = volumeChartContainerRef.current;
    if (!mainEl || !volumeEl) return;

    // ============ MAIN CHART (Candles + MA) ============
    const mainChart = createChart(mainEl, {
      layout: {
        background: { type: ColorType.Solid, color: '#181A20' },
        textColor: '#a7b1b9ff',
      },
      grid: {
        vertLines: { color: '#363e49ff', style: 1, visible: true },
        horzLines: { color: '#363e49ff', style: 0, visible: true },
      },
      rightPriceScale: {
        visible: true,
        borderVisible: true,
        borderColor: '#2b3139',
        scaleMargins: { top: 0.08, bottom: 0.02 },
        autoScale: true,
        alignLabels: true,
        entireTextOnly: false,
        minimumWidth: 84,
        mode: 0,
        invertScale: false,
        ticksVisible: true,
      },
      timeScale: {
        borderColor: '#2b3139',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 8,
        minBarSpacing: 4,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: true,
        rightBarStaysOnScroll: true,
        shiftVisibleRangeOnNewBar: true,
        visible: false, // Ẩn time scale ở chart trên
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: '#6e859bff',
          width: 1,
          style: 3,
          labelBackgroundColor: '#363c4e',
          labelVisible: true,
        },
        horzLine: {
          color: '#758696',
          width: 1,
          style: 3,
          labelBackgroundColor: '#363c4e',
          labelVisible: true,
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
        axisDoubleClickReset: {
          time: true,
          price: true,
        },
      },
      kineticScroll: {
        mouse: true,
        touch: true,
      },
      width: mainEl.clientWidth,
      height: mainEl.clientHeight,
    });

    chartRef.current = mainChart;

    // ============ VOLUME CHART ============
    const volumeChart = createChart(volumeEl, {
      layout: {
        background: { type: ColorType.Solid, color: '#181A20' },
        textColor: '#a7b1b9ff',
      },
      grid: {
        vertLines: { color: '#363e49ff', style: 1, visible: true },
        horzLines: { color: 'transparent', style: 0, visible: false },
      },
      rightPriceScale: {
        visible: true,
        borderVisible: true,
        borderColor: '#2b3139',
        scaleMargins: { top: 0.1, bottom: 0.1 },
        autoScale: true,
        alignLabels: true,
        entireTextOnly: false,
        minimumWidth: 84,
      },
      timeScale: {
        borderColor: '#2b3139',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 8,
        minBarSpacing: 4,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: true,
        rightBarStaysOnScroll: true,
        shiftVisibleRangeOnNewBar: true,
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: '#6e859bff',
          width: 1,
          style: 3,
          labelBackgroundColor: '#363c4e',
          labelVisible: true,
        },
        horzLine: {
          color: 'transparent',
          width: 0,
          style: 3,
          labelBackgroundColor: '#363c4e',
          labelVisible: false,
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: {
          time: true,
          price: false, // Không cho scale volume theo giá
        },
        axisDoubleClickReset: {
          time: true,
          price: true,
        },
      },
      kineticScroll: {
        mouse: true,
        touch: true,
      },
      width: volumeEl.clientWidth,
      height: volumeEl.clientHeight,
    });

    volumeChartRef.current = volumeChart;

    // ============ ĐỒNG BỘ TIME SCALE ============
    const syncCharts = (sourceChart: IChartApi, targetChart: IChartApi) => {
      const sourceTimeScale = sourceChart.timeScale();
      const targetTimeScale = targetChart.timeScale();

      sourceTimeScale.subscribeVisibleLogicalRangeChange((logicalRange) => {
        if (logicalRange) {
          targetTimeScale.setVisibleLogicalRange(logicalRange);
        }
      });
    };

    // Đồng bộ 2 chiều
    syncCharts(mainChart, volumeChart);
    syncCharts(volumeChart, mainChart);

    // ============ ADD SERIES ============
    candleSeries.current = mainChart.addCandlestickSeries({
      upColor: '#0ECB81',
      downColor: '#F6465D',
      borderUpColor: '#0ECB81',
      borderDownColor: '#F6465D',
      wickUpColor: '#0ECB81',
      wickDownColor: '#F6465D',
      borderVisible: false,
      priceScaleId: 'right',
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: '#e0e3e8',
      priceLineStyle: 2,
      priceLineWidth: 1,
    });

    volumeSeries.current = volumeChart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'right',
      base: 0,
    });

    ma7Ref.current = mainChart.addLineSeries({
      color: '#F0B90B',
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    ma25Ref.current = mainChart.addLineSeries({
      color: '#EB40B5',
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    ma99Ref.current = mainChart.addLineSeries({
      color: '#B385F8',
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    // ============ RESIZE OBSERVER ============
    const ro = new ResizeObserver(() => {
      mainChart.applyOptions({ width: mainEl.clientWidth, height: mainEl.clientHeight });
      volumeChart.applyOptions({ width: volumeEl.clientWidth, height: volumeEl.clientHeight });
    });
    ro.observe(mainEl);
    ro.observe(volumeEl);
    resizeObsRef.current = ro;

    // ============ CROSSHAIR HANDLER ============
    const handleCrosshair = (param: any) => {
      if (ctxOpenRef.current) return;
      if (!param?.time || !candleSeries.current) {
        setHoverPrice(null);
        setHoverTime(null);
        return;
      }
      const series = candleSeries.current;
      const sp: any = (param as any).seriesPrices ?? (param as any).seriesData;
      if (!sp || typeof sp.get !== 'function') {
        setHoverPrice(null);
        setHoverTime(param.time as UTCTimestamp);
        return;
      }
      const p = sp.get(series) as number | undefined;
      setHoverPrice(Number.isFinite(p as number) ? (p as number) : null);
      setHoverTime(param.time as UTCTimestamp);
    };
    mainChart.subscribeCrosshairMove(handleCrosshair);

    // ============ CLEANUP ============
    return () => {
      mainChart.unsubscribeCrosshairMove(handleCrosshair);
      try {
        resizeObsRef.current?.disconnect();
      } catch {}
      try {
        wsRef.current?.close();
      } catch {}
      mainChart.remove();
      volumeChart.remove();
      chartRef.current = null;
      volumeChartRef.current = null;
      candleSeries.current = null;
      volumeSeries.current = null;
      ma7Ref.current = null;
      ma25Ref.current = null;
      ma99Ref.current = null;
    };
  }, []);

  function openCtxMenu(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();

    const host = mainChartContainerRef.current;
    const chart = chartRef.current;
    const series = candleSeries.current;
    if (!host) return;

    const rect = host.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    ctxClickYRef.current = clickY;
    if (series) {
      const pAtOpen = series.coordinateToPrice(clickY);
      ctxClickPriceRef.current =
        pAtOpen != null && Number.isFinite(pAtOpen as number) ? (pAtOpen as number) : null;
    } else {
      ctxClickPriceRef.current = null;
    }

    if (chart && series) {
      if (hoverPrice == null) {
        const priceAtY = series.coordinateToPrice(clickY);
        setHoverPrice(
          priceAtY != null && Number.isFinite(priceAtY as number) ? (priceAtY as number) : null,
        );
      }
      const timeAtX = chart.timeScale().coordinateToTime(clickX) as UTCTimestamp | null;
      setHoverTime(timeAtX ?? null);
    }

    const MENU_W = 280;
    const MENU_H = 380;
    let x = clickX,
      y = clickY;
    if (x + MENU_W > rect.width) x = Math.max(8, rect.width - MENU_W - 8);
    if (y + MENU_H > rect.height) y = Math.max(8, rect.height - MENU_H - 8);

    setCtxPos({ x, y });
    setCtxSubOpen(false);
    ctxOpenRef.current = true;
    setCtxOpen(true);
  }

  useEffect(() => {
    const onGlobalClose = (ev: Event) => {
      const path = (ev as any).composedPath?.() ?? [];
      if (menuRef.current && path.includes(menuRef.current)) return;
      ctxOpenRef.current = false;
      setCtxOpen(false);
    };

    if (ctxOpen) {
      window.addEventListener('click', onGlobalClose);
      window.addEventListener('contextmenu', onGlobalClose);
      window.addEventListener('resize', onGlobalClose);
      window.addEventListener('scroll', onGlobalClose, true);
    }
    return () => {
      window.removeEventListener('click', onGlobalClose);
      window.removeEventListener('contextmenu', onGlobalClose);
      window.removeEventListener('resize', onGlobalClose);
      window.removeEventListener('scroll', onGlobalClose, true);
    };
  }, [ctxOpen]);

  useEffect(() => {
    ctxOpenRef.current = ctxOpen;
  }, [ctxOpen]);

useEffect(() => {
  const chart = chartRef.current;
  const cs = candleSeries.current;
  
  if (!chart || !cs || candles.length === 0) return;

  const timer = setTimeout(async () => {
    let meta: SymbolMeta;
    try {
      meta = await getSymbolMeta(selectedSymbol, market);
    } catch {
      const last = candles.at(-1)?.close;
      meta = heuristicMetaFromPrice(last);
    }

    let { tickSize, precision } = meta;
    const lastPrice = candles.at(-1)?.close ?? 1;

    if (lastPrice >= 0.1 && lastPrice < 1) {
      tickSize = 0.00005;
      precision = 4;
    }

    cs.applyOptions({
      priceFormat: { type: 'price', minMove: tickSize, precision }
    });
  }, 300);

  return () => clearTimeout(timer);
}, [selectedSymbol, market, candles.length > 0]);

  const pickPos = (list: any[]) => {
    const pos = list.find(
      (p) =>
        (p.symbol || p.s) === selectedSymbol &&
        parseFloat((p.positionAmt ?? p.pa) || '0') !== 0,
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

useEffect(() => {
  setCandles([]);
}, [selectedSymbol, selectedInterval, market]);

useEffect(() => {
  if (!candleSeries.current || !volumeSeries.current || !chartRef.current) return;

  const mySession = ++sessionRef.current;
  try {
    wsRef.current?.close();
  } catch {}

  const restBase = market === 'futures' ? 'https://fapi.binance.com' : 'https://api.binance.com';
  const wsBase =
    market === 'futures' ? 'wss://fstream.binance.com/ws' : 'wss://stream.binance.com:9443/ws';

  const controller = new AbortController();

  const loadHistory = async () => {
    const path = market === 'futures' ? '/fapi/v1/klines' : '/api/v3/klines';
    const url = `${restBase}${path}?symbol=${selectedSymbol.toUpperCase()}&interval=${selectedInterval}&limit=500`;
    
    try {
      const res = await fetch(url, { signal: controller.signal });
      const data = await res.json();

      if (sessionRef.current !== mySession) return;

      const cs: Candle[] = data.map((d: any) => ({
        time: toTs(d[0]), open: +d[1], high: +d[2], low: +d[3], close: +d[4],
      }));
      const vs: VolumeBar[] = data.map((d: any) => ({
        time: toTs(d[0]), value: +d[5],
        color: +d[4] >= +d[1] ? '#0ECB81' : '#F6465D',
      }));

      candleSeries.current!.setData(cs);
      volumeSeries.current!.setData(vs);

      await updatePriceFormat(cs);

      // ✅ LOGIC: Hiển thị 50-100 nến tùy kích thước màn hình
      if (cs.length > 0) {
        setTimeout(() => {
          if (!chartRef.current || !volumeChartRef.current || sessionRef.current !== mySession) return;
          
          const containerWidth = mainChartContainerRef.current?.clientWidth || 800;
          
          // Tính số nến dựa trên width để nến dễ nhìn
          // Mỗi nến tối thiểu 8-12px để nhìn rõ hình dạng
          const minBarWidth = 8;  // Tối thiểu 8px/nến
          const maxBarWidth = 16; // Tối đa 16px/nến
          
          // Tính số nến tối đa có thể hiển thị với minBarWidth
          const maxCandles = Math.floor(containerWidth / minBarWidth);
          
          // Tính số nến tối thiểu cần với maxBarWidth
          const minCandles = Math.floor(containerWidth / maxBarWidth);
          
          // Clamp vào range 50-100, ưu tiên trong khoảng tính toán
          let targetVisible = Math.max(50, Math.min(100, 
            Math.floor((minCandles + maxCandles) / 2)
          ));
          
          // Đảm bảo không vượt quá số nến có
          const visibleCount = Math.min(targetVisible, cs.length);
          const startIdx = Math.max(0, cs.length - visibleCount);
          
          // Đặt visible range cho cả 2 charts
          const range = {
            from: cs[startIdx].time,
            to: cs[cs.length - 1].time,
          };
          chartRef.current.timeScale().setVisibleRange(range);
          volumeChartRef.current.timeScale().setVisibleRange(range);
          
          // Tính barSpacing để nến vừa vặn và dễ nhìn
          const optimalBarSpacing = Math.max(
            8,  // Tối thiểu 8px
            Math.min(
              16, // Tối đa 16px
              Math.floor(containerWidth / visibleCount * 0.85) // 85% để có khoảng trống
            )
          );
          
          const spacingOptions = {
            rightOffset: 6,
            barSpacing: optimalBarSpacing,
            minBarSpacing: 6,
          };
          
          // Apply spacing cho cả 2 charts ĐỒNG THỜI
          chartRef.current.timeScale().applyOptions(spacingOptions);
          volumeChartRef.current.timeScale().applyOptions(spacingOptions);
          
          console.log(`[InitialView] 📊 ${visibleCount}/${cs.length} nến (width=${containerWidth}px, spacing=${optimalBarSpacing}px)`);
        }, 100); // Delay 100ms để chart render xong
      }

      try {
        const raw = localStorage.getItem(hlineKey(selectedSymbol, market));
        const arr = raw ? (JSON.parse(raw) as number[]) : [];
        if (Array.isArray(arr) && candleSeries.current) {
          clearAllHLines(candleSeries.current);
          arr.forEach((p) => addHLine(candleSeries.current!, p));
        }
      } catch {}

      if (cs.length >= 7 && ma7Ref.current) ma7Ref.current.setData(calculateMA(cs, 7));
      if (cs.length >= 25 && ma25Ref.current) ma25Ref.current.setData(calculateMA(cs, 25));
      if (cs.length >= 99 && ma99Ref.current) ma99Ref.current.setData(calculateMA(cs, 99));

      setCandles(cs);

      const ws = new WebSocket(`${wsBase}/${selectedSymbol.toLowerCase()}@kline_${selectedInterval}`);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        if (sessionRef.current !== mySession) return;
        const parsed = JSON.parse(ev.data) as KlineMessage;
        const k = parsed.k;
        const t = toTs(k.t);

        const candle: Candle = { time: t, open: +k.o, high: +k.h, low: +k.l, close: +k.c };
        candleSeries.current?.update(candle);

        const vol: VolumeBar = { time: t, value: +k.v, color: +k.c >= +k.o ? '#0ECB81' : '#F6465D' };
        volumeSeries.current?.update(vol);

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

      ws.onerror = () => {};
    } catch (err) {
      console.error('[LoadHistory] Error:', err);
    }
  };

  loadHistory();

  return () => {
    try {
      if (candleSeries.current) {
        const prices = getAllLinePrices(candleSeries.current);
        localStorage.setItem(hlineKey(selectedSymbol, market), JSON.stringify(prices));
      }
    } catch {}

    controller.abort();
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
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

  useEffect(() => {
    const handler = (ev: any) => {
      const sym = ev?.detail?.symbol as string | undefined;
      if (!sym) return;
      if (sym !== selectedSymbol) {
        onRequestSymbolChange?.(sym);
        console.log('[Chart] switched to', sym);
      }
    };
    window.addEventListener('chart-symbol-change-request', handler);
    return () => window.removeEventListener('chart-symbol-change-request', handler);
  }, [selectedSymbol, onRequestSymbolChange]);

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

      {ctxOpen && (
        <div
          ref={menuRef}
          className="absolute z-50 rounded-2xl border border-dark-600 bg-dark-800/95 shadow-2xl backdrop-blur-md select-none"
          style={{ left: ctxPos.x, top: ctxPos.y, width: 280 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-2 text-fluid-sm text-dark-100">
            <button
  className="w-full px-fluid-4 py-2 text-left hover:bg-dark-700 flex items-center gap-3"
  onClick={() => {
    const base =
      ctxClickPriceRef.current ??
      hoverPrice ??
      candles.at(-1)?.close ??
      null;

    const snapped = base != null ? snapToTick(base) : null;

    setCtxOpen(false);
     setOrderPresetType('LIMIT');
    setOrderSeedPrice(snapped);
    setOrderOpen(true);
  }}
>
  Đặt lệnh mới
</button>

            <button
              className="w-full px-fluid-4 py-2 text-left hover:bg-dark-700 flex items-center gap-3"
              onClick={async () => {
                const ok = await copyPrice(hoverPrice);
                setCtxOpen(false);
                if (!ok) console.warn('[Copy] Không copy được giá');
              }}
            >
              Sao chép giá{' '}
              {hoverPrice != null
                ? hoverPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })
                : '--'}
            </button>

            <button
              className="w-full px-fluid-4 py-2 text-left hover:bg-dark-700 flex items-center justify-between"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();

                const series = candleSeries.current;

                let price: number | null = null;
                if (ctxClickPriceRef.current != null && Number.isFinite(ctxClickPriceRef.current)) {
                  price = ctxClickPriceRef.current;
                }
                if (price == null && hoverPrice != null && Number.isFinite(hoverPrice)) {
                  price = hoverPrice;
                }
                if (price == null) price = candles.at(-1)?.close ?? null;

                if (!series || price == null || !Number.isFinite(price)) {
                  console.warn('[HLINE] missing series/price after all fallbacks', {
                    seriesOk: !!series,
                    price,
                  });
                  setCtxOpen(false);
                  return;
                }

                const cacheKey = `${market}:${selectedSymbol.toUpperCase()}`;
                let tick =
                  symbolMetaCache.get(cacheKey)?.tickSize ??
                  heuristicMetaFromPrice(price).tickSize;

                if (price < 10 && tick >= 0.05) tick = heuristicMetaFromPrice(price).tickSize;

                const snapped = Math.round(price / tick) * tick;
                console.log('[HLINE] creating from menu', {
                  priceAtOpen: ctxClickPriceRef.current,
                  hoverPrice,
                  finalPrice: price,
                  tick,
                  snapped,
                });

                addHLine(series, snapped);

                try {
                  const k = hlineKey(selectedSymbol, market);
                  const raw = localStorage.getItem(k);
                  const arr: number[] = raw ? JSON.parse(raw) : [];
                  arr.push(snapped);
                  localStorage.setItem(k, JSON.stringify(arr));
                } catch {}

                addHLine(series, snapped);
setCtxOpen(false);
              }}
            >
              Vẽ đường kẻ ngang trên{' '}
              {hoverPrice != null
                ? hoverPrice.toLocaleString('vi-VN', {
                    minimumFractionDigits: hoverPrice >= 100 ? 2 : 4,
                    maximumFractionDigits: hoverPrice >= 100 ? 2 : 4,
                  })
                : '--'}
            </button>

            <div
              className="relative group"
              onMouseEnter={() => setCtxSubOpen(true)}
              onMouseLeave={() => setCtxSubOpen(false)}
            >
              <button className="w-full px-fluid-4 py-2 text-left hover:bg-dark-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="i-lucide-settings-2 shrink-0" /> Thêm cài đặt
                </div>
                <span className="i-lucide-chevron-right opacity-60" />
              </button>

              {ctxSubOpen && (
                <div className="absolute left-[calc(100%+6px)] top-0 min-w-[220px] rounded-xl border border-dark-600 bg-dark-800/95 shadow-xl p-1">
                  <button className="w-full px-fluid-3 py-2 text-left hover:bg-dark-700 rounded-lg">
                    Ẩn thanh công cụ
                  </button>
                  <button className="w-full px-fluid-3 py-2 text-left hover:bg-dark-700 rounded-lg">
                    Khóa bản vẽ
                  </button>
                  <button className="w-full px-fluid-3 py-2 text-left hover:bg-dark-700 rounded-lg">
                    Hiển thị lưới
                  </button>
                </div>
              )}
            </div>

            <div className="my-2 h-px bg-dark-600" />

            <button
              className="w-full px-fluid-4 py-2 text-left hover:bg-dark-700 flex items-center gap-3"
              onClick={() => {
                if (candleSeries.current) {
                  clearAllHLines(candleSeries.current);
                  try {
                    localStorage.removeItem(hlineKey(selectedSymbol, market));
                  } catch {}
                }
                setCtxOpen(false);
              }}
            >
              Xóa bản vẽ
            </button>

            <button className="w-full px-fluid-4 py-2 text-left hover:bg-dark-700 flex items-center gap-3">
              <span className="i-lucide-sliders-horizontal shrink-0" /> Xóa chỉ báo
            </button>

            <div className="my-2 h-px bg-dark-600" />

            <button className="w-full px-fluid-4 py-2 text-left hover:bg-dark-700 flex items-center gap-3">
              <span className="i-lucide-clock shrink-0" /> Công cụ thời gian
            </button>
            <button className="w-full px-fluid-4 py-2 text-left hover:bg-dark-700 flex items-center gap-3">
              <span className="i-lucide-monitor-cog shrink-0" /> Cài đặt đồ thị
            </button>
          </div>
        </div>
      )}
<NewOrderModal
  open={orderOpen}
  onClose={() => setOrderOpen(false)}
  defaultPrice={orderSeedPrice ?? undefined}
  defaultType={orderPresetType}
  tickSize={symbolMetaCache.get(`${market}:${selectedSymbol.toUpperCase()}`)?.tickSize}
  pricePrecision={symbolMetaCache.get(`${market}:${selectedSymbol.toUpperCase()}`)?.precision}
  symbol={selectedSymbol}
  onSubmit={(p) => {
    const meta = symbolMetaCache.get(`${market}:${selectedSymbol.toUpperCase()}`);
    const step = meta?.stepSize ?? 0.00000001;
    const stepDec = String(step).includes('.') ? String(step).split('.')[1]!.length : 0;

    const roundQty = (q: number) =>
      Number((Math.floor(q / step) * step).toFixed(stepDec));

    const qty = roundQty(p.qty);
    const isFutures = market === 'futures';

    const positionSide = isFutures
      ? (p.side === 'BUY' ? 'LONG' : 'SHORT')
      : 'BOTH';

    if (p.type === 'LIMIT') {
      if (!p.price) return;
      binanceWS.placeOrder({
        market,
        symbol: selectedSymbol,
        side: p.side,
        type: 'LIMIT',
        quantity: qty,
        price: p.price,
        timeInForce: 'GTC',
        ...(isFutures ? { positionSide } : {})
      });
    } else {
      if (isFutures) {
        if (!('stopPrice' in p) || !p.stopPrice) return;
        binanceWS.placeOrder({
          market: 'futures',
          symbol: selectedSymbol,
          side: p.side,
          type: 'STOP_MARKET',
          stopPrice: p.stopPrice,
          quantity: qty,
          positionSide,
          workingType: 'MARK'
        });
      } else {
        if (!('stopPrice' in p) || !p.stopPrice) return;
        binanceWS.placeOrder({
          market: 'spot',
          symbol: selectedSymbol,
          side: p.side,
          type: 'STOP_LOSS_LIMIT',
          stopPrice: p.stopPrice,
          price: p.stopPrice,
          quantity: qty,
          timeInForce: 'GTC'
        });
      }
    }
  }}
/>

      <AlertModal
        open={alertOpen}
        onClose={() => setAlertOpen(false)}
        defaultPrice={hoverPrice}
        symbol={selectedSymbol}
        onCreate={(a) => {
          console.log('[CREATE ALERT]', a);
        }}
      />

      {/* Layout: 2 charts xếp chồng */}
      <div className="relative w-full h-full flex flex-col">
        {/* Main Chart (75% height) */}
        <div 
          ref={mainChartContainerRef}
          className="relative w-full flex-[3]"
          onContextMenu={openCtxMenu}
        />
        
        {/* Đường kẻ phân cách */}
        <div 
          className="w-full h-[1px] bg-[#2b3139] shrink-0 relative z-10"
          style={{ boxShadow: '0 0 2px rgba(0,0,0,0.3)' }}
        />
        
        {/* Volume Chart (25% height) */}
        <div 
          ref={volumeChartContainerRef}
          className="relative w-full flex-1"
        />
      </div>
    </div>
  );
};

export default TradingBinance;