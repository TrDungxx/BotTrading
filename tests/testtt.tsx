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

  // Load initial snapshot từ backend (không cache)
useEffect(() => {
  setPositions([]);
  if (externalPositions && externalPositions.length) {
    applyPositions(externalPositions);
  }
  // luôn gọi snapshot mới nhất
  binanceWS.getPositions();
}, [externalPositions, applyPositions]);

  useEffect(() => {
  // chỉ gọi backend để lấy snapshot vị thế mới nhất
  binanceWS.getPositions();
}, [applyPositions]);

  // Private WS → positions
  useEffect(() => {
  binanceWS.setPositionUpdateHandler((raw) => applyPositions(raw || []));
  binanceWS.getPositions();
  return () => binanceWS.setPositionUpdateHandler(() => {});
}, [applyPositions]);

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

======================================================

// BinanceWebSocketService.ts
// Clean API: state machine + 2 queues (preAuth/authed), no generic send(), full wrappers

type MarketType = 'spot' | 'futures';
type WsState = 'closed' | 'connecting' | 'open' | 'authenticated';

// ==== Types for placing orders ====
export type WorkingType = 'MARK' | 'LAST';

export interface PlaceOrderPayload {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
  market: 'futures' | 'spot';

  // qty/price
  quantity: number;
  price?: number;     // LIMIT
  stopPrice?: number; // *_MARKET (TP/SL)

  // futures-only (optional)
  reduceOnly?: boolean;
  positionSide?: 'LONG' | 'SHORT' | 'BOTH';
  timeInForce?: 'GTC' | 'IOC' | 'FOK';

  // trigger theo Binance Futures
  workingType?: WorkingType; // 'MARK' | 'LAST'
}

class BinanceWebSocketService {
  private socket: WebSocket | null = null;
  private wsUrl = 'ws://45.77.33.141/w-binance-trading/signalr/connect';

  // ===== add fields =====
  private authInFlight = false;
  private authedOnceKeys = new Set<string>();
  private pushAuthedUnique(key: string, msg: any) {
    if (this.authedOnceKeys.has(key)) return;
    this.authedOnceKeys.add(key);
    this.authedQueue.push(msg);
  }
private noPositionRiskSupport = true;
  // ===== State & queues =====
  private state: WsState = 'closed';
  private openResolvers: Array<() => void> = [];
  private authResolvers: Array<() => void> = [];
  private preAuthQueue: any[] = []; // gửi khi state >= 'open'
  private authedQueue: any[] = [];  // gửi khi state === 'authenticated'

  // ===== Handlers & caches =====
  private messageHandlers: ((data: any) => void)[] = [];
  private currentAccountId: number | null = null;
  private orderUpdateHandler: ((orders: any[]) => void) | null = null;
  private positionUpdateHandler: ((positions: any[]) => void) | null = null;

  // Subscriptions / callbacks cho stream
  private subscriptions: Map<string, any> = new Map();
  private callbacks: Map<string, (data: any) => void> = new Map();

  // ==== NEW: coalesce risk requests ====
  private pendingRiskSymbols = new Set<string>();
  private riskDebounceTimer: number | null = null;

  // ---- cache leverage theo symbol ----
private symbolLeverage = new Map<string, number>(); // ex: "DOGEUSDT" -> 10

// ====== LocalStorage helpers cho Leverage ======
private levKey(accountId: number | null | undefined, market: MarketType, symbol: string) {
  return `tw_leverage_${accountId ?? 'na'}_${market}_${symbol.toUpperCase()}`;
}

private saveLeverageLS(symbol: string, lev: number, market: MarketType = 'futures') {
  try {
    const key = this.levKey(this.currentAccountId, market, symbol);
    localStorage.setItem(key, String(lev));
  } catch {}
}

private hydrateLeverageCacheFromLS(market: MarketType = 'futures') {
  if (!this.currentAccountId) return;
  const prefix = `tw_leverage_${this.currentAccountId}_${market}_`;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(prefix)) continue;
    const sym = k.slice(prefix.length).toUpperCase();
    const v = localStorage.getItem(k);
    const n = v ? Number(v) : NaN;
    if (sym && Number.isFinite(n) && n > 0) {
      this.symbolLeverage.set(sym, n);
    }
  }
}

