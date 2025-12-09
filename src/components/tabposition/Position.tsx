import React, { useEffect, useState,useMemo } from "react";
import { binancePublicWS } from "../binancewebsocket/binancePublicWS";
import { binanceWS,OPEN_ORDERS_LS_KEY,POSITIONS_LS_KEY } from "../binancewebsocket/BinanceWebSocketService";
import PopupPosition from "../popupposition/PopupPosition";
import { PositionData } from "../../utils/types";
import PositionTpSlModal from "./function/PositionTpSlModal";
import { Edit3 } from "lucide-react";
import ClosePositionModal from "../popupposition/ClosePositionConfirmModal";
import { createPortal } from 'react-dom';
import CloseAllPositionsModal from "../popupposition/CloseAllPositionsModal";
import SymbolFilterDropdown, {PositionFilter} from "./dropdownfilter/SymbolFilterDropdown";
import { StandardSortHeader, RoiSortHeader,SortConfig } from "./dropdownfilter/ColumnSortHeader";
// ===== Helper đọc TP/SL settings từ localStorage =====
interface TpSlSettings {
  trigger: "MARK_PRICE" | "LAST";
  mode: "price" | "pnl_abs" | "roi_pct";
  tpInput: string;
  slInput: string;
  entryPrice: number;
}

function loadPositionTpSlSettings(symbol: string): Partial<TpSlSettings> | null {
  try {
    const saved = localStorage.getItem(`position_tpsl_settings_${symbol}`);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

// Format label cho mode
function getModeLabel(mode?: string): string {
  switch (mode) {
    case "roi_pct": return "ROI%";
    case "pnl_abs": return "PnL";
    case "price": return "Price";
    default: return "";
  }
}

// ===== Helpers =====
function loadLeverageLS(
  accountId?: number | null,
  market?: "spot" | "futures",
  symbol?: string
) {
  const key = `tw_leverage_${accountId ?? "na"}_${market ?? "futures"}_${
    symbol ?? ""
  }`;
  const raw = localStorage.getItem(key);
  const v = raw ? Number(raw) : NaN;
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

type PosSide = "LONG" | "SHORT" | "BOTH";

type PositionCalc = PositionData & {
  breakEvenPrice?: string;
  unrealizedPnl?: number;
  leverage?: number;
  marginType?: string;
  isolatedWallet?: number;
  positionInitialMargin?: number;
  positionSide?: PosSide;
};

interface PositionProps {
  positions?: PositionData[];
  market?: "spot" | "futures";
  onPositionCountChange?: (n: number) => void;
  onFloatingInfoChange?: (
    info: {
      symbol: string;
      pnl: number;
      roi: number;
      price: number;
      positionAmt: number;
    } | null
  ) => void;
}

// number hợp lệ > 0 => number, else undefined
const toNumUndef = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
const fmt = (n?: number, maxFrac = 8) =>
  n == null
    ? "--"
    : n.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
const getMark = (p: PositionCalc) => toNumUndef(p.markPrice);
const nearZero = (v: number | undefined, eps = 1e-6) =>
  v != null && Math.abs(v) < eps;

const fmtShort = (x: number) => {
  if (!Number.isFinite(x)) return "0.00";
  return x.toFixed(2);
};

// ===== Stable store (nguồn sự thật) =====
const keyOf = (p: { symbol: string; positionSide?: PosSide }) =>
  `${p.symbol}:${p.positionSide ?? "BOTH"}`;

const Position: React.FC<PositionProps> = ({
  market = "futures",
  onPositionCountChange,
  onFloatingInfoChange,
}) => {
  // Store Map + view state
  const posStoreRef = React.useRef<Map<string, PositionCalc>>(new Map());
  const latestVersionRef = React.useRef<number>(0);
  const refreshingRef = React.useRef<boolean>(false);
  const deltaQueueRef = React.useRef<PositionCalc[]>([]);
const [showCloseAllModal, setShowCloseAllModal] = useState(false);
  const [positionsView, setPositionsView] = useState<PositionCalc[]>([]);
// ✅ STATE cho filter Long/Short/All
const [positionFilter, setPositionFilter] = useState<PositionFilter>('all');
// ✅ STATE cho sort columns
const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  // ✅ State để force re-render khi TP/SL settings thay đổi
  const [tpslVersion, setTpslVersion] = useState(0);

  // ✅ Lắng nghe storage event để cập nhật khi TP/SL thay đổi
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('position_tpsl_settings_')) {
        setTpslVersion(v => v + 1);
      }
    };

    // Lắng nghe custom event từ PositionTpSlModal
    const handleTpSlChanged = () => {
      setTpslVersion(v => v + 1);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('position-tpsl-updated', handleTpSlChanged);
    
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('position-tpsl-updated', handleTpSlChanged);
    };
  }, []);

  const flushView = React.useCallback(() => {
  const arr = [...posStoreRef.current.values()]
    .filter((p) => Math.abs(parseFloat(p.positionAmt || "0")) > 1e-9)
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
  setPositionsView(arr);
}, []);

const flushTokenRef = React.useRef<number | null>(null);
function scheduleFlush() {
  if (flushTokenRef.current !== null) return;
  flushTokenRef.current = requestAnimationFrame(() => {
    flushTokenRef.current = null;
    flushView();
  });
}


  const normalizePos = React.useCallback((raw: any): PositionCalc => {
  const mp = toNumUndef(raw.markPrice ?? raw.mp);
  const lev = Number(raw.leverage ?? raw.l);
  const upNum = Number(raw.unrealizedPnl ?? raw.up);

  const p: PositionCalc = {
    symbol: String(raw.symbol ?? raw.s),
    positionSide: (raw.positionSide ?? raw.ps ?? "BOTH") as PosSide,
    positionAmt: String(raw.positionAmt ?? raw.pa ?? "0"),
    entryPrice: String(raw.entryPrice ?? raw.ep ?? "0"),
    breakEvenPrice: String(raw.breakEvenPrice ?? raw.bep ?? raw.ep ?? "0"),
    markPrice: mp != null ? String(mp) : undefined,
    leverage: Number.isFinite(lev) && lev > 0 ? lev : undefined,
    marginType: (raw.marginType ?? raw.mt ?? "").toString().toLowerCase(),
    isolatedWallet:
      raw.iw !== undefined
        ? Number(raw.iw)
        : raw.isolatedWallet !== undefined
        ? Number(raw.isolatedWallet)
        : undefined,
    unrealizedPnl: Number.isFinite(upNum) ? upNum : undefined,
    positionInitialMargin:
      raw.positionInitialMargin !== undefined
        ? Number(raw.positionInitialMargin)
        : undefined,
  };
  return p;
}, []);

