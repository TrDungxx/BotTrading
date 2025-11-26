import { useState, useRef, useEffect } from 'react';
import { ISeriesApi, CandlestickData, HistogramData, LineData } from 'lightweight-charts';
import { calculateMA, calculateEMA, calculateVolumeMA } from '../utils/calculations';

export interface MainIndicatorConfig {
  ma7: boolean;
  ma25: boolean;
  ma99: boolean;
  ema12: boolean;
  ema26: boolean;
  boll: boolean;
}

export interface VolumeIndicatorConfig {
  mavol1: boolean;
  mavol2: boolean;
}

export interface IndicatorPeriods {
  ma7: number;
  ma25: number;
  ma99: number;
  ema12: number;
  ema26: number;
  mavol1: number;
  mavol2: number;
  boll: { period: number; stdDev: number };
}

export interface IndicatorColors {
  ma7: string;
  ma25: string;
  ma99: string;
  ema12: string;
  ema26: string;
  mavol1: string;
  mavol2: string;
  boll: {
    upper: string;
    middle: string;
    lower: string;
    fill: string;
  };
}

interface UseIndicatorsProps {
  selectedSymbol: string;
  market: string;
}

const INDICATOR_SETTINGS_VERSION = '2.0';

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

const DEFAULT_PERIODS: IndicatorPeriods = {
  ma7: 7,
  ma25: 25,
  ma99: 99,
  ema12: 12,
  ema26: 26,
  mavol1: 7,
  mavol2: 14,
  boll: { period: 20, stdDev: 2 },
};

const DEFAULT_COLORS: IndicatorColors = {
  ma7: '#F0B90B',
  ma25: '#EB40B5',
  ma99: '#B385F8',
  ema12: '#2962FF',
  ema26: '#FF6D00',
  mavol1: '#0ECB81',
  mavol2: '#EB40B5',
  boll: {
    upper: '#B385F8',
    middle: '#EB40B5',
    lower: '#B385F8',
    fill: 'rgba(179, 133, 248, 0.1)',
  },
};

