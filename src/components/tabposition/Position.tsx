import React, { useEffect, useState } from "react";
import { binancePublicWS } from "../binancewebsocket/binancePublicWS";
import { binanceWS } from "../binancewebsocket/BinanceWebSocketService";
import PopupPosition from "../popupposition/PopupPosition";
interface PositionData {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice?: string;
  margin?: number;
}

interface PositionProps {
  positions?: PositionData[];
  market?: "spot" | "futures";
}

const Position: React.FC<PositionProps> = ({
  positions: externalPositions,
  market,
}) => {
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [closePrice, setClosePrice] = useState("");
  const [closeQuantity, setCloseQuantity] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [targetTP, setTargetTP] = useState("");
  const [targetSL, setTargetSL] = useState("");
  const [currentPnl, setCurrentPnl] = useState(0); // => tính tổng từ all positions
  // Load từ props hoặc localStorage
  useEffect(() => {
    if (!externalPositions || externalPositions.length === 0) {
      const raw = localStorage.getItem("positions");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setPositions(parsed);
        } catch {}
      }
    } else {
      setPositions(externalPositions);
    }
  }, [externalPositions]);

  useEffect(() => {
    binanceWS.setPositionUpdateHandler((rawPositions) => {
      // ⚠️ Nếu không có vị thế nào hoặc toàn bộ đã đóng
      if (!Array.isArray(rawPositions) || rawPositions.length === 0) {
        setPositions([]);
        localStorage.removeItem("positions");
        return;
      }

      // ⚠️ Lọc bỏ vị thế đã đóng
      const filtered = rawPositions.filter(
        (p: any) => parseFloat(p.positionAmt) !== 0
      );

      if (filtered.length === 0) {
        setPositions([]);
        localStorage.removeItem("positions");
        return;
      }

      // ✅ Chuẩn hóa dữ liệu
      const cleaned = filtered.map((p: any) => ({
        symbol: p.symbol,
        positionAmt: p.positionAmt ?? "0",
        entryPrice: p.entryPrice ?? "0",
        markPrice: undefined, // sẽ được cập nhật từ WS public
      }));

      setPositions(cleaned);
      localStorage.setItem("positions", JSON.stringify(cleaned));
    });

    // ✅ Lấy danh sách vị thế ngay khi mount
    binanceWS.send({ action: "getPositions" });

    return () => {
      binanceWS.setPositionUpdateHandler(() => {}); // cleanup
    };
  }, []);
  // 🔁 Lắng nghe WS để bắt ACCOUNT_UPDATE.a.P
  useEffect(() => {
    const handler = (msg: any) => {
      // ✅ Nếu có vị thế trong update từ server
      if (msg?.a?.P && Array.isArray(msg.a.P)) {
        const rawPositions = msg.a.P;

        const filtered = rawPositions.filter(
          (p: any) => parseFloat(p.pa) !== 0
        );

        if (filtered.length === 0) {
          setPositions([]);
          localStorage.removeItem("positions");
          return;
        }

        const cleaned = filtered.map((p: any) => ({
          symbol: p.s,
          positionAmt: p.pa ?? "0",
          entryPrice: p.ep ?? "0",
          markPrice: undefined,
        }));

        setPositions(cleaned);
        localStorage.setItem("positions", JSON.stringify(cleaned));
      }
    };

    binanceWS.onMessage(handler);
    return () => binanceWS.removeMessageHandler(handler);
  }, []);

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
        const markPrice = parseFloat(markPriceRaw).toFixed(6); // chuẩn hóa để so sánh

        setPositions((prev) => {
          const updated = prev.map((p) => {
            if (p.symbol !== symbol) return p;
            if (p.markPrice === markPrice) return p;
            return { ...p, markPrice };
          });
          return [...updated];
        });
      });
    });

    return () => {
      subscribed.forEach((symbol) => {
        binancePublicWS.unsubscribeMarkPrice(symbol);
      });
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
    console.log("🔥 Gửi lệnh đóng tất cả MKT");

    positions.forEach((pos) => {
      const size = parseFloat(pos.positionAmt || "0");
      if (size === 0) return;

      const side = size > 0 ? "SELL" : "BUY";
      const positionSide = size > 0 ? "LONG" : "SHORT";

      const order = {
        action: "placeOrder",
        symbol: pos.symbol,
        side,
        type: "MARKET",
        quantity: Math.abs(size),
        market: "futures",

        positionSide,
      };

      console.log("📤 Đóng MKT:", order);
      binanceWS.send(order);
    });
  };

  const handleCloseAllByPnl = () => {
    console.log("🔪 Gửi lệnh đóng tất cả theo PnL > 5%");

    positions.forEach((pos) => {
      const size = parseFloat(pos.positionAmt || "0");
      const pnlPercent = calculatePnlPercentage(pos);

      if (size === 0 || pnlPercent < 5) return;

      const side = size > 0 ? "SELL" : "BUY";
      const positionSide = size > 0 ? "LONG" : "SHORT";

      const order = {
        action: "placeOrder",
        symbol: pos.symbol,
        side,
        type: "MARKET",
        quantity: Math.abs(size),
        market: "futures",
        reduceOnly: true,
        positionSide,
      };

      console.log("📤 Đóng theo PnL > 5%:", order);
      binanceWS.send(order);
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
