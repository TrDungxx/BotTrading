import React, { useEffect, useMemo, useState } from 'react';
import Position from '../tabposition/Position';
import OpenOrder from '../tabposition/OpenOrder';
import OrderHistoryPosition from '../tabposition/OrderHistoryPosition';
import TradeHistory from '../tabposition/TradeHistory';
import PositionRealizedProfitHistory from '../tabposition/PositionRealizedProfitHistory';

interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}
interface OrderBookEntry {
  price: string;
  quantity: string;
}
interface PositionData {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unrealizedProfit: string;
  margin: string;
}
type FloatingInfo = {
  symbol: string;
  pnl: number;
  roi: number;
  price: number;
  positionAmt: number;
};
interface PositionFunctionProps {
  positions: PositionData[];
  selectedSymbol: string;
  market: 'spot' | 'futures';
  orderBook: OrderBookData | null;
  onFloatingInfoChange?: React.Dispatch<React.SetStateAction<FloatingInfo | null>>;
}

const PositionFunction: React.FC<PositionFunctionProps> = ({
  positions,
  selectedSymbol,
  market,
  orderBook,
  onFloatingInfoChange, 
}) => {
  const [activeTab, setActiveTab] = useState<'position'|'openOrder'|'orderHistory'|'tradeHistory'|'pnlHistory'>('position');
  const [openOrderCount, setOpenOrderCount] = useState(0);
  const [positionCount, setPositionCount] = useState(0);

  // (tuỳ chọn) lấy số từ localStorage nếu bạn đã lưu openOrders
  useEffect(() => {
    try {
      const stored = localStorage.getItem('openOrders');
      if (stored) {
        const orders = JSON.parse(stored) as Array<{ status: string }>;
        setOpenOrderCount(orders.filter(o => o.status === 'NEW').length);
      }
    } catch {}
  }, []);

  const tabs = useMemo(() => ([
    { key: 'position',   label: 'Postion' },
    { key: 'openOrder',  label: 'OpenOrder' },
    { key: 'orderHistory', label: 'OrderHistoryPosition' },
    { key: 'tradeHistory', label: 'TradeHistory' },
    { key: 'pnlHistory',   label: 'PositionRealizedProfitHistory' },
  ] as const), []);

  const renderContent = () => {
    switch (activeTab) {
      case 'position':
        return (
          <Position
            market={market}
            onPositionCountChange={setPositionCount}
            onFloatingInfoChange={onFloatingInfoChange}  // 👈 truyền tiếp
          />
        );
      case 'openOrder':
        return (
          <OpenOrder
            selectedSymbol={selectedSymbol}
            market={market}
            // ☆☆☆ báo ngược số lệnh NEW lên tab
            onPendingCountChange={setOpenOrderCount}
          />
        );
      case 'orderHistory':
        return <OrderHistoryPosition />;
      case 'tradeHistory':
        return <TradeHistory />;
      case 'pnlHistory':
        return <PositionRealizedProfitHistory />;
      default:
        return null;
    }
  };

  return (
  <div className="w-full p-4">
    <div className="flex space-x-4 border-b border-dark-700 mb-4">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`py-2 px-4 text-sm font-medium border-b-2 ${
            activeTab === tab.key
              ? 'border-primary-500 text-primary-500'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveTab(tab.key)}
        >
          <span className="inline-flex items-center">
            {tab.label}
            {tab.key === 'position' && positionCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center text-[10px] leading-none px-1.5 py-[2px] rounded-full bg-primary-500/20 text-primary-300">
                {positionCount}
              </span>
            )}
            {tab.key === 'openOrder' && openOrderCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center text-[10px] leading-none px-1.5 py-[2px] rounded-full bg-primary-500/20 text-primary-300">
                {openOrderCount}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>

    <div>{renderContent()}</div>
  </div>
);
};

export default PositionFunction;
