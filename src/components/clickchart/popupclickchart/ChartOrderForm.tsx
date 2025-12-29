import React, { useEffect, useMemo, useState } from "react";
import * as Slider from "@radix-ui/react-slider";

// ===== Types =====
interface PlaceOrderParams {
  market: "spot" | "futures";
  symbol: string;
  side: "BUY" | "SELL";
  type: "LIMIT" | "STOP_MARKET";
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: "GTC" | "IOC" | "FOK";
  positionSide: "LONG" | "SHORT";
  workingType?: "MARK_PRICE" | "LAST";
}

interface SymbolInfo {
  tickSize: number;
  stepSize: number;
  minQty: number;
  minNotional: number;
}

interface Props {
  selectedSymbol: string;
  price: number;
  selectedMarket?: "spot" | "futures";
  defaultOrderType?: "limit" | "stop-limit";
  onClose?: () => void;
  availableBalance?: number;
  leverage?: number;
  onPlaceOrder?: (params: PlaceOrderParams) => void;
  symbolInfo?: SymbolInfo;
}

type OrderTypeBin = "limit" | "stop-limit";
type OrderAction = "open" | "close";

// ===== Helpers =====
const decimalsFromTick = (tick: number) => {
  if (!Number.isFinite(tick)) return 2;
  const s = tick.toString();
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
};

const DEFAULT_TICK = 0.0001;
const DEFAULT_TAKER = 0.0005;
const DEFAULT_MAKER = 0.0002;
const getFeeRate = (orderType: OrderTypeBin) =>
  orderType === "limit" ? DEFAULT_MAKER : DEFAULT_TAKER;

const DEFAULT_LEVERAGE = 10;

// Slider percentages và mapping
const ALLOWED_PERCENTAGES = [0, 0.5, 1, 2, 3, 4];
const SLIDER_MAX = ALLOWED_PERCENTAGES.length - 1;