private loadLeverageLS(symbol: string, market: MarketType = 'futures'): number | undefined {
  try {
    const key = this.levKey(this.currentAccountId, market, symbol);
    const v = localStorage.getItem(key);
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

private setLeverageFor(symbol: string, lev: any, market: MarketType = 'futures') {
  const n = Number(lev);
  if (Number.isFinite(n) && n > 0) {
    const sym = symbol.toUpperCase();
    this.symbolLeverage.set(sym, n);
    this.saveLeverageLS(sym, n, market);   // ✅ persist
    console.log("LEV CACHE SET ✅", sym, n);
  }
}

  // ========= Helpers =========
  private waitForOpen(): Promise<void> {
    if (this.state === 'open' || this.state === 'authenticated') return Promise.resolve();
    return new Promise(res => this.openResolvers.push(res));
  }
  private waitForAuth(): Promise<void> {
    if (this.state === 'authenticated') return Promise.resolve();
    return new Promise(res => this.authResolvers.push(res));
  }

  // === Position Risk (để backfill leverage/IM) ===
// Client fallback: server không support -> dùng futures snapshot
public requestPositionRisk(symbols?: string[]) {
  this.getFuturesAccount(); // kéo leverage/isolatedWallet qua snapshot
}

// (không còn dùng tới)
private _sendGetPositionRisk(symbols?: string[]) {
  // no-op
}

  public setCurrentAccountId(id: number) {
    this.currentAccountId = id;
  }
  public getCurrentAccountId(): number | null {
    return this.currentAccountId;
  }

  public setPositionUpdateHandler(handler: (positions: any[]) => void) {
    this.positionUpdateHandler = handler;
  }
  public setOrderUpdateHandler(handler: ((orders: any[]) => void) | null) {
    this.orderUpdateHandler = handler;
  }

  public onMessage(handler: (data: any) => void) {
    this.messageHandlers.push(handler);
  }
  public removeMessageHandler(handler: (data: any) => void) {
    this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
  }

  public isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  // changeposition
  public changePositionMode(dualSidePosition: boolean, onDone?: (ok: boolean, raw: any) => void) {
    this.sendAuthed({ action: 'changePositionMode', dualSidePosition });

    if (!onDone) return;
    const once = (m: any) => {
      if (m?.type === 'changePositionMode' && typeof m.dualSidePosition === 'boolean') {
        onDone(true, m);
        this.removeMessageHandler(once);
      } else if (m?.success === false && m?.error) {
        onDone(false, m);
        this.removeMessageHandler(once);
      }
    };
    this.onMessage(once);
  }

  public getPositionMode(onResult?: (dual: boolean) => void) {
    this.sendAuthed({ action: 'getPositionMode' });
    if (!onResult) return;
    const once = (m: any) => {
      if (m?.type === 'getPositionMode' && typeof m.dualSidePosition === 'boolean') {
        onResult(m.dualSidePosition);
        this.removeMessageHandler(once);
      }
    };
    this.onMessage(once);
  }

  // Public: đóng WS + dọn state
  public disconnect(reason?: string) {
    try { this.socket?.close(1000, reason || 'client disconnect'); } catch {}
    this.socket = null;
    this.state = 'closed';
    this.authInFlight = false;
    this.openResolvers.splice(0);
    this.authResolvers.splice(0);
    this.preAuthQueue = [];
    this.authedQueue = [];
    this.accountSubActive = false;
    this.messageHandlers = [];
    this.callbacks.clear();
    this.subscriptions.clear();
    this.pendingRiskSymbols.clear();
    if (this.riskDebounceTimer != null) {
      clearTimeout(this.riskDebounceTimer);
      this.riskDebounceTimer = null;
    }
  }

  // Public: chờ tới khi AUTHENTICATED (dùng được cho select)
  public async waitUntilAuthenticated() {
    if (this.state === 'authenticated') return;
    await this.waitForOpen();
    await this.waitForAuth();
  }

  // Public: gửi select rồi chờ 1 nhịp cho server “ghi” account
  public async selectAccountAndWait(id: number, settleMs = 160) {
    this.selectAccount(id);
    await new Promise(res => setTimeout(res, settleMs)); // khớp với flushAuthed (120ms)
  }

  // ========= Connect (idempotent) =========
  public connect(token: string, onMessage: (data: any) => void) {
    // Nếu đã có socket CONNECTING/OPEN: không tạo thêm
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
      if (!this.messageHandlers.includes(onMessage)) this.messageHandlers.push(onMessage);
      if (token) this.authenticate(token); // tự auth nếu chưa
      return;
    }

    this.state = 'connecting';
    const sock = new WebSocket(this.wsUrl);
    this.socket = sock;

    sock.onopen = () => {
      if (this.socket !== sock) return;
      this.state = 'open';
      console.log('✅ WebSocket connected');

      // Resolve những promise chờ OPEN
      this.openResolvers.splice(0).forEach(r => r());

      // Flush những job KHÔNG cần auth
      this.flushPreAuth();

      // Auth nếu có token
      if (token) this.authenticate(token);

      // Gắn handler global
      if (!this.messageHandlers.includes(onMessage)) this.messageHandlers.push(onMessage);

      // Khôi phục accountId từ localStorage (chỉ set state; gửi select sau khi authenticated)
      const saved = localStorage.getItem('selectedBinanceAccountId');
      if (saved !== null) {
        const parsed = Number(saved);
        if (!Number.isNaN(parsed)) this.setCurrentAccountId(parsed);
      }
    };

    sock.onmessage = (event) => {

      
      if (this.socket !== sock) return;
      console.log('📥 RAW WS MSG:', event.data);
      try {
        const data = JSON.parse(event.data);
     // --- FORWARD SNAPSHOT POSITIONS (no cache) ---
// 1) Backend trả về mảng thuần: [ { symbol, positionAmt, ... }, ... ]
if (Array.isArray(data) &&
    data.length &&
    data[0] &&
    typeof data[0].symbol === "string" &&
    data[0].positionAmt !== undefined) {
  console.log("📥 WS positions[] snapshot:", data);
  this.positionUpdateHandler?.(data);
  return;
}

// 2) Backend gói trong object có field positions
if (data && Array.isArray((data as any).positions)) {
  console.log("📥 WS positions snapshot (wrapped):", (data as any).positions);
  this.positionUpdateHandler?.((data as any).positions);
  return;
}

// 3) Một số BE trả theo type
if ((data?.type === "getPositions" || data?.type === "positions" || data?.type === "futuresPositions") &&
    Array.isArray((data as any).data)) {
  console.log("📥 WS positions snapshot (data):", (data as any).data);
  this.positionUpdateHandler?.((data as any).data);
  return;
}
     // Phản hồi adjustLeverage từ backend: { symbol, leverage, ... }
     // Nếu server trả về mảng orders (kết quả của getOpenOrders)
if (Array.isArray(data) && data[0]?.orderId && data[0]?.symbol && data[0]?.status) {
  console.log("📥 WS got openOrders array:", data);
  localStorage.setItem("openOrders", JSON.stringify(data));
  if (this.orderUpdateHandler) this.orderUpdateHandler(data);
  return;
}
if (data?.symbol && Number.isFinite(data?.leverage)) {
  this.setLeverageFor(data.symbol, data.leverage);
  this.messageHandlers.forEach(h => h({ type: 'leverageUpdate', symbol: data.symbol, leverage: data.leverage }));
  // không return, để các handler khác cũng nhận được gói gốc (nếu cần)
}

        console.log('📥 WS Parsed:', data);

        // Forward snapshot futures account để UI merge leverage/iw
if ((data?.type === 'getFuturesAccount' || data?.type === 'futuresAccount') && Array.isArray(data.positions)) {
  for (const r of data.positions) {
    const sym = String(r.symbol ?? r.s ?? "");
    if (!sym) continue;
    const lev = Number(r.leverage ?? r.l);
    if (Number.isFinite(lev) && lev > 0) this.setLeverageFor(sym, lev, 'futures'); // ✅
  }
  this.messageHandlers.forEach(h => h(data));
  return;
}


        // ⬅️ ADD: server không hỗ trợ getPositionRisk → chuyển sang fallback
if (data?.type === 'error' && data?.action === 'getPositionRisk') {
  this.noPositionRiskSupport = true;
  console.warn('[WS] getPositionRisk not supported → fallback to getFuturesAccount()');
  this.getFuturesAccount();   // kéo leverage/isolatedWallet qua đây
  return;                     // dừng xử lý message này
}


        // ===== AUTHENTICATED =====
        if (data?.type === 'authenticated') {
          this.state = 'authenticated';
          this.authInFlight = false;
          this.authResolvers.splice(0).forEach(r => r());
          this.flushAuthed();
          // ❌ Đừng auto select/subscribe ở đây
          // ❌ Đừng auto getPositions/getFuturesAccount ở đây
          return;
        }

        // ====== HANDLE getPositions (array) — RAW Position Risk ======
        if (Array.isArray(data) && data[0]?.symbol && data[0]?.positionAmt) {
  // ✅ nếu packet có leverage thì cache lại luôn
  try {
    for (const r of data) {
      const sym = String(r.symbol ?? "");
      const lev = Number(r.leverage ?? r.l);
      if (sym && Number.isFinite(lev) && lev > 0) this.setLeverageFor(sym, lev);
    }
  } catch {}

  if (this.positionUpdateHandler) this.positionUpdateHandler(data);

  try {
    const symbols = Array.from(new Set(data.map((p: any) => p.symbol))).filter(Boolean);
    if (symbols.length) {
      if (this.noPositionRiskSupport) this.getFuturesAccount();
      else this.requestPositionRisk(symbols);
    }
  } catch {}

  this.messageHandlers.forEach(h => h(data));
  return;
}


        // ====== MiniTicker (public) ======
        if (data.e === '24hrMiniTicker' || data.action === 'miniTickerUpdate') {
          const id = `miniTicker_${data.s || data.symbol}`;
          const cb = this.callbacks.get(id);
          if (cb) cb(data);
          else console.warn('⚠️ Không có callback cho miniTicker:', id);
          return;
        }

        // ====== MarkPrice Update (custom action) ======
        if (data.action === 'markPriceUpdate') {
          this.handleMarkPriceData(data);
          return;
        }

        // ====== ORDER UPDATE (futures) ======
        if (data.e === 'ORDER_TRADE_UPDATE' && data.o) {
  const o = data.o;
  const order = {
    orderId: o.i,
    symbol: o.s,
    side: o.S,
    type: o.o,
    price: o.p,
    origQty: o.q,
    executedQty: o.z ?? o.q ?? "0",
    status: o.X,

    stopPrice: o.sp,
    workingType: o.wt,
    time: o.T ?? data.T ?? Date.now(),
    updateTime: data.T ?? o.T ?? Date.now(),
  };

          let currentOrders: typeof order[] = JSON.parse(localStorage.getItem('openOrders') || '[]');

          // Tự huỷ TP/SL đối ứng khi một cái FILLED
          if (['TAKE_PROFIT_MARKET', 'STOP_MARKET'].includes(order.type) && order.status === 'FILLED') {
            const oppositeType = order.type === 'TAKE_PROFIT_MARKET' ? 'STOP_MARKET' : 'TAKE_PROFIT_MARKET';
            const opposite = currentOrders.find(
              (x) => x.symbol === order.symbol && x.type === oppositeType && x.status === 'NEW'
            );
            if (opposite) {
              console.log('🤖 Huỷ lệnh đối ứng TP/SL:', oppositeType, 'orderId:', opposite.orderId);
              this.sendAuthed({
                action: 'cancelOrder',
                symbol: order.symbol,
                orderId: opposite.orderId,
                market: 'futures',
              });
            }
          }

          // Cập nhật openOrders local
          if (['FILLED', 'CANCELED', 'REJECTED', 'EXPIRED'].includes(order.status)) {
            currentOrders = currentOrders.filter((x) => x.orderId !== order.orderId);
          } else {
            const idx = currentOrders.findIndex((x) => x.orderId === order.orderId);
            if (idx !== -1) currentOrders[idx] = order;
            else currentOrders.push(order);
          }

          console.log('📦 Final openOrders:', currentOrders);
          localStorage.setItem('openOrders', JSON.stringify(currentOrders));
          if (this.orderUpdateHandler) this.orderUpdateHandler(currentOrders);
          // Không return: để các handler khác vẫn nhận
        }

        // ====== ACCOUNT UPDATE (Spot/Futures) ======
if (data?.type === 'update' && data?.channel === 'account') {
  if (data.orders && this.orderUpdateHandler) {
    console.log('🟢 [WS] Gửi orders từ server về UI:', data.orders);
    localStorage.setItem('openOrders', JSON.stringify(data.orders));
    this.orderUpdateHandler(data.orders);
  }

  if (Array.isArray(data?.a?.P) && this.positionUpdateHandler) {
    const positions = data.a.P.map((p: any) => {
      const sym = String(p.s);
      const levFromPacket = Number(p.l);
      const lev = (Number.isFinite(levFromPacket) && levFromPacket > 0)
  ? levFromPacket
  : (this.getLeverage(p.s, 'futures') || undefined); // ✅ lấy từ cache nếu packet không có

    return {
        symbol: sym,
        positionAmt: p.pa,
        entryPrice: p.ep,
        breakEvenPrice: p.bep,
        marginType: (p.mt || '').toString().toLowerCase(),
        isolatedWallet: typeof p.iw === 'number' ? p.iw : undefined,
        positionSide: p.ps,
        leverage: lev, // ✅ enrich
        // markPrice đến từ kênh khác
      };
    });

    console.log("ACCOUNT_UPDATE ENRICH", positions.map(p => ({ s: p.symbol, lev: p.leverage })));

    this.positionUpdateHandler(positions);

    // Nếu còn thiếu lev ở bất kỳ position nào -> kéo snapshot để backfill
    try {
      const needBackfill = positions.some((x: any) => !(Number(x.leverage) > 0));
      if (needBackfill) this.getFuturesAccount();
    } catch (e) {
      console.warn('position backfill check err:', e);
    }
  }

  this.messageHandlers.forEach(h => h(data));
  return;
}


if (data.e === 'ACCOUNT_CONFIG_UPDATE' && data.ac) {
  const { s: symbol, l: leverage } = data.ac || {};
  if (symbol && Number.isFinite(leverage)) {
    this.setLeverageFor(symbol, leverage, 'futures'); // ✅
    this.messageHandlers.forEach(h => h({ type: 'leverageUpdate', symbol, leverage }));
  }
  return;
}


        // ====== Multi Assets Mode ======
        if (data.type === 'getMultiAssetsMode' || data.type === 'changeMultiAssetsMode') {
          console.log('📥 [WS] Nhận multiAssetsMode:', data);
          if (data.positions) {
            localStorage.setItem('positions', JSON.stringify(data.positions));
          }
          if (data.multiAssetsMargin !== undefined && this.currentAccountId) {
            localStorage.setItem(`multiAssetsMode_${this.currentAccountId}`, String(data.multiAssetsMargin));
          }
          this.messageHandlers.forEach(h => h(data));
          return;
        }

        // ====== POSITION RISK (backfill leverage/IM) ======
        if (data?.type === 'positionRisk' && Array.isArray(data.data)) {
          this.messageHandlers.forEach(h => h(data));
          return;
        }

        // ====== Forward còn lại ======
        this.messageHandlers.forEach(h => h(data));
      } catch (error) {
        console.error('❌ WS parse error:', error);
      }
    };

    sock.onerror = (event) => {
      console.error('❌ WebSocket error:', event);
    };

    sock.onclose = (event) => {
      console.warn('🔌 WebSocket closed:', event.reason || 'no reason');
      this.state = 'closed';
      // (tuỳ chọn) giữ queue để reconnect sau vẫn flush được
    };
  }

  // ========= Low-level senders =========
  private sendOpen(data: any) {
    if (!this.socket) {
      console.warn('⛔ WS null, queue preAuth:', data);
      this.preAuthQueue.push(data);
      return;
    }
    if (this.socket.readyState === WebSocket.OPEN && (this.state === 'open' || this.state === 'authenticated')) {
      console.log('📤 WS Sending (open):', data);
      this.socket.send(JSON.stringify(data));
    } else {
      console.warn('⛔ WS not open, queue preAuth:', data);
      this.preAuthQueue.push(data);
    }
  }

  private sendAuthed(data: any) {
    if (!this.socket || this.state !== 'authenticated' || this.socket.readyState !== WebSocket.OPEN) {
      if (data?.action === 'selectBinanceAccount') {
        // đưa lên đầu + khử trùng
        this.authedQueue = [data, ...this.authedQueue.filter(m => m.action !== 'selectBinanceAccount')];
      } else {
        this.authedQueue.push(data);
      }
      return;
    }
    console.log('📤 WS Sending (authed):', data);
    this.socket.send(JSON.stringify(data));
  }

  private flushPreAuth() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const q = this.preAuthQueue;
    this.preAuthQueue = [];
    q.forEach(msg => {
      try { this.socket!.send(JSON.stringify(msg)); }
      catch { this.preAuthQueue.push(msg); }
    });
  }

  private flushAuthed() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.state !== 'authenticated') return;

    const q = this.authedQueue;
    this.authedQueue = [];

    const selects = q.filter(m => m.action === 'selectBinanceAccount');
    const subs    = q.filter(m => m.action === 'subscribeAccountUpdates');
    const others  = q.filter(m => m.action !== 'selectBinanceAccount' && m.action !== 'subscribeAccountUpdates');

    const send = (m: any) => this.socket!.send(JSON.stringify(m));

    if (selects.length) {
      selects.forEach(send);
      // đợi server “ghi” xong account, rồi mới bắn phần còn lại
      setTimeout(() => {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.state !== 'authenticated') {
          this.authedQueue.push(...subs, ...others);
          return;
        }
        subs.forEach(send);
        others.forEach(send);
      }, 120);
    } else {
      // không có select thì flush bình thường
      [...subs, ...others].forEach(send);
    }
  }

  // ========= Auth & session =========
  public authenticate(token: string) {
    if (this.state === 'authenticated' || this.authInFlight) return;
    this.authInFlight = true;

    // chỉ gửi auth 1 lần
    this.sendOpen({ action: 'authenticate', token });

    // chỉ xếp hàng getMyBinanceAccounts 1 lần
    this.pushAuthedUnique('getMyBinanceAccounts', { action: 'getMyBinanceAccounts' });
    this.pushAuthedUnique('getFuturesAccount', { action: 'getFuturesAccount' });
  }

  public getMyBinanceAccounts() {
    this.sendAuthed({ action: 'getMyBinanceAccounts' });
  }

  public selectAccount(id: number) {
  console.log('⚙️ Selecting account with ID:', id);
  this.currentAccountId = id;
  localStorage.setItem('selectedBinanceAccountId', String(id));
  // ✅ nạp cache leverage từ local cho account này
  this.hydrateLeverageCacheFromLS('futures');
  this.sendAuthed({ action: 'selectBinanceAccount', binanceAccountId: id });
}

