import React, { useEffect, useRef, useState } from "react";

// ===== useThrottledValue Hook =====
// Throttle value updates - giống Binance, số nhảy tick nhưng không quá nhanh
function useThrottledValue<T>(value: T, delay: number = 250): T {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastUpdate = useRef(Date.now());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdate.current;

    if (timeSinceLastUpdate >= delay) {
      // Đủ thời gian rồi, update ngay
      setThrottledValue(value);
      lastUpdate.current = now;
    } else {
      // Chưa đủ thời gian, schedule update
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setThrottledValue(value);
        lastUpdate.current = Date.now();
      }, delay - timeSinceLastUpdate);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return throttledValue;
}

// ===== Estimate Panel Props =====
interface EstimatePanelProps {
  est: {
    notional: number;
    fee: number;
    initMargin: number;
    maxQty: number;
    liqPrice: number | undefined;
  };
  selectedMarket: "spot" | "futures";
  priceDecimals: number;
  selectedSymbol: string;
  orderType: "limit" | "market" | "stop-limit";
  getFeeRate: (orderType: "limit" | "market" | "stop-limit") => number;
}

// ===== Estimate Panel Component =====
const EstimatePanel: React.FC<EstimatePanelProps> = ({
  est,
  selectedMarket,
  priceDecimals,
  selectedSymbol,
  orderType,
  getFeeRate,
}) => {
  const baseAsset = selectedSymbol.replace("USDT", "");

  // Throttle 250ms = tối đa 4 updates/giây, giống Binance
  const throttledEst = useThrottledValue(est, 250);

  return (
    <div className="mt-2 rounded-xl border border-dark-600 bg-dark-800 p-3">
      <div className="mt-2 grid grid-cols-2 gap-6 text-xs">
        {/* Left Column */}
        <div className="space-y-1">
          <div className="text-dark-400">Giá thanh lý</div>
          <div className="font-medium text-white" style={{ fontVariantNumeric: "tabular-nums" }}>
            {selectedMarket === "futures" && throttledEst.liqPrice
              ? `${throttledEst.liqPrice.toLocaleString(undefined, {
                  maximumFractionDigits: Math.max(0, priceDecimals),
                })} USDT`
              : "-- USDT"}
          </div>

          <div className="text-dark-400 mt-2">Chi phí</div>
          <div className="font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
            {selectedMarket === "futures"
              ? `${throttledEst.initMargin.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })} USDT`
              : "—"}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-1">
          <div className="text-dark-400">Phí</div>
          <div className="font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
            {throttledEst.fee.toLocaleString(undefined, {
              maximumFractionDigits: 6,
            })}{" "}
            USDT
          </div>

          <div className="text-dark-400 mt-2">Tối đa {baseAsset}</div>
          <div className="font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
            {throttledEst.maxQty.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}{" "}
            {baseAsset}
          </div>
        </div>
      </div>

      {/* Fee Rate */}
      <div className="mt-2 text-[11px] text-dark-400">
        % Mức phí: {(getFeeRate(orderType) * 100).toFixed(3)}%{" "}
        {orderType === "market" ? "(Taker)" : "(Maker)"}
      </div>
    </div>
  );
};

export { useThrottledValue };
export default EstimatePanel;