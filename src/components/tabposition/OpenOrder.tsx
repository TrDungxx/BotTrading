import React, { useEffect, useRef, useState } from 'react';
import { binanceWS, OPEN_ORDERS_LS_KEY, OPEN_ORDERS_EVENT } from '../binancewebsocket/BinanceWebSocketService';
import { Trash2, ChevronDown } from 'lucide-react';

type Market = 'spot' | 'futures';

interface Order {
  orderId: number | string; // cho phép 'tmp_*' optimistic
  symbol: string;
  side: 'BUY' | 'SELL';
  type:
    | 'LIMIT'
    | 'MARKET'
    | 'STOP'
    | 'STOP_MARKET'
    | 'TAKE_PROFIT'
    | 'TAKE_PROFIT_MARKET'
    | string;
  price?: string | number;
  origQty?: string | number;
  executedQty?: string | number;
  status: string;
  stopPrice?: string | number;
  workingType?: 'MARK_PRICE' | 'LAST_PRICE' | 'INDEX_PRICE' | 'CONTRACT_PRICE' | string;
  time?: number;
  updateTime?: number;
  _optimistic?: boolean;
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
  localStorage.setItem(OPEN_ORDERS_LS_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(OPEN_ORDERS_EVENT, { detail: { list } }));
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
const isTriggerMarket = (t: Order['type']) => t === 'STOP_MARKET' || t === 'TAKE_PROFIT_MARKET';
const isStopOrTpLimit = (t: Order['type']) => t === 'STOP' || t === 'TAKE_PROFIT';

const OpenOrder: React.FC<OpenOrderProps> = ({ selectedSymbol, market, onPendingCountChange }) => {
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [showCancelMenu, setShowCancelMenu] = useState(false);

  // ========== SUBSCRIBE REALTIME (event-bus + storage) ==========
  useEffect(() => {
    // khởi tạo từ LS (bao gồm optimistic)
    const initAll = readOrdersLS();
    const initFiltered = initAll.filter(o => o.status === 'NEW' && (!selectedSymbol || o.symbol === selectedSymbol));
    setOpenOrders(initFiltered);
    onPendingCountChange?.(initFiltered.length);

    const onBus = (e: any) => {
      const list: Order[] = e?.detail?.list ?? readOrdersLS();
      const filtered = list.filter(o => o.status === 'NEW' && (!selectedSymbol || o.symbol === selectedSymbol));
      setOpenOrders(filtered);
      onPendingCountChange?.(filtered.length);
    };
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === OPEN_ORDERS_LS_KEY) {
        const list = readOrdersLS();
        const filtered = list.filter(o => o.status === 'NEW' && (!selectedSymbol || o.symbol === selectedSymbol));
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
      // Server vừa gửi snapshot/cập nhật -> ghi LS + phát event để đồng bộ toàn app
      writeOrdersLS(orders as Order[]);
      // (state sẽ được cập nhật bởi listener ở trên)
    });
    return () => { binanceWS.setOrderUpdateHandler?.(null); };
  }, []);

  // ========== Pull open orders khi market/symbol đổi ==========
  const debounceTimer = useRef<number | null>(null);
  useEffect(() => {
  if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
  debounceTimer.current = window.setTimeout(() => {
    const handleResponse = (orders: Order[]) => {
      console.log('📥 getOpenOrders response:', orders);
      // Ghi đè LS - clear optimistic orders
      writeOrdersLS(orders);
    };
    
    selectedSymbol 
      ? binanceWS.getOpenOrders(market, selectedSymbol, handleResponse)
      : binanceWS.getOpenOrders(market, undefined, handleResponse);
  }, 250);
  
  return () => {
    if (debounceTimer.current) { 
      window.clearTimeout(debounceTimer.current); 
      debounceTimer.current = null; 
    }
  };
}, [market, selectedSymbol]);
  // ========== Cancel ==========
  const cancelOrder = (order: Order) => binanceWS.cancelOrder(order.symbol, Number(order.orderId), market);
  const cancelFilteredOrders = (filterFn: (o: Order) => boolean) => {
    openOrders.filter(filterFn).forEach(cancelOrder);
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between px-4 mb-2">
        <div className="text-yellow-400 text-sm font-semibold relative" />
      </div>

      <div className="card-body overflow-x-auto">
        <table className="min-w-full text-left text-[13px] leading-[16px] font-sans">
          <thead>
            <tr className="text-gray-400 border-b border-dark-700">
              <th className="px-4 py-2">Thời gian</th>
              <th className="px-4 py-2">Cặp</th>
              <th className="px-4 py-2">Loại</th>
              <th className="px-4 py-2">Phương thức</th>
              <th className="px-4 py-2">Giá</th>
              <th className="px-4 py-2">Giá kích hoạt</th>
              <th className="px-4 py-2">Theo giá</th>
              <th className="px-4 py-2">Số lượng</th>
              <th className="px-4 py-2">Đã khớp</th>
              <th className="px-4 py-2">TP/SL</th>
              <th className="px-4 py-2">Giảm chi</th>
              <th className="px-4 py-2 text-right relative">
                <button
                  type="button"
                  onClick={() => setShowCancelMenu((prev) => !prev)}
                  className="inline-flex items-center gap-1 hover:text-yellow-500"
                >
                  <span>Huỷ bỏ tất cả</span>
                  <ChevronDown size={16} />
                </button>

                {showCancelMenu && (
                  <div className="absolute right-0 mt-2 w-44 bg-dark-800 border border-dark-700 rounded shadow-md z-50">
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700"
                      onClick={() => { cancelFilteredOrders((o) => o.symbol === selectedSymbol); setShowCancelMenu(false); }}
                    >
                      Tất cả ({selectedSymbol})
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700"
                      onClick={() => { cancelFilteredOrders((o) => o.symbol === selectedSymbol && o.type === 'LIMIT'); setShowCancelMenu(false); }}
                    >
                      LIMIT
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700"
                      onClick={() => {
                        cancelFilteredOrders(
                          (o) => o.symbol === selectedSymbol &&
                            ['STOP', 'TAKE_PROFIT', 'STOP_MARKET', 'TAKE_PROFIT_MARKET'].includes(o.type)
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
            {openOrders.map((order) => {
              const limitPrice = isTriggerMarket(order.type)
                ? dash
                : toNumber(order.price) > 0 ? String(toNumber(order.price)) : dash;

              const triggerPrice =
                (isTriggerMarket(order.type) || isStopOrTpLimit(order.type)) && toNumber(order.stopPrice) > 0
                  ? String(toNumber(order.stopPrice))
                  : dash;

              const qty = fmt(order.origQty);
              const filled = fmt(order.executedQty);
              const when = order.updateTime || order.time;
              const timeStr = when ? new Date(when).toLocaleTimeString() : '--';

              return (
                <tr className="border-b border-dark-700" key={String(order.orderId)}>
                  <td className="px-4 py-3 text-white">{timeStr}</td>
                  <td className="px-4 py-3 text-white">{order.symbol}</td>
                  <td className="px-4 py-3 text-green-500 font-medium">{order.side === 'BUY' ? 'Mua' : 'Bán'}</td>
                  <td className="px-4 py-3 text-white">{order.type}</td>
                  <td className="px-4 py-3 text-white">{limitPrice}</td>
                  <td className="px-4 py-3 text-white">{triggerPrice}</td>
                  <td className="px-4 py-3 text-white">{mapWorkingType(order.workingType)}</td>
                  <td className="px-4 py-3 text-white">{qty}</td>
                  <td className="px-4 py-3 text-white">{filled}</td>
                  <td className="px-4 py-3 text-white">–</td>
                  <td className="px-4 py-3 text-white">Không</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-gray-400 hover:text-red-500"
                      onClick={() => cancelOrder(order)}
                      title="Huỷ lệnh"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}

            {openOrders.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-gray-400" colSpan={12}>
                  Không có lệnh mở.
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
