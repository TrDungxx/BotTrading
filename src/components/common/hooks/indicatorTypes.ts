/**
 * Dynamic Indicator Types - Support unlimited MA/EMA/BOLL lines like Binance
 */

// ============================================
// INDICATOR LINE TYPES
// ============================================

export type IndicatorType = 'MA' | 'EMA' | 'WMA' | 'BOLL';
export type PriceSource = 'close' | 'open' | 'high' | 'low';
export type LineStyle = 'solid' | 'dashed' | 'dotted';

/**
 * Single MA/EMA/WMA line configuration
 */
export interface IndicatorLine {
  id: string;              // Unique ID: "ma_1", "ema_2", etc.
  type: 'MA' | 'EMA' | 'WMA';
  period: number;
  color: string;
  visible: boolean;
  source: PriceSource;
  lineStyle: LineStyle;
  lineWidth: number;
}

/**
 * Bollinger Bands configuration
 */
export interface BollConfig {
  id: string;              // Unique ID: "boll_1"
  period: number;
  stdDev: number;
  visible: boolean;
  fillVisible: boolean;
  source: PriceSource;
  colors: {
    upper: string;
    middle: string;
    lower: string;
    fill: string;
  };
  lineStyle: LineStyle;
  lineWidth: number;
}

/**
 * Volume MA line configuration
 */
export interface VolumeMALine {
  id: string;              // "mavol_1", "mavol_2"
  period: number;
  color: string;
  visible: boolean;
  lineStyle: LineStyle;
  lineWidth: number;
}

// ============================================
// INDICATOR CONFIG (stored in localStorage)
// ============================================

export interface DynamicIndicatorConfig {
  version: string;
  lines: IndicatorLine[];           // MA, EMA, WMA lines
  bollingerBands: BollConfig[];     // Multiple BOLL support
  volumeMA: VolumeMALine[];         // Volume MA lines
}

// ============================================
// DEFAULT CONFIGURATIONS
// ============================================

export const DEFAULT_COLORS = {
  ma: ['#F0B90B', '#EB40B5', '#B385F8', '#00BCD4', '#4CAF50', '#FF5722', '#9C27B0', '#3F51B5', '#009688', '#795548'],
  ema: ['#2962FF', '#FF6D00', '#00C853', '#D500F9', '#FF1744', '#00B8D4', '#64DD17', '#FFAB00', '#651FFF', '#F50057'],
  boll: {
    upper: '#B385F8',
    middle: '#EB40B5', 
    lower: '#B385F8',
    fill: 'rgba(179, 133, 248, 0.1)',
  },
  volumeMA: ['#0ECB81', '#EB40B5', '#F0B90B', '#2962FF'],
};

