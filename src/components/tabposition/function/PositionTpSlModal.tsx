import React from "react";
import { X } from "lucide-react";
import { binanceWS, OPEN_ORDERS_LS_KEY, OPEN_ORDERS_EVENT } from "../../binancewebsocket/BinanceWebSocketService";
// ^^^ nhớ export OPEN_ORDERS_LS_KEY/OPEN_ORDERS_EVENT ở BinanceWebSocketService.ts như đã trao đổi

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

  leverage?: number;
  market?: "spot" | "futures";

  onSubmit?: (payload: {
    tpPrice?: number;
    slPrice?: number;
    trigger: TriggerType;
  }) => void;
}

const fmt = (n?: number, maxFrac = 8) =>
  n == null || Number.isNaN(n) ? "--" : n.toLocaleString(undefined, { maximumFractionDigits: maxFrac });

const clampStep = (val: number, step: number) => {
  if (!step || step <= 0) return val;
  const p = (step.toString().split(".")[1] || "").length;
  return Number((Math.round(val / step) * step).toFixed(p));
};

// ---------- helpers LS/event cho optimistic ----------
function readOpenOrdersLS(): any[] {
  try { return JSON.parse(localStorage.getItem(OPEN_ORDERS_LS_KEY) || "[]"); } catch { return []; }
}
function writeOpenOrdersLS(list: any[]) {
  localStorage.setItem(OPEN_ORDERS_LS_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(OPEN_ORDERS_EVENT, { detail: { list } }));
}
function optimisticAddOpenOrder(row: any) {
  const list = readOpenOrdersLS();
  writeOpenOrdersLS([row, ...list]);
}

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
  const positionSide = (isLong ? "LONG" : "SHORT") as "LONG" | "SHORT";

  const initialMargin = (entryPrice * safeQty) / lev;

  // ---- converters
  const targetForSignedPnL = (pnlSigned: number) =>
    isLong ? entryPrice + pnlSigned / safeQty : entryPrice - pnlSigned / safeQty;

  const toPrice = (raw: string, kind: "tp" | "sl"): number | undefined => {
    const v = parseFloat(raw);
    if (!Number.isFinite(v)) return undefined;

    if (mode === "price") return clampStep(v, tick);

    if (mode === "pnl_abs") {
      const pnlSigned = kind === "tp" ? +Math.abs(v) : -Math.abs(v);
      return clampStep(targetForSignedPnL(pnlSigned), tick);
    }

    // roi_pct
    const pnlAbs = (Math.abs(v) / 100) * initialMargin;
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

  // ---------- đặt lệnh + optimistic ----------
  const handleConfirm = () => {
    // gọi callback cũ nếu bạn vẫn dùng
    onSubmit?.({ tpPrice, slPrice, trigger });

    const base = {
      market: "futures" as const,
      symbol,
      quantity: safeQty, // server làm tròn bước qty; nếu cần bạn có stepSize thì round ở đây
      workingType: trigger,
      reduceOnly: true as const,
      positionSide,
    };

    const sideForClose = isLong ? "SELL" : "BUY";

    // OPTIMISTIC + WS: TP
    if (Number.isFinite(tpPrice as number)) {
      const optimisticRow = {
        orderId: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        symbol,
        side: sideForClose,
        type: "TAKE_PROFIT_MARKET",
        status: "NEW",
        price: 0,
        stopPrice: tpPrice,
        workingType: trigger,
        origQty: String(safeQty),
        executedQty: "0",
        time: Date.now(),
        _optimistic: true,
      };
      optimisticAddOpenOrder(optimisticRow);

      binanceWS.placeOrder({
        ...base,
        side: sideForClose as "BUY" | "SELL",
        type: "TAKE_PROFIT_MARKET",
        stopPrice: tpPrice!,
      });
    }

    // OPTIMISTIC + WS: SL
    if (Number.isFinite(slPrice as number)) {
      const optimisticRow = {
        orderId: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        symbol,
        side: sideForClose,
        type: "STOP_MARKET",
        status: "NEW",
        price: 0,
        stopPrice: slPrice,
        workingType: trigger,
        origQty: String(safeQty),
        executedQty: "0",
        time: Date.now(),
        _optimistic: true,
      };
      optimisticAddOpenOrder(optimisticRow);

      binanceWS.placeOrder({
        ...base,
        side: sideForClose as "BUY" | "SELL",
        type: "STOP_MARKET",
        stopPrice: slPrice!,
      });
    }

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
