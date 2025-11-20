import { useState, useCallback, useMemo } from 'react';
import { LineData, HistogramData } from 'lightweight-charts';
import {
  MainIndicatorConfig,
  VolumeIndicatorConfig,
  SecondaryIndicatorConfig,
  IndicatorPeriods,
  IndicatorColors,
  Candle,
  VolumeBar
} from '../types';
import {
  calculateMA,
  calculateEMA,
  calculateBollingerBands,
  calculateVolumeMA,
  calculateMACD,
  calculateRSI
} from '../utils/indicatorCalculations';

/**
 * Default indicator configurations
 */
const DEFAULT_MAIN_VISIBLE: MainIndicatorConfig = {
  ma7: false,
  ma25: false,
  ma99: false,
  ema12: false,
  ema26: false,
  boll: false,
};

const DEFAULT_VOLUME_VISIBLE: VolumeIndicatorConfig = {
  mavol1: false,
  mavol2: false,
};

const DEFAULT_SECONDARY_VISIBLE: SecondaryIndicatorConfig = {
  macd: false,
  rsi: false,
};

const DEFAULT_PERIODS: IndicatorPeriods = {
  ma7: 7,
  ma25: 25,
  ma99: 99,
  ema12: 12,
  ema26: 26,
  boll: 20,
  bollStdDev: 2,
  mavol1: 7,
  mavol2: 14,
  macd: { fast: 12, slow: 26, signal: 9 },
  rsi: 14,
};

const DEFAULT_COLORS: IndicatorColors = {
  ma7: '#FF6B6B',
  ma25: '#4ECDC4',
  ma99: '#FFE66D',
  ema12: '#95E1D3',
  ema26: '#F38181',
  boll: '#B385F8',
  mavol1: '#26a69a',
  mavol2: '#ef5350',
  macd: '#2962FF',
  macdSignal: '#FF6D00',
  rsi: '#9C27B0',
};

interface UseIndicatorsReturn {
  // Visibility states
  mainVisible: MainIndicatorConfig;
  volumeVisible: VolumeIndicatorConfig;
  secondaryVisible: SecondaryIndicatorConfig;
  bollFillVisible: boolean;
  
  // Configuration
  periods: IndicatorPeriods;
  colors: IndicatorColors;
  
  // Setters
  setMainVisible: (config: MainIndicatorConfig) => void;
  setVolumeVisible: (config: VolumeIndicatorConfig) => void;
  setSecondaryVisible: (config: SecondaryIndicatorConfig) => void;
  setBollFillVisible: (visible: boolean) => void;
  setPeriods: (periods: IndicatorPeriods) => void;
  setColors: (colors: IndicatorColors) => void;
  
  // Toggle functions
  toggleMainIndicator: (key: keyof MainIndicatorConfig) => void;
  toggleVolumeIndicator: (key: keyof VolumeIndicatorConfig) => void;
  toggleSecondaryIndicator: (key: keyof SecondaryIndicatorConfig) => void;
  
  // Calculated data
  calculateMainIndicators: (candles: Candle[]) => {
    ma7?: LineData[];
    ma25?: LineData[];
    ma99?: LineData[];
    ema12?: LineData[];
    ema26?: LineData[];
    boll?: { upper: LineData[]; middle: LineData[]; lower: LineData[] };
  };
  
  calculateVolumeIndicators: (volumeData: VolumeBar[]) => {
    mavol1?: LineData[];
    mavol2?: LineData[];
  };
  
  calculateSecondaryIndicators: (candles: Candle[]) => {
    macd?: { macdLine: LineData[]; signalLine: LineData[]; histogram: HistogramData[] };
    rsi?: LineData[];
  };
}

/**
 * Custom hook to manage technical indicators
 */
