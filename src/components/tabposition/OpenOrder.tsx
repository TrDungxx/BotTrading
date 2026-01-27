import React, { useEffect, useState } from 'react';
import { binanceWS, OPEN_ORDERS_LS_KEY, OPEN_ORDERS_EVENT } from '../binancewebsocket/BinanceWebSocketService';
import { Trash2, ChevronDown } from 'lucide-react';

type Market = 'spot' | 'futures';
type OrderTab = 'regular' | 'conditional';

interface Order {
  orderId: number | string;
  algoId?: number | string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type:
    | 'LIMIT'
    | 'MARKET'
    | 'STOP'
    | 'STOP_MARKET'
    | 'TAKE_PROFIT'
    | 'TAKE_PROFIT_MARKET'
    | 'TRAILING_STOP_MARKET'
    | string;
  price?: string | number;
  origQty?: string | number;
  executedQty?: string | number;
  status: string;
  stopPrice?: string | number;
  workingType?: 'MARK_PRICE' | 'LAST_PRICE' | 'INDEX_PRICE' | 'CONTRACT_PRICE' | string;
  time?: number;
  updateTime?: number;
  closePosition?: boolean;
  reduceOnly?: boolean;
  positionSide?: 'LONG' | 'SHORT' | 'BOTH';
  _optimistic?: boolean;
  _isAlgo?: boolean;
}

interface OpenOrderProps {
  selectedSymbol: string;
  market: Market;
  onPendingCountChange?: (n: number) => void;
  hideOtherSymbols?: boolean;
}

const dash = '—';

// ---- helpers ----
function readOrdersLS(): Order[] {
  try { return JSON.parse(localStorage.getItem(OPEN_ORDERS_LS_KEY) || '[]'); }
  catch { return []; }
}

