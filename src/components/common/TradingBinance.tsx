import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
import { useChartType } from './hooks/userChartType';
import FloatingPositionTag from '../tabposition/FloatingPositionTag';
import { binanceWS } from '../binancewebsocket/BinanceWebSocketService';
import { copyPrice } from '../clickchart/CopyPrice';
import { addHLine, clearAllHLines, getAllLinePrices } from '../clickchart/hline';
import '../../style/Hidetradingviewlogo.css';
import ChartContextMenu from '../clickchart/ChartContextMenu';
import CandleCountdown from './popupchart/CandleCountdown';
// ✅ NEW: Dynamic Indicators
import { useDynamicIndicators } from './hooks/useDynamicIndicators';
import { DynamicIndicatorConfig, IndicatorLine, BollConfig } from './hooks/indicatorTypes';
import LineIndicatorHeader, { IndicatorValue } from './popupchart/LineIndicatorHeader';
import LineIndicatorSettings from './popupchart/LineIndicatorSettings';
// Component path - nếu để trong thư mục popupchart thì giữ nguyên
// Nếu để ở thư mục khác thì sửa đường dẫn import
import HighLowMarkers from '../layoutchart/HighLowMarkers';

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
    // DOGE ~0.13 cần 5 decimals
    tick = 0.00001;
    precision = 5;
  } else if (p >= 0.01) {
    // Giá 0.01-0.1 cần 6 decimals
    tick = 0.000001;
    precision = 6;
  } else {
    // 1000PEPE ~0.004 cần 6-7 decimals
    tick = 0.000001;
    precision = 7;
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

  // ✅ chartType state (controlled/uncontrolled)
  const [innerChartType, setInnerChartType] = useState<ChartType>("Candles");
  const chartType = controlledChartType ?? innerChartType;
  const setChartType = (t: ChartType) => {
    if (onChartTypeChange) onChartTypeChange(t);
    else setInnerChartType(t);
  };

  // ✅ Khai báo refs TRƯỚC (để tránh lỗi initialization)
  const candleSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeries = useRef<ISeriesApi<'Histogram'> | null>(null);

  // ============================================
  // ✅ NEW: USE DYNAMIC INDICATORS HOOK
  // ============================================
  const {
    config,
    setConfig,
    lineSeriesRefs,
    bollSeriesRefs,
    volumeSeriesRefs,
    initializeSeries,
    updateMainIndicators,
    updateVolumeIndicators,
    clearAllIndicators,
    addLine,
    removeLine,
    updateLine,
    addBoll,
    removeBoll,
    updateBoll,
    addVolumeMA,
    removeVolumeMA,
    updateVolumeMA,
    toggleLinesByType,
    toggleAllBolls,
    toggleAllVolumeMAs,
    visibleLines,
    visibleBolls,
    visibleVolumeMAs,
    hasAnyMainVisible,
    hasAnyVolumeVisible,
  } = useDynamicIndicators({
    selectedSymbol,
    market,
    chartRef,
    volumeChartRef,
    mainChartContainerRef,
  });

  // Main chart & volume states
  const [mainIndicatorVisible, setMainIndicatorVisible] = useState(true);
  const [showMainSettings, setShowMainSettings] = useState(false);
  const [volumeIndicatorVisible, setVolumeIndicatorVisible] = useState(true);
  const [showVolumeSettings, setShowVolumeSettings] = useState(false);

  const [volumeData, setVolumeData] = useState<VolumeBar[]>([]);

  // ✅ High/Low markers visibility state
  const [showHighLowMarkers, setShowHighLowMarkers] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const sessionRef = useRef(0);
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

  const syncSourceRef = useRef<'main' | 'volume' | null>(null);
  const { updateSeriesData } = useChartType({
    chartType,
    chartRef,
    candleSeriesRef: candleSeries,
    candles,
    selectedSymbol,
    market,
    sessionRef,
    updateMainIndicators,
    updateBollingerBands: updateMainIndicators, // Use same function now
    addHLine,
    hlineKey,
  });
  const isSyncingRef = useRef(false);

  const snapToTick = (price: number) => {
    const cacheKey = `${market}:${selectedSymbol.toUpperCase()}`;
    const meta = symbolMetaCache.get(cacheKey) ?? heuristicMetaFromPrice(price);
    let tick = meta.tickSize ?? heuristicMetaFromPrice(price).tickSize;
    if (price < 10 && tick >= 0.05) tick = heuristicMetaFromPrice(price).tickSize;
    const precision = Math.max((String(tick).split('.')[1]?.length ?? 0), meta.precision ?? 0);
    return Number((Math.round(price / tick) * tick).toFixed(precision));
  };

  const [alertOpen, setAlertOpen] = useState(false);

  // ===== BALANCE & LEVERAGE STATE =====
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [leverage, setLeverage] = useState<number>(10);

  // ===== SUBSCRIBE TO BALANCE UPDATES =====
  useEffect(() => {
    const handleMessage = (msg: any) => {
      if (msg?.type === 'accountInformation' && msg?.data) {
        const bal = Number(msg.data.availableBalance ?? 0);
        if (Number.isFinite(bal) && bal >= 0) {
          setAvailableBalance(bal);
        }
      }
    };
    binanceWS.onMessage(handleMessage);
    return () => binanceWS.removeMessageHandler(handleMessage);
  }, []);

  // ===== LOAD & SYNC LEVERAGE FROM LOCALSTORAGE =====
  useEffect(() => {
    const loadLeverage = () => {
      try {
        const accId = binanceWS.getCurrentAccountId();
        const accountKey = accId ?? 'na';
        const savedLeverage = localStorage.getItem(`tw_leverage_${accountKey}_${market}_${selectedSymbol}`);
        if (savedLeverage) {
          const lev = Number(savedLeverage);
          if (Number.isFinite(lev) && lev >= 1 && lev <= 125) {
            setLeverage(lev);
          }
        }
      } catch (e) {
        console.warn('[TradingBinance] Failed to load leverage:', e);
      }
    };
    loadLeverage();
    const interval = setInterval(loadLeverage, 1000);
    return () => clearInterval(interval);
  }, [market, selectedSymbol]);

  // Context menu handlers
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ctxOpenRef.current) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setCtxOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    ctxOpenRef.current = ctxOpen;
  }, [ctxOpen]);

  const openCtxMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!chartRef.current || !candleSeries.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;

    try {
      const price = candleSeries.current.coordinateToPrice(y);
      if (price !== null && Number.isFinite(price)) {
        ctxClickPriceRef.current = price;
      } else {
        ctxClickPriceRef.current = candles.at(-1)?.close ?? null;
      }
    } catch (err) {
      ctxClickPriceRef.current = candles.at(-1)?.close ?? null;
    }

    setCtxPos({ x: e.clientX, y: e.clientY });
    setCtxOpen(true);
    setCtxSubOpen(false);
  };

  const updatePriceFormat = async (candles: Candle[]) => {
    const chart = chartRef.current;
    const cs = candleSeries.current;
    if (!chart || !cs || candles.length === 0) return;

    const lastPrice = candles.at(-1)?.close;
    if (!lastPrice || !Number.isFinite(lastPrice) || lastPrice <= 0) return;

    let meta: SymbolMeta;
    try {
      meta = await getSymbolMeta(selectedSymbol, market);
    } catch {
      meta = heuristicMetaFromPrice(lastPrice);
    }

    let { tickSize, precision } = meta;
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
      displayTickSize = 0.001;
      precision = 3;
    } else if (lastPrice >= 10 && lastPrice < 100) {
      displayTickSize = 0.01;
      precision = 2;
    } else if (lastPrice >= 100) {
      displayTickSize = 0.1;
      precision = 4;
    }

    cs.applyOptions({ priceFormat: { type: 'price', minMove: displayTickSize, precision } });

    // Apply to all line series
    Object.values(lineSeriesRefs.current).forEach(series => {
      series?.applyOptions({ priceFormat: { type: 'price', minMove: displayTickSize, precision } });
    });

    chart.applyOptions({
      localization: {
        locale: 'vi-VN',
        priceFormatter: (p: number) => {
          return p.toLocaleString('vi-VN', {
            minimumFractionDigits: precision,
            maximumFractionDigits: precision,
          });
        },
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
    });
  };

  // ============================================
  // MAIN CHART INITIALIZATION
  // ============================================
  useEffect(() => {
    const mainEl = mainChartContainerRef.current;
    const volumeEl = volumeChartContainerRef.current;
    if (!mainEl || !volumeEl) return;

    const mainChart = createChart(mainEl, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#181A20' },
        textColor: '#a7b1b9ff',
      },
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
        barSpacing: 7,
        minBarSpacing: 4,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: true,
        rightBarStaysOnScroll: true,
        shiftVisibleRangeOnNewBar: false,
        visible: false,
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
        vertLine: { color: '#6e859bff', width: 1, style: 3, labelBackgroundColor: '#363c4e', labelVisible: true },
        horzLine: { color: '#758696', width: 1, style: 3, labelBackgroundColor: '#363c4e', labelVisible: true },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
      },
      kineticScroll: { mouse: true, touch: true },
    });

    chartRef.current = mainChart;

    const volumeChart = createChart(volumeEl, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#181A20' },
        textColor: '#a7b1b9ff',
      },
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
        barSpacing: 7,
        minBarSpacing: 4,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: true,
        rightBarStaysOnScroll: true,
        shiftVisibleRangeOnNewBar: false,
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
        vertLine: { color: '#6e859bff', width: 1, style: 3, labelBackgroundColor: '#363c4e', labelVisible: true },
        horzLine: { color: 'transparent', width: 0, style: 3, labelBackgroundColor: '#363c4e', labelVisible: false },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: false },
        axisDoubleClickReset: { time: true, price: true },
      },
      kineticScroll: { mouse: true, touch: true },
    });

    volumeChartRef.current = volumeChart;

    // Sync time scales
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

    // Create main series
    candleSeries.current = mainChart.addCandlestickSeries({
      upColor: '#0ECB81',
      downColor: '#F6465D',
      borderUpColor: '#0ECB81',
      borderDownColor: '#F6465D',
      wickUpColor: '#0ECB81',
      wickDownColor: '#F6465D',
      borderVisible: false,
      priceScaleId: 'right',
      lastValueVisible: false,
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

    // ✅ Initialize dynamic indicator series
    initializeSeries();

    // Crosshair move handler
    const handleCrosshairMove = (param: any) => {
      if (param.point && param.point.y !== undefined && candleSeries.current) {
        try {
          const price = candleSeries.current.coordinateToPrice(param.point.y);
          if (price !== null && Number.isFinite(price)) {
            setHoverPrice(price);
          }
        } catch (e) {
          if (param.time && param.seriesData.has(candleSeries.current)) {
            const candlePrice = param.seriesData.get(candleSeries.current)?.close;
            if (typeof candlePrice === 'number') {
              setHoverPrice(candlePrice);
            }
          } else {
            setHoverPrice(null);
          }
        }
      } else if (param.time && param.seriesData.has(candleSeries.current!)) {
        const price = param.seriesData.get(candleSeries.current!)?.close;
        if (typeof price === 'number') {
          setHoverPrice(price);
        }
      } else {
        setHoverPrice(null);
      }

      if (param.time) {
        setHoverTime(param.time as UTCTimestamp);
      } else {
        setHoverTime(null);
      }
    };

    mainChart.subscribeCrosshairMove(handleCrosshairMove);

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      // Handle resize if needed
    });

    if (mainEl) {
      resizeObserver.observe(mainEl);
    }

    return () => {
      resizeObserver.disconnect();
      mainChart.remove();
      volumeChart.remove();
    };
  }, []);

  
