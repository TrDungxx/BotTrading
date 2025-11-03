import React, { useEffect, useMemo, useState } from "react";
import * as Slider from "@radix-ui/react-slider";
import MarginModeModal from "../modeltrading/MarginModeModal";
import LeverageModal from "../modeltrading/LeverageModal";
import { binanceWS } from "../binancewebsocket/BinanceWebSocketService";
import { binanceAccountApi } from "../../utils/api";
import MultiAssetsModeModal from "../formtrading/MultiAssetsModeModal";
import TpSlModal from "../formtrading/TpSlModal";
import { ExternalLink } from "lucide-react";
import ConfirmPlaceOrderModal from "./formtrading/ConfirmPlaceOrderModal";
// ===== Types =====
interface Props {
  selectedSymbol: string;
  price: number;
  internalBalance?: number; // optional in props; we also compute via WS
  selectedMarket?: "spot" | "futures";
}

interface BinanceAccount {
  id: number;
  Name?: string;
  status?: number;
  description?: string;
}

// ===== Helpers =====

type OrderTypeBin = "limit" | "market" | "stop-limit";
type Side = "buy" | "sell";

type BalanceSource = "ws-live" | "snapshot" | "database-cache" | "none";

const roundStep = (v: number, step: number) => Math.floor(v / step) * step;
const roundTick = (v: number, tick: number) => Math.round(v / tick) * tick;
const decimalsFromTick = (tick: number) => {
  if (!Number.isFinite(tick)) return 2;
  const s = tick.toString();
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
};

// Fallback tick/step if no exchangeInfo mapping yet
const DEFAULT_TICK = 0.0001;
const DEFAULT_STEP = 0.01;

// Fee (rough)
const DEFAULT_TAKER = 0.0005; // 0.05%
const DEFAULT_MAKER = 0.0002; // 0.02%
const getFeeRate = (orderType: OrderTypeBin) =>
  orderType === "market" ? DEFAULT_TAKER : DEFAULT_MAKER;

// Maintenance Margin Rate approx for liqPrice demo
const DEFAULT_MMR = 0.004; // 0.4%

// Optional symbol meta (should be replaced by real exchangeInfo)
const SYMBOL_META: Record<string, { tick: number; step: number }> = {
  "1000PEPEUSDT": { tick: 0.000001, step: 1 },
  // 'BTCUSDT': { tick: 0.1, step: 0.001 },
  // 'ETHUSDT': { tick: 0.01, step: 0.001 },
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

// ===== Component =====
const TradingForm: React.FC<Props> = ({
  selectedSymbol,
  price,
  internalBalance: propInternal = 0,
  selectedMarket: propMarket = "futures",
}) => {
  // Accounts
  const [accounts, setAccounts] = useState<BinanceAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null
  );

  // Modes
  const [isMultiAssetsOpen, setIsMultiAssetsOpen] = useState(false);
  const [multiAssetsMode, setMultiAssetsMode] = useState<boolean | null>(null);
  const [dualSide, setDualSide] = useState<boolean>(true); // true=Hedge, false=One-way
  

  // UI/Order state
  const [isPriceOverridden, setIsPriceOverridden] = useState(false);
  const [tradeSide, setTradeSide] = useState<Side>("buy");
  const [orderType, setOrderType] = useState<OrderTypeBin>("limit");
  const [priceValue, setPriceValue] = useState("");
  const [amount, setAmount] = useState("");
  const [percent, setPercent] = useState(0);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tif, setTif] = useState<"GTC" | "IOC" | "FOK">("GTC");
  const [isMarginOpen, setIsMarginOpen] = useState(false);
  const [isLeverageOpen, setIsLeverageOpen] = useState(false);
  const [marginMode, setMarginMode] = useState<"cross" | "isolated">("cross");
  const [leverage, setLeverage] = useState(2);
  const [selectedMarket, setSelectedMarket] = useState<"spot" | "futures">(
    propMarket
  );
  const roundStepUp = (v: number, step: number) =>
  Math.ceil((v + 1e-12) / step) * step; // +epsilon để tránh lỗi float

const qtyDecimals = (step: number) => decimalsFromTick(step); // tái dùng helper có sẵn

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
  const rawMax = (buyingPower > 0 && price > 0) ? buyingPower / price : 0;
  const maxFloor = Math.floor((rawMax + 1e-12) / step) * step; // an toàn: không vượt quá sức mua
  return Math.min(qty, Math.max(0, maxFloor));
};


  // ===== Confirm Order (popup) =====
type ConfirmSide = 'LONG' | 'SHORT';
type ConfirmOrder = {
  symbol: string;
  market: 'spot' | 'futures';
  type: 'MARKET' | 'LIMIT' | 'STOP_MARKET';
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  workingType?: 'MARK' | 'LAST';
  // futures only
  positionSide?: 'LONG' | 'SHORT' | 'BOTH';
  reduceOnly?: boolean;
};

const [isConfirmOpen, setIsConfirmOpen] = useState(false);
const [confirmSide, setConfirmSide] = useState<ConfirmSide>('LONG');
const [confirmOrder, setConfirmOrder] = useState<ConfirmOrder | null>(null);

