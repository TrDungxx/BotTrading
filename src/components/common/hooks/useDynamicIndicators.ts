import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ISeriesApi, IChartApi, CandlestickData, HistogramData, LineData, UTCTimestamp } from 'lightweight-charts';
import {
  DynamicIndicatorConfig,
  IndicatorLine,
  BollConfig,
  VolumeMALine,
  DEFAULT_INDICATOR_CONFIG,
  loadIndicatorConfig,
  saveIndicatorConfig,
  createIndicatorLine,
  createBollConfig,
  createVolumeMALine,
} from './indicatorTypes';
import { calculateMA, calculateEMA, calculateBollingerBands, calculateVolumeMA } from '../utils/calculations';

interface UseDynamicIndicatorsProps {
  selectedSymbol: string;
  market: string;
  chartRef: React.MutableRefObject<IChartApi | null>;
  volumeChartRef: React.MutableRefObject<IChartApi | null>;
  mainChartContainerRef: React.MutableRefObject<HTMLDivElement | null>;
}

interface SeriesRefs {
  [key: string]: ISeriesApi<'Line'> | null;
}

interface BollSeriesRefs {
  [key: string]: {
    upper: ISeriesApi<'Line'> | null;
    middle: ISeriesApi<'Line'> | null;
    lower: ISeriesApi<'Line'> | null;
    canvas: HTMLCanvasElement | null;
  };
}

/**
 * Dynamic Indicators Hook
 * Supports unlimited MA/EMA/WMA lines and multiple Bollinger Bands
 */
