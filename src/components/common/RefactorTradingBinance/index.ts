/**
 * Main exports for Trading Binance Refactored
 */

// Main component
export { TradingBinance as default } from './TradingBinance';
export { TradingBinance } from './TradingBinance';

// Types
export * from './types';

// Utils
export {
  calculateMA,
  calculateEMA,
  calculateBollingerBands,
  calculateVolumeMA,
  calculateMACD,
  calculateRSI
} from './utils/indicatorCalculations';

export {
  getSymbolMeta,
  toTs,
  formatPrice,
  roundQuantity,
  hlineKey,
  parseStoredHLines,
  saveHLinesToStorage
} from './utils/chartHelpers';

export {
  drawBollFill,
  setupCanvasOverlay,
  clearCanvas,
  debounceRAF
} from './utils/canvasDrawing';

// Hooks
export { useChartData } from './hooks/useChartData';
export { useIndicators } from './hooks/useIndicators';
export { useChartInteractions } from './hooks/useChartInteractions';

// Components (if needed separately)
export { MainChart } from './components/MainChart';
export { VolumeChart } from './components/VolumeChart';
export { ChartContextMenu } from './components/ChartContextMenu';