import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Order } from '../../utils/types';

interface Props {
  openOrders: Order[];
  selectedSymbol: string;
  showCancelAllConfirm: boolean;
  setShowCancelAllConfirm: (val: boolean) => void;
  handleCancelAllOrders: () => void;
  openOrdersCount: number;
}

const OpenOrders: React.FC<Props> = ({
  openOrders,
  selectedSymbol,
  showCancelAllConfirm,
  setShowCancelAllConfirm,
  handleCancelAllOrders,
  openOrdersCount,
}) => {
  const filteredOrders = openOrders.filter(
  (order) => order.status === 'NEW'
);

  return (
    <div className="flex-1 border-r border-dark-700 overflow-y-auto">
      <div className="flex items-center justify-between p-3 border-b border-dark-700">
        <div className="flex items-center space-x-4">
          <h3 className="text-sm font-medium">Open Orders</h3>
          <span className="text-xs text-dark-400">({filteredOrders.length})</span>
        </div>
        {filteredOrders.length > 0 && (
          <button
            className="text-xs text-danger-500 hover:text-danger-400"
            onClick={() => setShowCancelAllConfirm(true)}
          >
            Cancel All
          </button>
        )}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="p-4 text-center text-dark-400">
          <div className="text-sm">No open orders</div>
          <div className="text-xs mt-1">Your open orders will appear here</div>
        </div>
      ) : (
        <div className="text-xs p-2 overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-dark-400 border-b border-dark-700">
              <tr>
                <th className="py-1">Side</th>
                <th className="py-1">Type</th>
                <th className="py-1">Price</th>
                <th className="py-1">Amount</th>
                <th className="py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.orderId} className="border-b border-dark-800 hover:bg-dark-800">
                  <td className={`py-1 font-bold ${order.side === 'BUY' ? 'text-success-500' : 'text-danger-500'}`}>
                    {order.side}
                  </td>
                  <td className="py-1">{order.type}</td>
                  <td className="py-1">{order.price}</td>
                  <td className="py-1">{order.origQty}</td>
                  <td className="py-1">{order.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
        </div>
      )}

      {showCancelAllConfirm && (
        <div className="fixed inset-0 bg-dark-900/80 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-danger-500/10 mx-auto mb-4">
                <AlertTriangle className="h-6 w-6 text-danger-500" />
              </div>
              <h3 className="text-lg font-medium text-center text-danger-600 mb-2">
                Xác nhận hủy tất cả lệnh
              </h3>
              <p className="text-dark-400 text-center mb-6">
                Bạn có chắc chắn muốn{' '}
                <span className="text-danger-500 font-semibold">hủy toàn bộ lệnh đang mở</span> cho cặp{' '}
                <span className="text-white font-semibold">{selectedSymbol}</span>?
              </p>
              <div className="flex justify-center space-x-3">
                <button className="btn btn-outline" onClick={() => setShowCancelAllConfirm(false)}>
                  Hủy
                </button>
                <button
                  className="btn bg-danger-500 hover:bg-danger-700 text-white"
                  onClick={handleCancelAllOrders}
                >
                  Xác nhận hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpenOrders;