public getLeverage(symbol: string, market: MarketType = 'futures', fallback = 2): number {
  const sym = symbol.toUpperCase();
  const cache = this.symbolLeverage.get(sym);
  if (Number.isFinite(cache) && (cache as number) > 0) return cache as number;

  const fromLS = this.loadLeverageLS(sym, market);
  if (Number.isFinite(fromLS) && (fromLS as number) > 0) {
    // đồng bộ lại vào cache cho lần sau
    this.symbolLeverage.set(sym, fromLS as number);
    return fromLS as number;
  }
  return fallback;
}


  public getBalances(market: 'spot' | 'futures' | 'both') {
    console.log('🔎 Getting balances for market:', market);
    this.sendAuthed({ action: 'getBalances', market });
  }

  // ========= Accounts / Positions (wrappers sạch) =========
  public getPositions(binanceAccountId?: number) {
    const savedIdStr = localStorage.getItem('selectedBinanceAccountId');
    const savedId = savedIdStr !== null ? Number(savedIdStr) : undefined;
    const id: number | undefined = binanceAccountId ?? this.currentAccountId ?? savedId;
    if (!id) { console.warn('[WS] getPositions: missing binanceAccountId'); return; }
    this.sendAuthed({ action: 'getPositions', binanceAccountId: id });
  }

  public getFuturesAccount(id?: number) {
    const target = id ?? this.currentAccountId ?? Number(localStorage.getItem('selectedBinanceAccountId') || 0);
    if (!target) return console.warn('[WS] getFuturesAccount: missing binanceAccountId');
    this.sendAuthed({ action: 'getFuturesAccount', binanceAccountId: target });
  }

  public getSpotAccount(id?: number) {
    const target = id ?? this.currentAccountId ?? Number(localStorage.getItem('selectedBinanceAccountId') || 0);
    if (!target) return console.warn('[WS] getSpotAccount: missing binanceAccountId');
    this.sendAuthed({ action: 'getSpotAccount', binanceAccountId: target });
  }

  public getMultiAssetsMode(onResult?: (isMulti: boolean, raw: any) => void) {
    // gửi yêu cầu
    this.sendAuthed({ action: 'getMultiAssetsMode' });

    if (!onResult) return;

    // one-shot handler
    const once = (msg: any) => {
      if (msg?.type === 'getMultiAssetsMode') {
        const isMulti = !!msg.multiAssetsMargin;
        onResult(isMulti, msg);
        this.removeMessageHandler(once);
      }
    };
    this.onMessage(once);
  }

  // ========= Orders =========
  public placeOrder(payload: PlaceOrderPayload) {
    this.sendAuthed({ action: 'placeOrder', ...payload });
  }

  /** Lấy danh sách lệnh mở theo market (và optional symbol) */
  public getOpenOrders(market: 'spot' | 'futures', symbol?: string) {
    const payload: any = { action: 'getOpenOrders', market };
    if (symbol) payload.symbol = symbol;
    this.sendAuthed(payload);
  }

  /** Huỷ 1 lệnh theo orderId/symbol/market */
  public cancelOrder(symbol: string, orderId: number, market: 'spot' | 'futures') {
    const payload = { action: 'cancelOrder', symbol, orderId, market };
    console.log('🛑 Gửi yêu cầu huỷ lệnh:', payload);
    this.sendAuthed(payload);
  }

  public cancelAllOrders(symbol: string, market: 'spot' | 'futures') {
    const payload = { action: 'cancelAllOrders', symbol, market };
    console.log('🛑 Gửi yêu cầu huỷ tất cả lệnh:', payload);
    this.sendAuthed(payload);
  }

  private accountSubActive = false;

  // ========= Realtime account updates =========
  public subscribeAccountUpdates(onOrderUpdate: (orders: any[]) => void, types = ['orders', 'positions', 'balance']) {
    if (this.accountSubActive) return;
    this.accountSubActive = true;
    this.orderUpdateHandler = onOrderUpdate;
    this.sendAuthed({ action: 'subscribeAccountUpdates', types });
  }

  public unsubscribeAccountUpdates(types: string[] = []) {
    const payload = { action: 'unsubscribeAccountUpdates', types };
    console.log('🔕 Hủy đăng ký cập nhật real-time:', payload);
    this.sendAuthed(payload);
    this.accountSubActive = false;
  }

  public changeMultiAssetsMode(
    multiAssetsMargin: boolean,
    onSuccess?: (res: any) => void,
    onError?: (err: string) => void
  ) {
    const payload = { action: 'changeMultiAssetsMode', multiAssetsMargin };
    this.sendAuthed(payload);

    const tempHandler = (msg: any) => {
      if (msg?.msg === 'success' && typeof msg.multiAssetsMargin === 'boolean') {
        onSuccess?.(msg);
        this.removeMessageHandler(tempHandler);
      } else if (msg?.success === false && msg?.error) {
        onError?.(msg.error);
        this.removeMessageHandler(tempHandler);
      }
    };
    this.onMessage(tempHandler);
  }

  // ========= Public/Futures streams =========
  private handleMarkPriceData(data: any) {
    const subscriptionId = `markPrice_${data.symbol}_${data.market}`;
    console.log('Handle MarkPriceData for subscriptionId:', subscriptionId);
    const callback = this.callbacks.get(subscriptionId);
    if (callback) {
      console.log('Callback found, calling with data:', data);
      callback(data);
    } else {
      console.warn('No callback found for subscriptionId:', subscriptionId);
    }
  }

  public subscribeMarkPrice(symbol: string, market: MarketType = 'futures', callback?: (data: any) => void) {
    const subscriptionId = `markPrice_${symbol}_${market}`;
    const message = { action: 'subscribeMarkPrice', market, symbol };
    console.log('📤 Gửi subscribeMarkPrice:', message);

    if (callback) this.callbacks.set(subscriptionId, callback);
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: 'subscribeMarkPrice',
      symbol,
      market,
      timestamp: Date.now(),
    });

    // BE của bạn hình như yêu cầu auth → dùng authed
    this.sendAuthed(message);
    return subscriptionId;
  }

  public subscribePublicMiniTicker(symbol: string, callback: (data: any) => void) {
    const id = `miniTicker_${symbol}`;
    this.callbacks.set(id, callback);

    const message = { action: 'subscribePublicMiniTicker', symbol };
    console.log('📤 Gửi subscribePublicMiniTicker:', message);

    // Nếu thực sự public thì có thể sendOpen; hiện để authed cho chắc
    this.sendAuthed(message);
    return id;
  }
}

