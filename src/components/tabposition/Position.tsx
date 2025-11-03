import React, { useEffect, useState } from "react";
import { binancePublicWS } from "../binancewebsocket/binancePublicWS";
import { binanceWS } from "../binancewebsocket/BinanceWebSocketService";
import PopupPosition from "../popupposition/PopupPosition";
import { PositionData } from "../../utils/types";
import PositionTpSlModal from "./function/PositionTpSlModal";
import { Edit3 } from "lucide-react";
import ClosePositionModal from "../popupposition/ClosePositionConfirmModal";

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

  const [positionsView, setPositionsView] = useState<PositionCalc[]>([]);

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
    trigger: "MARK" | "LAST" = "MARK"
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
          workingType: "MARK",
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

  // ====== Lấy futures account để enrich leverage/wallet khi cần ======
  useEffect(() => {
    binanceWS.getFuturesAccount();
  }, []);

  // ====== Khi view thay đổi: lưu cache + emit count/floating ======
  useEffect(() => {
    try {
      localStorage.setItem("positions", JSON.stringify(positionsView));
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
          applySnapshot(parsed, Date.now() - 1); // version thấp để snapshot thật overwrite
        }
      }
    } catch {}
    binanceWS.getPositions();
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
          quantity: qty,
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

  // ====== UI ======
  const posAccountId =
    (activePos as any)?.internalAccountId ??
    (activePos as any)?.accountId ??
    null;

  return (
    <div className="card">
      <div className="card-header text-[15px] font-semibold text-white">
        Positions
      </div>

      <div className="card-body overflow-x-auto">
        <table className="min-w-full text-left text-[13px] leading-[16px] font-sans">
          <thead>
            <tr className="text-gray-400 border-b border-dark-700">
              <th className="px-4 py-2">Symbol</th>
              <th className="px-4 py-2">Size</th>
              <th className="px-4 py-2">Entry</th>
              <th className="px-4 py-2">Mark Price</th>
              <th className="px-4 py-2">PNL(ROI%)</th>
              <th
                className="closePosition flex items-center px-[8px] first:pl-0 last:pr-0 z-[9] h-full"
                style={{ width: "280px", flex: "1 0 280px" }}
              >
                <div className="flex items-center space-x-[8px]">
                  <div>
                    <button
                      onClick={handleCloseAllMarket}
                      className="text-[#fcd535] text-[12px] hover:underline relative top-[-1px]"
                    >
                      Đóng tất cả MKT
                    </button>
                  </div>
                  <div className="w-[1px]  h-[16px] bg-gray-600"></div>
                  <button
                    onClick={() => setShowPopup(true)}
                    className="text-[#fcd535] text-[12px] hover:underline relative top-[-1px]"
                  >
                    Đóng tất cả dựa trên PnL
                  </button>
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {positionsView.map((pos) => {
              const size = parseFloat(pos.positionAmt || "0");
              const pnl = calculatePnl(pos);
              const key = rowKey(pos);
              const step = getStepSize(pos.symbol);
              const tick = getPriceTick(pos.symbol);
              const absSize = Math.abs(parseFloat(pos.positionAmt || "0"));
              const mark = Number(pos.markPrice || NaN);

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
                  className="border-b border-dark-700"
                >
                  <td className="px-4 py-3 font-medium text-white">
                    {pos.symbol}
                  </td>
                  <td className={`px-4 py-3 font-medium ${sizeClass}`}>
                    {size > 0 ? "" : "-"} {Math.abs(size)}
                  </td>
                  <td className="px-4 py-3 text-white">{pos.entryPrice}</td>

                  <td className="px-4 py-3 text-white">{fmt(getMark(pos))}</td>

                  <td className={`px-4 py-3 font-medium ${pnlClass}`}>
                    {pnl == null
                      ? "--"
                      : nearZero(pnl)
                      ? "0.00"
                      : `${pnl > 0 ? "+" : "-"}${fmtShort(Math.abs(pnl))} USDT`}
                    <br />
                    <span className="text-xs opacity-80">
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
                          : `(${pnlPct > 0 ? "+" : "-"}${fmt(
                              Math.abs(pnlPct),
                              2
                            )}%)`;
                      })()}
                    </span>
                  </td>

                  <td>
                    <div className="flex items-center space-x-2 mt-2">
                      <div className="text-[13px] font-normal text-white flex items-center space-x-1">
                        <span
                          className={`cursor-pointer ${
                            orderType === "market"
                              ? "text-[#fcd535]"
                              : "text-white"
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
                          className={`cursor-pointer ${
                            orderType === "limit"
                              ? "text-[#fcd535]"
                              : "text-white"
                          }`}
                          onClick={() => {
                            setOrderType("limit");
                            setCloseModal({ open: true, mode: "limit", pos });
                            if (Number.isFinite(mark))
                              setRowPrice(key, String(mark));
                            setRowQty(key, absSize ? String(absSize) : "");
                          }}
                        >
                          Giới hạn
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="pr-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setActivePos(pos);
                          setShowTpSl(true);
                        }}
                        className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded border border-dark-500 text-gray-200 hover:bg-dark-700"
                        title="TP/SL cho vị thế (modal)"
                      >
                        <Edit3 size={14} /> TP/SL
                      </button>

                      <button
                        onClick={() => {
                          const size = parseFloat(pos.positionAmt || "0");
                          if (!size) return;
                          const side = (size > 0 ? "LONG" : "SHORT") as
                            | "LONG"
                            | "SHORT";
                          const payload = {
                            positionId: `${pos.symbol}:${
                              pos.positionSide ?? side
                            }`,
                            symbol: pos.symbol,
                            side,
                            entry: parseFloat(pos.entryPrice || "0"),
                          };
                          try {
                            localStorage.setItem(
                              "activeTool",
                              JSON.stringify(payload)
                            );
                          } catch {}
                          window.dispatchEvent(
                            new CustomEvent("chart-symbol-change-request", {
                              detail: { symbol: pos.symbol },
                            })
                          );
                          setTimeout(() => {
                            window.dispatchEvent(
                              new CustomEvent("active-tool-changed", {
                                detail: payload,
                              })
                            );
                          }, 300);
                        }}
                        className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded border border-primary/60 text-primary hover:bg-dark-700"
                        title="Bật Tool nâng cao để kéo vùng TP/SL trên chart"
                      >
                        Nâng cao
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

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
        />

        {activePos && (
          <PositionTpSlModal
            isOpen={showTpSl}
            onClose={() => setShowTpSl(false)}
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
              1
            }
            onSubmit={({ tpPrice, slPrice, trigger }) => {
              sendTpSlOrders(activePos, tpPrice, slPrice, trigger);
            }}
          />
        )}

        {closeModal.open && closeModal.pos && (
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
          />
        )}
      </div>
    </div>
  );
};

export default Position;
