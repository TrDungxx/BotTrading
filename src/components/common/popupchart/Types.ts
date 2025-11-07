/**
 * Type Definitions for LineIndicator Components
 * 
 * @file types.ts
 * @description Central type definitions cho indicator system
 */

import { Time } from 'lightweight-charts';

// ============================================
// INDICATOR VALUE TYPES
// ============================================

/**
 * Cấu trúc dữ liệu cho một indicator value hiển thị trên header
 */
export interface IndicatorValue {
  /** Tên indicator (VD: MA, EMA, MAVOL) */
  name: string;
  
  /** Period của indicator (VD: 7, 25, 99) */
  period?: number;
  
  /** Giá trị hiện tại của indicator */
  value: number;
  
  /** Màu sắc hiển thị */
  color: string;
  
  /** Có đang hiển thị không */
  visible?: boolean;
}

// ============================================
// VISIBILITY CONFIGS
// ============================================

/**
 * Config visibility cho indicators của Main Chart
 */
export interface MainIndicatorConfig {
  /** Moving Average 7 */
  ma7: boolean;
  
  /** Moving Average 25 */
  ma25: boolean;
  
  /** Moving Average 99 */
  ma99: boolean;
  
  /** Exponential Moving Average 12 */
  ema12: boolean;
  
  /** Exponential Moving Average 26 */
  ema26: boolean;
}

/**
 * Config visibility cho indicators của Volume Chart
 */
export interface VolumeIndicatorConfig {
  /** Moving Average Volume 1 */
  mavol1: boolean;
  
  /** Moving Average Volume 2 */
  mavol2: boolean;
}

/**
 * Config visibility cho Sub Indicators
 */
export interface SubIndicatorConfig {
  /** Volume indicator */
  vol: boolean;
  
  /** Moving Average Convergence Divergence */
  macd: boolean;
  
  /** Relative Strength Index */
  rsi: boolean;
  
  /** Money Flow Index */
  mfi: boolean;
  
  /** KDJ Stochastic Oscillator */
  kdj: boolean;
  
  /** On-Balance Volume */
  obv: boolean;
  
  /** Commodity Channel Index */
  cci: boolean;
  
  /** Stochastic RSI */
  stochRsi: boolean;
  
  /** Williams %R */
  wr: boolean;
}

// ============================================
// PERIOD CONFIGS
// ============================================

/**
 * MACD Parameters
 */
export interface MACDPeriods {
  /** Fast EMA period */
  fast: number;
  
  /** Slow EMA period */
  slow: number;
  
  /** Signal line period */
  signal: number;
}

/**
 * KDJ Parameters
 */
export interface KDJPeriods {
  /** K period */
  k: number;
  
  /** D period */
  d: number;
}

/**
 * Stochastic RSI Parameters
 */
export interface StochRSIPeriods {
  /** RSI period */
  period: number;
  
  /** %K period */
  k: number;
  
  /** %D period */
  d: number;
}

/**
 * Config periods cho tất cả indicators
 */
export interface IndicatorPeriods {
  // Main Chart - Moving Averages
  ma7?: number;
  ma25?: number;
  ma99?: number;
  ema12?: number;
  ema26?: number;
  
  // Volume Chart
  mavol1?: number;
  mavol2?: number;
  
  // Sub Indicators
  macd?: MACDPeriods;
  rsi?: number;
  mfi?: number;
  kdj?: KDJPeriods;
  cci?: number;
  stochRsi?: StochRSIPeriods;
  wr?: number;
}

// ============================================
// COLOR CONFIGS
// ============================================

/**
 * MACD Colors
 */
export interface MACDColors {
  /** MACD line color */
  macd: string;
  
  /** Signal line color */
  signal: string;
  
  /** Histogram color */
  histogram: string;
}

/**
 * KDJ Colors
 */
export interface KDJColors {
  /** K line color */
  k: string;
  
  /** D line color */
  d: string;
  
  /** J line color */
  j: string;
}

/**
 * Stochastic RSI Colors
 */
export interface StochRSIColors {
  /** %K line color */
  k: string;
  
  /** %D line color */
  d: string;
}

/**
 * Config colors cho tất cả indicators
 */
export interface IndicatorColors {
  // Main Chart - Moving Averages
  ma7?: string;
  ma25?: string;
  ma99?: string;
  ema12?: string;
  ema26?: string;
  
  // Volume Chart
  mavol1?: string;
  mavol2?: string;
  
  // Sub Indicators
  macd?: MACDColors;
  rsi?: string;
  mfi?: string;
  kdj?: KDJColors;
  obv?: string;
  cci?: string;
  stochRsi?: StochRSIColors;
  wr?: string;
}

// ============================================
// COMPONENT PROPS
// ============================================

/**
 * Props cho LineIndicatorHeader component
 */
export interface LineIndicatorHeaderProps {
  /** Array của indicator values để hiển thị */
  indicators: IndicatorValue[];
  
  /** Tất cả indicators có đang visible không */
  visible: boolean;
  
  /** Callback khi toggle visibility */
  onToggleVisible: () => void;
  
  /** Callback khi mở settings */
  onOpenSetting: () => void;
  
  /** Callback khi đóng header */
  onClose: () => void;
  
  /** Loại chart: main hoặc volume */
  type?: 'main' | 'volume';
}

/**
 * Props cho LineIndicatorSettings component
 */
export interface LineIndicatorSettingsProps {
  /** Loại chart: main hoặc volume */
  type: 'main' | 'volume';
  
