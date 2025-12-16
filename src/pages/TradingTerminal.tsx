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
  Database,
  Menu,
} from "lucide-react";
import TradingBinance from "../components/common/TradingBinance";
import MaintenanceModal from "../components/common/popuptradingterminal/MaintenanceModal";
import TickerCarousel from "./carouseldecor/TickerCarousel";
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
import SyncDataButton from "./layout panel/SyncDataButton";
// ✅ Direct Binance WebSocket  (không qua server proxy)
import { 
  useBinanceOrderbook,
  useBinanceTicker,
  useBinanceTrades,
  useBinanceAllMiniTickers,
} from "../components/binancewebsocket";
import OrderBookPanel from "./layout panel/OrderBookPanel";
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

// ✅ CustomWebSocketService đã được thay thế bởi Direct Binance hooks

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
    useState<ConnectionStatus>("connected"); // ✅ Direct Binance = always connected
  // const [wsService] = useState(() => new CustomWebSocketService()); // ❌ REMOVED - dùng direct hooks
  const miniTickerMap = useMiniTickerStore((state) => state.miniTickerMap);
  const selectedPrice = miniTickerMap[selectedSymbol]?.lastPrice || 0;
  const [chartType, setChartType] = useState<ChartType>("Candles");
const currentSymbolRef = useRef(selectedSymbol);
useEffect(() => {
  currentSymbolRef.current = selectedSymbol;
}, [selectedSymbol]);
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

// ========== DIRECT BINANCE STREAMS (không qua server proxy) ==========
// ✅ Orderbook
const orderbookData = useBinanceOrderbook(selectedSymbol, selectedMarket);

// ✅ Ticker (24hr stats) - thay thế wsService.subscribeTicker
const tickerData = useBinanceTicker(selectedSymbol, selectedMarket);

// ✅ Trades - thay thế wsService.subscribeTrade
const recentTrades = useBinanceTrades(selectedSymbol, selectedMarket, 50);

// ✅ All MiniTickers (cho danh sách symbols) - thay thế subscribeMiniTicker cho từng symbol
const allMiniTickers = useBinanceAllMiniTickers(selectedMarket);

// ✅ Lấy livePrice từ orderbook direct (thay bookTicker)
useEffect(() => {
  if (orderbookData.bids.length > 0 && orderbookData.asks.length > 0) {
    const bestBid = orderbookData.bids[0].price;
    const bestAsk = orderbookData.asks[0].price;
    const mid = (bestBid + bestAsk) / 2;
    if (mid > 0) setLivePrice(mid);
  }
}, [orderbookData.bids, orderbookData.asks]);

// ✅ Convert sang format compatible với PositionFunction
const orderBook = orderbookData.bids.length > 0 && orderbookData.asks.length > 0 ? {
  symbol: selectedSymbol,
  lastUpdateId: orderbookData.lastUpdateId || 0,
  bids: orderbookData.bids.map(b => ({
    price: b.price.toString(),
    quantity: b.quantity.toString()
  })),
  asks: orderbookData.asks.map(a => ({
    price: a.price.toString(),
    quantity: a.quantity.toString()
  }))
} : null;
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
  
  // ✅ THÊM: Delay bắt error cho đến khi connection ổn định
  let isReady = false;
  const readyTimer = setTimeout(() => {
    isReady = true;
    console.log('✅ Error listener ready');
  }, 3000); // 3 giây sau khi mount mới bắt đầu listen errors
  
  // ✅ Danh sách errors KHÔNG hiện popup
  const ignoredErrors = [
    'futuresMultiAssetsMargin is not a function',
    'getMultiAssetsMode',
    'getPositionMode',
    'Internal server error',
    'Cannot read properties of undefined',
  ];
  
  console.log = function(...args) {
    const msg = args.join(' ');
    
    // Bắt RAW WS MSG từ BinanceWebSocketService
    if (msg.includes('📥 RAW WS MSG:') && msg.includes('"type":"error"')) {
      try {
        // ✅ THÊM: Chưa ready thì không hiện popup
        if (!isReady) {
          console.warn('⏳ Ignoring early error (connection not ready yet)');
          originalLog.apply(console, args);
          return;
        }
        
        // Tìm JSON object trong message
        const jsonMatch = msg.match(/(\{[^}]*"type"\s*:\s*"error"[^}]*\})/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          if (data.type === 'error' && data.message) {
            
            // Check nếu là error cần ignore
            const shouldIgnore = ignoredErrors.some(err => 
              data.message?.includes(err) || 
              data.action?.includes(err)
            );
            
            if (shouldIgnore) {
              console.warn('⚠️ Ignoring non-critical error:', data.action || data.message);
              originalLog.apply(console, args);
              return;
            }
            
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
    clearTimeout(readyTimer);
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
  
  // ✅ Direct Binance hooks auto-reconnect, just reload page
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
  // ✅ tickerData, recentTrades - giờ lấy từ hooks (xem phần DIRECT BINANCE STREAMS)
  // ✅ bookTicker - không cần nữa (dùng orderbookData)
  // ✅ miniTicker - giờ dùng allMiniTickers



  // UI


  // const [subscriptions, setSubscriptions] = useState<Subscription[]>([]); // ❌ REMOVED

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
  
  // ✅ FIX: Delay để chờ selectAccount xong
  const timer = setTimeout(() => {
    if (selectedMarket === "futures") {
      binanceWS.getFuturesAccount(selectedAccount.id);
    } else {
      binanceWS.getSpotAccount(selectedAccount.id);
    }
  }, 600);  // Chờ 600ms
  
  return () => clearTimeout(timer);
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

  // ✅ REMOVED: Khởi tạo WS phụ - không cần nữa vì đã dùng Direct Binance hooks
  // tickerData, recentTrades đã được lấy từ hooks ở trên

  // ✅ Cập nhật allSymbols từ allMiniTickers (direct Binance)
  useEffect(() => {
    if (allMiniTickers.size === 0) return;
    
    const symbolsArray: SymbolItem[] = [];
    
    allMiniTickers.forEach((data, sym) => {
      // Bỏ qua symbol đang chọn
      if (sym === selectedSymbol) return;
      // Chỉ lấy symbols trong danh sách
      if (!symbolList.includes(sym)) return;
      
      const close = parseFloat(data.close);
      const open = parseFloat(data.open);
      const percentChange = open !== 0 ? ((close - open) / open) * 100 : 0;
      
      symbolsArray.push({
        symbol: sym,
        price: close,
        percentChange,
        volume: parseFloat(data.volume),
      });
    });
    
    if (symbolsArray.length > 0) {
      setAllSymbols(symbolsArray);
    }
  }, [allMiniTickers, selectedSymbol]);


 // ✅ Subscribe realtime theo account đã chọn (thêm ref-guard chống duplicate)
const subOnceRef = useRef<number | null>(null);
useEffect(() => {
  const id = selectedAccount?.id;
  if (!id) return;

  const now = Date.now();
  if (subOnceRef.current && now - subOnceRef.current < 1500) return;
  subOnceRef.current = now;

  // ✅ FIX: Dùng async và chờ selectAccount xong
  const init = async () => {
    // 1) Chọn account và chờ server xử lý xong
    await binanceWS.selectAccountAndWait(id, 500);

    // 2) Sau khi select xong mới gọi các API khác
    binanceWS.getPositions(id);
    binanceWS.getOpenOrders(selectedMarket, undefined, (orders) => {
      console.log('📥 Initial getOpenOrders:', orders);
      localStorage.setItem(OPEN_ORDERS_LS_KEY, JSON.stringify(orders));
      window.dispatchEvent(new CustomEvent(OPEN_ORDERS_EVENT, { detail: { list: orders } }));
    });
  };

  init();

  // 3) Set position update handler
  binanceWS.setPositionUpdateHandler((rawPositions: any[]) => {
    const active = (rawPositions || []).filter(
      (p: any) => parseFloat(p.positionAmt) !== 0
    );
    setPositions(active);
    localStorage.setItem("positions", JSON.stringify(active));
  });
}, [selectedAccount?.id, selectedMarket]);

  // Khôi phục account đã chọn từ localStorage khi vào trang (chỉ 1 lần)
useEffect(() => {
  const savedId = localStorage.getItem("selectedBinanceAccountId");
  const parsedId = savedId ? parseInt(savedId, 10) : null;
  if (!parsedId) return;

  const restore = async () => {
    binanceWS.setCurrentAccountId(parsedId);
    await binanceWS.selectAccountAndWait(parsedId, 500);  // ✅ Chờ 500ms
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
                  className="flex items-center gap-fluid-2 hover:bg-dark-700 px-fluid-3 py-2 rounded transition-colors cursor-default"
                  onMouseEnter={handleSymbolButtonEnter}
                  onMouseLeave={handleSymbolButtonLeave}
                >
                  <div className="h-6 w-6 rounded-full bg-warning-300 flex items-center justify-center">
                    <span className="text-fluid-sm font-bold text-dark-900">
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
            <div className="flex items-center gap-fluid-2">
              <span className="text-fluid-sm text-dark-400">Market:</span>
              <select
                value={selectedMarket}
                onChange={(e) =>
                  handleMarketChange(e.target.value as "spot" | "futures")
                }
                className="bg-dark-700 border border-dark-600 rounded px-2 py-fluid-1 text-fluid-sm focus:border-primary-500 focus:outline-none"
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
                  <span className="text-fluid-sm text-dark-400">
                    ≈ ${parseFloat(tickerData.lastPrice).toFixed(2)}
                  </span>
                </div>

                <div className="flex flex-col">
                  <span
                    className={`text-fluid-sm font-medium ${parseFloat(tickerData.priceChange) >= 0
                      ? "text-success-500"
                      : "text-danger-500"
                      }`}
                  >
                    {parseFloat(tickerData.priceChange) >= 0 ? "+" : ""}
                    {parseFloat(tickerData.priceChange).toFixed(4)}
                  </span>
                  <span
                    className={`text-fluid-sm ${parseFloat(tickerData.priceChangePercent) >= 0
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
          <div className="stats-row-24h text-fluid-sm">
            {tickerData ? (
              <>
                <div className="flex flex-col ">
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
                <div className="flex flex-col gap-fluid-1">
                  <span className="text-dark-400">24h High</span>
                  <div className="h-4 w-20 bg-dark-700 animate-pulse rounded" />
                </div>
                <div className="flex flex-col gap-fluid-1">
                  <span className="text-dark-400">24h Low</span>
                  <div className="h-4 w-20 bg-dark-700 animate-pulse rounded" />
                </div>
                <div className="flex flex-col gap-fluid-1">
                  <span className="text-dark-400">24h Volume (BTC)</span>
                  <div className="h-4 w-24 bg-dark-700 animate-pulse rounded" />
                </div>
                <div className="flex flex-col gap-fluid-1">
                  <span className="text-dark-400">24h Volume (USDT)</span>
                  <div className="h-4 w-24 bg-dark-700 animate-pulse rounded" />
                </div>
              </>
            )}
          </div>
          {/* Right: Controls */}
          <div className="header-controls ">
            
            <div className="flex items-center gap-fluid-2 ">
              {connectionStatus === "connected" ? (
                <Wifi className="h-4 w-4 text-success-500" />
              ) : connectionStatus === "connecting" ? (
                <div className="h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <WifiOff className="h-4 w-4 text-danger-500" />
              )}
              <span className="text-fluid-sm text-dark-400 capitalize hidden sm:inline">
                {connectionStatus}
              </span>
            </div>

            <div className="flex items-center gap-fluid-2 ">
              <span className="text-fluid-base text-dark-400 hidden md:inline">
                Tài khoản:
              </span>
              <BinanceAccountSelector 
                onSelect={(id) => {
                  setSelectedAccount({ id });
                }}
              />
            </div>

            <div className="text-fluid-sm text-dark-400 hidden lg:block">
              Direct Binance ✓
            </div>

            <button
              onClick={() => window.location.reload()}
              className="p-1 hover:bg-dark-700 rounded"
              title="Refresh"
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
                <div className="flex items-center justify-between p-fluid-3 border-b border-dark-700">
                  <div className="flex items-center space-x-4">
                    {/* Timeframe Selector */}
                    <div className="flex items-center gap-fluid-2">
                      {pinnedTimeframes.map((interval) => (
                        <button
                          key={interval}
                          onClick={() => handleIntervalChange(interval)}
                          className={`text-fluid-sm px-2 py-fluid-1 rounded hover:bg-dark-600 ${selectedInterval === interval ? "bg-dark-700" : ""
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
                        className="text-fluid-sm px-2 py-fluid-1 rounded hover:bg-dark-600 text-dark-400 border border-dark-600"
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
                    <div className="flex items-center gap-fluid-2 relative" ref={panelRef}>
                      <button
                        ref={settingsButtonRef}
                        onClick={() => setShowSettings((v) => !v)}
                        className="btn-outline p-fluid-2 hover:ring-1 ring-primary-500 rounded-fluid-md"
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
                     {/* Sync Data Button */}
<SyncDataButton />
                  </div>

                  {/* Right Controls */}
                  <div className="flex items-center gap-fluid-2">
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

            {/* OrderBook Panel with Top Coins */}
<div className="orderbook-panel">
  <OrderBookPanel
    orderbookData={orderbookData}
    tickerData={tickerData}
    onClickPrice={handleClickOrderBookPrice}
    onSymbolClick={setSelectedSymbol}
    market={selectedMarket}
  />
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
                  <span className="font-semibold text-fluid-sm">Positions & Orders</span>
                  {positionCount > 0 && (
                    <span className="inline-flex items-center justify-center text-fluid-2xs leading-none px-1.5 py-fluid-1 rounded-full bg-primary-500/20 text-primary-300 font-medium">
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
              className="trading-form-mobile-header flex items-center justify-between p-fluid-3.5 bg-dark-700/80 backdrop-blur cursor-pointer border-b border-dark-600 hover:bg-dark-700 active:bg-dark-700/95 transition-colors"
              onClick={() => setIsTradingFormOpen(!isTradingFormOpen)}
            >
              <div className="flex items-center gap-fluid-2.5">
                <span className="font-semibold text-fluid-sm">Trade {selectedSymbol}</span>
                <span className="text-fluid-2xs text-dark-400 bg-dark-800 px-1.5 py-0.5 rounded uppercase">
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