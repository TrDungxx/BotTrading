import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  ChevronUp,
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
  Menu,
} from "lucide-react";
import TradingBinance from "../components/common/TradingBinance";
import MaintenanceModal from "../components/common/popuptradingterminal/MaintenanceModal";

import { ErrorPopup } from "../components/common/popuptradingterminal/ErrorPopup";
import { fetchHistoricalKlines } from "../utils/fetchKline";
import { ExtendedCandle } from "../utils/types";
import { Order } from "../utils/types";
import SymbolDropdown from "../components/symboldropdown/SymbolDropdown";
import symbolList from "../utils/symbolList";
import TradingForm from "../components/common/TradingForm";
import { useMiniTickerStore } from "../utils/miniTickerStore";
import { binanceWS,OPEN_ORDERS_LS_KEY, OPEN_ORDERS_EVENT } from "../components/binancewebsocket/BinanceWebSocketService";
import { toast } from "react-toastify";


import SettingControl from "../components/common/controlsetting/SetiingControl";
import { BinanceAccount } from "../utils/types";
import BinanceAccountSelector from "../components/common/BinanceAccountSelector";
import { useAuth } from "../context/AuthContext";
import { User } from "../utils/types";
import { PositionData, FloatingInfo } from "../utils/types";
import PositionFunction from "../components/common/PositionFunction";
import "../style/trading/trading.css";
import "../style/trading/trading-variables.css";
import "../style/trading/trading-header.css";
import "../style/trading/trading-chart.css";
import "../style/trading/trading-orderbook.css";
import "../style/trading/trading-positions.css";
import "../../src/style/trading/position-mobile-layout.css"

import "../style/trading/trading-layout.css";


import "../style/trading/trading-form.css";



import "../style/trading/sidebar.css";

import ChartTypePanel, {
  ChartType,
} from "../components/layoutchart/Charttypepanel";
// ✅ THÊM
import TimeframeModalWrapper from "./layout panel/Timeframemodalwrapper";
// Trạng thái kết nối WS
type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error" | "maintenance";


// Loại thị trường
type MarketType = "spot" | "futures";

export type ChartSettings = {
  quickOrder: boolean; // Lệnh nhanh
  pendingOrders: boolean; // Lệnh chờ
  positionTag: boolean; // Vị thế (Floating)
  orderHistory: boolean; // Lịch sử đặt lệnh
  breakEven: boolean; // Giá hòa vốn
  liquidation: boolean; // Giá thanh lý
  alerts: boolean; // Cảnh báo giá
  priceLine: boolean; // Đường giá
  scale: boolean; // Thang đo
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


interface Order {
  orderId: number;
  symbol: string;
  status: string;
  positionSide: "LONG" | "SHORT" | "BOTH";
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
  public onStatusChange: (status: ConnectionStatus) => void = () => { };

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
      this.reconnectAttempts = 0;

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
      
      // ✅ HIỆN MODAL NGAY LẬP TỨC KHI CÓ LỖI
      this.onStatusChange("maintenance");
      this.isConnected = false;
      this.reconnectAttempts++;
    };

    this.ws.onclose = (event) => {
      console.warn("🔌 WebSocket closed:", event.code, event.reason);
      
      // ✅ NẾU ĐÓNG BẤT THƯỜNG (không phải close bình thường)
      if (event.code !== 1000 && event.code !== 1001) {
        this.onStatusChange("maintenance");
      } else {
        this.onStatusChange("disconnected");
      }
      
      this.isConnected = false;
      this.attemptReconnect();
    };
  } catch (error) {
    console.error("❌ Failed to connect WebSocket:", error);
    
    // ✅ HIỆN MODAL NGAY KHI KHÔNG TẠO ĐƯỢC WEBSOCKET
    this.onStatusChange("maintenance");
    this.reconnectAttempts++;
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
  positionTag: true, // đang dùng
  orderHistory: false,
  breakEven: false,
  liquidation: false,
  alerts: false,
  priceLine: false,
  scale: false,
};

