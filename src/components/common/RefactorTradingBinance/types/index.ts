import { CandlestickData, UTCTimestamp, HistogramData, LineData, Time } from 'lightweight-charts';

/**
 * Chart types supported
 */
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

/**
 * Market types
 */
export type MarketType = 'spot' | 'futures';

/**
 * Symbol metadata (THÊM CÁI NÀY!)
 */
export type SymbolMeta = {
  tickSize: number;
  stepSize?: number;
  precision: number;
};

/**
 * Candle data type
 */
export type Candle = CandlestickData<UTCTimestamp>;

/**
 * Volume bar type
 */
export type VolumeBar = HistogramData<UTCTimestamp>;

/**
 * Kline WebSocket message
 */
export type KlineMessage = {
  k: { 
    t: number; 
    o: string; 
    h: string; 
    l: string; 
    c: string; 
    v: string; 
    x?: boolean 
  };
};

/**
 * Position data for floating tag
 */
export type PositionForTag = {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice?: string;
};

/**
 * Main indicator visibility config
 */
export type MainIndicatorConfig = {
  ma7: boolean;
  ma25: boolean;
  ma99: boolean;
  ema12: boolean;
  ema26: boolean;
  boll: boolean;
};

/**
 * Volume indicator visibility config
 */
export type VolumeIndicatorConfig = {
  mavol1: boolean;
  mavol2: boolean;
};

/**
 * Secondary indicator visibility config
 */
export type SecondaryIndicatorConfig = {
  macd: boolean;
  rsi: boolean;
};

/**
 * Indicator periods configuration
 */
export type IndicatorPeriods = {
  ma7: number;
  ma25: number;
  ma99: number;
  ema12: number;
  ema26: number;
  boll: number;
  bollStdDev: number;
  mavol1: number;
  mavol2: number;
  macd: { fast: number; slow: number; signal: number };
  rsi: number;
};

/**
 * Indicator colors configuration
 */
export type IndicatorColors = {
  ma7: string;
  ma25: string;
  ma99: string;
  ema12: string;
  ema26: string;
  boll: string;
  mavol1: string;
  mavol2: string;
  macd: string;
  macdSignal: string;
  rsi: string;
};

/**
 * Indicator value for display
 */
export type IndicatorValue = {
  label: string;
  value: string;
  color: string;
};

/**
 * Order side
 */
export type OrderSide = 'BUY' | 'SELL';

/**
 * Order type
 */
export type OrderType = 'LIMIT' | 'MARKET' | 'STOP_MARKET' | 'STOP_LOSS_LIMIT';

/**
 * Position side (futures only)
 */
export type PositionSide = 'LONG' | 'SHORT' | 'BOTH';

/**
 * Time in force
 */
export type TimeInForce = 'GTC' | 'IOC' | 'FOK';

/**
 * Chart interaction mode
 */
export type InteractionMode = 
  | 'default'
  | 'drawing-hline'
  | 'drawing-trend'
  | 'measuring';

/**
 * Props for TradingBinance component
 */
export interface TradingBinanceProps {
  selectedSymbol: string;
  selectedInterval: string;
  market: MarketType;
  floating?: { 
    pnl: number; 
    roi: number; 
    price: number; 
    positionAmt: number 
  } | null;
  showPositionTag?: boolean;
  onRequestSymbolChange?: (symbol: string) => void;
  chartType?: ChartType;
  onChartTypeChange?: (t: ChartType) => void;
}

/**
 * Context menu position
 */
export interface ContextMenuPosition {
  x: number;
  y: number;
}