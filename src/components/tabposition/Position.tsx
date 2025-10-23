import React, { useEffect, useState } from "react";
import { binancePublicWS } from "../binancewebsocket/binancePublicWS";
import { binanceWS } from "../binancewebsocket/BinanceWebSocketService";
import PopupPosition from "../popupposition/PopupPosition";
import { PositionData } from "../../utils/types";
import PositionTpSlModal from "./function/PositionTpSlModal";
import { Edit3 } from "lucide-react";

// ngay đầu file Position.tsx hoặc cùng chỗ helpers
function loadLeverageLS(
  accountId?: number | null,
  market?: 'spot' | 'futures',
  symbol?: string
) {
  const key = `tw_leverage_${accountId ?? 'na'}_${market ?? 'futures'}_${symbol ?? ''}`;
  const raw = localStorage.getItem(key);
  const v = raw ? Number(raw) : NaN;
  return Number.isFinite(v) && v > 0 ? v : undefined;
}


// mở rộng cho phần tính toán/hiển thị
type PositionCalc = PositionData & {
  breakEvenPrice?: string; // bep
  unrealizedPnl?: number; // up
  leverage?: number; // l
  marginType?: string; // 'cross' | 'isolated'
  isolatedWallet?: number; // iw
  positionInitialMargin?: number; // từ positionRisk
  positionSide?: "LONG" | "SHORT" | "BOTH";
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

const Position: React.FC<PositionProps> = ({
  positions: externalPositions,
  market = "futures",
  onPositionCountChange,
  onFloatingInfoChange,
}) => {
  const [positions, setPositions] = useState<PositionCalc[]>([]);
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [closePrice, setClosePrice] = useState("");
  const [closeQuantity, setCloseQuantity] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [targetTP, setTargetTP] = useState("");
  const [targetSL, setTargetSL] = useState("");
  const [currentPnl, setCurrentPnl] = useState(0);

  // TP/SL modal
  const [showTpSl, setShowTpSl] = useState(false);
  const [activePos, setActivePos] = useState<PositionData | null>(null);

  // tick size cho giá
  const symbolTickMap: Record<string, number> = {};
  const getPriceTick = (symbol: string) => symbolTickMap[symbol] ?? 0.0001;

  // step size cho khối lượng
  const symbolStepMap: Record<string, number> = {};
  const getStepSize = (symbol: string) => symbolStepMap[symbol] ?? 0.001;
  const roundToStep = (qty: number, step: number) => {
    if (step <= 0) return qty;
    const precision = Math.max(0, (step.toString().split(".")[1] || "").length);
    return Number((Math.floor(qty / step) * step).toFixed(precision));
  };

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

  // ---------- FORMAT HIỂN THỊ (tránh bị 0.00) ----------
  const fmtUSDT = (x: number) => {
    const ax = Math.abs(x);
    if (ax >= 1)   return `${x.toFixed(2)} USDT`;
    if (ax >= 0.01) return `${x.toFixed(3)} USDT`;
    if (ax >= 0.001) return `${x.toFixed(4)} USDT`;
    return `${x.toFixed(6)} USDT`;
  };
  const fmtPct = (x: number) => {
    const ax = Math.abs(x);
    if (ax >= 1)   return `${x.toFixed(2)}%`;
    if (ax >= 0.1) return `${x.toFixed(3)}%`;
    return `${x.toFixed(4)}%`;
  };

  const fmtShort = (x: number) => {
  if (!Number.isFinite(x)) return "0.00";
  return x.toFixed(2);
};
// 🔹 helper tránh hiển thị -0.00
  const nearZero = (v: number, eps = 1e-6) => Math.abs(v) < eps;
  // Chuẩn hóa và cập nhật positions (KHÔNG dính localStorage)
  const applyPositions = React.useCallback((raw: any[]) => {
    const cleaned: PositionCalc[] = (raw || []).map((p: any) => {
  const symbol = String(p.symbol ?? p.s);
  const levFromPkt = Number(p.leverage ?? p.l);
  const levHydrate = Number.isFinite(levFromPkt) && levFromPkt > 0
    ? levFromPkt
    : binanceWS.getLeverage(symbol, 'futures', NaN); // ← lấy từ cache/LS nếu có

  const upNum = Number(p.up ?? p.unrealizedPnl);
  return {
    symbol,
    positionAmt: String(p.positionAmt ?? p.pa ?? "0"),
    entryPrice: String(p.entryPrice ?? p.ep ?? "0"),
    breakEvenPrice: String(p.breakEvenPrice ?? p.bep ?? p.ep ?? "0"),
    markPrice: p.markPrice ?? p.mp,
    leverage: Number.isFinite(levHydrate) && levHydrate > 0 ? levHydrate : undefined, // ← set
    marginType: (p.marginType ?? p.mt ?? "").toString().toLowerCase(),
    isolatedWallet:
      p.iw !== undefined ? Number(p.iw)
      : p.isolatedWallet !== undefined ? Number(p.isolatedWallet)
      : undefined,
    unrealizedPnl: Number.isFinite(upNum) ? upNum : undefined,
    positionInitialMargin:
      p.positionInitialMargin !== undefined ? Number(p.positionInitialMargin) : undefined,
    positionSide: p.ps || p.positionSide,
  } as PositionCalc;
}).filter(p => Math.abs(parseFloat(p.positionAmt)) > 1e-9);


    setPositions(cleaned);
    onPositionCountChange?.(cleaned.length);
    if (!cleaned.length) onFloatingInfoChange?.(null);
  }, [onPositionCountChange, onFloatingInfoChange]);

  // Kéo snapshot 1 lần khi mount (để có leverage/iw sớm)
  useEffect(() => { binanceWS.getFuturesAccount(); }, []);

  // Có position → yêu cầu backfill (WS sẽ fallback về getFuturesAccount nếu BE không có positionRisk)
  useEffect(() => {
    if (!positions.length) return;
    const symbols = Array.from(new Set(positions.map(p => p.symbol))).filter(Boolean);
    if (symbols.length) binanceWS.requestPositionRisk(symbols);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions.map(p => p.symbol).join("|")]);

  // Lắng nghe leverage change + snapshot + (nếu có) positionRisk
  useEffect(() => {
  const onWs = (m: any) => {
    // sự kiện đổi đòn bẩy real-time
    if (m?.e === "ACCOUNT_CONFIG_UPDATE" && m.ac?.s && Number.isFinite(m.ac.l)) {
      const { s: symbol, l: leverage } = m.ac;
      setPositions(prev => prev.map(p => p.symbol === symbol ? { ...p, leverage: Number(leverage) } : p));
    }

    // payload phẳng leverageUpdate do BE gửi
    if (m?.type === "leverageUpdate" && m.symbol && Number.isFinite(m.leverage)) {
      setPositions(prev => prev.map(p => p.symbol === m.symbol ? { ...p, leverage: Number(m.leverage) } : p));
    }

    // ✅ snapshot futures account → merge leverage/isolatedWallet
    if ((m?.type === "getFuturesAccount" || m?.type === "futuresAccount") && Array.isArray(m.positions)) {
      setPositions(prev => prev.map(p => {
        // 1) khớp đầy đủ (symbol + positionSide)
        let r = m.positions.find((row: any) =>
          String(row.symbol ?? row.s) === p.symbol &&
          String(row.positionSide ?? row.ps ?? "BOTH") === String(p.positionSide ?? "BOTH")
        );
        // 2) nếu không có, fallback khớp theo symbol
        if (!r) r = m.positions.find((row: any) => String(row.symbol ?? row.s) === p.symbol);
        if (!r) return p;

        const lev = Number(r.leverage ?? r.l);
        const iw  = Number(r.isolatedWallet ?? r.iw ?? r.isolatedMargin);
        return {
          ...p,
          leverage: (Number.isFinite(lev) && lev > 0) ? lev : p.leverage,
          isolatedWallet: (Number.isFinite(iw) && iw >= 0) ? iw : p.isolatedWallet,
        };
      }));
    }
  };
  binanceWS.onMessage(onWs);
  return () => binanceWS.removeMessageHandler(onWs);
}, []);




useEffect(() => {
  if (!positions.length) return;
  const needLev = positions.some(p => !(Number(p.leverage) > 0));
  if (needLev) binanceWS.getFuturesAccount(); // sẽ được merge ở effect trên
}, [positions.length]); // chỉ khi số lượng position thay đổi

  // === TÍNH TOÁN CHUẨN THEO BINANCE USDT-M ===

// PnL realtime: luôn tính theo entry & mark (không dùng p.up)
const calculatePnl = (pos: PositionCalc) => {
  const entry = parseFloat(pos.entryPrice || "0");
  const mark  = parseFloat(pos.markPrice  || pos.entryPrice || "0");
  const qty   = parseFloat(pos.positionAmt || "0"); // có dấu: LONG > 0, SHORT < 0
  if (!entry || !qty) return 0;
  return qty * (mark - entry);
};

// KHÔNG fallback sang pos.unrealizedPnl nữa
const calcUnrealized = (pos: PositionCalc) => calculatePnl(pos);

// Initial Margin (mẫu số ROE):
// 1) Ưu tiên positionInitialMargin (từ positionRisk)
// 2) Nếu chưa có: |qty| * entry / leverage (cho cả cross & isolated)
// 3) Không dùng isolatedWallet vì biến thiên theo PnL/funding
const getInitialMargin = (pos: PositionCalc) => {
  const im = Number(pos.positionInitialMargin);
  if (Number.isFinite(im) && im > 0) return im;

  const entry = parseFloat(pos.entryPrice || "0");
  const qty   = Math.abs(parseFloat(pos.positionAmt || "0"));
  const lev   = Number(pos.leverage);

  if (entry > 0 && qty > 0 && Number.isFinite(lev) && lev > 0) return (qty * entry) / lev;
  if (entry > 0 && qty > 0) return qty * entry; // fallback cuối
  return 0;
};

// ROE% (Binance gọi là ROE, bạn đang hiển thị ROI):
const calculatePnlPercentage = (pos: PositionCalc) => {
  const pnl = calcUnrealized(pos);
  const im  = getInitialMargin(pos);
  if (!im) return 0;
  return (pnl / im) * 100;
};


  // Floating info cho UI ngoài
  useEffect(() => {
    const selectedSymbol = localStorage.getItem("selectedSymbol") || positions[0]?.symbol;
    const pos = positions.find(p => p.symbol === selectedSymbol && parseFloat(p.positionAmt) !== 0);
    if (!pos) {
      onFloatingInfoChange?.(null);
      return;
    }
    const pnl = calcUnrealized(pos);
    const im  = getInitialMargin(pos);
    const roi = im ? (pnl / im) * 100 : 0;
    onFloatingInfoChange?.({
      symbol: pos.symbol,
      pnl,
      roi,
      price: parseFloat(pos.markPrice || "0"),
      positionAmt: parseFloat(pos.positionAmt || "0"),
    });
  }, [positions, onFloatingInfoChange]);

  
// === Gắn handler positions và khôi phục khi reload ===
useEffect(() => {
  // 🪣 1. Hydrate từ localStorage để hiển thị ngay khi F5
  try {
    const cached = localStorage.getItem("positions");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length) {
        console.log("🪣 Hydrated cached positions:", parsed);
        setPositions(parsed);
        onPositionCountChange?.(parsed.length);
      }
    }
  } catch {}

  // 🧠 2. Gắn handler chính (chỉ 1 nơi duy nhất)
  binanceWS.setPositionUpdateHandler((raw: any[]) => {
    const cleaned: PositionCalc[] = (raw || [])
      .map((p) => ({
        ...p,
        positionAmt: String(p.positionAmt ?? p.pa ?? "0"),
        entryPrice: String(p.entryPrice ?? p.ep ?? "0"),
        markPrice: String(p.markPrice ?? p.mp ?? "0"),
        symbol: String(p.symbol ?? p.s),
        leverage: Number(p.leverage ?? p.l ?? 0),
        unrealizedPnl: Number(p.unrealizedPnl ?? p.up ?? 0),
        positionSide: p.positionSide ?? p.ps ?? "BOTH",
      }))
      .filter((p) => Math.abs(parseFloat(p.positionAmt)) > 1e-9);

    setPositions(cleaned);
    onPositionCountChange?.(cleaned.length);
    if (!cleaned.length) onFloatingInfoChange?.(null);

    // Lưu cache để lần F5 sau hiển thị ngay
    try {
      localStorage.setItem("positions", JSON.stringify(cleaned));
    } catch {}
  });

  // 📡 3. Yêu cầu snapshot (sau khi handler đã gắn)
  binanceWS.getPositions();

  // 🧹 4. Cleanup khi unmount
  return () => binanceWS.setPositionUpdateHandler(() => {});
}, [onPositionCountChange, onFloatingInfoChange]);

  

  // ACCOUNT_UPDATE.a.P
  useEffect(() => {
    const handler = (msg: any) => {
      if (msg?.a?.P && Array.isArray(msg.a.P)) applyPositions(msg.a.P);
    };
    binanceWS.onMessage(handler);
    return () => binanceWS.removeMessageHandler(handler);
  }, [applyPositions]);

  // ======== SUBSCRIBE MARK PRICE THEO SYMBOL-LIST ỔN ĐỊNH ========