export function useDynamicIndicators({
  selectedSymbol,
  market,
  chartRef,
  volumeChartRef,
  mainChartContainerRef,
}: UseDynamicIndicatorsProps) {
  // ============================================
  // STATE
  // ============================================
  
  const [config, setConfig] = useState<DynamicIndicatorConfig>(() => 
    loadIndicatorConfig(market, selectedSymbol)
  );

  // Series references
  const lineSeriesRefs = useRef<SeriesRefs>({});
  const bollSeriesRefs = useRef<BollSeriesRefs>({});
  const volumeSeriesRefs = useRef<SeriesRefs>({});

  // Animation frame for BOLL fill
  const redrawAnimationFrameRef = useRef<number | null>(null);

  // Current config ref for closures
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // ============================================
  // PERSISTENCE
  // ============================================

  // Save config when it changes
  useEffect(() => {
    saveIndicatorConfig(market, selectedSymbol, config);
  }, [config, market, selectedSymbol]);

  // Reload config when symbol/market changes
  useEffect(() => {
    const newConfig = loadIndicatorConfig(market, selectedSymbol);
    setConfig(newConfig);
  }, [market, selectedSymbol]);

  // ============================================
  // SERIES MANAGEMENT
  // ============================================

  /**
   * Initialize all indicator series on chart
   * ✅ Uses configRef.current to get latest config (avoid stale closure)
   */
  const initializeSeries = useCallback(() => {
    const chart = chartRef.current;
    const volumeChart = volumeChartRef.current;
    const currentConfig = configRef.current; // ✅ Use ref instead of state
    if (!chart) return;

    console.log('[initializeSeries] Creating series for:', {
      lines: currentConfig.lines.length,
      bolls: currentConfig.bollingerBands.length,
      volumeMA: currentConfig.volumeMA.length
    });

    // Clean up existing series
    Object.values(lineSeriesRefs.current).forEach(series => {
      if (series) {
        try { chart.removeSeries(series); } catch {}
      }
    });
    lineSeriesRefs.current = {};

    Object.values(bollSeriesRefs.current).forEach(refs => {
      if (refs.upper) try { chart.removeSeries(refs.upper); } catch {}
      if (refs.middle) try { chart.removeSeries(refs.middle); } catch {}
      if (refs.lower) try { chart.removeSeries(refs.lower); } catch {}
      if (refs.canvas?.parentElement) {
        refs.canvas.parentElement.removeChild(refs.canvas);
      }
    });
    bollSeriesRefs.current = {};

    if (volumeChart) {
      Object.values(volumeSeriesRefs.current).forEach(series => {
        if (series) {
          try { volumeChart.removeSeries(series); } catch {}
        }
      });
    }
    volumeSeriesRefs.current = {};

    // Create MA/EMA/WMA series
    currentConfig.lines.forEach(line => {
      const series = chart.addLineSeries({
        color: line.color,
        lineWidth: line.lineWidth as 1 | 2 | 3 | 4,
        lineStyle: line.lineStyle === 'dashed' ? 1 : line.lineStyle === 'dotted' ? 2 : 0,
        lastValueVisible: false,
        priceLineVisible: false,
        visible: line.visible,
      });
      lineSeriesRefs.current[line.id] = series;
    });

    // Create BOLL series
    currentConfig.bollingerBands.forEach(boll => {
      const upper = chart.addLineSeries({
        color: boll.colors.upper,
        lineWidth: boll.lineWidth as 1 | 2 | 3 | 4,
        lineStyle: 0,
        lastValueVisible: false,
        priceLineVisible: false,
        visible: boll.visible,
      });
      const middle = chart.addLineSeries({
        color: boll.colors.middle,
        lineWidth: boll.lineWidth as 1 | 2 | 3 | 4,
        lineStyle: 2, // Dashed
        lastValueVisible: false,
        priceLineVisible: false,
        visible: boll.visible,
      });
      const lower = chart.addLineSeries({
        color: boll.colors.lower,
        lineWidth: boll.lineWidth as 1 | 2 | 3 | 4,
        lineStyle: 0,
        lastValueVisible: false,
        priceLineVisible: false,
        visible: boll.visible,
      });

      // Create canvas for fill
      let canvas: HTMLCanvasElement | null = null;
      const mainEl = mainChartContainerRef.current;
      if (mainEl && boll.fillVisible) {
        canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '1';
        canvas.width = mainEl.clientWidth;
        canvas.height = mainEl.clientHeight;
        canvas.dataset.bollId = boll.id;
        mainEl.appendChild(canvas);
      }

      bollSeriesRefs.current[boll.id] = { upper, middle, lower, canvas };
    });

    // Create Volume MA series
    if (volumeChart) {
      currentConfig.volumeMA.forEach(vol => {
        const series = volumeChart.addLineSeries({
          color: vol.color,
          lineWidth: vol.lineWidth as 1 | 2 | 3 | 4,
          lineStyle: vol.lineStyle === 'dashed' ? 1 : vol.lineStyle === 'dotted' ? 2 : 0,
          lastValueVisible: false,
          priceLineVisible: false,
          visible: vol.visible,
        });
        volumeSeriesRefs.current[vol.id] = series;
      });
    }
  }, [chartRef, volumeChartRef, mainChartContainerRef]); // ✅ Remove config from deps - using ref

  // ============================================
  // UPDATE INDICATORS DATA
  // ============================================

  /**
   * Update all main chart indicators with new candle data
   * ✅ FIX: ALWAYS setData for ALL indicators regardless of visibility
   * Visibility is controlled separately via applyOptions({ visible: ... })
   */
  const updateMainIndicators = useCallback((candles: CandlestickData[]) => {
    const currentConfig = configRef.current;

    // ✅ Update ALL MA/EMA/WMA lines (regardless of visible state)
    currentConfig.lines.forEach(line => {
      const series = lineSeriesRefs.current[line.id];
      if (!series) return; // Series not created yet
      if (candles.length < line.period) return; // Not enough data

      let data: LineData[];
      switch (line.type) {
        case 'EMA':
          data = calculateEMA(candles, line.period);
          break;
        case 'WMA':
          // TODO: Implement WMA calculation
          data = calculateMA(candles, line.period);
          break;
        default:
          data = calculateMA(candles, line.period);
      }
      
      // ✅ ALWAYS setData - visibility is controlled by applyOptions, not by data existence
      series.setData(data);
    });

    // ✅ Update ALL Bollinger Bands (regardless of visible state)
    currentConfig.bollingerBands.forEach(boll => {
      const refs = bollSeriesRefs.current[boll.id];
      if (!refs) return; // Series not created yet
      if (candles.length < boll.period) return; // Not enough data

      const data = calculateBollingerBands(candles, boll.period, boll.stdDev);
      
      // ✅ ALWAYS setData
      refs.upper?.setData(data.upper);
      refs.middle?.setData(data.middle);
      refs.lower?.setData(data.lower);
    });
  }, []);

  /**
   * Update volume indicators
   */
  const updateVolumeIndicators = useCallback((volumeData: HistogramData[]) => {
    const currentConfig = configRef.current;

    currentConfig.volumeMA.forEach(vol => {
      const series = volumeSeriesRefs.current[vol.id];
      if (!series || volumeData.length < vol.period) return;

      const data = calculateVolumeMA(volumeData, vol.period);
      series.setData(data);
    });
  }, []);

  /**
   * Clear all indicator data
   */
  const clearAllIndicators = useCallback(() => {
    Object.values(lineSeriesRefs.current).forEach(series => {
      series?.setData([]);
    });
    Object.values(bollSeriesRefs.current).forEach(refs => {
      refs.upper?.setData([]);
      refs.middle?.setData([]);
      refs.lower?.setData([]);
      if (refs.canvas) {
        const ctx = refs.canvas.getContext('2d');
        ctx?.clearRect(0, 0, refs.canvas.width, refs.canvas.height);
      }
    });
    Object.values(volumeSeriesRefs.current).forEach(series => {
      series?.setData([]);
    });
  }, []);

  // ============================================
  // INDICATOR CRUD OPERATIONS
  // ============================================

  /**
   * Add new MA/EMA/WMA line
   */
  const addLine = useCallback((type: 'MA' | 'EMA' | 'WMA') => {
    const newLine = createIndicatorLine(type, config.lines);
    
    // Add series to chart
    const chart = chartRef.current;
    if (chart) {
      const series = chart.addLineSeries({
        color: newLine.color,
        lineWidth: newLine.lineWidth as 1 | 2 | 3 | 4,
        lineStyle: 0,
        lastValueVisible: false,
        priceLineVisible: false,
        visible: newLine.visible,
      });
      lineSeriesRefs.current[newLine.id] = series;
    }

    setConfig(prev => ({
      ...prev,
      lines: [...prev.lines, newLine],
    }));

    return newLine;
  }, [config.lines, chartRef]);

  /**
   * Remove MA/EMA/WMA line
   */
  const removeLine = useCallback((id: string) => {
    const chart = chartRef.current;
    const series = lineSeriesRefs.current[id];
    
    if (chart && series) {
      try { chart.removeSeries(series); } catch {}
      delete lineSeriesRefs.current[id];
    }

    setConfig(prev => ({
      ...prev,
      lines: prev.lines.filter(l => l.id !== id),
    }));
  }, [chartRef]);

  /**
   * Update line properties
   */
  const updateLine = useCallback((id: string, updates: Partial<IndicatorLine>) => {
    const series = lineSeriesRefs.current[id];
    
    if (series) {
      if (updates.color) series.applyOptions({ color: updates.color });
      if (updates.visible !== undefined) series.applyOptions({ visible: updates.visible });
      if (updates.lineWidth) series.applyOptions({ lineWidth: updates.lineWidth as 1 | 2 | 3 | 4 });
      if (updates.lineStyle) {
        series.applyOptions({ 
          lineStyle: updates.lineStyle === 'dashed' ? 1 : updates.lineStyle === 'dotted' ? 2 : 0 
        });
      }
    }

    setConfig(prev => ({
      ...prev,
      lines: prev.lines.map(l => l.id === id ? { ...l, ...updates } : l),
    }));
  }, []);

  /**
   * Add new Bollinger Bands
   */
  const addBoll = useCallback(() => {
    const chart = chartRef.current;
    const mainEl = mainChartContainerRef.current;
    const newBoll = createBollConfig(config.bollingerBands);

    if (chart) {
      const upper = chart.addLineSeries({
        color: newBoll.colors.upper,
        lineWidth: 1,
        lineStyle: 0,
        lastValueVisible: false,
        priceLineVisible: false,
        visible: newBoll.visible,
      });
      const middle = chart.addLineSeries({
        color: newBoll.colors.middle,
        lineWidth: 1,
        lineStyle: 2,
        lastValueVisible: false,
        priceLineVisible: false,
        visible: newBoll.visible,
      });
      const lower = chart.addLineSeries({
        color: newBoll.colors.lower,
        lineWidth: 1,
        lineStyle: 0,
        lastValueVisible: false,
        priceLineVisible: false,
        visible: newBoll.visible,
      });

      let canvas: HTMLCanvasElement | null = null;
      if (mainEl && newBoll.fillVisible) {
        canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '1';
        canvas.width = mainEl.clientWidth;
        canvas.height = mainEl.clientHeight;
        canvas.dataset.bollId = newBoll.id;
        mainEl.appendChild(canvas);
      }

      bollSeriesRefs.current[newBoll.id] = { upper, middle, lower, canvas };
    }

    setConfig(prev => ({
      ...prev,
      bollingerBands: [...prev.bollingerBands, newBoll],
    }));

    return newBoll;
  }, [config.bollingerBands, chartRef, mainChartContainerRef]);

  /**
   * Remove Bollinger Bands
   */
  const removeBoll = useCallback((id: string) => {
    const chart = chartRef.current;
    const refs = bollSeriesRefs.current[id];
    
    if (chart && refs) {
      try { if (refs.upper) chart.removeSeries(refs.upper); } catch {}
      try { if (refs.middle) chart.removeSeries(refs.middle); } catch {}
      try { if (refs.lower) chart.removeSeries(refs.lower); } catch {}
      if (refs.canvas?.parentElement) {
        refs.canvas.parentElement.removeChild(refs.canvas);
      }
      delete bollSeriesRefs.current[id];
    }

    setConfig(prev => ({
      ...prev,
      bollingerBands: prev.bollingerBands.filter(b => b.id !== id),
    }));
  }, [chartRef]);

  /**
   * Update BOLL properties
   */
  const updateBoll = useCallback((id: string, updates: Partial<BollConfig>) => {
    const refs = bollSeriesRefs.current[id];
    
    if (refs) {
      if (updates.visible !== undefined) {
        refs.upper?.applyOptions({ visible: updates.visible });
        refs.middle?.applyOptions({ visible: updates.visible });
        refs.lower?.applyOptions({ visible: updates.visible });
      }
      if (updates.colors) {
        if (updates.colors.upper) refs.upper?.applyOptions({ color: updates.colors.upper });
        if (updates.colors.middle) refs.middle?.applyOptions({ color: updates.colors.middle });
        if (updates.colors.lower) refs.lower?.applyOptions({ color: updates.colors.lower });
      }
    }

    setConfig(prev => ({
      ...prev,
      bollingerBands: prev.bollingerBands.map(b => 
        b.id === id ? { ...b, ...updates, colors: { ...b.colors, ...updates.colors } } : b
      ),
    }));
  }, []);

  /**
   * Add Volume MA line
   */
  const addVolumeMA = useCallback(() => {
    const volumeChart = volumeChartRef.current;
    const newLine = createVolumeMALine(config.volumeMA);

    if (volumeChart) {
      const series = volumeChart.addLineSeries({
        color: newLine.color,
        lineWidth: newLine.lineWidth as 1 | 2 | 3 | 4,
        lineStyle: 0,
        lastValueVisible: false,
        priceLineVisible: false,
        visible: newLine.visible,
      });
      volumeSeriesRefs.current[newLine.id] = series;
    }

    setConfig(prev => ({
      ...prev,
      volumeMA: [...prev.volumeMA, newLine],
    }));

    return newLine;
  }, [config.volumeMA, volumeChartRef]);

  /**
   * Remove Volume MA line
   */
  const removeVolumeMA = useCallback((id: string) => {
    const volumeChart = volumeChartRef.current;
    const series = volumeSeriesRefs.current[id];
    
    if (volumeChart && series) {
      try { volumeChart.removeSeries(series); } catch {}
      delete volumeSeriesRefs.current[id];
    }

    setConfig(prev => ({
      ...prev,
      volumeMA: prev.volumeMA.filter(v => v.id !== id),
    }));
  }, [volumeChartRef]);

  /**
   * Update Volume MA properties
   */
  const updateVolumeMA = useCallback((id: string, updates: Partial<VolumeMALine>) => {
    const series = volumeSeriesRefs.current[id];
    
    if (series) {
      if (updates.color) series.applyOptions({ color: updates.color });
      if (updates.visible !== undefined) series.applyOptions({ visible: updates.visible });
    }

    setConfig(prev => ({
      ...prev,
      volumeMA: prev.volumeMA.map(v => v.id === id ? { ...v, ...updates } : v),
    }));
  }, []);

  // ============================================
  // TOGGLE HELPERS
  // ============================================

  /**
   * Toggle all lines of a type
   */
  const toggleLinesByType = useCallback((type: 'MA' | 'EMA' | 'WMA') => {
    const linesOfType = config.lines.filter(l => l.type === type);
    const hasAnyVisible = linesOfType.some(l => l.visible);
    const newVisible = !hasAnyVisible;

    linesOfType.forEach(line => {
      const series = lineSeriesRefs.current[line.id];
      series?.applyOptions({ visible: newVisible });
    });

    setConfig(prev => ({
      ...prev,
      lines: prev.lines.map(l => 
        l.type === type ? { ...l, visible: newVisible } : l
      ),
    }));
  }, [config.lines]);

  /**
   * Toggle all BOLLs
   */
  const toggleAllBolls = useCallback(() => {
    const hasAnyVisible = config.bollingerBands.some(b => b.visible);
    const newVisible = !hasAnyVisible;

    config.bollingerBands.forEach(boll => {
      const refs = bollSeriesRefs.current[boll.id];
      if (refs) {
        refs.upper?.applyOptions({ visible: newVisible });
        refs.middle?.applyOptions({ visible: newVisible });
        refs.lower?.applyOptions({ visible: newVisible });
      }
    });

    setConfig(prev => ({
      ...prev,
      bollingerBands: prev.bollingerBands.map(b => ({ ...b, visible: newVisible })),
    }));
  }, [config.bollingerBands]);

  /**
   * Toggle all Volume MAs
   */
  const toggleAllVolumeMAs = useCallback(() => {
    const hasAnyVisible = config.volumeMA.some(v => v.visible);
    const newVisible = !hasAnyVisible;

    config.volumeMA.forEach(vol => {
      const series = volumeSeriesRefs.current[vol.id];
      series?.applyOptions({ visible: newVisible });
    });

    setConfig(prev => ({
      ...prev,
      volumeMA: prev.volumeMA.map(v => ({ ...v, visible: newVisible })),
    }));
  }, [config.volumeMA]);

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const visibleLines = useMemo(() => 
    config.lines.filter(l => l.visible),
    [config.lines]
  );

  const visibleBolls = useMemo(() => 
    config.bollingerBands.filter(b => b.visible),
    [config.bollingerBands]
  );

  const visibleVolumeMAs = useMemo(() => 
    config.volumeMA.filter(v => v.visible),
    [config.volumeMA]
  );

  const hasAnyMainVisible = useMemo(() => 
    visibleLines.length > 0 || visibleBolls.length > 0,
    [visibleLines, visibleBolls]
  );

  const hasAnyVolumeVisible = useMemo(() => 
    visibleVolumeMAs.length > 0,
    [visibleVolumeMAs]
  );

  // ============================================
  // CLEANUP
  // ============================================

  useEffect(() => {
    return () => {
      if (redrawAnimationFrameRef.current) {
        cancelAnimationFrame(redrawAnimationFrameRef.current);
      }
    };
  }, []);

  // ============================================
  // RETURN
  // ============================================

  return {
    // Config
    config,
    setConfig,
    
    // Refs
    lineSeriesRefs,
    bollSeriesRefs,
    volumeSeriesRefs,
    
    // Initialization
    initializeSeries,
    
    // Update data
    updateMainIndicators,
    updateVolumeIndicators,
    clearAllIndicators,
    
    // Line CRUD
    addLine,
    removeLine,
    updateLine,
    
    // BOLL CRUD
    addBoll,
    removeBoll,
    updateBoll,
    
    // Volume MA CRUD
    addVolumeMA,
    removeVolumeMA,
    updateVolumeMA,
    
    // Toggle helpers
    toggleLinesByType,
    toggleAllBolls,
    toggleAllVolumeMAs,
    
    // Computed
    visibleLines,
    visibleBolls,
    visibleVolumeMAs,
    hasAnyMainVisible,
    hasAnyVolumeVisible,
  };
}