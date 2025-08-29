import React, { useEffect, useState } from "react";
import { binancePublicWS } from "../binancewebsocket/binancePublicWS";
import { binanceWS } from "../binancewebsocket/BinanceWebSocketService";
import PopupPosition from "../popupposition/PopupPosition";
import { PositionData,FloatingInfo } from "../../utils/types";

interface PositionProps {
  positions?: PositionData[];
  market?: "spot" | "futures";
  onPositionCountChange?: (n: number) => void;
  onFloatingInfoChange?: (info: {
    symbol: string;
    pnl: number;
    roi: number;
    price: number;       // mark price hiện tại
    positionAmt: number; // để xác định LONG/SHORT
  } | null) => void;
}

const Position: React.FC<PositionProps> = ({
  positions: externalPositions,
  market,
  onPositionCountChange,
  onFloatingInfoChange,
}) => {
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [closePrice, setClosePrice] = useState("");
  const [closeQuantity, setCloseQuantity] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [targetTP, setTargetTP] = useState("");
  const [targetSL, setTargetSL] = useState("");
  const [currentPnl, setCurrentPnl] = useState(0); // => tính tổng từ all positions

  const symbolStepMap: Record<string, number> = {
  // ví dụ: "DOGEUSDT": 1, "BTCUSDT": 0.001
};
const getStepSize = (symbol: string) => symbolStepMap[symbol] ?? 0.001;
const roundToStep = (qty: number, step: number) => {
  if (step <= 0) return qty;
  const precision = Math.max(0, (step.toString().split('.')[1] || '').length);
  // floor để không vượt khối lượng vị thế
  return Number((Math.floor(qty / step) * step).toFixed(precision));
};

useEffect(() => {
  // chọn vị thế theo symbol đang hiển thị (tuỳ bạn lấy selectedSymbol ở đâu; ví dụ từ localStorage)
  const selectedSymbol = localStorage.getItem('selectedSymbol') || positions[0]?.symbol;
  const pos = positions.find(p => p.symbol === selectedSymbol && parseFloat(p.positionAmt) !== 0);

  if (!pos) {
    onFloatingInfoChange?.(null);
    return;
  }

  const entry = parseFloat(pos.entryPrice || '0');
  const size  = parseFloat(pos.positionAmt || '0');
  const mp    = parseFloat(pos.markPrice || '0');

  const pnl = (mp - entry) * size;
  const notional = entry * Math.abs(size);
  const roi = notional ? (pnl / notional) * 100 : 0;

  onFloatingInfoChange?.({
    symbol: pos.symbol,
    pnl,
    roi,
    price: mp, // dùng mark price cho Floating
    positionAmt: size,
  });
}, [positions, onFloatingInfoChange]);


  // Load từ props hoặc localStorage
   useEffect(() => {
    if (!externalPositions || externalPositions.length === 0) {
      const raw = localStorage.getItem('positions');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setPositions(parsed);
          // đếm vị thế != 0
          onPositionCountChange?.(
            parsed.filter((p: any) => parseFloat(p.positionAmt) !== 0).length
          );
        } catch {}
      }
    } else {
      setPositions(externalPositions);
      onPositionCountChange?.(
        externalPositions.filter((p) => parseFloat(p.positionAmt) !== 0).length
      );
    }
  }, [externalPositions, onPositionCountChange]);

 useEffect(() => {
    binanceWS.setPositionUpdateHandler((rawPositions) => {
      if (!Array.isArray(rawPositions) || rawPositions.length === 0) {
        setPositions([]);
        localStorage.removeItem('positions');
        onPositionCountChange?.(0);
        return;
      }
      const filtered = rawPositions.filter((p: any) => parseFloat(p.positionAmt) !== 0);
      if (filtered.length === 0) {
        setPositions([]);
        localStorage.removeItem('positions');
        onPositionCountChange?.(0);
        return;
      }
      const cleaned = filtered.map((p: any) => ({
        symbol: p.symbol,
        positionAmt: p.positionAmt ?? '0',
        entryPrice: p.entryPrice ?? '0',
        markPrice: undefined,
      }));
      setPositions(cleaned);
      localStorage.setItem('positions', JSON.stringify(cleaned));
      onPositionCountChange?.(cleaned.length);
    });

    binanceWS.getPositions();

    return () => {
      binanceWS.setPositionUpdateHandler(() => {});
    };
  }, [onPositionCountChange]);
  // 🔁 Lắng nghe WS để bắt ACCOUNT_UPDATE.a.P
  useEffect(() => {
    const handler = (msg: any) => {
      if (msg?.a?.P && Array.isArray(msg.a.P)) {
        const rawPositions = msg.a.P;
        const filtered = rawPositions.filter((p: any) => parseFloat(p.pa) !== 0);
        if (filtered.length === 0) {
          setPositions([]);
          localStorage.removeItem('positions');
          onPositionCountChange?.(0);
          return;
        }
        const cleaned = filtered.map((p: any) => ({
          symbol: p.s,
          positionAmt: p.pa ?? '0',
          entryPrice: p.ep ?? '0',
          markPrice: undefined,
        }));
        setPositions(cleaned);
        localStorage.setItem('positions', JSON.stringify(cleaned));
        onPositionCountChange?.(cleaned.length);
      }
    };
    binanceWS.onMessage(handler);
    return () => binanceWS.removeMessageHandler(handler);
  }, [onPositionCountChange]);

  // Subscribe markPrice theo từng symbol
  useEffect(() => {
    if (!positions || positions.length === 0) return;
    if (market !== "futures") return;
    const subscribed: string[] = [];
    positions.forEach((pos) => {
      const symbol = pos.symbol;
      if (!symbol || subscribed.includes(symbol)) return;
      subscribed.push(symbol);
      binancePublicWS.subscribeMarkPrice(symbol, (markPriceRaw) => {
  const markPrice = parseFloat(markPriceRaw).toFixed(6);
  setPositions((prev) => {
    const updated = prev.map((p) =>
      p.symbol !== symbol ? p : { ...p, markPrice }
    );
    // ✅ lưu lại để nơi khác dùng cùng markPrice
    localStorage.setItem("positions", JSON.stringify(updated));
    return updated;
  });
});
    });
    return () => {
      subscribed.forEach((symbol) => binancePublicWS.unsubscribeMarkPrice(symbol));
    };
  }, [positions, market]);

  const calculatePnl = (pos: PositionData) => {
    const entry = parseFloat(pos.entryPrice || "0");
    const mark = parseFloat(pos.markPrice || "0");
    const size = parseFloat(pos.positionAmt || "0");

    if (entry === 0 || mark === 0 || size === 0) return 0;

    return (mark - entry) * size;
  };

  const calculatePnlPercentage = (pos: PositionData) => {
    const entry = parseFloat(pos.entryPrice || "0");
    const size = parseFloat(pos.positionAmt || "0");
    const pnl = calculatePnl(pos);

    const cost = entry * Math.abs(size); // Entry Price x Qty
    if (cost === 0) return 0;

    return (pnl / cost) * 100; // ✅ CHUẨN Binance
  };

  const handleCloseAllMarket = () => {
    console.log('🔥 Gửi lệnh đóng tất cả MKT');
    positions.forEach((pos) => {
      const rawSize = parseFloat(pos.positionAmt || '0');
      if (rawSize === 0) return;

      const side = rawSize > 0 ? 'SELL' : 'BUY';
      // TODO: lấy từ binanceWS.getPositionMode() nếu có
      const isHedge = true;
      const positionSide = (isHedge
        ? (rawSize > 0 ? 'LONG' : 'SHORT')
        : 'BOTH') as 'LONG' | 'SHORT' | 'BOTH';

      const absSize = Math.abs(rawSize);
      const step = getStepSize(pos.symbol);
      const qty = roundToStep(absSize, step);
      if (qty <= 0) return;

      binanceWS.placeOrder({
        symbol: pos.symbol,
        market: 'futures',
        type: 'MARKET',
        side: side as 'BUY' | 'SELL',
        positionSide,
        quantity: qty,
      });
    });
  }; // <-- đóng ngoặc bị thiếu trước đó


  const handleCloseAllByPnl = () => {
    console.log("🔪 Gửi lệnh đóng tất cả theo PnL > 5%");
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
  };

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
                <svg
                  className="ml-[2px] hidden w-[12px] h-[12px] text-gray-500 cursor-move shrink-0"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M20 7H4v3h16V7zm0 7H4v3h16v-3z"
                    fill="currentColor"
                  ></path>
                </svg>
              </th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => {
              const size = parseFloat(pos.positionAmt || "0");
              const pnl = calculatePnl(pos);

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
                <tr key={pos.symbol} className="border-b border-dark-700">
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
                    {pnl > 0
                      ? `+${pnl.toFixed(2)}`
                      : pnl < 0
                      ? `-${Math.abs(pnl).toFixed(2)} USDT`
                      : "0.00"}
                    <br />
                    <span className="text-xs opacity-80">
                      {pnl > 0
                        ? `+${calculatePnlPercentage(pos).toFixed(2)}%`
                        : pnl < 0
                        ? `(-${Math.abs(calculatePnlPercentage(pos)).toFixed(
                            2
                          )}%)`
                        : "0.00%"}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center space-x-2 mt-2">
                      {/* Label Thị trường | Giới hạn */}
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

                      {/* Input giá */}
                      <input
                        type="text"
                        value={closePrice}
                        onChange={(e) => setClosePrice(e.target.value)}
                        className="bg-dark-600 text-white text-[13px] px-2 py-[4px] rounded border border-dark-500 focus:outline-none w-[80px]"
                        placeholder="Giá"
                      />

                      {/* Input số lượng */}
                      <input
                        type="text"
                        value={closeQuantity}
                        onChange={(e) => setCloseQuantity(e.target.value)}
                        className="bg-dark-600 text-white text-[13px] px-2 py-[4px] rounded border border-dark-500 focus:outline-none w-[60px]"
                        placeholder="Số lượng"
                      />
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

            // ✅ Lưu lại mục tiêu, dùng để check sau mỗi update từ WebSocket
          }}
        />
      </div>
    </div>
  );
};

export default Position;
