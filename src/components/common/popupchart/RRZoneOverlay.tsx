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

  zoneWidthPx?: number;
  side: Side;

  onChange?: (v: { tp?: number | null; sl?: number | null }) => void;
  onEntryChange?: (price: number) => void;
  tickSize?: number;                    // default 0.0001
  preserveOffsetsOnEntryDrag?: boolean; // default true
  guardCrossing?: boolean;              // default true
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
  tickSize = 0.0001,
  preserveOffsetsOnEntryDrag = true,
  guardCrossing = true,
  zoneWidthPx,
}) => {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const profitRef = React.useRef<HTMLDivElement | null>(null);
  const riskRef = React.useRef<HTMLDivElement | null>(null);
  const tpEdgeRef = React.useRef<HTMLDivElement | null>(null);
  const slEdgeRef = React.useRef<HTMLDivElement | null>(null);
  const tpTagRef = React.useRef<HTMLDivElement | null>(null);
  const slTagRef = React.useRef<HTMLDivElement | null>(null);
  const entryLineRef = React.useRef<HTMLDivElement | null>(null);
  const entryTagRef = React.useRef<HTMLDivElement | null>(null);
  const entryEdgeRef = React.useRef<HTMLDivElement | null>(null);

  const dragging = React.useRef<null | "tp" | "sl" | "entry">(null);
  const EDGE_MARGIN_PX = 6;

  const yToPrice = React.useCallback(
    (y: number) => series?.coordinateToPrice(y) ?? null,
    [series]
  );
  const priceToY = React.useCallback(
    (p: number | null) => (p == null ? null : series?.priceToCoordinate(p) ?? null),
    [series]
  );
  const timeToX = React.useCallback(
    (t: Time) => chart?.timeScale().timeToCoordinate(t) ?? null,
    [chart]
  );

  const snap = React.useCallback(
    (p: number) => {
      if (!tickSize || tickSize <= 0) return p;
      return Math.round(p / tickSize) * tickSize;
    },
    [tickSize]
  );

  const guardTpSl = React.useCallback(
    (
      nextEntry: number,
      nextTp: number | null,
      nextSl: number | null
    ): { tp: number | null; sl: number | null } => {
      if (!guardCrossing) return { tp: nextTp, sl: nextSl };
      if (side === "LONG") {
        if (nextTp != null && nextTp < nextEntry) nextTp = nextEntry;
        if (nextSl != null && nextSl > nextEntry) nextSl = nextEntry;
      } else {
        if (nextTp != null && nextTp > nextEntry) nextTp = nextEntry;
        if (nextSl != null && nextSl < nextEntry) nextSl = nextEntry;
      }
      return { tp: nextTp, sl: nextSl };
    },
    [guardCrossing, side]
  );

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const layout = React.useCallback(() => {
    if (!containerEl || !rootRef.current) return;

    const x0 = timeToX(entryTime);
    const yEntry = priceToY(entryPrice);
    const yTp = priceToY(tpPrice);
    const ySl = priceToY(slPrice);
    if (x0 == null || yEntry == null) return;

    const fullW = containerEl.clientWidth;
    const maxRight = fullW - 1;

    // ngang: giới hạn vùng từ entryTime sang phải
    const left = Math.max(0, Math.min(x0, maxRight));
    const xR = zoneWidthPx != null ? Math.min(left + zoneWidthPx, maxRight) : maxRight;
    const widthPx = Math.max(0, xR - left);

    // --- root overlay: co đúng vùng & cắt tràn ---
    const root = rootRef.current!;
    root.style.position = "absolute";
    root.style.left = `${left}px`;
    root.style.top = "0px";
    root.style.width = `${widthPx}px`;
    root.style.height = `${containerEl.clientHeight}px`;
    root.style.right = "auto";
    root.style.bottom = "auto";
    root.style.pointerEvents = "none";
    root.style.zIndex = "3";

    // CẮT TRÀN + cô lập paint/layout
    root.style.overflow = "hidden";
    root.style.clipPath = "inset(0)";
    (root.style as any).webkitClipPath = "inset(0)";
    root.style.boxSizing = "border-box";
    root.style.contain = "layout paint size";
    root.style.isolation = "isolate";
    root.style.transform = "translateZ(0)";

    // helper vẽ rect
    const placeRect = (
      div: HTMLDivElement | null,
      yA: number | null,
      yB: number | null,
      color: string,
      borderColor: string
    ) => {
      if (!div || yA == null || yB == null) return div && (div.style.display = "none");
      const top = Math.min(yA, yB);
      const h = Math.abs(yA - yB);
      div.style.display = "block";
      div.style.position = "absolute";
      div.style.left = `0px`;
      div.style.width = `${widthPx}px`;
      div.style.top = `${clamp(top, 0, containerEl.clientHeight - h)}px`;
      div.style.height = `${h}px`;
      div.style.background = color;
      div.style.border = `1px solid ${borderColor}`;
      div.style.overflow = "hidden";
    };

    // profit / risk
    if (yTp != null) {
      const green = "rgba(43,153,83,0.18)";
      const greenB = "rgba(21,226,96,0.35)";
      if (side === "LONG") placeRect(profitRef.current, yEntry, yTp, green, greenB);
      else placeRect(profitRef.current, yTp, yEntry, green, greenB);
    } else if (profitRef.current) profitRef.current.style.display = "none";

    if (ySl != null) {
      const red = "rgba(170,66,66,0.18)";
      const redB = "rgba(239,68,68,0.35)";
      if (side === "LONG") placeRect(riskRef.current, ySl, yEntry, red, redB);
      else placeRect(riskRef.current, yEntry, ySl, red, redB);
    } else if (riskRef.current) riskRef.current.style.display = "none";

    // edges TP/SL
    const placeEdge = (
      div: HTMLDivElement | null,
      y: number | null,
      color: string,
      name: "tp" | "sl"
    ) => {
      if (!div || y == null) return div && (div.style.display = "none");
      const top = clamp(Math.round(y - EDGE_MARGIN_PX), 0, containerEl.clientHeight - EDGE_MARGIN_PX * 2);
      div.style.display = "block";
      div.style.position = "absolute";
      div.style.left = `0px`;
      div.style.width = `${widthPx}px`;
      div.style.top = `${top}px`;
      div.style.height = `${EDGE_MARGIN_PX * 2}px`;
      div.style.borderTop = `1px solid ${color}`;
      div.style.cursor = "ns-resize";
      div.style.pointerEvents = "auto";
      div.style.background = "transparent";
      div.style.overflow = "hidden";
      (div as any).dataset.edge = name;
    };
    placeEdge(tpEdgeRef.current, yTp, "rgba(27,206,93,1)", "tp");
    placeEdge(slEdgeRef.current, ySl, "rgba(239,68,68,1)", "sl");

    // entry dashed line (overlay)
    if (entryLineRef.current && yEntry != null) {
      const el = entryLineRef.current;
      el.style.display = "block";
      el.style.position = "absolute";
      el.style.left = `0px`;
      el.style.width = `${widthPx}px`;
      el.style.top = `${Math.round(yEntry - 1)}px`;
      el.style.height = `0px`;
      el.style.borderTop = "1px dashed rgba(255,255,255,0.45)";
      el.style.pointerEvents = "none";
      el.style.overflow = "hidden";
    }

    // entry tag (mép phải vùng)
    if (entryTagRef.current && yEntry != null) {
      const tag = entryTagRef.current;
      const tagW = 64, tagH = 20;
      const leftPx = clamp(widthPx - tagW, 0, Math.max(0, widthPx - tagW));
      const topPx = clamp(Math.round(yEntry - tagH / 2), 0, containerEl.clientHeight - tagH);

      tag.style.display = "block";
      tag.style.position = "absolute";
      tag.style.left = `${leftPx}px`;
      tag.style.top = `${topPx}px`;
      tag.style.width = `${tagW}px`;
      tag.style.height = `${tagH}px`;
      tag.style.fontSize = "12px";
      tag.style.lineHeight = `${tagH}px`;
      tag.style.textAlign = "center";
      tag.style.borderRadius = "4px";
      tag.style.color = "#cbd5e1";
      tag.style.background = "rgba(148,163,184,0.15)";
      tag.style.border = "1px solid rgba(148,163,184,0.35)";
      tag.style.fontWeight = "600";
      tag.style.pointerEvents = "none";
      tag.style.overflow = "hidden";
      tag.innerText = "Entry";
    }

    // entry edge (kéo entry)
    const placeEntryEdge = (div: HTMLDivElement | null, y: number | null) => {
      if (!div || y == null) return div && (div.style.display = "none");
      const top = clamp(Math.round(y - 2), 0, containerEl.clientHeight - 12);
      div.style.display = "block";
      div.style.position = "absolute";
      div.style.left = `0px`;
      div.style.width = `${widthPx}px`;
      div.style.top = `${top}px`;
      div.style.height = `12px`;
      div.style.borderTop = `1px dashed rgba(148,163,184,0.9)`;
      div.style.cursor = "ns-resize";
      div.style.pointerEvents = "auto";
      div.style.background = "transparent";
      div.style.overflow = "hidden";
      (div as any).dataset.edge = "entry";
    };
    placeEntryEdge(entryEdgeRef.current, yEntry);

    // TP/SL tags (mép phải vùng)
    const placeTag = (
      tag: HTMLDivElement | null,
      y: number | null,
      bg: string,
      text: string
    ) => {
      if (!tag || y == null) return tag && (tag.style.display = "none");
      const tagW = 64, tagH = 20;
      const leftPx = clamp(widthPx - tagW, 0, Math.max(0, widthPx - tagW));
      const topPx = clamp(Math.round(y - tagH / 2), 0, containerEl.clientHeight - tagH);

      tag.style.display = "block";
      tag.style.position = "absolute";
      tag.style.left = `${leftPx}px`;
      tag.style.top = `${topPx}px`;
      tag.style.width = `${tagW}px`;
      tag.style.height = `${tagH}px`;
      tag.style.fontSize = "12px";
      tag.style.lineHeight = `${tagH}px`;
      tag.style.textAlign = "center";
      tag.style.borderRadius = "4px";
      tag.style.color = "#0b0f14";
      tag.style.fontWeight = "600";
      tag.style.pointerEvents = "none";
      tag.style.background = bg;
      tag.style.overflow = "hidden";
      tag.innerText = text;
    };
    if (yTp != null) placeTag(tpTagRef.current, yTp, "#38c56cff", `TP  ${tpPrice!.toFixed(3)}`);
    if (ySl != null) placeTag(slTagRef.current, ySl, "#ef4444", `SL  ${slPrice!.toFixed(3)}`);
  }, [
    chart,
    containerEl,
    entryTime,
    entryPrice,
    tpPrice,
    slPrice,
    side,
    priceToY,
    timeToX,
    zoneWidthPx,
  ]);

  // pan/zoom X + resize + pane-size changes
  React.useEffect(() => {
    if (!chart) return;
    const rerender = () => layout();

    const ts = chart.timeScale();
    ts.subscribeVisibleTimeRangeChange(rerender);

    const ro = containerEl ? new ResizeObserver(rerender) : null;
    ro?.observe(containerEl!);

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
        try {
          unsubPS();
        } catch {}
      }
    };
  }, [chart, series, containerEl, layout]);

  // rAF loop để bám autoscale/zoom
  React.useEffect(() => {
    let raf = 0;
    let last = { x0: NaN, x1: NaN, yE: NaN, yTp: NaN, ySl: NaN };

    const tick = () => {
      const x0 = chart?.timeScale().timeToCoordinate(entryTime) ?? NaN;
      const x1 = containerEl?.clientWidth ?? NaN;
      const yE = series?.priceToCoordinate(entryPrice) ?? NaN;
      const yTp =
        tpPrice != null ? series?.priceToCoordinate(tpPrice) ?? NaN : NaN;
      const ySl =
        slPrice != null ? series?.priceToCoordinate(slPrice) ?? NaN : NaN;

      if (
        x0 !== last.x0 ||
        x1 !== last.x1 ||
        yE !== last.yE ||
        yTp !== last.yTp ||
        ySl !== last.ySl
      ) {
        last = { x0, x1, yE, yTp, ySl };
        layout();
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [chart, series, containerEl, entryTime, entryPrice, tpPrice, slPrice, layout]);

  // Drag TP/SL/Entry
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el || !containerEl) return;

    const onDown = (ev: PointerEvent) => {
      const t = ev.target as HTMLElement;
      const edge = (t?.dataset?.edge as "tp" | "sl" | "entry" | undefined) ?? undefined;
      if (edge) {
        dragging.current = edge;
        ev.preventDefault();
      }
    };

    const onMove = (ev: PointerEvent) => {
      if (!dragging.current) return;
      const rect = containerEl.getBoundingClientRect();
      const raw = yToPrice(ev.clientY - rect.top);
      if (raw == null) return;

      const price = snap(raw);

      if (dragging.current === "tp") {
        onChange?.({ tp: price });
        return;
      }
      if (dragging.current === "sl") {
        onChange?.({ sl: price });
        return;
      }

      // entry
      onEntryChange?.(price);

      if (preserveOffsetsOnEntryDrag) {
        const delta = price - entryPrice;
        let nextTp = tpPrice != null ? snap(tpPrice + delta) : null;
        let nextSl = slPrice != null ? snap(slPrice + delta) : null;

        const guarded = guardTpSl(price, nextTp, nextSl);
        onChange?.({ tp: guarded.tp, sl: guarded.sl });
      }
    };

    const onUp = () => {
      dragging.current = null;
    };

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [
    containerEl,
    yToPrice,
    onChange,
    onEntryChange,
    preserveOffsetsOnEntryDrag,
    entryPrice,
    tpPrice,
    slPrice,
    snap,
    guardTpSl,
  ]);

  return (
    <div ref={rootRef} className="absolute">
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
