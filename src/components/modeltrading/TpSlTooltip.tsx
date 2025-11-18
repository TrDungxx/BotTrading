import React, { useRef } from "react";
import { createPortal } from "react-dom";

type TpSlMode = "price" | "pnl" | "roi";
type Side = "buy" | "sell";

interface Props {
  show: boolean;
  mode: TpSlMode;
  inputValue: string;
  entryPrice: number;
  quantity: number;
  side: Side;
  triggerRef: React.RefObject<HTMLInputElement>;
  leverage: number;
  type: "tp" | "sl";
}

/**
 * TpSlTooltip - FINAL FIXED VERSION
 * - Hiển thị Buy/Sell Triggers cho tất cả modes
 * - Price mode: Thêm PnL và ROI
 * - Fix duplicate tooltip issue
 * - Fix Stop Loss negative price handling
 */
const TpSlTooltip: React.FC<Props> = ({
  show,
  mode,
  inputValue,
  entryPrice,
  quantity,
  side,
  triggerRef,
  leverage,
  type,
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);

  if (!show) return null;

  const triggerRect = triggerRef.current?.getBoundingClientRect();

  // Calculate triggers
  let buyTrigger = entryPrice;
  let sellTrigger = entryPrice;

  if (inputValue && Number.isFinite(entryPrice) && entryPrice > 0) {
    let value = parseFloat(inputValue);
    
    // ✅ Xử lý giá âm cho Stop Loss
    if (type === "sl" && value < 0) {
      value = Math.abs(value);
    }
    
    if (Number.isFinite(value) && value !== 0) {
      if (mode === "roi") {
        // ROI mode: Tự động thêm dấu trừ cho SL
        let roiValue = value;
        if (type === "sl" && roiValue > 0) {
          roiValue = -roiValue;
        }
        
        const priceChangePercent = (roiValue / 100) / leverage;
        buyTrigger = entryPrice * (1 + priceChangePercent);
        sellTrigger = entryPrice * (1 - priceChangePercent);
        
      } else if (mode === "price") {
        // Price mode: value đã là absolute
        const targetPrice = value;
        
        if (targetPrice > entryPrice) {
          buyTrigger = targetPrice;
          sellTrigger = entryPrice;
        } else if (targetPrice < entryPrice) {
          buyTrigger = entryPrice;
          sellTrigger = targetPrice;
        } else {
          buyTrigger = entryPrice;
          sellTrigger = entryPrice;
        }
        
      } else if (mode === "pnl" && quantity > 0) {
        // PnL mode: Tự động thêm dấu trừ cho SL
        let pnlAmount = value;
        if (type === "sl" && pnlAmount > 0) {
          pnlAmount = -pnlAmount;
        }
        
        const priceChange = Math.abs(pnlAmount) / quantity;
        
        if (pnlAmount >= 0) {
          buyTrigger = entryPrice + priceChange;
          sellTrigger = entryPrice - priceChange;
        } else {
          buyTrigger = entryPrice - priceChange;
          sellTrigger = entryPrice + priceChange;
        }
      }
    }
  }

  // ✅ Validation: Nếu trigger âm → set về 0
  if (buyTrigger < 0) buyTrigger = 0;
  if (sellTrigger < 0) sellTrigger = 0;

  // ✅ PRICE MODE - Hiển thị triggers + PnL + ROI
  if (mode === "price") {
    const targetPrice = parseFloat(inputValue || "0");
    const absTargetPrice = Math.abs(targetPrice);
    
    if (!Number.isFinite(absTargetPrice) || absTargetPrice <= 0 || quantity <= 0) {
      return null;
    }

    // Tính PnL với giá absolute
    const longPnL = (absTargetPrice - entryPrice) * quantity;
    const shortPnL = (entryPrice - absTargetPrice) * quantity;
    
    const margin = (entryPrice * quantity) / leverage;
    
    const longROI = margin > 0 ? (longPnL / margin) * 100 : 0;
    const shortROI = margin > 0 ? (shortPnL / margin) * 100 : 0;

    return createPortal(
      <div
        ref={tooltipRef}
        style={{
          position: "fixed",
          top: triggerRect ? `${triggerRect.top - 65}px` : "0px",
          left: triggerRect ? `${triggerRect.left}px` : "0px",
          zIndex: 99999,
          minWidth: "220px",
          backgroundColor: "#0a0e1a",
          border: "1px solid #3b82f6",
          borderRadius: "8px",
          padding: "10px 12px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.7)",
        }}
      >
        {/* Long PnL */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "8px",
          fontSize: "11px"
        }}>
          <span style={{ color: "#94a3b8" }}>Lợi nhuận mua:</span>
          <span style={{ 
            color: longPnL >= 0 ? "#10b981" : "#ef4444", 
            fontWeight: "600" 
          }}>
            {longPnL >= 0 ? '+' : ''}{longPnL.toFixed(2)} USDT ({longROI >= 0 ? '+' : ''}{longROI.toFixed(2)}%)
          </span>
        </div>

        {/* Short PnL */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          fontSize: "11px"
        }}>
          <span style={{ color: "#94a3b8" }}>Lợi nhuận bán:</span>
          <span style={{ 
            color: shortPnL >= 0 ? "#10b981" : "#ef4444", 
            fontWeight: "600" 
          }}>
            {shortPnL >= 0 ? '+' : ''}{shortPnL.toFixed(2)} USDT ({shortROI >= 0 ? '+' : ''}{shortROI.toFixed(2)}%)
          </span>
        </div>
      </div>,
      document.body
    );
  }

  // ✅ DEFAULT MODE (ROI/PNL) - Chỉ hiển thị triggers
  const tooltipContent = (
    <div
      ref={tooltipRef}
      style={{
        position: "fixed",
        top: triggerRect ? `${triggerRect.top - 65}px` : "0px",
        left: triggerRect ? `${triggerRect.left}px` : "0px",
        zIndex: 99999,
        minWidth: "200px",
        backgroundColor: "#0a0e1a",
        border: "1px solid #3b82f6",
        borderRadius: "8px",
        padding: "10px 12px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.7)",
      }}
    >
      {/* Buy Trigger */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "8px",
        fontSize: "12px"
      }}>
        <span style={{ color: "#94a3b8" }}>Buy Trigger:</span>
        <span style={{ color: "#10b981", fontWeight: "600" }}>
          {buyTrigger.toFixed(5)}
        </span>
      </div>

      {/* Sell Trigger */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        fontSize: "12px"
      }}>
        <span style={{ color: "#94a3b8" }}>Sell Trigger:</span>
        <span style={{ color: "#ef4444", fontWeight: "600" }}>
          {sellTrigger.toFixed(5)}
        </span>
      </div>
    </div>
  );

  return createPortal(tooltipContent, document.body);
};

export default TpSlTooltip;