import React from "react";
import type { TVReadyCtx } from "../TVChartBinance";

export type ArmedMsg = {
  side: "long" | "short";
  entry: number;
  symbol: string;
  indicatorId: string;
};

function makeKey(m: ArmedMsg) {
  return `${m.symbol}:${m.indicatorId}:${m.side}:${m.entry}`;
}

// HSL → hex
function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// khớp với TerminalIndicator
type ActiveMsg = {
  side: "long" | "short";
  entry: number;
  timeISO: string;
  symbol: string;
  indicatorId: string;
  confirmed?: boolean;
  triggered?: boolean;
  armedFromPrice?: number;
  signalSent?: boolean;
  executedPrice?: number;
  executedAt?: string;
};

type ExtraCtx = {
  width?: number;
  height?: number;
  plotTop?: number;     // 0 nếu header overlay
  axisRightPx?: number; // bề rộng price scale bên phải
};

type Props = {
  ctx: (TVReadyCtx & ExtraCtx) | null;
  armed: ArmedMsg[]; // confirmed && !triggered
  setActiveMsgs: React.Dispatch<React.SetStateAction<ActiveMsg[]>>;
};

const BlinkingPriceLines: React.FC<Props> = ({ ctx, armed, setActiveMsgs }) => {
  type PriceLine = ReturnType<
    ReturnType<TVReadyCtx["chart"]["addCandlestickSeries"]>["createPriceLine"]
  >;

  // ---------- HOOKS (thứ tự cố định) ----------
  const linesRef = React.useRef<Map<string, PriceLine>>(new Map());
  const hueOffsetsRef = React.useRef<Map<string, number>>(new Map());
  const rafRef = React.useRef<number | null>(null);

  // canvas đo text label (hook này phải ở đây, không nằm sau return)
  const measurer = React.useMemo(() => {
    const c = document.createElement("canvas");
    const g = c.getContext("2d");
    if (g) {
      g.font =
        '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, Cantarell, "Noto Sans", sans-serif';
    }
    return g;
  }, []);

  const handleCancel = React.useCallback((m: ArmedMsg) => {
    setActiveMsgs(prev =>
      prev.filter(x =>
        !(
          x.confirmed === true &&
          x.triggered !== true &&
          x.side === m.side &&
          x.entry === m.entry &&
          x.symbol === m.symbol &&
          String(x.indicatorId) === String(m.indicatorId)
        )
      )
    );
  }, [setActiveMsgs]);

  // tạo/gỡ line theo danh sách armed
  React.useEffect(() => {
    if (!ctx?.series) return;
    const exist = linesRef.current;
    const should = new Set(armed.map(makeKey));

    // remove thừa
    for (const [k, line] of exist) {
      if (!should.has(k)) {
        try { ctx.series.removePriceLine(line); } catch {}
        exist.delete(k);
        hueOffsetsRef.current.delete(k);
      }
    }

    // add mới
    for (const m of armed) {
      const key = makeKey(m);
      if (!exist.has(key)) {
        const line = ctx.series.createPriceLine({
  price: m.entry,
  color: m.side === "long" ? "#03d1f5ff" /* cyan-400 */ : "#f472b6" /* pink-400 */,
  lineWidth: 2,
  lineStyle: 0,
  axisLabelVisible: true,
  title: `${m.side.toUpperCase()} • Waiting`,
});
        exist.set(key, line);
        hueOffsetsRef.current.set(key, hashStr(key) % 360);
      }
    }
  }, [ctx, armed]);

  // animation “thở”
  React.useEffect(() => {
  if (!ctx?.series) return;

  // chỉ còn "thở" bằng độ dày, không đổi màu mỗi frame
  const WIDTH_BASE = 1;       // dày cơ bản
  const WIDTH_SPAN = 1.5;     // biên độ "thở" nhẹ
  const BREATH_FREQ = 0.6;    // nhịp thở
  const TARGET_FPS = 30;      // throttle để nhẹ & mượt
  const FRAME_MS = 1000 / TARGET_FPS;

  const start = performance.now();
  let last = 0;

  const tick = () => {
    const now = performance.now();
    if (now - last < FRAME_MS) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    last = now;

    const t = (now - start) / 1000;

    for (const [, line] of linesRef.current) {
      // chỉ animate lineWidth, KHÔNG apply color
      const w =
        WIDTH_BASE +
        ((Math.sin(t * BREATH_FREQ) + 1) / 2) * WIDTH_SPAN; // 2.0..2.5

      try {
        (line as any).applyOptions?.({ lineWidth: Math.max(1, Math.round(w * 10) / 10) });
      } catch {}
    }

    rafRef.current = requestAnimationFrame(tick);
  };

  if (linesRef.current.size === 0) return;
  rafRef.current = requestAnimationFrame(tick);
  return () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };
}, [ctx, armed.length]);

  // cleanup toàn bộ
  React.useEffect(() => {
    return () => {
      if (ctx?.series) {
        for (const [, line] of linesRef.current) {
          try { ctx.series.removePriceLine(line); } catch {}
        }
      }
      linesRef.current.clear();
      hueOffsetsRef.current.clear();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [ctx]);
  // ---------- END HOOKS ----------

  if (!ctx) return null;

  // số đo từ ctx (được ChartWithToolbar truyền xuống)
  const width = (ctx as any).width ?? 0;
  const height = (ctx as any).height ?? 0;
  const plotTop = (ctx as any).plotTop ?? 0;        // nếu header overlay thì 0
  const axisRightPx = (ctx as any).axisRightPx ?? 64;

  // util
  const priceToY = (p: number) => {
    try {
      // @ts-ignore
      return ctx.series?.priceToCoordinate?.(p) ?? null;
    } catch { return null; }
  };

  // đo text nhãn để canh X ở bên trái label
  const X_SIZE = 18;
  const GAP = 6;
  const LABEL_PAD = 10;
  const labelText = (m: ArmedMsg) => `${m.side.toUpperCase()} • Waiting`;
  const measureLabel = (text: string) => {
    const w = measurer?.measureText(text)?.width ?? 80;
    return w + LABEL_PAD * 2;
  };

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {armed.map((m) => {
        const yPane = priceToY(m.entry);
        if (!Number.isFinite(yPane as number)) return null;

        // cùng hàng với label (cộng plotTop nếu pane bị đẩy xuống)
        const top = Math.min(
          Math.max(0, plotTop + (yPane as number) - X_SIZE / 2),
          Math.max(0, height - X_SIZE)
        );

        // đặt X ở BÊN TRÁI label
        const lblW = measureLabel(labelText(m));
        let left = width - axisRightPx - lblW - GAP - X_SIZE;
        left = Math.max(2, Math.min(left, width - axisRightPx - X_SIZE - 2));

        return (
          <button
            key={makeKey(m)}
            type="button"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleCancel(m); }}
            title="Hủy lệnh đang chờ khớp"
            style={{
              position: "absolute",
              top,
              left,
              width: X_SIZE,
              height: X_SIZE,
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,.18)",
              background: "rgba(245, 2, 2, 0.84)",
              color: "#e5e7eb",
              fontSize: 12,
              lineHeight: `${X_SIZE - 2}px`,
              textAlign: "center",
              cursor: "pointer",
              pointerEvents: "auto",
            }}
          >
            ×
          </button>
        );
      })}
    </div>
  );
};

export default BlinkingPriceLines;
