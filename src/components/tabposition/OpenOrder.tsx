import React, { useEffect, useRef, useState } from 'react';
import { binanceWS, OPEN_ORDERS_LS_KEY, OPEN_ORDERS_EVENT } from '../binancewebsocket/BinanceWebSocketService';
import { Trash2, ChevronDown } from 'lucide-react';

type Market = 'spot' | 'futures';
type OrderTab = 'regular' | 'conditional';

interface Order {
  orderId: number | string;
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
  _optimistic?: boolean;
  _isAlgo?: boolean; // ✅ THÊM: Đánh dấu order từ algo API
  
}

interface OpenOrderProps {
  selectedSymbol: string;
  market: Market;
  onPendingCountChange?: (n: number) => void;
}

const dash = '—';

// ---- helpers LS + event ----
function readOrdersLS(): Order[] {
  try { return JSON.parse(localStorage.getItem(OPEN_ORDERS_LS_KEY) || '[]'); }
  catch { return []; }
}
function writeOrdersLS(list: Order[]) {
  const realOrders = list.filter(o => !o._optimistic);
  const optimisticOrders = list.filter(o => o._optimistic);
  
  const pendingOptimistic = optimisticOrders.filter(opt => {
    const hasReal = realOrders.some(real =>
      real.symbol === opt.symbol &&
      real.side === opt.side &&
      real.type === opt.type &&
      Math.abs(Number(real.stopPrice) - Number(opt.stopPrice)) < 0.001
    );
    return !hasReal;
  });
  
  const finalList = [...realOrders, ...pendingOptimistic];
  
  localStorage.setItem(OPEN_ORDERS_LS_KEY, JSON.stringify(finalList));
  window.dispatchEvent(new CustomEvent(OPEN_ORDERS_EVENT, { detail: { list: finalList } }));
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

// ✅ THÊM: Helper để phân loại order
const CONDITIONAL_TYPES = [
  'STOP_MARKET',
  'TAKE_PROFIT_MARKET',
  'STOP',
  'TAKE_PROFIT',
  'TRAILING_STOP_MARKET'
];

const isConditionalOrder = (order: Order): boolean => {
  // Chỉ dựa vào flag _isAlgo - KHÔNG fallback theo type
  return order._isAlgo === true;
};

const isRegularOrder = (order: Order): boolean => {
  return !isConditionalOrder(order);
};

const isTriggerMarket = (t: Order['type']) => t === 'STOP_MARKET' || t === 'TAKE_PROFIT_MARKET';
const isStopOrTpLimit = (t: Order['type']) => t === 'STOP' || t === 'TAKE_PROFIT';

const OpenOrder: React.FC<OpenOrderProps> = ({ selectedSymbol, market, onPendingCountChange }) => {
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [showCancelMenu, setShowCancelMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<OrderTab>('regular'); // ✅ THÊM: Tab state

  // ✅ THÊM: Tính count cho mỗi tab
  const regularOrders = openOrders.filter(isRegularOrder);
  const conditionalOrders = openOrders.filter(isConditionalOrder);
  
  // Orders hiển thị theo tab đang chọn
  const displayOrders = activeTab === 'regular' ? regularOrders : conditionalOrders;

  // ========== SUBSCRIBE REALTIME (event-bus + storage) ==========
  useEffect(() => {
    const initAll = readOrdersLS();
    const initFiltered = initAll.filter(o =>
      o.status === 'NEW' &&
      !o._optimistic &&
      !String(o.orderId || '').startsWith('tmp_')
    );
    setOpenOrders(initFiltered);
    onPendingCountChange?.(initFiltered.length);

    const onBus = (e: any) => {
      const list: Order[] = e?.detail?.list ?? readOrdersLS();
      const filtered = list.filter(o =>
        o.status === 'NEW' &&
        !o._optimistic &&
        !String(o.orderId || '').startsWith('tmp_')
      );
      setOpenOrders(filtered);
      onPendingCountChange?.(filtered.length);
    };

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === OPEN_ORDERS_LS_KEY) {
        const list = readOrdersLS();
        const filtered = list.filter(o =>
          o.status === 'NEW' &&
          !o._optimistic &&
          !String(o.orderId || '').startsWith('tmp_')
        );
        setOpenOrders(filtered);
        onPendingCountChange?.(filtered.length);
      }
    };

    window.addEventListener(OPEN_ORDERS_EVENT, onBus as any);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(OPEN_ORDERS_EVENT, onBus as any);
      window.removeEventListener('storage', onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymbol]);

  // ========== WS callback (server push) ==========
  useEffect(() => {
    binanceWS.setOrderUpdateHandler((orders: any[]) => {
      if (!Array.isArray(orders)) return;
      writeOrdersLS(orders as Order[]);
    });
    return () => { binanceWS.setOrderUpdateHandler?.(null); };
  }, []);

 // ========== Pull open orders khi market đổi ==========
const debounceTimer = useRef<number | null>(null);
useEffect(() => {
  if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
  debounceTimer.current = window.setTimeout(() => {
    
    // ✅ Lấy positions đang có vị thế
    const positions = JSON.parse(localStorage.getItem('positions') || '[]');
    const activeSymbols = positions
      .filter((p: any) => Math.abs(parseFloat(p.positionAmt || 0)) > 0)
      .map((p: any) => p.symbol);
    
    console.log('📊 Active positions symbols:', activeSymbols);
    
    if (activeSymbols.length === 0) {
      // Không có vị thế → chỉ lấy regular orders cho symbol hiện tại
      binanceWS.getOpenOrders(market, selectedSymbol, (orders: Order[]) => {
        const regularWithFlag = orders.map(o => ({ ...o, _isAlgo: false }));
        writeOrdersLS(regularWithFlag as Order[]);
      });
      return;
    }
    
    // ✅ Gọi getAllOpenOrders cho từng symbol có vị thế
    let allRegular: Order[] = [];
    let allAlgo: Order[] = [];
    let completed = 0;
    
    activeSymbols.forEach((symbol: string) => {
      (binanceWS as any).getAllOpenOrders(symbol, market, (data: { regular: Order[]; algo: Order[] }) => {
        console.log(`📥 ${symbol} - Regular: ${data.regular?.length || 0}, Algo: ${data.algo?.length || 0}`);
        
        allRegular = [...allRegular, ...(data.regular || []).map(o => ({ ...o, _isAlgo: false }))];
        allAlgo = [...allAlgo, ...(data.algo || []).map(o => ({ ...o, _isAlgo: true }))];
        
        completed++;
        
        // Khi tất cả đã xong → merge và save
        if (completed === activeSymbols.length) {
          const merged = [...allRegular, ...allAlgo];
          console.log('📥 Final merged - Regular:', allRegular.length, '| Algo:', allAlgo.length);
          writeOrdersLS(merged as Order[]);
        }
      });
    });

  }, 250);

  return () => {
    if (debounceTimer.current) {
      window.clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
  };
}, [market, selectedSymbol]);

  // ========== Cancel ==========
  const cancelOrder = (order: Order) => {
  const orderId = order.orderId;

  if (orderId == null || orderId === '' || orderId === 0) {
    console.error('[OpenOrder] Cannot cancel: orderId is missing', order);
    return;
  }

  if (String(orderId).startsWith('tmp_')) {
    console.warn('[OpenOrder] Cannot cancel optimistic order:', orderId);
    return;
  }

  const numericOrderId = Number(orderId);
  if (!Number.isFinite(numericOrderId) || numericOrderId <= 0) {
    console.error('[OpenOrder] Cannot cancel: invalid orderId', orderId);
    return;
  }

  // ✅ Check nếu là algo order
  const isAlgo = order._isAlgo === true || !!(order as any).algoId;

  console.log('[OpenOrder] Canceling order:', {
    symbol: order.symbol,
    orderId: numericOrderId,
    market,
    isAlgo,
  });

  // ✅ Gửi flag isAlgo để backend biết gọi đúng API
  (binanceWS as any).cancelOrder(order.symbol, numericOrderId, market, isAlgo);
};

  const cancelFilteredOrders = (filterFn: (o: Order) => boolean) => {
    openOrders.filter(filterFn).forEach(cancelOrder);
  };

  return (
    <div className="card">
      {/* ✅ THÊM: Tab Header */}
      <div className="flex items-center gap-2 px-fluid-4 py-2 border-b border-dark-700">
        <button
          type="button"
          onClick={() => setActiveTab('regular')}
          className={`px-3 py-1.5 text-fluid-sm font-medium rounded transition-colors ${
            activeTab === 'regular'
              ? 'bg-dark-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Cơ bản({regularOrders.length})
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
          Có điều kiện({conditionalOrders.length})
          <span className="text-gray-500 text-xs">ⓘ</span>
        </button>
      </div>

      <div className="card-body overflow-x-auto">
        <table className="min-w-full text-left text-fluid-sm leading-[16px] font-sans">
          <thead>
            <tr className="text-gray-400 border-b border-dark-700">
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
                  <td className="px-fluid-4 py-fluid-3 text-white">{order.symbol}</td>
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