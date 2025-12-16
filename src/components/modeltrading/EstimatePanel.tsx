import React, { useEffect, useRef, useState } from "react";

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
  
  // ✅ FIX: Lưu current symbol để detect changes
  const lastSymbolRef = useRef(selectedSymbol);
  const [displayEst, setDisplayEst] = useState(est);
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUpdateRef = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    // ✅ NẾU ĐỔI COIN → Update ngay lập tức, không throttle
    if (selectedSymbol !== lastSymbolRef.current) {
      console.log('🔄 Symbol changed:', lastSymbolRef.current, '→', selectedSymbol);
      lastSymbolRef.current = selectedSymbol;
      setDisplayEst(est);
      lastUpdateRef.current = now;
      
      // Clear pending timer
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }
      return;
    }

    // ✅ CÙNG COIN: Throttle bình thường
    if (timeSinceLastUpdate >= 250) {
      setDisplayEst(est);
      lastUpdateRef.current = now;
    } else {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }

      updateTimerRef.current = setTimeout(() => {
        setDisplayEst(est);
        lastUpdateRef.current = Date.now();
      }, 250 - timeSinceLastUpdate);
    }

    return () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, [est, selectedSymbol]);

  return (
    <div className="mt-2 rounded-xl border border-dark-600 bg-dark-800 p-fluid-3">
      <div className="mt-2 grid grid-cols-2 gap-6 text-fluid-sm">
        {/* Left Column */}
        <div className="space-y-1">
          <div className="text-dark-400">Giá thanh lý</div>
          <div className="font-medium text-white" style={{ fontVariantNumeric: "tabular-nums" }}>
            {selectedMarket === "futures" && displayEst.liqPrice
              ? `${displayEst.liqPrice.toLocaleString(undefined, {
                  maximumFractionDigits: Math.max(0, priceDecimals),
                })} USDT`
              : "-- USDT"}
          </div>

          <div className="text-dark-400 mt-2">Chi phí</div>
          <div className="font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
            {selectedMarket === "futures"
              ? `${displayEst.initMargin.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })} USDT`
              : "—"}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-1">
          <div className="text-dark-400">Phí</div>
          <div className="font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
            {displayEst.fee.toLocaleString(undefined, {
              maximumFractionDigits: 6,
            })}{" "}
            USDT
          </div>

          <div className="text-dark-400 mt-2">Tối đa {baseAsset}</div>
          <div className="font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
            {displayEst.maxQty.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}{" "}
            {baseAsset}
          </div>
        </div>
      </div>

      {/* Fee Rate */}
      <div className="mt-2 text-fluid-xs text-dark-400">
        % Mức phí: {(getFeeRate(orderType) * 100).toFixed(3)}%{" "}
        {orderType === "market" ? "(Taker)" : "(Maker)"}
      </div>
    </div>
  );
};

export default EstimatePanel;