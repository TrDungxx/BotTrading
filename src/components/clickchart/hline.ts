import type { ISeriesApi } from 'lightweight-charts';
type CSeries = ISeriesApi<'Candlestick'>;

const linesMap = new WeakMap<CSeries, Set<ReturnType<CSeries['createPriceLine']>>>();

export function addHLine(
  series: CSeries,
  price: number,
  opts?: Partial<Parameters<CSeries['createPriceLine']>[0]>
) {
  const line = series.createPriceLine({
    price,
    color: '#f0b90b',
    lineWidth: 2,
    lineStyle: 0,
    axisLabelVisible: false,   // ⬅️ ẩn tag bên trục Y (hết double)
    title: price.toLocaleString('vi-VN', {
      minimumFractionDigits: price >= 100 ? 2 : 4,
      maximumFractionDigits: price >= 100 ? 2 : 4,
    }),
    ...opts,
  });

  // đưa canvas layer lên trên nếu bị overlay che
  try {
    const canvas = (series as any)?._chart?._chartWidget?._paneWidget?._canvasBinding?.canvas;
    if (canvas) canvas.style.zIndex = '20';
  } catch {}

  const set = linesMap.get(series) ?? new Set();
  set.add(line);
  linesMap.set(series, set);
  return line;
}

export function clearAllHLines(series: CSeries) {
  const set = linesMap.get(series);
  if (!set) return;
  for (const l of Array.from(set)) {
    try { series.removePriceLine(l); } catch {}
  }
  set.clear();
}

export function getAllLinePrices(series: CSeries): number[] {
  const set = linesMap.get(series);
  if (!set) return [];
  // internal access để lấy giá
  // @ts-expect-error internal
  return Array.from(set).map((l: any) => Number(l._priceLine?._price ?? l._price));
}
