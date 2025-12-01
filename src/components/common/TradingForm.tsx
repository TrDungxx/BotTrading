import React, { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom"; // ✅ THÊM IMPORT
import * as Slider from "@radix-ui/react-slider";
import MarginModeModal from "../modeltrading/MarginModeModal";
import LeverageModal from "../modeltrading/LeverageModal";
import { binanceWS } from "../binancewebsocket/BinanceWebSocketService";
import { binanceAccountApi } from "../../utils/api";
import MultiAssetsModeModal from "../formtrading/MultiAssetsModeModal";
import TpSlModal from "../formtrading/TpSlModal";
import { ExternalLink } from "lucide-react";
import ConfirmPlaceOrderModal from "./formtrading/ConfirmPlaceOrderModal";
import TpSlModeSelect from "../modeltrading/TpSlModeSelect";
import TriggerTypeSelect from "../modeltrading/TriggerTypeSelect";
import { TpSlConverter } from "../../utils/TpSlConverter";
import UnitSelectModal from "../modeltrading/UnitSelectModal";
import TpSlTooltip from "../modeltrading/TpSlTooltip";
import { binanceSymbolInfo } from "../../utils/BinanceSymbolInfo";
import EstimatePanel from "../modeltrading/EstimatePanel";
// ===== Types =====
interface Props {
  selectedSymbol: string;
  price: number;
  internalBalance?: number;
  selectedMarket?: "spot" | "futures";
}

interface BinanceAccount {
  id: number;
  Name?: string;
  status?: number;
  description?: string;
}

type OrderTypeBin = "limit" | "market" | "stop-limit";
type Side = "buy" | "sell";
type BalanceSource = "ws-live" | "snapshot" | "database-cache" | "none";
type OrderAction = "open" | "close";
type TpSlMode = "price" | "pnl" | "roi";

// ===== Helpers =====
const roundStep = (v: number, step: number) => Math.floor(v / step) * step;
const roundTick = (v: number, tick: number) => Math.round(v / tick) * tick;
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
  orderType === "market" ? DEFAULT_TAKER : DEFAULT_MAKER;
const DEFAULT_MMR = 0.004;

const SYMBOL_META: Record<string, { tick: number; step: number }> = {
  "1000PEPEUSDT": { tick: 0.000001, step: 1 },
  "DOGEUSDT": { tick: 0.00001, step: 1 }, // ✅ THÊM DÒNG NÀY
};

function estimate({
  price,
  qty,
  leverage,
  orderType,
  market,
  availableBalance,
  tickSize = DEFAULT_TICK,
  stepSize = DEFAULT_STEP,
  mmr = DEFAULT_MMR,
  side,
}: {
  price: number;
  qty: number;
  leverage: number;
  orderType: OrderTypeBin;
  market: "spot" | "futures";
  availableBalance: number;
  tickSize?: number;
  stepSize?: number;
  mmr?: number;
  side: Side;
}) {
  if (!Number.isFinite(price) || price <= 0) {
    return {
      notional: 0,
      fee: 0,
      initMargin: 0,
      maxQty: 0,
      liqPrice: undefined as number | undefined,
    };
  }

  const notional = Math.max(0, price * Math.max(qty, 0));
  const feeRate = getFeeRate(orderType);
  const fee = notional * feeRate;

  const buyingPower =
    market === "futures"
      ? Math.max(0, availableBalance) * Math.max(leverage, 1)
      : Math.max(0, availableBalance);
  const rawMaxQty = buyingPower / price;
  const maxQty = roundStep(Math.max(0, rawMaxQty), stepSize);

  const initMargin =
    market === "futures" ? notional / Math.max(leverage, 1) : 0;

  let liqPrice: number | undefined;
  if (market === "futures" && leverage > 1 && qty > 0) {
    liqPrice =
      side === "buy"
        ? price * (1 - 1 / leverage + mmr)
        : price * (1 + 1 / leverage - mmr);
    liqPrice = roundTick(liqPrice, tickSize);
  }

  return { notional, fee, initMargin, maxQty, liqPrice };
}

const roundStepUp = (v: number, step: number) =>
  Math.ceil((v + 1e-12) / step) * step;

const qtyDecimals = (step: number) => decimalsFromTick(step);

const clampQtyToMax = ({
  qty,
  price,
  balance,
  leverage,
  market,
  step,
}: {
  qty: number;
  price: number;
  balance: number;
  leverage: number;
  market: "spot" | "futures";
  step: number;
}) => {
  const buyingPower = market === "futures" ? balance * leverage : balance;
  const rawMax = buyingPower > 0 && price > 0 ? buyingPower / price : 0;
  const maxFloor = Math.floor((rawMax + 1e-12) / step) * step;
  return Math.min(qty, Math.max(0, maxFloor));
};

// ===== Component =====
const TradingForm: React.FC<Props> = ({
  selectedSymbol,
  price,
  internalBalance: propInternal = 0,
  selectedMarket: propMarket = "futures",
}) => {
  const [orderAction, setOrderAction] = useState<OrderAction>("open");

  // Accounts
  const [accounts, setAccounts] = useState<BinanceAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null
  );
  // Thêm constant cho các mốc % cho phép
  const ALLOWED_PERCENTAGES = [0, 0.5, 1, 2, 3, 4];

  // Hàm tìm mốc % gần nhất
  const findNearestAllowedPercent = (value: number): number => {
    return ALLOWED_PERCENTAGES.reduce((prev, curr) => {
      return Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev;
    });
  };
  // Modes
  const [isMultiAssetsOpen, setIsMultiAssetsOpen] = useState(false);
  const [multiAssetsMode, setMultiAssetsMode] = useState<boolean | null>(null);
  const [dualSide, setDualSide] = useState<boolean>(true);
  // ✅ Load PositionMode từ Binance API khi mount/đổi account
useEffect(() => {
  const loadPositionMode = () => {
    console.log('🔄 Calling getPositionMode...');
    
    binanceWS.getPositionMode((isDual) => {
      console.log('📋 PositionMode loaded:', isDual ? 'HEDGE' : 'ONE-WAY', 'isDual=', isDual);
      setDualSide(isDual);
    });
  };

  // ✅ DELAY để đảm bảo WS đã authenticated
  const timer = setTimeout(() => {
    console.log('⏰ Timer fired, loading PositionMode...');
    loadPositionMode();
  }, 500);

  // Listen cho event đổi account để reload
  const handler = (msg: any) => {
    console.log('📨 WS Message received:', msg?.type); // Debug all messages
    
    if (msg?.type === 'getPositionMode') {
      console.log('✅ getPositionMode response:', msg);
    }
    
    if (msg?.type === 'selectBinanceAccountResult' || msg?.type === 'authenticated') {
      setTimeout(loadPositionMode, 300);
    }
  };

  binanceWS.onMessage(handler);
  
  return () => {
    clearTimeout(timer);
    binanceWS.removeMessageHandler(handler);
  };
}, [selectedAccountId]);
  const [stopPrice, setStopPrice] = useState("");
  const [stopPriceType, setStopPriceType] = useState<"MARK" | "LAST">("MARK");
  const [tpTriggerType, setTpTriggerType] = useState<"MARK" | "LAST">("MARK");
  const [slTriggerType, setSlTriggerType] = useState<"MARK" | "LAST">("MARK");
  const [tpTooltipShow, setTpTooltipShow] = useState(false);
  const [slTooltipShow, setSlTooltipShow] = useState(false);
  const tpInputRef = useRef<HTMLInputElement>(null);
  const slInputRef = useRef<HTMLInputElement>(null);
  const [minQtyError, setMinQtyError] = useState(false);
  const priceInitializedRef = useRef<string>("");

  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<"base" | "quote">("base");
  const [usdtMode, setUsdtMode] = useState<"total" | "margin">("total");
  const [maxRiskError, setMaxRiskError] = useState(false);
  // UI/Order state
  const [isPriceOverridden, setIsPriceOverridden] = useState(false);
  const [tradeSide, setTradeSide] = useState<Side>("buy");
  const [orderType, setOrderType] = useState<OrderTypeBin>("market");
  const [priceValue, setPriceValue] = useState("");
  const [amount, setAmount] = useState("");
  const [percent, setPercent] = useState(0);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [sliderQty, setSliderQty] = useState(0);
  const [tif, setTif] = useState<"GTC" | "IOC" | "FOK">(() => {
    const saved = localStorage.getItem("tradingForm_tif");
    return (saved as "GTC" | "IOC" | "FOK") || "GTC";
  });



  // Thêm useEffect để lưu khi thay đổi
  useEffect(() => {
    localStorage.setItem("tradingForm_tif", tif);
  }, [tif]);
  const [isMarginOpen, setIsMarginOpen] = useState(false);
  const [isLeverageOpen, setIsLeverageOpen] = useState(false);
  const [marginMode, setMarginMode] = useState<"cross" | "isolated">("cross");
  const [leverage, setLeverage] = useState(2);
  const [selectedMarket, setSelectedMarket] = useState<"spot" | "futures">(
    propMarket
  );

  // TP/SL Mode
  const [tpMode, setTpMode] = useState<TpSlMode>("price");
  const [slMode, setSlMode] = useState<TpSlMode>("price");

  // Confirm Order
  type ConfirmSide = "LONG" | "SHORT";
  type ConfirmOrder = {
    symbol: string;
    market: "spot" | "futures";
    type: "MARKET" | "LIMIT" | "STOP_MARKET";
    side: "BUY" | "SELL";
    quantity: number;
    price?: number;
    stopPrice?: number;
    timeInForce?: "GTC" | "IOC" | "FOK";
    workingType?: "MARK" | "LAST";
    positionSide?: "LONG" | "SHORT" | "BOTH";
    reduceOnly?: boolean;
  };

  const [currentPosition, setCurrentPosition] = useState(0);

  // Subscribe position updates
  useEffect(() => {
    const handler = (msg: any) => {
      if (msg.e === "ACCOUNT_UPDATE" && msg.a?.P) {
        const positions = msg.a.P;
        const pos = positions.find((p: any) => p.s === selectedSymbol);

        if (pos) {
          const qty = Math.abs(parseFloat(pos.pa || "0"));
          setCurrentPosition(qty);
        } else {
          setCurrentPosition(0);
        }
      }

      if (msg.type === "futuresDataLoaded" && msg.data?.positions) {
        const pos = msg.data.positions.find(
          (p: any) => p.symbol === selectedSymbol
        );
        if (pos) {
          const qty = Math.abs(parseFloat(pos.positionAmt || "0"));
          setCurrentPosition(qty);
        } else {
          setCurrentPosition(0);
        }
      }
    };

    binanceWS.onMessage(handler);
    return () => binanceWS.removeMessageHandler(handler);
  }, [selectedSymbol]);

  useEffect(() => {
    setCurrentPosition(0);
  }, [selectedSymbol]);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmSide, setConfirmSide] = useState<ConfirmSide>("LONG");
  const [confirmOrder, setConfirmOrder] = useState<ConfirmOrder | null>(null);

  const canPlaceOrder = useMemo(() => {
    // ✅ FIX: Check amount HOẶC percent > 0 (slider đang được dùng)
    const manualQty = parseFloat(amount || "0");
    const hasValidQty = (Number.isFinite(manualQty) && manualQty > 0) || percent > 0;
    
    if (!hasValidQty) return false;

    if (orderType === "limit") {
      const p = parseFloat(priceValue || "0");
      if (!Number.isFinite(p) || p <= 0) return false;
    }

    if (orderType === "stop-limit") {
      const sp = parseFloat(stopPrice || "0");
      if (!Number.isFinite(sp) || sp <= 0) return false;
    }

    return true;
  }, [amount, percent, orderType, priceValue, stopPrice]);

  const openConfirm = (side: ConfirmSide) => {
    // ✅ FIX: Chọn qty dựa trên side (Long dùng buyQty, Short dùng sellQty)
    let finalQty: number;
    
    if (amount && parseFloat(amount) > 0) {
      // User nhập thủ công -> dùng amount
      finalQty = parseFloat(amount);
    } else if (percent > 0) {
      // User kéo slider -> dùng buyQty hoặc sellQty tùy side
      finalQty = side === "LONG" ? buyQty : sellQty;
    } else {
      finalQty = 0;
    }

    if (!Number.isFinite(finalQty) || finalQty <= 0) {
      alert("⚠️ Vui lòng nhập số lượng hoặc kéo thanh trượt");
      return;
    }

    // ✅ Làm tròn quantity theo stepSize
    finalQty = roundStep(finalQty, stepSize);

    // ✅ DOUBLE CHECK
    if (stepSize >= 1) {
      finalQty = Math.floor(finalQty);
    }

    // ✅ CHECK MIN QUANTITY với animation
    if (finalQty < minQuantity) {
      setMinQtyError(true);
      setTimeout(() => setMinQtyError(false), 2000);
      return; // ✅ Return ở đây
    }

    // ✅ CHECK MAX RISK 5% - PHẢI Ở NGOÀI block minQtyError
    if (orderRiskPercent > MAX_RISK_PERCENT) {
      setMaxRiskError(true);
      setTimeout(() => setMaxRiskError(false), 2000);
      return;
    }

    if (finalQty <= 0) {
      alert("⚠️ Số lượng quá nhỏ, vui lòng tăng lên");
      return;
    }

    let orderSide: "BUY" | "SELL";
    if (orderAction === "open") {
      orderSide = side === "LONG" ? "BUY" : "SELL";
    } else {
      orderSide = side === "LONG" ? "SELL" : "BUY";
    }

    const base: ConfirmOrder = {
      symbol: selectedSymbol,
      market: selectedMarket,
      side: orderSide,
      quantity: finalQty,
      type:
        orderType === "market"
          ? "MARKET"
          : orderType === "limit"
            ? "LIMIT"
            : "STOP_MARKET",
    };

    if (base.type === "LIMIT") {
      const p = parseFloat(priceValue || "0");
      if (!Number.isFinite(p) || p <= 0) {
        alert("⚠️ Vui lòng nhập giá hợp lệ");
        return;
      }
      base.price = roundTick(p, tickSize);
      base.timeInForce = tif;
    }

    if (base.type === "STOP_MARKET") {
      const sp = parseFloat(stopPrice || "0");
      if (!Number.isFinite(sp) || sp <= 0) {
        alert("⚠️ Vui lòng nhập giá Stop hợp lệ");
        return;
      }
      base.stopPrice = roundTick(sp, tickSize);
      base.workingType = stopPriceType;
    }

    if (selectedMarket === "futures") {
      base.positionSide = dualSide ? side : "BOTH";

      if (orderAction === "close") {
        if (base.type === "LIMIT" || base.type === "STOP_MARKET") {
          base.reduceOnly = true;
        }
      }
    }



    if (tpSl && orderAction === "open") {
  const inlineOrders: any[] = [];
  
  // ✅ FIX: Xác định side cho TP/SL dựa trên position side
  const tpSlSide: Side = side === "LONG" ? "buy" : "sell";

  if (tpSlValues.takeProfitEnabled && tpSlValues.takeProfitPrice) {
    const tpPrice = TpSlConverter.toPrice(
      tpMode,
      tpSlValues.takeProfitPrice,
      price,
      finalQty,
      tpSlSide,  // ✅ FIX: thay tradeSide bằng tpSlSide
      "tp",
      leverage
    );

    if (tpPrice && parseFloat(tpPrice) > 0) {
      inlineOrders.push({
        type: "TAKE_PROFIT_MARKET",
        stopPrice: roundTick(parseFloat(tpPrice), tickSize),
        triggerType: tpTriggerType,
      });
    }
  }

  if (tpSlValues.stopLossEnabled && tpSlValues.stopLossPrice) {
    const slPrice = TpSlConverter.toPrice(
      slMode,
      tpSlValues.stopLossPrice,
      price,
      finalQty,
      tpSlSide,  // ✅ FIX: thay tradeSide bằng tpSlSide
      "sl",
      leverage
    );

    if (slPrice && parseFloat(slPrice) > 0) {
      inlineOrders.push({
        type: "STOP_MARKET",
        stopPrice: roundTick(parseFloat(slPrice), tickSize),
        triggerType: slTriggerType,
      });
    }
  }

  setTpSlOrders([...tpSlOrders, ...inlineOrders]);
}

    setConfirmSide(side);
    setConfirmOrder(base);
    setIsConfirmOpen(true);
  };



  // Balance tracking
  const [internalBalance, setInternalBalance] = useState<number>(propInternal);
  const [balanceSource, setBalanceSource] = useState<BalanceSource>("none");
  const RANK: Record<BalanceSource, number> = {
    "ws-live": 3,
    snapshot: 2,
    "database-cache": 1,
    none: 0,
  };
  const setBalanceIfHigherPriority = (
    val: number,
    source: BalanceSource | null | undefined
  ) => {
    const s: BalanceSource = source ?? 'none';
    console.log('💰 Balance Update Attempt:', {
      newValue: val,
      newSource: s,
      currentValue: internalBalance,
      currentSource: balanceSource,
      willUpdate: RANK[s] > RANK[balanceSource],
      timestamp: new Date().toISOString()
    });

    if (RANK[s] > RANK[balanceSource]) {
      setInternalBalance(val);
      setBalanceSource(s);
    }
  };

  // TP/SL state
  const [isTpSlModalOpen, setIsTpSlModalOpen] = useState(false);
  const [tpSlSide, setTpSlSide] = useState<Side>("buy");
  const [tpSl, setTpSl] = useState(false);
  const [tpSlOrders, setTpSlOrders] = useState<any[]>([]);
  const [tpSlValues, setTpSlValues] = useState({
    takeProfitPrice: "",
    stopLossPrice: "",
    takeProfitEnabled: true,
    stopLossEnabled: true,
  });


  // ✅ Flag để track đã load localStorage chưa
  const tpSlLoadedRef = useRef(false);

  // Leverage LS helpers
  const levKey = (
    accId: number | null,
    market: "spot" | "futures",
    symbol: string
  ) => `tw_leverage_${accId ?? "na"}_${market}_${symbol}`;

  const saveLeverageLS = (
    accId: number | null,
    market: "spot" | "futures",
    symbol: string,
    lev: number
  ) => {
    try {
      localStorage.setItem(levKey(accId, market, symbol), String(lev));
    } catch { }
  };

  const loadLeverageLS = (
    accId: number | null,
    market: "spot" | "futures",
    symbol: string,
    fallback = 2
  ) => {
    try {
      const v = localStorage.getItem(levKey(accId, market, symbol));
      const n = v ? Number(v) : NaN;
      return Number.isFinite(n) && n > 0 ? n : fallback;
    } catch {
      return fallback;
    }
  };

  // ===== TP/SL Settings LocalStorage Helpers =====
  const getTpSlSettingsKey = (symbol: string) => `tpsl_settings_${symbol}`;

  const saveTpSlSettings = (
    symbol: string,
    settings: {
      tpSl: boolean;
      tpTriggerType: "MARK" | "LAST";
      slTriggerType: "MARK" | "LAST";
      tpMode: TpSlMode;
      slMode: TpSlMode;
    }
  ) => {
    try {
      const data = {
        ...settings,
        timestamp: Date.now(),
      };
      localStorage.setItem(getTpSlSettingsKey(symbol), JSON.stringify(data));
    } catch (error) {
      console.error("Error saving TP/SL settings:", error);
    }
  };

  const loadTpSlSettings = (symbol: string) => {
    try {
      const saved = localStorage.getItem(getTpSlSettingsKey(symbol));
      if (saved) {
        const parsed = JSON.parse(saved);
        // Return parsed data to be set by caller
        return parsed;
      }
    } catch (error) {
      console.error("Error loading TP/SL settings:", error);
    }
    return null;
  };

  // Tick/Step per symbol - Dynamic from Binance API
  const { tick: tickSize, step: stepSize } = useMemo(() => {
    // Priority 1: Binance API data
    const info = binanceSymbolInfo.getSymbolInfo(selectedSymbol);
    if (info) {
      return {
        tick: info.tickSize,
        step: info.stepSize,
      };
    }

    // Priority 2: Static config (fallback)
    if (SYMBOL_META[selectedSymbol]) {
      return {
        tick: SYMBOL_META[selectedSymbol].tick,
        step: SYMBOL_META[selectedSymbol].step,
      };
    }

    // Priority 3: Defaults
    return {
      tick: DEFAULT_TICK,
      step: DEFAULT_STEP,
    };
  }, [selectedSymbol]);

  const priceDecimals = decimalsFromTick(tickSize);

  const effectivePrice =
    (Number.isFinite(price) && price > 0 ? Number(price) : undefined) ??
    (Number(priceValue) > 0 ? Number(priceValue) : undefined);
  const priceNum = effectivePrice ?? 0;

  // ✅ FIX: Tính buyQty và sellQty riêng biệt như Binance
  const buyQty = useMemo(() => {
    if (percent === 0 || !priceNum || priceNum <= 0) return 0;

    const buyingPower =
      selectedMarket === "futures"
        ? internalBalance * leverage
        : internalBalance;
    
    const notional = (buyingPower * percent) / 100;
    
    // ✅ Long: Tính qty cơ bản
    const rawQty = notional / priceNum;
    return Math.floor(rawQty / stepSize) * stepSize;
  }, [percent, priceNum, internalBalance, leverage, selectedMarket, stepSize]);

  const sellQty = useMemo(() => {
    if (percent === 0 || !priceNum || priceNum <= 0) return 0;

    const buyingPower =
      selectedMarket === "futures"
        ? internalBalance * leverage
        : internalBalance;
    
    const notional = (buyingPower * percent) / 100;
    
    // ✅ Short: Binance cho phép short nhiều hơn ~1.5%
    // Phân tích: 1339/1319 = 1.0152, 2231/2198 = 1.015, 178/176 = 1.0114
    // Công thức ước tính: factor ≈ 1 + (percent * 0.0005) hoặc cố định ~1.015
    const shortFactor = 1.015; // +1.5% cố định
    const adjustedNotional = notional * shortFactor;
    
    const rawQty = adjustedNotional / priceNum;
    return Math.floor(rawQty / stepSize) * stepSize;
  }, [percent, priceNum, internalBalance, leverage, selectedMarket, stepSize]);

  // ✅ FIX: Dùng buyQty cho estimate (Long side là default)
  const qtyNum = Number((amount || "").replace(",", ".")) || buyQty || 0;

  const est = useMemo(
    () =>
      estimate({
        price: priceNum,
        qty: qtyNum,
        leverage,
        orderType,
        market: selectedMarket,
        availableBalance: internalBalance,
        tickSize,
        stepSize,
        side: tradeSide,
      }),
    [
      priceNum,
      qtyNum,
      leverage,
      orderType,
      selectedMarket,
      internalBalance,
      tickSize,
      stepSize,
      tradeSide,
    ]
  );

  const maxBuyQty = useMemo(() => {
    if (!priceNum || priceNum <= 0) return 0;

    const buyingPower =
      selectedMarket === "futures"
        ? internalBalance * leverage
        : internalBalance;

    const rawQty = buyingPower / priceNum;
    const result = Math.floor(rawQty / stepSize) * stepSize;

    return result;
  }, [priceNum, internalBalance, leverage, selectedMarket, stepSize]);

  const maxSellQty = useMemo(() => {
    return currentPosition;
  }, [currentPosition]);

  const baseAsset = selectedSymbol.replace("USDT", "");

  // ===== Effects =====

  useEffect(() => {
    const savedUnit = localStorage.getItem("selectedUnit");
    if (savedUnit === "base" || savedUnit === "quote") {
      setSelectedUnit(savedUnit);
    }
  }, []);
  // Thêm useMemo để tính min quantity
  const minQuantity = useMemo(() => {
    const info = binanceSymbolInfo.getSymbolInfo(selectedSymbol);
    if (!info || !priceNum || priceNum <= 0) return 0;

    // Min notional / price = min quantity
    const minQty = info.minNotional / priceNum;

    // Làm tròn lên theo stepSize
    return Math.ceil(minQty / stepSize) * stepSize;
  }, [selectedSymbol, priceNum, stepSize]);
 // ✅ Load TP/SL settings khi đổi symbol
 
