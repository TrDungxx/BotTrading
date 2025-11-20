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

  // Modes
  const [isMultiAssetsOpen, setIsMultiAssetsOpen] = useState(false);
  const [multiAssetsMode, setMultiAssetsMode] = useState<boolean | null>(null);
  const [dualSide, setDualSide] = useState<boolean>(true);

  const [tpTriggerType, setTpTriggerType] = useState<"MARK" | "LAST">("MARK");
  const [slTriggerType, setSlTriggerType] = useState<"MARK" | "LAST">("MARK");
  const [tpTooltipShow, setTpTooltipShow] = useState(false);
  const [slTooltipShow, setSlTooltipShow] = useState(false);
  const tpInputRef = useRef<HTMLInputElement>(null);
  const slInputRef = useRef<HTMLInputElement>(null);

  const priceInitializedRef = useRef<string>("");

  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<"base" | "quote">("base");
  const [usdtMode, setUsdtMode] = useState<"total" | "margin">("total");

  // UI/Order state
  const [isPriceOverridden, setIsPriceOverridden] = useState(false);
  const [tradeSide, setTradeSide] = useState<Side>("buy");
  const [orderType, setOrderType] = useState<OrderTypeBin>("limit");
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

  const buildOrderPayload = (side: ConfirmSide): ConfirmOrder | null => {
    const qty = parseFloat(amount || "0");
    if (!Number.isFinite(qty) || qty <= 0) return null;

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
      quantity: qty,
      type:
        orderType === "market"
          ? "MARKET"
          : orderType === "limit"
          ? "LIMIT"
          : "STOP_MARKET",
    };

    if (base.type === "LIMIT") {
      const p = parseFloat(priceValue || "0");
      if (!Number.isFinite(p) || p <= 0) return null;
      base.price = p;
      base.timeInForce = tif;
    }

    if (base.type === "STOP_MARKET") {
      const sp = parseFloat(stopPrice || "0");
      if (!Number.isFinite(sp) || sp <= 0) return null;
      base.stopPrice = sp;
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

    return base;
  };

  const openConfirm = (side: ConfirmSide) => {
    const payload = buildOrderPayload(side);
    if (!payload) {
      alert("Thiếu thông tin: số lượng/giá/stop…");
      return;
    }

    if (tpSl && orderAction === "open") {
      const inlineOrders: any[] = [];

      if (tpSlValues.takeProfitEnabled && tpSlValues.takeProfitPrice) {
        const tpPrice = TpSlConverter.toPrice(
          tpMode,
          tpSlValues.takeProfitPrice,
          price,
          parseFloat(amount || "0"),
          tradeSide,
          "tp",
          leverage
        );

        if (tpPrice && parseFloat(tpPrice) > 0) {
          inlineOrders.push({
            type: "TAKE_PROFIT_MARKET",
            stopPrice: parseFloat(tpPrice),
            triggerType: tpTriggerType,
          });
        }
      }

      if (tpSlValues.stopLossEnabled && tpSlValues.stopLossPrice) {
        const slPrice = TpSlConverter.toPrice(
          slMode,
          tpSlValues.stopLossPrice,
          price,
          parseFloat(amount || "0"),
          tradeSide,
          "sl",
          leverage
        );

        if (slPrice && parseFloat(slPrice) > 0) {
          inlineOrders.push({
            type: "STOP_MARKET",
            stopPrice: parseFloat(slPrice),
            triggerType: slTriggerType,
          });
        }
      }

      setTpSlOrders([...tpSlOrders, ...inlineOrders]);
    }

    setConfirmSide(side);
    setConfirmOrder(payload);
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
    const s: BalanceSource = source ?? "none";
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
  const [stopPrice, setStopPrice] = useState("");
  const [stopPriceType, setStopPriceType] = useState<"MARK" | "LAST">("MARK");

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
    } catch {}
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

  // Tick/Step per symbol
  const { tick: tickSize, step: stepSize } = SYMBOL_META[selectedSymbol] ?? {
    tick: DEFAULT_TICK,
    step: DEFAULT_STEP,
  };
  const priceDecimals = decimalsFromTick(tickSize);

  const qtyNum = Number((amount || "").replace(",", ".")) || sliderQty || 0;
  const effectivePrice =
    (Number.isFinite(price) && price > 0 ? Number(price) : undefined) ??
    (Number(priceValue) > 0 ? Number(priceValue) : undefined);
  const priceNum = effectivePrice ?? 0;

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
    }

    // Mark as loaded sau khi set tất cả state
    setTimeout(() => {
      tpSlLoadedRef.current = true;
    }, 0);
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
      if (msg?.type === "accountInformation" && msg?.data) {
        const liveAvail = Number(msg.data.availableBalance ?? 0);
        if (Number.isFinite(liveAvail))
          setBalanceIfHigherPriority(liveAvail, "ws-live");
      }

      switch (msg.type) {
        case "authenticated":
          binanceWS.getMyBinanceAccounts();
          binanceWS.getMultiAssetsMode((isMulti) =>
            setMultiAssetsMode(isMulti)
          );
          binanceWS.getPositionMode((isDual) => setDualSide(isDual));
          break;
        case "changeMultiAssetsMode":
          setMultiAssetsMode(!!msg.multiAssetsMargin);
          break;
        case "myBinanceAccounts": {
          const first = msg.data?.accounts?.[0];
          if (first?.id) {
            binanceWS.selectAccount(first.id);
            setSelectedAccountId(first.id);
          }
          break;
        }
        case "futuresDataLoaded": {
          const usdt = msg.data?.balances?.find((b: any) => b.asset === "USDT");
          if (usdt)
            setInternalBalance(parseFloat(usdt.availableBalance || "0"));
          break;
        }
        default:
          break;
      }
    });
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

    binanceWS.getMultiAssetsMode((isMulti) => {
      setMultiAssetsMode(isMulti);
      localStorage.setItem(
        `multiAssetsMode_${selectedAccountId}`,
        String(isMulti)
      );
    });
    binanceWS.getPositionMode((isDual) => setDualSide(isDual));
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

  const buyAmount = useMemo(() => {
    if (percent === 0) return 0;

    if (selectedUnit === "quote") {
      const buyingPower =
        selectedMarket === "futures"
          ? internalBalance * leverage
          : internalBalance;
      return (buyingPower * percent) / 100;
    }

    return (maxBuyQty * percent) / 100;
  }, [
    maxBuyQty,
    percent,
    selectedUnit,
    internalBalance,
    leverage,
    selectedMarket,
  ]);

  const sellAmount = useMemo(() => {
    if (percent === 0) return 0;

    if (selectedUnit === "quote") {
      const buyingPower =
        selectedMarket === "futures"
          ? internalBalance * leverage
          : internalBalance;
      const notionalBuy = (buyingPower * percent) / 100;
      const leveragedNotional = notionalBuy * (1 + 1 / leverage);
      return leveragedNotional;
    }

    const notionalBuy = (maxBuyQty * percent) / 100;
    const leveragedNotional = notionalBuy * (1 + 1 / leverage);

    return leveragedNotional;
  }, [
    maxBuyQty,
    percent,
    leverage,
    selectedUnit,
    internalBalance,
    selectedMarket,
  ]);

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
// ✅ Clear TP input khi đổi mode
useEffect(() => {
  setTpSlValues((prev) => ({
    ...prev,
    takeProfitPrice: '',
    takeProfitEnabled: false,
  }));
}, [tpMode]);

