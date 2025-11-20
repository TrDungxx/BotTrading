import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

type Mode = "market" | "limit";

export interface ClosePositionModalProps {
  isOpen: boolean;
  onClose: () => void;

  mode: Mode;                         // 'market' | 'limit'
  symbol: string;
  side: "BUY" | "SELL";               // side để ĐÓNG vị thế
  positionSide?: "LONG" | "SHORT" | "BOTH";

  markPrice?: number;                 // giá mark hiện tại
  entryPrice?: number;                // giá entry (đã có trong row)
  maxQty: number;                     // |positionAmt|
  stepSize: number;                   // bước khối lượng
  tickSize: number;                   // bước giá

  // controlled inputs (đồng bộ với row)
  price?: string;                     // giá ở row (limit)
  qty?: string;                       // qty ở row
  onInputsChange?: (next: { price?: string; qty?: string }) => void;

  onConfirm: (payload: {
    type: "MARKET" | "LIMIT";
    symbol: string;
    side: "BUY" | "SELL";
    positionSide?: "LONG" | "SHORT" | "BOTH";
    quantity: number;
    price?: number;
    reduceOnly?: boolean;
    timeInForce?: "GTC";
  }) => void;
}

const clampQty = (q: number, max: number) => Math.max(0, Math.min(q, max));

const roundToStep = (v: number, step: number) => {
  if (!step || step <= 0) return v;
  const p = (step.toString().split(".")[1] || "").length;
  return Number((Math.floor(v / step) * step).toFixed(p));
};

const roundToTick = (v: number, tick: number) => {
  if (!tick || tick <= 0) return v;
  const p = (tick.toString().split(".")[1] || "").length;
  return Number((Math.round(v / tick) * tick).toFixed(p));
};

const fmt = (n?: number, maxFrac = 8) =>
  n == null || Number.isNaN(n)
    ? "--"
    : n.toLocaleString(undefined, { maximumFractionDigits: maxFrac });

