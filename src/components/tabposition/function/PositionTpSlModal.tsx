import React, { useEffect } from "react";
import { X } from "lucide-react";
import { binanceWS, OPEN_ORDERS_LS_KEY, OPEN_ORDERS_EVENT } from "../../binancewebsocket/BinanceWebSocketService";

type TriggerType = "MARK_PRICE" | "LAST";
type InputMode = "price" | "pnl_abs" | "roi_pct";

export function clearPositionTpSlMetadata(symbol: string, positionSide: 'LONG' | 'SHORT') {
  try {
    const metadata = JSON.parse(localStorage.getItem('tpsl_metadata') || '{}');
    const metaKey = `${symbol}:${positionSide}`;
    delete metadata[metaKey];
    localStorage.setItem('tpsl_metadata', JSON.stringify(metadata));
  } catch {}
}

export interface PositionTpSlModalProps {
  isOpen: boolean;
  onClose: () => void;

  symbol: string;
  entryPrice: number;
  markPrice: number;
  positionAmt: number;

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

// Smart decimals để tránh floating point precision errors
// Phù hợp với Binance tickSize rules
const getSmartDecimals = (price: number): number => {
  if (price >= 10000) return 1;  // BTC ~100k → 1 decimal
  if (price >= 1000) return 2;   // ETH ~3k → 2 decimals
  if (price >= 100) return 2;    // SOL, BNB ~200-600 → 2 decimals
  if (price >= 10) return 2;     // DASH ~70, LINK ~15 → 2 decimals
  if (price >= 1) return 4;      // XRP ~2, ADA ~0.8 → 4 decimals
  if (price >= 0.1) return 5;    // DOGE ~0.3 → 5 decimals
  if (price >= 0.01) return 6;   // → 6 decimals
  if (price >= 0.0001) return 7; // → 7 decimals
  return 8;
};

// Format price với smart decimals để tránh floating point errors
const formatPrice = (price: number): number => {
  const decimals = getSmartDecimals(price);
  return parseFloat(price.toFixed(decimals));
};

const clampStep = (val: number, step: number) => {
  if (!step || step <= 0) return formatPrice(val);
  const rounded = Math.round(val / step) * step;
  return formatPrice(rounded);
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

// ---------- helpers LS cho settings ----------
const getSettingsKey = (symbol: string) => `position_tpsl_settings_${symbol}`;

interface TpSlSettings {
  trigger: TriggerType;
  mode: InputMode;
  tpInput: string;
  slInput: string;
  entryPrice: number;  // Để phân biệt position cũ vs mới
}

function loadSettings(symbol: string): Partial<TpSlSettings> {
  try {
    const saved = localStorage.getItem(getSettingsKey(symbol));
    if (saved) return JSON.parse(saved);
  } catch {}
  return {};
}

function saveSettings(symbol: string, settings: TpSlSettings) {
  try {
    localStorage.setItem(getSettingsKey(symbol), JSON.stringify(settings));
  } catch {}
}

// Export function để clear settings khi position đóng
export function clearPositionTpSlSettings(symbol: string) {
  try {
    localStorage.removeItem(getSettingsKey(symbol));
  } catch {}
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
  // Load saved settings - chỉ cho mode/trigger preferences
  const savedSettings = React.useMemo(() => loadSettings(symbol), [symbol]);

  const [trigger, setTrigger] = React.useState<TriggerType>(savedSettings.trigger || "MARK_PRICE");
  const [mode, setMode] = React.useState<InputMode>(savedSettings.mode || "pnl_abs");
  // ✅ Luôn khởi tạo trống - KHÔNG load từ localStorage
  const [tpInput, setTpInput] = React.useState<string>("");
  const [slInput, setSlInput] = React.useState<string>("");

  // Load settings khi đổi symbol hoặc entryPrice
useEffect(() => {
  const settings = loadSettings(symbol);
  
  // Load preferences (mode, trigger) luôn
  setTrigger(settings.trigger || "MARK_PRICE");
  setMode(settings.mode || "roi_pct");
  
  // ✅ FIX: Load từ openOrders thật thay vì localStorage settings
  const openOrders = readOpenOrdersLS();
  const positionSide = positionAmt > 0 ? "LONG" : "SHORT";
  const expectedSide = positionSide === "LONG" ? "SELL" : "BUY";
  const lev = leverage && leverage > 0 ? leverage : 1;
  
  const tpOrder = openOrders.find((o: any) => 
    o.symbol === symbol && 
    (o.type === 'TAKE_PROFIT_MARKET' || o.type === 'TAKE_PROFIT') &&
    o.side === expectedSide &&
    o.status === 'NEW' &&
    !o._optimistic &&
    !String(o.orderId || '').startsWith('tmp_')
  );
  
  const slOrder = openOrders.find((o: any) => 
    o.symbol === symbol && 
    (o.type === 'STOP_MARKET' || o.type === 'STOP') &&
    o.side === expectedSide &&
    o.status === 'NEW' &&
    !o._optimistic &&
    !String(o.orderId || '').startsWith('tmp_')
  );
  
  // ✅ FIX: Check xem stopPrice có hợp lý với entryPrice không
  const isValidOrder = (order: any, isTp: boolean) => {
    if (!order || !entryPrice) return false;
    const stopPrice = parseFloat(order.stopPrice || '0');
    if (!stopPrice) return false;
    
    const isLong = positionAmt > 0;
    
    // Validate TP phải > entry (long) hoặc < entry (short)
    if (isTp) {
      if (isLong && stopPrice <= entryPrice) return false;
      if (!isLong && stopPrice >= entryPrice) return false;
    }
    // Validate SL phải < entry (long) hoặc > entry (short)  
    else {
      if (isLong && stopPrice >= entryPrice) return false;
      if (!isLong && stopPrice <= entryPrice) return false;
    }
    
    // ✅ Thêm check: ROI không quá lớn (tránh orders của position cũ)
    const priceDiff = isLong 
      ? (isTp ? stopPrice - entryPrice : entryPrice - stopPrice)
      : (isTp ? entryPrice - stopPrice : stopPrice - entryPrice);
    const roi = Math.abs((priceDiff / entryPrice) * lev * 100);
    
    // Nếu ROI > 500% thì có thể là order của position cũ
    if (roi > 2000) return false;
    
    return true;
  };
  
  // Tính ROI% từ existing orders với entry mới
  const calcRoiFromOrder = (order: any, isTp: boolean) => {
    if (!isValidOrder(order, isTp)) return '';
    
    const stopPrice = parseFloat(order.stopPrice || '0');
    const isLong = positionAmt > 0;
    const priceDiff = isLong 
      ? (isTp ? stopPrice - entryPrice : entryPrice - stopPrice)
      : (isTp ? entryPrice - stopPrice : stopPrice - entryPrice);
    const roi = (priceDiff / entryPrice) * lev * 100;
    
    return Math.abs(roi).toFixed(1);
  };
  
  // Prefill từ existing orders - CHỈ NẾU HỢP LỆ
  if ((tpOrder && isValidOrder(tpOrder, true)) || (slOrder && isValidOrder(slOrder, false))) {
    setMode("roi_pct");
    setTpInput(calcRoiFromOrder(tpOrder, true));
    setSlInput(calcRoiFromOrder(slOrder, false));
  } else {
    // Không có orders hợp lệ → clear
    setTpInput("");
    setSlInput("");
  }
}, [symbol, entryPrice, positionAmt, leverage]);


  // ❌ Không auto-save nữa - chỉ save khi user submit

  if (!isOpen) return null;

  const isLong = positionAmt > 0;
  const qty = Math.abs(positionAmt);
  const safeQty = Math.max(qty, 1e-12);
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
 const handleConfirm = async () => {
  // Lưu settings
  saveSettings(symbol, {
    trigger,
    mode,
    tpInput,
    slInput,
    entryPrice,
  });

  onSubmit?.({ tpPrice, slPrice, trigger });

  const base = {
    market: "futures" as const,
    symbol,
    workingType: trigger,
    positionSide,
    closePosition: 'true' as const,
  };

  const sideForClose = isLong ? "SELL" : "BUY";
  
  // ✅ Check existing orders
  const openOrders = readOpenOrdersLS();
  
  // ✅ Tìm TẤT CẢ existing TP/SL (không check stopPrice)
  const existingTPOrder = openOrders.find((o: any) => 
    o.symbol === symbol && 
    (o.type === 'TAKE_PROFIT_MARKET' || o.type === 'TAKE_PROFIT') &&
    o.side === sideForClose &&
    o.status === 'NEW' &&
    !o._optimistic &&
    !String(o.orderId || '').startsWith('tmp_')
  );
  
  const existingSLOrder = openOrders.find((o: any) => 
    o.symbol === symbol && 
    (o.type === 'STOP_MARKET' || o.type === 'STOP') &&
    o.side === sideForClose &&
    o.status === 'NEW' &&
    !o._optimistic &&
    !String(o.orderId || '').startsWith('tmp_')
  );

  // ✅ CANCEL EXISTING TP NẾU GIÁ KHÁC
  if (existingTPOrder && Number.isFinite(tpPrice as number)) {
    const existingStopPrice = parseFloat(existingTPOrder.stopPrice || '0');
    if (existingStopPrice !== tpPrice) {
      console.log('🗑️ Cancelling existing TP:', existingTPOrder.orderId);
      const algoId = existingTPOrder.algoId || existingTPOrder.orderId;
      (binanceWS as any).sendAuthed({
        action: 'cancelFuturesAlgoOrder',
        symbol: symbol,
        algoId: Number(algoId)
      });
      // Đợi cancel xong
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // ✅ CANCEL EXISTING SL NẾU GIÁ KHÁC
  if (existingSLOrder && Number.isFinite(slPrice as number)) {
    const existingStopPrice = parseFloat(existingSLOrder.stopPrice || '0');
    if (existingStopPrice !== slPrice) {
      console.log('🗑️ Cancelling existing SL:', existingSLOrder.orderId);
      const algoId = existingSLOrder.algoId || existingSLOrder.orderId;
      (binanceWS as any).sendAuthed({
        action: 'cancelFuturesAlgoOrder',
        symbol: symbol,
        algoId: Number(algoId)
      });
      // Đợi cancel xong
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // ✅ Lưu metadata ROI input của user
  const tpslMetadata: Record<string, { tpInputRoi?: string; slInputRoi?: string }> = 
    JSON.parse(localStorage.getItem('tpsl_metadata') || '{}');
  
  const metaKey = `${symbol}:${positionSide}`;
  tpslMetadata[metaKey] = {
    ...(mode === 'roi_pct' && tpInput ? { tpInputRoi: tpInput } : {}),
    ...(mode === 'roi_pct' && slInput ? { slInputRoi: slInput } : {}),
  };
  
  localStorage.setItem('tpsl_metadata', JSON.stringify(tpslMetadata));

  // ✅ Check lại sau khi cancel - chỉ đặt nếu giá khác hoặc không có existing
  const shouldPlaceTP = Number.isFinite(tpPrice as number) && (
    !existingTPOrder || 
    parseFloat(existingTPOrder.stopPrice || '0') !== tpPrice
  );
  
  const shouldPlaceSL = Number.isFinite(slPrice as number) && (
    !existingSLOrder || 
    parseFloat(existingSLOrder.stopPrice || '0') !== slPrice
  );

  // OPTIMISTIC + WS: TP
  if (shouldPlaceTP) {
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
      closePosition: 'true',
    };
    optimisticAddOpenOrder(optimisticRow);

    binanceWS.placeOrder({
      ...base,
      side: sideForClose as "BUY" | "SELL",
      type: "TAKE_PROFIT_MARKET",
      stopPrice: tpPrice!,
    });
    console.log('✅ Placed new TP @', tpPrice);
  }

  // OPTIMISTIC + WS: SL
  if (shouldPlaceSL) {
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
      closePosition: 'true',
    };
    optimisticAddOpenOrder(optimisticRow);

    binanceWS.placeOrder({
      ...base,
      side: sideForClose as "BUY" | "SELL",
      type: "STOP_MARKET",
      stopPrice: slPrice!,
    });
    console.log('✅ Placed new SL @', slPrice);
  }

  onClose();
};

  const getModeLabel = () => {
    switch (mode) {
      case "pnl_abs": return "PnL USDT";
      case "roi_pct": return "ROI %";
      case "price": return "Giá USDT";
    }
  };

  const getPlaceholder = (type: "tp" | "sl") => {
   
    return "Nhập giá";
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-[#1e2329] border border-[#2b3139] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-fluid-4 border-b border-[#2b3139]">
          <div className="font-semibold text-fluid-lg text-white">TP/SL cho toàn bộ vị thế</div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#2b3139] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-fluid-4 space-y-5">
          {/* Position Info */}
          <div className="gap-fluid-2">
            <div className="flex items-center justify-between text-fluid-sm">
              <span className="text-gray-400">Mã</span>
              <span className="text-white font-medium">
                {symbol} • <span className={isLong ? "text-[#0ecb81]" : "text-[#f6465d]"}>{isLong ? "Long" : "Short"}</span> • {lev}x
              </span>
            </div>
            <div className="flex items-center justify-between text-fluid-sm">
              <span className="text-gray-400">Giá vào lệnh</span>
              <span className="text-white">{fmt(entryPrice)} USDT</span>
            </div>
            <div className="flex items-center justify-between text-fluid-sm">
              <span className="text-gray-400">Giá đánh dấu</span>
              <span className="text-white">{fmt(markPrice)} USDT</span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#2b3139]" />

          {/* Trigger + Mode */}
          <div className="grid grid-cols-2 gap-fluid-4">
            <div>
              <label className="text-fluid-sm text-gray-400 mb-2 block">Trigger</label>
              <div className="flex rounded-lg overflow-hidden border border-[#2b3139]">
                <button
                  className={`flex-1 px-fluid-3 py-2 text-fluid-sm font-medium transition-colors ${
                    trigger === "MARK_PRICE" 
                      ? "bg-[#fcd535] text-black" 
                      : "bg-transparent text-gray-300 hover:bg-[#2b3139]"
                  }`}
                  onClick={() => setTrigger("MARK_PRICE")}
                >
                  Mark
                </button>
                <button
                  className={`flex-1 px-fluid-3 py-2 text-fluid-sm font-medium transition-colors ${
                    trigger === "LAST" 
                      ? "bg-[#fcd535] text-black" 
                      : "bg-transparent text-gray-300 hover:bg-[#2b3139]"
                  }`}
                  onClick={() => setTrigger("LAST")}
                >
                  Last
                </button>
              </div>
            </div>

            <div>
              <label className="text-fluid-sm text-gray-400 mb-2 block">Nhập theo</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as InputMode)}
                className="w-full bg-transparent border border-[#2b3139] rounded-lg px-fluid-3 py-2 text-fluid-sm text-white outline-none focus:border-[#fcd535] transition-colors cursor-pointer"
              >
                <option value="pnl_abs" className="bg-[#1e2329]">PnL</option>
                <option value="roi_pct" className="bg-[#1e2329]">ROI%</option>
                <option value="price" className="bg-[#1e2329]">Giá</option>
              </select>
            </div>
          </div>

          {/* Take Profit */}
          <div>
            <label className="text-fluid-sm text-gray-400 mb-2 block">
              Take Profit <span className="text-gray-500">({getModeLabel()})</span>
            </label>
            <div className="flex items-center gap-fluid-3">
              <div className="flex-1 relative">
                {/* Prefix "+" cho PnL/ROI mode */}
                {mode !== "price" && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0ecb81] text-fluid-sm font-medium">
                    +
                  </span>
                )}
                <input
                  value={tpInput}
                  onChange={(e) => {
                    // Chỉ cho phép số và dấu chấm
                    const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                    setTpInput(cleaned);
                  }}
                  className={`w-full bg-transparent border border-[#2b3139] rounded-lg py-2.5 text-fluid-sm text-white outline-none focus:border-[#0ecb81] transition-colors placeholder:text-gray-500 ${
                    mode !== "price" ? "pl-7 pr-3" : "px-fluid-3"
                  }`}
                  placeholder={getPlaceholder("tp")}
                  inputMode="decimal"
                />
              </div>
              <div className="text-fluid-xs text-gray-400 min-w-[140px] text-right">
                {tpPrice ? (
                  <div className="space-y-0.5">
                    <div className="text-white">{fmt(tpPrice, 5)} USDT</div>
                    <div className={tpEst.pnlVal >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}>
                      {fmt(tpEst.pnlVal, 2)} USDT ({fmt(tpEst.roiPct, 2)}%)
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-500">Ước tính: --</span>
                )}
              </div>
            </div>
          </div>

          {/* Stop Loss */}
          <div>
            <label className="text-fluid-sm text-gray-400 mb-2 block">
              Stop Loss <span className="text-gray-500">({getModeLabel()})</span>
            </label>
            <div className="flex items-center gap-fluid-3">
              <div className="flex-1 relative">
                {/* Prefix "-" cho PnL/ROI mode */}
                {mode !== "price" && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f6465d] text-fluid-sm font-medium">
                    -
                  </span>
                )}
                <input
                  value={slInput}
                  onChange={(e) => {
                    // Chỉ cho phép số và dấu chấm
                    const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                    setSlInput(cleaned);
                  }}
                  className={`w-full bg-transparent border border-[#2b3139] rounded-lg py-2.5 text-fluid-sm text-white outline-none focus:border-[#f6465d] transition-colors placeholder:text-gray-500 ${
                    mode !== "price" ? "pl-7 pr-3" : "px-fluid-3"
                  }`}
                  placeholder={getPlaceholder("sl")}
                  inputMode="decimal"
                />
              </div>
              <div className="text-fluid-xs text-gray-400 min-w-[140px] text-right">
                {slPrice ? (
                  <div className="space-y-0.5">
                    <div className="text-white">{fmt(slPrice, 5)} USDT</div>
                    <div className={slEst.pnlVal >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}>
                      {fmt(slEst.pnlVal, 2)} USDT ({fmt(slEst.roiPct, 2)}%)
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-500">Ước tính: --</span>
                )}
              </div>
            </div>
          </div>

         
        </div>

        {/* Footer */}
        <div className="px-5 py-fluid-4 border-t border-[#2b3139]">
          <button
            onClick={handleConfirm}
            disabled={!tpPrice && !slPrice}
            className="w-full rounded-xl bg-[#fcd535] text-black font-semibold py-fluid-3 hover:bg-[#e5c22d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
};

export default PositionTpSlModal;