// ToolMini.tsx
import React from "react";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import ToolTpSl from "./ToolTpSl";
import RRZoneOverlay from "./RRZoneOverlay";
import ConfirmOrderModal from "./ConfirmOrderModal";
import { binanceWS } from "../../binancewebsocket/BinanceWebSocketService";

// --- WS adapter: tự phát hiện API mới/cũ ---
async function wsCall(action: string, data: any) {
  if (typeof (binanceWS as any)?.request === "function") {
    return (binanceWS as any).request(action, data);
  }
  if (action === "placeOrder" && typeof (binanceWS as any)?.placeOrder === "function") {
    return (binanceWS as any).placeOrder(data);
  }
  if (action === "cancelOrder" && typeof (binanceWS as any)?.cancelOrder === "function") {
    return (binanceWS as any).cancelOrder(data);
  }
  if (typeof (binanceWS as any)?.send === "function") {
    return (binanceWS as any).send({ action, data });
  }
  if (typeof (binanceWS as any)?.emit === "function") {
    return (binanceWS as any).emit(action, data);
  }
  throw new Error("Không tìm thấy API phù hợp trên binanceWS");
}

function wsPlaceOrder(data: any) {
  return wsCall("placeOrder", data);
}

type Side = "LONG" | "SHORT";

type Props = {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  containerEl: HTMLDivElement | null;

  lastPrice: number | null;
  lastCandleTime: UTCTimestamp | null;

  /** side mặc định (có thể khác side vị thế hiện tại) */
  positionSide: Side;

  chartSymbol: string | null;
  enabled?: boolean;
  onEnabledChange?: (v: boolean) => void;

  /** số lượng đặt lệnh (nếu không truyền sẽ dùng 1) */
  quantity?: number;

  /** callback báo lên trên nếu cần */
  onPlace?: (v: { side: Side; entry: number; tp?: number | null; sl?: number | null }) => void;

  topOffsetClass?: string;
};

