import React, { useEffect, useState } from 'react';
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
}

const OpenOrder: React.FC<OpenOrderProps> = ({ selectedSymbol, market }) => {
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [showCancelMenu, setShowCancelMenu] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('openOrders');
    if (stored) {
      setOpenOrders(JSON.parse(stored));
    }

    binanceWS.setOrderUpdateHandler((orders: Order[]) => {
      setOpenOrders(orders.filter((o) => o.status === 'NEW'));
    });
  }, []);

  const cancelOrder = (order: Order) => {
    binanceWS.send({
      action: 'cancelOrder',
      symbol: order.symbol,
      orderId: order.orderId,
      market,
    });
  };

  const cancelFilteredOrders = (filterFn: (o: Order) => boolean) => {
    const filtered = openOrders.filter(filterFn);
    filtered.forEach(cancelOrder);
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between px-4 mb-2">
        <div className="text-yellow-400 text-sm font-semibold relative">
          
        </div>
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
              <th className="px-4 py-2">Số lượng</th>
              <th className="px-4 py-2">Đã khớp</th>
              <th className="px-4 py-2">TP/SL</th>
              <th className="px-4 py-2">Giảm chỉ</th>
              <button
            onClick={() => setShowCancelMenu((prev) => !prev)}
            className="px-4 py-2 flex items-center space-x-1 hover:text-yellow-500"
          >
            <span>Huỷ bỏ tất cả</span>
            <ChevronDown size={16} />
          </button>
          {showCancelMenu && (
            <div className="absolute mt-2 w-40 bg-dark-800 border border-dark-700 rounded shadow-md z-50">
              <button
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700"
                onClick={() => {
                  cancelFilteredOrders((o) => o.symbol === selectedSymbol);
                  setShowCancelMenu(false);
                }}
              >
                Tất cả
              </button>
              <button
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700"
                onClick={() => {
                  cancelFilteredOrders((o) => o.symbol === selectedSymbol && o.type === 'LIMIT');
                  setShowCancelMenu(false);
                }}
              >
                LIMIT
              </button>
              <button
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
            </tr>
          </thead>
          <tbody>
            {openOrders.map((order) => (
              <tr className="border-b border-dark-700" key={order.orderId}>
                <td className="px-4 py-3 text-white">--</td>
                <td className="px-4 py-3 text-white">{order.symbol}</td>
                <td className="px-4 py-3 text-green-500 font-medium">{order.side === 'BUY' ? 'Mua' : 'Bán'}</td>
                <td className="px-4 py-3 text-white">{order.type}</td>
                <td className="px-4 py-3 text-white">{order.price}</td>
                <td className="px-4 py-3 text-white">–</td>
                <td className="px-4 py-3 text-white">{order.origQty}</td>
                <td className="px-4 py-3 text-white">0</td>
                <td className="px-4 py-3 text-white">–</td>
                <td className="px-4 py-3 text-white">Không</td>
                <td className="px-4 py-3">
                  <button
                    className="text-gray-400 hover:text-red-500"
                    onClick={() => cancelOrder(order)}
                    title="Huỷ lệnh"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OpenOrder;