// ==== Anti-spam + single-flight for positions ====
const reqInFlightRef = React.useRef(false);
const lastReqAtRef = React.useRef(0);
const REQUEST_COOLDOWN = 400; // ms

function requestPositions(reason: string, opts: { force?: boolean } = {}) {
  const { force = false } = opts;
  // nếu đã có data rồi thì thôi (trừ khi force)
  if (!force && gotAnyPositionsRef.current) return;

  const now = Date.now();
  if (reqInFlightRef.current) return;
  if (!force && now - lastReqAtRef.current < REQUEST_COOLDOWN) return;

  reqInFlightRef.current = true;
  lastReqAtRef.current = now;

  // gọi gói đôi (vì bạn enrich leverage/wallet)
  binanceWS.getFuturesAccount();
  binanceWS.getPositions();
}

const settleInflight = () => {
  reqInFlightRef.current = false;
};

  const applySnapshot = React.useCallback((list: any[], version = Date.now()) => {
  if (version < latestVersionRef.current) return;
  latestVersionRef.current = version;

  const m = new Map<string, PositionCalc>();
  for (const raw of list || []) {
    const p = normalizePos(raw);
    if (Math.abs(parseFloat(p.positionAmt || "0")) > 1e-9) m.set(keyOf(p), p);
  }
  posStoreRef.current = m;
  scheduleFlush();
// ✅ THÊM: Sync localStorage ngay
  if (m.size === 0) {
    localStorage.removeItem("positions");
  } else {
    localStorage.setItem("positions", JSON.stringify([...m.values()]));
  }
  if (m.size > 0) {
    gotAnyPositionsRef.current = true;
    if (positionsWatchdog.current) {
      clearTimeout(positionsWatchdog.current);
      positionsWatchdog.current = null;
    }
  }
  settleInflight(); // ✅ hạ cờ đang gọi
}, [normalizePos]);




  const applyDelta = React.useCallback((raw: any) => {
  const n = normalizePos(raw);
  const k = keyOf(n);
  const cur = posStoreRef.current.get(k);

  const merged: PositionCalc = {
    ...cur,
    ...n,
    positionAmt: String(n.positionAmt ?? cur?.positionAmt ?? "0"),
    entryPrice: String(n.entryPrice ?? cur?.entryPrice ?? "0"),
    markPrice:
      n.markPrice != null
        ? n.markPrice
        : (() => {
            const v = Number(cur?.markPrice ?? NaN);
            return Number.isFinite(v) ? String(v) : cur?.markPrice;
          })(),
    leverage: Number(n.leverage) > 0 ? Number(n.leverage) : cur?.leverage,
    unrealizedPnl: Number.isFinite(Number(n.unrealizedPnl))
      ? Number(n.unrealizedPnl)
      : cur?.unrealizedPnl,
  };

  if (Math.abs(parseFloat(merged.positionAmt || "0")) <= 1e-9) {
    posStoreRef.current.delete(k);
  } else {
    posStoreRef.current.set(k, merged);
  }
  scheduleFlush();
}, [normalizePos]);


  // --- dưới các useRef khác ---
const positionsWatchdog = React.useRef<ReturnType<typeof setTimeout> | null>(null);
const backoffIdxRef = React.useRef(0);
const gotAnyPositionsRef = React.useRef(false);

// tiện ích: gọi snapshot ngay + theo backoff
const kickPositionsWatchdog = React.useCallback((immediate = false) => {
  const steps = [250, 500, 1000, 2000, 3000, 5000];
  const idx = backoffIdxRef.current;
  const delay = immediate ? 0 : steps[Math.min(idx, steps.length - 1)];

  if (positionsWatchdog.current) clearTimeout(positionsWatchdog.current);
  positionsWatchdog.current = setTimeout(() => {
    if (gotAnyPositionsRef.current) return;
    requestPositions('watchdog');
    backoffIdxRef.current = Math.min(idx + 1, steps.length - 1);
    kickPositionsWatchdog();
  }, delay);
}, []);


// dọn timer khi unmount
useEffect(() => {
  return () => {
    if (positionsWatchdog.current) clearTimeout(positionsWatchdog.current);
  };
}, []);

// sau hydrate cache + binanceWS.getPositions();
useEffect(() => {
  // nếu chưa có view thì khởi động watchdog
  if (!positionsView.length) {
    gotAnyPositionsRef.current = false;
    backoffIdxRef.current = 0;
    kickPositionsWatchdog(true);
  }
}, [positionsView.length, kickPositionsWatchdog]);

// 1) nơi setPositionUpdateHandler (snapshot)
useEffect(() => {
  binanceWS.setPositionUpdateHandler((raw: any[]) => {
    refreshingRef.current = true;
    applySnapshot(Array.isArray(raw) ? raw : [], Date.now());
    settleInflight(); // ✅
    gotAnyPositionsRef.current = true;
    if (positionsWatchdog.current) { clearTimeout(positionsWatchdog.current); positionsWatchdog.current = null; }
    const q = deltaQueueRef.current; deltaQueueRef.current = []; q.forEach(applyDelta);
    refreshingRef.current = false;
  });
  return () => binanceWS.setPositionUpdateHandler(() => {});
}, [applySnapshot, applyDelta]);

// 2) nơi lắng nghe ACCOUNT_UPDATE.a.P (delta)
useEffect(() => {
  const handler = (msg: any) => {
    if (msg?.a?.P && Array.isArray(msg.a.P)) {
      if (refreshingRef.current) msg.a.P.forEach((r: any) => deltaQueueRef.current.push(r));
      else msg.a.P.forEach((r: any) => applyDelta(r));
      gotAnyPositionsRef.current = true;
      if (positionsWatchdog.current) { clearTimeout(positionsWatchdog.current); positionsWatchdog.current = null; }
      settleInflight(); // ✅
    }
  };
  binanceWS.onMessage(handler);
  return () => binanceWS.removeMessageHandler(handler);
}, [applyDelta]);


const lastUpdateAtRef = React.useRef<number>(Date.now());
useEffect(() => {
  lastUpdateAtRef.current = Date.now();
}, [positionsView.map(p => `${p.symbol}:${p.positionAmt}`).join('|')]);

useEffect(() => {
  const t = setInterval(() => {
    const idle = Date.now() - lastUpdateAtRef.current;
    if (idle > 15000 && !gotAnyPositionsRef.current) {
      requestPositions('idle-refresh');
    }
  }, 5000);
  return () => clearInterval(t);
}, []);