// DATA LOADING - FIXED VERSION


useEffect(() => {
  // ✅ FIX: Thêm flag để track nếu effect đã cleanup
  let isCancelled = false;
  
  // ✅ FIX: Retry logic nếu series chưa ready
  const waitForSeries = (): Promise<boolean> => {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max
      
      const check = () => {
        if (isCancelled) {
          resolve(false);
          return;
        }
        
        if (candleSeries.current && volumeSeries.current && chartRef.current) {
          resolve(true);
          return;
        }
        
        attempts++;
        if (attempts >= maxAttempts) {
          console.error('[LoadHistory] ❌ Series not ready after 5s');
          resolve(false);
          return;
        }
        
        setTimeout(check, 100);
      };
      
      check();
    });
  };

  const mySession = ++sessionRef.current;
  console.log('[LoadHistory] 🔄 Starting load for', selectedSymbol, selectedInterval, market, 'session:', mySession);

  // ✅ FIX: FORCE close context menu NGAY LẬP TỨC
  setCtxOpen(false);
  setCtxSubOpen(false);
  ctxClickPriceRef.current = null;
  ctxClickYRef.current = null;
  setHoverPrice(null);
  setHoverTime(null);

  // ✅ FIX: Force close WebSocket TRƯỚC KHI làm gì khác
  try {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
      console.log('[WS] 🔌 Force closed old WebSocket');
    }
  } catch (e) {
    console.warn('[WS] ⚠️ Error closing WebSocket:', e);
  }

  const restBase = market === 'futures' ? 'https://fapi.binance.com' : 'https://data.binance.com';
  const wsBase = market === 'futures' ? 'wss://fstream.binance.com/ws' : 'wss://stream.binance.com:9443/ws';

  const controller = new AbortController();

  const loadHistory = async () => {
    // ✅ FIX: Wait for series to be ready
    const seriesReady = await waitForSeries();
    if (!seriesReady || isCancelled) {
      console.log('[LoadHistory] ⚠️ Cancelled or series not ready');
      return;
    }

    // ✅ FIX: Double check session sau khi wait
    if (sessionRef.current !== mySession) {
      console.log('[LoadHistory] ⚠️ Session changed during wait, aborting');
      return;
    }

    // ✅ FIX: Clear data với error handling tốt hơn
    try {
      if (candleSeries.current) {
        candleSeries.current.setData([]);
      }
      if (volumeSeries.current) {
        volumeSeries.current.setData([]);
      }
      setCandles([]);
      setVolumeData([]);
      clearAllIndicators();
      
      // ✅ FIX: Force reset price scale
      if (chartRef.current) {
        chartRef.current.priceScale('right').applyOptions({
          autoScale: true,
        });
      }
      
      console.log('[LoadHistory] ✅ Cleared old data');
    } catch (e) {
      console.warn('[LoadHistory] ⚠️ Failed to clear series:', e);
    }

    const path = market === 'futures' ? '/fapi/v1/klines' : '/api/v3/klines';
    const symbolUpper = selectedSymbol.toUpperCase().trim();
    const url = `${restBase}${path}?symbol=${symbolUpper}&interval=${selectedInterval}&limit=500`;

    console.log('[LoadHistory] 🔄 Fetching:', url);

    try {
      const res = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });

      // ✅ FIX: Check cancellation sau fetch
      if (isCancelled || sessionRef.current !== mySession) {
        console.log('[LoadHistory] ⚠️ Cancelled after fetch');
        return;
      }

      if (!res.ok) {
        const errorText = await res.text();
        console.error('[LoadHistory] ❌ API Error:', errorText);
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      if (!Array.isArray(data)) {
        console.error('[LoadHistory] ❌ Invalid response:', data);
        throw new Error('Expected array of klines');
      }

      if (data.length === 0) {
        console.warn('[LoadHistory] ⚠️ Empty data for', symbolUpper);
        return;
      }

      // ✅ FIX: Final session check trước khi set data
      if (sessionRef.current !== mySession || isCancelled) {
        console.log('[LoadHistory] ⚠️ Session mismatch, discarding data');
        return;
      }

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
        color: +d[4] >= +d[1] ? '#0ECB81' : '#F6465D',
      }));

      console.log('[LoadHistory] ✅ Loaded', cs.length, 'candles for', symbolUpper);

      // ✅ FIX: Kiểm tra series còn valid không
      if (!candleSeries.current || !volumeSeries.current) {
        console.error('[LoadHistory] ❌ Series became null!');
        return;
      }

      // ✅ FIX: Set data với try-catch
      try {
        candleSeries.current.setData(cs);
        volumeSeries.current.setData(vs);
        console.log('[LoadHistory] ✅ Data set successfully');
      } catch (e) {
        console.error('[LoadHistory] ❌ Failed to set data:', e);
        return;
      }

      setVolumeData(vs);
      setCandles(cs);

      // ✅ Update dynamic indicators
      updateMainIndicators(cs);
      updateVolumeIndicators(vs);

      // ✅ FIX: Update price format với error handling
      try {
        await updatePriceFormat(cs);
      } catch (e) {
        console.warn('[LoadHistory] ⚠️ Failed to update price format:', e);
      }

      if (cs.length > 0) {
        setTimeout(() => {
          if (!chartRef.current || !volumeChartRef.current || sessionRef.current !== mySession || isCancelled) return;

          try {
            const containerWidth = mainChartContainerRef.current?.clientWidth || 800;
            const minBarWidth = 6;
            const maxBarWidth = 12;
            const maxCandles = Math.floor(containerWidth / minBarWidth);
            const minCandles = Math.floor(containerWidth / maxBarWidth);
            let targetVisible = Math.max(50, Math.min(120, Math.floor((minCandles + maxCandles) / 2)));
            const visibleCount = Math.min(targetVisible, cs.length);
            const startIdx = Math.max(0, cs.length - visibleCount);

            const range = { from: cs[startIdx].time, to: cs[cs.length - 1].time };
            const optimalBarSpacing = Math.max(6, Math.min(10, Math.floor(containerWidth / visibleCount * 0.85)));
            const spacingOptions = { rightOffset: 16, barSpacing: optimalBarSpacing, minBarSpacing: 4 };

            isSyncingRef.current = true;
            chartRef.current.timeScale().setVisibleRange(range);
            chartRef.current.timeScale().applyOptions(spacingOptions);
            volumeChartRef.current.timeScale().setVisibleRange(range);
            volumeChartRef.current.timeScale().applyOptions(spacingOptions);
            
            
            
            
            isSyncingRef.current = false;
            
            console.log('[LoadHistory] ✅ Chart range set successfully');
          } catch (e) {
            console.warn('[LoadHistory] ⚠️ Failed to set chart range:', e);
            isSyncingRef.current = false;
          }
        }, 150);
      }

      // Load horizontal lines
      try {
        const raw = localStorage.getItem(hlineKey(selectedSymbol, market));
        const arr = raw ? (JSON.parse(raw) as number[]) : [];
        if (Array.isArray(arr) && candleSeries.current) {
          clearAllHLines(candleSeries.current);
          arr.forEach((p) => addHLine(candleSeries.current!, p));
        }
      } catch { }

      // Setup WebSocket
      const ws = new WebSocket(`${wsBase}/${selectedSymbol.toLowerCase()}@kline_${selectedInterval}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (sessionRef.current !== mySession || isCancelled) {
          ws.close();
          return;
        }
        console.log('[WS] ✅ Connected for', selectedSymbol, selectedInterval);
      };

      ws.onmessage = (ev) => {
        // ✅ Check session NGAY từ đầu
        if (sessionRef.current !== mySession || isCancelled) {
          return;
        }
        
        try {
          const parsed = JSON.parse(ev.data) as KlineMessage;
          const k = parsed.k;
          const t = toTs(k.t);
          const isClosed = k.x === true;

          const candle: Candle = { time: t, open: +k.o, high: +k.h, low: +k.l, close: +k.c };
          const vol: VolumeBar = { time: t, value: +k.v, color: +k.c >= +k.o ? '#0ECB81' : '#F6465D' };

          if (candleSeries.current && volumeSeries.current) {
            updateSeriesData(candle);
            volumeSeries.current.update(vol);

            setVolumeData((prev) => {
              const i = prev.findIndex((v) => v.time === vol.time);
              const next = i >= 0 ? [...prev.slice(0, i), vol, ...prev.slice(i + 1)] : [...prev, vol];
              if (next.length > 500) next.shift();
              updateVolumeIndicators(next);
              return next;
            });

            if (isClosed) {
  setTimeout(() => {
    if (!chartRef.current || !volumeChartRef.current) return;
    const mainTimeScale = chartRef.current.timeScale();
    const volumeTimeScale = volumeChartRef.current.timeScale();
    
    const visibleRange = mainTimeScale.getVisibleLogicalRange();
    if (visibleRange) {
      setCandles(currentCandles => {
        // Chỉ scroll nếu đang xem candle mới nhất
        const isViewingLatest = visibleRange.to >= currentCandles.length - 8;
        
        if (isViewingLatest) {
          const newFrom = visibleRange.from + 1;
          const newTo = visibleRange.to + 1;
          mainTimeScale.setVisibleLogicalRange({ from: newFrom, to: newTo });
          volumeTimeScale.setVisibleLogicalRange({ from: newFrom, to: newTo });
        } else {
          volumeTimeScale.setVisibleLogicalRange(visibleRange);
        }
        
        return currentCandles;
      });
    }
  }, 50);
}
          }

          setCandles((prev) => {
            if (sessionRef.current !== mySession || isCancelled) return prev;
            const i = prev.findIndex((c) => c.time === candle.time);
            const next = i >= 0 ? [...prev.slice(0, i), candle, ...prev.slice(i + 1)] : [...prev, candle];
            if (next.length > 500) next.shift();
            updateMainIndicators(next);
            return next;
          });
        } catch (e) {
          console.warn('[WS] ⚠️ Failed to parse message:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('[WS] ❌ WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('[WS] 🔌 WebSocket closed for', selectedSymbol);
      };

    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          console.log('[LoadHistory] ⚠️ Fetch aborted');
          return;
        }
        console.error('[LoadHistory] ❌ Error:', err.message);
      }

      // ✅ FIX: Retry với delay nếu fail
      if (sessionRef.current === mySession && !isCancelled) {
        console.log('[LoadHistory] 🔄 Retrying in 3s...');
        setTimeout(() => {
          if (sessionRef.current === mySession && !isCancelled) {
            loadHistory();
          }
        }, 3000);
      }
    }
  };

  loadHistory();

  return () => {
    isCancelled = true;
    controller.abort();
    
    // Save hlines trước khi cleanup
    try {
      if (candleSeries.current) {
        const prices = getAllLinePrices(candleSeries.current);
        localStorage.setItem(hlineKey(selectedSymbol, market), JSON.stringify(prices));
      }
    } catch { }
    
    // Close WebSocket
    if (wsRef.current) {
      try { 
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.close(); 
      } catch { }
      wsRef.current = null;
    }
  };
}, [selectedSymbol, selectedInterval, market]);

  // ============================================
  // ✅ NEW: DYNAMIC INDICATOR VALUES - SEPARATED BY TYPE
  // ============================================
  
  // MA indicators
  const maIndicatorValues: IndicatorValue[] = useMemo(() => {
    return config.lines
      .filter(line => line.type === 'MA' && line.visible)
      .map(line => ({
        id: line.id,
        name: 'MA',
        period: line.period,
        value: candles.at(-1)?.close ?? 0,
        color: line.color,
        visible: line.visible,
      }));
  }, [config.lines, candles]);

  // EMA indicators
  const emaIndicatorValues: IndicatorValue[] = useMemo(() => {
    return config.lines
      .filter(line => line.type === 'EMA' && line.visible)
      .map(line => ({
        id: line.id,
        name: 'EMA',
        period: line.period,
        value: candles.at(-1)?.close ?? 0,
        color: line.color,
        visible: line.visible,
      }));
  }, [config.lines, candles]);

  // BOLL indicators
  const bollIndicatorValues: IndicatorValue[] = useMemo(() => {
    return config.bollingerBands
      .filter(boll => boll.visible)
      .map(boll => ({
        id: boll.id,
        name: 'BOLL',
        period: boll.period,
        stdDev: boll.stdDev,
        value: candles.at(-1)?.close ?? 0,
        color: boll.colors.upper,
        visible: boll.visible,
        label: 'UP',
        extraValues: [
          { label: 'MID', value: candles.at(-1)?.close ?? 0, color: boll.colors.middle },
          { label: 'LOW', value: candles.at(-1)?.close ?? 0, color: boll.colors.lower },
        ],
      }));
  }, [config.bollingerBands, candles]);

  // Check visibility by type
  const hasAnyMAVisible = useMemo(() => 
    config.lines.some(l => l.type === 'MA' && l.visible), 
    [config.lines]
  );
  const hasAnyEMAVisible = useMemo(() => 
    config.lines.some(l => l.type === 'EMA' && l.visible), 
    [config.lines]
  );
  const hasAnyBOLLVisible = useMemo(() => 
    config.bollingerBands.some(b => b.visible), 
    [config.bollingerBands]
  );

  // Volume MA indicators
  const volumeIndicatorValues: IndicatorValue[] = useMemo(() => {
    return config.volumeMA
      .filter(vol => vol.visible)
      .map(vol => ({
        id: vol.id,
        name: 'MA',
        period: vol.period,
        value: volumeData.at(-1)?.value ?? 0,
        color: vol.color,
        visible: vol.visible,
      }));
  }, [config.volumeMA, volumeData]);

  // Listen for symbol change requests
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { symbol } = e.detail;
      if (onRequestSymbolChange) {
        onRequestSymbolChange(symbol);
      }
    };
    window.addEventListener("chart-symbol-change-request", handler as EventListener);
    return () => window.removeEventListener("chart-symbol-change-request", handler as EventListener);
  }, [onRequestSymbolChange]);

  // Hide TradingView logo
  useEffect(() => {
    const hideLogo = (svg: Element) => {
      if (svg.getAttribute('viewBox') === '0 0 35 19') {
        (svg as HTMLElement).style.display = 'none';
        const parent = svg.parentElement;
        if (parent) (parent as HTMLElement).style.display = 'none';
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
            if (element.tagName === 'svg' && hideLogo(element)) return;
            const logos = element.querySelectorAll('svg[viewBox="0 0 35 19"]');
            logos.forEach(hideLogo);
          }
        });
      });
    });

    const mainContainer = mainChartContainerRef.current;
    const volumeContainer = volumeChartContainerRef.current;

    if (mainContainer) observer.observe(mainContainer, { childList: true, subtree: true });
    if (volumeContainer) observer.observe(volumeContainer, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  // ============================================
  // RENDER
  // ============================================
  
  // Check if indicator TYPE exists in config (not just visible)
  const hasMAInConfig = config.lines.some(l => l.type === 'MA');
  const hasEMAInConfig = config.lines.some(l => l.type === 'EMA');
  const hasBOLLInConfig = config.bollingerBands.length > 0;
  const hasVolumeMAInConfig = config.volumeMA.length > 0;

  // Calculate header positions - show header if type exists (regardless of visibility)
  const HEADER_HEIGHT = 22; // Approximate height of each header row
  let currentTop = 8;
  
  const maHeaderTop = currentTop;
  if (hasMAInConfig) currentTop += HEADER_HEIGHT;
  
  const emaHeaderTop = currentTop;
  if (hasEMAInConfig) currentTop += HEADER_HEIGHT;
  
  const bollHeaderTop = currentTop;

  return (
    <div className="relative w-full h-full bg-dark-900 text-dark-100 flex flex-col overflow-hidden">
      
      {/* ✅ MA Header - Hiện nếu có MA trong config */}
      {hasMAInConfig && (
        <div 
          className="absolute left-2 z-10 flex items-center gap-fluid-1.5"
          style={{ top: `${maHeaderTop}px` }}
        >
          <LineIndicatorHeader
            type="main"
            indicatorType="MA"
            noPosition={true}
            indicators={maIndicatorValues}
            linesVisible={hasAnyMAVisible}
            onToggleLinesVisible={() => {
              const maLines = config.lines.filter(l => l.type === 'MA');
              const anyVisible = maLines.some(l => l.visible);
              maLines.forEach(line => updateLine(line.id, { visible: !anyVisible }));
              if (!anyVisible && candles.length > 0) {
                setTimeout(() => updateMainIndicators(candles), 0);
              }
            }}
            onOpenSetting={() => setShowMainSettings(true)}
            onClose={() => {
              // Đóng hẳn = xóa tất cả MA khỏi config
              config.lines.filter(l => l.type === 'MA').forEach(line => removeLine(line.id));
            }}
            onRemoveIndicator={(id) => removeLine(id)}
          />
        </div>
      )}

      {/* ✅ EMA Header - Hiện nếu có EMA trong config */}
      {hasEMAInConfig && (
        <div 
          className="absolute left-2 z-10 flex items-center gap-fluid-1.5"
          style={{ top: `${emaHeaderTop}px` }}
        >
          <LineIndicatorHeader
            type="main"
            indicatorType="EMA"
            noPosition={true}
            indicators={emaIndicatorValues}
            linesVisible={hasAnyEMAVisible}
            onToggleLinesVisible={() => {
              const emaLines = config.lines.filter(l => l.type === 'EMA');
              const anyVisible = emaLines.some(l => l.visible);
              emaLines.forEach(line => updateLine(line.id, { visible: !anyVisible }));
              if (!anyVisible && candles.length > 0) {
                setTimeout(() => updateMainIndicators(candles), 0);
              }
            }}
            onOpenSetting={() => setShowMainSettings(true)}
            onClose={() => {
              // Đóng hẳn = xóa tất cả EMA khỏi config
              config.lines.filter(l => l.type === 'EMA').forEach(line => removeLine(line.id));
            }}
            onRemoveIndicator={(id) => removeLine(id)}
          />
        </div>
      )}

      {/* ✅ BOLL Header - Hiện nếu có BOLL trong config */}
      {hasBOLLInConfig && (
        <div 
          className="absolute left-2 z-10 flex items-center gap-fluid-1.5"
          style={{ top: `${bollHeaderTop}px` }}
        >
          <LineIndicatorHeader
            type="main"
            indicatorType="BOLL"
            noPosition={true}
            indicators={bollIndicatorValues}
            linesVisible={hasAnyBOLLVisible}
            onToggleLinesVisible={() => {
              const anyVisible = config.bollingerBands.some(b => b.visible);
              config.bollingerBands.forEach(boll => updateBoll(boll.id, { visible: !anyVisible }));
              if (!anyVisible && candles.length > 0) {
                setTimeout(() => updateMainIndicators(candles), 0);
              }
            }}
            onOpenSetting={() => setShowMainSettings(true)}
            onClose={() => {
              // Đóng hẳn = xóa tất cả BOLL khỏi config
              config.bollingerBands.forEach(boll => removeBoll(boll.id));
            }}
            onRemoveIndicator={(id) => removeBoll(id)}
          />
        </div>
      )}

      {/* ✅ Settings Modal - Dynamic */}
      {showMainSettings && createPortal(
        <LineIndicatorSettings
          type="main"
          defaultTab={1}
          config={config}
          onChange={(newConfig) => {
            // ✅ FIX: Check if structure changed (add/remove) vs just properties changed
            const linesChanged = newConfig.lines.length !== config.lines.length ||
              newConfig.lines.some((l, i) => config.lines[i]?.id !== l.id);
            const bollsChanged = newConfig.bollingerBands.length !== config.bollingerBands.length ||
              newConfig.bollingerBands.some((b, i) => config.bollingerBands[i]?.id !== b.id);
            const volumeChanged = newConfig.volumeMA.length !== config.volumeMA.length ||
              newConfig.volumeMA.some((v, i) => config.volumeMA[i]?.id !== v.id);
            
            const structureChanged = linesChanged || bollsChanged || volumeChanged;
            
            setConfig(newConfig);
            
            // ✅ Only reinitialize if structure changed (add/remove indicators)
            if (structureChanged) {
              // ✅ Use longer delay to ensure React has re-rendered and configRef is updated
              setTimeout(() => {
                initializeSeries();
                // Recalculate with current data after new series created
                setTimeout(() => {
                  if (candles.length > 0) {
                    updateMainIndicators(candles);
                  }
                  if (volumeData.length > 0) {
                    updateVolumeIndicators(volumeData);
                  }
                }, 50);
              }, 50);
            } else {
              // ✅ Just apply visibility/color/period changes without reinitializing
              newConfig.lines.forEach(line => {
                const series = lineSeriesRefs.current[line.id];
                if (series) {
                  series.applyOptions({ 
                    visible: line.visible,
                    color: line.color,
                    lineWidth: line.lineWidth as 1 | 2 | 3 | 4,
                  });
                }
              });
              
              newConfig.bollingerBands.forEach(boll => {
                const refs = bollSeriesRefs.current[boll.id];
                if (refs) {
                  refs.upper?.applyOptions({ visible: boll.visible, color: boll.colors.upper });
                  refs.middle?.applyOptions({ visible: boll.visible, color: boll.colors.middle });
                  refs.lower?.applyOptions({ visible: boll.visible, color: boll.colors.lower });
                }
              });
              
              // ✅ Recalculate if periods changed
              if (candles.length > 0) {
                updateMainIndicators(candles);
              }
              if (volumeData.length > 0) {
                updateVolumeIndicators(volumeData);
              }
            }
          }}
          onClose={() => setShowMainSettings(false)}
        />,
        document.body
      )}

      <FloatingPositionTag
        visible={!!floating && showPositionTag}
        price={floating?.price ?? 0}
        positionAmt={floating?.positionAmt ?? 0}
        pnl={floating?.pnl ?? 0}
        roi={floating?.roi ?? 0}
        series={candleSeries.current ?? undefined}
        containerRef={mainChartContainerRef}
        offset={12}
      />

      <ChartContextMenu
        open={ctxOpen}
        position={ctxPos}
        menuRef={menuRef}
        hoverPrice={hoverPrice}
        ctxClickPrice={ctxClickPriceRef.current}
        lastCandleClose={candles.at(-1)?.close ?? null}
        candleSeries={candleSeries.current}
        selectedSymbol={selectedSymbol}
        market={market}
        tickSize={
          symbolMetaCache.get(`${market}:${selectedSymbol.toUpperCase()}`)?.tickSize 
          ?? heuristicMetaFromPrice(candles.at(-1)?.close).tickSize
        }
        precision={
          symbolMetaCache.get(`${market}:${selectedSymbol.toUpperCase()}`)?.precision 
          ?? heuristicMetaFromPrice(candles.at(-1)?.close).precision
        }
        subMenuOpen={ctxSubOpen}
        onSubMenuOpen={setCtxSubOpen}
        onClose={() => setCtxOpen(false)}
        onRefreshChart={() => console.log('Refresh chart')}
        hlineKey={hlineKey(selectedSymbol, market)}
        snapToTick={snapToTick}
        availableBalance={availableBalance}
        leverage={leverage}
        onPlaceOrder={(params) => {
          console.log('[Chart Order]', params);
          binanceWS.placeOrder(params);
        }}
      />

      <div className="relative w-full h-full flex flex-col">
        {/* ✅ Watermark Logo - đặt NGOÀI container, overlay lên chart 
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          style={{ zIndex: 10, top: '35%', transform: 'translateY(-50%)' }}
        >
          <div 
            className="flex items-center gap-3"
            style={{ opacity: 0.07 }}
          >
            
            <svg 
              width="60" 
              height="60" 
              viewBox="0 0 40 40" 
              fill="none"
            >
              <path
                d="M20 4L6 12V28L20 36L34 28V12L20 4Z"
                stroke="#636166ff"
                strokeWidth="2"
                fill="none"
              />
              <path
                d="M20 10L12 15V25L20 30L28 25V15L20 10Z"
                fill="#636166ff"
              />
            </svg>
            
            <span 
              className="font-bold tracking-wider"
              style={{ color: '#636166ff', fontSize: '72px' }}
            >
              TW
            </span>
          </div>
        </div>
*/}
        <div
          ref={mainChartContainerRef}
          className="relative w-full"
          style={{ flex: '3 1 0%', minHeight: '300px', height: '75%' }}
          onContextMenu={openCtxMenu}
        />
<CandleCountdown
  interval={selectedInterval}
  currentPrice={candles.at(-1)?.close ?? 0}
  series={candleSeries.current}
  isUp={(candles.at(-1)?.close ?? 0) >= (candles.at(-1)?.open ?? 0)}
/>
        {/* ✅ High/Low Markers - Binance style */}
        <HighLowMarkers
          chartRef={chartRef}
          candleSeries={candleSeries.current}
          containerRef={mainChartContainerRef}
          candles={candles}
          precision={
            symbolMetaCache.get(`${market}:${selectedSymbol.toUpperCase()}`)?.precision 
            ?? heuristicMetaFromPrice(candles.at(-1)?.close).precision
          }
          visible={showHighLowMarkers}
        />
        <div
          className="w-full h-[2px] bg-[#2b3139] shrink-0 relative z-10"
          style={{ boxShadow: '0 0 3px rgba(80, 77, 77, 0.4)' }}
        />

        <div
          ref={volumeChartContainerRef}
          className="relative w-full"
          style={{ flex: '1 1 0%', minHeight: '100px', height: '25%', zIndex: 1, position: 'relative' }}
        >
          {/* ✅ Volume Indicators Header - Hiện nếu có Volume MA trong config */}
          {hasVolumeMAInConfig && (
            <LineIndicatorHeader
              type="volume"
              indicatorType="Volume"
              indicators={volumeIndicatorValues}
              linesVisible={hasAnyVolumeVisible}
              onToggleLinesVisible={() => {
                const anyVisible = config.volumeMA.some(v => v.visible);
                config.volumeMA.forEach(vol => updateVolumeMA(vol.id, { visible: !anyVisible }));
                
                if (!anyVisible && volumeData.length > 0) {
                  setTimeout(() => updateVolumeIndicators(volumeData), 0);
                }
              }}
              onOpenSetting={() => setShowVolumeSettings(true)}
              onClose={() => {
                // Đóng hẳn = xóa tất cả Volume MA khỏi config
                config.volumeMA.forEach(vol => removeVolumeMA(vol.id));
              }}
              onRemoveIndicator={(id) => removeVolumeMA(id)}
            />
          )}

          {showVolumeSettings && createPortal(
            <LineIndicatorSettings
              type="volume"
              defaultTab={2}
              config={config}
              onChange={(newConfig) => {
                // ✅ FIX: Check if structure changed
                const volumeChanged = newConfig.volumeMA.length !== config.volumeMA.length ||
                  newConfig.volumeMA.some((v, i) => config.volumeMA[i]?.id !== v.id);
                
                setConfig(newConfig);
                
                if (volumeChanged) {
                  // ✅ Use longer delay to ensure configRef is updated
                  setTimeout(() => {
                    initializeSeries();
                    setTimeout(() => {
                      if (volumeData.length > 0) {
                        updateVolumeIndicators(volumeData);
                      }
                    }, 50);
                  }, 50);
                } else {
                  // ✅ Just apply changes without reinitializing
                  newConfig.volumeMA.forEach(vol => {
                    const series = volumeSeriesRefs.current[vol.id];
                    if (series) {
                      series.applyOptions({ 
                        visible: vol.visible,
                        color: vol.color,
                      });
                    }
                  });
                  
                  if (volumeData.length > 0) {
                    updateVolumeIndicators(volumeData);
                  }
                }
              }}
              onClose={() => setShowVolumeSettings(false)}
            />,
            document.body
          )}
        </div>
      </div>
    </div>
  );
};

export default TradingBinance;