const subscribedRef = React.useRef<Set<string>>(new Set());

// Khóa phụ thuộc CHỈ theo list symbol (không theo markPrice)
const symbolsKey = React.useMemo(() => {
  const uniq = Array.from(new Set(positions.map(p => p.symbol))).filter(Boolean).sort();
  return uniq.join('|');
}, [positions.map(p => p.symbol).join('|')]);

useEffect(() => {
  if (market !== 'futures') return;

  const want = new Set(
    symbolsKey ? symbolsKey.split('|').filter(Boolean) : []
  );
  const have = subscribedRef.current;

  // Subscribe các symbol mới
  want.forEach(symbol => {
    if (have.has(symbol)) return;

    // ⚠️ binancePublicWS trả về string; convert sang number trước khi set
    binancePublicWS.subscribeMarkPrice(symbol.toUpperCase(), (raw: string) => {
      const val = Number(raw);
      if (!Number.isFinite(val)) return;

      setPositions(prev => {
        let changed = false;
        const next = prev.map(p => {
          if (p.symbol !== symbol) return p;
          // Tránh setState nếu không đổi
          const old = Number(p.markPrice ?? NaN);
          if (Number.isFinite(old) && Math.abs(old - val) < 1e-12) return p;
          changed = true;
          return { ...p, markPrice: String(val) };
        });
        return changed ? next : prev;
      });
    });

    have.add(symbol);
  });

  // Unsubscribe các symbol không còn
  Array.from(have).forEach(symbol => {
    if (!want.has(symbol)) {
      binancePublicWS.unsubscribeMarkPrice(symbol);
      have.delete(symbol);
    }
  });

  // Không cleanup toàn bộ ở đây! (giữ kết nối để realtime mượt)
}, [symbolsKey, market]);

