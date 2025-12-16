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

import FloatingPositionTag from '../tabposition/FloatingPositionTag';
import { binanceWS } from '../binancewebsocket/BinanceWebSocketService';
import { copyPrice } from '../clickchart/CopyPrice';
import { addHLine, clearAllHLines, getAllLinePrices } from '../clickchart/hline';
import AlertModal from '../clickchart/AlertModal';
import NewOrderModal from '../clickchart/NewOrderModal';
// import BollingerBandsIndicator from './functionchart/BollingerBandsIndicator'; // ⚠️ Disabled - has internal error
import '../../style/Hidetradingviewlogo.css';
import LineIndicatorHeader from './popupchart/LineIndicatorHeader';
import LineIndicatorSettings from './popupchart/LineIndicatorSettings';
import { IndicatorValue } from './popupchart/LineIndicatorHeader';
import { MainIndicatorConfig, VolumeIndicatorConfig, IndicatorPeriods, IndicatorColors } from './popupchart/LineIndicatorSettings';

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
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mainChartContainerRef = useRef<HTMLDivElement | null>(null);
  const volumeChartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const volumeChartRef = useRef<IChartApi | null>(null);

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
    mainVisibleRef,
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

  const openCtxMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!chartRef.current || !candleSeries.current) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctxClickYRef.current = y;

    const coordinate = chartRef.current.timeScale().coordinateToTime(x);
    const priceCoord = candleSeries.current.coordinateToPrice(y);

    if (priceCoord !== null && typeof priceCoord === 'number' && !isNaN(priceCoord)) {
      ctxClickPriceRef.current = priceCoord;
    } else {
      ctxClickPriceRef.current = null;
    }

    if (!coordinate) {
      ctxClickPriceRef.current = null;
    }

    setCtxPos({ x: e.clientX, y: e.clientY });
    setCtxOpen(true);
    setCtxSubOpen(false);
  };

  const updatePriceFormat = async (data: Candle[]) => {
    if (!data.length) return;

    try {
      const meta = await getSymbolMeta(selectedSymbol, market);

      const priceScale = chartRef.current?.priceScale('right');
      if (priceScale && candleSeries.current) {
        priceScale.applyOptions({
          autoScale: true,
          scaleMargins: { top: 0.08, bottom: 0.02 },
        });

        candleSeries.current.applyOptions({
          priceFormat: {
            type: 'price',
            precision: meta.precision,
            minMove: meta.tickSize,
          },
        });
      }
    } catch (err) {
      console.warn('[UpdatePriceFormat] Failed, using heuristic', err);
      const lastClose = data.at(-1)?.close ?? 1;
      const heuristic = heuristicMetaFromPrice(lastClose);

      const priceScale = chartRef.current?.priceScale('right');
      if (priceScale && candleSeries.current) {
        priceScale.applyOptions({
          autoScale: true,
          scaleMargins: { top: 0.08, bottom: 0.02 },
        });

        candleSeries.current.applyOptions({
          priceFormat: {
            type: 'price',
            precision: heuristic.precision,
            minMove: heuristic.tickSize,
          },
        });
      }
    }
  };

  const pickPos = (arr: any[]) => {
    if (!arr || !Array.isArray(arr)) return;
    const item = arr.find((p: any) => p.symbol?.toUpperCase() === selectedSymbol.toUpperCase());
    if (!item) return;

    const amt = parseFloat(item.positionAmt ?? '0');
    if (Math.abs(amt) < 0.00001) {
      setFloatingPos(undefined);
    } else {
      setFloatingPos({
        symbol: item.symbol,
        positionAmt: item.positionAmt,
        entryPrice: item.entryPrice,
        markPrice: item.markPrice,
      });
    }
  };

  useEffect(() => {
    if (market !== 'futures') {
      setFloatingPos(undefined);
      return;
    }
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
  }, [selectedSymbol, market]);

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

  // Sync bollData changes
  useEffect(() => {
    setBollData(null);
  }, [selectedSymbol, selectedInterval, market]);

  // ✅ Auto redraw BOLL fill when data changes
  useEffect(() => {
    if (mainVisible.boll && bollFillVisible && bollData?.upper?.length) {
      setTimeout(() => redrawBollFill(), 100);
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
        redrawBollFill();
      }
    });

    mainChart.subscribeCrosshairMove((param) => {
      if (param.time && param.seriesData.has(candleSeries.current!)) {
        const price = param.seriesData.get(candleSeries.current!)?.close;
        if (typeof price === 'number') {
          setHoverPrice(price);
        }
        setHoverTime(param.time as UTCTimestamp);
      } else {
        setHoverPrice(null);
        setHoverTime(null);
      }
    });

    return () => {
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
      const url = `${restBase}${path}?symbol=${selectedSymbol.toUpperCase()}&interval=${selectedInterval}&limit=500`;

      console.log('[LoadHistory] 🔄 Fetching:', url);

      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          }
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();

        if (!Array.isArray(data)) {
          console.error('[LoadHistory] ❌ Invalid response type:', typeof data);
          throw new Error('Expected array of klines');
        }

        if (data.length === 0) {
          console.warn('[LoadHistory] ⚠️ No data returned for', selectedSymbol);
          return;
        }

        if (sessionRef.current !== mySession) {
          console.log('[LoadHistory] ⏭️ Skipping stale data (session changed)');
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

        console.log('[LoadHistory] ✅ Loaded', cs.length, 'candles for', selectedSymbol);

        candleSeries.current!.setData(cs);
        volumeSeries.current!.setData(vs);
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
            candleSeries.current.update(candle);
            volumeSeries.current.update(vol);

            setVolumeData((prev) => {
              const i = prev.findIndex((v) => v.time === vol.time);
              const next = i >= 0
                ? [...prev.slice(0, i), vol, ...prev.slice(i + 1)]
                : [...prev, vol];

              if (next.length > 500) next.shift();

              // ✅ Update volume indicators
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

            // ✅ Update main indicators (no more duplication!)
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
        console.error('[LoadHistory] ❌ Error:', err);

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

      {/* ⚠️ BollingerBandsIndicator có lỗi internal ở dòng 151
          Các đường BOLL vẫn vẽ được trên chart, chỉ không có header
          Cần fix file BollingerBandsIndicator.tsx dòng 151 để bật lại */}
      {/* {mainVisible.boll && bollData?.upper?.length && (
        <BollingerBandsIndicator
          data={{
            upper: bollData.upper || [],
            middle: bollData.middle || [],
            lower: bollData.lower || []
          }}
          visible={mainVisible.boll}
          fillVisible={bollFillVisible}
          period={indicatorPeriods.boll.period}
          stdDev={indicatorPeriods.boll.stdDev}
          colors={indicatorColors.boll}
          onToggleVisible={() => {
            setMainVisible({ ...mainVisible, boll: !mainVisible.boll });
            bollUpperRef.current?.applyOptions({ visible: !mainVisible.boll });
            bollMiddleRef.current?.applyOptions({ visible: !mainVisible.boll });
            bollLowerRef.current?.applyOptions({ visible: !mainVisible.boll });
            if (!mainVisible.boll) {
              clearBollingerBands();
            }
          }}
          onToggleFill={() => {
            setBollFillVisible(!bollFillVisible);
            setTimeout(() => redrawBollFill(), 50);
          }}
          onClose={() => {
            setMainVisible({ ...mainVisible, boll: false });
            bollUpperRef.current?.applyOptions({ visible: false });
            bollMiddleRef.current?.applyOptions({ visible: false });
            bollLowerRef.current?.applyOptions({ visible: false });
            clearBollingerBands();
          }}
        />
      )} */}

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
                } catch { }

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
                  } catch { }
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