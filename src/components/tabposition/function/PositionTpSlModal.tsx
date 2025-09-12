import React from "react";
import { X } from "lucide-react";

type TriggerType = "MARK" | "LAST";
type Mode = "price" | "pnl";

export interface PositionTpSlModalProps {
  isOpen: boolean;
  onClose: () => void;

  // data vị thế đang chọn
  symbol: string;
  entryPrice: number;    // vào lệnh
  markPrice: number;     // giá đánh dấu hiện tại
  positionAmt: number;   // >0 LONG, <0 SHORT

  // rounding
  getQtyStep?: (symbol: string) => number;     // ví dụ 0.1
  getPriceTick?: (symbol: string) => number;   // ví dụ 0.0001

  onSubmit?: (payload: {
    tpPrice?: number;
    slPrice?: number;
    trigger: TriggerType;
  }) => void;
}

const fmt = (n?: number) =>
  n == null || Number.isNaN(n) ? "--" : n.toLocaleString(undefined, { maximumFractionDigits: 8 });

const clampStep = (val: number, step: number) => {
  if (!step || step <= 0) return val;
  const p = (step.toString().split(".")[1] || "").length;
  return Number((Math.round(val / step) * step).toFixed(p));
};

const PositionTpSlModal: React.FC<PositionTpSlModalProps> = ({
  isOpen,
  onClose,
  symbol,
  entryPrice,
  markPrice,
  positionAmt,
  getPriceTick,
  onSubmit,
}) => {
  const [trigger, setTrigger] = React.useState<TriggerType>("MARK");
  const [mode, setMode] = React.useState<Mode>("pnl"); // PnL% mặc định giống Binance
  const [tpInput, setTpInput] = React.useState<string>(""); // % hoặc price tuỳ mode
  const [slInput, setSlInput] = React.useState<string>("");

  if (!isOpen) return null;

  const isLong = positionAmt > 0;
  const tick = getPriceTick?.(symbol) ?? 0.0001;

  // chuyển input -> price
  const toPrice = (raw: string, kind: "tp" | "sl"): number | undefined => {
    const v = parseFloat(raw);
    if (Number.isNaN(v)) return undefined;

    // nếu mode = pnl => từ % -> target price quanh entry
    if (mode === "pnl") {
      if (kind === "tp") {
        const factor = isLong ? (1 + v / 100) : (1 - v / 100);
        return clampStep(entryPrice * factor, tick);
      } else {
        // stop loss: % âm (-x%) hoặc số dương đều OK -> mình coi là biên độ lỗ
        const pct = Math.abs(v);
        const factor = isLong ? (1 - pct / 100) : (1 + pct / 100);
        return clampStep(entryPrice * factor, tick);
      }
    }
    // mode = price -> dùng thẳng
    return clampStep(v, tick);
  };

  const handleConfirm = () => {
    const tpPrice = toPrice(tpInput, "tp");
    const slPrice = toPrice(slInput, "sl");
    onSubmit?.({ tpPrice, slPrice, trigger });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      {/* panel */}
      <div className="relative w-full max-w-md rounded-2xl bg-dark-800 border border-dark-700 shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700">
          <div className="font-semibold text-[16px] text-white">TP/SL cho toàn bộ vị thế</div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 text-sm">
          <div className="rounded-lg bg-dark-700/40 p-3">
            <div className="flex items-center justify-between text-gray-300">
              <span>Mã</span>
              <span className="text-white">{symbol} • {isLong ? "Long" : "Short"}</span>
            </div>
            <div className="flex items-center justify-between text-gray-300">
              <span>Giá vào lệnh</span>
              <span className="text-white">{fmt(entryPrice)} USDT</span>
            </div>
            <div className="flex items-center justify-between text-gray-300">
              <span>Giá đánh dấu</span>
              <span className="text-white">{fmt(markPrice)} USDT</span>
            </div>
          </div>

          {/* Trigger + Mode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-gray-300 mb-1">Trigger</div>
              <div className="flex rounded-lg overflow-hidden border border-dark-600">
                <button
                  className={`px-3 py-2 flex-1 ${trigger === "MARK" ? "bg-primary/20 text-primary" : "bg-dark-700 text-gray-300"}`}
                  onClick={() => setTrigger("MARK")}
                >Mark</button>
                <button
                  className={`px-3 py-2 flex-1 ${trigger === "LAST" ? "bg-primary/20 text-primary" : "bg-dark-700 text-gray-300"}`}
                  onClick={() => setTrigger("LAST")}
                >Last</button>
              </div>
            </div>
            <div>
              <div className="text-gray-300 mb-1">Nhập theo</div>
              <div className="flex rounded-lg overflow-hidden border border-dark-600">
                <button
                  className={`px-3 py-2 flex-1 ${mode === "pnl" ? "bg-primary/20 text-primary" : "bg-dark-700 text-gray-300"}`}
                  onClick={() => setMode("pnl")}
                >PnL %</button>
                <button
                  className={`px-3 py-2 flex-1 ${mode === "price" ? "bg-primary/20 text-primary" : "bg-dark-700 text-gray-300"}`}
                  onClick={() => setMode("price")}
                >Giá</button>
              </div>
            </div>
          </div>

          {/* TP */}
          <div>
            <div className="mb-1 text-gray-300">Take Profit</div>
            <div className="flex items-center gap-2">
              <input
                value={tpInput}
                onChange={(e) => setTpInput(e.target.value)}
                className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white outline-none"
                placeholder={mode === "pnl" ? "Nhập % (ví dụ 5)" : "Nhập giá (USDT)"}
                inputMode="decimal"
              />
              <div className="text-xs text-gray-400 min-w-[110px]">
                Ước tính: {(() => {
                  const p = toPrice(tpInput, "tp");
                  return p ? `${fmt(p)} USDT` : "--";
                })()}
              </div>
            </div>
          </div>

          {/* SL */}
          <div>
            <div className="mb-1 text-gray-300">Stop Loss</div>
            <div className="flex items-center gap-2">
              <input
                value={slInput}
                onChange={(e) => setSlInput(e.target.value)}
                className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white outline-none"
                placeholder={mode === "pnl" ? "Nhập % (ví dụ 3)" : "Nhập giá (USDT)"}
                inputMode="decimal"
              />
              <div className="text-xs text-gray-400 min-w-[110px]">
                Ước tính: {(() => {
                  const p = toPrice(slInput, "sl");
                  return p ? `${fmt(p)} USDT` : "--";
                })()}
              </div>
            </div>
          </div>

          <div className="pt-1 text-[12px] text-gray-400">
            Lệnh TP sẽ dùng <span className="text-white">TAKE_PROFIT_MARKET</span>, SL dùng <span className="text-white">STOP_MARKET</span> (reduceOnly).
          </div>
        </div>

        <div className="px-5 py-4 border-t border-dark-700">
          <button
            onClick={handleConfirm}
            className="w-full rounded-xl bg-[#fcd535] text-black font-semibold py-2.5 hover:opacity-90"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
};

export default PositionTpSlModal;