  /** Visibility config cho main chart */
  mainVisible?: MainIndicatorConfig;
  
  /** Visibility config cho volume chart */
  volumeVisible?: VolumeIndicatorConfig;
  
  /** Visibility config cho sub indicators */
  subVisible?: SubIndicatorConfig;
  
  /** Periods cho tất cả indicators */
  periods?: IndicatorPeriods;
  
  /** Colors cho tất cả indicators */
  colors?: IndicatorColors;
  
  /** Callback khi có thay đổi settings */
  onChange?: (
    mainVis?: MainIndicatorConfig,
    volumeVis?: VolumeIndicatorConfig,
    subVis?: SubIndicatorConfig,
    per?: IndicatorPeriods,
    col?: IndicatorColors
  ) => void;
  
  /** Callback khi đóng settings */
  onClose: () => void;
}

// ============================================
// CALCULATION TYPES
// ============================================

/**
 * Data point cho Line series
 */
export interface LineDataPoint {
  time: Time;
  value: number;
}

/**
 * MACD calculation result
 */
export interface MACDResult {
  time: Time;
  macd: number;
  signal: number;
  histogram: number;
}

/**
 * RSI calculation result
 */
export interface RSIResult {
  time: Time;
  value: number;
}

/**
 * Stochastic calculation result
 */
export interface StochasticResult {
  time: Time;
  k: number;
  d: number;
  j?: number;
}

// ============================================
// INDICATOR DATA TYPES
// ============================================

/**
 * Generic indicator data structure
 */
export interface IndicatorData<T = any> {
  /** Indicator type */
  type: string;
  
  /** Indicator name */
  name: string;
  
  /** Indicator parameters */
  params: Record<string, any>;
  
  /** Calculated data points */
  data: T[];
  
  /** Indicator visibility */
  visible: boolean;
  
  /** Indicator color(s) */
  colors: string | Record<string, string>;
}

// ============================================
// DEFAULT VALUES
// ============================================

/**
 * Default periods cho indicators
 */
export const DEFAULT_PERIODS: Required<IndicatorPeriods> = {
  ma7: 7,
  ma25: 25,
  ma99: 99,
  ema12: 12,
  ema26: 26,
  mavol1: 7,
  mavol2: 14,
  macd: { fast: 12, slow: 26, signal: 9 },
  rsi: 14,
  mfi: 14,
  kdj: { k: 9, d: 3 },
  cci: 20,
  stochRsi: { period: 14, k: 3, d: 3 },
  wr: 14,
};

/**
 * Default colors cho indicators
 */
export const DEFAULT_COLORS: Required<IndicatorColors> = {
  ma7: '#F0B90B',
  ma25: '#EB40B5',
  ma99: '#B385F8',
  ema12: '#2962FF',
  ema26: '#FF6D00',
  mavol1: '#0ECB81',
  mavol2: '#EB40B5',
  macd: { macd: '#2962FF', signal: '#FF6D00', histogram: '#26A69A' },
  rsi: '#7E57C2',
  mfi: '#26A69A',
  kdj: { k: '#2962FF', d: '#FF6D00', j: '#9C27B0' },
  obv: '#00BCD4',
  cci: '#FF9800',
  stochRsi: { k: '#2962FF', d: '#FF6D00' },
  wr: '#E91E63',
};

/**
 * Default visibility cho main indicators
 */
export const DEFAULT_MAIN_VISIBLE: MainIndicatorConfig = {
  ma7: true,
  ma25: true,
  ma99: true,
  ema12: false,
  ema26: false,
};

/**
 * Default visibility cho volume indicators
 */
export const DEFAULT_VOLUME_VISIBLE: VolumeIndicatorConfig = {
  mavol1: true,
  mavol2: true,
};

/**
 * Default visibility cho sub indicators
 */
export const DEFAULT_SUB_VISIBLE: SubIndicatorConfig = {
  vol: true,
  macd: false,
  rsi: false,
  mfi: false,
  kdj: false,
  obv: false,
  cci: false,
  stochRsi: false,
  wr: false,
};

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Chart type union
 */
export type ChartType = 'main' | 'volume';

/**
 * Tab IDs cho settings modal
 */
export type SettingsTab = 1 | 2 | 3 | 4 | 5;

/**
 * Indicator category
 */
export type IndicatorCategory = 'trend' | 'momentum' | 'volatility' | 'volume';

/**
 * Indicator type names
 */
export type IndicatorType =
  | 'ma' | 'ema' | 'mavol'
  | 'macd' | 'rsi' | 'mfi'
  | 'kdj' | 'obv' | 'cci'
  | 'stochRsi' | 'wr';

// ============================================
// EXPORTS
// ============================================

export type {
  // Main types
  IndicatorValue,
  MainIndicatorConfig,
  VolumeIndicatorConfig,
  SubIndicatorConfig,
  IndicatorPeriods,
  IndicatorColors,
  
  // Component props
  LineIndicatorHeaderProps,
  LineIndicatorSettingsProps,
  
  // Calculation types
  LineDataPoint,
  MACDResult,
  RSIResult,
  StochasticResult,
  IndicatorData,
  
  // Sub-types
  MACDPeriods,
  KDJPeriods,
  StochRSIPeriods,
  MACDColors,
  KDJColors,
  StochRSIColors,
  
  // Utility types
  ChartType,
  SettingsTab,
  IndicatorCategory,
  IndicatorType,
};