import React, { useEffect, useMemo, useRef, useState } from 'react';
import { binanceWS } from '../binancewebsocket/BinanceWebSocketService';
import { Trash2, ChevronDown } from 'lucide-react';

interface Order {
  orderId: number;
  symbol: string;
  side: string;
  type: string;
  price: string | number;
  origQty: string | number;
  status: string;
}

interface OpenOrderProps {
  selectedSymbol: string;
  market: 'spot' | 'futures';
  onPendingCountChange?: (n: number) => void;
}

const OpenOrder: React.FC<OpenOrderProps> = ({ selectedSymbol, market,onPendingCountChange }) => {
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [showCancelMenu, setShowCancelMenu] = useState(false);

  // --- handler nhận dữ liệu orders từ WS (server có thể trả về mảng orders hoặc ORDER_TRADE_UPDATE) ---
  useEffect(() => {
    binanceWS.setOrderUpdateHandler((orders: any[]) => {
      if (Array.isArray(orders)) {
        localStorage.setItem('openOrders', JSON.stringify(orders));
        const pending = orders.filter((o: Order) => o.status === 'NEW');
        setOpenOrders(pending);
        onPendingCountChange?.(pending.length); // <-- báo số lượng
      }
    });

    // init từ localStorage
    const stored = localStorage.getItem('openOrders');
    if (stored) {
      try {
        const parsed: Order[] = JSON.parse(stored);
        const pending = parsed.filter((o) => o.status === 'NEW');
        setOpenOrders(pending);
        onPendingCountChange?.(pending.length); // <-- báo số lượng
      } catch {}
    }

    return () => {
      binanceWS.setOrderUpdateHandler(null);
    };
  }, [onPendingCountChange]);

  // --- gửi lấy OpenOrders mỗi khi market hoặc symbol đổi (debounce nhẹ) ---
  const debounceTimer = useRef<number | null>(null);
  useEffect(() => {
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      // lấy theo market hiện tại, nếu muốn lọc symbol đang chọn thì truyền vào
      // (nếu muốn luôn lấy all symbol thì bỏ selectedSymbol)
      if (selectedSymbol) {
        binanceWS.getOpenOrders(market, selectedSymbol);
      } else {
        binanceWS.getOpenOrders(market);
      }
    }, 250);

    return () => {
      if (debounceTimer.current) {
        window.clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, [market, selectedSymbol]);

  // --- huỷ 1 lệnh ---
  const cancelOrder = (order: Order) => {
    binanceWS.cancelOrder(order.symbol, order.orderId, market);
  };

  // --- huỷ nhiều lệnh theo filter ---
  const cancelFilteredOrders = (filterFn: (o: Order) => boolean) => {
    const filtered = openOrders.filter(filterFn);
    filtered.forEach(cancelOrder);
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
              <th className="px-4 py-2" scope="col">Thời gian</th>
              <th className="px-4 py-2" scope="col">Cặp</th>
              <th className="px-4 py-2" scope="col">Loại</th>
              <th className="px-4 py-2" scope="col">Phương thức</th>
              <th className="px-4 py-2" scope="col">Giá</th>
              <th className="px-4 py-2" scope="col">Giá kích hoạt</th>
              <th className="px-4 py-2" scope="col">Số lượng</th>
              <th className="px-4 py-2" scope="col">Đã khớp</th>
              <th className="px-4 py-2" scope="col">TP/SL</th>
              <th className="px-4 py-2" scope="col">Giảm chỉ</th>

              {/* Cột thao tác (dropdown Huỷ tất cả) */}
              <th className="px-4 py-2 text-right relative" scope="col">
                <button
                  type="button"
                  onClick={() => setShowCancelMenu(prev => !prev)}
                  className="inline-flex items-center gap-1 hover:text-yellow-500"
                >
                  <span>Huỷ bỏ tất cả</span>
                  <ChevronDown size={16} />
                </button>

                {showCancelMenu && (
                  <div className="absolute right-0 mt-2 w-40 bg-dark-800 border border-dark-700 rounded shadow-md z-50">
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700"
                      onClick={() => {
                        cancelFilteredOrders((o) => o.symbol === selectedSymbol);
                        setShowCancelMenu(false);
                      }}
                    >
                      Tất cả
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700"
                      onClick={() => {
                        cancelFilteredOrders((o) => o.symbol === selectedSymbol && o.type === 'LIMIT');
                        setShowCancelMenu(false);
                      }}
                    >
                      LIMIT
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700"
                      onClick={() => {
                        cancelFilteredOrders((o) =>
                          o.symbol === selectedSymbol &&
                          ['STOP', 'STOP_MARKET', 'TAKE_PROFIT_MARKET'].includes(o.type)
                        );
                        setShowCancelMenu(false);
                      }}
                    >
                      Stop-Limit
                    </button>
                  </div>
                )}
              </th>
            </tr>
          </thead>

          <tbody>
            {openOrders.map((order) => (
              <tr className="border-b border-dark-700" key={order.orderId}>
                <td className="px-4 py-3 text-white">--</td>
                <td className="px-4 py-3 text-white">{order.symbol}</td>
                <td className="px-4 py-3 text-green-500 font-medium">
                  {order.side === 'BUY' ? 'Mua' : 'Bán'}
                </td>
                <td className="px-4 py-3 text-white">{order.type}</td>
                <td className="px-4 py-3 text-white">{order.price}</td>
                <td className="px-4 py-3 text-white">–</td>
                <td className="px-4 py-3 text-white">{order.origQty}</td>
                <td className="px-4 py-3 text-white">0</td>
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
            ))}

            {openOrders.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-gray-400" colSpan={11}>
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
