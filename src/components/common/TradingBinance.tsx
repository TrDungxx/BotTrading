import React, { useEffect, useRef, useState } from 'react';
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
// import BollingerBandsIndicator from './functionchart/BollingerBandsIndicator'; // ⚠️ Disabled - has internal error
import '../../style/Hidetradingviewlogo.css';
import LineIndicatorHeader from './popupchart/LineIndicatorHeader';
import LineIndicatorSettings from './popupchart/LineIndicatorSettings';
import { IndicatorValue } from './popupchart/LineIndicatorHeader';
import { MainIndicatorConfig, VolumeIndicatorConfig, IndicatorPeriods, IndicatorColors } from './popupchart/LineIndicatorSettings';
import ChartContextMenu from '../clickchart/ChartContextMenu';
// ✅ Import refactored modules
import { calculateMA, calculateEMA, calculateBollingerBands, calculateVolumeMA } from './utils/calculations';
import { useIndicators } from './hooks/useIndicators';
import { useBollingerBands } from './hooks/useBollingerBands';

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

  // ✅ USE REFACTORED HOOKS
  const {
    mainVisible,
    setMainVisible,
    volumeVisible,
    setVolumeVisible,
    indicatorPeriods,
    setIndicatorPeriods,
    indicatorColors,
    setIndicatorColors,
    bollFillVisible,
    setBollFillVisible,
    ma7Ref,
    ma25Ref,
    ma99Ref,
    ema12Ref,
    ema26Ref,
    mavol1Ref,
    mavol2Ref,
    updateMainIndicators,
    updateVolumeIndicators,
    clearAllIndicators,
    toggleAllMainIndicators,
    toggleAllVolumeIndicators,
    applyColorChanges,
  } = useIndicators({ selectedSymbol, market });

  const {
    bollData,
    setBollData,
    bollUpperRef,
    bollMiddleRef,
    bollLowerRef,
    bollCanvasRef,
    initializeCanvas,
    updateBollingerBands,
    clearBollingerBands,
    redrawBollFill,
  } = useBollingerBands({
    chartRef,
    candleSeriesRef: candleSeries,
    mainChartContainerRef,
    visible: mainVisible.boll,
    fillVisible: bollFillVisible,
    period: indicatorPeriods.boll.period,
    stdDev: indicatorPeriods.boll.stdDev,
    colors: indicatorColors.boll,
  });

  // Main chart & volume states
  const [mainIndicatorVisible, setMainIndicatorVisible] = useState(true);
  const [showMainSettings, setShowMainSettings] = useState(false);
  const [volumeIndicatorVisible, setVolumeIndicatorVisible] = useState(true);
  const [showVolumeSettings, setShowVolumeSettings] = useState(false);

  const [volumeData, setVolumeData] = useState<VolumeBar[]>([]);

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
  type PresetType = 'LIMIT' | 'STOP';

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
    updateBollingerBands,
    addHLine,
    hlineKey,
  });
  const isSyncingRef = useRef(false);
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
  
  // ===== BALANCE & LEVERAGE STATE =====
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [leverage, setLeverage] = useState<number>(10); // Default 10x

  // ===== SUBSCRIBE TO BALANCE UPDATES =====
  useEffect(() => {
    const handleMessage = (msg: any) => {
      // Balance update từ accountInformation
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
            setLeverage(prev => {
              if (prev !== lev) {
                console.log('[TradingBinance] Leverage synced:', lev);
              }
              return lev;
            });
          }
        }
      } catch (e) {
        console.warn('[TradingBinance] Failed to load leverage:', e);
      }
    };

    // Load initial
    loadLeverage();

    // Poll every 1 second to sync with TradingForm changes
    const interval = setInterval(loadLeverage, 1000);
    
    return () => clearInterval(interval);
  }, [market, selectedSymbol]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    let dragStartX: number | null = null;
    let dragStartLogical: number | null = null;

    const handleMouseDown = (param: any) => {
      if (!param || typeof param.point?.x !== 'number') return;
      const logical = param.logical;
      if (typeof logical === 'number') {
        dragStartX = param.point.x;
        dragStartLogical = logical;
      }
    };

    const handleMouseMove = (param: any) => {
      if (dragStartX !== null && dragStartLogical !== null && param?.point?.x !== undefined) {
        const currentX = param.point.x;
        const deltaX = currentX - dragStartX;

        const barSpacing = chart.timeScale().options().barSpacing || 6;
        const barsDelta = Math.round(deltaX / barSpacing);

        if (barsDelta !== 0) {
          dragStartX = currentX;
        }
      }
    };

    const handleMouseUp = () => {
      dragStartX = null;
      dragStartLogical = null;
    };

    chart.subscribeClick(handleMouseDown);
    chart.subscribeCrosshairMove(handleMouseMove);

    const container = mainChartContainerRef.current;
    if (container) {
      container.addEventListener('mouseup', handleMouseUp);
      container.addEventListener('mouseleave', handleMouseUp);
    }

    return () => {
      if (container) {
        container.removeEventListener('mouseup', handleMouseUp);
        container.removeEventListener('mouseleave', handleMouseUp);
      }
    };
  }, []);

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

    // Lấy bounding rect từ element được click (e.currentTarget)
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;

    console.log('[Context Menu] Click position:', {
      clientY: e.clientY,
      rectTop: rect.top,
      rectBottom: rect.bottom,
      rectHeight: rect.height,
      relativeY: y
    });

    // Tính giá trực tiếp từ Y coordinate
    try {
      const price = candleSeries.current.coordinateToPrice(y);
      
      if (price !== null && Number.isFinite(price)) {
        ctxClickPriceRef.current = price;
        console.log('[Context Menu] ✅ Price from coordinateToPrice:', price);
      } else {
        // Fallback
        const fallbackPrice = candles.at(-1)?.close ?? null;
        ctxClickPriceRef.current = fallbackPrice;
        console.log('[Context Menu] ⚠️ Using fallback price:', fallbackPrice);
      }
    } catch (err) {
      console.warn('[Context Menu] ❌ coordinateToPrice error:', err);
      ctxClickPriceRef.current = candles.at(-1)?.close ?? null;
    }

    setCtxPos({ x: e.clientX, y: e.clientY });
    setCtxOpen(true);
    setCtxSubOpen(false);
  };

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

  // Sync bollData changes
  useEffect(() => {
    setBollData(null);
  }, [selectedSymbol, selectedInterval, market]);

  // ✅ Auto redraw BOLL fill when data changes
  useEffect(() => {
    if (mainVisible.boll && bollFillVisible && bollData?.upper?.length) {
      requestAnimationFrame(() => redrawBollFill()); // Instant
    }
  }, [bollData, mainVisible.boll, bollFillVisible, redrawBollFill]);

  // Main chart initialization
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

    });

    chartRef.current = mainChart;

    const volumeChart = createChart(volumeEl, {
      autoSize: true,
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

    // ✅ Add MA series (refs from useIndicators)
    ma7Ref.current = mainChart.addLineSeries({
      color: indicatorColors.ma7,
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: mainVisible.ma7,
    });
    ma25Ref.current = mainChart.addLineSeries({
      color: indicatorColors.ma25,
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: mainVisible.ma25,
    });
    ma99Ref.current = mainChart.addLineSeries({
      color: indicatorColors.ma99,
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: mainVisible.ma99,
    });

    // ✅ Add EMA series
    ema12Ref.current = mainChart.addLineSeries({
      color: indicatorColors.ema12,
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: mainVisible.ema12,
      lineStyle: 0,
    });

    ema26Ref.current = mainChart.addLineSeries({
      color: indicatorColors.ema26,
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: mainVisible.ema26,
      lineStyle: 0,
    });

    // ✅ Add BOLL series (refs from useBollingerBands)
    bollUpperRef.current = mainChart.addLineSeries({
      color: indicatorColors.boll.upper,
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: mainVisible.boll,
      lineStyle: 0,
    });

    bollMiddleRef.current = mainChart.addLineSeries({
      color: indicatorColors.boll.middle,
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: mainVisible.boll,
      lineStyle: 2,
    });

    bollLowerRef.current = mainChart.addLineSeries({
      color: indicatorColors.boll.lower,
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: mainVisible.boll,
      lineStyle: 0,
    });

    // ✅ Initialize BOLL canvas overlay
    initializeCanvas();

    // ✅ Add volume MA series
    mavol1Ref.current = volumeChart.addLineSeries({
      color: indicatorColors.mavol1,
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: volumeVisible.mavol1,
    });

    mavol2Ref.current = volumeChart.addLineSeries({
      color: indicatorColors.mavol2,
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: volumeVisible.mavol2,
    });

    // Subscribe to BOLL redraw events
    mainChart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      if (mainVisible.boll && bollFillVisible) {
        requestAnimationFrame(() => redrawBollFill()); // Smooth 60fps
      }
    });

    // ✅ Also redraw on crosshair move (for smooth updates)
    let redrawTimeout: NodeJS.Timeout | null = null;
    const handleCrosshairMove = (param: any) => {
      // Lấy giá từ Y coordinate (chính xác cho mọi vị trí trên chart)
      if (param.point && param.point.y !== undefined && candleSeries.current) {
        try {
          const price = candleSeries.current.coordinateToPrice(param.point.y);
          if (price !== null && Number.isFinite(price)) {
            setHoverPrice(price);
          }
        } catch (e) {
          // Fallback: lấy từ candle data
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
        // Fallback cũ: lấy từ candle
        const price = param.seriesData.get(candleSeries.current!)?.close;
        if (typeof price === 'number') {
          setHoverPrice(price);
        }
      } else {
        setHoverPrice(null);
      }

      // Update hover time
      if (param.time) {
        setHoverTime(param.time as UTCTimestamp);
      } else {
        setHoverTime(null);
      }

      // Debounced redraw for BOLL fill
      if (mainVisible.boll && bollFillVisible && bollData?.upper?.length) {
        requestAnimationFrame(() => redrawBollFill()); // Instant, no debounce
      }
    };

    mainChart.subscribeCrosshairMove(handleCrosshairMove);

    // ✅ Redraw BOLL fill on chart resize
    const resizeObserver = new ResizeObserver(() => {
      if (bollCanvasRef.current && chartRef.current) {
        const mainEl = mainChartContainerRef.current;
        if (mainEl) {
          bollCanvasRef.current.width = mainEl.clientWidth;
          bollCanvasRef.current.height = mainEl.clientHeight;
        }
      }
      if (mainVisible.boll && bollFillVisible && bollData?.upper?.length) {
        setTimeout(() => redrawBollFill(), 100);
      }
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

  // Data loading useEffect
  useEffect(() => {
    if (!candleSeries.current || !volumeSeries.current || !chartRef.current) return;

    const mySession = ++sessionRef.current;

    console.log('[LoadHistory] 🔄 Starting load for', selectedSymbol, selectedInterval, market);

    try {
      candleSeries.current.setData([]);
      volumeSeries.current.setData([]);

      // ✅ Clear indicators using hooks
      clearAllIndicators();
      clearBollingerBands();
    } catch (e) {
      console.warn('[LoadHistory] ⚠️ Failed to clear series:', e);
    }

    try {
      if (wsRef.current) {
        console.log('[WS] 🔌 Closing old WebSocket');
        wsRef.current.close();
        wsRef.current = null;
      }
    } catch { }

    const restBase = market === 'futures'
      ? 'https://fapi.binance.com'
      : 'https://data.binance.com';

    const wsBase = market === 'futures'
      ? 'wss://fstream.binance.com/ws'
      : 'wss://stream.binance.com:9443/ws';

    const controller = new AbortController();

    const loadHistory = async () => {
      const path = market === 'futures' ? '/fapi/v1/klines' : '/api/v3/klines';
      const symbolUpper = selectedSymbol.toUpperCase().trim(); // ✅ FIX: Trim whitespace
      const url = `${restBase}${path}?symbol=${symbolUpper}&interval=${selectedInterval}&limit=500`;

      console.log('[LoadHistory] 🔄 Fetching:', url);
      console.log('[LoadHistory] 📌 Symbol:', symbolUpper, '| Market:', market, '| Interval:', selectedInterval);

      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          }
        });

        // ✅ FIX: Log response status chi tiết
        console.log('[LoadHistory] 📡 Response:', res.status, res.statusText);

        if (!res.ok) {
          const errorText = await res.text();
          console.error('[LoadHistory] ❌ API Error:', errorText);

          // ✅ FIX: Parse Binance error
          try {
            const errJson = JSON.parse(errorText);
            if (errJson.code === -1121) {
              console.error(`[LoadHistory] ❌ Symbol "${symbolUpper}" KHÔNG TỒN TẠI trên ${market.toUpperCase()}!`);
            }
          } catch { }

          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();

        // ✅ FIX: Log data info
        console.log('[LoadHistory] 📊 Data:', Array.isArray(data) ? `${data.length} klines` : typeof data);

        if (!Array.isArray(data)) {
          console.error('[LoadHistory] ❌ Invalid response:', data);
          // ✅ FIX: Check Binance error object
          if (data && typeof data === 'object' && 'code' in data) {
            console.error('[LoadHistory] ❌ Binance Error:', data.code, data.msg);
          }
          throw new Error('Expected array of klines');
        }

        if (data.length === 0) {
          console.warn('[LoadHistory] ⚠️ Empty data for', symbolUpper, '- Coin có thể không có trên', market);
          return;
        }

        if (sessionRef.current !== mySession) {
          console.log('[LoadHistory] ⏭️ Stale session:', mySession, '→', sessionRef.current);
          return;
        }

        // ✅ FIX: Validate kline format
        if (!Array.isArray(data[0]) || data[0].length < 6) {
          console.error('[LoadHistory] ❌ Invalid kline format:', data[0]);
          throw new Error('Invalid kline format');
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

        console.log('[LoadHistory] ✅ Loaded', cs.length, 'candles | Last:', cs[cs.length - 1]?.close);

        // ✅ FIX: Check series refs before setData
        if (!candleSeries.current || !volumeSeries.current) {
          console.error('[LoadHistory] ❌ Chart series not ready!');
          return;
        }

        candleSeries.current.setData(cs);
        volumeSeries.current.setData(vs);
        setVolumeData(vs);

        // ✅ Update indicators using hooks (no more duplication!)
        updateMainIndicators(cs);
        updateVolumeIndicators(vs);
        updateBollingerBands(cs);

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
        } catch { }

        setCandles(cs);

        // Setup WebSocket for real-time updates
        const ws = new WebSocket(`${wsBase}/${selectedSymbol.toLowerCase()}@kline_${selectedInterval}`);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[WS] ✅ Connected for', selectedSymbol, selectedInterval);
        };

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
            // ✅ Dùng hook để update series
            updateSeriesData(candle);
            volumeSeries.current.update(vol);

            setVolumeData((prev) => {
              const i = prev.findIndex((v) => v.time === vol.time);
              const next = i >= 0
                ? [...prev.slice(0, i), vol, ...prev.slice(i + 1)]
                : [...prev, vol];

              if (next.length > 500) next.shift();

              updateVolumeIndicators(next);

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

            updateMainIndicators(next);
            updateBollingerBands(next);

            return next;
          });
        };

        ws.onerror = (error) => {
          console.error('[WS] ❌ WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('[WS] 🔌 WebSocket closed for', selectedSymbol);
        };

      } catch (err) {
        // ✅ FIX: Better error handling
        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            console.log('[LoadHistory] ⏹️ Request aborted (symbol changed)');
            return; // Don't retry on abort
          }
          console.error('[LoadHistory] ❌ Error:', err.message);
        } else {
          console.error('[LoadHistory] ❌ Unknown error:', err);
        }

        if (sessionRef.current === mySession) {
          console.log('[LoadHistory] 🔄 Retrying in 3 seconds...');
          setTimeout(() => {
            if (sessionRef.current === mySession) {
              loadHistory();
            }
          }, 3000);
        }
      }
    };

    loadHistory();

    return () => {
      console.log('[Cleanup] 🧹 Cleaning up for', selectedSymbol);

      try {
        if (candleSeries.current) {
          const prices = getAllLinePrices(candleSeries.current);
          localStorage.setItem(hlineKey(selectedSymbol, market), JSON.stringify(prices));
        }
      } catch { }

      controller.abort();
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch { }
      }
    };
  }, [selectedSymbol, selectedInterval, market]);

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

  const volumeIndicatorValues: IndicatorValue[] = [
    volumeVisible.mavol1 && {
      name: 'MA',
      period: indicatorPeriods.mavol1,
      value: volumeData.at(-1)?.value ?? 0,
      color: indicatorColors.mavol1!,
      visible: volumeVisible.mavol1,
    },
    volumeVisible.mavol2 && {
      name: 'MA',
      period: indicatorPeriods.mavol2,
      value: volumeData.at(-1)?.value ?? 0,
      color: indicatorColors.mavol2!,
      visible: volumeVisible.mavol2,
    },
  ].filter(Boolean) as IndicatorValue[];

  // ✅ Listen for symbol change requests from Position component
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { symbol } = e.detail;
      console.log("📊 Chart received symbol change request:", symbol);

      if (onRequestSymbolChange) {
        onRequestSymbolChange(symbol);
      }
    };

    window.addEventListener("chart-symbol-change-request", handler as EventListener);
    return () => window.removeEventListener("chart-symbol-change-request", handler as EventListener);
  }, [onRequestSymbolChange]);

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


  return (
    <div className="relative w-full h-full bg-dark-900 text-dark-100 flex flex-col overflow-hidden">
      {mainIndicatorVisible && (
        <LineIndicatorHeader
          type="main"
          indicators={mainIndicatorValues}
          visible={
            mainVisible.ma7 ||
            mainVisible.ma25 ||
            mainVisible.ma99 ||
            mainVisible.ema12 ||
            mainVisible.ema26
          }
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
              boll: false,
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

      {mainVisible.boll && bollData?.upper?.length && (
        <div
          className="flex items-center gap-1.5 z-10"
          style={{
            position: 'absolute',
            top: mainIndicatorVisible ? '34px' : '8px',
            left: '8px'
          }}
        >
          <LineIndicatorHeader
            type="main"
            noPosition={true}
            indicators={[
              {
                name: 'BOLL',
                period: indicatorPeriods.boll.period,
                stdDev: indicatorPeriods.boll.stdDev,
                value: bollData.upper[bollData.upper.length - 1]?.value || 0,
                color: indicatorColors.boll.upper,
                visible: mainVisible.boll,
                label: 'UP',
                extraValues: [
                  {
                    label: 'MID',
                    value: bollData.middle[bollData.middle.length - 1]?.value || 0,
                    color: indicatorColors.boll.middle,
                  },
                  {
                    label: 'LOW',
                    value: bollData.lower[bollData.lower.length - 1]?.value || 0,
                    color: indicatorColors.boll.lower,
                  }
                ]
              }
            ]}
            visible={mainVisible.boll}
            onToggleVisible={() => {
              setMainVisible({ ...mainVisible, boll: !mainVisible.boll });
              bollUpperRef.current?.applyOptions({ visible: !mainVisible.boll });
              bollMiddleRef.current?.applyOptions({ visible: !mainVisible.boll });
              bollLowerRef.current?.applyOptions({ visible: !mainVisible.boll });
              if (!mainVisible.boll) {
                clearBollingerBands();
              }
            }}
            onOpenSetting={() => setShowMainSettings(true)}
            onClose={() => {
              setMainVisible({ ...mainVisible, boll: false });
              bollUpperRef.current?.applyOptions({ visible: false });
              bollMiddleRef.current?.applyOptions({ visible: false });
              bollLowerRef.current?.applyOptions({ visible: false });
              clearBollingerBands();
            }}
          />

          {/* Fill toggle button */}
          <button
            onClick={() => {
              setBollFillVisible(!bollFillVisible);
              requestAnimationFrame(() => redrawBollFill()); // Instant
            }}
            className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${bollFillVisible
              ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
              : 'bg-dark-800/80 text-dark-300 border border-dark-600/50 hover:bg-dark-700/80'
              }`}
          >
            Fill
          </button>
        </div>
      )}

      {showMainSettings && createPortal(
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
            }

            if (bollFillVis !== undefined) {
              setBollFillVisible(bollFillVis);
            }

            if (per) setIndicatorPeriods(per);

            if (col) {
              setIndicatorColors(col);
              applyColorChanges(col);

              if (col.boll) {
                bollUpperRef.current?.applyOptions({ color: col.boll.upper });
                bollMiddleRef.current?.applyOptions({ color: col.boll.middle });
                bollLowerRef.current?.applyOptions({ color: col.boll.lower });
              }
            }

            // ✅ Recalculate khi periods thay đổi (no duplication!)
            if (per && candles.length > 0) {
              updateMainIndicators(candles);
              updateBollingerBands(candles);
            }

            if (per && volumeData.length > 0) {
              updateVolumeIndicators(volumeData);
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
  tickSize={symbolMetaCache.get(`${market}:${selectedSymbol.toUpperCase()}`)?.tickSize ?? 0.01}
  precision={symbolMetaCache.get(`${market}:${selectedSymbol.toUpperCase()}`)?.precision ?? 2}
  subMenuOpen={ctxSubOpen}
  onSubMenuOpen={setCtxSubOpen}
  onClose={() => setCtxOpen(false)}
  onRefreshChart={() => {
    console.log('Refresh chart');
  }}
  hlineKey={hlineKey(selectedSymbol, market)}
  snapToTick={snapToTick}
  // ⚠️ QUAN TRỌNG: Truyền balance và leverage từ TradingForm/WebSocket
  availableBalance={availableBalance}  // Số dư khả dụng từ WebSocket
  leverage={leverage}                  // Đòn bẩy hiện tại
  // ⚠️ QUAN TRỌNG: Truyền callback đặt lệnh
  onPlaceOrder={(params) => {
    console.log('[Chart Order]', params);
    binanceWS.placeOrder(params);
  }}
  
/>



      <div className="relative w-full h-full flex flex-col">
        <div
          ref={mainChartContainerRef}
          className="relative w-full"
          style={{
            flex: '3 1 0%',
            minHeight: '300px',
            height: '75%'
          }}
          onContextMenu={openCtxMenu}
        />

        <div
          className="w-full h-[2px] bg-[#2b3139] shrink-0 relative z-10"
          style={{ boxShadow: '0 0 3px rgba(80, 77, 77, 0.4)' }}
        />

        <div
          ref={volumeChartContainerRef}
          className="relative w-full"
          style={{
            flex: '1 1 0%',
            minHeight: '100px',
            height: '25%',
            zIndex: 1,
            position: 'relative'
          }}
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
          {showVolumeSettings && createPortal(
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
                // ✅ Recalculate (no duplication!)
                if (per && candles.length > 0) {
                  updateMainIndicators(candles);
                }

                if (per && volumeData.length > 0) {
                  updateVolumeIndicators(volumeData);
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