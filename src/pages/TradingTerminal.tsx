import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  ChevronDown,
  Clock,
  DollarSign,
  BarChart,
  RefreshCw,
  Share2,
  Star,
  Settings,
  Maximize2,
  TrendingUp,
  Volume2,
  Activity,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import TradingBinance from "../components/common/TradingBinance";
import { FormattedMessage, FormattedNumber } from "react-intl";
import TradingViewChart from "../components/common/TradingViewChart";
import { CandlestickData } from "lightweight-charts";
import { fetchHistoricalKlines } from "../utils/fetchKline";
import { ExtendedCandle } from "../utils/types";
import { Order } from "../utils/types";
import SymbolDropdown from "../components/symboldropdown/SymbolDropdown";
import symbolList from "../utils/symbolList";
import TradingForm from "../components/common/TradingForm";
import { useMiniTickerStore } from "../utils/miniTickerStore";
import { binanceWS } from "../components/binancewebsocket/BinanceWebSocketService";
import { toast } from "react-toastify";
import { AlertTriangle } from "lucide-react";
import OrderOpenHistory from "../components/orderlayout/OrderOpenHistory";
import SettingControl from "../components/common/controlsetting/SetiingControl";
import { BinanceAccount } from "../utils/types";
import BinanceAccountSelector from "../components/common/BinanceAccountSelector";
import { useAuth } from "../context/AuthContext";
import { User } from "../utils/types";
import { PositionData,FloatingInfo } from "../utils/types";
import PositionFunction from "../components/common/PositionFunction";
// Trạng thái kết nối WS
type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

// Loại thị trường
type MarketType = "spot" | "futures" ;

export type ChartSettings = {
  quickOrder: boolean;      // Lệnh nhanh
  pendingOrders: boolean;   // Lệnh chờ
  positionTag: boolean;     // Vị thế (Floating)
  orderHistory: boolean;    // Lịch sử đặt lệnh
  breakEven: boolean;       // Giá hòa vốn
  liquidation: boolean;     // Giá thanh lý
  alerts: boolean;          // Cảnh báo giá
  priceLine: boolean;       // Đường giá
  scale: boolean;           // Thang đo
};

// Dữ liệu thị trường
interface KlineData {
  symbol: string;
  interval: string;
  openTime: number;
  closeTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  trades: number;
  baseAssetVolume: string;
  quoteAssetVolume: string;
}

interface TickerData {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  askPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  count: number;
}

interface OrderBookEntry {
  price: string;
  quantity: string;
  total?: number;
}

interface OrderBookData {
  symbol: string;
  lastUpdateId: number;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

interface TradeData {
  symbol: string;
  tradeId: number;
  price: string;
  qty: string;
  time: number;
  isBuyerMaker: boolean;
}

interface BookTickerData {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  updateId: number;
}

interface MiniTickerData {
  symbol: string;
  close: string;
  open: string;
  high: string;
  low: string;
  volume: string;
  quoteVolume: string;
  eventTime: number;
  percentChange: string;
}

// Account (cho stream private)
interface AccountInfo {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  balances: Array<{
    asset: string;
    free: string;
    locked: string;
  }>;
}

interface OrderUpdate {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  timeInForce: string;
  type: string;
  side: string;
  stopPrice: string;
  icebergQty: string;
  time: number;
  updateTime: number;
  isWorking: boolean;
}

interface Subscription {
  id: string;
  action: string;
  symbol?: string;
  market?: MarketType;
  interval?: string;
  levels?: string;
  speed?: string;
  connectionId?: string;
  timestamp: number;
}
interface SymbolItem {
  symbol: string;
  price: number;
  percentChange: number;
  volume: number;
}

interface Position {
  symbol: string;
  positionSide: string;
  positionAmt: string;
}
interface Order {
  orderId: number;
  symbol: string;
  status: string;
  positionSide: 'LONG' | 'SHORT' | 'BOTH';
}

// WS public tuỳ chỉnh cho bảng phụ (kline/ticker/depth/trade/miniTicker)
class CustomWebSocketService {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private callbacks: Map<string, (data: any) => void> = new Map();
  private isAuthenticated = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private authToken: string | null = null;
  private binanceAccountId: number | null = null;
  private isConnected = false;
  public onStatusChange: (status: ConnectionStatus) => void = () => {};

  constructor() {
    this.connect();
  }

  private messageQueue: any[] = [];

  private connect() {
    try {
      this.onStatusChange("connecting");

      this.ws = new WebSocket(
        "ws://45.77.33.141/w-binance-socket/signalr/connect"
      );

      this.ws.onopen = () => {
        console.log("✅ WebSocket connected");
        this.onStatusChange("connected");
        this.isConnected = true;

        // gửi lại các message đã queue
        this.messageQueue.forEach((msg) => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
          }
        });
        this.messageQueue = [];

        // đăng ký mặc định tối thiểu
        const subs = [
          { action: "subscribePublicTicker", symbol: "BTCUSDT" },
          { action: "subscribePublicKline", symbol: "BTCUSDT", interval: "1m" },
          { action: "subscribePublicTrade", symbol: "BTCUSDT" },
        ];
        subs.forEach((msg) => this.sendMessage(msg));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error("❌ Error parsing message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
        this.onStatusChange("error");
        this.isConnected = false;
      };

      this.ws.onclose = () => {
        console.warn("🔌 WebSocket closed. Reconnecting...");
        this.onStatusChange("disconnected");
        this.isConnected = false;
        this.attemptReconnect();
      };
    } catch (error) {
      console.error("❌ Failed to connect WebSocket:", error);
      this.onStatusChange("error");
    }
  }