export const binanceWS = new BinanceWebSocketService();



//-=================================

// BinanceWebSocketService.ts
// Clean API: state machine + 2 queues (preAuth/authed), no generic send(), full wrappers

type MarketType = 'spot' | 'futures';
type WsState = 'closed' | 'connecting' | 'open' | 'authenticated';

// ==== Types for placing orders ====
export type WorkingType = 'MARK' | 'LAST';

export interface PlaceOrderPayload {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
  market: 'futures' | 'spot';

  // qty/price
  quantity: number;
  price?: number;     // LIMIT
  stopPrice?: number; // *_MARKET (TP/SL)

  // futures-only (optional)
  reduceOnly?: boolean;
  positionSide?: 'LONG' | 'SHORT' | 'BOTH';
  timeInForce?: 'GTC' | 'IOC' | 'FOK';

  // trigger theo Binance Futures
  workingType?: WorkingType; // 'MARK' | 'LAST'
}

class BinanceWebSocketService {
  private socket: WebSocket | null = null;
  private wsUrl = 'ws://45.77.33.141/w-binance-trading/signalr/connect';

  // ===== add fields =====
  private authInFlight = false;
  private authedOnceKeys = new Set<string>();
  private pushAuthedUnique(key: string, msg: any) {
    if (this.authedOnceKeys.has(key)) return;
    this.authedOnceKeys.add(key);
    this.authedQueue.push(msg);
  }
  private noPositionRiskSupport = true;

  // ===== State & queues =====
  private state: WsState = 'closed';
  private openResolvers: Array<() => void> = [];
  private authResolvers: Array<() => void> = [];
  private preAuthQueue: any[] = []; // gửi khi state >= 'open'
  private authedQueue: any[] = [];  // gửi khi state === 'authenticated'

  // ===== Handlers & caches =====
  private messageHandlers: ((data: any) => void)[] = [];
  private currentAccountId: number | null = null;
  private orderUpdateHandler: ((orders: any[]) => void) | null = null;
  private positionUpdateHandler: ((positions: any[]) => void) | null = null;

  // Subscriptions / callbacks
  private subscriptions: Map<string, any> = new Map();
  private callbacks: Map<string, (data: any) => void> = new Map();

  // RAM replay cho positions
  private lastPositions: any[] | null = null;

  // ==== coalesce risk requests ====
  private pendingRiskSymbols = new Set<string>();
  private riskDebounceTimer: number | null = null;

  // ---- cache leverage theo symbol ----
  private symbolLeverage = new Map<string, number>(); // ex: "DOGEUSDT" -> 10

  // ====== LocalStorage helpers cho Leverage ======
  private levKey(accountId: number | null | undefined, market: MarketType, symbol: string) {
    return `tw_leverage_${accountId ?? 'na'}_${market}_${symbol.toUpperCase()}`;
  }
// thêm trong class BinanceWebSocketService

private chooseAccountAndBoot(accounts: any[]) {
  if (!Array.isArray(accounts) || accounts.length === 0) return;

  // ưu tiên id đã lưu trong LS
  const saved = Number(localStorage.getItem('selectedBinanceAccountId') || 0);
  let target = Number.isFinite(saved) && saved > 0
    ? saved
    : Number(accounts[0]?.id || accounts[0]?.binanceAccountId || 0);

  if (!target) return;

  // select + boot
  this.selectAccount(target);
  setTimeout(() => {
    this.getFuturesAccount(target);
    this.getPositions(target);
  }, 160);
}

/** Dùng ở UI: đảm bảo đã có accountId để gọi API */
public ensureAccountSelected() {
  if (this.currentAccountId || Number(localStorage.getItem('selectedBinanceAccountId') || 0) > 0) {
    return; // đã có
  }
  // yêu cầu LIST account; khi về sẽ auto-select trong onmessage
  this.getMyBinanceAccounts();
}

