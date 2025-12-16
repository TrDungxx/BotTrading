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

import FloatingPositionTag from '../tabposition/FloatingPositionTag';
import { binanceWS } from '../binancewebsocket/BinanceWebSocketService';
import ToolMini from './popupchart/ToolMini';
import { copyPrice } from '../clickchart/CopyPrice';
import { addHLine, clearAllHLines, getAllLinePrices } from '../clickchart/hline';
import AlertModal from '../clickchart/AlertModal';
import NewOrderModal from '../clickchart/NewOrderModal';
import BollingerBandsIndicator from './functionchart/BollingerBandsIndicator';
import '../../style/Hidetradingviewlogo.css';
import LineIndicatorHeader from './popupchart/LineIndicatorHeader';
import LineIndicatorSettings from './popupchart/LineIndicatorSettings';
import { IndicatorValue } from './popupchart/LineIndicatorHeader';
import { MainIndicatorConfig,VolumeIndicatorConfig,IndicatorPeriods,IndicatorColors } from './popupchart/LineIndicatorSettings';


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
    // ✅ Tăng từ 5 lên 8 chữ số để giữ độ chính xác
    if (!Number.isNaN(avg)) out.push({ time: data[i].time, value: +avg.toFixed(8) });
  }
  return out;
}

// ✅ ADD EMA calculation
function calculateEMA(data: CandlestickData[], period: number): LineData[] {
  const out: LineData[] = [];
  const multiplier = 2 / (period + 1);
  
  // First EMA = SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close || 0;
  }
  let ema = sum / period;
  out.push({ time: data[period - 1].time, value: +ema.toFixed(8) }); // ✅ Tăng lên 8
  
  // Calculate EMA for remaining data
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
    out.push({ time: data[i].time, value: +ema.toFixed(8) }); // ✅ Tăng lên 8
  }
  
  return out;
}

// ✅ ADD Bollinger Bands calculation
function calculateBollingerBands(
  data: CandlestickData[], 
  period: number, 
  stdDev: number
): { upper: LineData[]; middle: LineData[]; lower: LineData[] } {
  const upper: LineData[] = [];
  const middle: LineData[] = [];
  const lower: LineData[] = [];
  
  for (let i = period - 1; i < data.length; i++) {
    // Calculate SMA (middle band)
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close || 0;
    }
    const sma = sum / period;
    
    // Calculate standard deviation
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = (data[j].close || 0) - sma;
      variance += diff * diff;
    }
    const std = Math.sqrt(variance / period);
    
    // Calculate bands
    const upperBand = sma + (stdDev * std);
    const lowerBand = sma - (stdDev * std);
    
    // ✅ Tăng precision lên 8
    middle.push({ time: data[i].time, value: +sma.toFixed(8) });
    upper.push({ time: data[i].time, value: +upperBand.toFixed(8) });
    lower.push({ time: data[i].time, value: +lowerBand.toFixed(8) });
  }
  
  return { upper, middle, lower };
}