export const DEFAULT_INDICATOR_CONFIG: DynamicIndicatorConfig = {
  version: '3.0',
  lines: [
    // Default 3 MA lines (like current setup)
    { id: 'ma_1', type: 'MA', period: 7, color: '#F0B90B', visible: false, source: 'close', lineStyle: 'solid', lineWidth: 1 },
    { id: 'ma_2', type: 'MA', period: 25, color: '#EB40B5', visible: false, source: 'close', lineStyle: 'solid', lineWidth: 1 },
    { id: 'ma_3', type: 'MA', period: 99, color: '#B385F8', visible: false, source: 'close', lineStyle: 'solid', lineWidth: 1 },
    // Default 2 EMA lines
    { id: 'ema_1', type: 'EMA', period: 12, color: '#2962FF', visible: false, source: 'close', lineStyle: 'solid', lineWidth: 1 },
    { id: 'ema_2', type: 'EMA', period: 26, color: '#FF6D00', visible: false, source: 'close', lineStyle: 'solid', lineWidth: 1 },
  ],
  bollingerBands: [
    {
      id: 'boll_1',
      period: 20,
      stdDev: 2,
      visible: false,
      fillVisible: false,
      source: 'close',
      colors: { ...DEFAULT_COLORS.boll },
      lineStyle: 'solid',
      lineWidth: 1,
    },
  ],
  volumeMA: [
    { id: 'mavol_1', period: 7, color: '#0ECB81', visible: false, lineStyle: 'solid', lineWidth: 1 },
    { id: 'mavol_2', period: 14, color: '#EB40B5', visible: false, lineStyle: 'solid', lineWidth: 1 },
  ],
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate unique ID for new indicator
 */
export function generateIndicatorId(type: 'MA' | 'EMA' | 'WMA' | 'BOLL' | 'MAVOL', existingIds: string[]): string {
  const prefix = type.toLowerCase();
  let counter = 1;
  while (existingIds.includes(`${prefix}_${counter}`)) {
    counter++;
  }
  return `${prefix}_${counter}`;
}

/**
 * Get next available color for indicator type
 */
export function getNextColor(type: 'MA' | 'EMA' | 'WMA' | 'MAVOL', usedColors: string[]): string {
  const colorPool = type === 'MAVOL' ? DEFAULT_COLORS.volumeMA : 
                    type === 'EMA' ? DEFAULT_COLORS.ema : DEFAULT_COLORS.ma;
  
  for (const color of colorPool) {
    if (!usedColors.includes(color)) {
      return color;
    }
  }
  // If all colors used, generate random
  return `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
}

/**
 * Create new MA/EMA line with defaults
 */
export function createIndicatorLine(
  type: 'MA' | 'EMA' | 'WMA',
  existingLines: IndicatorLine[]
): IndicatorLine {
  const existingIds = existingLines.map(l => l.id);
  const usedColors = existingLines.filter(l => l.type === type).map(l => l.color);
  
  // Suggest period based on existing
  const existingPeriods = existingLines.filter(l => l.type === type).map(l => l.period);
  const suggestedPeriods = type === 'EMA' ? [12, 26, 50, 100, 200] : [7, 25, 99, 50, 100, 200];
  let period = suggestedPeriods.find(p => !existingPeriods.includes(p)) || 20;

  return {
    id: generateIndicatorId(type, existingIds),
    type,
    period,
    color: getNextColor(type, usedColors),
    visible: true,
    source: 'close',
    lineStyle: 'solid',
    lineWidth: 1,
  };
}

/**
 * Create new BOLL config with defaults
 */
export function createBollConfig(existingBolls: BollConfig[]): BollConfig {
  const existingIds = existingBolls.map(b => b.id);
  
  return {
    id: generateIndicatorId('BOLL', existingIds),
    period: 20,
    stdDev: 2,
    visible: true,
    fillVisible: false,
    source: 'close',
    colors: { ...DEFAULT_COLORS.boll },
    lineStyle: 'solid',
    lineWidth: 1,
  };
}

/**
 * Create new Volume MA line
 */
export function createVolumeMALine(existingLines: VolumeMALine[]): VolumeMALine {
  const existingIds = existingLines.map(l => l.id);
  const usedColors = existingLines.map(l => l.color);
  const existingPeriods = existingLines.map(l => l.period);
  
  const suggestedPeriods = [7, 14, 25, 50, 100];
  let period = suggestedPeriods.find(p => !existingPeriods.includes(p)) || 20;

  return {
    id: generateIndicatorId('MAVOL', existingIds),
    period,
    color: getNextColor('MAVOL', usedColors),
    visible: true,
    lineStyle: 'solid',
    lineWidth: 1,
  };
}

// ============================================
// STORAGE HELPERS
// ============================================

const STORAGE_KEY_PREFIX = 'dynamic_indicators';

export function getStorageKey(market: string, symbol: string): string {
  return `${STORAGE_KEY_PREFIX}_${market}_${symbol}`;
}

export function loadIndicatorConfig(market: string, symbol: string): DynamicIndicatorConfig {
  try {
    const key = getStorageKey(market, symbol);
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.version === DEFAULT_INDICATOR_CONFIG.version) {
        return parsed;
      }
      // Version mismatch - migrate or reset
      console.log('[Indicators] Version mismatch, using defaults');
    }
  } catch (e) {
    console.error('[Indicators] Failed to load config:', e);
  }
  return { ...DEFAULT_INDICATOR_CONFIG };
}

export function saveIndicatorConfig(market: string, symbol: string, config: DynamicIndicatorConfig): void {
  try {
    const key = getStorageKey(market, symbol);
    localStorage.setItem(key, JSON.stringify(config));
  } catch (e) {
    console.error('[Indicators] Failed to save config:', e);
  }
}

// ============================================
// BACKWARD COMPATIBILITY
// ============================================

/**
 * Convert old hardcoded config to new dynamic format
 */
export interface LegacyMainVisible {
  ma7: boolean;
  ma25: boolean;
  ma99: boolean;
  ema12: boolean;
  ema26: boolean;
  boll: boolean;
}

export interface LegacyIndicatorPeriods {
  ma7: number;
  ma25: number;
  ma99: number;
  ema12: number;
  ema26: number;
  mavol1: number;
  mavol2: number;
  boll: { period: number; stdDev: number };
}

export interface LegacyIndicatorColors {
  ma7: string;
  ma25: string;
  ma99: string;
  ema12: string;
  ema26: string;
  mavol1: string;
  mavol2: string;
  boll: { upper: string; middle: string; lower: string; fill: string };
}

export function migrateLegacyConfig(
  mainVisible: LegacyMainVisible,
  periods: LegacyIndicatorPeriods,
  colors: LegacyIndicatorColors,
  bollFillVisible: boolean
): DynamicIndicatorConfig {
  return {
    version: '3.0',
    lines: [
      { id: 'ma_1', type: 'MA', period: periods.ma7, color: colors.ma7, visible: mainVisible.ma7, source: 'close', lineStyle: 'solid', lineWidth: 1 },
      { id: 'ma_2', type: 'MA', period: periods.ma25, color: colors.ma25, visible: mainVisible.ma25, source: 'close', lineStyle: 'solid', lineWidth: 1 },
      { id: 'ma_3', type: 'MA', period: periods.ma99, color: colors.ma99, visible: mainVisible.ma99, source: 'close', lineStyle: 'solid', lineWidth: 1 },
      { id: 'ema_1', type: 'EMA', period: periods.ema12, color: colors.ema12, visible: mainVisible.ema12, source: 'close', lineStyle: 'solid', lineWidth: 1 },
      { id: 'ema_2', type: 'EMA', period: periods.ema26, color: colors.ema26, visible: mainVisible.ema26, source: 'close', lineStyle: 'solid', lineWidth: 1 },
    ],
    bollingerBands: [
      {
        id: 'boll_1',
        period: periods.boll.period,
        stdDev: periods.boll.stdDev,
        visible: mainVisible.boll,
        fillVisible: bollFillVisible,
        source: 'close',
        colors: colors.boll,
        lineStyle: 'solid',
        lineWidth: 1,
      },
    ],
    volumeMA: [
      { id: 'mavol_1', period: periods.mavol1, color: colors.mavol1, visible: false, lineStyle: 'solid', lineWidth: 1 },
      { id: 'mavol_2', period: periods.mavol2, color: colors.mavol2, visible: false, lineStyle: 'solid', lineWidth: 1 },
    ],
  };
}