export function useIndicators(): UseIndicatorsReturn {
  const [mainVisible, setMainVisible] = useState<MainIndicatorConfig>(DEFAULT_MAIN_VISIBLE);
  const [volumeVisible, setVolumeVisible] = useState<VolumeIndicatorConfig>(DEFAULT_VOLUME_VISIBLE);
  const [secondaryVisible, setSecondaryVisible] = useState<SecondaryIndicatorConfig>(DEFAULT_SECONDARY_VISIBLE);
  const [bollFillVisible, setBollFillVisible] = useState(false);
  
  const [periods, setPeriods] = useState<IndicatorPeriods>(DEFAULT_PERIODS);
  const [colors, setColors] = useState<IndicatorColors>(DEFAULT_COLORS);

  /**
   * Toggle individual main indicator
   */
  const toggleMainIndicator = useCallback((key: keyof MainIndicatorConfig) => {
    setMainVisible(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  /**
   * Toggle individual volume indicator
   */
  const toggleVolumeIndicator = useCallback((key: keyof VolumeIndicatorConfig) => {
    setVolumeVisible(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  /**
   * Toggle individual secondary indicator
   */
  const toggleSecondaryIndicator = useCallback((key: keyof SecondaryIndicatorConfig) => {
    setSecondaryVisible(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  /**
   * Calculate main chart indicators
   */
  const calculateMainIndicators = useCallback((candles: Candle[]) => {
    const result: ReturnType<UseIndicatorsReturn['calculateMainIndicators']> = {};
    
    if (!candles.length) return result;
    
    if (mainVisible.ma7 && candles.length >= periods.ma7) {
      result.ma7 = calculateMA(candles, periods.ma7);
    }
    
    if (mainVisible.ma25 && candles.length >= periods.ma25) {
      result.ma25 = calculateMA(candles, periods.ma25);
    }
    
    if (mainVisible.ma99 && candles.length >= periods.ma99) {
      result.ma99 = calculateMA(candles, periods.ma99);
    }
    
    if (mainVisible.ema12 && candles.length >= periods.ema12) {
      result.ema12 = calculateEMA(candles, periods.ema12);
    }
    
    if (mainVisible.ema26 && candles.length >= periods.ema26) {
      result.ema26 = calculateEMA(candles, periods.ema26);
    }
    
    if (mainVisible.boll && candles.length >= periods.boll) {
      result.boll = calculateBollingerBands(candles, periods.boll, periods.bollStdDev);
    }
    
    return result;
  }, [mainVisible, periods]);

  /**
   * Calculate volume indicators
   */
  const calculateVolumeIndicators = useCallback((volumeData: VolumeBar[]) => {
    const result: ReturnType<UseIndicatorsReturn['calculateVolumeIndicators']> = {};
    
    if (!volumeData.length) return result;
    
    if (volumeVisible.mavol1 && volumeData.length >= periods.mavol1) {
      result.mavol1 = calculateVolumeMA(volumeData, periods.mavol1);
    }
    
    if (volumeVisible.mavol2 && volumeData.length >= periods.mavol2) {
      result.mavol2 = calculateVolumeMA(volumeData, periods.mavol2);
    }
    
    return result;
  }, [volumeVisible, periods]);

  /**
   * Calculate secondary indicators (MACD, RSI)
   */
  const calculateSecondaryIndicators = useCallback((candles: Candle[]) => {
    const result: ReturnType<UseIndicatorsReturn['calculateSecondaryIndicators']> = {};
    
    if (!candles.length) return result;
    
    if (secondaryVisible.macd) {
      const minLength = Math.max(
        periods.macd.slow,
        periods.macd.fast
      ) + periods.macd.signal;
      
      if (candles.length >= minLength) {
        result.macd = calculateMACD(
          candles,
          periods.macd.fast,
          periods.macd.slow,
          periods.macd.signal
        );
      }
    }
    
    if (secondaryVisible.rsi && candles.length >= periods.rsi + 1) {
      result.rsi = calculateRSI(candles, periods.rsi);
    }
    
    return result;
  }, [secondaryVisible, periods]);

  return {
    mainVisible,
    volumeVisible,
    secondaryVisible,
    bollFillVisible,
    periods,
    colors,
    setMainVisible,
    setVolumeVisible,
    setSecondaryVisible,
    setBollFillVisible,
    setPeriods,
    setColors,
    toggleMainIndicator,
    toggleVolumeIndicator,
    toggleSecondaryIndicator,
    calculateMainIndicators,
    calculateVolumeIndicators,
    calculateSecondaryIndicators,
  };
}