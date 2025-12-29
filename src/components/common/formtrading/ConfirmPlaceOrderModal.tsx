import React, { useEffect, useState, useRef } from "react";
import { binanceWS } from "../../binancewebsocket/BinanceWebSocketService";

export type ConfirmOrderPayload = {
  symbol: string;
  market: "spot" | "futures";
  type: "MARKET" | "LIMIT" | "STOP_MARKET";
  side: "BUY" | "SELL";
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: "GTC" | "IOC" | "FOK";
  workingType?: "MARK_PRICE" | "LAST";
  // futures only
  positionSide?: "LONG" | "SHORT" | "BOTH";
  reduceOnly?: boolean;
};

interface Props {
  open: boolean;
  onClose: () => void;

  order: ConfirmOrderPayload | null;
  sideLabel: "LONG" | "SHORT";
  symbol: string;
  baseAsset?: string;
  markPrice?: number;
  estFee?: number;
  estLiqPrice?: number;
  priceDecimals?: number;

  onConfirm: (order: ConfirmOrderPayload) => void;
}

// ✅ Helper: Parse error message từ Binance để hiển thị dễ hiểu hơn
const parseErrorMessage = (message: string): { title: string; description: string; suggestion: string } => {
  // Single order limit error
  if (message.includes("exceeds single order limit")) {
    const match = message.match(/Order size ([\d.]+)% exceeds single order limit ([\d.]+)%/);
    const orderSize = match?.[1] || "?";
    const limit = match?.[2] || "0.5";
    
    return {
      title: "Kích thước lệnh vượt giới hạn",
      description: `Lệnh của bạn chiếm ${orderSize}% vượt quá giới hạn ${limit}% cho phép của Binance.`,
      suggestion: "Giảm số lượng lệnh hoặc chia nhỏ thành nhiều lệnh."
    };
  }
  
  // Insufficient margin
  if (message.includes("Insufficient") || message.includes("insufficient")) {
    return {
      title: "Không đủ ký quỹ",
      description: "Số dư khả dụng không đủ để mở lệnh này.",
      suggestion: "Nạp thêm USDT hoặc giảm số lượng lệnh."
    };
  }
  
  // Position limit
  if (message.includes("position limit") || message.includes("Max position")) {
    return {
      title: "Vượt giới hạn vị thế",
      description: "Bạn đã đạt giới hạn vị thế tối đa cho cặp giao dịch này.",
      suggestion: "Đóng bớt vị thế hiện có hoặc chờ vị thế được thanh lý."
    };
  }
  
  // Price filter
  if (message.includes("PRICE_FILTER") || message.includes("price")) {
    return {
      title: "Giá không hợp lệ",
      description: "Giá đặt lệnh nằm ngoài phạm vi cho phép.",
      suggestion: "Điều chỉnh giá gần với giá thị trường hơn."
    };
  }
  
  // LOT_SIZE filter
  if (message.includes("LOT_SIZE") || message.includes("quantity")) {
    return {
      title: "Số lượng không hợp lệ",
      description: "Số lượng không đúng theo quy định của Binance.",
      suggestion: "Điều chỉnh số lượng theo bước giá (step size) của symbol."
    };
  }
  
  // Default
  return {
    title: "Lỗi đặt lệnh",
    description: message,
    suggestion: "Vui lòng thử lại hoặc điều chỉnh thông số lệnh."
  };
};

