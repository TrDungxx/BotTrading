import React from "react";
import { X } from "lucide-react";

type Side = "LONG" | "SHORT";

type OrderPreview = {
  symbol?: string | null;
  market?: "spot" | "futures";
  side: Side;
  entry: number;
  tp?: number | null;
  sl?: number | null;
  qty?: number | null; // nếu có
};

type Props = {
  open: boolean;
  data: OrderPreview | null;
  onConfirm: () => void;
  onClose: () => void;
};

const fmt = (v: number | null | undefined, d = 6) =>
  v == null ? "—" : Number(v).toFixed(d);

const pillColorBySide = (side: Side) =>
  side === "LONG"
    ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
    : "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30";

const ConfirmOrderModal: React.FC<Props> = ({ open, data, onConfirm, onClose }) => {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !data) return null;

  const { symbol, market = "futures", side, entry, tp, sl, qty } = data;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      {/* panel */}
      <div className="absolute inset-0 flex items-center justify-center p-fluid-3">
        <div className="w-full max-w-md rounded-xl border border-dark-600 bg-dark-800 shadow-2xl">
          {/* header */}
          <div className="flex items-center justify-between px-fluid-4 py-fluid-3 border-b border-dark-600">
            <div className="flex items-center gap-fluid-2">
              <span className={`px-2 py-0.5 rounded text-fluid-xs ${pillColorBySide(side)}`}>
                {side}
              </span>
              <span className="text-fluid-sm text-gray-300 font-medium">
                Xác nhận đặt lệnh
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-white/5 text-gray-400"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* body */}
          <div className="px-fluid-4 py-fluid-3 text-fluid-sm">
            <div className="grid grid-cols-2 gap-y-2">
              <div className="text-gray-400">Symbol</div>
              <div className="text-gray-200 text-right">{symbol ?? "—"}</div>

              <div className="text-gray-400">Thị trường</div>
              <div className="text-gray-200 text-right capitalize">{market}</div>

              <div className="text-gray-400">Entry</div>
              <div className="text-gray-200 text-right font-medium">{fmt(entry)}</div>

              <div className="text-gray-400">Take Profit</div>
              <div className="text-gray-200 text-right">{fmt(tp)}</div>

              <div className="text-gray-400">Stop Loss</div>
              <div className="text-gray-200 text-right">{fmt(sl)}</div>

              <div className="text-gray-400">Số lượng</div>
              <div className="text-gray-200 text-right">{qty == null ? "—" : qty}</div>
            </div>

            {/* cảnh báo nhỏ giống Binance */}
            <div className="mt-3 text-fluid-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-fluid-1.5">
              Vui lòng kiểm tra kỹ thông số trước khi xác nhận. Lệnh TP/SL sẽ được đặt ở chế độ <b>reduce-only</b> (nếu áp dụng).
            </div>
          </div>

          {/* footer */}
          <div className="flex items-center justify-end gap-fluid-2 px-fluid-4 py-fluid-3 border-t border-dark-600">
            <button
              onClick={onClose}
              className="h-fluid-input-sm px-fluid-3 rounded border border-dark-600 text-gray-300 hover:bg-white/5"
            >
              Hủy
            </button>
            <button
              autoFocus
              onClick={onConfirm}
              className="h-fluid-input-sm px-fluid-3 rounded bg-primary/90 hover:bg-primary text-white"
            >
              Xác nhận
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmOrderModal;