const ClosePositionModal: React.FC<ClosePositionModalProps> = ({
  isOpen,
  onClose,
  mode,
  symbol,
  side,
  positionSide,
  markPrice,
  entryPrice,
  maxQty,
  stepSize,
  tickSize,
  price,
  qty,
  onInputsChange,
  onConfirm,
}) => {
  const [localPrice, setLocalPrice] = useState<string>(price ?? "");
  const [localQty, setLocalQty] = useState<string>(qty ?? "");

  useEffect(() => setLocalPrice(price ?? ""), [price]);
  useEffect(() => setLocalQty(qty ?? ""), [qty]);

  const parsedQty = useMemo(() => {
    const q = Number(localQty || 0);
    if (!Number.isFinite(q)) return 0;
    return clampQty(roundToStep(q, stepSize), maxQty);
  }, [localQty, stepSize, maxQty]);

  const parsedPrice = useMemo(() => {
    const base = mode === "market" ? markPrice : Number(localPrice || NaN);
    if (!Number.isFinite(base)) return undefined;
    return roundToTick(base, tickSize);
  }, [mode, localPrice, markPrice, tickSize]);

  // ======= PnL ƯỚC TÍNH =======
  // LONG:  pnl = qty * (close - entry)
  // SHORT: pnl = qty * (entry - close)
  const estPnl = useMemo(() => {
    if (!Number.isFinite(entryPrice || NaN)) return undefined;
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) return undefined;
    if (!Number.isFinite(parsedPrice || NaN)) return undefined;

    const dir = (positionSide ?? "BOTH") === "SHORT" ? -1 : 1; // LONG=+1, SHORT=-1
    const close = parsedPrice!;
    const entry = entryPrice!;
    return parsedQty * (close - entry) * dir;
  }, [parsedQty, parsedPrice, entryPrice, positionSide]);

  const pnlColor =
    estPnl == null
      ? "text-white"
      : estPnl > 0
      ? "text-[#0ecb81]"
      : estPnl < 0
      ? "text-[#f6465d]"
      : "text-white";

  // cảnh báo lệch >10% (chỉ cho limit và khi có mark & price)
  const bigDeviation =
    mode === "limit" &&
    Number.isFinite(markPrice || NaN) &&
    Number.isFinite(parsedPrice || NaN) &&
    Math.abs((parsedPrice! - markPrice!) / markPrice!) > 0.1;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-[420px] max-w-[92vw] rounded-xl border border-dark-600 bg-dark-800 p-4 shadow-xl">
        <button
          className="absolute right-3 top-3 text-dark-300 hover:text-white"
          onClick={onClose}
          aria-label="close"
        >
          <X size={18} />
        </button>

        <div className="text-white text-lg font-semibold">{symbol}</div>
        <div className="text-[#9ca3af] text-sm mt-1">
          Đóng lệnh {(positionSide ?? "LONG").toLowerCase()}
        </div>

        <div className="mt-4 space-y-3 text-sm">
          {/* Giá */}
          <div className="flex items-center justify-between">
            <div className="text-dark-300">Giá</div>
            <div className="text-right">
              {mode === "market" ? (
                <div className="px-2 py-1 rounded bg-dark-700 text-white">Thị trường</div>
              ) : (
                <input
                  inputMode="decimal"
                  value={localPrice}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLocalPrice(v);
                    onInputsChange?.({ price: v, qty: localQty });
                  }}
                  className="w-[150px] bg-dark-700 border border-dark-600 rounded px-2 py-1 text-white text-right"
                  placeholder={markPrice ? String(markPrice) : "Giá"}
                />
              )}
              <div className="text-[11px] text-dark-400 mt-1">
                Mark: {fmt(markPrice)} • Tick: {tickSize}
              </div>
            </div>
          </div>

          {/* Số lượng */}
          <div className="flex items-center justify-between">
            <div className="text-dark-300">Số lượng</div>
            <div className="text-right">
              <input
                inputMode="decimal"
                value={localQty}
                onChange={(e) => {
                  const v = e.target.value;
                  setLocalQty(v);
                  onInputsChange?.({ price: localPrice, qty: v });
                }}
                className="w-[150px] bg-dark-700 border border-dark-600 rounded px-2 py-1 text-white text-right"
                placeholder={String(maxQty)}
              />
              <div className="text-[11px] text-dark-400 mt-1">
                Tối đa: {fmt(maxQty)} • Step: {stepSize}
              </div>
            </div>
          </div>

          {/* Lời lỗ ước tính */}
          <div className="flex items-center justify-between">
            <div className="text-dark-300">Lời lỗ ước tính</div>
            <div className={`text-right ${pnlColor}`}>
              {estPnl == null ? "--" : `${fmt(estPnl, 2)} USDT`}
            </div>
          </div>

          {/* Cảnh báo lệch giá (chỉ hiển thị khi cần) */}
          {bigDeviation && (
            <div className="text-[12px] text-[#ef4444] bg-[#ef4444]/10 rounded p-2">
              Lệnh của bạn sẽ không thành công nếu giá thị trường lệch hơn 10% so với giá đánh dấu.
            </div>
          )}
        </div>

        <div className="mt-5">
          <button
  className="w-full rounded-xl bg-[#fcd535] text-black font-semibold py-2.5 hover:brightness-95"
  onClick={() => {
  const q = parsedQty;
  if (!q) return;

  // xác định chiều vị thế đang MỞ để chọn side đóng
  const isLongPos = (positionSide ?? "LONG") === "LONG";
  const sideClose: "BUY" | "SELL" = isLongPos ? "SELL" : "BUY";

  if (mode === "market") {
    // ĐÓNG NGAY: MARKET (không reduceOnly)
    if (!Number.isFinite(markPrice || NaN)) return;
    onConfirm({
      type: "MARKET",
      symbol,
      side: sideClose,
      positionSide,      // QUAN TRỌNG: LONG/SHORT
      quantity: q,
    });
  } else {
    // ĐẶT LỆNH CHỜ: STOP-LIMIT / TAKE_PROFIT-LIMIT
    if (!parsedPrice) return;

    const m = Number.isFinite(markPrice) ? (markPrice as number) : parsedPrice;

    // Long đóng ở giá cao hơn -> TAKE_PROFIT, thấp hơn -> STOP
    // Short đóng ở giá thấp hơn -> TAKE_PROFIT, cao hơn -> STOP
    const orderType =
      isLongPos
        ? (parsedPrice >= m ? "TAKE_PROFIT" : "STOP")
        : (parsedPrice <= m ? "TAKE_PROFIT" : "STOP");

    onConfirm({
      // gửi về cha kiểu điều kiện để cha map thành stop-limit
      type: orderType as any,  // "STOP" | "TAKE_PROFIT"
      symbol,
      side: sideClose,
      positionSide,            // QUAN TRỌNG
      quantity: q,
      price: parsedPrice,      // cha sẽ dùng cho cả stopPrice & price
      // timeInForce/workingType set ở handler cha (nếu cần)
    });
  }

  onClose();
}}
>
  Xác nhận
</button>


        </div>
      </div>
    </div>
  );
};

export default ClosePositionModal;