export default function TradingTerminal() {



  const hasConnectedRef = React.useRef(false);
  const [isTradingFormOpen, setIsTradingFormOpen] = useState(false);
  const [isPositionPanelOpen, setIsPositionPanelOpen] = useState(true); // Default open
  const [showPositionTab, setShowPositionTab] = useState(false);

  const symbolDropdownWrapperRef = useRef<HTMLDivElement>(null);
  // Calculate dropdown position with absolute coordinates
  const getDropdownPosition = () => {
    if (!symbolButtonRef.current) return null;

    const rect = symbolButtonRef.current.getBoundingClientRect();
    const buttonMiddle = rect.top + rect.height / 2;
    const screenMiddle = window.innerHeight / 2;

    const openUpward = buttonMiddle > screenMiddle;

    return {
      position: openUpward ? "top" : "bottom",
      left: rect.left,
      top: openUpward ? undefined : rect.bottom + 8,
      bottom: openUpward ? window.innerHeight - rect.top + 8 : undefined,
      width: rect.width,
    };
  };
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [livePrice, setLivePrice] = useState<number>(0);
  const [positions, setPositions] = useState<PositionData[]>([]);

  const [showSettings, setShowSettings] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingRef = useRef<HTMLDivElement>(null);

  const [selectedAccount, setSelectedAccount] = useState<BinanceAccount | null>(
    null
  );
  const [candles, setCandles] = useState<ExtendedCandle[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [allSymbols, setAllSymbols] = useState<SymbolItem[]>([]);

  const [searchTerm, setSearchTerm] = useState("");

  const [activeSymbolTab, setActiveSymbolTab] = useState<"all" | "favorites">(
    "all"
  );
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const token = localStorage.getItem("token") || "";

const [errorPopup, setErrorPopup] = useState<{
  show: boolean;
  message: string;
}>({
  show: false,
  message: ''
});
  // State chính
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    return localStorage.getItem("selectedSymbol") || "BTCUSDT";
  });
  const [selectedMarket, setSelectedMarket] = useState<MarketType>("futures");
  // ✅ MỚI:
  const [selectedInterval, setSelectedInterval] = useState(() => {
    return localStorage.getItem("selectedInterval") || "1m";
  });

  useEffect(() => {
    if (selectedInterval) {
      localStorage.setItem("selectedInterval", selectedInterval);
    }
  }, [selectedInterval]);

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [wsService] = useState(() => new CustomWebSocketService());
  const miniTickerMap = useMiniTickerStore((state) => state.miniTickerMap);
  const selectedPrice = miniTickerMap[selectedSymbol]?.lastPrice || 0;
  const [chartType, setChartType] = useState<ChartType>("Candles");

  // ✅ NEW: State cho TimeframeSelector
  const [showTimeframeSelector, setShowTimeframeSelector] = useState(false);

  const [pinnedTimeframes, setPinnedTimeframes] = useState<string[]>(() => {
    const stored = localStorage.getItem("pinnedTimeframes");
    return stored
      ? JSON.parse(stored)
      : ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1d"];
  });
  const handleSaveTimeframes = useCallback((selectedTimeframes: string[]) => {
    setPinnedTimeframes(selectedTimeframes);
    localStorage.setItem(
      "pinnedTimeframes",
      JSON.stringify(selectedTimeframes)
    );
  }, []); // ✅ Empty deps = function reference KHÔNG ĐỔI

  const handleCloseTimeframe = useCallback(() => {
    setShowTimeframeSelector(false);
  }, []);

  // Refs
  const symbolButtonRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handlers
  const handleSymbolButtonEnter = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsDropdownOpen(true);
    }, 150);
  };

  const handleSymbolButtonLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);


 useEffect(() => {
  const originalError = console.error;
  const originalWarn = console.warn;
  let errorCount = 0;
  let modalTimer: NodeJS.Timeout | null = null;
  let resetTimer: NodeJS.Timeout | null = null;
  
  const handleError = () => {
    errorCount++;
    console.log(`🚨 WebSocket error #${errorCount}`);
    
    // Reset counter sau 15 giây (tăng lên để cho đủ thời gian connect)
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      console.log('🔄 Resetting error count (connection recovered)');
      errorCount = 0;
    }, 15000);
    
    // ✅ CHỈ hiện modal nếu có >= 3 lỗi VÀ connectionStatus !== "connected"
    if (errorCount >= 3) {
      console.log('🚨 Multiple errors detected, checking connection status...');
      
      if (modalTimer) clearTimeout(modalTimer);
      
      // ✅ Đợi 8 giây rồi check status
      modalTimer = setTimeout(() => {
        // Kiểm tra xem đã connect lại chưa
        if (connectionStatus !== "connected") {
          console.log('⏰ Connection still failed → Showing modal');
          setShowMaintenanceModal(true);
        } else {
          console.log('✅ Connection recovered → NOT showing modal');
          errorCount = 0; // Reset vì đã ổn
        }
      }, 8000); // Tăng lên 8 giây để cho đủ thời gian reconnect
    }
  };
  
  console.error = function(...args) {
  const msg = args.join(' ');
  
  if (msg.includes('WebSocket') || msg.includes('ws://')) {
    // ✅ Chỉ log nếu không đang connecting
    if (connectionStatus !== 'connecting') {
      handleError();
    } else {
      console.log('⏳ WebSocket connecting... (ignoring error)');
    }
  }
  
  originalError.apply(console, args);
};
  
  console.warn = function(...args) {
    const msg = args.join(' ');
    if (msg.includes('WebSocket closed') && msg.includes('1006')) {
      handleError();
    }
    originalWarn.apply(console, args);
  };

  return () => {
    console.error = originalError;
    console.warn = originalWarn;
    if (modalTimer) clearTimeout(modalTimer);
    if (resetTimer) clearTimeout(resetTimer);
  };
}, [connectionStatus]); // ✅ Thêm dependency