  private handleMessage(data: any) {
    if (data.action) {
      switch (data.action) {
        case "klineUpdate":
          this.handleKlineData(data);
          break;
        case "tickerUpdate":
          this.handleTickerData(data);
          break;
        case "depthUpdate":
          this.handleDepthData(data);
          break;
        case "tradeUpdate":
          this.handleTradeData(data);
          break;
        case "bookTickerUpdate":
          this.handleBookTickerData(data);
          break;
        case "miniTickerUpdate":
          this.handleMiniTickerData(data);
          break;
        case "accountUpdate":
          this.handleAccountData(data);
          break;
        case "orderUpdate":
          this.handleOrderData(data);
          break;
        case "subscriptionList":
          this.handleSubscriptionList(data);
          break;
        default:
          // không cần cảnh báo
          break;
      }
    } else if (data.type) {
      switch (data.type) {
        case "kline":
          this.handleKlineData(data);
          break;
        case "ticker":
          this.handleTickerData(data);
          break;
        case "depth":
          this.handleDepthData(data);
          break;
        case "trade":
          this.handleTradeData(data);
          break;
        case "bookTicker":
          this.handleBookTickerData(data);
          break;
        case "miniTicker":
          this.handleMiniTickerData(data);
          break;
        case "account":
          this.handleAccountData(data);
          break;
        case "order":
          this.handleOrderData(data);
          break;
        case "connection_status":
          break;
        case "welcome":
          break;
        default:
          break;
      }
    }
  }

  private handleKlineData(data: any) {
    const callback = this.callbacks.get("kline");
    if (!callback) return;

    const kline = data.data;

    if (
      kline &&
      kline.open !== undefined &&
      kline.high !== undefined &&
      kline.low !== undefined &&
      kline.close !== undefined &&
      kline.volume !== undefined
    ) {
      callback({
        symbol: kline.symbol || "",
        interval: kline.interval || "",
        openTime: kline.openTime,
        closeTime: kline.closeTime,
        open: kline.open,
        high: kline.high,
        low: kline.low,
        close: kline.close,
        volume: kline.volume,
        trades: kline.trades || 0,
        baseAssetVolume: kline.baseAssetVolume || "",
        quoteAssetVolume: kline.quoteAssetVolume || "",
      });
    } else {
      console.warn("⚠️ Invalid kline data received:", kline);
    }
  }

  private handleTickerData(data: any) {
    const callback = this.callbacks.get("ticker");
    if (callback && data.data) {
      callback(data.data);
    }
  }

  private handleDepthData(data: any) {
    const callback = this.callbacks.get("depth");
    if (callback && data.data) {
      callback(data.data);
    }
  }

  private handleTradeData(data: any) {
    const callback = this.callbacks.get("trade");
    if (callback && data.data) {
      callback(data.data);
    }
  }

  private handleBookTickerData(data: any) {
    const callback = this.callbacks.get("bookTicker");
    if (callback && data.data) {
      callback(data.data);
    }
  }

  private handleMiniTickerData(data: any) {
    const symbol = data?.data?.symbol;
    const callback = this.callbacks.get(`miniTicker_${symbol}`);
    if (callback && data.data) {
      callback(data.data);
    }
  }

  private handleAccountData(data: any) {
    const callback = this.callbacks.get("account");
    if (callback && data.data) {
      callback(data.data);
    }
  }

  private handleOrderData(data: any) {
    const callback = this.callbacks.get("orders");
    if (callback && data.data) {
      callback(data.data);
    }
  }