// build payload theo UI hiện tại
const buildOrderPayload = (side: ConfirmSide): ConfirmOrder | null => {
  const qty = parseFloat(amount || '0');
  if (!Number.isFinite(qty) || qty <= 0) return null;

  const base: ConfirmOrder = {
    symbol: selectedSymbol,
    market: selectedMarket,
    side: side === 'LONG' ? 'BUY' : 'SELL',
    quantity: qty,
    type:
      orderType === 'market'
        ? 'MARKET'
        : orderType === 'limit'
        ? 'LIMIT'
        : 'STOP_MARKET',
  };

  if (base.type === 'LIMIT') {
    const p = parseFloat(priceValue || '0');
    if (!Number.isFinite(p) || p <= 0) return null;
    base.price = p;
    base.timeInForce = tif;
  }

  if (base.type === 'STOP_MARKET') {
    const sp = parseFloat(stopPrice || '0');
    if (!Number.isFinite(sp) || sp <= 0) return null;
    base.stopPrice = sp;
    base.workingType = stopPriceType;
  }

  if (selectedMarket === 'futures') {
    base.positionSide = dualSide ? side : 'BOTH';
    // mở vị thế MARKET thì KHÔNG gắn reduceOnly; chỉ tôn trọng checkbox nếu user tick
    base.reduceOnly = !!reduceOnly;
  }
  return base;
};

const openConfirm = (side: ConfirmSide) => {
  const payload = buildOrderPayload(side);
  if (!payload) {
    alert('Thiếu thông tin: số lượng/giá/stop…');
    return;
  }
  setConfirmSide(side);
  setConfirmOrder(payload);
  setIsConfirmOpen(true);
};