  private saveLeverageLS(symbol: string, lev: number, market: MarketType = 'futures') {
    try {
      const key = this.levKey(this.currentAccountId, market, symbol);
      localStorage.setItem(key, String(lev));
    } catch {}
  }

  private hydrateLeverageCacheFromLS(market: MarketType = 'futures') {
    if (!this.currentAccountId) return;
    const prefix = `tw_leverage_${this.currentAccountId}_${market}_`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const sym = k.slice(prefix.length).toUpperCase();
      const v = localStorage.getItem(k);
      const n = v ? Number(v) : NaN;
      if (sym && Number.isFinite(n) && n > 0) {
        this.symbolLeverage.set(sym, n);
      }
    }
  }

  private loadLeverageLS(symbol: string, market: MarketType = 'futures'): number | undefined {
    try {
      const key = this.levKey(this.currentAccountId, market, symbol);
      const v = localStorage.getItem(key);
      const n = v ? Number(v) : NaN;
      return Number.isFinite(n) && n > 0 ? n : undefined;
    } catch {
      return undefined;
    }
  }

  private setLeverageFor(symbol: string, lev: any, market: MarketType = 'futures') {
    const n = Number(lev);
    if (Number.isFinite(n) && n > 0) {
      const sym = symbol.toUpperCase();
      this.symbolLeverage.set(sym, n);
      this.saveLeverageLS(sym, n, market);   // persist
      console.log("LEV CACHE SET ✅", sym, n);
    }
  }

  // ===== add near other private fields =====
private lastAccountInfoEmit: number = 0;
private refreshTimer: any = null;

// Chuẩn hoá phát event account info
private emitAccountInformation(payload: {
  availableBalance?: number;
  totalWalletBalance?: number;
  totalMarginBalance?: number;
  totalUnrealizedProfit?: number;
  multiAssetsMargin?: boolean;
  source: 'ws-live' | 'snapshot' | 'database-cache';
}) {
  // làm sạch về number
  const toNum = (v: any) => (typeof v === 'string' ? parseFloat(v) : Number(v ?? 0));
  const info = {
    availableBalance: toNum(payload.availableBalance),
    totalWalletBalance: toNum(payload.totalWalletBalance),
    totalMarginBalance: toNum(payload.totalMarginBalance),
    totalUnrealizedProfit: toNum(payload.totalUnrealizedProfit),
    multiAssetsMargin: !!payload.multiAssetsMargin,
    source: payload.source,
  };
  this.lastAccountInfoEmit = Date.now();
  this.messageHandlers.forEach(h => h({ type: 'accountInformation', data: info }));
}

// Debounce refresh snapshot (hạn chế spam)
private scheduleAccountRefresh(ms = 350) {
  if (this.refreshTimer) {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }
  this.refreshTimer = setTimeout(() => {
    this.getFuturesAccount();
  }, ms);
}