useEffect(() => {
  const onFocus = () => {
    if (!positionsView.length && !gotAnyPositionsRef.current) {
      backoffIdxRef.current = 0;
      kickPositionsWatchdog(true);
    }
  };
  const onOnline = () => {
    if (!gotAnyPositionsRef.current) {
      backoffIdxRef.current = 0;
      kickPositionsWatchdog(true);
    }
  };
  window.addEventListener('focus', onFocus);
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') onFocus();
  });
  return () => {
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('online', onOnline);
  };
}, [positionsView.length, kickPositionsWatchdog]);



// Nhận snapshot tức thì từ WS cache (lastPositions) + future snapshots
useEffect(() => {
  const un = binanceWS.subscribePositions((rows: any[]) => {
    applySnapshot(rows, Date.now());
    gotAnyPositionsRef.current = true;
    if (positionsWatchdog.current) { clearTimeout(positionsWatchdog.current); positionsWatchdog.current = null; }
    settleInflight(); // ✅
  });
  return un;
}, [applySnapshot]);

useEffect(() => {
  const handler = (m: any) => {
    if (m?.type === 'positionsSnapshot' && Array.isArray(m.data)) {
      applySnapshot(m.data, Date.now());
      gotAnyPositionsRef.current = true;
      if (positionsWatchdog.current) { clearTimeout(positionsWatchdog.current); positionsWatchdog.current = null; }
      settleInflight(); // ✅
      return;
    }
    if (m?.type === 'positionsDelta' && Array.isArray(m.data)) {
      m.data.forEach(applyDelta);
      gotAnyPositionsRef.current = true;
      if (positionsWatchdog.current) { clearTimeout(positionsWatchdog.current); positionsWatchdog.current = null; }
      settleInflight(); // ✅
      return;
    }
    if (Array.isArray(m?.positions)) {
      applySnapshot(m.positions, Date.now());
      gotAnyPositionsRef.current = true;
      if (positionsWatchdog.current) { clearTimeout(positionsWatchdog.current); positionsWatchdog.current = null; }
      settleInflight(); // ✅
      return;
    }
    if ((m?.type === 'getPositions' || m?.type === 'positions' || m?.type === 'futuresPositions') &&
        Array.isArray(m?.data)) {
      applySnapshot(m.data, Date.now());
      gotAnyPositionsRef.current = true;
      if (positionsWatchdog.current) { clearTimeout(positionsWatchdog.current); positionsWatchdog.current = null; }
      settleInflight(); // ✅
      return;
    }
  };
  binanceWS.onMessage(handler);
  return () => binanceWS.removeMessageHandler(handler);
}, [applySnapshot, applyDelta]);



  // ===== Close modal state, helpers =====
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [showPopup, setShowPopup] = useState(false);
  const [targetTP, setTargetTP] = useState("");
  const [targetSL, setTargetSL] = useState("");
  const [currentPnl, setCurrentPnl] = useState(0);
  const [showTpSl, setShowTpSl] = useState(false);
  const [activePos, setActivePos] = useState<PositionData | null>(null);

  const rowKey = (p: PositionCalc) => `${p.symbol}:${p.positionSide ?? "BOTH"}`;
  const [closeBy, setCloseBy] = useState<
    Record<string, { price?: string; qty?: string }>
  >({});
  const setRowPrice = (key: string, v: string) =>
    setCloseBy((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), price: v },
    }));
  const setRowQty = (key: string, v: string) =>
    setCloseBy((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), qty: v },
    }));

  const [closeModal, setCloseModal] = useState<{
    open: boolean;
    mode: "market" | "limit";
    pos?: PositionCalc;
  }>({ open: false, mode: "market" });

  // tick/step
  const symbolTickMap: Record<string, number> = {};
  const getPriceTick = (symbol: string) => symbolTickMap[symbol] ?? 0.0001;
  const symbolStepMap: Record<string, number> = {};
  const getStepSize = (symbol: string) => symbolStepMap[symbol] ?? 0.001;
  const roundToStep = (qty: number, step: number) => {
    if (step <= 0) return qty;
    const precision = Math.max(0, (step.toString().split(".")[1] || "").length);
    return Number((Math.floor(qty / step) * step).toFixed(precision));
  };
  const clamp = (x: number, lo = 0, hi = Number.POSITIVE_INFINITY) =>
    Math.max(lo, Math.min(hi, x));
  const roundTo = (
    v: number,
    step: number,
    mode: "floor" | "round" = "floor"
  ) => {
    if (!step || step <= 0) return v;
    const p = (step.toString().split(".")[1] || "").length;
    const f = mode === "round" ? Math.round : Math.floor;
    return Number((f(v / step) * step).toFixed(p));
  };

  // ===== TP/SL đặt theo vị thế =====
  const sendTpSlOrders = (
    pos: PositionData,
    tpPrice?: number,
    slPrice?: number,
    trigger: "MARK_PRICE" | "LAST" = "MARK_PRICE"
  ) => {
    const size = parseFloat(pos.positionAmt || "0");
    if (!size) return;
    const positionSide = (size > 0 ? "LONG" : "SHORT") as "LONG" | "SHORT";
    const qty = Math.abs(size);

    if (tpPrice && tpPrice > 0) {
      binanceWS.placeOrder({
        symbol: pos.symbol,
        market: "futures",
        type: "TAKE_PROFIT_MARKET",
        side: size > 0 ? "SELL" : "BUY",
        positionSide,
        stopPrice: tpPrice,
        workingType: trigger,
        quantity: qty,
      });
    }
    if (slPrice && slPrice > 0) {
      binanceWS.placeOrder({
        symbol: pos.symbol,
        market: "futures",
        type: "STOP_MARKET",
        side: size > 0 ? "SELL" : "BUY",
        positionSide,
        stopPrice: slPrice,
        workingType: trigger,
        quantity: qty,
      });
    }
  };

  // ===== Xác nhận đóng vị thế (market/limit/stop/take_profit) =====
  const handleConfirmClose = async (p: {
    type: "MARKET" | "LIMIT" | "STOP" | "TAKE_PROFIT";
    symbol: string;
    side: "BUY" | "SELL";
    positionSide?: "LONG" | "SHORT" | "BOTH";
    quantity: number;
    price?: number; // dùng làm limit price (và cũng là stopPrice)
    timeInForce?: "GTC";
  }) => {
    const step = getStepSize(p.symbol);
    const tick = getPriceTick(p.symbol);

    const pos = positionsView.find((x) => x.symbol === p.symbol);
    const maxQty = Math.abs(Number(pos?.positionAmt || 0));

    const qty = roundTo(clamp(p.quantity, 0, maxQty), step, "floor");
    if (qty <= 0) return;

    const base: any = {
      symbol: p.symbol,
      market: "futures",
      side: p.side,
      quantity: qty,
      ...(p.positionSide && p.positionSide !== "BOTH"
        ? { positionSide: p.positionSide }
        : {}),
    };

    try {
      if (p.type === "MARKET") {
        await binanceWS.placeOrder({ ...base, type: "MARKET" });
      } else if (p.type === "LIMIT") {
        const px = roundTo(Number(p.price || 0), tick, "round");
        if (!(px > 0)) return;
        await binanceWS.placeOrder({
          ...base,
          type: "LIMIT",
          price: px,
          timeInForce: "GTC",
        });
      } else if (p.type === "STOP" || p.type === "TAKE_PROFIT") {
        const sp = roundTo(Number(p.price || 0), tick, "round");
        if (!(sp > 0)) return;

        const payload: any = {
          ...base,
          type: p.type,
          stopPrice: sp,
          price: sp,
          workingType: "MARK_PRICE",
          timeInForce: "GTC",
        };

        try {
          await binanceWS.placeOrder(payload);
        } catch (e: any) {
          const msg = String(e?.message || "").toLowerCase();
          if (msg.includes("reduceonly")) {
            delete payload.reduceOnly;
            await binanceWS.placeOrder(payload);
          } else {
            throw e;
          }
        }
      }
    } catch (e: any) {
      console.error("placeOrder error:", e);
    }

    // debounce refresh sau FILLED/close
    scheduleRefresh(400);
  };

  // ====== Debounce refresh ======
  const scheduleRefresh = (() => {
  let t: any;
  return (ms = 400) => {
    clearTimeout(t);
    t = setTimeout(() => requestPositions('post-action', { force: true }), ms);
  };
})();

 

  // ====== Khi view thay đổi: lưu cache + emit count/floating ======
  useEffect(() => {
    try {
      if (positionsView.length > 0) {
  localStorage.setItem("positions", JSON.stringify(positionsView));
} else {
  localStorage.removeItem("positions");
};
    } catch {}
    onPositionCountChange?.(positionsView.length);

    const selectedSymbol =
      localStorage.getItem("selectedSymbol") || positionsView[0]?.symbol;
    const pos = positionsView.find(
      (p) => p.symbol === selectedSymbol && parseFloat(p.positionAmt) !== 0
    );
    const mark = pos ? getMark(pos) : undefined;
    if (!pos || mark == null) {
      onFloatingInfoChange?.(null);
      return;
    }
    const entry = Number(pos.entryPrice);
    const qty = Number(pos.positionAmt);
    const pnl = qty * (mark - entry);
    const im = (() => {
      const im0 = Number(pos.positionInitialMargin);
      if (Number.isFinite(im0) && im0 > 0) return im0;
      const lev = Number(pos.leverage);
      if (entry > 0 && Math.abs(qty) > 0 && Number.isFinite(lev) && lev > 0)
        return (Math.abs(qty) * entry) / lev;
      if (entry > 0 && Math.abs(qty) > 0) return Math.abs(qty) * entry;
      return 0;
    })();
    const roi = im ? (pnl / im) * 100 : 0;
    onFloatingInfoChange?.({
      symbol: pos.symbol,
      pnl,
      roi,
      price: mark,
      positionAmt: Number(pos.positionAmt || 0),
    });
  }, [positionsView]);

  // ====== Hydrate từ cache, rồi kéo snapshot thật ======
 useEffect(() => {
  try {
    const cached = localStorage.getItem("positions");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length) {
        applySnapshot(parsed, Date.now() - 1);
      }
    }
  } catch {}
  // ✅ FIX: Chờ WebSocket ready và account selected
  const init = async () => {
    if (binanceWS.isConnected()) {
      binanceWS.getPositions();
    } else {
      // Chờ tối đa 3 giây
      let waited = 0;
      const interval = setInterval(() => {
        waited += 200;
        if (binanceWS.isConnected()) {
          clearInterval(interval);
          binanceWS.getPositions();
        } else if (waited >= 3000) {
          clearInterval(interval);
        }
      }, 200);
    }
  };
  init();
}, []);

  

  // ====== Nhận ACCOUNT_UPDATE.a.P (delta list) ======
  useEffect(() => {
    const handler = (msg: any) => {
      if (msg?.a?.P && Array.isArray(msg.a.P)) {
        if (refreshingRef.current) {
          msg.a.P.forEach((r: any) => deltaQueueRef.current.push(r));
        } else {
          msg.a.P.forEach((r: any) => applyDelta(r));
        }
      }
    };
    binanceWS.onMessage(handler);
    return () => binanceWS.removeMessageHandler(handler);
  }, []);

  // ====== Leverage / futures account enrich (delta enrich) ======
  useEffect(() => {
    const onWs = (m: any) => {
      if (
        m?.e === "ACCOUNT_CONFIG_UPDATE" &&
        m.ac?.s &&
        Number.isFinite(m.ac.l)
      ) {
        const symbol = String(m.ac.s);
        for (const [k, p] of posStoreRef.current.entries()) {
          if (p.symbol === symbol)
            posStoreRef.current.set(k, { ...p, leverage: Number(m.ac.l) });
        }
        scheduleFlush();
      }
      if (
        (m?.type === "getFuturesAccount" || m?.type === "futuresAccount") &&
        Array.isArray(m.positions)
      ) {
        for (const row of m.positions) {
          const symbol = String(row.symbol ?? row.s);
          const ps = (row.positionSide ?? row.ps ?? "BOTH") as PosSide;
          const k = `${symbol}:${ps}`;
          const cur = posStoreRef.current.get(k);
          if (!cur) continue;
          const lev = Number(row.leverage ?? row.l);
          const iw = Number(row.isolatedWallet ?? row.iw ?? row.isolatedMargin);
          posStoreRef.current.set(k, {
            ...cur,
            leverage: Number.isFinite(lev) && lev > 0 ? lev : cur.leverage,
            isolatedWallet:
              Number.isFinite(iw) && iw >= 0 ? iw : cur.isolatedWallet,
          });
        }
        scheduleFlush();
      }
    };
    binanceWS.onMessage(onWs);
    return () => binanceWS.removeMessageHandler(onWs);
  }, []);

  // ====== Subscribe Mark Price theo symbol list (delta) ======
  const subscribedRef = React.useRef<Set<string>>(new Set());
  useEffect(() => {
    if (market !== "futures") return;

    const want = new Set(positionsView.map((p) => p.symbol));
    const have = subscribedRef.current;

    // subscribe mới
    want.forEach((symbol) => {
      if (have.has(symbol)) return;
      binancePublicWS.subscribeMarkPrice(
        symbol.toUpperCase(),
        (raw: string) => {
          const val = Number(raw);
          if (!Number.isFinite(val)) return;
          let changed = false;
          for (const [k, p] of posStoreRef.current.entries()) {
            if (p.symbol === symbol) {
              const old = Number(p.markPrice ?? NaN);
              if (!Number.isFinite(old) || Math.abs(old - val) > 1e-12) {
                posStoreRef.current.set(k, { ...p, markPrice: String(val) });
                changed = true;
              }
            }
          }
          if (changed) scheduleFlush();
        }
      );
      have.add(symbol);
    });

    // unsubscribe dư
    [...have].forEach((symbol) => {
      if (!want.has(symbol)) {
        binancePublicWS.unsubscribeMarkPrice(symbol.toUpperCase());
        have.delete(symbol);
      }
    });
  }, [positionsView.map((p) => p.symbol).join("|"), market]);

  // ====== wait cancel ack ======
  const waitForCancelAck = (symbol: string, timeoutMs = 800) =>
    new Promise<void>((resolve) => {
      const handler = (m: any) => {
        if (m && m.symbol === symbol && typeof m.canceledOrders === "number") {
          binanceWS.removeMessageHandler(handler);
          resolve();
        }
      };
      binanceWS.onMessage(handler);
      setTimeout(() => {
        binanceWS.removeMessageHandler(handler);
        resolve();
      }, timeoutMs);
    });

  // ====== Close all Market ======
  const handleCloseAllMarket = async () => {
  const actives = positionsView.filter(
    (p) => Number(p.positionAmt || 0) !== 0
  );
   // ✅ Clear cache NGAY LẬP TỨC trước khi close
  localStorage.removeItem("positions");
  posStoreRef.current.clear();
  setPositionsView([]);
  for (const pos of actives) {
    const rawSize = Number(pos.positionAmt || 0);
    if (!Number.isFinite(rawSize) || rawSize === 0) continue;

    const symbol = pos.symbol;
    const side = rawSize > 0 ? "SELL" : "BUY";
    const isHedge = true;
    const positionSide = (
      isHedge ? (rawSize > 0 ? "LONG" : "SHORT") : "BOTH"
    ) as "LONG" | "SHORT" | "BOTH";

    const step = getStepSize(symbol);
    const qty = roundToStep(Math.abs(rawSize), step);
    if (qty <= 0) continue;

    try {
      await binanceWS.cancelAllOrders(symbol, "futures");
    } catch {}
    await waitForCancelAck(symbol, 800);

    try {
      await binanceWS.placeOrder({
        symbol,
        market: "futures",
        type: "MARKET",
        side: side as "BUY" | "SELL",
        positionSide,
        quantity: qty,  // ✅ Dùng quantity
      });
    } catch (e: any) {
        const msg = String(e?.message || "").toLowerCase();
        if (
          msg.includes("exposure") &&
          msg.includes("exceed") &&
          msg.includes("limit")
        ) {
          await new Promise((r) => setTimeout(r, 400));
          await binanceWS.placeOrder({
            symbol,
            market: "futures",
            type: "MARKET",
            side: side as "BUY" | "SELL",
            positionSide,
            quantity: qty,
          });
        } else if (msg.includes("position side") && msg.includes("not match")) {
          await binanceWS.placeOrder({
            symbol,
            market: "futures",
            type: "MARKET",
            side: side as "BUY" | "SELL",
            quantity: qty,
          });
        }
      }
    }
    scheduleRefresh(400);
  };

  // ====== Close all by PnL ======
  const calculatePnl = (pos: PositionCalc): number | undefined => {
    const entry = Number(pos.entryPrice);
    const qty = Number(pos.positionAmt);
    const mark = getMark(pos);
    if (!entry || !qty || mark == null) return undefined;
    return qty * (mark - entry);
  };
  const getInitialMargin = (pos: PositionCalc): number => {
    const im = Number(pos.positionInitialMargin);
    if (Number.isFinite(im) && im > 0) return im;

    const entry = Number(pos.entryPrice);
    const qty = Math.abs(Number(pos.positionAmt));
    const lev = Number(pos.leverage);

    if (entry > 0 && qty > 0 && Number.isFinite(lev) && lev > 0)
      return (qty * entry) / lev;
    if (entry > 0 && qty > 0) return qty * entry;
    return 0;
  };
  const calculatePnlPercentage = (pos: PositionCalc): number | undefined => {
    const pnl = calculatePnl(pos);
    const im = getInitialMargin(pos);
    if (pnl == null || !im) return undefined;
    return (pnl / im) * 100;
  };

  const handleCloseAllByPnl = () => {
    positionsView.forEach((pos) => {
      const size = parseFloat(pos.positionAmt || "0");
      const pnlPercent = calculatePnlPercentage(pos);
      if (size === 0 || (pnlPercent ?? 0) < 5) return;

      const side = size > 0 ? "SELL" : "BUY";
      const positionSide = size > 0 ? "LONG" : "SHORT";
      binanceWS.placeOrder({
        symbol: pos.symbol,
        side: side as "BUY" | "SELL",
        type: "MARKET",
        quantity: Math.abs(size),
        market: "futures",
        reduceOnly: true,
        positionSide: positionSide as "LONG" | "SHORT",
      });
    });
    scheduleRefresh(400);
  };

  // ===== Helper: Render TP/SL cell cho một position =====
