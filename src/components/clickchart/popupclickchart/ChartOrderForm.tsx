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
  // Nhận từ parent để tính toán chính xác
  availableBalance?: number;
  leverage?: number;
  // Callbacks
  onPlaceOrder?: (params: PlaceOrderParams) => void;
  // Symbol info (optional - có thể truyền từ parent hoặc tự fetch)
  symbolInfo?: SymbolInfo;
}

type OrderTypeBin = "limit" | "stop-limit";
type OrderAction = "open" | "close";

// ===== Helpers =====
const roundStep = (v: number, step: number) => Math.floor(v / step) * step;
const decimalsFromTick = (tick: number) => {
  if (!Number.isFinite(tick)) return 2;
  const s = tick.toString();
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
};

const DEFAULT_TICK = 0.0001;
const DEFAULT_STEP = 0.01;
const DEFAULT_TAKER = 0.0005;
const DEFAULT_MAKER = 0.0002;
const getFeeRate = (orderType: OrderTypeBin) =>
  orderType === "limit" ? DEFAULT_MAKER : DEFAULT_TAKER;

const DEFAULT_LEVERAGE = 10;

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
  const [percent, setPercent] = useState(0);

  // Symbol info từ props hoặc defaults
  const tickSize = propSymbolInfo?.tickSize || DEFAULT_TICK;
  
  // Auto detect stepSize dựa vào symbol nếu không được truyền
  const getDefaultStepSize = (symbol: string): number => {
    const s = symbol.toUpperCase();
    // Coins có stepSize = 1 (số nguyên)
    if (s.includes('DOGE') || s.includes('SHIB') || s.includes('PEPE') || 
        s.includes('FLOKI') || s.includes('LUNC') || s.includes('XRP') ||
        s.includes('TRX') || s.includes('ADA') || s.includes('MATIC')) {
      return 1;
    }
    // Coins có stepSize nhỏ
    if (s.includes('BTC') || s.includes('ETH')) {
      return 0.001;
    }
    // Default
    return 0.01;
  };
  
  const stepSize = propSymbolInfo?.stepSize || getDefaultStepSize(selectedSymbol);
  const minQty = propSymbolInfo?.minQty || 0;
  const minNotional = propSymbolInfo?.minNotional || 0;

  // Debug log
  React.useEffect(() => {
    console.log('[ChartOrderForm] Symbol info:', {
      selectedSymbol,
      tickSize,
      stepSize,
      propSymbolInfo,
    });
  }, [selectedSymbol, tickSize, stepSize, propSymbolInfo]);

  // Balance và leverage từ props
  const availableBalance = propBalance;
  const leverage = propLeverage;

  const coinName = selectedSymbol.replace("USDT", "").replace("BUSD", "");
  
  // Tính decimals từ tickSize hoặc từ giá
  const priceDecimals = useMemo(() => {
    if (tickSize && tickSize < 1) {
      return decimalsFromTick(tickSize);
    }
    // Fallback dựa vào giá
    if (propPrice >= 1000) return 2;
    if (propPrice >= 100) return 2;
    if (propPrice >= 10) return 3;
    if (propPrice >= 1) return 4;
    if (propPrice >= 0.1) return 5;
    return 6;
  }, [tickSize, propPrice]);
  
  const qtyDecimals = decimalsFromTick(stepSize);

  // Helper làm tròn giá theo tickSize
  const roundPrice = (price: number): string => {
    if (tickSize > 0) {
      const rounded = Math.round(price / tickSize) * tickSize;
      return rounded.toFixed(priceDecimals);
    }
    return price.toFixed(priceDecimals);
  };

  // Helper làm tròn số lượng theo stepSize
  const roundQty = (qty: number): number => {
    if (stepSize > 0) {
      return Math.floor(qty / stepSize) * stepSize;
    }
    return qty;
  };

  // Helper format số lượng để hiển thị (không có số thập phân nếu stepSize >= 1)
  const formatQty = (qty: number): string => {
    const rounded = roundQty(qty);
    if (stepSize >= 1) {
      return String(Math.round(rounded));
    }
    return rounded.toFixed(qtyDecimals);
  };

  // Set initial price - CHỈ set 1 lần khi mount, đã làm tròn
  const priceInitRef = React.useRef(false);
  
  useEffect(() => {
    if (propPrice > 0 && !priceInitRef.current) {
      const roundedPrice = roundPrice(propPrice);
      console.log('[ChartOrderForm] Setting initial price:', propPrice, '→', roundedPrice);
      setPriceValue(roundedPrice);
      priceInitRef.current = true;
    }
  }, [propPrice]);

  // Reset ref khi component unmount
  useEffect(() => {
    return () => {
      priceInitRef.current = false;
    };
  }, []);

  // Reset form khi symbol thay đổi
  useEffect(() => {
    setAmount("");
    setPercent(0);
    setStopPrice("");
  }, [selectedSymbol]);

  // Giá hiệu dụng
  const priceNum = parseFloat(priceValue) || propPrice || 0;

  // Tính min quantity từ minNotional
  const minQuantity = useMemo(() => {
    if (!minNotional || !priceNum || priceNum <= 0) return minQty;
    const minQtyFromNotional = minNotional / priceNum;
    return Math.max(minQty, Math.ceil(minQtyFromNotional / stepSize) * stepSize);
  }, [minNotional, priceNum, minQty, stepSize]);

  // Tính buyQty giống TradingForm
  const buyQty = useMemo(() => {
    if (percent === 0 || !priceNum || priceNum <= 0) return 0;

    const buyingPower =
      selectedMarket === "futures"
        ? availableBalance * leverage
        : availableBalance;
    
    const notional = (buyingPower * percent) / 100;
    const rawQty = notional / priceNum;
    return Math.floor(rawQty / stepSize) * stepSize;
  }, [percent, priceNum, availableBalance, leverage, selectedMarket, stepSize]);

  // Tính sellQty giống TradingForm (Short nhiều hơn ~1.5%)
  const sellQty = useMemo(() => {
    if (percent === 0 || !priceNum || priceNum <= 0) return 0;

    const buyingPower =
      selectedMarket === "futures"
        ? availableBalance * leverage
        : availableBalance;
    
    const notional = (buyingPower * percent) / 100;
    const shortFactor = 1.015; // +1.5% như Binance
    const adjustedNotional = notional * shortFactor;
    
    const rawQty = adjustedNotional / priceNum;
    return Math.floor(rawQty / stepSize) * stepSize;
  }, [percent, priceNum, availableBalance, leverage, selectedMarket, stepSize]);

  // Số lượng từ input hoặc slider
  const qtyNum = parseFloat(amount) || buyQty || 0;

  // Tính maxQty
  const maxBuyQty = useMemo(() => {
    if (!priceNum || priceNum <= 0) return 0;
    const buyingPower =
      selectedMarket === "futures"
        ? availableBalance * leverage
        : availableBalance;
    const rawQty = buyingPower / priceNum;
    return Math.floor(rawQty / stepSize) * stepSize;
  }, [priceNum, availableBalance, leverage, selectedMarket, stepSize]);

  const maxSellQty = useMemo(() => {
    // Short: dùng factor 1.015 như TradingForm
    return Math.floor((maxBuyQty * 1.015) / stepSize) * stepSize;
  }, [maxBuyQty, stepSize]);

  // Tính estimate giống TradingForm
  const est = useMemo(() => {
    const notional = priceNum * qtyNum;
    const feeRate = getFeeRate(orderType);
    const fee = notional * feeRate;

    // Giá thanh lý (công thức đơn giản)
    let liqPriceLong: number | undefined;
    let liqPriceShort: number | undefined;
    
    if (selectedMarket === "futures" && leverage > 1 && qtyNum > 0) {
      const mmr = 0.004; // Maintenance Margin Rate
      liqPriceLong = priceNum * (1 - 1 / leverage + mmr);
      liqPriceShort = priceNum * (1 + 1 / leverage - mmr);
    }

    return {
      notional,
      fee,
      maxBuyQty,
      maxSellQty,
      liqPriceLong,
      liqPriceShort,
    };
  }, [priceNum, qtyNum, orderType, selectedMarket, leverage, maxBuyQty, maxSellQty]);

  // Update amount khi slider thay đổi
  useEffect(() => {
    if (percent > 0 && maxBuyQty > 0) {
      const qty = roundQty(maxBuyQty * percent / 100);
      // Format theo stepSize: nếu stepSize >= 1 thì không có số thập phân
      const formatted = stepSize >= 1 ? String(Math.round(qty)) : qty.toFixed(qtyDecimals);
      setAmount(qty > 0 ? formatted : "");
    } else if (percent === 0) {
      // Không clear amount khi percent = 0, giữ nguyên input thủ công
    }
  }, [percent, maxBuyQty, stepSize, qtyDecimals]);

  // Allowed percentages
  const ALLOWED_PERCENTAGES = [0, 0.5, 1, 2, 3, 4];

  const findNearestAllowedPercent = (value: number): number => {
    return ALLOWED_PERCENTAGES.reduce((prev, curr) =>
      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    );
  };

  // Handle submit
  const handleSubmit = (side: "LONG" | "SHORT") => {
    const p = parseFloat(priceValue);
    let q: number;

    if (amount && parseFloat(amount) > 0) {
      q = parseFloat(amount);
    } else if (percent > 0) {
      q = side === "LONG" ? buyQty : sellQty;
    } else {
      console.warn("[ChartOrderForm] Invalid quantity");
      return;
    }

    if (!p || !q || q <= 0) {
      console.warn("[ChartOrderForm] Invalid price or quantity");
      return;
    }

    const orderSide: "BUY" | "SELL" = side === "LONG" ? "BUY" : "SELL";
    const positionSide = side;

    console.log('[ChartOrderForm] Submitting order:', {
      priceValue,
      parsedPrice: p,
      quantity: q,
      side,
      orderType,
    });

    if (orderType === "limit") {
      const orderParams = {
        market: selectedMarket,
        symbol: selectedSymbol,
        side: orderSide,
        type: "LIMIT" as const,
        quantity: q,
        price: p,
        timeInForce: "GTC" as const,
        positionSide,
      };
      console.log('[ChartOrderForm] LIMIT order params:', orderParams);
      onPlaceOrder?.(orderParams);
    } else if (orderType === "stop-limit") {
      const sp = parseFloat(stopPrice);
      if (!sp) {
        console.warn("[ChartOrderForm] Stop price required");
        return;
      }
      const orderParams = {
        market: selectedMarket,
        symbol: selectedSymbol,
        side: orderSide,
        type: "STOP_MARKET" as const,
        quantity: q,
        stopPrice: sp,
        positionSide,
        workingType: "MARK_PRICE" as const,
      };
      console.log('[ChartOrderForm] STOP order params:', orderParams);
      onPlaceOrder?.(orderParams);
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

  return (
    <div className="p-fluid-4 space-y-4">
      {/* Tabs Mở/Đóng */}
      <div className="flex bg-[#2b3139] rounded-lg p-1">
        <button
          className={`flex-1 py-2 text-fluid-sm rounded-fluid-md transition-colors ${
            orderAction === "open"
              ? "bg-[#3c4043] text-white"
              : "text-[#848e9c] hover:text-white"
          }`}
          onClick={() => setOrderAction("open")}
        >
          Mở
        </button>
        <button
          className={`flex-1 py-2 text-fluid-sm rounded-fluid-md transition-colors ${
            orderAction === "close"
              ? "bg-[#3c4043] text-white"
              : "text-[#848e9c] hover:text-white"
          }`}
          onClick={() => setOrderAction("close")}
        >
          Đóng
        </button>
      </div>

      {/* Order Type Tabs */}
      <div className="flex items-center gap-fluid-4">
        <button
          className={`text-fluid-sm pb-1 border-b-2 transition-colors ${
            orderType === "limit"
              ? "text-[#f0b90b] border-[#f0b90b]"
              : "text-[#848e9c] border-transparent hover:text-white"
          }`}
          onClick={() => setOrderType("limit")}
        >
          Giới hạn
        </button>
        <button
          className={`text-fluid-sm pb-1 border-b-2 transition-colors ${
            orderType === "stop-limit"
              ? "text-[#f0b90b] border-[#f0b90b]"
              : "text-[#848e9c] border-transparent hover:text-white"
          }`}
          onClick={() => setOrderType("stop-limit")}
        >
          Stop Limit
        </button>
        <button className="ml-auto text-[#848e9c] hover:text-white">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </button>
      </div>

      {/* Stop Price Input */}
      {orderType === "stop-limit" && (
        <div>
          <label className="text-xs text-[#848e9c] mb-1.5 block">Giá Stop</label>
          <div className="flex">
            <input
              type="text"
              value={stopPrice}
              onChange={(e) => setStopPrice(e.target.value.replace(/[^\d.]/g, ""))}
              className="flex-1 bg-[#2b3139] border border-[#3c4043] rounded-l px-fluid-3 py-2.5 text-fluid-sm text-white outline-none focus:border-[#f0b90b]"
              placeholder="0"
            />
            <span className="px-fluid-3 py-2.5 bg-[#2b3139] border border-l-0 border-[#3c4043] rounded-r text-fluid-sm text-[#848e9c]">
              USDT
            </span>
          </div>
        </div>
      )}

      {/* Price Input */}
      <div>
        <label className="text-xs text-[#848e9c] mb-1.5 block">Giá</label>
        <div className="flex">
          <input
            type="text"
            value={priceValue}
            onChange={(e) => setPriceValue(e.target.value.replace(/[^\d.]/g, ""))}
            className="flex-1 bg-[#2b3139] border border-[#3c4043] rounded-l px-fluid-3 py-2.5 text-fluid-sm text-white outline-none focus:border-[#f0b90b]"
            placeholder="0"
          />
          <span className="px-fluid-3 py-2.5 bg-[#2b3139] border border-l-0 border-[#3c4043] text-fluid-sm text-[#848e9c]">
            USDT
          </span>
          <button className="px-fluid-3 py-2.5 bg-[#2b3139] border border-l-0 border-[#3c4043] rounded-r text-fluid-sm text-[#848e9c] hover:text-white">
            BBO
          </button>
        </div>
      </div>

      {/* Quantity Input */}
      <div>
        <label className="text-xs text-[#848e9c] mb-1.5 block">Số lượng</label>
        <div className="flex">
          <input
            type="text"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^\d.]/g, ""));
              setPercent(0); // Reset slider khi nhập thủ công
            }}
            className="flex-1 bg-[#2b3139] border border-[#3c4043] rounded-l px-fluid-3 py-2.5 text-fluid-sm text-white outline-none focus:border-[#f0b90b]"
            placeholder="0"
          />
          <button className="px-fluid-3 py-2.5 bg-[#2b3139] border border-l-0 border-[#3c4043] rounded-r text-fluid-sm text-white flex items-center gap-fluid-1">
            {coinName}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        {minQuantity > 0 && (
          <p className="text-xs text-[#848e9c] mt-1 flex items-center gap-fluid-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            Số lượng tối thiểu là {minQuantity} {coinName}
          </p>
        )}
      </div>

      {/* Hiển thị Mua/Bán số lượng */}
      {percent > 0 && (
        <div className="flex justify-between text-xs text-[#848e9c]">
          <span>Mua <span className="text-white">{formatQty(buyQty)} {coinName}</span></span>
          <span>Bán <span className="text-white">{formatQty(sellQty)} {coinName}</span></span>
        </div>
      )}

      {/* Slider */}
      <div className="pt-2 pb-4">
        <Slider.Root
          className="relative flex items-center select-none touch-none w-full h-5"
          value={[percent]}
          onValueChange={([val]) => setPercent(findNearestAllowedPercent(val))}
          max={4}
          step={0.1}
        >
          <Slider.Track className="bg-[#2b3139] relative grow rounded-full h-1">
            <Slider.Range className="absolute bg-[#f0b90b] rounded-full h-full" />
          </Slider.Track>
          <Slider.Thumb className="block w-4 h-4 bg-[#f0b90b] rounded-full focus:outline-none" />
        </Slider.Root>
        <div className="flex justify-between text-xs text-[#848e9c] mt-1">
          {ALLOWED_PERCENTAGES.map((p) => (
            <span
              key={p}
              className={`cursor-pointer hover:text-white ${percent === p ? "text-[#f0b90b]" : ""}`}
              onClick={() => setPercent(p)}
            >
              {p}%
            </span>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-fluid-3">
        <button
          onClick={() => handleSubmit("LONG")}
          disabled={!canPlaceOrder}
          className="flex-1 py-2.5 bg-[#0ecb81] hover:bg-[#0ecb81]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-fluid-sm font-medium rounded transition-colors"
        >
          Mở lệnh Long
        </button>
        <button
          onClick={() => handleSubmit("SHORT")}
          disabled={!canPlaceOrder}
          className="flex-1 py-2.5 bg-[#f6465d] hover:bg-[#f6465d]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-fluid-sm font-medium rounded transition-colors"
        >
          Mở lệnh Short
        </button>
      </div>

      {/* Estimate Panel - Giống TradingForm */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pt-2 border-t border-[#2b3139]">
        <div className="text-[#848e9c]">
          Giá thanh lý{" "}
          <span className="text-white">
            {est.liqPriceLong ? est.liqPriceLong.toFixed(priceDecimals) : "--"} USDT
          </span>
        </div>
        <div className="text-[#848e9c] text-right">
          Giá thanh lý{" "}
          <span className="text-white">
            {est.liqPriceShort ? est.liqPriceShort.toFixed(priceDecimals) : "--"} USDT
          </span>
        </div>
        <div className="text-[#848e9c]">
          Chi phí <span className="text-white">{est.fee.toFixed(2)} USDT</span>
        </div>
        <div className="text-[#848e9c] text-right">
          Chi phí <span className="text-white">{est.fee.toFixed(2)} USDT</span>
        </div>
        <div className="text-[#848e9c]">
          Tối đa <span className="text-white">{formatQty(est.maxBuyQty)} {coinName}</span>
        </div>
        <div className="text-[#848e9c] text-right">
          Tối đa <span className="text-white">{formatQty(est.maxSellQty)} {coinName}</span>
        </div>
        <div className="col-span-2 text-[#848e9c] mt-1">
          % Mức phí: {(getFeeRate(orderType) * 100).toFixed(3)}% ({orderType === "limit" ? "Maker" : "Taker"})
        </div>
      </div>
    </div>
  );
};

export default ChartOrderForm;