public getAccountInformation() {
  // Server của bạn đã có getFuturesAccount → dùng làm nguồn account info
  this.getFuturesAccount();
}



  // ========= Helpers =========
  private waitForOpen(): Promise<void> {
    if (this.state === 'open' || this.state === 'authenticated') return Promise.resolve();
    return new Promise(res => this.openResolvers.push(res));
  }
  private waitForAuth(): Promise<void> {
    if (this.state === 'authenticated') return Promise.resolve();
    return new Promise(res => this.authResolvers.push(res));
  }

  // === Position Risk (backfill leverage/IM) ===
  public requestPositionRisk(_symbols?: string[]) {
    this.getFuturesAccount(); // fallback: kéo leverage/iw qua snapshot
  }

  // (không dùng)
  private _sendGetPositionRisk(_symbols?: string[]) { /* no-op */ }

  public setCurrentAccountId(id: number) {
    this.currentAccountId = id;
  }
  public getCurrentAccountId(): number | null {
    return this.currentAccountId;
  }

  public setPositionUpdateHandler(handler: (positions: any[]) => void) {
    this.positionUpdateHandler = handler;
    if (this.lastPositions) {
      try { handler(this.lastPositions); } catch {}
    }
  }

  public setOrderUpdateHandler(handler: ((orders: any[]) => void) | null) {
    this.orderUpdateHandler = handler;
  }

  public onMessage(handler: (data: any) => void) {
    this.messageHandlers.push(handler);
  }
  public removeMessageHandler(handler: (data: any) => void) {
    this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
  }

  public isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  // changeposition
  public changePositionMode(dualSidePosition: boolean, onDone?: (ok: boolean, raw: any) => void) {
    this.sendAuthed({ action: 'changePositionMode', dualSidePosition });

    if (!onDone) return;
    const once = (m: any) => {
      if (m?.type === 'changePositionMode' && typeof m.dualSidePosition === 'boolean') {
        onDone(true, m);
        this.removeMessageHandler(once);
      } else if (m?.success === false && m?.error) {
        onDone(false, m);
        this.removeMessageHandler(once);
      }
    };
    this.onMessage(once);
  }

  public getPositionMode(onResult?: (dual: boolean) => void) {
    this.sendAuthed({ action: 'getPositionMode' });
    if (!onResult) return;
    const once = (m: any) => {
      if (m?.type === 'getPositionMode' && typeof m.dualSidePosition === 'boolean') {
        onResult(m.dualSidePosition);
        this.removeMessageHandler(once);
      }
    };
    this.onMessage(once);
  }

  // Public: đóng WS + dọn state
  public disconnect(reason?: string) {
    try { this.socket?.close(1000, reason || 'client disconnect'); } catch {}
    this.socket = null;
    this.state = 'closed';
    this.authInFlight = false;
    this.openResolvers.splice(0);
    this.authResolvers.splice(0);
    this.preAuthQueue = [];
    this.authedQueue = [];
    this.accountSubActive = false;
    this.messageHandlers = [];
    this.callbacks.clear();
    this.subscriptions.clear();
    this.pendingRiskSymbols.clear();
    if (this.riskDebounceTimer != null) {
      clearTimeout(this.riskDebounceTimer);
      this.riskDebounceTimer = null;
    }
  }

  // Public: chờ tới khi AUTHENTICATED
  public async waitUntilAuthenticated() {
    if (this.state === 'authenticated') return;
    await this.waitForOpen();
    await this.waitForAuth();
  }

  // Public: gửi select rồi chờ 1 nhịp cho server “ghi” account
  public async selectAccountAndWait(id: number, settleMs = 160) {
    this.selectAccount(id);
    await new Promise(res => setTimeout(res, settleMs)); // khớp flushAuthed (120ms)
  }

  // ========= Connect (idempotent) =========
  public connect(token: string, onMessage: (data: any) => void) {
    // Nếu đã có socket CONNECTING/OPEN: không tạo thêm
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
      if (!this.messageHandlers.includes(onMessage)) this.messageHandlers.push(onMessage);
      if (token) this.authenticate(token); // tự auth nếu chưa
      return;
    }

    this.state = 'connecting';
    const sock = new WebSocket(this.wsUrl);
    this.socket = sock;

    sock.onopen = () => {
      if (this.socket !== sock) return;
      this.state = 'open';
      console.log('✅ WebSocket connected');

      // Resolve những promise chờ OPEN
      this.openResolvers.splice(0).forEach(r => r());

      // Flush những job KHÔNG cần auth
      this.flushPreAuth();

      // Auth nếu có token
      if (token) this.authenticate(token);

      // Gắn handler global
      if (!this.messageHandlers.includes(onMessage)) this.messageHandlers.push(onMessage);

      // Khôi phục accountId từ localStorage (chỉ set state; sẽ select sau khi authenticated)
      const saved = localStorage.getItem('selectedBinanceAccountId');
      if (saved !== null) {
        const parsed = Number(saved);
        if (!Number.isNaN(parsed)) this.setCurrentAccountId(parsed);
      }
    };

    sock.onmessage = (event) => {
      if (this.socket !== sock) return;
      console.log('📥 RAW WS MSG:', event.data);
      try {
        const data = JSON.parse(event.data);

        // ---- EARLY: nếu gói WS có top-level availableBalance (định dạng giống bạn paste) ----
if (
  (typeof (data as any)?.availableBalance === 'string' || typeof (data as any)?.availableBalance === 'number') &&
  // kèm vài dấu hiệu là "tài khoản futures"
  ((data as any)?.multiAssetsMargin !== undefined ||
   (data as any)?.totalWalletBalance !== undefined ||
   (data as any)?.assets !== undefined)
) {
  this.emitAccountInformation({
    availableBalance: (data as any).availableBalance,
    totalWalletBalance: (data as any).totalWalletBalance,
    totalMarginBalance: (data as any).totalMarginBalance,
    totalUnrealizedProfit: (data as any).totalUnrealizedProfit,
    multiAssetsMargin: !!(data as any).multiAssetsMargin,
    source: 'ws-live',
  });
  // không return; để các handler khác vẫn nhận được gói gốc nếu cần
}


        // --- FORWARD SNAPSHOT POSITIONS (no cache) ---
        // 1) Mảng thuần
        if (Array.isArray(data) && data[0]?.symbol && data[0]?.positionAmt !== undefined) {
          console.log("📥 WS positions[] snapshot:", data);
          this.lastPositions = data;
          this.positionUpdateHandler?.(data);
          return;
        }
        // 2) Bọc trong object.positions
        if (data && Array.isArray((data as any).positions)) {
          const arr = (data as any).positions;
          console.log("📥 WS positions snapshot (wrapped):", arr);
          this.lastPositions = arr;
          this.positionUpdateHandler?.(arr);
          return;
        }
        // 3) Bọc trong object.data
        if (
          (data?.type === "getPositions" || data?.type === "positions" || data?.type === "futuresPositions") &&
          Array.isArray((data as any).data)
        ) {
          const arr = (data as any).data;
          console.log("📥 WS positions snapshot (data):", arr);
          this.lastPositions = arr;
          this.positionUpdateHandler?.(arr);
          return;
        }

        // Nếu server trả mảng orders (kết quả của getOpenOrders)
        if (Array.isArray(data) && data[0]?.orderId && data[0]?.symbol && data[0]?.status) {
          console.log("📥 WS got openOrders array:", data);
          localStorage.setItem("openOrders", JSON.stringify(data));
          if (this.orderUpdateHandler) this.orderUpdateHandler(data);
          return;
        }

        // Phản hồi leverage đơn
        if (data?.symbol && Number.isFinite(data?.leverage)) {
          this.setLeverageFor(data.symbol, data.leverage);
          this.messageHandlers.forEach(h => h({ type: 'leverageUpdate', symbol: data.symbol, leverage: data.leverage }));
          // không return; để các handler khác cũng nhận gói gốc nếu cần
        }

        console.log('📥 WS Parsed:', data);

        // Forward snapshot futures account để UI merge leverage/iw
        if ((data?.type === 'getFuturesAccount' || data?.type === 'futuresAccount')) {
  // 4.1 backfill leverage nếu có positions
  if (Array.isArray(data.positions)) {
    for (const r of data.positions) {
      const sym = String(r.symbol ?? r.s ?? "");
      if (!sym) continue;
      const lev = Number(r.leverage ?? r.l);
      if (Number.isFinite(lev) && lev > 0) this.setLeverageFor(sym, lev, 'futures');
    }
  }

  // 4.2 phát accountInformation (source: snapshot)
  this.emitAccountInformation({
    availableBalance: (data as any).availableBalance,
    totalWalletBalance: (data as any).totalWalletBalance,
    totalMarginBalance: (data as any).totalMarginBalance,
    totalUnrealizedProfit: (data as any).totalUnrealizedProfit,
    multiAssetsMargin: !!(data as any).multiAssetsMargin,
    source: 'snapshot',
  });

  this.messageHandlers.forEach(h => h(data));
  return;
}


        // server không hỗ trợ getPositionRisk → fallback
        if (data?.type === 'error' && data?.action === 'getPositionRisk') {
          this.noPositionRiskSupport = true;
          console.warn('[WS] getPositionRisk not supported → fallback to getFuturesAccount()');
          this.getFuturesAccount();
          return;
        }
// Auto-select account khi có danh sách
if (data?.type === 'getMyBinanceAccounts' && Array.isArray(data.accounts)) {
  this.chooseAccountAndBoot(data.accounts);
  // forward nếu UI có cần
  this.messageHandlers.forEach(h => h(data));
  return;
}
        // ===== AUTHENTICATED =====
        if (data?.type === 'authenticated') {
          this.state = 'authenticated';
          this.authInFlight = false;
          this.authResolvers.splice(0).forEach(r => r());
          this.flushAuthed();

          // 🔁 Auto boot: select account (nếu có) rồi kéo snapshot
          let targetId = this.currentAccountId;
          if (!targetId) {
            const saved = Number(localStorage.getItem('selectedBinanceAccountId') || 0);
            targetId = Number.isFinite(saved) && saved > 0 ? saved : null;
            if (targetId) this.currentAccountId = targetId;
          }
          if (targetId) {
            // đưa select lên đầu hàng đợi nếu chưa có
            this.sendAuthed({ action: 'selectBinanceAccount', binanceAccountId: targetId });
            setTimeout(() => {
              this.getFuturesAccount(targetId!);
              this.getPositions(targetId!);
            }, 160);
          }
          return;
        }

        // ====== HANDLE getPositions (array) — RAW Position Risk ======
        if (Array.isArray(data) && data[0]?.symbol && data[0]?.positionAmt) {
          try {
            for (const r of data) {
              const sym = String(r.symbol ?? "");
              const lev = Number(r.leverage ?? r.l);
              if (sym && Number.isFinite(lev) && lev > 0) this.setLeverageFor(sym, lev);
            }
          } catch {}

          this.lastPositions = data;
          if (this.positionUpdateHandler) this.positionUpdateHandler(data);

          try {
            const symbols = Array.from(new Set(data.map((p: any) => p.symbol))).filter(Boolean);
            if (symbols.length) {
              if (this.noPositionRiskSupport) this.getFuturesAccount();
              else this.requestPositionRisk(symbols);
            }
          } catch {}

          this.messageHandlers.forEach(h => h(data));
          return;
        }

        // ====== MiniTicker (public) ======
        if (data.e === '24hrMiniTicker' || data.action === 'miniTickerUpdate') {
          const id = `miniTicker_${data.s || data.symbol}`;
          const cb = this.callbacks.get(id);
          if (cb) cb(data);
          else console.warn('⚠️ Không có callback cho miniTicker:', id);
          return;
        }

        // ====== MarkPrice Update (custom action) ======
        if (data.action === 'markPriceUpdate') {
          this.handleMarkPriceData(data);
          return;
        }

        // === Single order object (ACK / PARTIALLY_FILLED / FILLED / CANCELED …)
if (data?.orderId && data?.symbol && typeof data?.status === 'string') {
  const order = {
    orderId: data.orderId,
    symbol:  data.symbol,
    side:    data.side,
    type:    data.type,
    price:   data.price,
    origQty: data.quantity,
    executedQty: data.executedQty ?? data.quantity ?? "0",
    status:  data.status,
    stopPrice: data.stopPrice,
    workingType: data.workingType || data.wt,
    time: data.time ?? data.T ?? Date.now(),
    updateTime: data.updateTime ?? data.T ?? Date.now(),
  };

  let current: typeof order[] = JSON.parse(localStorage.getItem('openOrders') || '[]');
  if (['FILLED','CANCELED','REJECTED','EXPIRED'].includes(order.status)) {
    current = current.filter(x => x.orderId !== order.orderId);
  } else {
    const i = current.findIndex(x => x.orderId === order.orderId);
    if (i !== -1) current[i] = order; else current.push(order);
  }
  localStorage.setItem('openOrders', JSON.stringify(current));
  if (this.orderUpdateHandler) this.orderUpdateHandler(current);

  // Nếu lệnh đã FILLED → chủ động refresh
if (order.status === 'FILLED' || order.status === 'PARTIALLY_FILLED') {
  this.scheduleAccountRefresh(200);   // account
  setTimeout(() => this.getPositions(), 200); // positions
}

  // TP/SL FILLED → huỷ lệnh đối ứng (nếu còn NEW)
  if (['TAKE_PROFIT_MARKET','STOP_MARKET'].includes(order.type) && order.status === 'FILLED') {
    const oppType = order.type === 'TAKE_PROFIT_MARKET' ? 'STOP_MARKET' : 'TAKE_PROFIT_MARKET';
    const opp = current.find(x => x.symbol === order.symbol && x.type === oppType && x.status === 'NEW');
    if (opp) this.sendAuthed({ action:'cancelOrder', symbol: order.symbol, orderId: opp.orderId, market:'futures' });
  }

  this.messageHandlers.forEach(h => h({ type:'orderUpdate', data: order }));
  return;
}


        // ====== ORDER UPDATE (futures) ======
        if (data.e === 'ORDER_TRADE_UPDATE' && data.o) {
          this.scheduleAccountRefresh(350);

          const o = data.o;
          const order = {
            orderId: o.i,
            symbol: o.s,
            side: o.S,
            type: o.o,
            price: o.p,
            origQty: o.q,
            executedQty: o.z ?? o.q ?? "0",
            status: o.X,
            stopPrice: o.sp,
            workingType: o.wt,
            time: o.T ?? data.T ?? Date.now(),
            updateTime: data.T ?? o.T ?? Date.now(),
          };

          let currentOrders: typeof order[] = JSON.parse(localStorage.getItem('openOrders') || '[]');

          // Tự huỷ TP/SL đối ứng khi một cái FILLED
          if (['TAKE_PROFIT_MARKET', 'STOP_MARKET'].includes(order.type) && order.status === 'FILLED') {
            const oppositeType = order.type === 'TAKE_PROFIT_MARKET' ? 'STOP_MARKET' : 'TAKE_PROFIT_MARKET';
            const opposite = currentOrders.find(
              (x) => x.symbol === order.symbol && x.type === oppositeType && x.status === 'NEW'
            );
            if (opposite) {
              console.log('🤖 Huỷ lệnh đối ứng TP/SL:', oppositeType, 'orderId:', opposite.orderId);
              this.sendAuthed({
                action: 'cancelOrder',
                symbol: order.symbol,
                orderId: opposite.orderId,
                market: 'futures',
              });
            }
          }

          // Cập nhật openOrders local
          if (['FILLED', 'CANCELED', 'REJECTED', 'EXPIRED'].includes(order.status)) {
            currentOrders = currentOrders.filter((x) => x.orderId !== order.orderId);
          }
           else {
            const idx = currentOrders.findIndex((x) => x.orderId === order.orderId);
            if (idx !== -1) currentOrders[idx] = order;
            else currentOrders.push(order);
          }

          console.log('📦 Final openOrders:', currentOrders);
          localStorage.setItem('openOrders', JSON.stringify(currentOrders));
          if (this.orderUpdateHandler) this.orderUpdateHandler(currentOrders);
          // không return
        }

        // ====== ACCOUNT UPDATE (Spot/Futures) ======
        // ====== REALTIME UPDATE (theo kênh sub: balance/positions/orders) ======
if (data?.type === 'update' && ['account','positions','orders','balance'].includes(data?.channel)) {
  // Balance (nếu packet có số cụ thể)
  if (data.availableBalance !== undefined || data.totalWalletBalance !== undefined) {
    this.emitAccountInformation({
      availableBalance: data.availableBalance,
      totalWalletBalance: data.totalWalletBalance,
      totalMarginBalance: data.totalMarginBalance,
      totalUnrealizedProfit: data.totalUnrealizedProfit,
      multiAssetsMargin: data.multiAssetsMargin,
      source: 'ws-live',
    });
  } else {
    this.scheduleAccountRefresh(350);
  }

  // Orders (nếu BE nhét vào data.orders)
  if (Array.isArray(data.orders) && this.orderUpdateHandler) {
    localStorage.setItem('openOrders', JSON.stringify(data.orders));
    this.orderUpdateHandler(data.orders);
  }

  // Positions – bắt đủ 3 format phổ biến
  if (this.positionUpdateHandler) {
    if (Array.isArray(data?.a?.P)) {
      const positions = data.a.P.map((p: any) => {
        const levPkt = Number(p.l);
        const lev = (Number.isFinite(levPkt) && levPkt > 0) ? levPkt : (this.getLeverage(p.s,'futures') || undefined);
        return {
          symbol: String(p.s),
          positionAmt: p.pa,
          entryPrice: p.ep,
          breakEvenPrice: p.bep,
          marginType: (p.mt || '').toString().toLowerCase(),
          isolatedWallet: typeof p.iw === 'number' ? p.iw : undefined,
          positionSide: p.ps,
          leverage: lev,
        };
      });
      this.lastPositions = positions;
      this.positionUpdateHandler(positions);
    } else if (Array.isArray(data.positions)) {
      this.lastPositions = data.positions;
      this.positionUpdateHandler(data.positions);
    } else if (Array.isArray(data.data?.positions)) {
      this.lastPositions = data.data.positions;
      this.positionUpdateHandler(data.data.positions);
    }
  }

  this.messageHandlers.forEach(h => h(data));
  return;
}

        

        if (data.e === 'ACCOUNT_CONFIG_UPDATE' && data.ac) {
          const { s: symbol, l: leverage } = data.ac || {};
          if (symbol && Number.isFinite(leverage)) {
            this.setLeverageFor(symbol, leverage, 'futures');
            this.messageHandlers.forEach(h => h({ type: 'leverageUpdate', symbol, leverage }));
          }
          return;
        }

        // ====== Multi Assets Mode ======
        if (data.type === 'getMultiAssetsMode' || data.type === 'changeMultiAssetsMode') {
          console.log('📥 [WS] Nhận multiAssetsMode:', data);
          // ❌ Không lưu positions vào localStorage để tránh “bóng ma”
          if (data.multiAssetsMargin !== undefined && this.currentAccountId) {
            localStorage.setItem(`multiAssetsMode_${this.currentAccountId}`, String(data.multiAssetsMargin));
          }
          this.messageHandlers.forEach(h => h(data));
          return;
        }

        // ====== POSITION RISK (backfill leverage/IM) ======
        if (data?.type === 'positionRisk' && Array.isArray(data.data)) {
          this.messageHandlers.forEach(h => h(data));
          return;
        }

        // ====== Forward còn lại ======
        this.messageHandlers.forEach(h => h(data));
      } catch (error) {
        console.error('❌ WS parse error:', error);
      }
    };

    sock.onerror = (event) => {
      console.error('❌ WebSocket error:', event);
    };

    sock.onclose = (event) => {
      console.warn('🔌 WebSocket closed:', event.reason || 'no reason');
      this.state = 'closed';
      // (tuỳ chọn) giữ queue để reconnect sau vẫn flush được
    };
  }

  // ========= Low-level senders =========
  private sendOpen(data: any) {
    if (!this.socket) {
      console.warn('⛔ WS null, queue preAuth:', data);
      this.preAuthQueue.push(data);
      return;
    }
    if (this.socket.readyState === WebSocket.OPEN && (this.state === 'open' || this.state === 'authenticated')) {
      console.log('📤 WS Sending (open):', data);
      this.socket.send(JSON.stringify(data));
    } else {
      console.warn('⛔ WS not open, queue preAuth:', data);
      this.preAuthQueue.push(data);
    }
  }

  private sendAuthed(data: any) {
    if (!this.socket || this.state !== 'authenticated' || this.socket.readyState !== WebSocket.OPEN) {
      if (data?.action === 'selectBinanceAccount') {
        this.authedQueue = [data, ...this.authedQueue.filter(m => m.action !== 'selectBinanceAccount')];
      } else {
        this.authedQueue.push(data);
      }
      return;
    }
    console.log('📤 WS Sending (authed):', data);
    this.socket.send(JSON.stringify(data));
  }

  private flushPreAuth() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const q = this.preAuthQueue;
    this.preAuthQueue = [];
    q.forEach(msg => {
      try { this.socket!.send(JSON.stringify(msg)); }
      catch { this.preAuthQueue.push(msg); }
    });
  }

  private flushAuthed() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.state !== 'authenticated') return;

    const q = this.authedQueue;
    this.authedQueue = [];

    const selects = q.filter(m => m.action === 'selectBinanceAccount');
    const subs    = q.filter(m => m.action === 'subscribeAccountUpdates');
    const others  = q.filter(m => m.action !== 'selectBinanceAccount' && m.action !== 'subscribeAccountUpdates');

    const send = (m: any) => this.socket!.send(JSON.stringify(m));

    if (selects.length) {
      selects.forEach(send);
      setTimeout(() => {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.state !== 'authenticated') {
          this.authedQueue.push(...subs, ...others);
          return;
        }
        subs.forEach(send);
        others.forEach(send);
      }, 120);
    } else {
      [...subs, ...others].forEach(send);
    }
  }

  // ========= Auth & session =========
  public authenticate(token: string) {
    if (this.state === 'authenticated' || this.authInFlight) return;
    this.authInFlight = true;

    // chỉ gửi auth 1 lần
    this.sendOpen({ action: 'authenticate', token });

    // chỉ xếp hàng 1 lần
    this.pushAuthedUnique('getMyBinanceAccounts', { action: 'getMyBinanceAccounts' });
    this.pushAuthedUnique('getFuturesAccount', { action: 'getFuturesAccount' });
  }

  public getMyBinanceAccounts() {
    this.sendAuthed({ action: 'getMyBinanceAccounts' });
  }

  public selectAccount(id: number) {
    console.log('⚙️ Selecting account with ID:', id);
    this.currentAccountId = id;
    localStorage.setItem('selectedBinanceAccountId', String(id));
    // nạp cache leverage từ local cho account này
    this.hydrateLeverageCacheFromLS('futures');
    this.sendAuthed({ action: 'selectBinanceAccount', binanceAccountId: id });
  }

  public getLeverage(symbol: string, market: MarketType = 'futures', fallback = 2): number {
    const sym = symbol.toUpperCase();
    const cache = this.symbolLeverage.get(sym);
    if (Number.isFinite(cache) && (cache as number) > 0) return cache as number;

    const fromLS = this.loadLeverageLS(sym, market);
    if (Number.isFinite(fromLS) && (fromLS as number) > 0) {
      this.symbolLeverage.set(sym, fromLS as number);
      return fromLS as number;
    }
    return fallback;
  }

  public getBalances(market: 'spot' | 'futures' | 'both') {
    console.log('🔎 Getting balances for market:', market);
    this.sendAuthed({ action: 'getBalances', market });
  }

  // ========= Accounts / Positions (wrappers sạch) =========
  public getPositions(binanceAccountId?: number) {
    const savedIdStr = localStorage.getItem('selectedBinanceAccountId');
    const savedId = savedIdStr !== null ? Number(savedIdStr) : undefined;
    const id: number | undefined = binanceAccountId ?? this.currentAccountId ?? savedId;
    if (!id) { console.warn('[WS] getPositions: missing binanceAccountId'); return; }
    this.sendAuthed({ action: 'getPositions', binanceAccountId: id });
  }

  public getFuturesAccount(id?: number) {
    const target = id ?? this.currentAccountId ?? Number(localStorage.getItem('selectedBinanceAccountId') || 0);
    if (!target) return console.warn('[WS] getFuturesAccount: missing binanceAccountId');
    this.sendAuthed({ action: 'getFuturesAccount', binanceAccountId: target });
  }

  public getSpotAccount(id?: number) {
    const target = id ?? this.currentAccountId ?? Number(localStorage.getItem('selectedBinanceAccountId') || 0);
    if (!target) return console.warn('[WS] getSpotAccount: missing binanceAccountId');
    this.sendAuthed({ action: 'getSpotAccount', binanceAccountId: target });
  }

  public getMultiAssetsMode(onResult?: (isMulti: boolean, raw: any) => void) {
    this.sendAuthed({ action: 'getMultiAssetsMode' });
    if (!onResult) return;

    const once = (msg: any) => {
      if (msg?.type === 'getMultiAssetsMode') {
        const isMulti = !!msg.multiAssetsMargin;
        onResult(isMulti, msg);
        this.removeMessageHandler(once);
      }
    };
    this.onMessage(once);
  }

  // ========= Orders =========
  public placeOrder(payload: PlaceOrderPayload) {
  this.sendAuthed({ action: 'placeOrder', ...payload });

  // Nếu server chưa đẩy ORDER_TRADE_UPDATE, ta chủ động refresh vài nhịp
  const retries = [400, 1200, 2500];
  retries.forEach(ms => {
    setTimeout(() => {
      this.getPositions();
      this.getFuturesAccount();
    }, ms);
  });
}

  public getOpenOrders(market: 'spot' | 'futures', symbol?: string) {
    const payload: any = { action: 'getOpenOrders', market };
    if (symbol) payload.symbol = symbol;
    this.sendAuthed(payload);
  }

  public cancelOrder(symbol: string, orderId: number, market: 'spot' | 'futures') {
    const payload = { action: 'cancelOrder', symbol, orderId, market };
    console.log('🛑 Gửi yêu cầu huỷ lệnh:', payload);
    this.sendAuthed(payload);
  }

  public cancelAllOrders(symbol: string, market: 'spot' | 'futures') {
    const payload = { action: 'cancelAllOrders', symbol, market };
    console.log('🛑 Gửi yêu cầu huỷ tất cả lệnh:', payload);
    this.sendAuthed(payload);
  }

  private accountSubActive = false;

  // ========= Realtime account updates =========
  public subscribeAccountUpdates(onOrderUpdate: (orders: any[]) => void, types = ['orders', 'positions', 'balance']) {
    if (this.accountSubActive) return;
    this.accountSubActive = true;
    this.orderUpdateHandler = onOrderUpdate;
    this.sendAuthed({ action: 'subscribeAccountUpdates', types });
  }

  public unsubscribeAccountUpdates(types: string[] = []) {
    const payload = { action: 'unsubscribeAccountUpdates', types };
    console.log('🔕 Hủy đăng ký cập nhật real-time:', payload);
    this.sendAuthed(payload);
    this.accountSubActive = false;
  }

  public changeMultiAssetsMode(
    multiAssetsMargin: boolean,
    onSuccess?: (res: any) => void,
    onError?: (err: string) => void
  ) {
    const payload = { action: 'changeMultiAssetsMode', multiAssetsMargin };
    this.sendAuthed(payload);

    const tempHandler = (msg: any) => {
      if (msg?.msg === 'success' && typeof msg.multiAssetsMargin === 'boolean') {
        onSuccess?.(msg);
        this.removeMessageHandler(tempHandler);
      } else if (msg?.success === false && msg?.error) {
        onError?.(msg.error);
        this.removeMessageHandler(tempHandler);
      }
    };
    this.onMessage(tempHandler);
  }

  // ========= Public/Futures streams =========
  private handleMarkPriceData(data: any) {
    const subscriptionId = `markPrice_${data.symbol}_${data.market}`;
    console.log('Handle MarkPriceData for subscriptionId:', subscriptionId);
    const callback = this.callbacks.get(subscriptionId);
    if (callback) {
      console.log('Callback found, calling with data:', data);
      callback(data);
    } else {
      console.warn('No callback found for subscriptionId:', subscriptionId);
    }
  }

  public subscribeMarkPrice(symbol: string, market: MarketType = 'futures', callback?: (data: any) => void) {
    const subscriptionId = `markPrice_${symbol}_${market}`;
    const message = { action: 'subscribeMarkPrice', market, symbol };
    console.log('📤 Gửi subscribeMarkPrice:', message);

    if (callback) this.callbacks.set(subscriptionId, callback);
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: 'subscribeMarkPrice',
      symbol,
      market,
      timestamp: Date.now(),
    });

    this.sendAuthed(message);
    return subscriptionId;
  }

  public subscribePublicMiniTicker(symbol: string, callback: (data: any) => void) {
    const id = `miniTicker_${symbol}`;
    this.callbacks.set(id, callback);

    const message = { action: 'subscribePublicMiniTicker', symbol };
    console.log('📤 Gửi subscribePublicMiniTicker:', message);

    this.sendAuthed(message);
    return id;
  }
}

export const binanceWS = new BinanceWebSocketService();

