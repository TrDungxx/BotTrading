import React, { useState, useEffect, useRef } from "react";
import { X, Calculator } from "lucide-react";

type TpSlMode = "price" | "pnl" | "roi";
type Side = "buy" | "sell";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  type: "tp" | "sl";
  mode: TpSlMode;
  currentValue: string;
  onApply: (value: string) => void;
  
  // Data
  entryPrice: number;
  quantity: number;
  side: Side;
  triggerRef: React.RefObject<HTMLInputElement>;
}

/**
 * TpSlCalculator - Calculator popup giống Binance
 * Hiển thị khi click vào input TP/SL
 * Tính toán và hiển thị Price, PnL, ROI
 */
const TpSlCalculator: React.FC<Props> = ({
  isOpen,
  onClose,
  type,
  mode,
  currentValue,
  onApply,
  entryPrice,
  quantity,
  side,
  triggerRef,
}) => {
  const [inputValue, setInputValue] = useState("");
  const popupRef = useRef<HTMLDivElement>(null);

  // Initialize
  useEffect(() => {
    if (isOpen) {
      setInputValue(currentValue);
    }
  }, [isOpen, currentValue]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, triggerRef]);

  // Calculate values
  const getCalculatedValues = () => {
    const val = parseFloat(inputValue || "0");
    if (!Number.isFinite(val) || val === 0 || quantity <= 0 || entryPrice <= 0) {
      return null;
    }

    try {
      let price = 0;
      let pnl = 0;
      let roi = 0;

      if (mode === "price") {
        price = val;
        pnl = calculatePnL(price);
        roi = calculateROI(pnl);
      } else if (mode === "pnl") {
        pnl = val;
        price = getPriceFromPnL(pnl);
        roi = calculateROI(pnl);
      } else if (mode === "roi") {
        roi = val;
        price = getPriceFromROI(roi);
        pnl = calculatePnL(price);
      }

      return { price, pnl, roi };
    } catch {
      return null;
    }
  };

  const calculatePnL = (exitPrice: number): number => {
    if (side === "buy") {
      return (exitPrice - entryPrice) * quantity;
    } else {
      return (entryPrice - exitPrice) * quantity;
    }
  };

  const calculateROI = (pnl: number): number => {
    const cost = entryPrice * quantity;
    if (cost <= 0) return 0;
    return (pnl / cost) * 100;
  };

  const getPriceFromPnL = (pnl: number): number => {
    if (quantity <= 0) return entryPrice;
    if (side === "buy") {
      return entryPrice + pnl / quantity;
    } else {
      return entryPrice - pnl / quantity;
    }
  };

  const getPriceFromROI = (roi: number): number => {
    const cost = entryPrice * quantity;
    const pnl = (roi / 100) * cost;
    return getPriceFromPnL(pnl);
  };

  const calculated = getCalculatedValues();
  const isTP = type === "tp";

  // Validation
  const isValid = calculated && (isTP ? calculated.pnl > 0 : calculated.pnl < 0);

  // Position
  const triggerRect = triggerRef.current?.getBoundingClientRect();

  if (!isOpen) return null;

  return (
    <div
      ref={popupRef}
      className="fixed bg-dark-850 border border-dark-700 rounded-lg shadow-2xl z-[9999] w-[260px]"
      style={{
        top: triggerRect ? triggerRect.bottom + 4 : 0,
        left: triggerRect ? triggerRect.left : 0,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-fluid-3 py-2 border-b border-dark-700">
        <div className="flex items-center gap-fluid-2">
          <Calculator className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-xs font-medium text-white">
            {isTP ? "Take Profit" : "Stop Loss"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="p-fluid-3 space-y-3">
        {/* Trigger Info */}
        <div className="text-fluid-2xs space-y-1">
          {/* Current Triggers với highlight */}
          {calculated && (
            <div className="bg-dark-900 rounded px-2 py-fluid-1.5 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Buy Trigger:</span>
                <span className="text-green-500 font-medium">
                  {isTP && side === "buy" 
                    ? calculated.price.toFixed(7)
                    : entryPrice.toFixed(7)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sell Trigger:</span>
                <span className="text-red-500 font-medium">
                  {isTP && side === "sell" 
                    ? calculated.price.toFixed(7)
                    : !isTP && side === "buy"
                    ? calculated.price.toFixed(7)
                    : entryPrice.toFixed(7)}
                </span>
              </div>
            </div>
          )}
          
          {/* Entry info */}
          <div className="text-slate-500 px-2">
            <div className="flex justify-between">
              <span>Entry Price:</span>
              <span className="text-white">{entryPrice.toFixed(7)}</span>
            </div>
            <div className="flex justify-between">
              <span>Quantity:</span>
              <span className="text-white">{quantity}</span>
            </div>
          </div>
        </div>

        {/* Input based on mode */}
        <div>
          <label className="block text-fluid-2xs text-slate-400 mb-1">
            {mode === "price"
              ? `${isTP ? "Trigger" : "Stop"} Price`
              : mode === "pnl"
              ? `${type.toUpperCase()} (USDT)`
              : "ROI (%)"}
          </label>
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="0"
              className="w-full px-2.5 py-fluid-1.5 bg-dark-900 border border-dark-700 rounded text-white text-fluid-sm focus:outline-none focus:border-blue-500"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">
              {mode === "roi" ? "%" : mode === "price" ? "USDT" : ""}
            </span>
          </div>
        </div>

        {/* Calculated Values */}
        {calculated && (
          <div className="bg-dark-900 rounded p-fluid-2 space-y-1.5">
            <div className="flex justify-between text-fluid-xs">
              <span className="text-slate-500">Price</span>
              <span className="text-white font-medium">
                {calculated.price.toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between text-fluid-xs">
              <span className="text-slate-500">PnL</span>
              <span
                className={`font-medium ${
                  calculated.pnl >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {calculated.pnl >= 0 ? "+" : ""}
                {calculated.pnl.toFixed(2)} USDT
              </span>
            </div>
            <div className="flex justify-between text-fluid-xs">
              <span className="text-slate-500">ROI</span>
              <span
                className={`font-medium ${
                  calculated.roi >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {calculated.roi >= 0 ? "+" : ""}
                {calculated.roi.toFixed(2)}%
              </span>
            </div>
          </div>
        )}

        {/* Validation Error */}
        {calculated && !isValid && (
          <div className="text-fluid-2xs text-red-500">
            {isTP
              ? "Take Profit phải sinh lãi"
              : "Stop Loss phải sinh lỗ"}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-fluid-2 px-fluid-3 pb-3">
        <button
          onClick={onClose}
          className="flex-1 py-fluid-1.5 px-fluid-3 bg-dark-800 hover:bg-dark-700 text-white text-xs rounded transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            if (calculated && isValid) {
              // Always return price
              onApply(calculated.price.toString());
              onClose();
            }
          }}
          disabled={!isValid}
          className={`flex-1 py-fluid-1.5 px-fluid-3 text-xs rounded transition-colors ${
            isValid
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-dark-700 text-slate-600 cursor-not-allowed"
          }`}
        >
          Confirm
        </button>
      </div>
    </div>
  );
};

export default TpSlCalculator;