// ===== ERROR POPUP LISTENER (Giống MaintenanceModal pattern) =====
useEffect(() => {
  const originalLog = console.log;
  
  console.log = function(...args) {
    const msg = args.join(' ');
    
    // Bắt RAW WS MSG từ BinanceWebSocketService
    if (msg.includes('📥 RAW WS MSG:') && msg.includes('"type":"error"')) {
      try {
        // Tìm JSON object trong message
        const jsonMatch = msg.match(/(\{[^}]*"type"\s*:\s*"error"[^}]*\})/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          if (data.type === 'error' && data.message) {
            
            setErrorPopup({
              show: true,
              message: data.message
            });
          }
        }
      } catch (e) {
        console.error('Error parsing popup message:', e);
      }
    }
    
    originalLog.apply(console, args);
  };
  
  return () => {
    console.log = originalLog;
  };
}, []);
  
useEffect(() => {
  // ✅ Show modal when connection status is "maintenance"
  
  if (connectionStatus === "maintenance") {
    
    setShowMaintenanceModal(true);
  } else if (connectionStatus === "connected") {
    
    setShowMaintenanceModal(false);
  }
}, [connectionStatus]);

const handleRefreshConnection = () => {
  setShowMaintenanceModal(false);
  
  // Force reconnect by creating new WebSocket service
  wsService.disconnect();
  
  // Wait a bit then reload page
  setTimeout(() => {
    window.location.reload();
  }, 500);
};

  // Cleanup
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Market data
  const [klineData, setKlineData] = useState<KlineData | null>(null);
  const [tickerData, setTickerData] = useState<TickerData | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [recentTrades, setRecentTrades] = useState<TradeData[]>([]);
  const [bookTicker, setBookTicker] = useState<BookTickerData | null>(null);
  const [miniTicker, setMiniTicker] = useState<MiniTickerData | null>(null);



  // UI


  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  // Trading form
  const [price, setPrice] = useState<number>(0);


  const { user } = useAuth() as { user: User };
  const binanceAccountId = user?.internalAccountId;

  const [floatingInfo, setFloatingInfo] = useState<FloatingInfo | null>(null);

  // Toggle control setting
  const [chartSettings, setChartSettings] = React.useState<ChartSettings>(
    () => {
      try {
        const saved = localStorage.getItem("chartSettings");
        return saved
          ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
          : DEFAULT_SETTINGS;
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
  );



  // ============= RESPONSIVE STATE (THÊM MỚI) =============
  const [isMobile, setIsMobile] = useState(false);


  // Detect screen size
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Auto close khi chuyển về desktop
      if (!mobile) {
        setIsTradingFormOpen(false);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // 4️⃣ AUTO CLOSE KHI ĐỔI SYMBOL (optional - thêm useEffect):
  useEffect(() => {
    if (isMobile) {
      setIsTradingFormOpen(false);
    }
  }, [selectedSymbol]);
  // ======================================================



  // đóng panel setting khi click ngoài (có guard modal Time)
  const panelRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showSettings) return;

    const onClick = (e: MouseEvent) => {
      if (showTimeframeSelector) return; // ✅ Check trực tiếp state
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) setShowSettings(false);
    };

    document.addEventListener("mousedown", onClick,);
    return () => document.removeEventListener("mousedown", onClick, true);
  }, [showSettings, showTimeframeSelector]); // ✅ Thêm dependency

  // Reset khi đổi symbol
  useEffect(() => {
    setLivePrice(0); // reset khi đổi symbol
  }, [selectedSymbol]);
  // lưu local symbol
  useEffect(() => {
    if (selectedSymbol) {
      localStorage.setItem("selectedSymbol", selectedSymbol);
    }
  }, [selectedSymbol]);



  // đóng menu setting khi click ra ngoài (có guard modal Time)

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
  useEffect(() => {
    const checkShowTab = () => {
      const shouldShowTab = window.innerWidth < 1200; // < 1200px = show tab
      setShowPositionTab(shouldShowTab);

      // Desktop: auto open
      if (!shouldShowTab) {
        setIsPositionPanelOpen(true);
      }
    };

    checkShowTab();
    window.addEventListener("resize", checkShowTab);
    return () => window.removeEventListener("resize", checkShowTab);
  }, []);

  // 3️⃣ COUNT POSITIONS (để hiện badge số):
  const [positionCount, setPositionCount] = useState(0);

  // useEffect để đếm positions (nếu chưa có)
  useEffect(() => {
    // Count active positions
    const count = positions.filter(
      (p) => Math.abs(parseFloat(p.positionAmt || "0")) > 0
    ).length;
    setPositionCount(count);
  }, [positions]);

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

      case "error": {
  
  
  setErrorPopup({
    show: true,
    message: msg.message || "An error occurred"
  });
  
  break;
}

      case "cancelAllOrdersSuccess":

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

    // ✅ THÊM - Set maintenance callback TRƯỚC KHI connect
    binanceWS.setMaintenanceCallback(() => {
      console.log('🚨 BinanceWS maintenance callback triggered!');
      setShowMaintenanceModal(true);
    });

    binanceWS.connect(token, globalWsHandler);
  }, [token, globalWsHandler]);



  // Tải dữ liệu nến lịch sử ban đầu
  useEffect(() => {
    let isMounted = true;

    const loadHistoricalKlines = async () => {
      try {
     
        const historicalData = await fetchHistoricalKlines(
          selectedSymbol,
  selectedInterval,
  500,
  selectedMarket 
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
        const p = Number(data.lastPrice);
        if (p > 0) setLivePrice(p); // ✅ thêm dòng này
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
        const bid = Number(data.bidPrice);
        const ask = Number(data.askPrice);
        const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : 0;
        if (mid > 0) setLivePrice(mid); // ✅ thêm dòng này
      }
    );
    if (bookTickerId) subscriptionIds.push(bookTickerId);

    // 5) Mini Ticker cho symbol đang chọn (lưu id để cleanup)
    const miniId = wsService.subscribeMiniTicker(
      selectedSymbol,
      selectedMarket,
      (data) => {
        if (data.symbol !== selectedSymbol) return;
        setMiniTicker(data); // (tuỳ bạn có dùng)
        const p = Number(data.close ?? data.c ?? 0);
        if (p > 0) setLivePrice(p); // ✅ thêm dòng này
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
  binanceWS.subscribeAccountUpdates(setOpenOrders, [
    "balance",
    "positions",
    "orders",
  ]);

  // 3) kéo positions trước một nhịp
  binanceWS.getPositions(id);
  binanceWS.getOpenOrders(selectedMarket, undefined, (orders) => {
  console.log('📥 Initial getOpenOrders:', orders);
  localStorage.setItem(OPEN_ORDERS_LS_KEY, JSON.stringify(orders));
  window.dispatchEvent(new CustomEvent(OPEN_ORDERS_EVENT, { detail: { list: orders } }));
});
  // ✅ 4) THÊM ĐOẠN NÀY - Kéo open orders ngay khi load
  binanceWS.getOpenOrders(selectedMarket, undefined, (orders) => {
    console.log('📥 Initial getOpenOrders:', orders);
    localStorage.setItem(OPEN_ORDERS_LS_KEY, JSON.stringify(orders));
    window.dispatchEvent(new CustomEvent(OPEN_ORDERS_EVENT, { detail: { list: orders } }));
  });

  // 5) cập nhật positions từ snapshot/stream
  binanceWS.setPositionUpdateHandler((rawPositions: any[]) => {
    const active = (rawPositions || []).filter(
      (p: any) => parseFloat(p.positionAmt) !== 0
    );
    setPositions(active);
    localStorage.setItem("positions", JSON.stringify(active));
  });

  return () => {
    binanceWS.unsubscribeAccountUpdates();
  };
}, [selectedAccount?.id, selectedMarket]);

  // Khôi phục account đã chọn từ localStorage khi vào trang (chỉ 1 lần)
  useEffect(() => {
    const savedId = localStorage.getItem("selectedBinanceAccountId");
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



  const handleClickOrderBookPrice = (price: number) => {
    setPrice(price);
  };



  const handleMarketChange = (newMarket: MarketType) => {
    setSelectedMarket(newMarket);
    localStorage.setItem("selectedMarket", newMarket);
    console.log("✅ Market selected:", newMarket);
  };
  useEffect(() => {
    const savedMarket = localStorage.getItem("selectedMarket");
    if (savedMarket === "spot" || savedMarket === "futures") {
      setSelectedMarket(savedMarket as MarketType);
    }
  }, []);

  const handleIntervalChange = (newInterval: string) => {
    setSelectedInterval(newInterval);
    localStorage.setItem("selectedInterval", newInterval); // ✅ Thêm dòng này
  };




  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 150);

    return () => clearTimeout(timer);
  }, [
    isPositionPanelOpen,
    isTradingFormOpen,
    positions?.length,
    showPositionTab,
    positionCount,
    isMobile,                    // Thêm: Khi responsive breakpoint đổi
    selectedSymbol,              // Thêm: Khi đổi symbol
  ]);



  return (

    <div className="trading-terminal">
      {/* ===== HEADER ===== */}
      <div className="trading-header">
        {/* Symbol Selector Row */}
        <div className="symbol-selector-row">
          {/* Left: Symbol + Price Info */}
          <div className="symbol-info-group">
            {/* Symbol Selector */}
            <div className="symbol-selector">
              <div className="relative z-50">
                <div
                  ref={symbolButtonRef}
                  className="flex items-center space-x-2 hover:bg-dark-700 px-3 py-2 rounded transition-colors cursor-default"
                  onMouseEnter={handleSymbolButtonEnter}
                  onMouseLeave={handleSymbolButtonLeave}
                >
                  <div className="h-6 w-6 rounded-full bg-warning-300 flex items-center justify-center">
                    <span className="text-xs font-bold text-dark-900">
                      {selectedSymbol[0]}
                    </span>
                  </div>
                  <span className="font-bold text-lg">{selectedSymbol}</span>
                  <ChevronDown className="h-4 w-4 text-dark-400" />
                </div>

                {isDropdownOpen &&
                  (() => {
                    const pos = getDropdownPosition();
                    if (!pos) return null;

                    return createPortal(
                      <div
                        ref={symbolDropdownWrapperRef}
                        className="fixed z-[9999]"
                        style={{
                          left: `${pos.left}px`,
                          top:
                            pos.top !== undefined ? `${pos.top}px` : undefined,
                          bottom:
                            pos.bottom !== undefined
                              ? `${pos.bottom}px`
                              : undefined,
                        }}
                      >
                        <SymbolDropdown
                          selectedSymbol={selectedSymbol}
                          searchTerm={searchTerm}
                          activeTab={activeSymbolTab}
                          onSelect={(s) => {
                            setSelectedSymbol(s);
                            setIsDropdownOpen(false);
                          }}
                          onSearchChange={setSearchTerm}
                          onTabChange={setActiveSymbolTab}
                          market="futures"
                          quote="USDT"
                          isOpen={isDropdownOpen}
                          onOpen={() => setIsDropdownOpen(true)}
                          onClose={() => setIsDropdownOpen(false)}
                        />
                      </div>,
                      document.body // ✅ Render vào body, không bị parent giới hạn!
                    );
                  })()}
              </div>

              <Star className="h-4 w-4 text-dark-400 hover:text-warning-300 ml-2 cursor-pointer" />
            </div>

            {/* Market Selector */}
            <div className="flex items-center space-x-2">
              <span className="text-xs text-dark-400">Market:</span>
              <select
                value={selectedMarket}
                onChange={(e) =>
                  handleMarketChange(e.target.value as "spot" | "futures")
                }
                className="bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs focus:border-primary-500 focus:outline-none"
              >
                <option value="futures">FUTURES</option>
                <option value="spot">SPOT</option>
              </select>
            </div>

            {/* Price Display */}
            {tickerData && (
              <div className="price-display-group">
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
                    className={`text-sm font-medium ${parseFloat(tickerData.priceChange) >= 0
                      ? "text-success-500"
                      : "text-danger-500"
                      }`}
                  >
                    {parseFloat(tickerData.priceChange) >= 0 ? "+" : ""}
                    {parseFloat(tickerData.priceChange).toFixed(4)}
                  </span>
                  <span
                    className={`text-xs ${parseFloat(tickerData.priceChangePercent) >= 0
                      ? "text-success-500"
                      : "text-danger-500"
                      }`}
                  >
                    {parseFloat(tickerData.priceChangePercent) >= 0 ? "+" : ""}
                    {tickerData.priceChangePercent}%
                  </span>
                </div>
              </div>
            )}
          </div>
          {/* Stats Row 24h - Show only on XL */}
          <div className="stats-row-24h">
            {tickerData ? (
              <>
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
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-dark-400">24h High</span>
                  <div className="h-4 w-20 bg-dark-700 animate-pulse rounded" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-dark-400">24h Low</span>
                  <div className="h-4 w-20 bg-dark-700 animate-pulse rounded" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-dark-400">24h Volume (BTC)</span>
                  <div className="h-4 w-24 bg-dark-700 animate-pulse rounded" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-dark-400">24h Volume (USDT)</span>
                  <div className="h-4 w-24 bg-dark-700 animate-pulse rounded" />
                </div>
              </>
            )}
          </div>
          {/* Right: Controls */}
          <div className="header-controls">
            
            <div className="flex items-center space-x-2">
              {connectionStatus === "connected" ? (
                <Wifi className="h-4 w-4 text-success-500" />
              ) : connectionStatus === "connecting" ? (
                <div className="h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <WifiOff className="h-4 w-4 text-danger-500" />
              )}
              <span className="text-xs text-dark-400 capitalize hidden sm:inline">
                {connectionStatus}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-dark-400 hidden md:inline">
                Tài khoản:
              </span>
              <BinanceAccountSelector
                onSelect={(id) => {
                  setSelectedAccount({ id });
                }}
              />
            </div>

            <div className="text-xs text-dark-400 hidden lg:block">
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
      </div>

      {/* ===== WORKSPACE ===== */}
      <div className="trading-workspace">
        {/* Column 1+2: Chart & OrderBook & Position */}
        <div className="workspace-left-columns">
          {/* Row 1: Chart + OrderBook */}
          <div className="workspace-chart-orderbook-row">
            {/* Chart Panel */}
            <div className="chart-panel">
              <div className="h-full flex flex-col">
                {/* Chart Controls */}
                <div className="flex items-center justify-between p-3 border-b border-dark-700">
                  <div className="flex items-center space-x-4">
                    {/* Timeframe Selector */}
                    <div className="flex items-center space-x-2">
                      {pinnedTimeframes.map((interval) => (
                        <button
                          key={interval}
                          onClick={() => handleIntervalChange(interval)}
                          className={`text-xs px-2 py-1 rounded hover:bg-dark-600 ${selectedInterval === interval ? "bg-dark-700" : ""
                            }`}
                        >
                          {interval}
                        </button>
                      ))}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTimeout(() => {
                            setShowTimeframeSelector(true);
                          }, 0);
                        }}
                        className="text-xs px-2 py-1 rounded hover:bg-dark-600 text-dark-400 border border-dark-600"
                        title="Edit timeframes"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Chart Type Panel */}
                    <ChartTypePanel
                      currentType={chartType}
                      onTypeChange={(newType) => {
                        setChartType(newType);
                        console.log("[ChartType] Changed to:", newType);
                      }}
                    />

                    {/* Settings Button */}
                    <div className="flex items-center gap-2 relative" ref={panelRef}>
                      <button
                        ref={settingsButtonRef}
                        onClick={() => setShowSettings((v) => !v)}
                        className="btn-outline p-2 hover:ring-1 ring-primary-500 rounded-md"
                        title="Cài đặt biểu đồ"
                      >
                        <Settings size={15} />
                      </button>

                      {showSettings && (
                        <SettingControl
                          settings={chartSettings}
                          onToggle={(k, v) => {
                            const newSettings = { ...chartSettings, [k]: v };
                            setChartSettings(newSettings);
                            localStorage.setItem("chartSettings", JSON.stringify(newSettings));
                          }}
                          onClose={() => setShowSettings(false)}
                          triggerRef={settingsButtonRef}
                        />
                      )}
                    </div>
                  </div>

                  {/* Right Controls */}
                  <div className="flex items-center space-x-2">
                    <button className="p-1 hover:bg-dark-700 rounded non-essential">
                      <TrendingUp className="h-4 w-4 text-dark-400" />
                    </button>
                    <button className="p-1 hover:bg-dark-700 rounded non-essential">
                      <Maximize2 className="h-4 w-4 text-dark-400" />
                    </button>
                  </div>
                </div>

                {/* Chart Container */}
                <div className="flex-1 relative min-h-0">
                  <section className="h-full w-full bg-dark-800 rounded-xl overflow-hidden">
                    <div className="h-full w-full chart-main-container">
                      <TradingBinance
                        selectedSymbol={selectedSymbol}
                        chartType={chartType}
                        onChartTypeChange={setChartType}
                        selectedInterval={selectedInterval}
                        market={selectedMarket}
                        floating={floatingInfo}
                        showPositionTag={chartSettings.positionTag}
                        onRequestSymbolChange={(sym) => setSelectedSymbol(sym)}
                      />
                    </div>
                  </section>
                </div>
              </div>
            </div>

            {/* OrderBook Panel */}
            <div className="orderbook-panel">
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
                      <div className="overflow-y-auto scrollbar-hide" style={{ minHeight: '200px' }}>
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

                      {/* Current Price */}
                      <div className="px-2 py-1 border-y border-dark-700">
                        <div className="text-center">
                          <div
                            className={`text-sm font-bold ${tickerData && parseFloat(tickerData.priceChange) >= 0
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
                      <div className="overflow-y-auto scrollbar-hide" style={{ minHeight: '200px' }}>
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
          </div>

          {/* Row 2: Position Panel (Full width of Chart + OrderBook) */}
          <div
            className={`positions-panel ${isPositionPanelOpen ? "is-open" : ""}`}
            data-count={positions.length} // ✅ Thêm attribute này
          >
            {/* Tab Header */}
            {showPositionTab && (
              <div
                className="position-panel-header flex items-center justify-between cursor-pointer"

              >
                <div className="flex items-center space-x-3">
                  <span className="font-semibold text-sm">Positions & Orders</span>
                  {positionCount > 0 && (
                    <span className="inline-flex items-center justify-center text-[10px] leading-none px-1.5 py-1 rounded-full bg-primary-500/20 text-primary-300 font-medium">
                      {positionCount}
                    </span>
                  )}
                </div>

                <div className="flex items-center">
                  {isPositionPanelOpen ? (
                    <ChevronDown className="h-4 w-4 text-dark-300" />
                  ) : (
                    <ChevronUp className="h-4 w-4 text-dark-300" />
                  )}
                </div>
              </div>
            )}

            {/* Panel Content */}
            <div
              className={`position-panel-content ${showPositionTab && !isPositionPanelOpen ? "hidden" : ""
                }`}
            >
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

        {/* Column 3: Trading Form (Độc lập) */}
        <div
          className={`trading-form-panel ${isTradingFormOpen ? "is-open" : ""}`}
        >
          {/* Mobile Header */}
          {isMobile && (
            <div
              className="trading-form-mobile-header flex items-center justify-between p-3.5 bg-dark-700/80 backdrop-blur cursor-pointer border-b border-dark-600 hover:bg-dark-700 active:bg-dark-700/95 transition-colors"
              onClick={() => setIsTradingFormOpen(!isTradingFormOpen)}
            >
              <div className="flex items-center space-x-2.5">
                <span className="font-semibold text-sm">Trade {selectedSymbol}</span>
                <span className="text-[10px] text-dark-400 bg-dark-800 px-1.5 py-0.5 rounded uppercase">
                  {selectedMarket}
                </span>
              </div>

              <div className="flex items-center">
                {isTradingFormOpen ? (
                  <ChevronDown className="h-5 w-5 text-dark-300" />
                ) : (
                  <ChevronUp className="h-5 w-5 text-dark-300" />
                )}
              </div>
            </div>
          )}

          {/* Trading Form Content */}
          <div
            className={`trading-form-content flex-1 min-h-0 overflow-y-auto ${isMobile && !isTradingFormOpen ? "hidden" : ""
              }`}
          >
            <TradingForm
              selectedSymbol={selectedSymbol}
              price={livePrice}
              internalBalance={availableBalance}
              selectedMarket={selectedMarket}
            />
          </div>
        </div>
      </div>

      {/* Timeframe Modal */}
      <TimeframeModalWrapper
        isOpen={showTimeframeSelector}
        pinnedTimeframes={pinnedTimeframes}
        onClose={handleCloseTimeframe}
        onSave={handleSaveTimeframes}
      />
 <MaintenanceModal 
      isOpen={showMaintenanceModal}
      onRefresh={handleRefreshConnection}
    />

    {/* Error Popup */}
    {errorPopup.show && (
      <ErrorPopup
        message={errorPopup.message}
        onClose={() => setErrorPopup({ show: false, message: '' })}
      />
    )}
      
    </div>
  );
}