const ConfirmPlaceOrderModal: React.FC<Props> = ({
  open,
  onClose,
  order,
  sideLabel,
  symbol,
  baseAsset,
  markPrice,
  estFee,
  estLiqPrice,
  priceDecimals = 4,
  onConfirm,
}) => {
  // ✅ NEW: Loading và Error states
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<{ title: string; description: string; suggestion: string } | null>(null);
  
  // ✅ Ref để track handler
  const handlerRef = useRef<((msg: any) => void) | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPlacing) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, isPlacing]);

  // ✅ Reset states khi modal mở/đóng
  useEffect(() => {
    if (open) {
      setIsPlacing(false);
      setError(null);
    }
    
    // Cleanup khi đóng modal
    return () => {
      if (handlerRef.current) {
        binanceWS.removeMessageHandler(handlerRef.current);
        handlerRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [open]);

  // ✅ ALWAYS listen for errors khi modal đang mở
  useEffect(() => {
    if (!open) return;

    const errorHandler = (msg: any) => {
      console.log("📨 ConfirmModal received:", msg?.type, msg?.action);
      
      // Check error response từ Binance với action = placeOrder
      if (msg?.type === "error" && msg?.action === "placeOrder") {
        console.log("🚨 Order error caught in modal:", msg);
        setIsPlacing(false);
        setError(parseErrorMessage(msg.message || "Đặt lệnh thất bại"));
        return;
      }
      
      // Check generic error có chứa keyword về order
      if (msg?.type === "error" && msg?.message) {
        const isOrderError = 
          msg.message.includes("Order") || 
          msg.message.includes("order") || 
          msg.message.includes("exceeds") ||
          msg.message.includes("Insufficient") ||
          msg.message.includes("position");
          
        if (isOrderError) {
          console.log("🚨 Generic order error caught:", msg);
          setIsPlacing(false);
          setError(parseErrorMessage(msg.message));
          return;
        }
      }

      // Check ORDER_TRADE_UPDATE với status REJECTED
      if (msg?.e === "ORDER_TRADE_UPDATE" && msg?.o) {
        const orderData = msg.o;
        if (orderData.s === order?.symbol && orderData.X === "REJECTED") {
          console.log("🚨 Order rejected:", orderData);
          setIsPlacing(false);
          setError({
            title: "Lệnh bị từ chối",
            description: orderData.rj || "Binance đã từ chối lệnh của bạn.",
            suggestion: "Kiểm tra lại thông số lệnh và thử lại."
          });
          return;
        }
        
        // ✅ Success case - TỰ ĐÓNG MODAL
        if (orderData.s === order?.symbol && 
            (orderData.X === "NEW" || orderData.X === "FILLED" || orderData.X === "PARTIALLY_FILLED")) {
          console.log("✅ Order success, auto-closing modal");
          setIsPlacing(false);
          
          // Clear timeout
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          
          // ✅ TỰ ĐÓNG MODAL SAU 300ms (để user thấy trạng thái thành công)
          setTimeout(() => {
            onClose();
          }, 300);
          return;
        }
      }
      
      // ✅ Check orderPlaced response từ backend (fallback)
      if (msg?.type === "orderPlaced" && msg?.data?.symbol === order?.symbol) {
        console.log("✅ Order placed confirmed by backend, auto-closing modal");
        setIsPlacing(false);
        
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        setTimeout(() => {
          onClose();
        }, 300);
        return;
      }
    };

    // Đăng ký handler
    handlerRef.current = errorHandler;
    binanceWS.onMessage(errorHandler);
    console.log("✅ Error handler registered for ConfirmModal");

    return () => {
      if (handlerRef.current) {
        binanceWS.removeMessageHandler(handlerRef.current);
        console.log("🔄 Error handler removed from ConfirmModal");
        handlerRef.current = null;
      }
    };
  }, [open, order?.symbol]);

  if (!open || !order) return null;

  const fmt = (n: number | undefined, max = priceDecimals) =>
    n == null || Number.isNaN(n)
      ? "--"
      : n.toLocaleString(undefined, { maximumFractionDigits: max });

  const handleConfirm = () => {
    console.log("🔥 Confirm clicked, setting isPlacing=true");
    setError(null);
    setIsPlacing(true);
    
    // Timeout để reset loading state nếu không có response
    timeoutRef.current = setTimeout(() => {
      console.log("⏰ Order timeout");
      setIsPlacing(false);
    }, 15000);
    
    onConfirm(order);
  };

  const handleRetry = () => {
    setError(null);
  };

  const handleClose = () => {
    if (!isPlacing) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div 
        className="absolute inset-0 bg-black/60" 
        onClick={handleClose} 
      />
      {/* modal */}
      <div
        className="relative z-10 w-[420px] rounded-2xl bg-dark-800 border border-dark-600 p-fluid-16 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        {/* ✅ ERROR STATE */}
        {error ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-400">{error.title}</h3>
                <p className="text-fluid-sm text-dark-300">{symbol}</p>
              </div>
            </div>
            
            <div className="bg-dark-700/50 rounded-xl p-4 mb-4">
              <p className="text-fluid-sm text-white mb-2">{error.description}</p>
              <p className="text-fluid-sm text-emerald-400">
                💡 {error.suggestion}
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                className="flex-1 rounded-xl bg-dark-600 text-white font-medium py-2.5 hover:bg-dark-500 transition-colors"
                onClick={onClose}
              >
                Đóng
              </button>
              <button
                className="flex-1 rounded-xl bg-[#fcd535] text-black font-semibold py-2.5 hover:brightness-95 transition-all"
                onClick={handleRetry}
              >
                Thử lại
              </button>
            </div>
          </>
        ) : (
          <>
            {/* NORMAL STATE */}
            <div className="flex items-start justify-between">
              <div className="text-white font-semibold">
                {symbol}{" "}
                <div className={`text-fluid-sm font-medium ${sideLabel === "LONG" ? "text-emerald-400" : "text-red-400"}`}>
                  Mở lệnh {sideLabel === "LONG" ? "Long" : "Short"}
                </div>
              </div>
              <button
                className="text-dark-300 hover:text-white text-2xl leading-none disabled:opacity-50"
                onClick={handleClose}
                disabled={isPlacing}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="mt-3 space-y-2 text-fluid-sm">
              <div className="flex justify-between">
                <span className="text-dark-400">Giá</span>
                <span className="text-white">
                  {order.type === "MARKET"
                    ? "Thị trường"
                    : order.type === "LIMIT"
                    ? `${fmt(order.price)} USDT`
                    : `Stop ${fmt(order.stopPrice)} (${order.workingType ?? "MARK_PRICE"})`}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-dark-400">Số lượng</span>
                <span className="text-white">
                  {fmt(order.quantity, 8)} {baseAsset ?? symbol.replace("USDT", "")}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-dark-400">Phí (ước tính)</span>
                <span className="text-white">{fmt(estFee, 6)} USDT</span>
              </div>

              <div className="flex justify-between">
                <span className="text-dark-400">Giá đánh dấu</span>
                <span className="text-white">{fmt(markPrice)} USDT</span>
              </div>

              <div className="flex justify-between">
                <span className="text-dark-400">Giá thanh lý ước tính</span>
                <span className="text-white">
                  {estLiqPrice ? `${fmt(estLiqPrice)} USDT` : "--"}
                </span>
              </div>

              {order.type === "MARKET" && (
                <div className="text-fluid-sm text-warning-400 mt-2">
                  * Lệnh có thể không khớp nếu chênh lệch vượt ngưỡng cho phép.
                </div>
              )}
            </div>

            <div className="mt-4">
              <button
                className="w-full rounded-xl bg-[#fcd535] text-black font-semibold py-2.5 hover:brightness-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                onClick={handleConfirm}
                disabled={isPlacing}
              >
                {isPlacing ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Đang đặt lệnh...
                  </>
                ) : (
                  "Xác nhận"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ConfirmPlaceOrderModal;