  private handleSubscriptionList(data: any) {
    console.log("📋 Active subscriptions:", data.subscriptions);
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      console.log(
        `🔄 Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
      );
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error("❌ Max reconnection attempts reached");
      this.onStatusChange("error");
    }
  }

  private resubscribeAll() {
    this.subscriptions.forEach((subscription) => {
      this.sendMessage(subscription);
    });
  }

  private sendMessage(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  public setStatusCallback(callback: (status: ConnectionStatus) => void) {
    this.onStatusChange = callback;
  }

  public setAuthToken(token: string, binanceAccountId: number) {
    this.authToken = token;
    this.binanceAccountId = binanceAccountId;
    this.isAuthenticated = true;
  }

  // PUBLIC STREAMS
  public subscribeKline(
    symbol: string,
    interval: string,
    market: MarketType = "spot",
    callback?: (data: any) => void
  ) {
    const subscriptionId = `kline_${symbol}_${interval}_${market}`;
    const message = {
      action: "subscribeKline",
      market,
      symbol,
      interval,
    };

    if (callback) {
      this.callbacks.set("kline", callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: "subscribeKline",
      symbol,
      market,
      interval,
      timestamp: Date.now(),
    });

    this.sendMessage(message);
    return subscriptionId;
  }

  public subscribeTicker(
    symbol: string,
    market: MarketType = "spot",
    callback?: (data: any) => void
  ) {
    const subscriptionId = `ticker_${symbol}_${market}`;
    const message = {
      action: "subscribeTicker",
      market,
      symbol,
    };

    if (callback) {
      this.callbacks.set("ticker", callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: "subscribeTicker",
      symbol,
      market,
      timestamp: Date.now(),
    });

    this.sendMessage(message);
    return subscriptionId;
  }

  public subscribeDepth(
    symbol: string,
    levels: string = "20",
    speed: string = "1000ms",
    market: MarketType = "spot",
    callback?: (data: any) => void
  ) {
    const subscriptionId = `depth_${symbol}_${levels}_${speed}_${market}`;
    const message = {
      action: "subscribePublicDepth",
      symbol,
      levels,
      speed,
    };

    if (callback) {
      this.callbacks.set("depth", callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: "subscribePublicDepth",
      symbol,
      market,
      levels,
      speed,
      timestamp: Date.now(),
    });

    this.sendMessage(message);
    return subscriptionId;
  }

  public subscribeTrade(
    symbol: string,
    market: MarketType = "spot",
    callback?: (data: any) => void
  ) {
    const subscriptionId = `trade_${symbol}_${market}`;
    const message = {
      action: "subscribePublicTrade",
      symbol,
    };

    if (callback) {
      this.callbacks.set("trade", callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: "subscribePublicTrade",
      symbol,
      market,
      timestamp: Date.now(),
    });

    this.sendMessage(message);
    return subscriptionId;
  }

  public subscribeBookTicker(
    symbol: string,
    market: MarketType = "spot",
    callback?: (data: any) => void
  ) {
    const subscriptionId = `bookTicker_${symbol}_${market}`;
    const message = {
      action: "subscribePublicBookTicker",
      symbol,
    };

    if (callback) {
      this.callbacks.set("bookTicker", callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: "subscribePublicBookTicker",
      symbol,
      market,
      timestamp: Date.now(),
    });

    this.sendMessage(message);
    return subscriptionId;
  }

  public subscribeMiniTicker(
    symbol: string,
    market: MarketType = "spot",
    callback?: (data: any) => void
  ) {
    const subscriptionId = `miniTicker_${symbol}_${market}`;
    const message = {
      action: "subscribePublicMiniTicker",
      symbol,
    };

    if (callback) {
      this.callbacks.set(`miniTicker_${symbol}`, callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: "subscribePublicMiniTicker",
      symbol,
      market,
      timestamp: Date.now(),
    });

    this.sendMessage(message);
    return subscriptionId;
  }

  // FUTURES
  public subscribeMarkPrice(
    symbol: string,
    market: MarketType = "futures",
    callback?: (data: any) => void
  ) {
    const subscriptionId = `markPrice_${symbol}_${market}`;
    const message = {
      action: "subscribeMarkPrice",
      market,
      symbol,
    };

    if (callback) {
      this.callbacks.set("markPrice", callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: "subscribeMarkPrice",
      symbol,
      market,
      timestamp: Date.now(),
    });

    this.sendMessage(message);
    return subscriptionId;
  }

  public subscribeFundingRate(
    symbol: string,
    market: MarketType = "futures",
    callback?: (data: any) => void
  ) {
    const subscriptionId = `fundingRate_${symbol}_${market}`;
    const message = {
      action: "subscribeFundingRate",
      market,
      symbol,
    };

    if (callback) {
      this.callbacks.set("fundingRate", callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: "subscribeFundingRate",
      symbol,
      market,
      timestamp: Date.now(),
    });

    this.sendMessage(message);
    return subscriptionId;
  }

  // PRIVATE STREAMS (auth)
  public subscribeAccount(callback?: (data: any) => void) {
    if (!this.isAuthenticated || !this.authToken || !this.binanceAccountId) {
      console.error("❌ Authentication required for private streams");
      return null;
    }

    const subscriptionId = `account_${this.binanceAccountId}`;
    const message = {
      action: "subscribePrivateAccount",
      token: this.authToken,
      binanceAccountId: this.binanceAccountId,
    };

    if (callback) {
      this.callbacks.set("account", callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: "subscribePrivateAccount",
      timestamp: Date.now(),
    });

    this.sendMessage(message);
    return subscriptionId;
  }

  public subscribeOrders(callback?: (data: any) => void) {
    if (!this.isAuthenticated || !this.authToken || !this.binanceAccountId) {
      console.error("❌ Authentication required for private streams");
      return null;
    }

    const subscriptionId = `orders_${this.binanceAccountId}`;
    const message = {
      action: "subscribePrivateOrders",
      token: this.authToken,
      binanceAccountId: this.binanceAccountId,
    };

    if (callback) {
      this.callbacks.set("orders", callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: "subscribePrivateOrders",
      timestamp: Date.now(),
    });

    this.sendMessage(message);
    return subscriptionId;
  }

  public subscribeTrades(callback?: (data: any) => void) {
    if (!this.isAuthenticated || !this.authToken || !this.binanceAccountId) {
      console.error("❌ Authentication required for private streams");
      return null;
    }

    const subscriptionId = `trades_${this.binanceAccountId}`;
    const message = {
      action: "subscribePrivateTrades",
      token: this.authToken,
      binanceAccountId: this.binanceAccountId,
    };

    if (callback) {
      this.callbacks.set("trades", callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: "subscribePrivateTrades",
      timestamp: Date.now(),
    });

    this.sendMessage(message);
    return subscriptionId;
  }

  // Điều khiển
  public getSubscriptions() {
    const message = {
      action: "getSubscriptions",
    };
    this.sendMessage(message);
    return Array.from(this.subscriptions.values());
  }

  public unsubscribe(connectionId?: string) {
    const message = {
      action: "unsubscribe",
      ...(connectionId && { connectionId }),
    };

    if (connectionId) {
      this.subscriptions.delete(connectionId);
      this.callbacks.delete(connectionId);
    } else {
      this.subscriptions.clear();
      this.callbacks.clear();
    }

    this.sendMessage(message);
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
    this.callbacks.clear();
    this.onStatusChange("disconnected");
    console.log("🔌 WebSocket disconnected");
  }
}

const DEFAULT_SETTINGS: ChartSettings = {
  quickOrder: false,
  pendingOrders: false,
  positionTag: true,   // đang dùng
  orderHistory: false,
  breakEven: false,
  liquidation: false,
  alerts: false,
  priceLine: false,
  scale: false,
};

export default function TradingTerminal() {
const hasConnectedRef = React.useRef(false);
  
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [currentOrders, setCurrentOrders] = useState<Order[]>(() => {
    const stored = localStorage.getItem('openOrders');
    return stored ? JSON.parse(stored) : [];
  });
  const [showSettings, setShowSettings] = useState(false);
  const settingRef = useRef<HTMLDivElement>(null);
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<BinanceAccount | null>(null);
  const [candles, setCandles] = useState<ExtendedCandle[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [allSymbols, setAllSymbols] = useState<SymbolItem[]>([]);
  const miniTickerCallbacks = useRef<Map<string, (data: MiniTickerData) => void>>(new Map());
  const [searchTerm, setSearchTerm] = useState("");
  const [favoriteSymbols, setFavoriteSymbols] = useState<string[]>(() => {
    const stored = localStorage.getItem("favoriteSymbols");
    return stored ? JSON.parse(stored) : [];
  });
  const [activeSymbolTab, setActiveSymbolTab] = useState<"all" | "favorites">("all");
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const token = localStorage.getItem("token") || "";
  const [showCancelAllConfirm, setShowCancelAllConfirm] = useState(false);

  // State chính
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    return localStorage.getItem('selectedSymbol') || 'BTCUSDT';
  });
  const [selectedMarket, setSelectedMarket] = useState<MarketType>('futures');
  const [selectedInterval, setSelectedInterval] = useState("1m");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [wsService] = useState(() => new CustomWebSocketService());
  const miniTickerMap = useMiniTickerStore((state) => state.miniTickerMap);
  const selectedPrice = miniTickerMap[selectedSymbol]?.lastPrice || 0;

  // Market data
  const [klineData, setKlineData] = useState<KlineData | null>(null);
  const [tickerData, setTickerData] = useState<TickerData | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [recentTrades, setRecentTrades] = useState<TradeData[]>([]);
  const [bookTicker, setBookTicker] = useState<BookTickerData | null>(null);
  const [miniTicker, setMiniTicker] = useState<MiniTickerData | null>(null);

  // Account data (private)
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [orderUpdates, setOrderUpdates] = useState<OrderUpdate[]>([]);

  // UI
  const [activeOrderTab, setActiveOrderTab] = useState<"limit" | "market" | "stop">("limit");
  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  // Trading form
  const [price, setPrice] = useState<number>(0);
  const [amount, setAmount] = useState("");
  const [total, setTotal] = useState("");

  const { user } = useAuth() as { user: User };
  const binanceAccountId = user?.internalAccountId;

  const [floatingInfo, setFloatingInfo] = useState<FloatingInfo | null>(null);

  // Toggle control setting
  const [chartSettings, setChartSettings] = React.useState<ChartSettings>(() => {
    try {
      const saved = localStorage.getItem('chartSettings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });
  const setSetting = React.useCallback(
    (key: keyof ChartSettings, value: boolean) => {
      setChartSettings(prev => {
        const next = { ...prev, [key]: value };
        localStorage.setItem('chartSettings', JSON.stringify(next));
        return next;
      });
    },
    []
  );

  

  // đóng panel setting khi click ngoài
  const panelRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!showSettings) return;
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) setShowSettings(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showSettings]);

  // lưu local symbol
  useEffect(() => {
    if (selectedSymbol) {
      localStorage.setItem('selectedSymbol', selectedSymbol);
    }
  }, [selectedSymbol]);

  const updateCurrentOrders = (orders: Order[]) => {
    setOpenOrders(orders);
    localStorage.setItem('openOrders', JSON.stringify(orders));
  };

  // đóng menu setting khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingRef.current && !settingRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ✅ Dùng một handler duy nhất cho openOrders (tránh ghi đè)
  useEffect(() => {
    binanceWS.setOrderUpdateHandler((orders: any[]) => {
      // service đã chuẩn hoá localStorage; ở đây chỉ sync state
      setOpenOrders(orders || []);
    });
    return () => {
      binanceWS.setOrderUpdateHandler(null);
    };
  }, []);

  // Khi đổi thị trường → kéo account info tương ứng
  useEffect(() => {
    if (!selectedAccount?.id) return;
    if (selectedMarket === "futures") {
      binanceWS.getFuturesAccount(selectedAccount.id);
    } else {
      binanceWS.getSpotAccount(selectedAccount.id);
    }
  }, [selectedMarket, selectedAccount?.id]);

  // Handler WS tổng (không chọn account ở đây để tránh double-select)
  const globalWsHandler = useCallback((msg: any) => {
    console.log("📥 WS Message:", msg);

    switch (msg.type) {
      case "authenticated": {
        // service clean sẽ tự flush queue sau authenticated
        break;
      }
      // ❌ BỎ chọn account ở đây để tránh double select
      // case "myBinanceAccounts": { ... }

      case "cancelAllOrdersSuccess":
        toast.success("Huỷ tất cả lệnh thành công!");
        break;

      case "cancelAllOrdersFailed":
        toast.error("Huỷ tất cả lệnh thất bại!");
        break;

      case "futuresDataLoaded":
      case "balances": {
        const usdt = msg.data?.balances?.find((b: any) => b.asset === "USDT");
        if (usdt) setAvailableBalance(parseFloat(usdt.availableBalance || "0"));
        break;
      }
      default:
        break;
    }
  }, []);

  // 3) useEffect connect (đặt SAU handler)
React.useEffect(() => {
  if (!token) return;
  if (hasConnectedRef.current) return;
  hasConnectedRef.current = true;

  binanceWS.connect(token, globalWsHandler);
}, [token, globalWsHandler]);

  // Kết nối WS trading (service chính) 1 lần
  useEffect(() => {
    if (!token) return;
    binanceWS.connect(token, globalWsHandler);
  }, [token, globalWsHandler]);

  const handleCancelAllOrders = () => {
    binanceWS.cancelAllOrders(selectedSymbol, selectedMarket);
    setShowCancelAllConfirm(false);
  };

  // Tải dữ liệu nến lịch sử ban đầu
  useEffect(() => {
    let isMounted = true;

    const loadHistoricalKlines = async () => {
      try {
        const historicalData = await fetchHistoricalKlines(
          selectedSymbol,
          selectedInterval,
          500
        );
        if (isMounted) {
          setCandles(historicalData);
        }
      } catch (error) {
        console.error("❌ Failed to fetch historical klines:", error);
      }
    };

    loadHistoricalKlines();

    return () => {
      isMounted = false;
    };
  }, [selectedSymbol, selectedInterval]);

  // Khởi tạo WS phụ (public streams cho panel bên) — đã bỏ Kline ở đây để tránh subscribe trùng
  useEffect(() => {
    wsService.setStatusCallback(setConnectionStatus);

    const subscriptionIds: string[] = [];

    // 1) 24h Ticker
    const tickerId = wsService.subscribeTicker(
      selectedSymbol,
      selectedMarket,
      (data) => {
        if (data.symbol !== selectedSymbol) return;
        setTickerData(data);
      }
    );
    if (tickerId) subscriptionIds.push(tickerId);

    // 2) Order Book Depth
    const depthId = wsService.subscribeDepth(
      selectedSymbol,
      "20",
      "1000ms",
      selectedMarket,
      (data) => {
        if (data.symbol !== selectedSymbol) return;
        setOrderBook(data);
      }
    );
    if (depthId) subscriptionIds.push(depthId);

    // 3) Trade Stream
    const tradeId = wsService.subscribeTrade(
      selectedSymbol,
      selectedMarket,
      (data) => {
        if (data.symbol !== selectedSymbol) return;

        const trade: TradeData = {
          symbol: data.symbol,
          tradeId: data.tradeId,
          price: data.price?.toString() ?? "0",
          qty: data.quantity?.toString() ?? "0",
          time: data.tradeTime ?? Date.now(),
          isBuyerMaker: data.isBuyerMaker,
        };

        setRecentTrades((prev) => {
          const newTrades = [trade, ...prev.slice(0, 49)];
          return newTrades.sort((a, b) => b.time - a.time);
        });
      }
    );
    if (tradeId) subscriptionIds.push(tradeId);

    // 4) Book Ticker
    const bookTickerId = wsService.subscribeBookTicker(
      selectedSymbol,
      selectedMarket,
      (data) => {
        if (data.symbol !== selectedSymbol) return;
        setBookTicker(data);
      }
    );
    if (bookTickerId) subscriptionIds.push(bookTickerId);

    // 5) Mini Ticker cho symbol đang chọn (lưu id để cleanup)
    const miniId = wsService.subscribeMiniTicker(
      selectedSymbol,
      selectedMarket,
      (data) => {
        if (data.symbol !== selectedSymbol) return;
        setPrice(parseFloat(data.close));
      }
    );
    if (miniId) subscriptionIds.push(miniId);

    // cập nhật danh sách subscriptions (thông tin hiển thị)
    setSubscriptions(wsService.getSubscriptions());

    return () => {
      // cleanup các stream đã đăng ký trong effect này
      subscriptionIds.forEach((id) => {
        wsService.unsubscribe(id);
      });
    };
  }, [selectedSymbol, selectedMarket, selectedInterval]);

  // Stream Kline duy nhất → cập nhật candles + (tuỳ chọn) overlay klineData
  useEffect(() => {
    const klineId = wsService.subscribeKline(
      selectedSymbol,
      selectedInterval,
      selectedMarket,
      (data) => {
        if (data.symbol !== selectedSymbol) return;

        // set overlay cho panel thông tin (nếu cần)
        setKlineData(data);

        const newCandle: ExtendedCandle = {
          time: Math.floor(data.openTime / 1000),
          open: parseFloat(data.open),
          high: parseFloat(data.high),
          low: parseFloat(data.low),
          close: parseFloat(data.close),
          volume: parseFloat(data.volume),
        };

        setCandles((prev) => {
          const exists = prev.find((c) => c.time === newCandle.time);
          let updated = exists
            ? prev.map((c) => (c.time === newCandle.time ? newCandle : c))
            : [...prev, newCandle];

          if (updated.length > 500) updated = updated.slice(-500);
          return updated;
        });
      }
    );

    return () => {
      wsService.unsubscribe(klineId);
    };
  }, [selectedSymbol, selectedInterval, selectedMarket]);

  // Stream miniTicker cho toàn bộ symbolList để render danh sách — cleanup đúng
  useEffect(() => {
    const ids: string[] = [];

    symbolList.forEach((sym) => {
      const callback = (data: MiniTickerData) => {
        const symbol = data.symbol?.toUpperCase?.();
        const close = parseFloat(data.close);
        const open = parseFloat(data.open);
        const percentChange = open !== 0 ? ((close - open) / open) * 100 : 0;

        // bỏ qua symbol đang chọn
        if (symbol === selectedSymbol) return;

        setAllSymbols((prev) => {
          const updated = prev.filter((s) => s.symbol !== symbol);
          return [
            ...updated,
            {
              symbol,
              price: close,
              percentChange,
              volume: parseFloat(data.volume),
            },
          ];
        });
      };

      const id = wsService.subscribeMiniTicker(sym, selectedMarket, callback);
      ids.push(id);
    });

    return () => {
      ids.forEach((id) => wsService.unsubscribe(id));
    };
  }, [selectedMarket, selectedSymbol]);

  const sortedSymbols: SymbolItem[] = symbolList.map((symbol) => {
    const matched = allSymbols.find((s) => s.symbol === symbol);
    return (
      matched ?? {
        symbol,
        price: 0,
        percentChange: 0,
        volume: 0,
      }
    );
  });

  // ✅ Subscribe realtime theo account đã chọn (thêm ref-guard chống duplicate)
  const subOnceRef = useRef<number | null>(null);
  useEffect(() => {
    const id = selectedAccount?.id;
    if (!id) return;

    const now = Date.now();
    if (subOnceRef.current && now - subOnceRef.current < 1500) return;
    subOnceRef.current = now;

    // 1) chọn account
    binanceWS.selectAccount(id);

    // 2) subscribe realtime (balance/positions/orders)
    binanceWS.subscribeAccountUpdates(setOpenOrders, ['balance','positions','orders']);

    // 3) kéo positions trước một nhịp
    binanceWS.getPositions(id);

    // 4) cập nhật positions từ snapshot/stream
    binanceWS.setPositionUpdateHandler((rawPositions: any[]) => {
      const active = (rawPositions || []).filter((p: any) => parseFloat(p.positionAmt) !== 0);
      setPositions(active);
      localStorage.setItem('positions', JSON.stringify(active));
    });

    return () => {
      binanceWS.unsubscribeAccountUpdates();
    };
  }, [selectedAccount?.id]);

  // Khôi phục account đã chọn từ localStorage khi vào trang (chỉ 1 lần)
  useEffect(() => {
    const savedId = localStorage.getItem('selectedBinanceAccountId');
    const parsedId = savedId ? parseInt(savedId, 10) : null;
    if (!parsedId) return;

    const restore = () => {
      binanceWS.setCurrentAccountId(parsedId);
      binanceWS.selectAccount(parsedId);
      binanceWS.getMultiAssetsMode();
      setSelectedAccount({ id: parsedId } as BinanceAccount);
    };

    const timer = setTimeout(() => {
      if (binanceWS.isConnected()) {
        restore();
      } else {
        const waitInterval = setInterval(() => {
          if (binanceWS.isConnected()) {
            clearInterval(waitInterval);
            restore();
          }
        }, 200);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  const handleUnsubscribe = (subscriptionId: string) => {
    wsService.unsubscribe(subscriptionId);
    setSubscriptions(wsService.getSubscriptions());
  };

  const handleClickOrderBookPrice = (price: number) => {
    setPrice(price);
  };

  const handleSymbolChange = (newSymbol: string) => {
    setSelectedSymbol(newSymbol);
  };

  const handleMarketChange = (newMarket: MarketType) => {
    setSelectedMarket(newMarket);
    localStorage.setItem('selectedMarket', newMarket);
    console.log("✅ Market selected:", newMarket);
  };
  useEffect(() => {
    const savedMarket = localStorage.getItem('selectedMarket');
    if (savedMarket === 'spot' || savedMarket === 'futures') {
      setSelectedMarket(savedMarket as MarketType);
    }
  }, []);

  const handleIntervalChange = (newInterval: string) => {
    setSelectedInterval(newInterval);
  };

  const calculateTotal = (price: string, amount: string) => {
    if (price && amount) {
      const calculatedTotal = parseFloat(price) * parseFloat(amount);
      return calculatedTotal.toFixed(8);
    }
    return "";
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAmount = e.target.value;
    setAmount(newAmount);
    setTotal(calculateTotal(String(price), newAmount));
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPrice = e.target.value;
    setPrice(Number(newPrice));
    setTotal(calculateTotal(newPrice, amount));
  };

  const handleTotalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTotal = e.target.value;
    setTotal(newTotal);

    if (newTotal && price && parseFloat(String(price)) !== 0) {
      const calculatedAmount = (
        parseFloat(newTotal) / parseFloat(String(price))
      ).toFixed(8);
      setAmount(calculatedAmount);
    } else {
      setAmount("");
    }
  };

  return (
    <div className="h-[calc(100dvh-4rem)] bg-dark-900 flex flex-col">
      {/* Thanh trên cùng: chọn symbol + trạng thái + tài khoản */}
      <div className="shrink-0 border-b border-dark-700 bg-dark-800">
        <div className="flex items-center justify-between px-4 py-2">
          {/* Trái: chọn symbol + stats nhanh */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center">
              <div className="relative z-50">
                {/* Nút chọn symbol */}
                <button
                  className="flex items-center space-x-2 hover:bg-dark-700 px-3 py-2 rounded"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                >
                  <div className="h-6 w-6 rounded-full bg-warning-300 flex items-center justify-center">
                    <span className="text-xs font-bold text-dark-900">
                      {selectedSymbol[0]}
                    </span>
                  </div>
                  <span className="font-bold text-lg">{selectedSymbol}</span>
                  <ChevronDown className="h-4 w-4 text-dark-400" />
                </button>

                {/* Menu dropdown symbol */}
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-[350px] max-h-[500px] bg-dark-800 rounded shadow-lg overflow-y-auto z-[999] border border-dark-700">
                    <SymbolDropdown
                      symbols={sortedSymbols}
                      selectedSymbol={selectedSymbol}
                      favorites={favoriteSymbols}
                      searchTerm={searchTerm}
                      activeTab={activeSymbolTab}
                      onSelect={(s) => {
                        setSelectedSymbol(s);
                        setIsDropdownOpen(false);
                      }}
                      onToggleFavorite={(symbol) => {
                        setFavoriteSymbols((prev) =>
                          prev.includes(symbol)
                            ? prev.filter((s) => s !== symbol)
                            : [...prev, symbol]
                        );
                      }}
                      onSearchChange={setSearchTerm}
                      onTabChange={setActiveSymbolTab}
                    />
                  </div>
                )}
              </div>

              <Star className="h-4 w-4 text-dark-400 hover:text-warning-300 ml-2 cursor-pointer" />
            </div>

            {/* Chọn market */}
            <div className="flex items-center space-x-2">
              <span className="text-xs text-dark-400">Market:</span>
              <select
                value={selectedMarket}
                onChange={(e) =>
                  handleMarketChange(e.target.value as 'spot' | 'futures')
                }
                className="bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs focus:border-primary-500 focus:outline-none"
              >
                <option value="futures">FUTURES</option>
                <option value="spot">SPOT</option>
              </select>
            </div>

            {/* Hiển thị giá + thay đổi 24h */}
            {tickerData && (
              <>
                <div className="flex flex-col">
                  <span className="text-lg font-bold">
                    {parseFloat(tickerData.lastPrice).toFixed(4)}
                  </span>
                  <span className="text-xs text-dark-400">
                    ≈ ${parseFloat(tickerData.lastPrice).toFixed(2)}
                  </span>
                </div>

                <div className="flex flex-col">
                  <span
                    className={`text-sm font-medium ${
                      parseFloat(tickerData.priceChange) >= 0
                        ? "text-success-500"
                        : "text-danger-500"
                    }`}
                  >
                    {parseFloat(tickerData.priceChange) >= 0 ? "+" : ""}
                    {parseFloat(tickerData.priceChange).toFixed(4)}
                  </span>
                  <span
                    className={`text-xs ${
                      parseFloat(tickerData.priceChangePercent) >= 0
                        ? "text-success-500"
                        : "text-danger-500"
                    }`}
                  >
                    {parseFloat(tickerData.priceChangePercent) >= 0 ? "+" : ""}
                    {tickerData.priceChangePercent}%
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Phải: trạng thái kết nối + chọn tài khoản + controls */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {connectionStatus === "connected" ? (
                <Wifi className="h-4 w-4 text-success-500" />
              ) : connectionStatus === "connecting" ? (
                <div className="h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <WifiOff className="h-4 w-4 text-danger-500" />
              )}
              <span className="text-xs text-dark-400 capitalize">
                {connectionStatus}
              </span>
            </div>

            {/* Tài khoản Binance đang chọn */}
            <div className="flex items-center space-x-2">
              <span className="text-xs text-dark-400">Tài khoản:</span>
              <BinanceAccountSelector
                onSelect={(id) => {
                  setSelectedAccount({ id });
                }}
              />
            </div>

            <div className="text-xs text-dark-400">
              Subscriptions: {subscriptions.length}
            </div>

            <button
              onClick={() => wsService.getSubscriptions()}
              className="p-1 hover:bg-dark-700 rounded"
            >
              <RefreshCw className="h-4 w-4 text-dark-400" />
            </button>

            <button className="p-1 hover:bg-dark-700 rounded">
              <Settings className="h-4 w-4 text-dark-400" />
            </button>
          </div>
        </div>

        {/* Dải stats 24h */}
        {tickerData && (
          <div className="flex items-center space-x-8 px-4 py-2 text-xs border-t border-dark-700">
            <div className="flex flex-col">
              <span className="text-dark-400">24h High</span>
              <span className="font-medium">
                {parseFloat(tickerData.highPrice).toFixed(4)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-dark-400">24h Low</span>
              <span className="font-medium">
                {parseFloat(tickerData.lowPrice).toFixed(4)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-dark-400">
                24h Volume ({selectedSymbol.replace("USDT", "")})
              </span>
              <span className="font-medium">
                {parseFloat(tickerData.volume).toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-dark-400">24h Volume (USDT)</span>
              <span className="font-medium">
                {parseFloat(tickerData.quoteVolume).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Thân chính: Chart trái, Order book giữa, Form phải */}
      <div className="flex gap-1 flex-1 min-h-0 overflow-hidden">
        {/* Trái: Biểu đồ */}
        <div className="flex-1 min-w-0 bg-dark-800 border-r border-dark-700 overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Controls chart */}
            <div className="flex items-center justify-between p-3 border-b border-dark-700">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1d"].map(
                    (interval) => (
                      <button
                        key={interval}
                        onClick={() => handleIntervalChange(interval)}
                        className={`text-xs px-2 py-1 rounded hover:bg-dark-600 ${
                          selectedInterval === interval ? "bg-dark-700" : ""
                        }`}
                      >
                        {interval}
                      </button>
                    )
                  )}
                </div>

                <div className="relative" ref={settingRef}>
                  <div className="flex items-center gap-2">
                    <button className="btn">Candlesticks</button>
                    <button className="btn">Line</button>

                    <div className="flex items-center gap-2 mb-2 relative" ref={panelRef}>
                      <button
                        className="btn-outline p-2 hover:ring-1 ring-primary-500 rounded-md"
                        title="Cài đặt biểu đồ"
                        onClick={() => setShowSettings(v => !v)}
                      >
                        <Settings size={15} />
                      </button>

                      {showSettings && (
                        <div className="absolute top-full left-0 mt-2 z-50">
                          <SettingControl
                            settings={chartSettings}
                            onToggle={setSetting}
                            onClose={() => setShowSettings(false)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button className="p-1 hover:bg-dark-700 rounded">
                  <TrendingUp className="h-4 w-4 text-dark-400" />
                </button>
                <button className="p-1 hover:bg-dark-700 rounded">
                  <Maximize2 className="h-4 w-4 text-dark-400" />
                </button>
              </div>
            </div>

            {/* Khu vực biểu đồ */}
            <div className="flex-1 relative min-h-0">
              <section className="h-full min-w-0 bg-dark-800 rounded-xl overflow-hidden">
                <div className="h-full min-h-0">
                  <TradingBinance
                    selectedSymbol={selectedSymbol}
                    selectedInterval={selectedInterval}
                    market={selectedMarket}
                    floating={floatingInfo}
                    showPositionTag={chartSettings.positionTag}
                    onRequestSymbolChange={(sym) => setSelectedSymbol(sym)}
                  />
                </div>
              </section>

              {/* Overlay OHLCV */}
              <div className="absolute top-4 left-4 bg-dark-800/80 rounded p-2 text-xs z-10">
                {klineData && (
                  <div className="space-y-1">
                    <div>
                      O:{" "}
                      <span className="font-mono">
                        {parseFloat(klineData.open || "0").toFixed(2)}
                      </span>
                    </div>
                    <div>
                      H:{" "}
                      <span className="font-mono text-success-500">
                        {parseFloat(klineData.high || "0").toFixed(2)}
                      </span>
                    </div>
                    <div>
                      L:{" "}
                      <span className="font-mono text-danger-500">
                        {parseFloat(klineData.low || "0").toFixed(2)}
                      </span>
                    </div>
                    <div>
                      C:{" "}
                      <span className="font-mono">
                        {parseFloat(klineData.close || "0").toFixed(2)}
                      </span>
                    </div>
                    <div>
                      V:{" "}
                      <span className="font-mono">
                        {parseFloat(klineData.volume || "0").toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Giữa: Order Book */}
        <div className="min-h-0 w-56 md:w-64 bg-dark-800 border-r border-dark-700">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-dark-700">
              <h3 className="text-sm font-medium">Order Book</h3>
              <div className="flex items-center space-x-2">
                <button className="text-xs text-dark-400 hover:text-dark-200">
                  0.01
                </button>
                <Settings className="h-3 w-3 text-dark-400" />
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              {orderBook ? (
                <div className="h-full flex flex-col">
                  {/* Asks */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="space-y-0.5 p-2">
                      {orderBook.asks
                        .slice(0, 15)
                        .reverse()
                        .map((ask, index) => (
                          <div
                            key={index}
                            className="flex justify-between text-xs relative cursor-pointer hover:bg-dark-700"
                            onClick={() =>
                              handleClickOrderBookPrice(parseFloat(ask.price))
                            }
                          >
                            <span className="text-danger-500 font-mono">
                              {parseFloat(ask.price).toFixed(4)}
                            </span>
                            <span className="text-dark-300 font-mono">
                              {parseFloat(ask.quantity).toFixed(3)}
                            </span>
                            <div
                              className="absolute right-0 top-0 h-full bg-danger-500/10"
                              style={{
                                width: `${Math.min(
                                  (parseFloat(ask.quantity) / 10) * 100,
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Giá hiện tại */}
                  <div className="px-2 py-1 border-y border-dark-700">
                    <div className="text-center">
                      <div
                        className={`text-sm font-bold ${
                          tickerData && parseFloat(tickerData.priceChange) >= 0
                            ? "text-success-500"
                            : "text-danger-500"
                        }`}
                      >
                        {tickerData
                          ? parseFloat(tickerData.lastPrice).toFixed(4)
                          : "0.0000"}
                      </div>
                      <div className="text-xs text-dark-400">
                        ≈ $
                        {tickerData
                          ? parseFloat(tickerData.lastPrice).toFixed(2)
                          : "0.00"}
                      </div>
                    </div>
                  </div>

                  {/* Bids */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="space-y-0.5 p-2">
                      {orderBook.bids.slice(0, 15).map((bid, index) => (
                        <div
                          key={index}
                          className="flex justify-between text-xs relative cursor-pointer hover:bg-dark-700"
                          onClick={() =>
                            handleClickOrderBookPrice(parseFloat(bid.price))
                          }
                        >
                          <span className="text-success-500 font-mono">
                            {parseFloat(bid.price).toFixed(4)}
                          </span>
                          <span className="text-dark-300 font-mono">
                            {parseFloat(bid.quantity).toFixed(3)}
                          </span>
                          <div
                            className="absolute right-0 top-0 h-full bg-success-500/10"
                            style={{
                              width: `${Math.min(
                                (parseFloat(bid.quantity) / 10) * 100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-dark-400">
                  <div className="text-center">
                    <div className="text-sm">No order book data</div>
                    <div className="text-xs mt-1">
                      Waiting for WebSocket connection...
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Phải: Form đặt lệnh + (optional) Recent trades */}
        <div className="min-h-0 w-64 md:w-72 lg:w-80 bg-dark-800 border-l border-dark-700 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <TradingForm
              selectedSymbol={selectedSymbol}
              price={price}
              internalBalance={availableBalance}
              selectedMarket={selectedMarket}
            />
          </div>
        </div>
      </div>

      {/* Panel dưới: Positions/Orders */}
      <div className="shrink-0 h-[28dvh] min-h-[220px] max-h-[40dvh] border-t border-dark-700 bg-dark-800 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <PositionFunction
            market={selectedMarket}
            selectedSymbol={selectedSymbol}
            orderBook={orderBook}
            positions={positions}
            onFloatingInfoChange={setFloatingInfo}
          />
        </div>
      </div>
    </div>
  );
}