const renderTpSlCell = (pos: PositionCalc) => {
  const openOrders = JSON.parse(localStorage.getItem(OPEN_ORDERS_LS_KEY) || '[]');
  const positionSide = parseFloat(pos.positionAmt || "0") > 0 ? "LONG" : "SHORT";
  const expectedSide = positionSide === "LONG" ? "SELL" : "BUY";
  const entryPrice = parseFloat(pos.entryPrice || "0");
  const accountId = Number(localStorage.getItem('selectedBinanceAccountId')) || null;
  const leverage = pos.leverage || loadLeverageLS(accountId, 'futures', pos.symbol) || 10;
  
  // ✅ ĐỊNH NGHĨA isValidOrder TRONG renderTpSlCell
  const isValidOrder = (order: any, isTp: boolean) => {
    if (!order || !entryPrice) return false;
    const stopPrice = parseFloat(order.stopPrice || '0');
    if (!stopPrice) return false;
    
    const isLong = positionSide === "LONG";
    
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
    
    // Check ROI không quá lớn (tránh orders của position cũ)
    const priceDiff = isLong 
      ? (isTp ? stopPrice - entryPrice : entryPrice - stopPrice)
      : (isTp ? entryPrice - stopPrice : stopPrice - entryPrice);
    const roi = Math.abs((priceDiff / entryPrice) * leverage * 100);
    
    // Nếu ROI > 500% thì chắc chắn là order của position cũ
    if (roi > 500) return false;
    
    return true;
  };
  
  const tpOrder = openOrders.find((o: any) => 
    o.symbol === pos.symbol && 
    (o.type === 'TAKE_PROFIT_MARKET' || o.type === 'TAKE_PROFIT') &&
    o.side === expectedSide &&
    o.status === 'NEW' &&
    !o._optimistic &&
    !String(o.orderId || '').startsWith('tmp_')
  );
  
  const slOrder = openOrders.find((o: any) => 
    o.symbol === pos.symbol && 
    (o.type === 'STOP_MARKET' || o.type === 'STOP') &&
    o.side === expectedSide &&
    o.status === 'NEW' &&
    !o._optimistic &&
    !String(o.orderId || '').startsWith('tmp_')
  );
  
  // CHỈ HIỂN THỊ NẾU ORDERS HỢP LỆ
  const validTp = tpOrder && isValidOrder(tpOrder, true) ? tpOrder : null;
  const validSl = slOrder && isValidOrder(slOrder, false) ? slOrder : null;
  
  if (!validTp && !validSl) {
    return (
      <div className="flex items-center gap-1 text-fluid-xs">
        <span className="text-gray-500">--</span>
        <span className="text-gray-600">|</span>
        <span className="text-gray-500">--</span>
      </div>
    );
  }

  // ĐỌC METADATA ĐỂ LẤY ROI INPUT CỦA USER
  const tpslMetadata = JSON.parse(localStorage.getItem('tpsl_metadata') || '{}');
  const metaKey = `${pos.symbol}:${positionSide}`;
  const metadata = tpslMetadata[metaKey] || {};

  // Hàm tính ROI từ stopPrice (fallback)
  const calcRoi = (stopPrice: number, isTp: boolean) => {
    if (!entryPrice || !stopPrice) return null;
    const isLong = positionSide === "LONG";
    const priceDiff = isLong 
      ? (isTp ? stopPrice - entryPrice : entryPrice - stopPrice)
      : (isTp ? entryPrice - stopPrice : stopPrice - entryPrice);
    const roi = (priceDiff / entryPrice) * leverage * 100;
    return roi.toFixed(1);
  };

  const tpStopPrice = validTp ? parseFloat(validTp.stopPrice || "0") : 0;
  const slStopPrice = validSl ? parseFloat(validSl.stopPrice || "0") : 0;
  
  // ƯU TIÊN HIỂN THỊ ROI INPUT CỦA USER, NẾU KHÔNG CÓ THÌ TÍNH LẠI
  const tpRoi = validTp 
    ? (metadata.tpInputRoi || calcRoi(tpStopPrice, true))
    : null;
  const slRoi = validSl 
    ? (metadata.slInputRoi || calcRoi(slStopPrice, false))
    : null;



  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 text-[15px]">
        <span className={validTp ? "text-[#0ecb81]" : "text-gray-500"}>
          {tpRoi ? `${tpRoi}%` : "--"}
        </span>
        <span className="text-gray-600">|</span>
        <span className={validSl ? "text-[#f6465d]" : "text-gray-500"}>
          {slRoi ? `${slRoi}%` : "--"}
        </span>
      </div>
      <div className="text-[10px] text-gray-500">(ROI%)</div>
    </div>
  );
};

  // ====== UI ======
  const posAccountId =
    (activePos as any)?.internalAccountId ??
    (activePos as any)?.accountId ??
    null;