function levKey(accId: number | null, market: 'spot' | 'futures', symbol: string) {
  return `tw_leverage_${accId ?? 'na'}_${market}_${symbol}`;
}
function loadLeverageLS(accId: number | null, market: 'spot' | 'futures', symbol: string, fallback = 1) {
  try {
    const v = localStorage.getItem(levKey(accId, market, symbol));
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}
function getCurrentAccId(): number | null {
  const fromSvc = (binanceWS as any)?.getCurrentAccountId?.();
  if (typeof fromSvc === "number") return fromSvc;
  const raw = localStorage.getItem("selectedBinanceAccountId");
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : null;
}
function getCurrentMarket(): 'spot' | 'futures' {
  const raw = localStorage.getItem("selectedMarket");
  return raw === "spot" ? "spot" : "futures";
}
function getSymbolFilters(symbol?: string) {
  if (!symbol) return null;
  const svc = (binanceWS as any);
  if (typeof svc?.getSymbolFilters === "function") {
    try { return svc.getSymbolFilters(symbol); } catch {}
  }
  try {
    const raw = localStorage.getItem(`symbol_filters_${symbol}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function toFixedStep(val: number, step: number) {
  if (!Number.isFinite(val) || !Number.isFinite(step) || step <= 0) return val;
  const mul = Math.round(1 / step);
  return Math.floor(val * mul) / mul;
}
function snapPrice(p: number, symbol?: string) {
  const f = getSymbolFilters(symbol);
  const tick = Number(f?.tickSize) || 0;
  return tick > 0 ? toFixedStep(p, tick) : Number(p.toFixed(6));
}
function snapQty(q: number, symbol?: string) {
  const f = getSymbolFilters(symbol);
  const step = Number(f?.stepSize) || 0;
  return step > 0 ? toFixedStep(q, step) : Number(q.toFixed(6));
}
async function placeOrderSafe(payload: any) {
  try {
    return await wsPlaceOrder(payload);
  } catch (e: any) {
    const msg = (e?.message ?? "").toLowerCase();
    if (msg.includes("reduceonly")) {
      const { reduceOnly, ...rest } = payload;
      return await wsPlaceOrder(rest);
    }
    throw e;
  }
}

const ToolMini: React.FC<Props> = ({
  chart,
  series,
  containerEl,
  lastPrice,
  lastCandleTime,
  positionSide,
  enabled,
  onEnabledChange,
  onPlace,
  chartSymbol,
  quantity,
  topOffsetClass = "top-10",
}) => {
  const [folded, setFolded] = React.useState(false);
  const [openPanel, setOpenPanel] = React.useState(false);
  const [mode, setMode] = React.useState<"position" | "manual">("manual");
  const [qty, setQty] = React.useState<number>(1);
  const [orderSide, setOrderSide] = React.useState<Side>(positionSide);
  const [entryEditable, setEntryEditable] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // bật/tắt feature (controlled/ uncontrolled)
  const [innerEnabled, setInnerEnabled] = React.useState(false);
  const isEnabled = enabled ?? innerEnabled;

  // ❗️Ổn định setEnabled, KHÔNG đưa vào deps của effect phía dưới
  const setEnabled = React.useCallback((v: boolean) => {
    if (onEnabledChange) onEnabledChange(v);
    else setInnerEnabled(v);
  }, [onEnabledChange]);

  // ====== STATE GIÁ ======
  const [entry, setEntry] = React.useState<{ time: UTCTimestamp; price: number } | null>(null);
  const [tp, setTp] = React.useState<number | null>(null);
  const [sl, setSl] = React.useState<number | null>(null);

  // show/ẩn TP SL
  const [showTP, setShowTP] = React.useState(true);
  const [showSL, setShowSL] = React.useState(true);

  const handleOpenConfirm = () => {
    if (!entry) return;
    setConfirmOpen(true);
  };

  const mapEntrySide = (s: Side) => (s === "LONG" ? "BUY" : "SELL");
  const mapExitSide = (s: Side) => (s === "LONG" ? "SELL" : "BUY");

  const placeFromTool = async () => {
    if (!entry || !chartSymbol) return;
    const accId  = getCurrentAccId();
    const market: "futures" | "spot" = getCurrentMarket();
    const leverage = loadLeverageLS(accId, market, chartSymbol, 1);

    const side = orderSide;
    const entryPriceRaw = entry.price;
    let tpPriceRaw = showTP ? tp : null;
    let slPriceRaw = showSL ? sl : null;

    if (side === "LONG") {
      if (tpPriceRaw != null && slPriceRaw != null && tpPriceRaw < entryPriceRaw && slPriceRaw > entryPriceRaw) {
        [tpPriceRaw, slPriceRaw] = [slPriceRaw, tpPriceRaw];
      }
    } else {
      if (tpPriceRaw != null && slPriceRaw != null && tpPriceRaw > entryPriceRaw && slPriceRaw < entryPriceRaw) {
        [tpPriceRaw, slPriceRaw] = [slPriceRaw, tpPriceRaw];
      }
    }

    const entryPrice = snapPrice(entryPriceRaw, chartSymbol);
    const tpPrice    = tpPriceRaw != null ? snapPrice(tpPriceRaw, chartSymbol) : null;
    const slPrice    = slPriceRaw != null ? snapPrice(slPriceRaw, chartSymbol) : null;

    const qtyRaw   = Math.max(0, Number.isFinite(qty) ? (qty as number) : 0);
    const qtyFixed = snapQty(qtyRaw, chartSymbol);

    const entryOrderSide = side === "LONG" ? "BUY" : "SELL";
    const exitOrderSide  = side === "LONG" ? "SELL" : "BUY";

    console.log(`[PLACE] ${side}`, {
      symbol: chartSymbol, entryPrice, tpPrice, slPrice, qty: qtyFixed, leverage,
    });

    await wsPlaceOrder({
      market,
      symbol: chartSymbol,
      side: entryOrderSide,
      type: "LIMIT",
      price: entryPrice,
      quantity: qtyFixed,
      timeInForce: "GTC",
      positionSide: side,
      leverage,
    });

    if (tpPrice != null) {
      await wsPlaceOrder({
        market,
        symbol: chartSymbol,
        side: exitOrderSide,
        type: "TAKE_PROFIT_MARKET",
        stopPrice: tpPrice,
        quantity: qtyFixed,
        timeInForce: "GTC",
        positionSide: side,
        leverage,
      });
    }

    if (slPrice != null) {
      await wsPlaceOrder({
        market,
        symbol: chartSymbol,
        side: exitOrderSide,
        type: "STOP_MARKET",
        stopPrice: slPrice,
        quantity: qtyFixed,
        timeInForce: "GTC",
        positionSide: side,
        leverage,
      });
    }

    onPlace?.({ side, entry: entryPrice, tp: tpPrice, sl: slPrice });
  };

  // ====== REFS để handler ổn định không cần deps ======
  const refs = React.useRef({
    chartSymbol: chartSymbol as string | null,
    lastCandleTime: lastCandleTime as UTCTimestamp | null,
    lastPrice: lastPrice as number | null,
    orderSide: orderSide as Side,
    isEnabled: isEnabled as boolean,
  });
  React.useEffect(() => { refs.current.chartSymbol = chartSymbol; }, [chartSymbol]);
  React.useEffect(() => { refs.current.lastCandleTime = lastCandleTime; }, [lastCandleTime]);
  React.useEffect(() => { refs.current.lastPrice = lastPrice; }, [lastPrice]);
  React.useEffect(() => { refs.current.orderSide = orderSide; }, [orderSide]);
  React.useEffect(() => { refs.current.isEnabled = isEnabled; }, [isEnabled]);

  // ====== Handler từ Position ("Nâng cao") – chỉ register 1 lần ======
  React.useEffect(() => {
    const handler = (ev: any) => {
      const data = ev?.detail ?? null;
      if (!data) return;

      const sym = refs.current.chartSymbol;
      if (!sym || data.symbol !== sym) return;

      // Guard: chỉ enable khi đang off
      if (!refs.current.isEnabled) {
        setEnabled(true);
      }

      // Không cần setMode/entryEditable nếu đã ở trạng thái như vậy
      setMode((prev) => (prev !== "position" ? "position" : prev));
      setEntryEditable(false);

      const eTime = refs.current.lastCandleTime;
      const ePrice = Number(data.entry);
      if (eTime && Number.isFinite(ePrice)) {
        // chỉ set khi khác
        setEntry((old) => {
          if (!old || old.price !== ePrice || old.time !== eTime) {
            return { time: eTime, price: ePrice };
          }
          return old;
        });

        const side = refs.current.orderSide;
        const nextTp = side === "LONG" ? ePrice * 1.01 : ePrice * 0.99;
        const nextSl = side === "LONG" ? ePrice * 0.99 : ePrice * 1.01;

        setTp((old) => (old !== nextTp ? nextTp : old));
        setSl((old) => (old !== nextSl ? nextSl : old));
        setShowTP(true);
        setShowSL(true);
      }

      setFolded(false);
      setOpenPanel(true);
    };

    window.addEventListener("active-tool-changed", handler as EventListener, { passive: true });

    // Init 1 lần từ localStorage
    const didInitRef = { current: false };
    try {
      if (!didInitRef.current) {
        const raw = localStorage.getItem("activeTool");
        if (raw) {
          const init = JSON.parse(raw);
          if (init?.symbol) {
            handler({ detail: init });
          }
        }
        didInitRef.current = true;
      }
    } catch {}

    return () => {
      window.removeEventListener("active-tool-changed", handler as EventListener);
    };
    // ⛔️ Không để deps ở đây – handler dùng refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Init khi bật tool (sẽ chạy 1 lần khi isEnabled chuyển true)
  React.useEffect(() => {
    if (!isEnabled) return;
    if (!entry && refs.current.lastCandleTime && refs.current.lastPrice != null) {
      const p = refs.current.lastPrice!;
      const t = refs.current.lastCandleTime!;
      setEntry({ time: t, price: p });

      const side = refs.current.orderSide;
      const nextTp = side === "LONG" ? p * 1.01 : p * 0.99;
      const nextSl = side === "LONG" ? p * 0.99 : p * 1.01;

      setTp(nextTp);
      setSl(nextSl);
      setShowTP(true);
      setShowSL(true);
      setMode("manual");
      setEntryEditable(true);
    }
  }, [isEnabled, entry]);

  return (
    <div className={`absolute left-2 ${topOffsetClass} z-20 inline-block`}>
      {/* HEADER */}
      <div className="bg-dark-800/90 rounded-fluid-md px-2 py-0.5 text-fluid-xs">
        <div className="flex items-center gap-fluid-2">
          <div
            onClick={() =>
              setFolded((prev) => {
                const next = !prev;
                if (next) setOpenPanel(false);
                return next;
              })
            }
            className="cursor-pointer select-none text-gray-300"
          >
            {folded ? "▶" : "▼"}
          </div>

          {!folded && (
            <>
              <button
                className="px-2 py-0.5 rounded bg-dark-700 border border-dark-600 text-gray-200 hover:bg-dark-700/70 text-fluid-xs"
                onClick={() => setOpenPanel((s) => !s)}
              >
                Tool
              </button>

              <label className="ml-1 inline-flex items-center gap-fluid-1 text-gray-300 text-fluid-xs">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                <span>Bật</span>
              </label>

              {/* Chỉnh Entry */}
              <label className="ml-2 inline-flex items-center gap-fluid-1 text-gray-300 text-fluid-xs">
                <input
                  type="checkbox"
                  checked={entryEditable}
                  onChange={(e) => setEntryEditable(e.target.checked)}
                />
                <span>Order</span>
              </label>

              {/* Chọn side LONG/SHORT */}
              <div className="ml-2 inline-flex rounded overflow-hidden border border-dark-600">
                <button
                  className={`px-2 py-0.5 text-fluid-xs ${
                    orderSide === "LONG" ? "bg-emerald-600/70 text-white" : "bg-dark-700 text-gray-300"
                  }`}
                  onClick={() => setOrderSide("LONG")}
                >
                  LONG
                </button>
                <button
                  className={`px-2 py-0.5 text-fluid-xs ${
                    orderSide === "SHORT" ? "bg-rose-600/70 text-white" : "bg-dark-700 text-gray-300"
                  }`}
                  onClick={() => setOrderSide("SHORT")}
                >
                  SHORT
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* OVERLAY */}
      {isEnabled && entry && chartSymbol && (
        <RRZoneOverlay
          chart={chart}
          series={series}
          containerEl={containerEl}
          entryTime={entry.time}
          entryPrice={entry.price}
          tpPrice={showTP ? tp : null}
          slPrice={showSL ? sl : null}
          side={orderSide}
          preserveOffsetsOnEntryDrag={true}
          guardCrossing={true}
          zoneWidthPx={420}
          allowEntryDrag={entryEditable}
          onChange={(v) => {
            if (v.tp !== undefined) setTp(v.tp ?? null);
            if (v.sl !== undefined) setSl(v.sl ?? null);
          }}
          onEntryChange={(price) => {
            if (!entryEditable || !lastCandleTime) return;
            setEntry({ time: lastCandleTime, price });
          }}
        />
      )}

      {/* PANEL */}
      {openPanel && !folded && (
        <div className="mt-1 bg-dark-800/90 rounded-fluid-md px-2 py-2 text-xs border border-dark-600 relative w-[340px] sm:w-[380px]">
          <ToolTpSl
            lastPrice={lastPrice}
            positionSide={orderSide}
            enabled={isEnabled}
            onEnabledChange={setEnabled}
            entry={entry?.price ?? null}
            onEntryChange={(v) => {
              if (!entryEditable || !lastCandleTime) return;
              setEntry({ time: lastCandleTime, price: v });
            }}
            canEditEntry={entryEditable}
            canPlace={entryEditable}
            onPlace={handleOpenConfirm}
            onHitEntry={() => {
              if (!lastCandleTime || lastPrice == null) return;
              setEntry({ time: lastCandleTime, price: lastPrice });
            }}
            showTP={showTP}
            showSL={showSL}
            onToggleTP={setShowTP}
            onToggleSL={setShowSL}
            controlledTp={tp}
            controlledSl={sl}
            quantity={qty}
            onQuantityChange={(v) => setQty(v)}
            onChange={(v) => {
              if (v.tp !== undefined) setTp(v.tp ?? null);
              if (v.sl !== undefined) setSl(v.sl ?? null);
            }}
          />

          {/* Modal xác nhận */}
          {confirmOpen && entry && (
            <ConfirmOrderModal
              open={confirmOpen}
              onClose={() => setConfirmOpen(false)}
              onConfirm={async () => {
                await placeFromTool();
                setConfirmOpen(false);
              }}
              data={{
                symbol: chartSymbol,
                market: "futures",
                side: orderSide,
                entry: entry.price,
                tp: showTP ? tp : null,
                sl: showSL ? sl : null,
                qty,
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ToolMini;