export function useIndicators({ selectedSymbol, market }: UseIndicatorsProps) {
  // Load settings from localStorage
  const loadSettings = () => {
    try {
      const key = `indicator_settings_${market}_${selectedSymbol}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.version !== INDICATOR_SETTINGS_VERSION) {
          localStorage.removeItem(key);
          return null;
        }
        return parsed;
      }
    } catch (e) {
      console.error('Failed to load indicator settings:', e);
    }
    return null;
  };

  const savedSettings = loadSettings();

  // States
  const [mainVisible, setMainVisible] = useState<MainIndicatorConfig>(
    savedSettings?.mainVisible ?? DEFAULT_MAIN_VISIBLE
  );
  const [volumeVisible, setVolumeVisible] = useState<VolumeIndicatorConfig>(
    savedSettings?.volumeVisible ?? DEFAULT_VOLUME_VISIBLE
  );
  const [indicatorPeriods, setIndicatorPeriods] = useState<IndicatorPeriods>(
    savedSettings?.indicatorPeriods ?? DEFAULT_PERIODS
  );
  const [indicatorColors, setIndicatorColors] = useState<IndicatorColors>(
    savedSettings?.indicatorColors ?? DEFAULT_COLORS
  );
  const [bollFillVisible, setBollFillVisible] = useState<boolean>(
    savedSettings?.bollFillVisible ?? false
  );

  // Refs for series
  const ma7Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma25Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma99Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema12Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema26Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const mavol1Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const mavol2Ref = useRef<ISeriesApi<'Line'> | null>(null);

  // Ref to track mainVisible in closures
  const mainVisibleRef = useRef(mainVisible);
  useEffect(() => {
    mainVisibleRef.current = mainVisible;
  }, [mainVisible]);

  // Save settings to localStorage
  useEffect(() => {
    try {
      const key = `indicator_settings_${market}_${selectedSymbol}`;
      const settings = {
        mainVisible,
        volumeVisible,
        indicatorPeriods,
        indicatorColors,
        bollFillVisible,
        version: INDICATOR_SETTINGS_VERSION,
      };
      localStorage.setItem(key, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save indicator settings:', e);
    }
  }, [mainVisible, volumeVisible, indicatorPeriods, indicatorColors, bollFillVisible, selectedSymbol, market]);

  // Update main chart indicators
  const updateMainIndicators = (candles: CandlestickData[]) => {
    if (candles.length >= indicatorPeriods.ma7 && ma7Ref.current && mainVisible.ma7) {
      ma7Ref.current.setData(calculateMA(candles, indicatorPeriods.ma7));
    }
    if (candles.length >= indicatorPeriods.ma25 && ma25Ref.current && mainVisible.ma25) {
      ma25Ref.current.setData(calculateMA(candles, indicatorPeriods.ma25));
    }
    if (candles.length >= indicatorPeriods.ma99 && ma99Ref.current && mainVisible.ma99) {
      ma99Ref.current.setData(calculateMA(candles, indicatorPeriods.ma99));
    }
    if (candles.length >= indicatorPeriods.ema12 && ema12Ref.current && mainVisible.ema12) {
      ema12Ref.current.setData(calculateEMA(candles, indicatorPeriods.ema12));
    }
    if (candles.length >= indicatorPeriods.ema26 && ema26Ref.current && mainVisible.ema26) {
      ema26Ref.current.setData(calculateEMA(candles, indicatorPeriods.ema26));
    }
  };

  // Update volume indicators
  const updateVolumeIndicators = (volumeData: HistogramData[]) => {
    if (volumeData.length >= indicatorPeriods.mavol1 && mavol1Ref.current && volumeVisible.mavol1) {
      mavol1Ref.current.setData(calculateVolumeMA(volumeData, indicatorPeriods.mavol1));
    }
    if (volumeData.length >= indicatorPeriods.mavol2 && mavol2Ref.current && volumeVisible.mavol2) {
      mavol2Ref.current.setData(calculateVolumeMA(volumeData, indicatorPeriods.mavol2));
    }
  };

  // Clear all indicators
  const clearAllIndicators = () => {
    ma7Ref.current?.setData([]);
    ma25Ref.current?.setData([]);
    ma99Ref.current?.setData([]);
    ema12Ref.current?.setData([]);
    ema26Ref.current?.setData([]);
    mavol1Ref.current?.setData([]);
    mavol2Ref.current?.setData([]);
  };

  // Toggle all main indicators (MA/EMA only, excluding BOLL)
  const toggleAllMainIndicators = () => {
    const hasAnyVisible = 
      mainVisible.ma7 || 
      mainVisible.ma25 || 
      mainVisible.ma99 || 
      mainVisible.ema12 || 
      mainVisible.ema26;
    
    const newState: MainIndicatorConfig = {
      ma7: !hasAnyVisible,
      ma25: !hasAnyVisible,
      ma99: !hasAnyVisible,
      ema12: !hasAnyVisible,
      ema26: !hasAnyVisible,
      boll: mainVisible.boll, // Keep BOLL state unchanged
    };
    
    setMainVisible(newState);
    
    // Apply visibility to series
    ma7Ref.current?.applyOptions({ visible: newState.ma7 });
    ma25Ref.current?.applyOptions({ visible: newState.ma25 });
    ma99Ref.current?.applyOptions({ visible: newState.ma99 });
    ema12Ref.current?.applyOptions({ visible: newState.ema12 });
    ema26Ref.current?.applyOptions({ visible: newState.ema26 });
  };

  // Toggle all volume indicators
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

  // Apply color changes to series
  const applyColorChanges = (colors: IndicatorColors) => {
    ma7Ref.current?.applyOptions({ color: colors.ma7 });
    ma25Ref.current?.applyOptions({ color: colors.ma25 });
    ma99Ref.current?.applyOptions({ color: colors.ma99 });
    ema12Ref.current?.applyOptions({ color: colors.ema12 });
    ema26Ref.current?.applyOptions({ color: colors.ema26 });
    mavol1Ref.current?.applyOptions({ color: colors.mavol1 });
    mavol2Ref.current?.applyOptions({ color: colors.mavol2 });
  };

  return {
    // States
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
    
    // Refs
    ma7Ref,
    ma25Ref,
    ma99Ref,
    ema12Ref,
    ema26Ref,
    mavol1Ref,
    mavol2Ref,
    mainVisibleRef,
    
    // Functions
    updateMainIndicators,
    updateVolumeIndicators,
    clearAllIndicators,
    toggleAllMainIndicators,
    toggleAllVolumeIndicators,
    applyColorChanges,
  };
}