// ✅ HELPER: Tính ROI cho 1 position (ĐẶT TRƯỚC sortedPositions)
const calculateRoi = (pos: PositionCalc): number => {
  const pnl = calculatePnl(pos);
  if (pnl == null) return 0;
  
  const margin = getInitialMargin(pos);
  if (!margin || margin === 0) return 0;
  
  return (pnl / margin) * 100;
};

// ✅ FILTER + SORT POSITIONS
const sortedPositions = React.useMemo(() => {
  let result = positionsView;
  
  // Bước 1: Filter theo Long/Short/All/Current
  if (positionFilter === 'long') {
    result = result.filter((pos) => parseFloat(pos.positionAmt || "0") > 0);
  } else if (positionFilter === 'short') {
    result = result.filter((pos) => parseFloat(pos.positionAmt || "0") < 0);
  } else if (positionFilter === 'current') {
    // ✅ MỚI: Chỉ hiện symbol đang chọn trên chart
    const currentSymbol = localStorage.getItem('selectedSymbol') || '';
    if (currentSymbol) {
      result = result.filter((pos) => pos.symbol === currentSymbol);
    }
  }

  // Bước 2: Sort nếu có sortConfig
  if (sortConfig && sortConfig.direction) {
    const { column, direction, roiType } = sortConfig;
    const multiplier = direction === 'asc' ? 1 : -1;

    result = [...result].sort((a, b) => {
      let valA = 0, valB = 0;

      switch (column) {
        case 'symbol':
          return multiplier * a.symbol.localeCompare(b.symbol);
        case 'size':
          valA = parseFloat(a.positionAmt || "0");
          valB = parseFloat(b.positionAmt || "0");
          break;
        case 'entry':
          valA = parseFloat(a.entryPrice || "0");
          valB = parseFloat(b.entryPrice || "0");
          break;
        case 'markPrice':
          valA = parseFloat(a.markPrice || "0");
          valB = parseFloat(b.markPrice || "0");
          break;
        case 'margin':
          valA = getInitialMargin(a) || 0;
          valB = getInitialMargin(b) || 0;
          break;
        case 'pnl':
          valA = calculatePnl(a) || 0;
          valB = calculatePnl(b) || 0;
          break;
        case 'roi':
          const roiA = calculateRoi(a);
          const roiB = calculateRoi(b);
          
          if (roiType === 'positive') {
            if (roiA > 0 && roiB <= 0) return -1;
            if (roiA <= 0 && roiB > 0) return 1;
            if (roiA <= 0 && roiB <= 0) return 0;
          } else if (roiType === 'negative') {
            if (roiA < 0 && roiB >= 0) return -1;
            if (roiA >= 0 && roiB < 0) return 1;
            if (roiA >= 0 && roiB >= 0) return 0;
          }
          
          valA = roiA;
          valB = roiB;
          break;
        default:
          return 0;
      }
      return multiplier * (valA - valB);
    });
  }

  return result;  // ✅ QUAN TRỌNG: return result
}, [positionsView, positionFilter, sortConfig]);  // ✅ QUAN TRỌNG: đóng useMemo


  return (
  <div className="w-full max-w-full overflow-hidden">
    {/* ✅ THÊM WRAPPER CHO TABLE */}
    <div className="trading-positions-table-container w-full max-w-full">
      <table className="position-table w-full min-w-[1000px] text-fluid-xs">
        <thead>
  <tr className="border-b border-dark-700 text-left text-fluid-xs uppercase tracking-wider text-dark-300">
    {/* Symbol với Filter dropdown */}
    <th className="px-fluid-sm py-1.5">
      <SymbolFilterDropdown
        value={positionFilter}
        onChange={setPositionFilter}
      />
    </th>
    
    {/* Size với Sort */}
    <th className="px-2 py-1.5">
      <StandardSortHeader
        label="Size"
        column="size"
        currentSort={sortConfig}
        onSort={setSortConfig}
      />
    </th>
    
    {/* Entry với Sort */}
    <th className="px-3 py-1.5">
      <StandardSortHeader
        label="Entry"
        column="entry"
        currentSort={sortConfig}
        onSort={setSortConfig}
      />
    </th>
    
    {/* Mark Price với Sort */}
    <th className="px-3 py-1.5">
      <StandardSortHeader
        label="Mark Price"
        column="markPrice"
        currentSort={sortConfig}
        onSort={setSortConfig}
      />
    </th>
    
    {/* Margin với Sort */}
    <th className="px-3 py-1.5">
      <StandardSortHeader
        label="Margin"
        column="margin"
        currentSort={sortConfig}
        onSort={setSortConfig}
      />
    </th>
    
    {/* PNL(ROI%) với Sort đặc biệt - dropdown 3 loại */}
    <th className="px-3 py-1.5">
      <RoiSortHeader
        currentSort={sortConfig}
        onSort={setSortConfig}
      />
    </th>
    
    {/* TP | SL */}
    <th className="px-3 py-1.5">TP | SL</th>
    
    {/* Close Position header - giữ nguyên */}
    <th className="closePosition px-2">
      <div className="flex items-center justify-start space-x-2 min-w-[200px]">
        <button
          onClick={() => setShowCloseAllModal(true)}
          className="text-[#fcd535] text-[10px] sm:text-fluid-xs hover:underline whitespace-nowrap"
          title="Đóng tất cả Market Order"
        >
          Close All
        </button>
        <div className="w-[1px] h-[16px] bg-gray-600"></div>
        <button
          onClick={() => setShowPopup(true)}
          className="text-[#fcd535] text-[10px] sm:text-fluid-xs hover:underline whitespace-nowrap"
          title="Đóng tất cả theo PnL"
        >
          Close by PnL
        </button>
      </div>
    </th>
  </tr>
</thead>

        <tbody>
  {sortedPositions.length === 0 ? (
    <tr>
      {/* ✅ UPDATE COLSPAN từ 7 lên 8 */}
      <td colSpan={8} className="text-center py-6 text-dark-400 text-sm">
  {positionFilter === 'all' 
    ? 'Bạn không có vị thế nào.'
    : positionFilter === 'long'
    ? 'Không có lệnh Long nào.'
    : 'Không có lệnh Short nào.'}
</td>
    </tr>
  ) : (
    sortedPositions.map((pos) => {
      const size = parseFloat(pos.positionAmt || "0");
      const pnl = calculatePnl(pos);
      const key = rowKey(pos);
      const step = getStepSize(pos.symbol);
      const tick = getPriceTick(pos.symbol);
      const absSize = Math.abs(parseFloat(pos.positionAmt || "0"));
      const mark = Number(pos.markPrice || NaN);
      
      // ✅ TÍNH MARGIN
      const margin = getInitialMargin(pos);
      const marginType = pos.marginType || "cross";

      const pnlClass =
        pnl == null
          ? "text-white"
          : pnl > 0
          ? "text-[#0ecb81]"
          : pnl < 0
          ? "text-[#f6465d]"
          : "text-white";

      const sizeClass =
        size > 0
          ? "text-[#0ecb81]"
          : size < 0
          ? "text-[#f6465d]"
          : "text-white";

      return (
  <tr
    key={`${pos.symbol}:${pos.positionSide || "BOTH"}`}
    className="border-b border-dark-700 hover:bg-dark-800/50 transition-colors"
  >
    {/* SYMBOL */}
    <td 
      className="px-fluid-sm py-fluid-xs font-medium text-white cursor-pointer hover:text-[#fcd535] transition-colors text-fluid-sm"
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent("chart-symbol-change-request", {
            detail: { symbol: pos.symbol },
          })
        );
        try {
          localStorage.setItem("selectedSymbol", pos.symbol);
        } catch {}
      }}
      title={`Click để chuyển chart sang ${pos.symbol}`}
    >
      {pos.symbol}
    </td>

    {/* SIZE */}
    <td className={`px-fluid-sm py-fluid-xs font-medium text-fluid-sm tabular-nums ${sizeClass}`}>
      {size > 0 ? "" : "-"} {Math.abs(size)}
    </td>

    {/* ENTRY PRICE */}
    <td className="px-fluid-sm py-fluid-xs text-white text-fluid-sm tabular-nums">
      {pos.entryPrice}
    </td>

    {/* MARK PRICE */}
    <td className="px-fluid-sm py-fluid-xs text-white text-fluid-sm tabular-nums">
      {fmt(getMark(pos))}
    </td>

    {/* MARGIN */}
    <td className="px-fluid-sm py-fluid-xs text-white">
      <div>
        <div className="text-fluid-sm tabular-nums">
          {margin > 0 ? `${fmtShort(margin)} USDT` : "--"}
        </div>
        <div className="text-fluid-2xs text-gray-400">
          ({marginType === "isolated" ? "Isolated" : "Cross"})
        </div>
      </div>
    </td>

    {/* PNL */}
    <td className={`px-fluid-sm py-fluid-xs font-medium text-fluid-sm tabular-nums ${pnlClass}`}>
      {pnl == null
        ? "--"
        : nearZero(pnl)
        ? "0.00"
        : `${pnl > 0 ? "+" : "-"}${fmtShort(Math.abs(pnl))} USDT`}
      <br />
      <span className="text-fluid-3xs opacity-80">
        {(() => {
          const pnlPct = (() => {
            const im = getInitialMargin(pos);
            if (!im) return undefined;
            return (pnl! / im) * 100;
          })();
          return pnlPct == null
            ? "--"
            : nearZero(pnlPct)
            ? "0.00%"
            : `(${pnlPct > 0 ? "+" : "-"}${fmt(Math.abs(pnlPct), 2)}%)`;
        })()}
      </span>
    </td>

    {/* TP | SL */}
    <td className="px-fluid-sm py-fluid-xs text-fluid-sm">
      {renderTpSlCell(pos)}
    </td>

    {/* ORDER TYPE SELECTOR */}
    <td className="px-fluid-sm py-fluid-xs">
      <div className="flex items-center gap-fluid-xs mt-fluid-xs">
        <div className="text-fluid-xs font-normal text-white flex items-center gap-fluid-2xs">
          <span
            className={`cursor-pointer transition-colors ${
              orderType === "market" ? "text-[#fcd535]" : "text-white hover:text-gray-300"
            }`}
            onClick={() => {
              setOrderType("market");
              setCloseModal({ open: true, mode: "market", pos });
              setRowQty(key, absSize ? String(absSize) : "");
            }}
          >
            Thị trường
          </span>
          <span className="text-gray-600">|</span>
          <span
            className={`cursor-pointer transition-colors ${
              orderType === "limit" ? "text-[#fcd535]" : "text-white hover:text-gray-300"
            }`}
            onClick={() => {
              setOrderType("limit");
              setCloseModal({ open: true, mode: "limit", pos });
              if (Number.isFinite(mark)) setRowPrice(key, String(mark));
              setRowQty(key, absSize ? String(absSize) : "");
            }}
          >
            Giới hạn
          </span>
        </div>
      </div>
    </td>

    {/* ACTION BUTTONS */}
    <td className="pr-fluid-md">
      <div className="flex items-center justify-end gap-fluid-xs">
        {/* TP/SL Button */}
        <button
          onClick={() => {
            setActivePos(pos);
            setShowTpSl(true);
          }}
          className="inline-flex items-center gap-fluid-2xs text-fluid-2xs px-fluid-xs py-fluid-2xs rounded border border-dark-500 text-gray-200 hover:bg-dark-700 transition-colors"
          title="TP/SL cho vị thế (modal)"
        >
          <Edit3 size={14} className="flex-shrink-0" /> 
          <span>TP/SL</span>
        </button>

        {/* Advanced Button */}
        <button
          onClick={() => {
            const size = parseFloat(pos.positionAmt || "0");
            if (!size) return;
            const side = (size > 0 ? "LONG" : "SHORT") as "LONG" | "SHORT";
            const payload = {
              positionId: `${pos.symbol}:${pos.positionSide ?? side}`,
              symbol: pos.symbol,
              side,
              entry: parseFloat(pos.entryPrice || "0"),
            };
            try {
              localStorage.setItem("activeTool", JSON.stringify(payload));
            } catch {}
            window.dispatchEvent(
              new CustomEvent("chart-symbol-change-request", {
                detail: { symbol: pos.symbol },
              })
            );
            setTimeout(() => {
              window.dispatchEvent(
                new CustomEvent("active-tool-changed", { detail: payload })
              );
            }, 300);
          }}
          className="inline-flex items-center gap-fluid-2xs text-fluid-xs px-fluid-xs py-fluid-2xs rounded border border-primary/60 text-primary hover:bg-dark-700 transition-colors"
          title="Bật Tool nâng cao để kéo vùng TP/SL trên chart"
        >
          Nâng cao
        </button>
      </div>
    </td>
  </tr>
      );
    })
  )}