const confirmPlaceOrder = () => {
  if (!confirmOrder) return;
  binanceWS.placeOrder(confirmOrder as any);
  // nếu có TP/SL con
  tpSlOrders.forEach((o) => {
    binanceWS.placeOrder({
      symbol: selectedSymbol,
      market: selectedMarket,
      side: confirmOrder.side === 'BUY' ? 'SELL' : 'BUY',
      type: o.type, // 'STOP_MARKET' | 'TAKE_PROFIT_MARKET'
      stopPrice: o.stopPrice,
      workingType: o.triggerType || stopPriceType,
      quantity: confirmOrder.quantity,
      reduceOnly: true,
      positionSide:
        selectedMarket === 'futures'
          ? (confirmOrder.positionSide as any)
          : undefined,
    } as any);
  });
  setTpSlOrders([]);
  setIsConfirmOpen(false);
};


  // Balance tracking (source-priority)
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

  // Tick/Step per symbol
  const { tick: tickSize, step: stepSize } = SYMBOL_META[selectedSymbol] ?? {
    tick: DEFAULT_TICK,
    step: DEFAULT_STEP,
  };
  const priceDecimals = decimalsFromTick(tickSize);

  const qtyNum = Number((amount || "").replace(",", ".")) || 0;
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

  // ===== Effects =====
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
          // sync modes
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

  // Price formatting per tick
  useEffect(() => {
    if (price > 0 && !isPriceOverridden)
      setPriceValue(price.toFixed(priceDecimals));
  }, [price, isPriceOverridden, priceDecimals]);

  useEffect(() => {
    if (!isPriceOverridden && price > 0)
      setPriceValue(price.toFixed(priceDecimals));
  }, [selectedSymbol, priceDecimals, price, isPriceOverridden]);

  // Slider => amount
  useEffect(() => {
  if (price <= 0 || percent <= 0) return;

  const buyingPower =
    selectedMarket === "futures" ? internalBalance * leverage : internalBalance;

  const rawQty = (buyingPower * percent) / 100 / price;

  // ↳ luôn làm tròn LÊN theo stepSize, rồi kẹp lại để không vượt quá sức mua
  let qty = roundStepUp(rawQty, stepSize);
  qty = clampQtyToMax({
    qty,
    price,
    balance: internalBalance,
    leverage,
    market: selectedMarket,
    step: stepSize,
  });

  if (qty > 0) setAmount(Math.ceil(qty).toString());
}, [percent, price, internalBalance, selectedMarket, leverage, stepSize]);


  // Multi-Assets modal handler (also switch position mode accordingly)
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

  // WS generic listens for multiAssetsMargin broadcast
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

  // Safe wrappers
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

  

  // ===== Render =====
  return (
    <div className="p-4 space-y-4">
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
        <MultiAssetsModeModal
          isOpen={isMultiAssetsOpen}
          onClose={() => setIsMultiAssetsOpen(false)}
          multiAssetsMargin={multiAssetsMode ?? false}
          onChangeMode={(newMode) => {
            handleChangeMode(newMode);
          }}
        />
      </div>

      {/* Tabs */}
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

      <div>
        <label className="form-label">Số lượng</label>
        <div className="flex gap-2">
          <input
            type="text"
            className="form-input"
            placeholder="0.00000000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div className="text-xs text-dark-400">
            {selectedSymbol.replace("USDT", "")}
          </div>
        </div>
      </div>

      <div className="pt-3">
        <Slider.Root
          className="relative flex items-center select-none w-full h-5"
          value={[percent]}
          onValueChange={([v]) => setPercent(v)}
          min={0}
          max={100}
          step={1}
        >
          <Slider.Track className="bg-dark-600 relative grow rounded-full h-1">
            <Slider.Range className="absolute bg-primary-500 rounded-full h-full" />
          </Slider.Track>
          <Slider.Thumb className="block w-4 h-4 bg-primary-500 rounded-full shadow-sm hover:bg-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 relative">
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-dark-800 border border-dark-600 text-xs text-white rounded">
              {percent}%
            </div>
          </Slider.Thumb>
        </Slider.Root>
        <div className="flex justify-between text-xs text-dark-400">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="space-y-2 mt-2 text-xs text-white select-none">
        <div className="flex items-center justify-between text-xs text-white pt-2">
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
            onClick={() => setIsTpSlModalOpen(true)}
            className="flex items-center text-slate-400 hover:text-white space-x-1"
            title="Chỉnh sửa nâng cao"
          >
            <ExternalLink size={14} />
            <span>Nâng cao</span>
          </button>
        </div>

        {tpSl && (
          <div className="pl-6 pt-1 space-y-2 border-l border-dark-600 ml-1">
            <div>
              <label className="flex items-center justify-between text-xs mb-1 text-slate-400">
                <span className="font-medium">Take Profit</span>
                <select className="form-select w-[60px] text-xs">
                  <option>Mark</option>
                  <option>Last</option>
                </select>
              </label>
              <input
                type="text"
                className="form-input w-full text-sm"
                placeholder="Nhập giá TP"
                value={tpSlValues.takeProfitPrice}
                onChange={(e) =>
                  setTpSlValues((prev) => ({
                    ...prev,
                    takeProfitPrice: e.target.value,
                    takeProfitEnabled: true,
                  }))
                }
              />
            </div>
            <div>
              <label className="flex items-center justify-between text-xs mb-1 text-slate-400">
                <span className="font-medium">Stop Loss</span>
                <select className="form-select w-[60px] text-xs">
                  <option>Mark</option>
                  <option>Last</option>
                </select>
              </label>
              <input
                type="text"
                className="form-input w-full text-sm"
                placeholder="Nhập giá SL"
                value={tpSlValues.stopLossPrice}
                onChange={(e) =>
                  setTpSlValues((prev) => ({
                    ...prev,
                    stopLossPrice: e.target.value,
                    stopLossEnabled: true,
                  }))
                }
              />
            </div>
          </div>
        )}

        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={reduceOnly}
              onChange={() => setReduceOnly(!reduceOnly)}
              className="form-checkbox"
            />
            <span>Lệnh chỉ giảm</span>
          </label>
          <div className="flex items-center space-x-2 ml-auto">
            <span>TIF</span>
            <select
              className="form-select w-auto"
              value={tif}
              onChange={(e) => setTif(e.target.value as any)}
            >
              <option value="GTC">GTC</option>
              <option value="IOC">IOC</option>
              <option value="FOK">FOK</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
  <button
    className="flex-1 btn btn-success"
    onClick={() => openConfirm('LONG')}
  >
    Mở lệnh Long
  </button>
  <button
    className="flex-1 btn btn-danger"
    onClick={() => openConfirm('SHORT')}
  >
    Mở lệnh Short
  </button>
</div>


      

      {/* Estimate Panel */}
      <div className="mt-3 rounded-xl border border-dark-600 bg-dark-800 p-3">
        <div className="mt-3 grid grid-cols-2 gap-6 text-xs">
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
              {est.fee.toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
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

      {/* Modals */}
      <MarginModeModal
        isOpen={isMarginOpen}
        onClose={() => setIsMarginOpen(false)}
        onSelect={(mode) => {
          setMarginMode(mode);
          changeMarginTypeWS(selectedSymbol, mode);
        }}
        selectedMode={marginMode}
        symbol={selectedSymbol}
      />

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
      />

      <TpSlModal
        isOpen={isTpSlModalOpen}
        onClose={() => setIsTpSlModalOpen(false)}
        tradeSide={tpSlSide}
        setTradeSide={setTpSlSide}
        quantity={+amount}
        symbol={selectedSymbol}
        currentPrice={price}
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
      />
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
    // Gửi lệnh chính
    binanceWS.placeOrder(o as any);

    // Nếu có TP/SL con thì gửi tiếp
    tpSlOrders.forEach((child) => {
      binanceWS.placeOrder({
        symbol: selectedSymbol,
        market: selectedMarket,
        side: o.side === "BUY" ? "SELL" : "BUY",
        type: child.type, // 'STOP_MARKET' | 'TAKE_PROFIT_MARKET'
        stopPrice: child.stopPrice,
        workingType: child.triggerType || stopPriceType,
        quantity: o.quantity,
        reduceOnly: true,
        positionSide: selectedMarket === "futures" ? (o.positionSide as any) : undefined,
      } as any);
    });
    setTpSlOrders([]);
    setIsConfirmOpen(false);
  }}
/>

      
    </div>
  );
};

export default TradingForm;
