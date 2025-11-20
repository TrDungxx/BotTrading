import { IChartApi, ISeriesApi, LineData, UTCTimestamp } from 'lightweight-charts';

/**
 * Draw filled background for Bollinger Bands on canvas overlay
 */
export function drawBollFill(
  canvas: HTMLCanvasElement,
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">,
  upperData: LineData[],
  lowerData: LineData[],
  color: string = 'rgba(179, 133, 248, 0.1)'
): void {
  if (!upperData.length || !lowerData.length || !series) return;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const timeScale = chart.timeScale();
  
  // Get visible range
  const visibleRange = timeScale.getVisibleRange();
  if (!visibleRange) return;
  
  ctx.fillStyle = color;
  ctx.beginPath();
  
  // Draw upper line (left to right)
  let started = false;
  for (let i = 0; i < upperData.length; i++) {
    const point = upperData[i];
    const x = timeScale.timeToCoordinate(point.time as UTCTimestamp);
    const y = series.priceToCoordinate(point.value);
    
    if (x === null || y === null) continue;
    
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  
  // Draw lower line (right to left) to close the polygon
  for (let i = lowerData.length - 1; i >= 0; i--) {
    const point = lowerData[i];
    const x = timeScale.timeToCoordinate(point.time as UTCTimestamp);
    const y = series.priceToCoordinate(point.value);
    
    if (x === null || y === null) continue;
    
    ctx.lineTo(x, y);
  }
  
  ctx.closePath();
  ctx.fill();
}

/**
 * Setup canvas overlay for custom drawings
 */
export function setupCanvasOverlay(
  container: HTMLElement,
  chart: IChartApi
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '1';
  
  const updateCanvasSize = () => {
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
  };
  
  updateCanvasSize();
  container.appendChild(canvas);
  
  // Update canvas size on chart resize
  const resizeObserver = new ResizeObserver(updateCanvasSize);
  resizeObserver.observe(container);
  
  return canvas;
}

/**
 * Clear canvas
 */
export function clearCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

/**
 * Request animation frame with debouncing
 */
export function debounceRAF(callback: () => void): () => void {
  let rafId: number | null = null;
  
  return () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    
    rafId = requestAnimationFrame(() => {
      callback();
      rafId = null;
    });
  };
}