</tbody>
        </table>

        {showPopup && createPortal(
  <PopupPosition
    isOpen={showPopup}
    onClose={() => setShowPopup(false)}
    pnlNow={currentPnl}
    takeProfit={targetTP}
    stopLoss={targetSL}
    onSubmit={(tp, sl) => {
      setTargetTP(tp);
      setTargetSL(sl);
      setShowPopup(false);
    }}
  />,
  document.body
)}

        {activePos && showTpSl && createPortal(
  <PositionTpSlModal
    isOpen={showTpSl}
    onClose={() => {
      setShowTpSl(false);
      setTpslVersion(v => v + 1);
    }}
    symbol={activePos.symbol}
    entryPrice={parseFloat(activePos.entryPrice || "0")}
    markPrice={getMark(activePos as any) ?? 0}
    positionAmt={parseFloat(activePos.positionAmt || "0")}
    getPriceTick={getPriceTick}
    market={market}
    leverage={
      Number((activePos as any)?.leverage) ||
      loadLeverageLS(
        (activePos as any)?.internalAccountId ??
          (activePos as any)?.accountId ??
          null,
        market,
        activePos.symbol
      ) ||
      10
    }
    // ✅ THÊM PROPS ĐỂ TRUYỀN TP/SL HIỆN TẠI
    existingTpSlOrders={(() => {
      const openOrders = JSON.parse(localStorage.getItem(OPEN_ORDERS_LS_KEY) || '[]');
      const positionSide = parseFloat(activePos.positionAmt || "0") > 0 ? "LONG" : "SHORT";
      const expectedSide = positionSide === "LONG" ? "SELL" : "BUY";
      
      const tpOrder = openOrders.find((o: any) => 
        o.symbol === activePos.symbol && 
        (o.type === 'TAKE_PROFIT_MARKET' || o.type === 'TAKE_PROFIT') &&
        o.side === expectedSide &&
        o.status === 'NEW'
      );
      const slOrder = openOrders.find((o: any) => 
        o.symbol === activePos.symbol && 
        (o.type === 'STOP_MARKET' || o.type === 'STOP') &&
        o.side === expectedSide &&
        o.status === 'NEW'
      );
      
      return { tpOrder, slOrder };
    })()}
    onSubmit={() => {
      setTpslVersion(v => v + 1);
    }}
  />,
  document.body
)}

       {closeModal.open && closeModal.pos && createPortal(
  <ClosePositionModal
    isOpen={closeModal.open}
    onClose={() => setCloseModal({ open: false, mode: "market" })}
    mode={closeModal.mode}
    symbol={closeModal.pos.symbol}
    side={Number(closeModal.pos.positionAmt || 0) > 0 ? "SELL" : "BUY"}
    positionSide={
      Number(closeModal.pos.positionAmt || 0) > 0 ? "LONG" : "SHORT"
    }
    markPrice={Number(closeModal.pos.markPrice || NaN)}
    entryPrice={Number(closeModal.pos.entryPrice || NaN)}
    maxQty={Math.abs(Number(closeModal.pos.positionAmt || 0))}
    stepSize={getStepSize(closeModal.pos.symbol)}
    tickSize={getPriceTick(closeModal.pos.symbol)}
    price={closeBy[rowKey(closeModal.pos)]?.price}
    qty={closeBy[rowKey(closeModal.pos)]?.qty}
    onInputsChange={(next) =>
      setCloseBy((prev) => ({
        ...prev,
        [rowKey(closeModal.pos!)]: {
          ...(prev[rowKey(closeModal.pos!)] || {}),
          ...next,
        },
      }))
    }
    onConfirm={handleConfirmClose}
  />,
  document.body
)}

{showCloseAllModal && createPortal(
  <CloseAllPositionsModal
    isOpen={showCloseAllModal}
    onClose={() => setShowCloseAllModal(false)}
    onConfirm={handleCloseAllMarket}
    positionCount={positionsView.length}
  />,
  document.body
)}
      </div>
    </div>
  );
};

export default Position;