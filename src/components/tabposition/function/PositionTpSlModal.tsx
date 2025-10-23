import React from "react";
import { X } from "lucide-react";

type TriggerType = "MARK" | "LAST";
type InputMode = "price" | "pnl_abs" | "roi_pct";

export interface PositionTpSlModalProps {
  isOpen: boolean;
  onClose: () => void;

  symbol: string;
  entryPrice: number;
  markPrice: number;
  positionAmt: number; // >0 LONG, <0 SHORT (base)

  getPriceTick?: (symbol: string) => number;

  leverage?: number;                 // dùng để tính ROI%
  market?: "spot" | "futures";       // chỉ để hiển thị nếu muốn

  onSubmit?: (payload: {
    tpPrice?: number;
    slPrice?: number;
    trigger: TriggerType;
  }) => void;
}

const fmt = (n?: number, maxFrac = 8) =>
  n == null || Number.isNaN(n)
    ? "--"
    : n.toLocaleString(undefined, { maximumFractionDigits: maxFrac });

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
  leverage,
  onSubmit,
}) => {
  const [trigger, setTrigger] = React.useState<TriggerType>("MARK");
  const [mode, setMode] = React.useState<InputMode>("pnl_abs"); // mặc định PnL như Binance
  const [tpInput, setTpInput] = React.useState<string>("");
  const [slInput, setSlInput] = React.useState<string>("");

  if (!isOpen) return null;

  const isLong = positionAmt > 0;
  const qty = Math.abs(positionAmt);
  const safeQty = Math.max(qty, 1e-12); // tránh chia 0
  const tick = getPriceTick?.(symbol) ?? 0.0001;
  const lev = leverage && leverage > 0 ? leverage : 1;

  const initialMargin = (entryPrice * safeQty) / lev;

  // ---- converters (KHÔNG dùng biến rời tên "pnl") ----
  const priceFromPnLAbs = (pnlAbs: number) => {
    // pnlAbs luôn dương; quyết định chiều theo positionSide & mục TP/SL sẽ làm ở toPrice
    const pnlSignedForLong = pnlAbs;      // LONG: TP = +, SL = -
    const pnlSignedForShort = -pnlAbs;    // SHORT: TP = -, SL = +
    // chọn chiều lời cho TP
    const pnlForTP = isLong ? pnlSignedForLong : pnlSignedForShort;
    return entryPrice + pnlForTP / safeQty;
  };

  const priceFromPnLSigned = (pnlSigned: number) => {
    // chuyển trực tiếp PnL có dấu -> target
    return isLong ? entryPrice + pnlSigned / safeQty : entryPrice + pnlSigned / safeQty;
  };

  const priceFromRoiAbs = (roiAbsPct: number) => {
    const pnlAbs = (roiAbsPct / 100) * initialMargin;
    return priceFromPnLAbs(pnlAbs);
  };
// ngay trong component, sau khi có isLong, entryPrice, safeQty...
const targetForSignedPnL = (pnlSigned: number) => {
  // LONG: entry + pnl/qty ; SHORT: entry - pnl/qty
  return isLong ? entryPrice + pnlSigned / safeQty : entryPrice - pnlSigned / safeQty;
};

  const toPrice = (raw: string, kind: "tp" | "sl"): number | undefined => {
  const v = parseFloat(raw);
  if (!Number.isFinite(v)) return undefined;

  if (mode === "price") {
    return clampStep(v, tick);
  }

  if (mode === "pnl_abs") {
    // người dùng nhập PnL tuyệt đối (USDT)
    const pnlAbs = Math.abs(v);
    // TP = lời (+), SL = lỗ (-)
    const pnlSigned = kind === "tp" ? +pnlAbs : -pnlAbs;
    return clampStep(targetForSignedPnL(pnlSigned), tick);
  }

  // mode === "roi_pct": người dùng nhập ROI%
  const roiAbs = Math.abs(v);
  const pnlAbs = (roiAbs / 100) * initialMargin;
  // TP = lời (+), SL = lỗ (-)
  const pnlSigned = kind === "tp" ? +pnlAbs : -pnlAbs;
  return clampStep(targetForSignedPnL(pnlSigned), tick);
};

  // tính PnL & ROI% từ target price
  const calcPnLAndROI = (target?: number) => {
    if (!target || !Number.isFinite(target) || target <= 0) return { pnlVal: NaN, roiPct: NaN };
    const pnlVal = isLong ? (target - entryPrice) * safeQty : (entryPrice - target) * safeQty;
    const roiPct = initialMargin > 0 ? (pnlVal / initialMargin) * 100 : NaN;
    return { pnlVal, roiPct };
  };

  const tpPrice = toPrice(tpInput, "tp");
  const slPrice = toPrice(slInput, "sl");
  const tpEst = calcPnLAndROI(tpPrice);
  const slEst = calcPnLAndROI(slPrice);

  const handleConfirm = () => {
    onSubmit?.({ tpPrice, slPrice, trigger });
    onClose();
  };

  

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
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
              <span className="text-white">
                {symbol} • {isLong ? "Long" : "Short"} {lev ? `• ${lev}x` : ""}
              </span>
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
                  className={`px-3 py-2 flex-1 ${"MARK" === trigger ? "bg-primary/20 text-primary" : "bg-dark-700 text-gray-300"}`}
                  onClick={() => setTrigger("MARK")}
                >
                  Mark
                </button>
                <button
                  className={`px-3 py-2 flex-1 ${"LAST" === trigger ? "bg-primary/20 text-primary" : "bg-dark-700 text-gray-300"}`}
                  onClick={() => setTrigger("LAST")}
                >
                  Last
                </button>
              </div>
            </div>

            <div>
              <div className="text-gray-300 mb-1">Nhập theo</div>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as InputMode)}
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white outline-none"
              >
                <option value="pnl_abs">PnL</option>
                <option value="roi_pct">ROI%</option>
                <option value="price">Giá</option>
              </select>
            </div>
          </div>

          {/* TP */}
          <div>
            <div className="mb-1 text-gray-300">
              Take Profit{" "}
              <span className="text-xs text-gray-500">
                ({mode === "pnl_abs" ? "PnL USDT" : mode === "roi_pct" ? "ROI %" : "Giá USDT"})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={tpInput}
                onChange={(e) => setTpInput(e.target.value)}
                className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white outline-none"
                placeholder={mode === "pnl_abs" ? "Nhập PnL (vd 5)" : mode === "roi_pct" ? "Nhập ROI% (vd 10)" : "Nhập giá (USDT)"}
                inputMode="decimal"
              />
              <div className="text-xs text-gray-400 min-w-[190px]">
                Ước tính:&nbsp;
                {tpPrice ? (
                  <>
                    <span className="text-white">{fmt(tpPrice)} </span>
                    {" • "}
                    <span className={tpEst.pnlVal >= 0 ? "text-success-400" : "text-danger-400"}>
                      {fmt(tpEst.pnlVal, 4)} USDT
                    </span>
                    {" ("}
                    {Number.isFinite(tpEst.roiPct) ? fmt(tpEst.roiPct, 2) : "--"}
                    {"%)"}
                  </>
                ) : (
                  "--"
                )}
              </div>
            </div>
          </div>

          {/* SL */}
          <div>
            <div className="mb-1 text-gray-300">
              Stop Loss{" "}
              <span className="text-xs text-gray-500">
                ({mode === "pnl_abs" ? "PnL USDT" : mode === "roi_pct" ? "ROI %" : "Giá USDT"})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={slInput}
                onChange={(e) => setSlInput(e.target.value)}
                className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white outline-none"
                placeholder={mode === "pnl_abs" ? "Nhập -PnL (vd 3)" : mode === "roi_pct" ? "Nhập -ROI% (vd 5)" : "Nhập giá (USDT)"}
                inputMode="decimal"
              />
              <div className="text-xs text-gray-400 min-w-[190px]">
                Ước tính:&nbsp;
                {slPrice ? (
                  <>
                    <span className="text-white">{fmt(slPrice)} USDT</span>
                    {" • "}
                    <span className={slEst.pnlVal >= 0 ? "text-success-400" : "text-danger-400"}>
                      {fmt(slEst.pnlVal, 4)} USDT
                    </span>
                    {" ("}
                    {Number.isFinite(slEst.roiPct) ? fmt(slEst.roiPct, 2) : "--"}
                    {"%)"}
                  </>
                ) : (
                  "--"
                )}
              </div>
            </div>
          </div>

          <div className="pt-1 text-[12px] text-gray-400">
            Lệnh TP dùng <span className="text-white">TAKE_PROFIT_MARKET</span>, SL dùng{" "}
            <span className="text-white">STOP_MARKET</span> 
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