// ✅ Function to draw BOLL filled background on canvas overlay
function drawBollFill(
  canvas: HTMLCanvasElement,
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">,
  upperData: LineData[],
  lowerData: LineData[],
  color: string = 'rgba(179, 133, 248, 0.1)'
) {
  if (!upperData.length || !lowerData.length || !series) return;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const timeScale = chart.timeScale();
  
  // Get visible range
  const visibleRange = timeScale.getVisibleRange();
  if (!visibleRange) return;
  
  ctx.fillStyle = color;
  ctx.beginPath();
  
  // Draw upper line (left to right)
  let started = false;
  for (let i = 0; i < upperData.length; i++) {
    const point = upperData[i];
    const x = timeScale.timeToCoordinate(point.time as UTCTimestamp);
    const y = series.priceToCoordinate(point.value);
    
    if (x === null || y === null) continue;
    
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  
  // Draw lower line (right to left) to close the polygon
  for (let i = lowerData.length - 1; i >= 0; i--) {
    const point = lowerData[i];
    const x = timeScale.timeToCoordinate(point.time as UTCTimestamp);
    const y = series.priceToCoordinate(point.value);
    
    if (x === null || y === null) continue;
    
    ctx.lineTo(x, y);
  }
  
  ctx.closePath();
  ctx.fill();
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
  
// ✅ LocalStorage keys for indicator settings
const getIndicatorStorageKey = (symbol: string, market: string) => 
  `indicator_settings_${market}_${symbol}`;

// ✅ Load indicator settings from localStorage
const loadIndicatorSettings = () => {
  try {
    const key = getIndicatorStorageKey(selectedSymbol, market);
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load indicator settings:', e);
  }
  return null;
};

const savedSettings = loadIndicatorSettings();

  const [mainIndicatorVisible, setMainIndicatorVisible] = useState(true);
const [showMainSettings, setShowMainSettings] = useState(false);
const [mainVisible, setMainVisible] = useState(savedSettings?.mainVisible ?? {
  ma7: true,
  ma25: true,
  ma99: true,
  ema12: false,
  ema26: false,
  boll: false,
});

const [bollFillVisible, setBollFillVisible] = useState(savedSettings?.bollFillVisible ?? false); // For BOLL fill background
const bollFillVisibleRef = useRef(false); // ✅ ADD: Ref to track bollFillVisible in closures

// Volume Chart Indicators
const [volumeIndicatorVisible, setVolumeIndicatorVisible] = useState(true);
const [showVolumeSettings, setShowVolumeSettings] = useState(false);
const [volumeVisible, setVolumeVisible] = useState(savedSettings?.volumeVisible ?? {
  mavol1: true,
  mavol2: true,
});

// Shared Periods & Colors
const [indicatorPeriods, setIndicatorPeriods] = useState(savedSettings?.indicatorPeriods ?? {
  ma7: 7,
  ma25: 25,
  ma99: 99,
  ema12: 12,
  ema26: 26,
  mavol1: 7,
  mavol2: 14,
  boll: { period: 20, stdDev: 2 },
});

const [indicatorColors, setIndicatorColors] = useState(savedSettings?.indicatorColors ?? {
  ma7: '#F0B90B',
  ma25: '#EB40B5',
  ma99: '#B385F8',
  ema12: '#2962FF',
  ema26: '#FF6D00',
  mavol1: '#0ECB81',
  mavol2: '#EB40B5',
  boll: { upper: '#B385F8', middle: '#EB40B5', lower: '#B385F8', fill: 'rgba(179, 133, 248, 0.1)' },
});

// VOL MA series refs
const mavol1Ref = useRef<ISeriesApi<'Line'> | null>(null);
const mavol2Ref = useRef<ISeriesApi<'Line'> | null>(null);
const [volumeData, setVolumeData] = useState<VolumeBar[]>([]);
  const candleSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeries = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ma7Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma25Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma99Ref = useRef<ISeriesApi<'Line'> | null>(null);

  // ✅ ADD new EMA refs
const ema12Ref = useRef<ISeriesApi<'Line'> | null>(null);
const ema26Ref = useRef<ISeriesApi<'Line'> | null>(null);

// ✅ ADD BOLL refs
const bollUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
const bollMiddleRef = useRef<ISeriesApi<'Line'> | null>(null);
const bollLowerRef = useRef<ISeriesApi<'Line'> | null>(null);
const bollFillRef = useRef<ISeriesApi<'Area'> | null>(null); // For filled background
const bollCanvasRef = useRef<HTMLCanvasElement | null>(null); // Canvas overlay for fill
const [bollData, setBollData] = useState<{ upper: LineData[]; middle: LineData[]; lower: LineData[] } | null>(null);
const bollDataRef = useRef<{ upper: LineData[]; middle: LineData[]; lower: LineData[] } | null>(null); // ✅ Ref for bollData
const redrawAnimationFrameRef = useRef<number | null>(null); // ✅ Track animation frame
const mainVisibleRef = useRef(mainVisible);
useEffect(() => {
  mainVisibleRef.current = mainVisible;
}, [mainVisible]);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionRef = useRef(0);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const lastSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const [floatingPos, setFloatingPos] = useState<PositionForTag | undefined>(undefined);
  const [candles, setCandles] = useState<Candle[]>([]);
  
  

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
const syncSourceRef = useRef<'main' | 'volume' | null>(null);

function calculateVolumeMA(volumeData: VolumeBar[], period: number): LineData<Time>[] {
  const out: LineData<Time>[] = [];
  for (let i = period - 1; i < volumeData.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += volumeData[j].value || 0;
    }
    const avg = sum / period;
    if (!Number.isNaN(avg)) {
      out.push({ time: volumeData[i].time, value: +avg.toFixed(2) });
    }
  }
  return out;
}

  const isSyncingRef = useRef(false);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
const isInteractingRef = useRef(false);
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

  // ✅ Điều chỉnh displayTickSize cho cột giá (bước nhảy nhỏ = nhiều mốc)
  let displayTickSize = tickSize;
  
  if (lastPrice < 1) {
    if (lastPrice >= 0.1 && lastPrice < 1) {
      displayTickSize = 0.0001;
      precision = 5;
    } else if (lastPrice < 0.1) {
      displayTickSize = 0.00001;
      precision = 6;
    }
  } else if (lastPrice >= 1 && lastPrice < 10) {
    displayTickSize = 0.001;  // Nhiều mốc: 2.330, 2.331, 2.332...
    precision = 3;
  } else if (lastPrice >= 10 && lastPrice < 100) {
    displayTickSize = 0.01;   // Nhiều mốc: 23.30, 23.31...
    precision = 2;
  } else if (lastPrice >= 100) {
    displayTickSize = 0.1;    // Nhiều mốc: 230.0, 230.1...
    precision = 4;
  }

  // ✅ Apply displayTickSize cho chart series (cột giá bên phải)
  cs.applyOptions({ priceFormat: { type: 'price', minMove: displayTickSize, precision } });
  ma7Ref.current?.applyOptions({ priceFormat: { type: 'price', minMove: displayTickSize, precision } });
  ma25Ref.current?.applyOptions({ priceFormat: { type: 'price', minMove: displayTickSize, precision } });
  ma99Ref.current?.applyOptions({ priceFormat: { type: 'price', minMove: displayTickSize, precision } });
  ema12Ref.current?.applyOptions({ priceFormat: { type: 'price', minMove: displayTickSize, precision } });
  ema26Ref.current?.applyOptions({ priceFormat: { type: 'price', minMove: displayTickSize, precision } });

  // ✅ KHÔNG làm tròn giá live - hiển thị đúng giá gốc
  chart.applyOptions({
    localization: {
      locale: 'vi-VN',
      priceFormatter: (p: number) => {
        // KHÔNG có Math.round() - giữ nguyên giá gốc
        return p.toLocaleString('vi-VN', {
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        });
      },
      // ✅ FIX: Format time theo timezone Việt Nam (UTC+7) - Hiển thị khi HOVER
      timeFormatter: (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        const time = date.toLocaleTimeString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        const day = date.toLocaleDateString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          day: '2-digit',
          month: '2-digit',
        });
        return `${time} ${day}`; // Format: "16:00 12-11"
      },
    },
  });
};

  const forceSyncCharts = () => {
  if (isSyncingRef.current) return;
  if (!chartRef.current || !volumeChartRef.current) return;

  try {
    isSyncingRef.current = true;

    const mainTimeScale = chartRef.current.timeScale();
    const volumeTimeScale = volumeChartRef.current.timeScale();

    const logicalRange = mainTimeScale.getVisibleLogicalRange();
    
    if (logicalRange) {
      volumeTimeScale.setVisibleLogicalRange(logicalRange);
    }

    const mainOptions = mainTimeScale.options();
    if (mainOptions && 'barSpacing' in mainOptions) {
      volumeTimeScale.applyOptions({
        barSpacing: mainOptions.barSpacing,
        rightOffset: mainOptions.rightOffset,
      });
    }
  } catch (err) {
    console.error('[ForceSyncCharts] Error:', err);
  } finally {
    isSyncingRef.current = false;
  }
};


  // ✅ Sync refs with state (MUST be before main useEffect to avoid closure issues)
  useEffect(() => {
    bollFillVisibleRef.current = bollFillVisible;
    
  }, [bollFillVisible]);

  useEffect(() => {
    bollDataRef.current = bollData;
    
  }, [bollData]);

  // ✅ Save indicator settings to localStorage whenever they change
  useEffect(() => {
    try {
      const key = getIndicatorStorageKey(selectedSymbol, market);
      const settings = {
        mainVisible,
        volumeVisible,
        indicatorPeriods,
        indicatorColors,
        bollFillVisible,
      };
      localStorage.setItem(key, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save indicator settings:', e);
    }
  }, [mainVisible, volumeVisible, indicatorPeriods, indicatorColors, bollFillVisible, selectedSymbol, market]);

  useEffect(() => {
    const mainEl = mainChartContainerRef.current;
    const volumeEl = volumeChartContainerRef.current;
    if (!mainEl || !volumeEl) return;

    const mainChart = createChart(mainEl, {
      layout: {
        background: { type: ColorType.Solid, color: '#181A20' },
        textColor: '#a7b1b9ff',
      },
      // ✅ FIX: Thêm localization để format time theo timezone Việt Nam
      localization: {
        locale: 'vi-VN',
        timeFormatter: (timestamp: number) => {
          const date = new Date(timestamp * 1000);
          const time = date.toLocaleTimeString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
          const day = date.toLocaleDateString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            day: '2-digit',
            month: '2-digit',
          });
          return `${time} ${day}`;
        },
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
        barSpacing: 10,
        minBarSpacing: 4,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: true,
        rightBarStaysOnScroll: true,
        shiftVisibleRangeOnNewBar: false,
        visible: false,
        // ✅ FIX: Chỉ hiển thị giờ:phút trên trục (không có ngày/tháng)
        tickMarkFormatter: (time: UTCTimestamp) => {
          const date = new Date(time * 1000);
          return date.toLocaleTimeString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
        },
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

    const volumeChart = createChart(volumeEl, {
      layout: {
        background: { type: ColorType.Solid, color: '#181A20' },
        textColor: '#a7b1b9ff',
      },
      // ✅ FIX: Thêm localization để format time theo timezone Việt Nam
      localization: {
        locale: 'vi-VN',
        timeFormatter: (timestamp: number) => {
          const date = new Date(timestamp * 1000);
          const time = date.toLocaleTimeString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
          const day = date.toLocaleDateString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            day: '2-digit',
            month: '2-digit',
          });
          return `${time} ${day}`;
        },
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
        barSpacing: 10,
        minBarSpacing: 4,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: true,
        rightBarStaysOnScroll: true,
        shiftVisibleRangeOnNewBar: false,
        // ✅ FIX: Chỉ hiển thị giờ:phút trên trục
        tickMarkFormatter: (time: UTCTimestamp) => {
          const date = new Date(time * 1000);
          return date.toLocaleTimeString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
        },
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
          price: false,
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

    const mainTimeScale = mainChart.timeScale();
    const volumeTimeScale = volumeChart.timeScale();


    const handleMainChartChange = (logicalRange: any) => {
  if (!logicalRange || isSyncingRef.current) return;
  if (syncSourceRef.current === 'volume') return;
  
  isSyncingRef.current = true;
  syncSourceRef.current = 'main';
  
  try {
    volumeTimeScale.setVisibleLogicalRange(logicalRange);
  } catch (err) {
    console.error('[Sync] Main → Volume error:', err);
  } finally {
    isSyncingRef.current = false;
    syncSourceRef.current = null;
  }
};

const handleVolumeChartChange = (logicalRange: any) => {
  if (!logicalRange || isSyncingRef.current) return;
  if (syncSourceRef.current === 'main') return;
  
  isSyncingRef.current = true;
  syncSourceRef.current = 'volume';
  
  try {
    mainTimeScale.setVisibleLogicalRange(logicalRange);
  } catch (err) {
    console.error('[Sync] Volume → Main error:', err);
  } finally {
    isSyncingRef.current = false;
    syncSourceRef.current = null;
  }
};

  mainTimeScale.subscribeVisibleLogicalRangeChange(handleMainChartChange);
  volumeTimeScale.subscribeVisibleLogicalRangeChange(handleVolumeChartChange);

    

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

    // ✅ ADD EMA series
ema12Ref.current = mainChart.addLineSeries({
  color: indicatorColors.ema12,
  lineWidth: 1,
  lastValueVisible: false,
  priceLineVisible: false,
  visible: mainVisible.ema12,
  lineStyle: 0, // Solid line (different from MA if needed)
});

ema26Ref.current = mainChart.addLineSeries({
  color: indicatorColors.ema26,
  lineWidth: 1,
  lastValueVisible: false,
  priceLineVisible: false,
  visible: mainVisible.ema26,
  lineStyle: 0,
});

// ✅ ADD BOLL series
const bollColors = indicatorColors.boll ?? { upper: '#B385F8', middle: '#EB40B5', lower: '#B385F8' };

// Note: Lightweight Charts doesn't natively support filling between two lines
// We'll add semi-transparent lines to create a similar visual effect
bollUpperRef.current = mainChart.addLineSeries({
  color: bollColors.upper,
  lineWidth: 1, // ✅ Reduced from 2 to 1 for thinner line
  lastValueVisible: false,
  priceLineVisible: false,
  visible: mainVisible.boll,
  lineStyle: 0,
});

bollMiddleRef.current = mainChart.addLineSeries({
  color: bollColors.middle,
  lineWidth: 1,
  lastValueVisible: false,
  priceLineVisible: false,
  visible: mainVisible.boll,
  lineStyle: 2, // Dashed line for middle
});

bollLowerRef.current = mainChart.addLineSeries({
  color: bollColors.lower,
  lineWidth: 1, // ✅ Reduced from 2 to 1 for thinner line
  lastValueVisible: false,
  priceLineVisible: false,
  visible: mainVisible.boll,
  lineStyle: 0,
});

// ✅ Create canvas overlay for BOLL fill
const canvas = document.createElement('canvas');
canvas.style.position = 'absolute';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.pointerEvents = 'none';
canvas.style.zIndex = '1';
canvas.width = mainEl.clientWidth;
canvas.height = mainEl.clientHeight;
mainEl.style.position = 'relative';
mainEl.appendChild(canvas);
bollCanvasRef.current = canvas;


// Function to redraw BOLL fill when chart updates
const redrawBollFill = () => {
  
  
  if (redrawAnimationFrameRef.current !== null) {
    cancelAnimationFrame(redrawAnimationFrameRef.current);
    redrawAnimationFrameRef.current = null;
  }
  
  // ✅ TẤT CẢ giá trị từ refs - không có vấn đề closure
  const currentBollData = bollDataRef.current;
  const currentBollFillVisible = bollFillVisibleRef.current;
  const currentMainVisible = mainVisibleRef.current.boll;
  
 
  
  if (!bollCanvasRef.current || !chartRef.current || !candleSeries.current) {
    
    return;
  }
  
  // Schedule redraw on next animation frame
  redrawAnimationFrameRef.current = requestAnimationFrame(() => {
    if (!bollCanvasRef.current) return;
    
    const ctx = bollCanvasRef.current.getContext('2d');
    if (!ctx) return;
    
    // ✅ FIX: Only proceed if we should be showing the fill
    // Don't clear if we're not going to redraw
    if (!currentBollData || !currentMainVisible || !currentBollFillVisible || !chartRef.current || !candleSeries.current) {
      return; // Exit without clearing if conditions not met
    }
    
    // ✅ Clear canvas before redrawing
    ctx.clearRect(0, 0, bollCanvasRef.current.width, bollCanvasRef.current.height);
    
    
    const timeScale = chartRef.current.timeScale();
    const visibleRange = timeScale.getVisibleRange();
    if (!visibleRange) {
      
      return;
    }
    
    ctx.fillStyle = indicatorColors.boll?.fill || 'rgba(179, 133, 248, 0.1)';
    ctx.beginPath();
    
    // Draw upper line (left to right)
    let started = false;
    for (let i = 0; i < currentBollData.upper.length; i++) {
      const point = currentBollData.upper[i];
      const x = timeScale.timeToCoordinate(point.time as UTCTimestamp);
      const y = candleSeries.current!.priceToCoordinate(point.value);
      
      if (x === null || y === null) continue;
      
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    // Draw lower line (right to left) to close the polygon
    for (let i = currentBollData.lower.length - 1; i >= 0; i--) {
      const point = currentBollData.lower[i];
      const x = timeScale.timeToCoordinate(point.time as UTCTimestamp);
      const y = candleSeries.current!.priceToCoordinate(point.value);
      
      if (x === null || y === null) continue;
      
      ctx.lineTo(x, y);
    }
    
    ctx.closePath();
    ctx.fill();
    
    redrawAnimationFrameRef.current = null;
  });
};

// Subscribe to chart changes to redraw fill
mainChart.timeScale().subscribeVisibleTimeRangeChange(redrawBollFill);

mavol1Ref.current = volumeChart.addLineSeries({
  color: indicatorColors.mavol1,
  lineWidth: 1,
  lastValueVisible: false,
  priceLineVisible: false,
  priceScaleId: 'right',
});

mavol2Ref.current = volumeChart.addLineSeries({
  color: indicatorColors.mavol2,
  lineWidth: 1,
  lastValueVisible: false,
  priceLineVisible: false,
  priceScaleId: 'right',
});

    const ro = new ResizeObserver(() => {
      mainChart.applyOptions({ width: mainEl.clientWidth, height: mainEl.clientHeight });
      volumeChart.applyOptions({ width: volumeEl.clientWidth, height: volumeEl.clientHeight });
      
      // Resize canvas overlay
      if (bollCanvasRef.current) {
        bollCanvasRef.current.width = mainEl.clientWidth;
        bollCanvasRef.current.height = mainEl.clientHeight;
        
        // Redraw BOLL fill after resize
        if (bollData && mainVisible.boll && chartRef.current) {
          setTimeout(() => {
            if (bollCanvasRef.current && chartRef.current) {
              drawBollFill(bollCanvasRef.current, chartRef.current, candleSeries.current!, bollData.upper, bollData.lower);
            }
          }, 100);
        }
      }
      
      setTimeout(() => forceSyncCharts(), 50);
    });
    ro.observe(mainEl);
    ro.observe(volumeEl);
    resizeObsRef.current = ro;
const handleInteractionStart = () => {
  isInteractingRef.current = true;
};

const handleInteractionEnd = () => {
  setTimeout(() => {
    isInteractingRef.current = false;
  }, 300);
};

mainEl.addEventListener('mousedown', handleInteractionStart);
mainEl.addEventListener('touchstart', handleInteractionStart);
mainEl.addEventListener('wheel', handleInteractionStart);
mainEl.addEventListener('mouseup', handleInteractionEnd);
mainEl.addEventListener('touchend', handleInteractionEnd);
mainEl.addEventListener('mouseleave', handleInteractionEnd);

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

    return () => {
      mainChart.unsubscribeCrosshairMove(handleCrosshair);
      
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }

      mainTimeScale.unsubscribeVisibleLogicalRangeChange(handleMainChartChange);
      volumeTimeScale.unsubscribeVisibleLogicalRangeChange(handleVolumeChartChange);
      mainEl?.removeEventListener('mousedown', handleInteractionStart);
  mainEl?.removeEventListener('touchstart', handleInteractionStart);
  mainEl?.removeEventListener('wheel', handleInteractionStart);
  mainEl?.removeEventListener('mouseup', handleInteractionEnd);
  mainEl?.removeEventListener('touchend', handleInteractionEnd);
  mainEl?.removeEventListener('mouseleave', handleInteractionEnd);
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
      mavol1Ref.current = null;
mavol2Ref.current = null;
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
setVolumeData(vs);
if (vs.length >= indicatorPeriods.mavol1 && mavol1Ref.current) {
  mavol1Ref.current.setData(calculateVolumeMA(vs, indicatorPeriods.mavol1));
}
if (vs.length >= indicatorPeriods.mavol2 && mavol2Ref.current) {
  mavol2Ref.current.setData(calculateVolumeMA(vs, indicatorPeriods.mavol2));
}
      await updatePriceFormat(cs);

      if (cs.length > 0) {
        setTimeout(() => {
          if (!chartRef.current || !volumeChartRef.current || sessionRef.current !== mySession) return;
          
          const containerWidth = mainChartContainerRef.current?.clientWidth || 800;
          const minBarWidth = 8;
          const maxBarWidth = 16;
          const maxCandles = Math.floor(containerWidth / minBarWidth);
          const minCandles = Math.floor(containerWidth / maxBarWidth);
          let targetVisible = Math.max(50, Math.min(100, Math.floor((minCandles + maxCandles) / 2)));
          const visibleCount = Math.min(targetVisible, cs.length);
          const startIdx = Math.max(0, cs.length - visibleCount);
          
          const range = {
            from: cs[startIdx].time,
            to: cs[cs.length - 1].time,
          };
          
          const optimalBarSpacing = Math.max(8, Math.min(16, Math.floor(containerWidth / visibleCount * 0.85)));
          
          const spacingOptions = {
            rightOffset: 6,
            barSpacing: optimalBarSpacing,
            minBarSpacing: 6,
          };
          
          isSyncingRef.current = true;
          chartRef.current.timeScale().setVisibleRange(range);
          chartRef.current.timeScale().applyOptions(spacingOptions);
          volumeChartRef.current.timeScale().setVisibleRange(range);
          volumeChartRef.current.timeScale().applyOptions(spacingOptions);
          isSyncingRef.current = false;
          
          console.log(`[InitialView] 📊 ${visibleCount}/${cs.length} nến (spacing=${optimalBarSpacing}px)`);
        }, 150);
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
// ✅ ADD EMA calculations
if (cs.length >= 12 && ema12Ref.current && mainVisible.ema12) {
  ema12Ref.current.setData(calculateEMA(cs, indicatorPeriods.ema12 || 12));
}
if (cs.length >= 26 && ema26Ref.current && mainVisible.ema26) {
  ema26Ref.current.setData(calculateEMA(cs, indicatorPeriods.ema26 || 26));
}

// ✅ ADD BOLL calculations
if (cs.length >= (indicatorPeriods.boll?.period || 20) && mainVisible.boll) {
  const calculated = calculateBollingerBands(
    cs, 
    indicatorPeriods.boll?.period || 20, 
    indicatorPeriods.boll?.stdDev || 2
  );
  if (bollUpperRef.current) bollUpperRef.current.setData(calculated.upper);
  if (bollMiddleRef.current) bollMiddleRef.current.setData(calculated.middle);
  if (bollLowerRef.current) bollLowerRef.current.setData(calculated.lower);
  
  // Save BOLL data to state for canvas rendering
  setBollData(calculated);
  
  // Trigger canvas redraw
  setTimeout(() => {
    if (bollCanvasRef.current && chartRef.current) {
      drawBollFill(bollCanvasRef.current, chartRef.current, candleSeries.current!, calculated.upper, calculated.lower);
    }
  }, 100);
}
      setCandles(cs);

      const ws = new WebSocket(`${wsBase}/${selectedSymbol.toLowerCase()}@kline_${selectedInterval}`);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
  if (sessionRef.current !== mySession) return;
  const parsed = JSON.parse(ev.data) as KlineMessage;
  const k = parsed.k;
  const t = toTs(k.t);
  
  const isClosed = k.x === true;

  const candle: Candle = { 
    time: t, 
    open: +k.o, 
    high: +k.h, 
    low: +k.l, 
    close: +k.c 
  };
  
  const vol: VolumeBar = { 
    time: t, 
    value: +k.v, 
    color: +k.c >= +k.o ? '#0ECB81' : '#F6465D' 
  };

  if (candleSeries.current && volumeSeries.current) {
    candleSeries.current.update(candle);
    volumeSeries.current.update(vol);
setVolumeData((prev) => {
  const i = prev.findIndex((v) => v.time === vol.time);
  const next = i >= 0 
    ? [...prev.slice(0, i), vol, ...prev.slice(i + 1)] 
    : [...prev, vol];
  
  if (next.length > 500) next.shift();

  if (next.length >= indicatorPeriods.mavol1 && mavol1Ref.current) {
  mavol1Ref.current.setData(calculateVolumeMA(next, indicatorPeriods.mavol1));
}
if (next.length >= indicatorPeriods.mavol2 && mavol2Ref.current) {
  mavol2Ref.current.setData(calculateVolumeMA(next, indicatorPeriods.mavol2));
} 

  return next;
});
    
    if (isClosed) {
      console.log('[WS] 🕯️ New candle closed at', new Date(t * 1000).toISOString());
      setTimeout(() => {
        if (!chartRef.current || !volumeChartRef.current) return;
        
        const mainTimeScale = chartRef.current.timeScale();
        const volumeTimeScale = volumeChartRef.current.timeScale();
        const logicalRange = mainTimeScale.getVisibleLogicalRange();
        
        if (logicalRange) {
          volumeTimeScale.setVisibleLogicalRange(logicalRange);
        }
      }, 50);
    }
  }

  setCandles((prev) => {
    if (sessionRef.current !== mySession) return prev;
    const i = prev.findIndex((c) => c.time === candle.time);
    const next = i >= 0 
      ? [...prev.slice(0, i), candle, ...prev.slice(i + 1)] 
      : [...prev, candle];
    
    if (next.length > 500) next.shift();

    if (next.length >= 7 && ma7Ref.current) ma7Ref.current.setData(calculateMA(next, 7));
    if (next.length >= 25 && ma25Ref.current) ma25Ref.current.setData(calculateMA(next, 25));
    if (next.length >= 99 && ma99Ref.current) ma99Ref.current.setData(calculateMA(next, 99));

    // ✅ ADD: Update EMA
    if (next.length >= (indicatorPeriods.ema12 || 12) && ema12Ref.current && mainVisible.ema12) {
      ema12Ref.current.setData(calculateEMA(next, indicatorPeriods.ema12 || 12));
    }
    if (next.length >= (indicatorPeriods.ema26 || 26) && ema26Ref.current && mainVisible.ema26) {
      ema26Ref.current.setData(calculateEMA(next, indicatorPeriods.ema26 || 26));
    }

    // ✅ ADD: Update BOLL and redraw canvas
    if (next.length >= (indicatorPeriods.boll?.period || 20) && mainVisible.boll) {
      const calculated = calculateBollingerBands(
        next, 
        indicatorPeriods.boll?.period || 20, 
        indicatorPeriods.boll?.stdDev || 2
      );
      if (bollUpperRef.current) bollUpperRef.current.setData(calculated.upper);
      if (bollMiddleRef.current) bollMiddleRef.current.setData(calculated.middle);
      if (bollLowerRef.current) bollLowerRef.current.setData(calculated.lower);
      
      // Update BOLL data state
      setBollData(calculated);
      
      // Redraw canvas if fill is visible
      if (bollFillVisible && bollCanvasRef.current && chartRef.current && candleSeries.current) {
        requestAnimationFrame(() => {
          if (bollCanvasRef.current && chartRef.current && candleSeries.current) {
            drawBollFill(bollCanvasRef.current, chartRef.current, candleSeries.current, calculated.upper, calculated.lower, indicatorColors.boll?.fill);
          }
        });
      }
    }

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

    // Cleanup canvas overlay
    if (bollCanvasRef.current && bollCanvasRef.current.parentElement) {
      bollCanvasRef.current.parentElement.removeChild(bollCanvasRef.current);
      bollCanvasRef.current = null;
    }

    controller.abort();
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
    }
  };
}, [selectedSymbol, selectedInterval, market]);



  
// ✅ Toggle MA/EMA only (BOLL has separate header)
const toggleAllMainIndicators = () => {
  // Check if any MA/EMA is visible (exclude BOLL)
  const hasAnyVisible = mainVisible.ma7 || mainVisible.ma25 || mainVisible.ma99 || 
                        mainVisible.ema12 || mainVisible.ema26;
  
  const newState: MainIndicatorConfig = {
    ma7: !hasAnyVisible,
    ma25: !hasAnyVisible,
    ma99: !hasAnyVisible,
    ema12: !hasAnyVisible,
    ema26: !hasAnyVisible,
    boll: mainVisible.boll, // ✅ Keep BOLL state unchanged
  };
  setMainVisible(newState);
  
  ma7Ref.current?.applyOptions({ visible: newState.ma7 });
  ma25Ref.current?.applyOptions({ visible: newState.ma25 });
  ma99Ref.current?.applyOptions({ visible: newState.ma99 });
  ema12Ref.current?.applyOptions({ visible: newState.ema12 });
  ema26Ref.current?.applyOptions({ visible: newState.ema26 });
  // ✅ Don't toggle BOLL here - it has its own toggle
};

const mainIndicatorValues: IndicatorValue[] = [
  mainVisible.ma7 && {
    name: 'MA',
    period: indicatorPeriods.ma7,
    value: candles.at(-1)?.close ?? 0,
    color: indicatorColors.ma7!,
    visible: mainVisible.ma7,
  },
  mainVisible.ma25 && {
    name: 'MA',
    period: indicatorPeriods.ma25,
    value: candles.at(-1)?.close ?? 0,
    color: indicatorColors.ma25!,
    visible: mainVisible.ma25,
  },
  mainVisible.ma99 && {
    name: 'MA',
    period: indicatorPeriods.ma99,
    value: candles.at(-1)?.close ?? 0,
    color: indicatorColors.ma99!,
    visible: mainVisible.ma99,
  },
  mainVisible.ema12 && {
    name: 'EMA',
    period: indicatorPeriods.ema12,
    value: candles.at(-1)?.close ?? 0,
    color: indicatorColors.ema12!,
    visible: mainVisible.ema12,
  },
  mainVisible.ema26 && {
    name: 'EMA',
    period: indicatorPeriods.ema26,
    value: candles.at(-1)?.close ?? 0,
    color: indicatorColors.ema26!,
    visible: mainVisible.ema26,
  },
].filter(Boolean) as IndicatorValue[];

// ✅ SEPARATE: BOLL indicator values (render in its own header)
const bollIndicatorValues: IndicatorValue[] = [
  mainVisible.boll && bollData && {
    name: 'BOLL',
    period: indicatorPeriods.boll?.period ?? 20,
    stdDev: indicatorPeriods.boll?.stdDev ?? 2,
    value: bollData.upper.at(-1)?.value ?? 0,
    label: 'UP',
    color: indicatorColors.boll?.upper ?? '#B385F8',
    visible: mainVisible.boll,
    extraValues: [
      {
        label: 'MB',
        value: bollData.middle.at(-1)?.value ?? 0,
        color: indicatorColors.boll?.middle ?? '#EB40B5',
      },
      {
        label: 'DN',
        value: bollData.lower.at(-1)?.value ?? 0,
        color: indicatorColors.boll?.lower ?? '#B385F8',
      },
    ],
  },
].filter(Boolean) as IndicatorValue[];

const toggleAllVolumeIndicators = () => {
  const hasAnyVisible = volumeVisible.mavol1 || volumeVisible.mavol2;
  const newState: VolumeIndicatorConfig = {
    mavol1: !hasAnyVisible,
    mavol2: !hasAnyVisible,
  };
  setVolumeVisible(newState);
  
  mavol1Ref.current?.applyOptions({ visible: newState.mavol1 });
  mavol2Ref.current?.applyOptions({ visible: newState.mavol2 });
};

const volumeIndicatorValues: IndicatorValue[] = [
  volumeVisible.mavol1 && {
    name: 'MAVOL',
    period: indicatorPeriods.mavol1,
    value: volumeData.at(-1)?.value ?? 0,
    color: indicatorColors.mavol1!,
    visible: volumeVisible.mavol1,
  },
  volumeVisible.mavol2 && {
    name: 'MAVOL',
    period: indicatorPeriods.mavol2,
    value: volumeData.at(-1)?.value ?? 0,
    color: indicatorColors.mavol2!,
    visible: volumeVisible.mavol2,
  },
].filter(Boolean) as IndicatorValue[];
  

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

  useEffect(() => {
  const hideLogo = (svg: Element) => {
    if (svg.getAttribute('viewBox') === '0 0 35 19') {
      (svg as HTMLElement).style.display = 'none';
      
      const parent = svg.parentElement;
      if (parent) {
        (parent as HTMLElement).style.display = 'none';
      }
      
      console.log('✅ Đã ẩn logo TradingView');
      return true;
    }
    return false;
  };

  const existingLogos = document.querySelectorAll('svg[viewBox="0 0 35 19"]');
  existingLogos.forEach(hideLogo);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          const element = node as Element;
          
          if (element.tagName === 'svg' && hideLogo(element)) {
            return;
          }
          
          const logos = element.querySelectorAll('svg[viewBox="0 0 35 19"]');
          logos.forEach(hideLogo);
        }
      });
    });
  });

  const mainContainer = mainChartContainerRef.current;
  const volumeContainer = volumeChartContainerRef.current;

  if (mainContainer) {
    observer.observe(mainContainer, {
      childList: true,
      subtree: true,
    });
  }

  if (volumeContainer) {
    observer.observe(volumeContainer, {
      childList: true,
      subtree: true,
    });
  }

  return () => {
    observer.disconnect();
  };
}, []);

  // ✅ ADD: Redraw canvas when bollFillVisible changes
  useEffect(() => {
    if (!bollCanvasRef.current || !chartRef.current || !candleSeries.current || !bollData) return;
    
    if (bollFillVisible && mainVisible.boll) {
      // Draw fill
      drawBollFill(bollCanvasRef.current, chartRef.current, candleSeries.current, bollData.upper, bollData.lower, indicatorColors.boll?.fill);
    } else {
      // Clear fill
      const ctx = bollCanvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, bollCanvasRef.current.width, bollCanvasRef.current.height);
    }
  }, [bollFillVisible, bollData, mainVisible.boll]);



  return (
    <div className="h-full w-full min-w-0 relative">

      
{mainIndicatorVisible && (
  <LineIndicatorHeader
    type="main"
    indicators={mainIndicatorValues}
    visible={mainVisible.ma7 || mainVisible.ma25 || mainVisible.ma99 || mainVisible.ema12 || mainVisible.ema26}
    onToggleVisible={toggleAllMainIndicators}
    onOpenSetting={() => setShowMainSettings(true)}
    onClose={() => {
      setMainIndicatorVisible(false);
      const allOff: MainIndicatorConfig = {
        ma7: false,
        ma25: false,
        ma99: false,
        ema12: false,
        ema26: false,
        boll: mainVisible.boll, // ✅ Keep BOLL state when closing main header
      };
      setMainVisible(allOff);
      ma7Ref.current?.applyOptions({ visible: false });
      ma25Ref.current?.applyOptions({ visible: false });
      ma99Ref.current?.applyOptions({ visible: false });
      ema12Ref.current?.applyOptions({ visible: false });
      ema26Ref.current?.applyOptions({ visible: false });
    }}
  />
)}

{/* ✅ SEPARATE BOLL Header - appears below main header */}
{mainVisible.boll && bollData && (
  <div className="absolute top-8 left-2 z-10">
    <LineIndicatorHeader
      type="main"
      noPosition={true}
      indicators={bollIndicatorValues}
      visible={mainVisible.boll}
      onToggleVisible={() => {
        const newState = { ...mainVisible, boll: !mainVisible.boll };
        setMainVisible(newState);
        bollUpperRef.current?.applyOptions({ visible: newState.boll });
        bollMiddleRef.current?.applyOptions({ visible: newState.boll });
        bollLowerRef.current?.applyOptions({ visible: newState.boll });
      }}
      onOpenSetting={() => setShowMainSettings(true)}
      onClose={() => {
        // ✅ Close BOLL by clicking X
        setMainVisible({ ...mainVisible, boll: false });
        bollUpperRef.current?.applyOptions({ visible: false });
        bollMiddleRef.current?.applyOptions({ visible: false });
        bollLowerRef.current?.applyOptions({ visible: false });
        
        // Clear canvas
        if (bollCanvasRef.current) {
          const ctx = bollCanvasRef.current.getContext('2d');
          ctx?.clearRect(0, 0, bollCanvasRef.current.width, bollCanvasRef.current.height);
        }
      }}
    />
  </div>
)}

{showMainSettings && (
  <LineIndicatorSettings
    type="main"
    defaultTab={1}
    mainVisible={mainVisible}
    volumeVisible={volumeVisible}
    periods={indicatorPeriods}
    colors={indicatorColors}
    bollFillVisible={bollFillVisible}
    onChange={(mainVis, volumeVis, _, per, col, bollFillVis) => {
      if (mainVis) {
        setMainVisible(mainVis);
        ma7Ref.current?.applyOptions({ visible: mainVis.ma7 });
        ma25Ref.current?.applyOptions({ visible: mainVis.ma25 });
        ma99Ref.current?.applyOptions({ visible: mainVis.ma99 });
        ema12Ref.current?.applyOptions({ visible: mainVis.ema12 });
        ema26Ref.current?.applyOptions({ visible: mainVis.ema26 });
        bollUpperRef.current?.applyOptions({ visible: mainVis.boll });
        bollMiddleRef.current?.applyOptions({ visible: mainVis.boll });
        bollLowerRef.current?.applyOptions({ visible: mainVis.boll });
        
        // Update fill visibility
        if (bollFillVis !== undefined) {
          setBollFillVisible(bollFillVis);
        }
        
        // Clear or redraw canvas based on visibility
        if (!mainVis.boll && bollCanvasRef.current) {
          const ctx = bollCanvasRef.current.getContext('2d');
          ctx?.clearRect(0, 0, bollCanvasRef.current.width, bollCanvasRef.current.height);
        } else if (mainVis.boll && bollData && bollCanvasRef.current && chartRef.current) {
          setTimeout(() => {
            if (bollCanvasRef.current && chartRef.current) {
              drawBollFill(bollCanvasRef.current, chartRef.current, candleSeries.current!, bollData.upper, bollData.lower);
            }
          }, 50);
        }
      }
      if (volumeVis) {
        setVolumeVisible(volumeVis);
        mavol1Ref.current?.applyOptions({ visible: volumeVis.mavol1 });
        mavol2Ref.current?.applyOptions({ visible: volumeVis.mavol2 });
      }
      if (per) setIndicatorPeriods(per);
      if (col) {
        setIndicatorColors(col);
        ma7Ref.current?.applyOptions({ color: col.ma7 });
        ma25Ref.current?.applyOptions({ color: col.ma25 });
        ma99Ref.current?.applyOptions({ color: col.ma99 });
        ema12Ref.current?.applyOptions({ color: col.ema12 });
        ema26Ref.current?.applyOptions({ color: col.ema26 });
        mavol1Ref.current?.applyOptions({ color: col.mavol1 });
        mavol2Ref.current?.applyOptions({ color: col.mavol2 });
        if (col.boll) {
          bollUpperRef.current?.applyOptions({ color: col.boll.upper });
          bollMiddleRef.current?.applyOptions({ color: col.boll.middle });
          bollLowerRef.current?.applyOptions({ color: col.boll.lower });
        }
      }
      
      // Recalculate if periods changed
      if (per && candles.length > 0) {
        if (candles.length >= (per.ma7 || 7) && ma7Ref.current && mainVis?.ma7) {
          ma7Ref.current.setData(calculateMA(candles, per.ma7 || 7));
        }
        if (candles.length >= (per.ma25 || 25) && ma25Ref.current && mainVis?.ma25) {
          ma25Ref.current.setData(calculateMA(candles, per.ma25 || 25));
        }
        if (candles.length >= (per.ma99 || 99) && ma99Ref.current && mainVis?.ma99) {
          ma99Ref.current.setData(calculateMA(candles, per.ma99 || 99));
        }
        if (candles.length >= (per.ema12 || 12) && ema12Ref.current && mainVis?.ema12) {
          ema12Ref.current.setData(calculateEMA(candles, per.ema12 || 12));
        }
        if (candles.length >= (per.ema26 || 26) && ema26Ref.current && mainVis?.ema26) {
          ema26Ref.current.setData(calculateEMA(candles, per.ema26 || 26));
        }
        if (candles.length >= (per.boll?.period || 20) && mainVis?.boll) {
          const calculated = calculateBollingerBands(
            candles, 
            per.boll?.period || 20, 
            per.boll?.stdDev || 2
          );
          bollUpperRef.current?.setData(calculated.upper);
          bollMiddleRef.current?.setData(calculated.middle);
          bollLowerRef.current?.setData(calculated.lower);
          
          // Update canvas
          setBollData(calculated);
          setTimeout(() => {
            if (bollCanvasRef.current && chartRef.current) {
              drawBollFill(bollCanvasRef.current, chartRef.current, candleSeries.current!, calculated.upper, calculated.lower);
            }
          }, 50);
        }
      }
      
      // Recalculate volume MAs if periods changed
      if (per && volumeData.length > 0) {
        if (volumeData.length >= (per.mavol1 || 7) && mavol1Ref.current && volumeVis?.mavol1) {
          mavol1Ref.current.setData(calculateVolumeMA(volumeData, per.mavol1 || 7));
        }
        if (volumeData.length >= (per.mavol2 || 14) && mavol2Ref.current && volumeVis?.mavol2) {
          mavol2Ref.current.setData(calculateVolumeMA(volumeData, per.mavol2 || 14));
        }
      }
    }}
    onClose={() => setShowMainSettings(false)}
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
              className="w-full px-fluid-4 py-2 text-left hover:bg-dark-700 flex items-center gap-fluid-3"
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
              className="w-full px-fluid-4 py-2 text-left hover:bg-dark-700 flex items-center gap-fluid-3"
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
                <div className="flex items-center gap-fluid-3">
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
              className="w-full px-fluid-4 py-2 text-left hover:bg-dark-700 flex items-center gap-fluid-3"
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

            <button className="w-full px-fluid-4 py-2 text-left hover:bg-dark-700 flex items-center gap-fluid-3">
              <span className="i-lucide-sliders-horizontal shrink-0" /> Xóa chỉ báo
            </button>

            <div className="my-2 h-px bg-dark-600" />

            <button className="w-full px-fluid-4 py-2 text-left hover:bg-dark-700 flex items-center gap-fluid-3">
              <span className="i-lucide-clock shrink-0" /> Công cụ thời gian
            </button>
            <button className="w-full px-fluid-4 py-2 text-left hover:bg-dark-700 flex items-center gap-fluid-3">
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

      

      <div className="relative w-full h-full flex flex-col">
        <div 
          ref={mainChartContainerRef}
          className="relative w-full flex-[3]"
          onContextMenu={openCtxMenu}
        />
        
        <div 
          className="w-full h-[2px] bg-[#2b3139] shrink-0 relative z-10"
          style={{ boxShadow: '0 0 3px rgba(80, 77, 77, 0.4)' }}
        />
        
        <div 
          ref={volumeChartContainerRef}
          className="relative w-full flex-1"
        >
         {volumeIndicatorVisible && (
  <LineIndicatorHeader
    type="volume"
    indicators={volumeIndicatorValues}
    visible={volumeVisible.mavol1 || volumeVisible.mavol2}
    onToggleVisible={toggleAllVolumeIndicators}
    onOpenSetting={() => setShowVolumeSettings(true)}
    onClose={() => {
      setVolumeIndicatorVisible(false);
      const allOff: VolumeIndicatorConfig = {
        mavol1: false,
        mavol2: false,
      };
      setVolumeVisible(allOff);
      mavol1Ref.current?.applyOptions({ visible: false });
      mavol2Ref.current?.applyOptions({ visible: false });
    }}
  />
)}
{showVolumeSettings && (
  <LineIndicatorSettings
    type="volume"
    defaultTab={2}
    mainVisible={mainVisible}
    volumeVisible={volumeVisible}
    periods={indicatorPeriods}
    colors={indicatorColors}
    bollFillVisible={bollFillVisible}
    onChange={(mainVis, volumeVis, _, per, col, bollFillVis) => {
      if (mainVis) {
        setMainVisible(mainVis);
        ma7Ref.current?.applyOptions({ visible: mainVis.ma7 });
        ma25Ref.current?.applyOptions({ visible: mainVis.ma25 });
        ma99Ref.current?.applyOptions({ visible: mainVis.ma99 });
        ema12Ref.current?.applyOptions({ visible: mainVis.ema12 });
        ema26Ref.current?.applyOptions({ visible: mainVis.ema26 });
      }
      // Handle bollFillVis
      if (bollFillVis !== undefined) {
        setBollFillVisible(bollFillVis);
      }
      
      if (volumeVis) {
        setVolumeVisible(volumeVis);
        mavol1Ref.current?.applyOptions({ visible: volumeVis.mavol1 });
        mavol2Ref.current?.applyOptions({ visible: volumeVis.mavol2 });
      }
      if (per) setIndicatorPeriods(per);
      if (col) {
        setIndicatorColors(col);
        ma7Ref.current?.applyOptions({ color: col.ma7 });
        ma25Ref.current?.applyOptions({ color: col.ma25 });
        ma99Ref.current?.applyOptions({ color: col.ma99 });
        ema12Ref.current?.applyOptions({ color: col.ema12 });
        ema26Ref.current?.applyOptions({ color: col.ema26 });
        mavol1Ref.current?.applyOptions({ color: col.mavol1 });
        mavol2Ref.current?.applyOptions({ color: col.mavol2 });
      }
      
      // Recalculate main chart MAs if periods changed
      if (per && candles.length > 0) {
        if (candles.length >= (per.ma7 || 7) && ma7Ref.current && mainVis?.ma7) {
          ma7Ref.current.setData(calculateMA(candles, per.ma7 || 7));
        }
        if (candles.length >= (per.ma25 || 25) && ma25Ref.current && mainVis?.ma25) {
          ma25Ref.current.setData(calculateMA(candles, per.ma25 || 25));
        }
        if (candles.length >= (per.ma99 || 99) && ma99Ref.current && mainVis?.ma99) {
          ma99Ref.current.setData(calculateMA(candles, per.ma99 || 99));
        }
        if (candles.length >= (per.ema12 || 12) && ema12Ref.current && mainVis?.ema12) {
          ema12Ref.current.setData(calculateEMA(candles, per.ema12 || 12));
        }
        if (candles.length >= (per.ema26 || 26) && ema26Ref.current && mainVis?.ema26) {
          ema26Ref.current.setData(calculateEMA(candles, per.ema26 || 26));
        }
      }
      
      // Recalculate volume MAs if periods changed
      if (per && volumeData.length > 0) {
        if (volumeData.length >= (per.mavol1 || 7) && mavol1Ref.current && volumeVis?.mavol1) {
          mavol1Ref.current.setData(calculateVolumeMA(volumeData, per.mavol1 || 7));
        }
        if (volumeData.length >= (per.mavol2 || 14) && mavol2Ref.current && volumeVis?.mavol2) {
          mavol2Ref.current.setData(calculateVolumeMA(volumeData, per.mavol2 || 14));
        }
      }
    }}
    onClose={() => setShowVolumeSettings(false)}
  />
)}
        </div>
      </div>
    </div>
  );
};

export default TradingBinance;