// ✅ Clear SL input khi đổi mode
useEffect(() => {
  setTpSlValues((prev) => ({
    ...prev,
    stopLossPrice: '',
    stopLossEnabled: false,
  }));
}, [slMode]);
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
            onConfirm={(o) => {
              console.log("📤 Final order from modal:", o);
              binanceWS.placeOrder(o as any);

              const tpPriceToSend = TpSlConverter.toPrice(
                tpMode,
                tpSlValues.takeProfitPrice,
                price,
                parseFloat(amount || "0"),
                tradeSide,
                "tp",
                leverage
              );

              const slPriceToSend = TpSlConverter.toPrice(
                slMode,
                tpSlValues.stopLossPrice,
                price,
                parseFloat(amount || "0"),
                tradeSide,
                "sl",
                leverage
              );

              tpSlOrders.forEach((child) => {
                let finalStopPrice = child.stopPrice;

                if (child.type === "TAKE_PROFIT_MARKET" && tpPriceToSend) {
                  finalStopPrice = parseFloat(tpPriceToSend);
                } else if (child.type === "STOP_MARKET" && slPriceToSend) {
                  finalStopPrice = parseFloat(slPriceToSend);
                }

                finalStopPrice = roundTick(finalStopPrice, tickSize);

                const tpslOrder = {
                  symbol: selectedSymbol,
                  market: selectedMarket,
                  side: o.side === "BUY" ? "SELL" : "BUY",
                  type: child.type,
                  stopPrice: finalStopPrice,
                  workingType:
                    child.type === "TAKE_PROFIT_MARKET"
                      ? tpTriggerType
                      : slTriggerType,
                  quantity: o.quantity,
                  positionSide:
                    selectedMarket === "futures"
                      ? (o.positionSide as any)
                      : undefined,
                };

                console.log("📤 Final TP/SL with converted price:", tpslOrder);
                binanceWS.placeOrder(tpslOrder as any);
              });

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
            className={`text-xs px-2 py-1 rounded ${
              multiAssetsMode ? "bg-warning-700" : "bg-dark-700"
            } hover:ring-1 ring-primary-500`}
            title={multiAssetsMode ? "Hedge (M)" : "One-way (S)"}
          >
            {multiAssetsMode ? "M" : "S"}
          </button>
        </div>

        {/* Tab Mở/Đóng */}
        <div className="relative flex bg-dark-800/50 rounded-lg p-0.5 border border-dark-700/50">
          <div
            className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] bg-dark-600 rounded-md shadow-lg transition-all duration-200 ease-out ${
              orderAction === "close"
                ? "translate-x-[calc(100%+4px)]"
                : "translate-x-0"
            }`}
          />

          <button
            onClick={() => setOrderAction("open")}
            className={`relative z-10 flex-1 px-4 py-2.5 text-sm font-semibold transition-colors duration-200 ${
              orderAction === "open"
                ? "text-white"
                : "text-dark-400 hover:text-dark-200"
            }`}
          >
            Mở
          </button>
          <button
            onClick={() => setOrderAction("close")}
            className={`relative z-10 flex-1 px-4 py-2.5 text-sm font-semibold transition-colors duration-200 ${
              orderAction === "close"
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
              className={`px-3 py-1 rounded ${
                orderType === t
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
  
  {/* ✅ QUICK PERCENTAGE BUTTONS 
  <div className="grid grid-cols-5 gap-1.5 mb-2">
    {[1, 2, 3, 4, 5].map(p => (
      <button
        key={p}
        onClick={() => setPercent(p)}
        className={`px-2 py-1.5 text-xs rounded transition-colors ${
          percent === p 
            ? 'bg-blue-600 text-white' 
            : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
        }`}
      >
        {p}%
      </button>
    ))}
  </div>
  
  {/* ✅ QUICK USDT BUTTONS 
  <div className="grid grid-cols-5 gap-1.5 mb-2">
    {[1, 2, 5, 10, 20].map(usd => (
      <button
        key={usd}
        onClick={() => {
          // Tính % dựa trên balance
          const availableBalance = Number(internalBalance || 0);
          if (availableBalance > 0) {
            const pct = (usd / availableBalance) * 100;
            setPercent(Math.min(100, Math.round(pct)));
          }
        }}
        className="px-2 py-1.5 text-xs rounded bg-dark-700 text-slate-300 hover:bg-dark-600 transition-colors"
      >
        {usd}$
      </button>
    ))}
  </div>
*/}
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
</div>
        {/* Slider */}
        <div className="pt-3">
          {percent > 0 && amount === "" && (
            <div className="flex justify-between items-center mb-3 text-xs">
              <span className="text-dark-400">
                Mua{" "}
                <span className="text-white font-medium">
                  {Math.floor(buyAmount).toLocaleString()}{" "}
                  {selectedUnit === "base" ? baseAsset : "USDT"}
                </span>
              </span>

              <span className="text-dark-400">
                Bán{" "}
                <span className="text-white font-medium">
                  {Math.floor(sellAmount).toLocaleString()}{" "}
                  {selectedUnit === "base" ? baseAsset : "USDT"}
                </span>
              </span>
            </div>
          )}

          <div className="relative mb-2">
            <Slider.Root
              className="relative flex items-center select-none w-full h-5"
              value={[percent]}
              onValueChange={([v]) => setPercent(v)}
              min={0}
              max={100}
              step={1}
            >
              <Slider.Track className="bg-dark-700 relative grow rounded-full h-[3px]">
                <Slider.Range className="absolute bg-primary-500 rounded-full h-full" />
              </Slider.Track>

              <Slider.Thumb className="block w-4 h-4 bg-primary-500 rounded-full shadow-lg hover:bg-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all cursor-grab active:cursor-grabbing active:scale-110" />
            </Slider.Root>

            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between pointer-events-none">
              {[0, 25, 50, 75, 100].map((mark) => (
                <div
                  key={mark}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    percent >= mark ? "bg-primary-500" : "bg-dark-600"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-between text-[10px] text-dark-500 px-0.5">
            {[0, 25, 50, 75, 100].map((mark) => (
              <button
                key={mark}
                onClick={() => setPercent(mark)}
                className={`hover:text-primary-400 transition-colors ${
                  percent === mark ? "text-primary-400 font-medium" : ""
                }`}
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
                  onChange={() => setTpSl(!tpSl)}
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
                      Take Profit (
                      {tpMode === "price"
                        ? "Price"
                        : tpMode === "pnl"
                        ? "PnL"
                        : "ROI%"}
                      )
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
                      Stop Loss (
                      {slMode === "price"
                        ? "Price"
                        : slMode === "pnl"
                        ? "PnL"
                        : "ROI%"}
                      )
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
                className="flex-1 btn btn-success"
                onClick={() => openConfirm("LONG")}
              >
                Mở lệnh Long
              </button>
              <button
                className="flex-1 btn btn-danger"
                onClick={() => openConfirm("SHORT")}
              >
                Mở lệnh Short
              </button>
            </>
          ) : (
            <>
              <button
                className="flex-1 btn btn-danger"
                onClick={() => openConfirm("SHORT")}
              >
                Đóng Short
              </button>
              <button
                className="flex-1 btn btn-success"
                onClick={() => openConfirm("LONG")}
              >
                Đóng Long
              </button>
            </>
          )}
        </div>

        {/* Estimate Panel */}
        <div className="mt-2 rounded-xl border border-dark-600 bg-dark-800 p-3">
          <div className="mt-2 grid grid-cols-2 gap-6 text-xs">
            <div className="space-y-1">
              <div className="text-dark-400">Giá thanh lý (ước tính)</div>
              <div className="font-medium text-white">
                {selectedMarket === "futures" && est.liqPrice
                  ? `${est.liqPrice.toLocaleString(undefined, {
                      maximumFractionDigits: Math.max(0, priceDecimals),
                    })} USDT`
                  : "-- USDT"}
              </div>
              <div className="text-dark-400 mt-2">Chi phí</div>
              <div className="font-medium">
                {selectedMarket === "futures"
                  ? `${est.initMargin.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })} USDT`
                  : "—"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-dark-400">Phí (ước tính)</div>
              <div className="font-medium">
                {est.fee.toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })}{" "}
                USDT
              </div>
              <div className="text-dark-400 mt-2">
                Tối đa {selectedSymbol.replace("USDT", "")}
              </div>
              <div className="font-medium">
                {est.maxQty.toLocaleString(undefined, {
                  maximumFractionDigits: 8,
                })}{" "}
                {selectedSymbol.replace("USDT", "")}
              </div>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-dark-400">
            % Mức phí: {(getFeeRate(orderType) * 100).toFixed(3)}%{" "}
            {orderType === "market" ? "(Taker)" : "(Maker)"}
          </div>
        </div>
      </div>
    </>
  );
};

export default TradingForm;