function toNumber(v: any): number { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function fmt(v: any): string { const n = toNumber(v); return n ? String(n) : dash; }

function mapWorkingType(w?: Order['workingType']): string {
  switch (w) {
    case 'MARK_PRICE': return 'Mark';
    case 'LAST_PRICE': return 'Last';
    case 'INDEX_PRICE': return 'Index';
    case 'CONTRACT_PRICE': return 'Contract';
    default: return dash;
  }
}

// Helper để phân loại order
const CONDITIONAL_TYPES = [
  'STOP_MARKET',
  'TAKE_PROFIT_MARKET',
  'STOP',
  'TAKE_PROFIT',
  'TRAILING_STOP_MARKET'
];

const isConditionalOrder = (order: Order): boolean => {
  return order._isAlgo === true;
};

const isRegularOrder = (order: Order): boolean => {
  return !isConditionalOrder(order);
};

const isTriggerMarket = (t: Order['type']) => t === 'STOP_MARKET' || t === 'TAKE_PROFIT_MARKET';
const isStopOrTpLimit = (t: Order['type']) => t === 'STOP' || t === 'TAKE_PROFIT';

const OpenOrder: React.FC<OpenOrderProps> = ({ selectedSymbol, market, onPendingCountChange, hideOtherSymbols = false }) => {
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [showCancelMenu, setShowCancelMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<OrderTab>('regular');

  // Handler để đổi symbol khi click vào cặp tiền (giống Position)
  const handleSymbolClick = (symbol: string) => {
    window.dispatchEvent(
      new CustomEvent("chart-symbol-change-request", {
        detail: { symbol },
      })
    );
    try {
      localStorage.setItem("selectedSymbol", symbol);
    } catch {}
  };

  // Tính count cho mỗi tab
  const regularOrders = openOrders.filter(isRegularOrder);
  const conditionalOrders = openOrders.filter(isConditionalOrder);
  
  // Filter theo symbol nếu hideOtherSymbols = true
  const filterSymbol = localStorage.getItem('selectedSymbol') || selectedSymbol;
  
  const filteredRegularOrders = hideOtherSymbols && filterSymbol
    ? regularOrders.filter(o => o.symbol === filterSymbol)
    : regularOrders;
    
  const filteredConditionalOrders = hideOtherSymbols && filterSymbol
    ? conditionalOrders.filter(o => o.symbol === filterSymbol)
    : conditionalOrders;

  // Orders hiển thị theo tab đang chọn (đã filter)
  const displayOrders = activeTab === 'regular' ? filteredRegularOrders : filteredConditionalOrders;

  // ========== SUBSCRIBE REALTIME (event-bus + storage) ==========
  // TradingTerminal đã load data, ở đây chỉ lắng nghe updates
  useEffect(() => {
    const loadOrders = () => {
      const list = readOrdersLS();
      const filtered = list.filter(o =>
        o.status === 'NEW' &&
        !o._optimistic &&
        !String(o.orderId || '').startsWith('tmp_')
      );
      setOpenOrders(filtered);
      onPendingCountChange?.(filtered.length);
    };

    // Load initial
    loadOrders();

    // Listen for updates from event bus
    const onBus = (e: any) => {
      loadOrders();
    };

    // Listen for storage changes (cross-tab)
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === OPEN_ORDERS_LS_KEY) {
        loadOrders();
      }
    };

    window.addEventListener(OPEN_ORDERS_EVENT, onBus as any);
    window.addEventListener('storage', onStorage);
    
    return () => {
      window.removeEventListener(OPEN_ORDERS_EVENT, onBus as any);
      window.removeEventListener('storage', onStorage);
    };
  }, [selectedSymbol, onPendingCountChange]);

  // ========== Cancel ==========
  const cancelOrder = (order: Order) => {
  if (order._optimistic || String(order.orderId).startsWith('tmp_')) {
    console.warn('[OpenOrder] Cannot cancel optimistic order');
    return;
  }

  // ✅ Chỉ là algo order khi:
  // 1. Có _isAlgo flag = true
  // 2. HOẶC có algoId riêng (khác orderId)
  const isAlgoOrder = !!(
    order._isAlgo === true || 
    (order.algoId && order.algoId !== order.orderId)
  );

  if (isAlgoOrder) {
    const algoId = order.algoId || order.orderId;
    console.log('[OpenOrder] Canceling ALGO order:', {
      symbol: order.symbol,
      algoId: algoId,
    });
    
    (binanceWS as any).sendAuthed({
      action: 'cancelFuturesAlgoOrder',
      symbol: order.symbol,
      algoId: Number(algoId)
    });
    return;
  }

  // Regular order hoặc Conditional order (STOP_MARKET, TAKE_PROFIT_MARKET, etc.)
  // Đều dùng cancelOrder thường
  const numericOrderId = Number(order.orderId);
  if (!Number.isFinite(numericOrderId) || numericOrderId <= 0) {
    console.error('[OpenOrder] Cannot cancel: invalid orderId', order.orderId);
    return;
  }

  console.log('[OpenOrder] Canceling order:', {
    symbol: order.symbol,
    orderId: numericOrderId,
    type: order.type,
  });

  binanceWS.cancelOrder(order.symbol, numericOrderId, market, false);
};

  const cancelFilteredOrders = (filterFn: (o: Order) => boolean) => {
    openOrders.filter(filterFn).forEach(cancelOrder);
  };

  return (
    <div className="open-orders h-full flex flex-col overflow-hidden">
      {/* Tab Header */}
      <div className="flex-shrink-0 flex items-center gap-2 px-fluid-4 py-2 border-b border-dark-700">
        <button
          type="button"
          onClick={() => setActiveTab('regular')}
          className={`px-3 py-1.5 text-fluid-sm font-medium rounded transition-colors ${
            activeTab === 'regular'
              ? 'bg-dark-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Cơ bản({filteredRegularOrders.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('conditional')}
          className={`px-3 py-1.5 text-fluid-sm font-medium rounded transition-colors flex items-center gap-1 ${
            activeTab === 'conditional'
              ? 'bg-dark-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Có điều kiện({filteredConditionalOrders.length})
          <span className="text-gray-500 text-xs">ⓘ</span>
        </button>
        
        {/* Indicator khi đang filter theo symbol */}
        {hideOtherSymbols && filterSymbol && (
          <span className="ml-auto text-xs text-yellow-500 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
            Đang lọc: {filterSymbol}
          </span>
        )}
      </div>

      {/* Table container */}
      <div className="open-orders-table-container flex-1 min-h-0 overflow-x-auto overflow-y-auto">
        <table className="min-w-full text-left text-fluid-sm leading-[16px] font-sans">
          <thead>
            <tr className="text-gray-400 border-b border-dark-700" style={{ background: 'var(--bg-panel, #1e293b)' }}>
              <th className="px-fluid-4 py-2">Thời gian</th>
              <th className="px-fluid-4 py-2">Cặp</th>
              <th className="px-fluid-4 py-2">Loại</th>
              <th className="px-fluid-4 py-2">Phương thức</th>
              <th className="px-fluid-4 py-2">Giá</th>
              <th className="px-fluid-4 py-2">Giá kích hoạt</th>
              <th className="px-fluid-4 py-2">Theo giá</th>
              <th className="px-fluid-4 py-2">Số lượng</th>
              <th className="px-fluid-4 py-2">Đã khớp</th>
              <th className="px-fluid-4 py-2">TP/SL</th>
              <th className="px-fluid-4 py-2">Giảm chi</th>
              <th className="px-fluid-4 py-2 text-right relative">
                <button
                  type="button"
                  onClick={() => setShowCancelMenu((prev) => !prev)}
                  className="inline-flex items-center gap-fluid-1 hover:text-yellow-500"
                >
                  <span>Huỷ bỏ tất cả</span>
                  <ChevronDown size={16} />
                </button>

                {showCancelMenu && (
                  <div className="absolute right-0 mt-2 w-44 bg-dark-800 border border-dark-700 rounded shadow-md z-50">
                    <button
                      type="button"
                      className="w-full text-left px-fluid-3 py-2 text-fluid-sm text-white hover:bg-dark-700"
                      onClick={() => { cancelFilteredOrders((o) => o.symbol === selectedSymbol); setShowCancelMenu(false); }}
                    >
                      Tất cả ({selectedSymbol})
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-fluid-3 py-2 text-fluid-sm text-white hover:bg-dark-700"
                      onClick={() => { cancelFilteredOrders((o) => o.symbol === selectedSymbol && o.type === 'LIMIT'); setShowCancelMenu(false); }}
                    >
                      LIMIT
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-fluid-3 py-2 text-fluid-sm text-white hover:bg-dark-700"
                      onClick={() => {
                        cancelFilteredOrders(
                          (o) => o.symbol === selectedSymbol &&
                            CONDITIONAL_TYPES.includes(o.type)
                        );
                        setShowCancelMenu(false);
                      }}
                    >
                      Stop / TP
                    </button>
                  </div>
                )}
              </th>
            </tr>
          </thead>

          <tbody>
            {displayOrders.map((order) => {
              const limitPrice = isTriggerMarket(order.type)
                ? dash
                : toNumber(order.price) > 0 ? String(toNumber(order.price)) : dash;

              const triggerPrice =
                (isTriggerMarket(order.type) || isStopOrTpLimit(order.type)) && toNumber(order.stopPrice) > 0
                  ? String(toNumber(order.stopPrice))
                  : dash;

              const qty = order.closePosition || toNumber(order.origQty) === 0
                ? 'Đóng vị thế'
                : fmt(order.origQty);
              const filled = fmt(order.executedQty);
              const when = order.updateTime || order.time;
              const timeStr = when ? new Date(when).toLocaleTimeString() : '--';

              const canCancel = order.orderId != null &&
                order.orderId !== '' &&
                order.orderId !== 0 &&
                !String(order.orderId).startsWith('tmp_');

              return (
                <tr className="border-b border-dark-700" key={String(order.orderId)}>
                  <td className="px-fluid-4 py-fluid-3 text-white">{timeStr}</td>
                  <td className="px-fluid-4 py-fluid-3">
                    <button
                      type="button"
                      onClick={() => handleSymbolClick(order.symbol)}
                      className="text-yellow-500 hover:text-yellow-400 hover:underline cursor-pointer font-medium"
                      title={`Chuyển chart sang ${order.symbol}`}
                    >
                      {order.symbol}
                    </button>
                  </td>
                  <td className={`px-fluid-4 py-fluid-3 font-medium ${order.side === 'BUY' ? 'text-green-500' : 'text-red-500'}`}>
                    {order.side === 'BUY' ? 'Mua' : 'Bán'}
                  </td>
                  <td className="px-fluid-4 py-fluid-3 text-white">{order.type}</td>
                  <td className="px-fluid-4 py-fluid-3 text-white">{limitPrice}</td>
                  <td className="px-fluid-4 py-fluid-3 text-white">{triggerPrice}</td>
                  <td className="px-fluid-4 py-fluid-3 text-white">{mapWorkingType(order.workingType)}</td>
                  <td className="px-fluid-4 py-fluid-3 text-white">{qty}</td>
                  <td className="px-fluid-4 py-fluid-3 text-white">{filled}</td>
                  <td className="px-fluid-4 py-fluid-3 text-white">—</td>
                  <td className="px-fluid-4 py-fluid-3 text-white">
                    {order.closePosition || order.reduceOnly ? 'Có' : 'Không'}
                  </td>
                  <td className="px-fluid-4 py-fluid-3">
                    <button
                      type="button"
                      className={`${canCancel ? 'text-gray-400 hover:text-red-500' : 'text-gray-600 cursor-not-allowed'}`}
                      onClick={() => canCancel && cancelOrder(order)}
                      disabled={!canCancel}
                      title={canCancel ? 'Huỷ lệnh' : 'Không thể huỷ'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}

            {displayOrders.length === 0 && (
              <tr>
                <td className="px-fluid-4 py-6 text-gray-400" colSpan={12}>
                  {activeTab === 'regular' ? 'Không có lệnh cơ bản.' : 'Không có lệnh có điều kiện.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OpenOrder;