// helper: chờ ACK huỷ lệnh cho 1 symbol (có timeout fallback)
const waitForCancelAck = (symbol: string, timeoutMs = 800) =>
  new Promise<void>((resolve) => {
    const handler = (m: any) => {
      // server trả: { symbol, canceledOrders, market, executionTime }
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

// phiên bản có HUỶ LỆNH CHỜ + ĐÓNG MKT (giữ style cũ)
const handleCloseAllMarket = async () => {
  // lấy các vị thế đang mở
  const actives = positions.filter(p => Number(p.positionAmt || 0) !== 0);

  for (const pos of actives) {
    const rawSize = Number(pos.positionAmt || 0);
    if (!Number.isFinite(rawSize) || rawSize === 0) continue;

    const symbol = pos.symbol;
    const side = rawSize > 0 ? "SELL" : "BUY";
    const isHedge = true;
    const positionSide = (isHedge ? (rawSize > 0 ? "LONG" : "SHORT") : "BOTH") as "LONG" | "SHORT" | "BOTH";

    const step = getStepSize(symbol);
    const qty = roundToStep(Math.abs(rawSize), step);
    if (qty <= 0) continue;

    // 1) Huỷ TẤT CẢ lệnh chờ của symbol này và đợi ACK
    try {
      await binanceWS.cancelAllOrders(symbol, "futures");
    } catch (e) {
      console.warn("cancelAllOrders failed", symbol, e);
    }
    await waitForCancelAck(symbol, 800);

    // 2) Đóng vị thế bằng MARKET (KHÔNG kèm reduceOnly để tránh lỗi server)
    try {
      await binanceWS.placeOrder({
        symbol,
        market: "futures",
        type: "MARKET",
        side: side as "BUY" | "SELL",
        positionSide, // bạn đang chạy hedge → giữ nguyên như code cũ
        quantity: qty,
      });
    } catch (e: any) {
      // hiếm khi risk-engine còn kẹt exposure → chờ một nhịp rồi thử lại
      const msg = String(e?.message || "").toLowerCase();
      if (msg.includes("exposure") && msg.includes("exceed") && msg.includes("limit")) {
        await new Promise(r => setTimeout(r, 400));
        await binanceWS.placeOrder({
          symbol,
          market: "futures",
          type: "MARKET",
          side: side as "BUY" | "SELL",
          positionSide,
          quantity: qty,
        });
      } else if (msg.includes("position side") && msg.includes("not match")) {
        // phòng trường hợp one-way: bỏ positionSide và thử lại
        await binanceWS.placeOrder({
          symbol,
          market: "futures",
          type: "MARKET",
          side: side as "BUY" | "SELL",
          quantity: qty,
        });
      } else {
        console.error("placeOrder error", symbol, e);
      }
    }
  }

  // refresh lại danh sách
  setTimeout(() => binanceWS.getPositions(), 300);
};

const handleCloseAllByPnl = () => {
  positions.forEach((pos) => {
    const size = parseFloat(pos.positionAmt || "0");
    const pnlPercent = calculatePnlPercentage(pos);
    if (size === 0 || pnlPercent < 5) return;

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

  setTimeout(() => binanceWS.getPositions(), 400);
};

useEffect(() => {
  if (!positions.length) return;
  const missingLev = positions.some(p => !(Number(p.leverage) > 0));
  if (missingLev) binanceWS.getFuturesAccount();
}, [positions.map(p => `${p.symbol}:${p.leverage ?? 'na'}`).join('|')]);



// 👉 phát đi "active-tool-changed" + set localStorage để ToolMini bắt
const activateAdvancedTool = (pos: PositionCalc) => {
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

  // 🔥 phát sự kiện đổi chart nếu đang ở symbol khác
  window.dispatchEvent(new CustomEvent("chart-symbol-change-request", { detail: { symbol: pos.symbol } }));

  // phát sau 300ms cho chắc chart đã đổi
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent("active-tool-changed", { detail: payload }));
  }, 300);
};

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
            {positions.map((pos) => {
              const size = parseFloat(pos.positionAmt || "0");
              const pnl = calcUnrealized(pos);
              // 👉 Log để debug leverage, margin, roi
    {/* console.log("ROW DEBUG", pos.symbol, {
  qty: pos.positionAmt,
  entry: pos.entryPrice,
  mark: pos.markPrice,
  lev: pos.leverage,
  im: getInitialMargin(pos),
  roi: calculatePnlPercentage(pos),
});*/}

              const pnlClass =
                pnl > 0
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
                  <td className="px-4 py-3 text-white">
                    {pos.markPrice ?? "--"}
                  </td>
                  <td className={`px-4 py-3 font-medium ${pnlClass}`}>
  {nearZero(pnl)
    ? "0.00"
    : `${pnl > 0 ? "+" : "-"}${fmtShort(Math.abs(pnl))}`}
  <br />
  <span className="text-xs opacity-80">
    {(() => {
      const r = calculatePnlPercentage(pos);
      return nearZero(r)
        ? "0.00%"
        : `(${r > 0 ? "+" : "-"}${fmtShort(Math.abs(r))}%)`;
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
                          onClick={() => setOrderType("market")}
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
                          onClick={() => setOrderType("limit")}
                        >
                          Giới hạn
                        </span>
                      </div>

                      <input
                        type="text"
                        value={closePrice}
                        onChange={(e) => setClosePrice(e.target.value)}
                        className="bg-dark-600 text-white text-[13px] px-2 py-[4px] rounded border border-dark-500 focus:outline-none w-[80px]"
                        placeholder="Giá"
                      />

                      <input
                        type="text"
                        value={closeQuantity}
                        onChange={(e) => setCloseQuantity(e.target.value)}
                        className="bg-dark-600 text-white text-[13px] px-2 py-[4px] rounded border border-dark-500 focus:outline-none w-[60px]"
                        placeholder="Số lượng"
                      />
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

    {/* 🔥 Nút Nâng cao: bật tool kéo trên chart */}
    <button
      onClick={() => activateAdvancedTool(pos)}
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
    markPrice={parseFloat(activePos.markPrice || "0")}
    positionAmt={parseFloat(activePos.positionAmt || "0")}
    getPriceTick={getPriceTick}
    market={market}
    leverage={
      Number((activePos as any)?.leverage) ||
      loadLeverageLS(posAccountId, market, activePos.symbol) ||
      1
    }
    onSubmit={({ tpPrice, slPrice, trigger }) => {
      sendTpSlOrders(activePos, tpPrice, slPrice, trigger);
    }}
  />
)}

      </div>
    </div>
  );
};

export default Position;