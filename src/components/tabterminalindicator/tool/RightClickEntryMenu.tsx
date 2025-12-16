import React, { useEffect, useLayoutEffect, useRef } from "react";

export type Side = "long" | "short";

type Props = {
  x: number; y: number;
  price: number;
  side: Side;
  onChangeSide?: (s: Side) => void;
  onConfirm: (payload: { side: Side; price: number }) => void;
  onClose: () => void;
  className?: string;
  /** Số lẻ tối đa sau dấu phẩy. Nếu không truyền sẽ auto theo giá. */
  decimals?: number;
};

/* ===== helpers format ===== */
function guessDecimals(p: number): number {
  if (!Number.isFinite(p)) return 4;
  if (p >= 10000) return 2;
  if (p >= 1000)  return 2;
  if (p >= 100)   return 2;
  if (p >= 1)     return 4;
  if (p >= 0.1)   return 5;
  return 6;
}
function toFixedSafe(n: number, d: number): string {
  if (!Number.isFinite(n)) return "";
  const pow = Math.pow(10, d);
  return (Math.round(n * pow) / pow).toFixed(d);
}
function clampDecimalsFromInput(v: string, maxDecimals: number): number {
  if (!v) return NaN;
  const cleaned = v.replace(",", ".");
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return NaN;
  const pow = Math.pow(10, maxDecimals);
  return Math.round(num * pow) / pow;
}

const RightClickEntryMenu: React.FC<Props> = ({
  x, y, price, side,
  onChangeSide, onConfirm, onClose,
  className, decimals,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);

  // decimals & step
  const d = React.useMemo(
    () => (typeof decimals === "number" ? Math.max(0, Math.min(8, decimals)) : guessDecimals(price)),
    [decimals, price]
  );
  const step = React.useMemo(() => parseFloat((Math.pow(10, -d)).toFixed(d)), [d]);

  const [localPrice, setLocalPrice] = React.useState<number>(price);
  const [localSide, setLocalSide] = React.useState<Side>(side);
  const [text, setText] = React.useState<string>(() => toFixedSafe(price, d));

  // Vị trí cuối cùng sau khi auto‑flip & clamp
  const [pos, setPos] = React.useState<{left:number; top:number}>({ left: x, top: y });

  // sync khi prop đổi
  useEffect(() => {
    setLocalPrice(price);
    setText(toFixedSafe(price, d));
  }, [price, d]);
  useEffect(() => setLocalSide(side), [side]);

  // Đóng/confirm nhanh
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter") {
        const final = Number.isFinite(localPrice) ? Number(localPrice) : clampDecimalsFromInput(text, d);
        if (Number.isFinite(final)) onConfirm({ side: localSide, price: final });
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, onConfirm, localSide, localPrice, text, d]);

  // === Auto‑flip & clamp trong khung chart ===
  const recomputePosition = React.useCallback(() => {
    const el = ref.current;
    const container = el?.parentElement; // overlay absolute (inset-0)
    if (!el || !container) return;

    // tạm thời hiển thị để đo size thực
    const menuRect = el.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();

    const menuW = menuRect.width || 240;
    const menuH = menuRect.height || 160;
    const cw = contRect.width;
    const ch = contRect.height;

    // mặc định hiện bên dưới con trỏ (8px offset)
    let top = y + 8;
    // nếu tràn dưới -> lật lên trên
    if (y + menuH + 8 > ch) {
      top = y - menuH - 8;
      if (top < 8) top = Math.max(8, ch - menuH - 8); // nếu vẫn tràn trên thì ghim
    } else {
      if (top + menuH + 8 > ch) top = Math.max(8, ch - menuH - 8);
    }

    // căn giữa theo trục X và clamp trong biên
    let left = x - menuW / 2;
    if (left < 8) left = 8;
    if (left + menuW + 8 > cw) left = cw - menuW - 8;

    setPos({ left, top });
  }, [x, y]);

  useLayoutEffect(() => {
    recomputePosition();
  }, [recomputePosition, d, text, localSide]);

  // cập nhật khi container resize
  useEffect(() => {
    const container = ref.current?.parentElement;
    if (!container) return;
    const ro = new ResizeObserver(() => recomputePosition());
    ro.observe(container);
    return () => ro.disconnect();
  }, [recomputePosition]);

  return (
    <div
      ref={ref}
      className={`absolute pointer-events-auto z-[95] rounded-xl border border-dark-600 bg-dark-700/95 shadow-lg backdrop-blur p-fluid-3 min-w-[220px] ${className ?? ""}`}
      style={{ left: pos.left, top: pos.top }}  // ⬅️ KHÔNG dùng transform nữa
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-fluid-xs text-white/80 mb-2">Đặt lệnh chờ</div>

      <div className="flex items-center gap-fluid-2 mb-3">
        <button
          type="button"
          className={`px-2 py-fluid-1 text-xs rounded border ${
            localSide === "long"
              ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
              : "border-dark-500 text-gray-300 hover:bg-dark-600/60"
          }`}
          onClick={() => { setLocalSide("long"); onChangeSide?.("long"); }}
        >
          LONG
        </button>
        <button
          type="button"
          className={`px-2 py-fluid-1 text-xs rounded border ${
            localSide === "short"
              ? "border-rose-500 text-rose-400 bg-rose-500/10"
              : "border-dark-500 text-gray-300 hover:bg-dark-600/60"
          }`}
          onClick={() => { setLocalSide("short"); onChangeSide?.("short"); }}
        >
          SHORT
        </button>
      </div>

      <label className="block text-fluid-xs text-white/70 mb-1">Entry</label>
      <div className="flex items-center gap-fluid-2 mb-3">
        <input
          type="number"
          className="w-full bg-dark-800 border border-dark-500 rounded px-2 py-fluid-1 text-xs text-white outline-none focus:border-primary-500/60"
          value={Number.isFinite(localPrice) ? toFixedSafe(localPrice, d) : text}
          onChange={(e) => {
            const v = clampDecimalsFromInput(e.target.value, d);
            if (Number.isFinite(v)) {
              setLocalPrice(v);
              setText(toFixedSafe(v, d));
            } else {
              setText(e.target.value);
            }
          }}
          step={step}
          inputMode="decimal"
        />
        <span className="text-fluid-xs text-white/50">USD</span>
      </div>

      <div className="flex items-center justify-end gap-fluid-2">
        <button
          type="button"
          className="px-2 py-fluid-1 text-xs rounded border border-dark-500 text-gray-300 hover:bg-dark-600/60"
          onClick={onClose}
        >
          Huỷ
        </button>
        <button
          type="button"
          className="px-fluid-3 py-fluid-1 text-xs rounded bg-primary-600 text-white hover:bg-primary-500"
          onClick={() => {
            const final = Number.isFinite(localPrice) ? Number(localPrice) : clampDecimalsFromInput(text, d);
            if (Number.isFinite(final)) onConfirm({ side: localSide, price: final });
          }}
          title="Ctrl/Cmd + Enter"
        >
          Xác nhận
        </button>
      </div>
    </div>
  );
};

export default RightClickEntryMenu;