// ✅ Load TP/SL settings khi đổi symbol
useEffect(() => {
  // Reset flag khi đổi symbol
  tpSlLoadedRef.current = false;

  const saved = loadTpSlSettings(selectedSymbol);
  console.log(`🔄 Loading TP/SL settings for ${selectedSymbol}:`, saved);
  
  if (saved) {
    if (typeof saved.tpSl === "boolean") setTpSl(saved.tpSl);
    if (saved.tpTriggerType) setTpTriggerType(saved.tpTriggerType);
    if (saved.slTriggerType) setSlTriggerType(saved.slTriggerType);
    if (saved.tpMode) setTpMode(saved.tpMode);
    if (saved.slMode) setSlMode(saved.slMode);
  } else {
    setTpMode("roi");
    setSlMode("roi");
  }

  // ✅ DELAY để các useEffect clear chạy xong TRƯỚC
  // Sau đó mới set values và mark loaded
  setTimeout(() => {
   // setTpSl(true);
   // setTpSlValues({
     // takeProfitPrice: "500",
     // stopLossPrice: "-300",
      //takeProfitEnabled: true,
     // stopLossEnabled: true,
  //  });
    
    // Mark loaded SAU KHI đã set values
    tpSlLoadedRef.current = true;
  }, 50); // 50ms đủ để React batch xong
  
}, [selectedSymbol]);

  // ✅ Save TP/SL settings khi thay đổi (CHỈ SAU KHI ĐÃ LOAD)
  useEffect(() => {
    // Skip save lần đầu tiên khi component mount
    if (!tpSlLoadedRef.current) return;

    const settings = {
      tpSl,
      tpTriggerType,
      slTriggerType,
      tpMode,
      slMode,
    };
    console.log(`💾 Saving TP/SL settings for ${selectedSymbol}:`, settings);
    saveTpSlSettings(selectedSymbol, settings);
  }, [selectedSymbol, tpSl, tpTriggerType, slTriggerType, tpMode, slMode]);

  useEffect(() => {
    setSelectedMarket(propMarket);
  }, [propMarket]);

  useEffect(() => {
    const lev = loadLeverageLS(
      selectedAccountId,
      selectedMarket,
      selectedSymbol,
      2
    );
    setLeverage(lev);
  }, [selectedAccountId, selectedMarket, selectedSymbol]);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;

    binanceWS.connect(token, (msg) => {
      console.log('📨 WS Message:', msg?.type, msg);

      // ===== BALANCE UPDATE =====
      if (msg?.type === 'accountInformation' && msg?.data) {
        const liveAvail = Number(msg.data.availableBalance ?? 0);
        if (Number.isFinite(liveAvail))
          setBalanceIfHigherPriority(liveAvail, 'ws-live');
      }

      switch (msg.type) {
        // ===== AUTHENTICATED - SELECT ACCOUNT NGAY =====
        case 'authenticated': {
          console.log('✅ Authenticated');

          // Check xem có saved account ID không
          const savedId = localStorage.getItem('selectedBinanceAccountId');
          if (savedId) {
            const accountId = Number(savedId);
            console.log('🔥 Auto-selecting saved account:', accountId);

            // Set state trước
            setSelectedAccountId(accountId);
            binanceWS.setCurrentAccountId(accountId);

            // Gọi selectAccount - server sẽ lưu context
            binanceWS.selectAccount(accountId);

            // ĐỢI accountSelected response rồi mới gọi API khác
          } else {
            // Không có saved ID - gọi getMyBinanceAccounts
            console.log('⚠️ No saved account, fetching list...');
            binanceWS.getMyBinanceAccounts();
          }
          break;
        }

        // ===== ACCOUNT SELECTED - GỌI API SAU KHI SELECT XONG =====
        case 'accountSelected': {
          console.log('✅ Account selected, calling APIs...');

          // ✅ TĂNG DELAY lên 500ms
          setTimeout(async () => {
            await binanceWS.getMultiAssetsMode((isMulti) => {
              setMultiAssetsMode(isMulti);
            });

            // ✅ DELAY thêm 200ms giữa các calls
            await new Promise(resolve => setTimeout(resolve, 200));

            await binanceWS.getPositionMode((isDual) => setDualSide(isDual));
          }, 500);
          break;
        }

        // ===== MY BINANCE ACCOUNTS (fallback) =====
        case 'myBinanceAccounts': {
          const first = msg.data?.accounts?.[0];
          if (first?.id) {
            console.log('📋 Got accounts list, selecting first:', first.id);

            setSelectedAccountId(first.id);
            binanceWS.setCurrentAccountId(first.id);
            binanceWS.selectAccount(first.id);

            // accountSelected sẽ trigger sau đó
          }
          break;
        }

        // ===== MULTI ASSETS MODE CHANGE =====
        case 'changeMultiAssetsMode':
          setMultiAssetsMode(!!msg.multiAssetsMargin);
          break;

        // ===== FUTURES DATA LOADED - IGNORE DATABASE CACHE =====
        case "futuresDataLoaded": {
          // ❌ SKIP - Don't use database cache, only use ws-live accountInformation
          console.log('⏭️ Skipping futuresDataLoaded (database cache)');
          break;
        }

        default:
          break;
      }
    });

    // ===== CLEANUP - DISCONNECT ON UNMOUNT =====
    return () => {
      console.log('🔌 Component unmounting, disconnecting WebSocket');
      binanceWS.disconnect();
    };
  }, []);

  useEffect(() => {
    binanceAccountApi
      .getMyAccounts()
      .then((res) => {
        const arr = (res?.Data?.accounts ?? []) as BinanceAccount[];
        setAccounts(arr);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedAccountId) return;
    binanceWS.setCurrentAccountId(selectedAccountId);
    binanceWS.selectAccount(selectedAccountId);

    // ✅ DELAY ĐỂ selectAccount() HOÀN THÀNH
    setTimeout(() => {
      binanceWS.getMultiAssetsMode((isMulti) => {
        setMultiAssetsMode(isMulti);
        localStorage.setItem(
          `multiAssetsMode_${selectedAccountId}`,
          String(isMulti)
        );
      });
      binanceWS.getPositionMode((isDual) => setDualSide(isDual));
    }, 200); // ✅ TĂNG DELAY LÊN 200ms
  }, [selectedAccountId]);

  useEffect(() => {
    if (
      price > 0 &&
      !isPriceOverridden &&
      priceInitializedRef.current !== selectedSymbol
    ) {
      setPriceValue(price.toFixed(priceDecimals));
      priceInitializedRef.current = selectedSymbol;
    }
  }, [price, selectedSymbol, priceDecimals, isPriceOverridden]);

  useEffect(() => {
    priceInitializedRef.current = "";
  }, [selectedSymbol]);

  useEffect(() => {
    // ✅ Chỉ xử lý khi user KÉO SLIDER (percent > 0)
    if (percent === 0) {
      setSliderQty(0);
      return; // ✅ KHÔNG clear amount
    }

    if (price <= 0) return;

    const buyingPower =
      selectedMarket === "futures"
        ? internalBalance * leverage
        : internalBalance;

    const rawQty = (buyingPower * percent) / 100 / price;

    let qty = roundStepUp(rawQty, stepSize);
    qty = clampQtyToMax({
      qty,
      price,
      balance: internalBalance,
      leverage,
      market: selectedMarket,
      step: stepSize,
    });

    // ✅ CHỈ set sliderQty, KHÔNG set amount
    setSliderQty(qty);
  }, [percent, price, internalBalance, selectedMarket, leverage, stepSize]);

  const handleChangeMode = (newMode: boolean) => {
    binanceWS.changeMultiAssetsMode(newMode, () => {
      binanceWS.changePositionMode(newMode, () => {
        binanceWS.getMultiAssetsMode((isMulti) => {
          setMultiAssetsMode(isMulti);
          const accId = binanceWS.getCurrentAccountId();
          if (accId)
            localStorage.setItem(`multiAssetsMode_${accId}`, String(isMulti));
        });
        binanceWS.getPositionMode((dual) => setDualSide(dual));
      });
    });
  };

  useEffect(() => {
    const handler = (msg: any) => {
      if (typeof msg?.multiAssetsMargin === "boolean") {
        setMultiAssetsMode(msg.multiAssetsMargin);
        if (selectedAccountId)
          localStorage.setItem(
            `multiAssetsMode_${selectedAccountId}`,
            String(msg.multiAssetsMargin)
          );
      }
    };
    binanceWS.onMessage(handler);
    return () => {
      binanceWS.removeMessageHandler(handler);
    };
  }, [selectedAccountId]);

  const changeMarginTypeWS = (symbol: string, mode: "cross" | "isolated") => {
    const marginType = mode === "isolated" ? "ISOLATED" : "CROSSED";
    if ((binanceWS as any).changeMarginType)
      (binanceWS as any).changeMarginType(symbol, marginType);
    else
      (binanceWS as any).sendAuthed?.({
        action: "changeMarginType",
        symbol,
        marginType,
      });
  };

  const adjustLeverageWS = (symbol: string, lev: number) => {
    if ((binanceWS as any).adjustLeverage)
      (binanceWS as any).adjustLeverage(symbol, lev);
    else
      (binanceWS as any).sendAuthed?.({
        action: "adjustLeverage",
        symbol,
        leverage: lev,
      });
  };

  // ✅ buyAmount/sellAmount cho backward compatibility
  const buyAmount = buyQty;
  const sellAmount = sellQty;

  const convertAmount = (
    value: string,
    from: "base" | "quote",
    to: "base" | "quote"
  ): string => {
    if (from === to || !value || !priceNum || priceNum <= 0) return value;

    const num = parseFloat(value);
    if (!Number.isFinite(num) || num <= 0) return "";

    if (from === "base" && to === "quote") {
      return (num * priceNum).toFixed(2);
    } else {
      return (num / priceNum).toFixed(qtyDecimals(stepSize));
    }
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    setPercent(0); // Reset slider về 0
    setSliderQty(0); // Reset slider quantity

    if (selectedUnit === "quote") {
    }
  };

  // ✅ Clear TP input khi đổi mode - CHỈ KHI USER ĐỔI, KHÔNG PHẢI KHI LOAD
const tpModeChangedByUser = useRef(false);

 useEffect(() => {
  if (!tpSlLoadedRef.current) return; // ✅ Skip khi đang load
  
  setTpSlValues((prev) => ({
    ...prev,
    takeProfitPrice: '',
    takeProfitEnabled: false,
  }));
}, [tpMode]);

// ✅ Clear SL input khi đổi mode - CHỈ KHI USER ĐỔI, KHÔNG PHẢI KHI LOAD
useEffect(() => {
  if (!tpSlLoadedRef.current) return; // ✅ Skip khi đang load
  
  setTpSlValues((prev) => ({
    ...prev,
    stopLossPrice: '',
    stopLossEnabled: false,
  }));
}, [slMode]);

  // ✅ Initialize Binance symbol info
  useEffect(() => {
    binanceSymbolInfo.initialize();
  }, []);

  // Tính % rủi ro của lệnh
  const orderRiskPercent = useMemo(() => {
    // ✅ FIX: Dùng buyQty thay vì sliderQty
    const qty = parseFloat(amount || "0") > 0 ? parseFloat(amount) : buyQty;
    if (!Number.isFinite(qty) || qty <= 0 || !priceNum || priceNum <= 0) return 0;

    const notional = qty * priceNum;
    const margin = selectedMarket === "futures" ? notional / leverage : notional;

    if (internalBalance <= 0) return 0;

    return (margin / internalBalance) * 100;
  }, [buyQty, amount, priceNum, internalBalance, leverage, selectedMarket]);

  const MAX_RISK_PERCENT = 5; // 5% max
  // ===== Render =====
  return (
    <>
      {/* ✅ ALL MODALS RENDERED WITH PORTAL - OUTSIDE DOM TREE */}
      {isTpSlModalOpen &&
        createPortal(
          <TpSlModal
            isOpen={isTpSlModalOpen}
            onClose={() => setIsTpSlModalOpen(false)}
            tradeSide={tpSlSide}
            setTradeSide={setTpSlSide}
            quantity={+amount}
            symbol={selectedSymbol}
            currentPrice={price}
            entryPrice={
              orderType === "limit"
                ? parseFloat(priceValue || "0") || price
                : price
            }
            market={selectedMarket}
            positionSide={tpSlSide === "buy" ? "LONG" : "SHORT"}
            initialTakeProfitPrice={tpSlValues.takeProfitPrice}
            initialStopLossPrice={tpSlValues.stopLossPrice}
            initialTakeProfitEnabled={tpSlValues.takeProfitEnabled}
            initialStopLossEnabled={tpSlValues.stopLossEnabled}
            onSubmit={(orders, values) => {
              setTpSlOrders(orders);
              setTpSlValues(values);
              setTpSl(true);
            }}
          />,
          document.body
        )}

      {isMarginOpen &&
        createPortal(
          <MarginModeModal
            isOpen={isMarginOpen}
            onClose={() => setIsMarginOpen(false)}
            onSelect={(mode) => {
              setMarginMode(mode);
              changeMarginTypeWS(selectedSymbol, mode);
            }}
            selectedMode={marginMode}
            symbol={selectedSymbol}
          />,
          document.body
        )}

      {isLeverageOpen &&
        createPortal(
          <LeverageModal
            isOpen={isLeverageOpen}
            onClose={() => setIsLeverageOpen(false)}
            leverage={leverage}
            onChange={(val) => {
              setLeverage(val);
              saveLeverageLS(
                selectedAccountId,
                selectedMarket,
                selectedSymbol,
                val
              );
              adjustLeverageWS(selectedSymbol, val);
            }}
          />,
          document.body
        )}

      {isUnitModalOpen &&
        createPortal(
          <UnitSelectModal
            isOpen={isUnitModalOpen}
            onClose={() => setIsUnitModalOpen(false)}
            baseAsset={baseAsset}
            selectedUnit={selectedUnit}
            onSelectUnit={(unit) => {
              setSelectedUnit(unit);
              localStorage.setItem("selectedUnit", unit);
              setAmount("");
              setPercent(0);
            }}
          />,
          document.body
        )}

      {isMultiAssetsOpen &&
        createPortal(
          <MultiAssetsModeModal
            isOpen={isMultiAssetsOpen}
            onClose={() => setIsMultiAssetsOpen(false)}
            multiAssetsMargin={multiAssetsMode ?? false}
            onChangeMode={(newMode) => {
              handleChangeMode(newMode);
            }}
          />,
          document.body
        )}

      {isConfirmOpen &&
        createPortal(
          <ConfirmPlaceOrderModal
            open={isConfirmOpen}
            onClose={() => setIsConfirmOpen(false)}
            order={confirmOrder}
            sideLabel={confirmSide}
            symbol={selectedSymbol}
            baseAsset={selectedSymbol.replace("USDT", "")}
            markPrice={price}
            estFee={est.fee}
            estLiqPrice={est.liqPrice}
            priceDecimals={priceDecimals}
           onConfirm={async (o) => {
  console.log("📤 Final order from modal:", o);
  
  // ✅ Chuẩn bị TP/SL data TRƯỚC khi gửi order chính
  const tpSlSide: Side = o.positionSide === "LONG" ? "buy" : "sell";

  const tpPriceToSend = TpSlConverter.toPrice(
    tpMode,
    tpSlValues.takeProfitPrice,
    price,
    o.quantity,
    tpSlSide,
    "tp",
    leverage
  );

  const slPriceToSend = TpSlConverter.toPrice(
    slMode,
    tpSlValues.stopLossPrice,
    price,
    o.quantity,
    tpSlSide,
    "sl",
    leverage
  );

  // ✅ Tạo danh sách TP/SL orders để gửi sau
  const pendingTpSlOrders = tpSlOrders.map((child) => {
    let finalStopPrice = child.stopPrice;

    if (child.type === "TAKE_PROFIT_MARKET" && tpPriceToSend) {
      finalStopPrice = parseFloat(tpPriceToSend);
    } else if (child.type === "STOP_MARKET" && slPriceToSend) {
      finalStopPrice = parseFloat(slPriceToSend);
    }

    finalStopPrice = roundTick(finalStopPrice, tickSize);
    const priceDecimalsCount = decimalsFromTick(tickSize);
    finalStopPrice = parseFloat(finalStopPrice.toFixed(priceDecimalsCount));

    return {
      symbol: selectedSymbol,
      market: selectedMarket,
      side: o.side === "BUY" ? "SELL" : "BUY",
      type: child.type,
      stopPrice: finalStopPrice,
      workingType: child.type === "TAKE_PROFIT_MARKET" ? tpTriggerType : slTriggerType,
      quantity: o.quantity,
      positionSide: selectedMarket === "futures" ? o.positionSide : undefined,
    };
  });

  // ✅ Function để gửi TP/SL sau khi order chính thành công
  const placeTpSlOrders = () => {
    pendingTpSlOrders.forEach((tpslOrder) => {
      console.log("📤 Placing TP/SL after main order success:", tpslOrder);
      binanceWS.placeOrder(tpslOrder as any);
    });
  };

  // ✅ Tạo listener để đợi order thành công
  let orderHandled = false;
  const timeoutId = setTimeout(() => {
    if (!orderHandled) {
      console.warn("⏰ Order timeout - TP/SL not placed");
      binanceWS.removeMessageHandler(orderResultHandler);
    }
  }, 10000); // Timeout 10 giây

  const orderResultHandler = (msg: any) => {
    // ✅ Check ORDER_TRADE_UPDATE event
    if (msg?.e === "ORDER_TRADE_UPDATE" && msg?.o) {
      const orderData = msg.o;
      
      // Check nếu là order của symbol đang trade
      if (orderData.s !== selectedSymbol) return;
      
      // Check nếu là order mới đặt (cùng side, cùng quantity)
      const isSameOrder = 
        orderData.S === o.side && // BUY/SELL
        Math.abs(parseFloat(orderData.q) - o.quantity) < 0.0001; // quantity gần bằng
      
      if (!isSameOrder) return;

      const status = orderData.X; // Order status: NEW, FILLED, PARTIALLY_FILLED, CANCELED, REJECTED
      
      console.log("📥 Order status update:", status, orderData);

      if (status === "FILLED" || status === "PARTIALLY_FILLED") {
        // ✅ Order thành công → Gửi TP/SL
        orderHandled = true;
        clearTimeout(timeoutId);
        binanceWS.removeMessageHandler(orderResultHandler);
        
        if (pendingTpSlOrders.length > 0) {
          console.log("✅ Main order filled, placing TP/SL orders...");
          // Delay nhỏ để đảm bảo position đã được cập nhật
          setTimeout(() => {
            placeTpSlOrders();
          }, 500);
        }
      } else if (status === "REJECTED" || status === "CANCELED" || status === "EXPIRED") {
        // ❌ Order thất bại → Không gửi TP/SL
        orderHandled = true;
        clearTimeout(timeoutId);
        binanceWS.removeMessageHandler(orderResultHandler);
        console.error("❌ Main order failed, TP/SL NOT placed. Status:", status);
      }
    }

    // ✅ Check response type từ server (fallback)
    if (msg?.type === "orderPlaced" && msg?.data?.symbol === selectedSymbol) {
      orderHandled = true;
      clearTimeout(timeoutId);
      binanceWS.removeMessageHandler(orderResultHandler);
      
      console.log("✅ Order placed confirmation received");
      if (pendingTpSlOrders.length > 0) {
        setTimeout(() => {
          placeTpSlOrders();
        }, 500);
      }
    }

    // ✅ Check error response
    if (msg?.type === "error" || msg?.type === "orderFailed") {
      if (msg?.symbol === selectedSymbol || msg?.data?.symbol === selectedSymbol) {
        orderHandled = true;
        clearTimeout(timeoutId);
        binanceWS.removeMessageHandler(orderResultHandler);
        console.error("❌ Order error, TP/SL NOT placed:", msg?.message || msg?.data?.message);
      }
    }
  };

  // ✅ Đăng ký listener TRƯỚC khi gửi order
  binanceWS.onMessage(orderResultHandler);

  // ✅ Gửi order chính
  binanceWS.placeOrder(o as any);

  // ✅ Cleanup
  setTpSlOrders([]);
  setIsConfirmOpen(false);
}}
          />,
          document.body
        )}

      {/* Tooltips also with Portal */}
      {tpTooltipShow &&
        tpSlValues.takeProfitPrice &&
        createPortal(
          <TpSlTooltip
            show={tpTooltipShow}
            mode={tpMode}
            inputValue={tpSlValues.takeProfitPrice}
            entryPrice={price}
            quantity={parseFloat(amount || "0")}
            side={tradeSide}
            triggerRef={tpInputRef}
            leverage={leverage}
            type="tp"
          />,
          document.body
        )}

      {slTooltipShow &&
        tpSlValues.stopLossPrice &&
        createPortal(
          <TpSlTooltip
            show={slTooltipShow}
            mode={slMode}
            inputValue={tpSlValues.stopLossPrice}
            entryPrice={price}
            quantity={parseFloat(amount || "0")}
            side={tradeSide}
            triggerRef={slInputRef}
            leverage={leverage}
            type="sl"
          />,
          document.body
        )}

      {/* MAIN FORM CONTAINER */}
      <div className="p-1 space-y-1">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsMarginOpen(true)}
            className="btn btn-outline px-3 py-1 text-xs"
          >
            {marginMode === "cross" ? "Cross" : "Isolated"}
          </button>
          <button
            onClick={() => setIsLeverageOpen(true)}
            className="btn btn-outline px-3 py-1 text-xs"
          >
            {leverage}x
          </button>
          <button
  onClick={() => setIsMultiAssetsOpen(true)}
  className={`text-xs px-2 py-1 rounded hover:ring-1 ring-primary-500 ${
    dualSide 
      ? "bg-yellow-600 text-black font-semibold"  // HEDGE - nổi bật
      : "bg-dark-700 text-white"                   // ONE-WAY
  }`}
  title={dualSide ? "Hedge Mode" : "One-way Mode"}
>
  {dualSide ? "M" : "S"}
</button>
        </div>

        {/* Tab Mở/Đóng */}
        <div className="relative flex bg-dark-800/50 rounded-lg p-0.5 border border-dark-700/50">
          <div
            className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] bg-dark-600 rounded-md shadow-lg transition-all duration-200 ease-out ${orderAction === "close"
                ? "translate-x-[calc(100%+4px)]"
                : "translate-x-0"
              }`}
          />

          <button
            onClick={() => setOrderAction("open")}
            className={`relative z-10 flex-1 px-4 py-2.5 text-sm font-semibold transition-colors duration-200 ${orderAction === "open"
                ? "text-white"
                : "text-dark-400 hover:text-dark-200"
              }`}
          >
            Mở
          </button>
          <button
            onClick={() => setOrderAction("close")}
            className={`relative z-10 flex-1 px-4 py-2.5 text-sm font-semibold transition-colors duration-200 ${orderAction === "close"
                ? "text-white"
                : "text-dark-400 hover:text-dark-200"
              }`}
          >
            Đóng
          </button>
        </div>

        {/* Tabs Order Type */}
        <div className="flex space-x-2 text-sm">
          {(["limit", "market", "stop-limit"] as OrderTypeBin[]).map((t) => (
            <button
              key={t}
              className={`px-3 py-1 rounded ${orderType === t
                  ? "bg-primary-500 text-white"
                  : "text-dark-400 hover:text-white"
                }`}
              onClick={() => setOrderType(t)}
            >
              {t === "limit"
                ? "Giới hạn"
                : t === "market"
                  ? "Thị trường"
                  : "Stop Limit"}
            </button>
          ))}
        </div>

        <div className="pl-12 text-xs text-dark-400">
          Số dư khả dụng:{" "}
          <span className="text-white font-medium">
            {Number(internalBalance).toFixed(2)} USDT
          </span>
        </div>

        {(orderType === "limit" || orderType === "stop-limit") && (
          <div>
            <label className="form-label mt-0 mb-1">Giá</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="form-input"
                value={priceValue}
                onFocus={() => setIsPriceOverridden(true)}
                onChange={(e) => setPriceValue(e.target.value)}
              />
              <span className="text-xs text-dark-400">USDT</span>
            </div>
          </div>
        )}

        {orderType === "stop-limit" && (
          <div>
            <label className="form-label">Giá Stop</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="form-input"
                placeholder="0.00"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
              />
              <select
                value={stopPriceType}
                onChange={(e) =>
                  setStopPriceType(e.target.value as "MARK" | "LAST")
                }
                className="form-select text-xs w-[80px]"
              >
                <option value="MARK">Mark</option>
                <option value="LAST">Last</option>
              </select>
            </div>
          </div>
        )}

        {/* Số lượng */}
        <div>
          <label className="form-label">Số lượng</label>

          <div className="relative">
            <input
              type="text"
              className="form-input w-full pl-16 pr-20"
              value={amount}
              onChange={(e) => {
                const value = e.target.value.replace(/[^\d.]/g, "");
                const parts = value.split(".");
                const filtered =
                  parts.length > 2
                    ? parts[0] + "." + parts.slice(1).join("")
                    : value;
                handleAmountChange(filtered);
              }}
            />

            {/* Badge % - Trái */}
            {percent > 0 && (
              <div className="absolute left-2 top-1/2 -translate-y-1/2 px-2.5 py-0.5 text-dark-300 text-xs font-medium">
                {percent}%
              </div>
            )}

            {/* Unit button - Phải */}
            <button
              onClick={() => setIsUnitModalOpen(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-dark-400 hover:text-white transition-colors px-2 py-1 hover:bg-dark-700 rounded flex items-center gap-1"
            >
              {selectedUnit === "base" ? baseAsset : "USDT"}
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {/* ✅ MIN QUANTITY BADGE với shake + background đỏ */}
          {minQuantity > 0 && (
            <div
              className={`mt-1.5 flex items-center gap-1.5 text-xs rounded-lg px-3 py-2 transition-all duration-300 ${minQtyError
                  ? 'bg-red-500/20 border border-red-500 text-red-400 animate-pulse shadow-lg shadow-red-500/50'
                  : 'bg-transparent text-dark-400'
                }`}
              style={minQtyError ? {
                animation: 'pulse 1s ease-in-out 3, shake 0.5s ease-in-out'
              } : {}}
            >
              <svg
                className={`w-4 h-4 ${minQtyError ? 'text-red-400' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={minQtyError
                    ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    : "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  }
                />
              </svg>
              <span className={`${minQtyError ? 'font-bold' : 'font-normal'}`}>
                Số lượng tối thiểu là{" "}
                <span className={`font-semibold ${minQtyError ? 'text-red-300' : 'text-white'
                  }`}>
                  {minQuantity.toLocaleString(undefined, {
                    maximumFractionDigits: qtyDecimals(stepSize)
                  })} {baseAsset}
                </span>
              </span>
            </div>
          )}

          {/* ✅ MAX RISK 5% WARNING BADGE - CHỈ HIỆN KHI ERROR */}
          {maxRiskError && (
            <div
              className="mt-1.5 flex items-center gap-1.5 text-xs rounded-lg px-3 py-2 bg-orange-500/20 border border-orange-500 text-orange-400 animate-pulse shadow-lg shadow-orange-500/50 transition-all duration-300"
              style={{
                animation: 'pulse 1s ease-in-out 3, shake 0.5s ease-in-out'
              }}
            >
              <svg
                className="w-4 h-4 text-orange-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span className="font-bold">
                Rủi ro lệnh không được quá{" "}
                <span className="font-semibold text-orange-300">5% tài khoản</span>
              </span>
            </div>
          )}
        </div>
        <div className="pt-3">
  {percent > 0 && amount === "" && (
    <div className="flex justify-between items-center mb-3 text-xs">
      <span className="text-dark-400">
        Mua{" "}
        <span className="text-white font-medium">
          {/* ✅ FIX: Dùng buyQty - đã tính phí cho Long */}
          {buyQty.toLocaleString(undefined, { maximumFractionDigits: qtyDecimals(stepSize) })}{" "}
          {baseAsset}
        </span>
      </span>

      <span className="text-dark-400">
        Bán{" "}
        <span className="text-white font-medium">
          {/* ✅ FIX: Dùng sellQty - đã tính phí cho Short */}
          {sellQty.toLocaleString(undefined, { maximumFractionDigits: qtyDecimals(stepSize) })}{" "}
          {baseAsset}
        </span>
      </span>
    </div>
  )}

  {/* ✅ MODERN SLIDER với thumb position mapping - NO TEXT SELECTION */}
  <div className="relative mb-3 py-1.5 select-none">  {/* ✅ THÊM select-none */}
    {/* ✅ Hidden slider chỉ để control logic */}
    <Slider.Root
      className="relative flex items-center select-none w-full h-2 opacity-0 absolute inset-0 pointer-events-none"
      value={[percent]}
      onValueChange={([v]) => {
        const snapped = findNearestAllowedPercent(v);
        setPercent(snapped);
        if (snapped > 0) setAmount(""); // ✅ Clear amount khi kéo slider
      }}
      min={0}
      max={4}
      step={0.5}
    />

    {/* ✅ Visual slider track */}
    <div className="relative w-full h-2 bg-dark-700/50 rounded-full border border-dark-600 select-none">  {/* ✅ THÊM select-none */}
      {/* Progress fill */}
      <div 
        className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full shadow-lg shadow-blue-500/20 transition-all duration-200"
        style={{
          width: `${(ALLOWED_PERCENTAGES.indexOf(percent) / 5) * 100}%`
        }}
      />

      {/* ✅ Dots */}
      {ALLOWED_PERCENTAGES.map((mark, index) => (
        <div
          key={mark}
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-1 rounded-full transition-all duration-300 select-none ${  /* ✅ THÊM select-none */
            percent >= mark 
              ? 'bg-blue-400 shadow-lg shadow-blue-400/50 scale-110 z-10' 
              : 'bg-dark-600 shadow-inner'
          }`}
          style={{
            left: `${(index / 5) * 100}%`
          }}
        >
          {percent >= mark && (
            <span className="absolute inset-0 rounded-full bg-blue-300/50 animate-pulse"></span>
          )}
        </div>
      ))}

      {/* ✅ Custom draggable thumb */}
      <div
        className="group absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-gradient-to-b from-blue-400 to-blue-500 rounded-full shadow-xl shadow-blue-500/50 hover:shadow-blue-400/70 focus:outline-none focus:ring-2 focus:ring-blue-400/50 transition-all cursor-grab active:cursor-grabbing active:scale-125 border-2 border-white/20 hover:border-white/40 z-20 select-none" 
        style={{
          left: `${(ALLOWED_PERCENTAGES.indexOf(percent) / 5) * 100}%`
        }}
        onMouseDown={(e) => {
          e.preventDefault(); // ✅ THÊM preventDefault
          
          const track = e.currentTarget.parentElement;
          if (!track) return;

          const handleMove = (moveEvent: MouseEvent) => {
            moveEvent.preventDefault(); // ✅ THÊM preventDefault
            
            const rect = track.getBoundingClientRect();
            const x = moveEvent.clientX - rect.left;
            const percentage = Math.max(0, Math.min(1, x / rect.width));
            
            // Map to nearest allowed index
            const targetIndex = Math.round(percentage * 5);
            const snapped = ALLOWED_PERCENTAGES[targetIndex] || 0;
            setPercent(snapped);
            if (snapped > 0) setAmount(""); // ✅ Clear amount khi kéo slider
          };

          const handleUp = () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
          };

          document.addEventListener('mousemove', handleMove);
          document.addEventListener('mouseup', handleUp);
        }}
      >
        <span className="absolute inset-0 rounded-full bg-blue-400/30 animate-ping opacity-0 group-active:opacity-100"></span>
      </div>
    </div>
  </div>
{/* ✅ Labels */}
<div className="relative text-[10px] text-dark-500 h-4 mb-1 select-none">
  {ALLOWED_PERCENTAGES.map((mark, index) => (
    <button
      key={mark}
      onClick={() => {
        setPercent(mark);
        if (mark > 0) setAmount(""); // ✅ Clear amount khi click vào %
      }}
      className={`absolute -translate-x-1/2 px-1.5 py-0.5 rounded transition-all duration-200 font-medium select-none ${
  percent === mark 
    ? 'text-blue-400 bg-blue-500/10 shadow-lg shadow-blue-500/20 scale-105'
    : 'text-dark-400 hover:text-blue-300 hover:bg-dark-700/50'
}`}
      style={{
        left: `${(index / 5) * 100}%`
      }}
    >
      {mark}%
    </button>
  ))}
</div>
</div>

        {/* TP/SL Section */}
        {orderAction === "open" && (
          <div className="space-y-1 mt-2 text-xs text-white select-none">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
  type="checkbox"
  checked={tpSl}
  onChange={() => {
    const newValue = !tpSl;
    setTpSl(newValue);

    // ✅ Khi tick vào (enable TP/SL), set default values
    if (newValue) {
      const saved = loadTpSlSettings(selectedSymbol);
      
      // Set mode về ROI
      if (!saved || !saved.tpMode) {
        setTpMode("roi");
      }
      if (!saved || !saved.slMode) {
        setSlMode("roi");
      }

      // ✅ THÊM: Set default TP = 500%, SL = -300% nếu chưa có giá trị
     // setTpSlValues((prev) => ({
     //   ...prev,
     //   takeProfitPrice: prev.takeProfitPrice || "500",
     //   stopLossPrice: prev.stopLossPrice || "-300",
     //   takeProfitEnabled: true,
     //   stopLossEnabled: true,
     // }));
    }
  }}
  className="form-checkbox"
/>
                <span className="font-semibold">TP/SL</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  console.log("🔥 Opening TP/SL Modal");
                  setIsTpSlModalOpen(true);
                }}
                className="flex items-center text-warning-500 hover:text-warning-400 space-x-1 transition-colors"
              >
                <span className="text-xs font-medium">Nâng cao</span>
                <ExternalLink size={12} />
              </button>
            </div>

            {tpSl && (
              <div className="pl-2 pt-1 space-y-3 border-l border-dark-600 ml-1">
                {/* Take Profit */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-slate-400 font-medium">
                      Take Profit 
                    </label>
                    <div className="flex items-center gap-1.5">
                      <TriggerTypeSelect
                        value={tpTriggerType}
                        onChange={setTpTriggerType}
                      />
                      <TpSlModeSelect mode={tpMode} onChange={setTpMode} />
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      ref={tpInputRef}
                      onFocus={() => setTpTooltipShow(true)}
                      onBlur={() => setTpTooltipShow(false)}
                      type="text"
                      className="form-input w-full text-sm pr-12"
                      placeholder={TpSlConverter.getPlaceholder(tpMode, "tp")}
                      value={tpSlValues.takeProfitPrice}
                      onChange={(e) => {
                        let inputValue = e.target.value;

                        // Chỉ cho phép số dương và dấu chấm
                        inputValue = inputValue.replace(/[^\d.]/g, "");

                        setTpSlValues((prev) => ({
                          ...prev,
                          takeProfitPrice: inputValue,
                          takeProfitEnabled: true,
                        }));
                      }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dark-400 pointer-events-none">
                      {tpMode === "price"
                        ? "USDT"
                        : tpMode === "pnl"
                          ? "USDT"
                          : "%"}
                    </span>
                  </div>
                </div>

                {/* Stop Loss */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-slate-400 font-medium">
                      Stop Loss 
                    </label>
                    <div className="flex items-center gap-1.5">
                      <TriggerTypeSelect
                        value={slTriggerType}
                        onChange={setSlTriggerType}
                      />
                      <TpSlModeSelect mode={slMode} onChange={setSlMode} />
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      ref={slInputRef}
                      onFocus={() => setSlTooltipShow(true)}
                      onBlur={() => setSlTooltipShow(false)}
                      type="text"
                      className="form-input w-full text-sm pr-12"
                      placeholder={TpSlConverter.getPlaceholder(slMode, "sl")}
                      value={tpSlValues.stopLossPrice}
                      onChange={(e) => {
                        let inputValue = e.target.value;

                        // Chỉ cho phép số và dấu chấm
                        inputValue = inputValue.replace(/[^\d.]/g, '');

                        // ✅ CHỈ thêm dấu trừ khi mode là PnL hoặc ROI
                        if (inputValue && (slMode === "pnl" || slMode === "roi")) {
                          inputValue = '-' + inputValue;
                        }

                        setTpSlValues((prev) => ({
                          ...prev,
                          stopLossPrice: inputValue,
                          stopLossEnabled: inputValue !== '',
                        }));
                      }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dark-400 pointer-events-none">
                      {slMode === "price"
                        ? "USDT"
                        : slMode === "pnl"
                          ? "USDT"
                          : "%"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 mt-2 text-xs text-white select-none">
          <div className="flex items-center space-x-4">
            {orderAction === "close" && (
              <label className="flex items-center space-x-2 opacity-50 cursor-not-allowed">
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  className="form-checkbox"
                />
                <span>Lệnh chỉ giảm (tự động)</span>
              </label>
            )}
            {orderType !== "market" && (
              <div className="flex items-center gap-1.5 ml-auto">
                <div className="relative inline-block">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-transparent  ">
                    <span className="text-slate-400 text-xs">TIF</span>
                    <select
                      className="bg-transparent border-0 text-white text-xs outline-none cursor-pointer appearance-none pr-4"
                      value={tif}
                      onChange={(e) => setTif(e.target.value as any)}
                    >
                      <option value="GTC" className="bg-dark-800">
                        GTC
                      </option>
                      <option value="IOC" className="bg-dark-800">
                        IOC
                      </option>
                      <option value="FOK" className="bg-dark-800">
                        FOK
                      </option>
                    </select>
                    <svg
                      className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M7 10l5 5 5-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {orderAction === "open" ? (
            <>
              <button
                className="flex-1 btn btn-success disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => openConfirm("LONG")}
                disabled={!canPlaceOrder}
              >
                Mở lệnh Long
              </button>
              <button
                className="flex-1 btn btn-danger disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => openConfirm("SHORT")}
                disabled={!canPlaceOrder}
              >
                Mở lệnh Short
              </button>
            </>
          ) : (
            <>
              <button
                className="flex-1 btn btn-danger disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => openConfirm("SHORT")}
                disabled={!canPlaceOrder}
              >
                Đóng Short
              </button>
              <button
                className="flex-1 btn btn-success disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => openConfirm("LONG")}
                disabled={!canPlaceOrder}
              >
                Đóng Long
              </button>
            </>
          )}
        </div>

        {/* Estimate Panel with Smooth Animations */}
<EstimatePanel
  est={est}
  selectedMarket={selectedMarket}
  priceDecimals={priceDecimals}
  selectedSymbol={selectedSymbol}
  orderType={orderType}
  getFeeRate={getFeeRate}
/>
      </div>
    </>
  );
};

export default TradingForm;