import React, { useEffect, useState } from 'react';
import { binanceWS } from '../binancewebsocket/BinanceWebSocketService';

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

  useEffect(() => {
    const stored = localStorage.getItem('openOrders');
    if (stored) {
      setOpenOrders(JSON.parse(stored));
    }

    // Gắn callback nhận realtime order update
    binanceWS.setOrderUpdateHandler((orders: Order[]) => {
      setOpenOrders(orders.filter((o) => o.status === 'NEW')); // chỉ giữ lệnh đang mở
    });
  }, []);

  const handleCancel = (orderId: number) => {
    binanceWS.send({
      action: 'cancelOrder',
      symbol: selectedSymbol,
      orderId,
      market,
    });
  };

  return (
    <div className="card">
      <div className="card-header text-fluid-base font-semibold text-white">
        Open Orders
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
              <th className="px-fluid-4 py-2">Số lượng</th>
              <th className="px-fluid-4 py-2">Đã khớp</th>
              <th className="px-fluid-4 py-2">TP/SL</th>
              <th className="px-fluid-4 py-2">Giảm chỉ</th>
              <th className="px-fluid-4 py-2">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {openOrders.map((order) => (
              <tr key={order.orderId} className="border-b border-dark-700">
                <td className="px-fluid-4 py-fluid-3 text-white">–</td>
                <td className="px-fluid-4 py-fluid-3 text-white">{order.symbol}</td>
                <td className="px-fluid-4 py-fluid-3 text-green-500 font-medium">{order.side === 'BUY' ? 'Mua' : 'Bán'}</td>
                <td className="px-fluid-4 py-fluid-3 text-white">{order.type}</td>
                <td className="px-fluid-4 py-fluid-3 text-white">{order.price}</td>
                <td className="px-fluid-4 py-fluid-3 text-white">–</td>
                <td className="px-fluid-4 py-fluid-3 text-white">{order.origQty}</td>
                <td className="px-fluid-4 py-fluid-3 text-white">0.000</td>
                <td className="px-fluid-4 py-fluid-3 text-white">–</td>
                <td className="px-fluid-4 py-fluid-3 text-white">Không</td>
                <td className="px-fluid-4 py-fluid-3">
                  <button
                    onClick={() => handleCancel(order.orderId)}
                    className="text-[#f6465d] text-fluid-sm hover:underline"
                  >
                    Hủy
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