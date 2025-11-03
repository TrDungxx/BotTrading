import React, { useEffect } from "react";

export type ConfirmOrderPayload = {
  symbol: string;
  market: "spot" | "futures";
  type: "MARKET" | "LIMIT" | "STOP_MARKET";
  side: "BUY" | "SELL";
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: "GTC" | "IOC" | "FOK";
  workingType?: "MARK" | "LAST";
  // futures only
  positionSide?: "LONG" | "SHORT" | "BOTH";
  reduceOnly?: boolean;
};

interface Props {
  open: boolean;
  onClose: () => void;

  order: ConfirmOrderPayload | null;     // payload đã build sẵn
  sideLabel: "LONG" | "SHORT";           // để hiển thị “Mở lệnh Long/Short”
  symbol: string;
  baseAsset?: string;                    // ví dụ "BTC" (hiển thị đơn vị số lượng)
  markPrice?: number;                    // giá đánh dấu (để show)
  estFee?: number;                       // phí ước tính
  estLiqPrice?: number;                  // giá thanh lý ước tính (futures)
  priceDecimals?: number;                // format hiển thị giá

  onConfirm: (order: ConfirmOrderPayload) => void;
}

const ConfirmPlaceOrderModal: React.FC<Props> = ({
  open,
  onClose,
  order,
  sideLabel,
  symbol,
  baseAsset,
  markPrice,
  estFee,
  estLiqPrice,
  priceDecimals = 4,
  onConfirm,
}) => {
  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !order) return null;

  const fmt = (n: number | undefined, max = priceDecimals) =>
    n == null || Number.isNaN(n)
      ? "--"
      : n.toLocaleString(undefined, { maximumFractionDigits: max });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      {/* modal */}
      <div
        className="relative z-10 w-[420px] rounded-2xl bg-dark-800 border border-dark-600 p-4 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between">
          <div className="text-white font-semibold">
            {symbol}{" "}
            <div className="text-sm font-medium text-emerald-400">
              Mở lệnh {sideLabel === "LONG" ? "Long" : "Short"}
            </div>
          </div>
          <button
            className="text-dark-300 hover:text-white"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-dark-400">Giá</span>
            <span className="text-white">
              {order.type === "MARKET"
                ? "Thị trường"
                : order.type === "LIMIT"
                ? `${fmt(order.price)} USDT`
                : `Stop ${fmt(order.stopPrice)} (${order.workingType ?? "MARK"})`}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-dark-400">Số lượng</span>
            <span className="text-white">
              {fmt(order.quantity, 8)} {baseAsset ?? symbol.replace("USDT", "")}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-dark-400">Phí (ước tính)</span>
            <span className="text-white">{fmt(estFee, 6)} USDT</span>
          </div>

          <div className="flex justify-between">
            <span className="text-dark-400">Giá đánh dấu</span>
            <span className="text-white">{fmt(markPrice)} USDT</span>
          </div>

          <div className="flex justify-between">
            <span className="text-dark-400">Giá thanh lý ước tính</span>
            <span className="text-white">
              {estLiqPrice ? `${fmt(estLiqPrice)} USDT` : "--"}
            </span>
          </div>

          {order.type === "MARKET" && (
            <div className="text-[12px] text-warning-400 mt-2">
              * Lệnh có thể không khớp nếu chênh lệch vượt ngưỡng cho phép.
            </div>
          )}
        </div>

        <div className="mt-4">
          <button
            className="w-full rounded-xl bg-[#fcd535] text-black font-semibold py-2.5 hover:brightness-95"
            onClick={() => onConfirm(order)}
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmPlaceOrderModal;