// ===== Component =====
const ChartOrderForm: React.FC<Props> = ({
  selectedSymbol,
  price: propPrice,
  selectedMarket = "futures",
  defaultOrderType = "limit",
  onClose,
  availableBalance: propBalance = 0,
  leverage: propLeverage = DEFAULT_LEVERAGE,
  onPlaceOrder,
  symbolInfo: propSymbolInfo,
}) => {
  const [orderAction, setOrderAction] = useState<OrderAction>("open");
  const [orderType, setOrderType] = useState<OrderTypeBin>(defaultOrderType);
  const [priceValue, setPriceValue] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [sliderIndex, setSliderIndex] = useState(0);

  const percent = ALLOWED_PERCENTAGES[sliderIndex] || 0;

  // Auto detect tickSize/stepSize
  const getDefaultTickSize = (price: number): number => {
    if (price >= 1000) return 1;
    if (price >= 100) return 0.01;
    if (price >= 10) return 0.001;
    if (price >= 1) return 0.0001;
    if (price >= 0.1) return 0.00001;
    if (price >= 0.01) return 0.000001;
    return 0.0000001;
  };

  const getDefaultStepSize = (symbol: string): number => {
    const s = symbol.toUpperCase();
    if (s.includes('DOGE') || s.includes('SHIB') || s.includes('PEPE') ||
      s.includes('FLOKI') || s.includes('LUNC') || s.includes('XRP') ||
      s.includes('TRX') || s.includes('ADA') || s.includes('MATIC')) {
      return 1;
    }
    if (s.includes('BTC') || s.includes('ETH')) {
      return 0.001;
    }
    return 0.01;
  };

  const tickSize = propSymbolInfo?.tickSize || getDefaultTickSize(propPrice);
  const stepSize = propSymbolInfo?.stepSize || getDefaultStepSize(selectedSymbol);
  const minQty = propSymbolInfo?.minQty || 0;
  const minNotional = propSymbolInfo?.minNotional || 0;

  const availableBalance = propBalance;
  const leverage = propLeverage;
  const coinName = selectedSymbol.replace("USDT", "").replace("BUSD", "");

  const priceDecimals = useMemo(() => {
    if (tickSize && tickSize < 1) {
      return decimalsFromTick(tickSize);
    }
    const lastPrice = propPrice;
    let precision = 2;
    if (lastPrice < 1) {
      precision = lastPrice >= 0.1 ? 5 : 6;
    } else if (lastPrice >= 1 && lastPrice < 10) {
      precision = 3;
    } else if (lastPrice >= 10 && lastPrice < 100) {
      precision = 2;
    } else if (lastPrice >= 100) {
      precision = 4;
    }
    return precision;
  }, [tickSize, propPrice]);

  const qtyDecimals = decimalsFromTick(stepSize);

  const roundQty = (qty: number): number => {
    if (stepSize > 0) {
      return Math.floor(qty / stepSize) * stepSize;
    }
    return qty;
  };

  const formatQty = (qty: number): string => {
    const rounded = roundQty(qty);
    if (stepSize >= 1) {
      return String(Math.round(rounded));
    }
    return rounded.toFixed(qtyDecimals);
  };

  // Set initial price
  const priceInitRef = React.useRef(false);

  useEffect(() => {
    if (propPrice > 0 && !priceInitRef.current) {
      let decimals: number;
      if (propPrice >= 1000) decimals = 2;
      else if (propPrice >= 100) decimals = 2;
      else if (propPrice >= 10) decimals = 3;
      else if (propPrice >= 1) decimals = 4;
      else if (propPrice >= 0.1) decimals = 5;
      else if (propPrice >= 0.01) decimals = 6;
      else decimals = 7;

      setPriceValue(propPrice.toFixed(decimals));
      if (defaultOrderType === 'stop-limit') {
        setStopPrice(propPrice.toFixed(decimals));
      }
      priceInitRef.current = true;
    }
  }, [propPrice, defaultOrderType]);

  useEffect(() => {
    return () => { priceInitRef.current = false; };
  }, []);

  useEffect(() => {
    setAmount("");
    setSliderIndex(0);
    setStopPrice("");
  }, [selectedSymbol]);

  const priceNum = parseFloat(priceValue) || propPrice || 0;

  const minQuantity = useMemo(() => {
    if (!minNotional || !priceNum || priceNum <= 0) return minQty;
    const minQtyFromNotional = minNotional / priceNum;
    return Math.max(minQty, Math.ceil(minQtyFromNotional / stepSize) * stepSize);
  }, [minNotional, priceNum, minQty, stepSize]);

  const buyQty = useMemo(() => {
    if (percent === 0 || !priceNum || priceNum <= 0) return 0;
    const buyingPower = selectedMarket === "futures" ? availableBalance * leverage : availableBalance;
    const notional = (buyingPower * percent) / 100;
    return Math.floor((notional / priceNum) / stepSize) * stepSize;
  }, [percent, priceNum, availableBalance, leverage, selectedMarket, stepSize]);

  const sellQty = useMemo(() => {
    if (percent === 0 || !priceNum || priceNum <= 0) return 0;
    const buyingPower = selectedMarket === "futures" ? availableBalance * leverage : availableBalance;
    const notional = (buyingPower * percent) / 100 * 1.015;
    return Math.floor((notional / priceNum) / stepSize) * stepSize;
  }, [percent, priceNum, availableBalance, leverage, selectedMarket, stepSize]);

  const qtyNum = useMemo(() => {
    const amountNum = parseFloat(amount);
    if (amountNum > 0) return amountNum;
    return buyQty;
  }, [amount, buyQty]);

  const maxBuyQty = useMemo(() => {
    if (!priceNum || priceNum <= 0) return 0;
    const buyingPower = selectedMarket === "futures" ? availableBalance * leverage : availableBalance;
    return Math.floor((buyingPower / priceNum) / stepSize) * stepSize;
  }, [priceNum, availableBalance, leverage, selectedMarket, stepSize]);

  const maxSellQty = useMemo(() => {
    return Math.floor((maxBuyQty * 1.015) / stepSize) * stepSize;
  }, [maxBuyQty, stepSize]);

  const est = useMemo(() => {
    const notional = priceNum * qtyNum;
    const feeRate = getFeeRate(orderType);
    const fee = notional * feeRate;

    let liqPriceLong: number | undefined;
    let liqPriceShort: number | undefined;

    if (selectedMarket === "futures" && leverage > 1 && qtyNum > 0) {
      const mmr = 0.004;
      liqPriceLong = priceNum * (1 - 1 / leverage + mmr);
      liqPriceShort = priceNum * (1 + 1 / leverage - mmr);
    }

    return { notional, fee, maxBuyQty, maxSellQty, liqPriceLong, liqPriceShort };
  }, [priceNum, qtyNum, orderType, selectedMarket, leverage, maxBuyQty, maxSellQty]);

  useEffect(() => {
    if (percent > 0 && maxBuyQty > 0) {
      const qty = roundQty(maxBuyQty * percent / 100);
      const formatted = stepSize >= 1 ? String(Math.round(qty)) : qty.toFixed(qtyDecimals);
      setAmount(qty > 0 ? formatted : "");
    }
  }, [percent, maxBuyQty, stepSize, qtyDecimals]);

  const handleSubmit = (side: "LONG" | "SHORT") => {
    let p = parseFloat(priceValue);

    if (p && p > 0) {
      let effectiveTickSize = tickSize;
      if (!effectiveTickSize || effectiveTickSize === DEFAULT_TICK) {
        if (p < 1) effectiveTickSize = p >= 0.1 ? 0.0001 : 0.00001;
        else if (p < 10) effectiveTickSize = 0.001;
        else if (p < 100) effectiveTickSize = 0.01;
        else effectiveTickSize = 0.1;
      }
      p = Math.round(p / effectiveTickSize) * effectiveTickSize;
    }

    let q: number;
    if (amount && parseFloat(amount) > 0) {
      q = parseFloat(amount);
    } else if (percent > 0) {
      q = side === "LONG" ? buyQty : sellQty;
    } else {
      return;
    }

    if (stepSize > 0) {
      q = Math.floor(q / stepSize) * stepSize;
    }

    if (!p || !q || q <= 0) return;

    const orderSide: "BUY" | "SELL" = side === "LONG" ? "BUY" : "SELL";

    if (orderType === "limit") {
      onPlaceOrder?.({
        market: selectedMarket,
        symbol: selectedSymbol,
        side: orderSide,
        type: "LIMIT",
        quantity: q,
        price: p,
        timeInForce: "GTC",
        positionSide: side,
      });
    } else if (orderType === "stop-limit") {
      let sp = parseFloat(stopPrice);
      if (!sp) return;

      let effectiveTickSize = tickSize;
      if (!effectiveTickSize || effectiveTickSize === DEFAULT_TICK) {
        if (sp < 1) effectiveTickSize = sp >= 0.1 ? 0.0001 : 0.00001;
        else if (sp < 10) effectiveTickSize = 0.001;
        else if (sp < 100) effectiveTickSize = 0.01;
        else effectiveTickSize = 0.1;
      }
      sp = Math.round(sp / effectiveTickSize) * effectiveTickSize;

      onPlaceOrder?.({
        market: selectedMarket,
        symbol: selectedSymbol,
        side: orderSide,
        type: "STOP_MARKET",
        quantity: q,
        stopPrice: sp,
        positionSide: side,
        workingType: "MARK_PRICE",
      });
    }

    onClose?.();
  };

  const canPlaceOrder = useMemo(() => {
    const p = parseFloat(priceValue);
    const q = parseFloat(amount) || (percent > 0 ? buyQty : 0);
    if (!p || p <= 0 || !q || q <= 0) return false;
    if (q < minQuantity) return false;
    if (orderType === "stop-limit" && !parseFloat(stopPrice)) return false;
    return true;
  }, [priceValue, amount, percent, buyQty, minQuantity, orderType, stopPrice]);

  // ===== RENDER =====
  return (
    <div className="p-4 space-y-4 bg-[#1e293b]">
      {/* Tabs Mở/Đóng */}
      <div className="flex bg-[#1a2332] rounded-lg p-1">
        <button
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
            orderAction === "open"
              ? "bg-[#2a3441] text-white"
              : "text-[#6b7280] hover:text-[#9ca3af]"
          }`}
          onClick={() => setOrderAction("open")}
        >
          Mở vị thế
        </button>
        <button
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
            orderAction === "close"
              ? "bg-[#2a3441] text-white"
              : "text-[#6b7280] hover:text-[#9ca3af]"
          }`}
          onClick={() => setOrderAction("close")}
        >
          Đóng vị thế
        </button>
      </div>

      {/* Order Type Tabs */}
      <div className="flex items-center gap-5">
        <button
          className={`text-sm pb-1.5 border-b-2 transition-all duration-200 ${
            orderType === "limit"
              ? "text-[#5b9cf6] border-[#5b9cf6]"
              : "text-[#6b7280] border-transparent hover:text-[#9ca3af]"
          }`}
          onClick={() => setOrderType("limit")}
        >
          Giới hạn
        </button>
        <button
          className={`text-sm pb-1.5 border-b-2 transition-all duration-200 ${
            orderType === "stop-limit"
              ? "text-[#5b9cf6] border-[#5b9cf6]"
              : "text-[#6b7280] border-transparent hover:text-[#9ca3af]"
          }`}
          onClick={() => setOrderType("stop-limit")}
        >
          Stop Limit
        </button>
        <button className="ml-auto text-[#6b7280] hover:text-[#9ca3af] transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
            <path d="M12 16v-4M12 8h.01" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Stop Price Input */}
      {orderType === "stop-limit" && (
        <div className="space-y-1.5">
          <label className="text-xs text-[#6b7280] uppercase tracking-wide">Giá kích hoạt</label>
          <div className="flex rounded-lg overflow-hidden border border-[#2a3441] focus-within:border-[#5b9cf6] transition-colors bg-[#1a2332]">
            <input
              type="text"
              value={stopPrice}
              onChange={(e) => setStopPrice(e.target.value.replace(/[^\d.]/g, ""))}
              className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none placeholder-[#4b5563]"
              placeholder="0.00"
            />
            <span className="px-3 py-2.5 text-sm text-[#6b7280] bg-[#1a2332]">
              USDT
            </span>
          </div>
        </div>
      )}

      {/* Price Input */}
      <div className="space-y-1.5">
        <label className="text-xs text-[#6b7280] uppercase tracking-wide">Giá đặt lệnh</label>
        <div className="flex rounded-lg overflow-hidden border border-[#2a3441] focus-within:border-[#5b9cf6] transition-colors bg-[#1a2332]">
          <input
            type="text"
            value={priceValue}
            onChange={(e) => setPriceValue(e.target.value.replace(/[^\d.]/g, ""))}
            className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none placeholder-[#4b5563]"
            placeholder="0.00"
          />
          <span className="px-3 py-2.5 text-sm text-[#6b7280] bg-[#1a2332] border-l border-[#2a3441]">
            USDT
          </span>
          <button className="px-3 py-2.5 text-sm text-[#5b9cf6] bg-[#1a2332] border-l border-[#2a3441] hover:bg-[#2a3441] transition-colors">
            BBO
          </button>
        </div>
      </div>

      {/* Quantity Input */}
      <div className="space-y-1.5">
        <label className="text-xs text-[#6b7280] uppercase tracking-wide">Số lượng</label>
        <div className="flex rounded-lg overflow-hidden border border-[#2a3441] focus-within:border-[#5b9cf6] transition-colors bg-[#1a2332]">
          <input
            type="text"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^\d.]/g, ""));
              setSliderIndex(0);
            }}
            className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none placeholder-[#4b5563]"
            placeholder="0"
          />
          <button className="px-3 py-2.5 text-sm text-white bg-[#1a2332] border-l border-[#2a3441] flex items-center gap-1.5 hover:bg-[#2a3441] transition-colors">
            {coinName}
            <svg className="w-3 h-3 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        {minQuantity > 0 && (
          <p className="text-xs text-[#6b7280] flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
              <path d="M12 16v-4M12 8h.01" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Tối thiểu: {minQuantity} {coinName}
          </p>
        )}
      </div>

      {/* Buy/Sell Quantity Display */}
      {percent > 0 && (
        <div className="flex justify-between text-xs py-2">
          <span className="text-[#6b7280]">
            Long <span className="text-[#10b981] font-medium">{formatQty(buyQty)} {coinName}</span>
          </span>
          <span className="text-[#6b7280]">
            Short <span className="text-[#ef4444] font-medium">{formatQty(sellQty)} {coinName}</span>
          </span>
        </div>
      )}

      {/* Slider */}
      <div className="py-2">
        <Slider.Root
          className="relative flex items-center select-none touch-none w-full h-5"
          value={[sliderIndex]}
          onValueChange={([val]) => setSliderIndex(Math.round(val))}
          max={SLIDER_MAX}
          step={1}
        >
          <Slider.Track className="bg-[#2a3441] relative grow rounded-full h-1">
            <Slider.Range className="absolute bg-[#5b9cf6] rounded-full h-full" />
          </Slider.Track>
          <Slider.Thumb className="block w-4 h-4 bg-[#5b9cf6] rounded-full shadow-md focus:outline-none cursor-grab active:cursor-grabbing" />
        </Slider.Root>
        <div className="flex justify-between text-xs mt-2">
          {ALLOWED_PERCENTAGES.map((p, idx) => (
            <button
              key={p}
              className={`px-2 py-0.5 rounded transition-all duration-200 ${
                sliderIndex === idx
                  ? "bg-blue-700 text-white"
                  : "text-[#6b7280] hover:text-white"
              }`}
              onClick={() => setSliderIndex(idx)}
            >
              {p}%
            </button>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={() => handleSubmit("LONG")}
          disabled={!canPlaceOrder}
          className="flex-1 py-2.5 bg-[#10b981] hover:bg-[#059669] disabled:bg-[#1a2332] disabled:text-[#4b5563] disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          Long / Mua
        </button>
        <button
          onClick={() => handleSubmit("SHORT")}
          disabled={!canPlaceOrder}
          className="flex-1 py-2.5 bg-[#ef4444] hover:bg-[#dc2626] disabled:bg-[#1a2332] disabled:text-[#4b5563] disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          Short / Bán
        </button>
      </div>

      {/* Estimate Panel */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs pt-3 border-t border-[#2a3441]">
        <div className="flex justify-between">
          <span className="text-[#6b7280]">Giá thanh lý</span>
          <span className="text-white">
            {est.liqPriceLong ? est.liqPriceLong.toFixed(priceDecimals) : "--"} <span className="text-[#6b7280]">USDT</span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6b7280]">Giá thanh lý</span>
          <span className="text-white">
            {est.liqPriceShort ? est.liqPriceShort.toFixed(priceDecimals) : "--"} <span className="text-[#6b7280]">USDT</span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6b7280]">Chi phí</span>
          <span className="text-white">
            {est.fee.toFixed(4)} <span className="text-[#6b7280]">USDT</span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6b7280]">Chi phí</span>
          <span className="text-white">
            {est.fee.toFixed(4)} <span className="text-[#6b7280]">USDT</span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6b7280]">Tối đa</span>
          <span className="text-white">
            {formatQty(est.maxBuyQty)} <span className="text-[#6b7280]">{coinName}</span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6b7280]">Tối đa</span>
          <span className="text-white">
            {formatQty(est.maxSellQty)} <span className="text-[#6b7280]">{coinName}</span>
          </span>
        </div>
        <div className="col-span-2 flex items-center justify-center gap-2 pt-2 mt-1 border-t border-[#2a3441]">
          <span className="text-[#6b7280]">Phí giao dịch:</span>
          <span className="text-[#5b9cf6]">
            {(getFeeRate(orderType) * 100).toFixed(3)}%
          </span>
          <span className="text-[#9ca3af] px-1.5 py-0.5 rounded bg-[#2a3441] text-[10px]">
            {orderType === "limit" ? "Maker" : "Taker"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChartOrderForm;