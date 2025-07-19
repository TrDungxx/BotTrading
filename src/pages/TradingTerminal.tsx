import React, { useState, useEffect, useRef } from 'react';
import { ArrowDown, ArrowUp, Calendar, ChevronDown, Clock, DollarSign, BarChart, RefreshCw, Share2, Star, Settings, Maximize2, TrendingUp, Volume2, Activity, Wifi, WifiOff, X } from 'lucide-react';
import { FormattedMessage, FormattedNumber } from 'react-intl';
import TradingViewChart from '../TradingViewChart';
import { CandlestickData } from 'lightweight-charts';
import { fetchHistoricalKlines } from '../utils/fetchKline';
import { ExtendedCandle } from '../utils/types';
import SymbolDropdown from '../components/common/SymbolDropdown';
import symbolList from '../utils/symbolList';
// WebSocket connection status
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// Market types
type MarketType = 'spot' | 'futures' | 'delivery';

// Market data interfaces
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

// Account interfaces (for authenticated streams)
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
// Custom WebSocket service for your server
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
      this.onStatusChange('connecting');

      this.ws = new WebSocket('ws://45.77.33.141/w-binance-socket/signalr/connect');

      this.ws.onopen = () => {
  console.log('✅ WebSocket connected');
  this.onStatusChange('connected');
  this.isConnected = true;

  // 🟢 Gửi lại toàn bộ message đã queue trước đó
  this.messageQueue.forEach((msg) => {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      console.log('📤 Flushed queued message:', msg);
    }
  });

  this.messageQueue = [];

  // Tiếp tục các đăng ký mặc định nếu có
  const subs = [
    { action: 'subscribePublicTicker', symbol: 'BTCUSDT' },
    { action: 'subscribePublicKline', symbol: 'BTCUSDT', interval: '1m' },
    { action: 'subscribePublicTrade', symbol: 'BTCUSDT' }
  ];

  subs.forEach((msg) => this.sendMessage(msg));
};


      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📥 Incoming:', data);
          this.handleMessage(data); // ✅ xử lý tại đây luôn
        } catch (error) {
          console.error('❌ Error parsing message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.onStatusChange('error');
        this.isConnected = false;
      };

      this.ws.onclose = () => {
        console.warn('🔌 WebSocket closed. Reconnecting...');
        this.onStatusChange('disconnected');
        this.isConnected = false;
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('❌ Failed to connect WebSocket:', error);
      this.onStatusChange('error');
    }
  }

  private handleMessage(data: any) {
    console.log('📨 Received message:', data);

    if (data.action) {
      switch (data.action) {
        case 'klineUpdate':
          this.handleKlineData(data);
          break;
        case 'tickerUpdate':
          this.handleTickerData(data);
          break;
        case 'depthUpdate':
          this.handleDepthData(data);
          break;
        case 'tradeUpdate':
          this.handleTradeData(data);
          break;
        case 'bookTickerUpdate':
          this.handleBookTickerData(data);
          break;
        case 'miniTickerUpdate':
          this.handleMiniTickerData(data);
          break;
        case 'accountUpdate':
          this.handleAccountData(data);
          break;
        case 'orderUpdate':
          this.handleOrderData(data);
          break;
        case 'subscriptionList':
          this.handleSubscriptionList(data);
          break;
        default:
          console.warn('⚠️ Unknown WebSocket action:', data.action);
      }
    } else if (data.type) {
      switch (data.type) {
        case 'kline':
          this.handleKlineData(data);
          break;
        case 'ticker':
          this.handleTickerData(data);
          break;
        case 'depth':
          this.handleDepthData(data);
          break;
        case 'trade':
          this.handleTradeData(data);
          break;
        case 'bookTicker':
          this.handleBookTickerData(data);
          break;
        case 'miniTicker':
          this.handleMiniTickerData(data);
          break;
        case 'account':
          this.handleAccountData(data);
          break;
        case 'order':
          this.handleOrderData(data);
          break;
        case 'connection_status':
          // Bạn có thể log nhẹ nếu muốn theo dõi trạng thái từng stream
          console.log(`ℹ️ WS connected to ${data.stream} (${data.status})`);
          break;
        case 'welcome':
          // Đây là message chào, không cần xử lý gì cả
          break;
        default:
          // Không còn log cảnh báo nữa
          break;
      }
    }
  }



  private handleKlineData(data: any) {
    console.log('📊 [WS] Kline raw message:', data);

    const callback = this.callbacks.get('kline');
    if (!callback) return;

    const kline = data.data;
    console.log('⏱ Kline waiting... open:', kline?.open);
    if (
      kline &&
      kline.open !== undefined &&
      kline.high !== undefined &&
      kline.low !== undefined &&
      kline.close !== undefined &&
      kline.volume !== undefined
    ) {
      // ✅ Nếu là dạng đầy đủ
      callback({
        symbol: kline.symbol || '',
        interval: kline.interval || '',
        openTime: kline.openTime,
        closeTime: kline.closeTime,
        open: kline.open,
        high: kline.high,
        low: kline.low,
        close: kline.close,
        volume: kline.volume,
        trades: kline.trades || 0,
        baseAssetVolume: kline.baseAssetVolume || '',
        quoteAssetVolume: kline.quoteAssetVolume || ''
      });
    } else {
      console.warn('⚠️ Invalid kline data received:', kline);
    }
  }




  private handleTickerData(data: any) {
    const callback = this.callbacks.get('ticker');
    if (callback && data.data) {
      callback(data.data);
    }
  }

  private handleDepthData(data: any) {
    const callback = this.callbacks.get('depth');
    if (callback && data.data) {
      callback(data.data);
    }
  }

  private handleTradeData(data: any) {
    const callback = this.callbacks.get('trade');
    if (callback && data.data) {
      callback(data.data);
    }
  }

  private handleBookTickerData(data: any) {
    const callback = this.callbacks.get('bookTicker');
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
    const callback = this.callbacks.get('account');
    if (callback && data.data) {
      callback(data.data);
    }
  }

  private handleOrderData(data: any) {
    const callback = this.callbacks.get('orders');
    if (callback && data.data) {
      callback(data.data);
    }
  }

  private handleSubscriptionList(data: any) {
    console.log('📋 Active subscriptions:', data.subscriptions);
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;

      console.log(`🔄 Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('❌ Max reconnection attempts reached');
      this.onStatusChange('error');
    }
  }

  private resubscribeAll() {
    // Resubscribe to all active subscriptions after reconnection
    this.subscriptions.forEach((subscription) => {
      this.sendMessage(subscription);
    });
  }

  private sendMessage(message: any) {
  if (this.ws && this.ws.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify(message));
    console.log('📤 Sent message:', message);
  } else {
    console.warn('⚠️ WebSocket not ready, message queued:', message);
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
  public subscribeKline(symbol: string, interval: string, market: MarketType = 'spot', callback?: (data: any) => void) {
    const subscriptionId = `kline_${symbol}_${interval}_${market}`;
    const message = {
      action: 'subscribeKline',  // ⚠️ Không phải subscribePublicKline
      market,                    // ⚠️ Phải có market
      symbol,
      interval
    };

    if (callback) {
      this.callbacks.set('kline', callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: 'subscribeKline',
      symbol,
      market,
      interval,
      timestamp: Date.now()
    });

    this.sendMessage(message);
    return subscriptionId;
  }


  public subscribeTicker(symbol: string, market: MarketType = 'spot', callback?: (data: any) => void) {
    const subscriptionId = `ticker_${symbol}_${market}`;
    const message = {
      action: 'subscribeTicker',
      market,
      symbol
    };

    if (callback) {
      this.callbacks.set('ticker', callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: 'subscribeTicker',
      symbol,
      market,
      timestamp: Date.now()
    });

    this.sendMessage(message);
    return subscriptionId;
  }

  public subscribeDepth(symbol: string, levels: string = '20', speed: string = '1000ms', market: MarketType = 'spot', callback?: (data: any) => void) {
    const subscriptionId = `depth_${symbol}_${levels}_${speed}_${market}`;
    const message = {
      action: 'subscribePublicDepth',
      symbol,
      levels,
      speed
    };

    if (callback) {
      this.callbacks.set('depth', callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: 'subscribePublicDepth',
      symbol,
      market,
      levels,
      speed,
      timestamp: Date.now()
    });

    this.sendMessage(message);
    return subscriptionId;
  }

  public subscribeTrade(symbol: string, market: MarketType = 'spot', callback?: (data: any) => void) {
    const subscriptionId = `trade_${symbol}_${market}`;
    const message = {
      action: 'subscribePublicTrade',
      symbol
    };

    if (callback) {
      this.callbacks.set('trade', callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: 'subscribePublicTrade',
      symbol,
      market,
      timestamp: Date.now()
    });

    this.sendMessage(message);
    return subscriptionId;
  }

  public subscribeBookTicker(symbol: string, market: MarketType = 'spot', callback?: (data: any) => void) {
    const subscriptionId = `bookTicker_${symbol}_${market}`;
    const message = {
      action: 'subscribePublicBookTicker',
      symbol
    };

    if (callback) {
      this.callbacks.set('bookTicker', callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: 'subscribePublicBookTicker',
      symbol,
      market,
      timestamp: Date.now()
    });

    this.sendMessage(message);
    return subscriptionId;
  }

  public subscribeMiniTicker(symbol: string, market: MarketType = 'spot', callback?: (data: any) => void) {
    const subscriptionId = `miniTicker_${symbol}_${market}`;
    const message = {
      action: 'subscribePublicMiniTicker',
      symbol
    };

    if (callback) {
      this.callbacks.set(`miniTicker_${symbol}`, callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: 'subscribePublicMiniTicker',
      symbol,
      market,
      timestamp: Date.now()
    });

    this.sendMessage(message);
    return subscriptionId;
  }

  // FUTURES-specific streams
  public subscribeMarkPrice(symbol: string, market: MarketType = 'futures', callback?: (data: any) => void) {
    const subscriptionId = `markPrice_${symbol}_${market}`;
    const message = {
      action: 'subscribeMarkPrice',
      market,
      symbol
    };

    if (callback) {
      this.callbacks.set('markPrice', callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: 'subscribeMarkPrice',
      symbol,
      market,
      timestamp: Date.now()
    });

    this.sendMessage(message);
    return subscriptionId;
  }

  public subscribeFundingRate(symbol: string, market: MarketType = 'futures', callback?: (data: any) => void) {
    const subscriptionId = `fundingRate_${symbol}_${market}`;
    const message = {
      action: 'subscribeFundingRate',
      market,
      symbol
    };

    if (callback) {
      this.callbacks.set('fundingRate', callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: 'subscribeFundingRate',
      symbol,
      market,
      timestamp: Date.now()
    });

    this.sendMessage(message);
    return subscriptionId;
  }

  // PRIVATE STREAMS (require authentication)
  public subscribeAccount(callback?: (data: any) => void) {
    if (!this.isAuthenticated || !this.authToken || !this.binanceAccountId) {
      console.error('❌ Authentication required for private streams');
      return null;
    }

    const subscriptionId = `account_${this.binanceAccountId}`;
    const message = {
      action: 'subscribePrivateAccount',
      token: this.authToken,
      binanceAccountId: this.binanceAccountId
    };

    if (callback) {
      this.callbacks.set('account', callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: 'subscribePrivateAccount',
      timestamp: Date.now()
    });

    this.sendMessage(message);
    return subscriptionId;
  }

  public subscribeOrders(callback?: (data: any) => void) {
    if (!this.isAuthenticated || !this.authToken || !this.binanceAccountId) {
      console.error('❌ Authentication required for private streams');
      return null;
    }

    const subscriptionId = `orders_${this.binanceAccountId}`;
    const message = {
      action: 'subscribePrivateOrders',
      token: this.authToken,
      binanceAccountId: this.binanceAccountId
    };

    if (callback) {
      this.callbacks.set('orders', callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: 'subscribePrivateOrders',
      timestamp: Date.now()
    });

    this.sendMessage(message);
    return subscriptionId;
  }

  public subscribeTrades(callback?: (data: any) => void) {
    if (!this.isAuthenticated || !this.authToken || !this.binanceAccountId) {
      console.error('❌ Authentication required for private streams');
      return null;
    }

    const subscriptionId = `trades_${this.binanceAccountId}`;
    const message = {
      action: 'subscribePrivateTrades',
      token: this.authToken,
      binanceAccountId: this.binanceAccountId
    };

    if (callback) {
      this.callbacks.set('trades', callback);
    }

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      action: 'subscribePrivateTrades',
      timestamp: Date.now()
    });

    this.sendMessage(message);
    return subscriptionId;
  }

  // CONTROL COMMANDS
  public getSubscriptions() {
    const message = {
      action: 'getSubscriptions'
    };
    this.sendMessage(message);
    return Array.from(this.subscriptions.values());
  }

  public unsubscribe(connectionId?: string) {
    const message = {
      action: 'unsubscribe',
      ...(connectionId && { connectionId })
    };

    if (connectionId) {
      // Remove specific subscription
      this.subscriptions.delete(connectionId);
      this.callbacks.delete(connectionId);
    } else {
      // Remove all subscriptions
      this.subscriptions.clear();
      this.callbacks.clear();
    }

    this.sendMessage(message);
    console.log(`🔕 Unsubscribed: ${connectionId || 'all streams'}`);
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
    this.callbacks.clear();
    this.onStatusChange('disconnected');
    console.log('🔌 WebSocket disconnected');
  }
}

export default function TradingTerminal() {

  const [candles, setCandles] = useState<ExtendedCandle[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [allSymbols, setAllSymbols] = useState<SymbolItem[]>([]);
  const miniTickerCallbacks = useRef<Map<string, (data: MiniTickerData) => void>>(new Map());



  // State management
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [selectedMarket, setSelectedMarket] = useState<MarketType>('futures');

  const [selectedInterval, setSelectedInterval] = useState('1m');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [wsService] = useState(() => new CustomWebSocketService());

  // Market data states
  const [klineData, setKlineData] = useState<KlineData | null>(null);
  const [tickerData, setTickerData] = useState<TickerData | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [recentTrades, setRecentTrades] = useState<TradeData[]>([]);
  const [bookTicker, setBookTicker] = useState<BookTickerData | null>(null);
  const [miniTicker, setMiniTicker] = useState<MiniTickerData | null>(null);

  // Account data states (for authenticated users)
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [orderUpdates, setOrderUpdates] = useState<OrderUpdate[]>([]);

  // UI states
  const [activeOrderTab, setActiveOrderTab] = useState<'limit' | 'market' | 'stop'>('limit');
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  // Trading form states
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [total, setTotal] = useState('');

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
          console.log('📈 Historical candles loaded:', historicalData.length);
        }
      } catch (error) {
        console.error('❌ Failed to fetch historical klines:', error);
      }
    };

    loadHistoricalKlines();

    return () => {
      isMounted = false;
    };
  }, [selectedSymbol, selectedInterval]);
  // Initialize WebSocket connections
  useEffect(() => {
    wsService.setStatusCallback(setConnectionStatus);

    // Subscribe to public streams
    const subscriptionIds: string[] = [];

    // 1. Kline/Candlestick Stream
    const klineId = wsService.subscribeKline(selectedSymbol, selectedInterval, selectedMarket, (data) => {
      if (data.symbol !== selectedSymbol) return;
      console.log('📊 Kline data:', data);
      setKlineData(data);
    });
    if (klineId) subscriptionIds.push(klineId);

    // 2. 24hr Ticker Statistics
    const tickerId = wsService.subscribeTicker(selectedSymbol, selectedMarket, (data) => {
      if (data.symbol !== selectedSymbol) return;
      console.log('📈 Ticker data:', data);
      setTickerData(data);
    });
    if (tickerId) subscriptionIds.push(tickerId);

    // 3. Order Book Depth
    const depthId = wsService.subscribeDepth(selectedSymbol, '20', '1000ms', selectedMarket, (data) => {
      console.log('📖 Depth data:', data);
      setOrderBook(data);
    });
    if (depthId) subscriptionIds.push(depthId);

    // 4. Trade Stream
    const tradeId = wsService.subscribeTrade(selectedSymbol, selectedMarket, (data) => {
      if (data.symbol !== selectedSymbol) return;

      const trade: TradeData = {
        symbol: data.symbol,
        tradeId: data.tradeId,
        price: data.price?.toString() ?? '0',
        qty: data.quantity?.toString() ?? '0',
        time: data.tradeTime ?? Date.now(),
        isBuyerMaker: data.isBuyerMaker
      };

      setRecentTrades((prev) => {
        const newTrades = [trade, ...prev.slice(0, 49)];
        return newTrades.sort((a, b) => b.time - a.time);
      });
    });

    if (tradeId) subscriptionIds.push(tradeId);

    // 5. Book Ticker (Best Bid/Ask)
    const bookTickerId = wsService.subscribeBookTicker(selectedSymbol, selectedMarket, (data) => {
      console.log('📋 Book ticker data:', data);
      setBookTicker(data);
    });
    if (bookTickerId) subscriptionIds.push(bookTickerId);

    // 6. Mini Ticker
    const miniTickerId = (wsService.subscribeMiniTicker as unknown as (
      symbol: string,
      market: string,
      callback: (data: MiniTickerData) => void
    ) => string)(
      selectedSymbol,
      selectedMarket,
      (data: MiniTickerData) => {
        setAllSymbols((prev) => {
          if (!symbolList.includes(data.symbol)) return prev; // 👉 chỉ giữ symbol trong danh sách cho phép

          const updated = prev.filter((s) => s.symbol !== data.symbol);
          return [
            ...updated,
            {
              symbol: data.symbol,
              price: parseFloat(data.close),
              percentChange: parseFloat(data.percentChange),
              volume: parseFloat(data.volume),
            },
          ];
        });
      }
    );
    if (miniTickerId) subscriptionIds.push(miniTickerId);

    // Update subscriptions list
    setSubscriptions(wsService.getSubscriptions());

    return () => {
      // Cleanup subscriptions when component unmounts or symbol changes
      subscriptionIds.forEach(id => {
        wsService.unsubscribe(id);
      });
    };
  }, [selectedSymbol, selectedMarket, selectedInterval]);

  const handleUnsubscribe = (subscriptionId: string) => {
    wsService.unsubscribe(subscriptionId);
    setSubscriptions(wsService.getSubscriptions());
  };

  const handleSymbolChange = (newSymbol: string) => {
    setSelectedSymbol(newSymbol);
  };

  const handleMarketChange = (newMarket: MarketType) => {
    setSelectedMarket(newMarket);
  };

  const handleIntervalChange = (newInterval: string) => {
    setSelectedInterval(newInterval);
  };

  const calculateTotal = (price: string, amount: string) => {
    if (price && amount) {
      const calculatedTotal = parseFloat(price) * parseFloat(amount);
      return calculatedTotal.toFixed(8);
    }
    return '';
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAmount = e.target.value;
    setAmount(newAmount);
    setTotal(calculateTotal(price, newAmount));
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPrice = e.target.value;
    setPrice(newPrice);
    setTotal(calculateTotal(newPrice, amount));
  };

  const handleTotalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTotal = e.target.value;
    setTotal(newTotal);

    if (newTotal && price && parseFloat(price) !== 0) {
      const calculatedAmount = (parseFloat(newTotal) / parseFloat(price)).toFixed(8);
      setAmount(calculatedAmount);
    } else {
      setAmount('');
    }
  };

  useEffect(() => {
    const klineId = wsService.subscribeKline(
      selectedSymbol,
      selectedInterval,
      selectedMarket,
      (data) => {
        if (data.symbol !== selectedSymbol) return; // ✅ đảm bảo đúng symbol

        console.log('✅ Realtime Kline:', data);

        const newCandle: CandlestickData = {
          time: Math.floor(data.openTime / 1000), // UNIX seconds
          open: parseFloat(data.open),
          high: parseFloat(data.high),
          low: parseFloat(data.low),
          close: parseFloat(data.close),
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


  useEffect(() => {
  const ids: string[] = [];
  const callbackMap = new Map<string, (data: MiniTickerData) => void>();

  // 👉 lấy market 1 lần duy nhất khi mount (không dùng dependency)
  const market: MarketType = 'futures'; // hoặc selectedMarket nếu chắc chắn đã có

  symbolList.forEach((sym) => {
    const callback = (data: MiniTickerData) => {
      const symbol = data.symbol?.toUpperCase?.();
      if (symbol !== sym) return;

      const close = parseFloat(data.close);
      const open = parseFloat(data.open);
      const percentChange = open !== 0 ? ((close - open) / open) * 100 : 0;

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

    callbackMap.set(sym, callback);
    const id = wsService.subscribeMiniTicker(sym, market, callback); // ✅ dùng 'futures' cố định
    ids.push(id);
  });

  return () => {
    ids.forEach((id) => wsService.unsubscribe(id));
    callbackMap.clear();
  };
}, []); // ✅ KHÔNG dùng [selectedMarket]




  const sortedSymbols: SymbolItem[] = symbolList.map((symbol) => {
    const matched = allSymbols.find((s) => s.symbol === symbol);
    return matched ?? {
      symbol,
      price: 0,
      percentChange: 0,
      volume: 0,
    };
  });

  console.log('✅ allSymbols:', allSymbols.length, allSymbols);
  return (
    <div className="h-[calc(100vh-6rem)] bg-dark-900">
      {/* Top Bar - Symbol selector and stats */}
      <div className="border-b border-dark-700 bg-dark-800">
        <div className="flex items-center justify-between px-4 py-2">
          {/* Left: Symbol and basic info */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center">
              <div className="relative z-50">
                {/* Trigger Button */}
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

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-[350px] max-h-[500px] bg-dark-800 rounded shadow-lg overflow-y-auto z-[999] border border-dark-700">
                    <SymbolDropdown
                      symbols={sortedSymbols}
                      onSelect={(s) => {
                        setSelectedSymbol(s);
                        setIsDropdownOpen(false);
                      }}
                      selectedSymbol={selectedSymbol}
                    />
                  </div>
                )}
              </div>

              <Star className="h-4 w-4 text-dark-400 hover:text-warning-300 ml-2 cursor-pointer" />
            </div>

            {/* Market selector */}
            <div className="flex items-center space-x-2">
              <span className="text-xs text-dark-400">Market:</span>
              <select
                value={selectedMarket}
                onChange={(e) => handleMarketChange(e.target.value as MarketType)}
                className="bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs focus:border-primary-500 focus:outline-none"
              >
                <option value="futures">FUTURES</option>
                <option value="spot">SPOT</option>

                <option value="delivery">DELIVERY</option>
              </select>
            </div>

            {/* Price display - will show when data is available */}
            {tickerData && (
              <>
                <div className="flex flex-col">
                  <span className="text-lg font-bold">
                    {parseFloat(tickerData.lastPrice).toFixed(4)}
                  </span>
                  <span className="text-xs text-dark-400">≈ ${parseFloat(tickerData.lastPrice).toFixed(2)}</span>
                </div>

                <div className="flex flex-col">
                  <span className={`text-sm font-medium ${parseFloat(tickerData.priceChange) >= 0 ? 'text-success-500' : 'text-danger-500'
                    }`}>
                    {parseFloat(tickerData.priceChange) >= 0 ? '+' : ''}{parseFloat(tickerData.priceChange).toFixed(4)}
                  </span>
                  <span className={`text-xs ${parseFloat(tickerData.priceChangePercent) >= 0 ? 'text-success-500' : 'text-danger-500'
                    }`}>
                    {parseFloat(tickerData.priceChangePercent) >= 0 ? '+' : ''}{tickerData.priceChangePercent}%
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Right: Connection status and controls */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {connectionStatus === 'connected' ? (
                <Wifi className="h-4 w-4 text-success-500" />
              ) : connectionStatus === 'connecting' ? (
                <div className="h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <WifiOff className="h-4 w-4 text-danger-500" />
              )}
              <span className="text-xs text-dark-400 capitalize">{connectionStatus}</span>
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

        {/* Stats bar */}
        {tickerData && (
          <div className="flex items-center space-x-8 px-4 py-2 text-xs border-t border-dark-700">
            <div className="flex flex-col">
              <span className="text-dark-400">24h High</span>
              <span className="font-medium">{parseFloat(tickerData.highPrice).toFixed(4)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-dark-400">24h Low</span>
              <span className="font-medium">{parseFloat(tickerData.lowPrice).toFixed(4)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-dark-400">24h Volume ({selectedSymbol.replace('USDT', '')})</span>
              <span className="font-medium">{parseFloat(tickerData.volume).toLocaleString()}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-dark-400">24h Volume (USDT)</span>
              <span className="font-medium">{parseFloat(tickerData.quoteVolume).toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main content - Horizontal layout with chart on left */}
      <div className="flex gap-1 h-[calc(100%-120px)]">
        {/* Left - Chart (takes most space) */}
        <div className="flex-1 bg-dark-800 border-r border-dark-700">
          <div className="h-full flex flex-col">
            {/* Chart controls */}
            <div className="flex items-center justify-between p-3 border-b border-dark-700">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'].map((interval) => (
                    <button
                      key={interval}
                      onClick={() => handleIntervalChange(interval)}
                      className={`text-xs px-2 py-1 rounded hover:bg-dark-600 ${selectedInterval === interval ? 'bg-dark-700' : ''
                        }`}
                    >
                      {interval}
                    </button>
                  ))}
                </div>

                <div className="h-4 w-px bg-dark-600" />

                <div className="flex items-center space-x-2">
                  <button className="text-xs px-2 py-1 bg-dark-700 rounded hover:bg-dark-600">Candlesticks</button>
                  <button className="text-xs px-2 py-1 hover:bg-dark-700 rounded">Line</button>
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

            {/* Chart area */}
            <div className="flex-1 relative">
              <TradingViewChart data={candles} />

              {/* Chart overlay info */}
              <div className="absolute top-4 left-4 bg-dark-800/80 rounded p-2 text-xs z-10">
                {klineData ? (
                  <div className="space-y-1">
                    <div>O: <span className="font-mono">{parseFloat(klineData.open || '0').toFixed(2)}</span></div>
                    <div>H: <span className="font-mono text-success-500">{parseFloat(klineData.high || '0').toFixed(2)}</span></div>
                    <div>L: <span className="font-mono text-danger-500">{parseFloat(klineData.low || '0').toFixed(2)}</span></div>
                    <div>C: <span className="font-mono">{parseFloat(klineData.close || '0').toFixed(2)}</span></div>
                    <div>V: <span className="font-mono">{parseFloat(klineData.volume || '0').toLocaleString()}</span></div>
                  </div>
                ) : (
                  <div className="text-dark-400">Waiting for kline data...</div>
                )}
              </div>


            </div>
          </div>
        </div>

        {/* Center - Order book */}
        <div className="w-64 bg-dark-800 border-r border-dark-700">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-dark-700">
              <h3 className="text-sm font-medium">Order Book</h3>
              <div className="flex items-center space-x-2">
                <button className="text-xs text-dark-400 hover:text-dark-200">0.01</button>
                <Settings className="h-3 w-3 text-dark-400" />
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              {orderBook ? (
                <div className="h-full flex flex-col">
                  {/* Asks */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="space-y-0.5 p-2">
                      {orderBook.asks.slice(0, 15).reverse().map((ask, index) => (
                        <div key={index} className="flex justify-between text-xs relative">
                          <span className="text-danger-500 font-mono">{parseFloat(ask.price).toFixed(4)}</span>
                          <span className="text-dark-300 font-mono">{parseFloat(ask.quantity).toFixed(3)}</span>
                          <div
                            className="absolute right-0 top-0 h-full bg-danger-500/10"
                            style={{ width: `${Math.min(parseFloat(ask.quantity) / 10 * 100, 100)}%` }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Current price */}
                  <div className="px-2 py-1 border-y border-dark-700">
                    <div className="text-center">
                      <div className={`text-sm font-bold ${tickerData && parseFloat(tickerData.priceChange) >= 0 ? 'text-success-500' : 'text-danger-500'
                        }`}>
                        {tickerData ? parseFloat(tickerData.lastPrice).toFixed(4) : '0.0000'}
                      </div>
                      <div className="text-xs text-dark-400">≈ ${tickerData ? parseFloat(tickerData.lastPrice).toFixed(2) : '0.00'}</div>
                    </div>
                  </div>

                  {/* Bids */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="space-y-0.5 p-2">
                      {orderBook.bids.slice(0, 15).map((bid, index) => (
                        <div key={index} className="flex justify-between text-xs relative">
                          <span className="text-success-500 font-mono">{parseFloat(bid.price).toFixed(4)}</span>
                          <span className="text-dark-300 font-mono">{parseFloat(bid.quantity).toFixed(3)}</span>
                          <div
                            className="absolute right-0 top-0 h-full bg-success-500/10"
                            style={{ width: `${Math.min(parseFloat(bid.quantity) / 10 * 100, 100)}%` }}
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
                    <div className="text-xs mt-1">Waiting for WebSocket connection...</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right - Trading and Recent trades */}
        <div className="w-80 bg-dark-800 border-l border-dark-700">
          <div className="h-full flex flex-col">
            {/* Trading form */}
            <div className="border-b border-dark-700">
              <div className="flex border-b border-dark-700">
                <button
                  className={`flex-1 py-2 text-xs font-medium ${activeOrderTab === 'limit'
                      ? 'border-b-2 border-primary-500 text-primary-500'
                      : 'text-dark-400 hover:text-dark-300'
                    }`}
                  onClick={() => setActiveOrderTab('limit')}
                >
                  Limit
                </button>
                <button
                  className={`flex-1 py-2 text-xs font-medium ${activeOrderTab === 'market'
                      ? 'border-b-2 border-primary-500 text-primary-500'
                      : 'text-dark-400 hover:text-dark-300'
                    }`}
                  onClick={() => setActiveOrderTab('market')}
                >
                  Market
                </button>
                <button
                  className={`flex-1 py-2 text-xs font-medium ${activeOrderTab === 'stop'
                      ? 'border-b-2 border-primary-500 text-primary-500'
                      : 'text-dark-400 hover:text-dark-300'
                    }`}
                  onClick={() => setActiveOrderTab('stop')}
                >
                  Stop-Limit
                </button>
              </div>

              <div className="p-3">
                <div className="flex space-x-1 mb-3">
                  <button
                    className={`flex-1 py-2 text-xs font-medium rounded ${tradeSide === 'buy'
                        ? 'bg-success-500 text-white'
                        : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                      }`}
                    onClick={() => setTradeSide('buy')}
                  >
                    Buy
                  </button>
                  <button
                    className={`flex-1 py-2 text-xs font-medium rounded ${tradeSide === 'sell'
                        ? 'bg-danger-500 text-white'
                        : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                      }`}
                    onClick={() => setTradeSide('sell')}
                  >
                    Sell
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Available balance */}
                  <div className="flex justify-between text-xs">
                    <span className="text-dark-400">Available</span>
                    <span>0.00000000 {tradeSide === 'buy' ? 'USDT' : selectedSymbol.replace('USDT', '')}</span>
                  </div>

                  {activeOrderTab !== 'market' && (
                    <div>
                      <label className="block text-xs text-dark-400 mb-1">Price</label>
                      <div className="relative">
                        <input
                          type="text"
                          className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"
                          placeholder="0.00"
                          value={price}
                          onChange={handlePriceChange}
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <span className="text-dark-400 text-xs">USDT</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-dark-400 mb-1">Amount</label>
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"
                        placeholder="0.00000000"
                        value={amount}
                        onChange={handleAmountChange}
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <span className="text-dark-400 text-xs">{selectedSymbol.replace('USDT', '')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1">
                    {[25, 50, 75, 100].map((percent) => (
                      <button
                        key={percent}
                        className="py-1 text-xs bg-dark-700 rounded text-dark-300 hover:bg-dark-600"
                      >
                        {percent}%
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs text-dark-400 mb-1">Total</label>
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"
                        placeholder="0.00"
                        value={total}
                        onChange={handleTotalChange}
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <span className="text-dark-400 text-xs">USDT</span>
                      </div>
                    </div>
                  </div>

                  <button
                    className={`w-full py-2 rounded text-xs font-medium ${tradeSide === 'buy'
                        ? 'bg-success-500 hover:bg-success-600 text-white'
                        : 'bg-danger-500 hover:bg-danger-600 text-white'
                      }`}
                  >
                    {tradeSide === 'buy' ? 'Buy' : 'Sell'} {selectedSymbol.replace('USDT', '')}
                  </button>
                </div>
              </div>
            </div>

            {/* Recent trades */}
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b border-dark-700">
                <h3 className="text-sm font-medium">Recent Trades</h3>
                <button className="text-xs text-dark-400 hover:text-dark-200">More</button>
              </div>

              <div className="overflow-y-auto h-full">
                <div className="px-3 py-2 border-b border-dark-700">
                  <div className="grid grid-cols-3 gap-2 text-xs text-dark-400">
                    <span>Price (USDT)</span>
                    <span className="text-right">Amount ({selectedSymbol.replace('USDT', '')})</span>
                    <span className="text-right">Time</span>
                  </div>
                </div>

                <div className="space-y-0">
                  {recentTrades.length > 0 ? (
                    recentTrades.map((trade, index) => (
                      <div key={trade.id || index} className="px-3 py-1 hover:bg-dark-700/50">
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {/* Giá */}
                          <span className={`font-mono ${trade.isBuyerMaker ? 'text-danger-500' : 'text-success-500'
                            }`}>
                            {trade.price && !isNaN(Number(trade.price))
                              ? parseFloat(trade.price).toFixed(4)
                              : '0.0000'}
                          </span>

                          {/* Số lượng */}
                          <span className="text-right font-mono text-dark-300">
                            {trade.qty && !isNaN(Number(trade.qty))
                              ? parseFloat(trade.qty).toFixed(3)
                              : '0.000'}
                          </span>

                          {/* Thời gian */}
                          <span className="text-right text-dark-400">
                            {trade.time && !isNaN(Number(trade.time))
                              ? new Date(Number(trade.time)).toLocaleTimeString('en-US', {
                                hour12: false,
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })
                              : 'Invalid'}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-dark-400">
                      <div className="text-sm">No recent trades</div>
                      <div className="text-xs mt-1">Waiting for WebSocket data...</div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom panel - Open orders and WebSocket info */}
      <div className="h-40 border-t border-dark-700 bg-dark-800">
        <div className="flex h-full">
          {/* Open Orders */}
          <div className="flex-1 border-r border-dark-700">
            <div className="flex items-center justify-between p-3 border-b border-dark-700">
              <div className="flex items-center space-x-4">
                <h3 className="text-sm font-medium">Open Orders</h3>
                <span className="text-xs text-dark-400">(0)</span>
              </div>
              <button className="text-xs text-danger-500 hover:text-danger-400">Cancel All</button>
            </div>

            <div className="p-4 text-center text-dark-400">
              <div className="text-sm">No open orders</div>
              <div className="text-xs mt-1">Your open orders will appear here</div>
            </div>
          </div>

          {/* Order History */}
          <div className="flex-1 border-r border-dark-700">
            <div className="flex items-center justify-between p-3 border-b border-dark-700">
              <h3 className="text-sm font-medium">Order History</h3>
              <button className="text-xs text-dark-400 hover:text-dark-200">View All</button>
            </div>

            <div className="p-4 text-center text-dark-400">
              <div className="text-sm">No order history</div>
              <div className="text-xs mt-1">Your completed orders will appear here</div>
            </div>
          </div>

          {/* WebSocket Subscriptions */}
          <div className="w-80">
            <div className="flex items-center justify-between p-3 border-b border-dark-700">
              <h3 className="text-sm font-medium">Active Streams</h3>
              <span className="text-xs text-dark-400">({subscriptions.length})</span>
            </div>

            <div className="overflow-y-auto h-[calc(100%-41px)]">
              <div className="p-2 space-y-1 max-h-32 overflow-y-auto">
                {subscriptions.map((subscription, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-dark-700/50 rounded text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-dark-300 truncate">{subscription.action}</div>
                      <div className="text-dark-400 truncate">
                        {subscription.symbol} {subscription.market && `(${subscription.market})`}
                        {subscription.interval && ` - ${subscription.interval}`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnsubscribe(subscription.id)}
                      className="text-danger-500 hover:text-danger-400 ml-2 flex-shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}