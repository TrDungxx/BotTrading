import React from "react";
import type { ISeriesApi, IChartApi, Time, UTCTimestamp } from "lightweight-charts";

type Side = "LONG" | "SHORT";

type Props = {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  containerEl: HTMLDivElement | null;

  entryTime: UTCTimestamp;
  entryPrice: number;

  tpPrice: number | null;
  slPrice: number | null;

  side: Side;
  onChange?: (v: { tp?: number | null; sl?: number | null }) => void;
  onEntryChange?: (price: number) => void;   // <--- mới

};

const RRZoneOverlay: React.FC<Props> = ({
  chart,
  series,
  containerEl,
  entryTime,
  entryPrice,
  tpPrice,
  slPrice,
  side,
  onEntryChange,
  onChange,
}) => {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const profitRef = React.useRef<HTMLDivElement | null>(null);
  const riskRef = React.useRef<HTMLDivElement | null>(null);
  const tpEdgeRef = React.useRef<HTMLDivElement | null>(null);
  const slEdgeRef = React.useRef<HTMLDivElement | null>(null);
  const tpTagRef = React.useRef<HTMLDivElement | null>(null);
  const slTagRef = React.useRef<HTMLDivElement | null>(null);
  const dragging = React.useRef<null | "tp" | "sl" | "entry">(null);
  const entryLineRef = React.useRef<HTMLDivElement | null>(null);
const entryTagRef = React.useRef<HTMLDivElement | null>(null);
const entryEdgeRef = React.useRef<HTMLDivElement | null>(null);
const EDGE_MARGIN_PX = 6;   // 👈 khoảng margin trên dưới vùng kéo
  const yToPrice = React.useCallback((y: number) => series?.coordinateToPrice(y) ?? null, [series]);
  const priceToY = React.useCallback((p: number | null) => (p == null ? null : series?.priceToCoordinate(p) ?? null), [series]);
  const timeToX = React.useCallback((t: Time) => chart?.timeScale().timeToCoordinate(t) ?? null, [chart]);

  const layout = React.useCallback(() => {
    if (!containerEl || !rootRef.current) return;

    const x0 = timeToX(entryTime);
    const yEntry = priceToY(entryPrice);
    const yTp = priceToY(tpPrice);
    const ySl = priceToY(slPrice);
    if (x0 == null || yEntry == null) return;

    const fullW = containerEl.clientWidth;
    const x1 = fullW - 1;

    // phủ toàn bộ container, cho phép bắt sự kiện ở các viền
    const root = rootRef.current;
    root.style.left = `0px`;
    root.style.top = `0px`;
    root.style.width = `${fullW}px`;
    root.style.height = `${containerEl.clientHeight}px`;
    root.style.pointerEvents = "none";
    root.style.position = "absolute";

    const placeRect = (div: HTMLDivElement | null, yA: number | null, yB: number | null, color: string, borderColor: string) => {
      if (!div || yA == null || yB == null) return div && (div.style.display = "none");
      const top = Math.min(yA, yB);
      const h = Math.abs(yA - yB);
      div.style.display = "block";
      div.style.position = "absolute";
      div.style.left = `${x0}px`;
      div.style.width = `${x1 - x0}px`;
      div.style.top = `${top}px`;
      div.style.height = `${h}px`;
      div.style.background = color;
      div.style.border = `1px solid ${borderColor}`;
    };

    // xanh lời – đỏ lỗ (đảo theo side)
    if (yTp != null) {
      const green = "rgba(43, 153, 83, 0.18)";
      const greenB = "rgba(21, 226, 96, 0.35)";
      if (side === "LONG") placeRect(profitRef.current, yEntry, yTp, green, greenB);
      else placeRect(profitRef.current, yTp, yEntry, green, greenB);
    } else if (profitRef.current) profitRef.current.style.display = "none";

    if (ySl != null) {
      const red = "rgba(170, 66, 66, 0.18)";
      const redB = "rgba(239,68,68,0.35)";
      if (side === "LONG") placeRect(riskRef.current, ySl, yEntry, red, redB);
      else placeRect(riskRef.current, yEntry, ySl, red, redB);
    } else if (riskRef.current) riskRef.current.style.display = "none";

    // edges (kéo ở viền)
    const placeEdge = (div: HTMLDivElement | null, y: number | null, color: string) => {
  if (!div || y == null) return div && (div.style.display = "none");
  div.style.display = "block";
  div.style.position = "absolute";
  div.style.left = `${x0}px`;
  div.style.width = `${x1 - x0}px`;
  div.style.top = `${Math.round(y - EDGE_MARGIN_PX)}px`;       // dùng hằng số
  div.style.height = `${EDGE_MARGIN_PX * 2}px`;                // tổng cao = trên + dưới
  div.style.borderTop = `1px solid ${color}`;
  div.style.cursor = "ns-resize";
  div.style.pointerEvents = "auto"; // chỉ edges bắt sự kiện
  div.style.background = "transparent";
};
    placeEdge(tpEdgeRef.current, yTp, "rgba(27, 206, 93, 1)");
    placeEdge(slEdgeRef.current, ySl, "rgba(239,68,68,1)");
    // entry dashed line (cố định)
if (entryLineRef.current && yEntry != null) {
  const el = entryLineRef.current;
  el.style.display = "block";
  el.style.position = "absolute";
  el.style.left = `${x0}px`;
  el.style.width = `${x1 - x0}px`;
  el.style.top = `${Math.round(yEntry - 1)}px`;
  el.style.height = `0px`;
  el.style.borderTop = "1px dashed rgba(255,255,255,0.45)";
  el.style.pointerEvents = "none";
}
// entry tag ở mép phải
if (entryTagRef.current && yEntry != null) {
  const tag = entryTagRef.current;
  tag.style.display = "block";
  tag.style.position = "absolute";
  tag.style.left = `${x1 - 64}px`;
  tag.style.top = `${Math.round(yEntry - 10)}px`;
  tag.style.width = `64px`;
  tag.style.height = `20px`;
  tag.style.fontSize = "12px";
  tag.style.lineHeight = "20px";
  tag.style.textAlign = "center";
  tag.style.borderRadius = "4px";
  tag.style.color = "#cbd5e1";
  tag.style.background = "rgba(148,163,184,0.15)";
  tag.style.border = "1px solid rgba(148,163,184,0.35)";
  tag.style.fontWeight = "600";
  tag.style.pointerEvents = "none";
  tag.innerText = "Entry";
}
// handle kéo Entry (ở ngay vị trí entry, màu xám)
const placeEntryEdge = (div: HTMLDivElement | null, y: number | null) => {
  if (!div || y == null) return div && (div.style.display = "none");
  div.style.display = "block";
  div.style.position = "absolute";
  div.style.left = `${x0}px`;
  div.style.width = `${x1 - x0}px`;
  div.style.top = `${Math.round(y - 2)}px`;
  div.style.height = `12px`;
  div.style.borderTop = `1px dashed rgba(148,163,184,0.9)`;
  div.style.cursor = "ns-resize";
  div.style.pointerEvents = "auto";
  div.style.background = "transparent";
  div.dataset.edge = "entry";
};
placeEntryEdge(entryEdgeRef.current, yEntry);
    // tags ở mép phải
    const placeTag = (tag: HTMLDivElement | null, y: number | null, bg: string, text: string) => {
      if (!tag || y == null) return tag && (tag.style.display = "none");
      tag.style.display = "block";
      tag.style.position = "absolute";
      tag.style.left = `${x1 - 64}px`;
      tag.style.top = `${Math.round(y - 10)}px`;
      tag.style.width = `64px`;
      tag.style.height = `20px`;
      tag.style.fontSize = "12px";
      tag.style.lineHeight = "20px";
      tag.style.textAlign = "center";
      tag.style.borderRadius = "4px";
      tag.style.color = "#0b0f14";
      tag.style.fontWeight = "600";
      tag.style.pointerEvents = "none";
      tag.style.background = bg;
      tag.innerText = text;
    };

    if (yTp != null) placeTag(tpTagRef.current, yTp, "#38c56cff", `TP  ${tpPrice!.toFixed(3)}`);
    if (ySl != null) placeTag(slTagRef.current, ySl, "#ef4444", `SL  ${slPrice!.toFixed(3)}`);
  }, [chart, containerEl, entryTime, entryPrice, tpPrice, slPrice, side, priceToY, timeToX]);
  

// --- Pan/zoom trục X + resize container + (pane height qua priceScale)
React.useEffect(() => {
  if (!chart) return;
  const rerender = () => layout();

  // 1) pan/zoom theo trục X
  const ts = chart.timeScale();
  ts.subscribeVisibleTimeRangeChange(rerender);

  // 2) thay đổi size của container (CSS/layout)
  const ro = containerEl ? new ResizeObserver(rerender) : null;
  ro?.observe(containerEl!);

  // 3) (tuỳ) thay đổi chiều cao pane Y
  const ps = series?.priceScale();
  const unsubPS =
    ps && (ps as any).subscribeSizeChanged
      ? (ps as any).subscribeSizeChanged(rerender)
      : undefined;

  layout();

  return () => {
    ts.unsubscribeVisibleTimeRangeChange(rerender);
    ro?.disconnect();
    if (typeof unsubPS === "function") {
      try { unsubPS(); } catch {}
    }
  };
}, [chart, series, containerEl, layout]);


// --- rAF loop: khi autoscale Y đổi, zoom theo bánh xe, v.v. thì vẫn bám theo
React.useEffect(() => {
  let raf = 0;
  let last = { x0: NaN, x1: NaN, yE: NaN, yTp: NaN, ySl: NaN };

  const tick = () => {
    const x0 = chart?.timeScale().timeToCoordinate(entryTime) ?? NaN;
    const x1 = containerEl?.clientWidth ?? NaN;
    const yE  = series?.priceToCoordinate(entryPrice) ?? NaN;
    const yTp = tpPrice != null ? (series?.priceToCoordinate(tpPrice) ?? NaN) : NaN;
    const ySl = slPrice != null ? (series?.priceToCoordinate(slPrice) ?? NaN) : NaN;

    if (x0 !== last.x0 || x1 !== last.x1 || yE !== last.yE || yTp !== last.yTp || ySl !== last.ySl) {
      last = { x0, x1, yE, yTp, ySl };
      layout();
    }
    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}, [chart, series, containerEl, entryTime, entryPrice, tpPrice, slPrice, layout]);

  // kéo ở edges
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const onDown = (ev: PointerEvent) => {
      const t = ev.target as HTMLElement;
      if (t.dataset.edge === "tp") dragging.current = "tp";
      else if (t.dataset.edge === "sl") dragging.current = "sl";
      else if (t.dataset.edge === "entry") dragging.current = "entry";
    };
    const onMove = (ev: PointerEvent) => {
  if (!dragging.current || !containerEl) return;
  const b = containerEl.getBoundingClientRect();
  const price = yToPrice(ev.clientY - b.top);
  if (price == null) return;

  if (dragging.current === "tp") onChange?.({ tp: price });
  else if (dragging.current === "sl") onChange?.({ sl: price });
  else if (dragging.current === "entry") onEntryChange?.(price);      // <---
};
    const onUp = () => (dragging.current = null);

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [containerEl, yToPrice, onChange]);

  return (
    <div ref={rootRef} className="absolute inset-0">
      <div ref={profitRef} />
      <div ref={riskRef} />
      <div ref={tpEdgeRef} data-edge="tp" />
      <div ref={slEdgeRef} data-edge="sl" />
      <div ref={tpTagRef} />
      <div ref={slTagRef} />
      <div ref={entryLineRef} />
<div ref={entryTagRef} />
<div ref={entryEdgeRef} />
    </div>
  );
};

export default RRZoneOverlay;
