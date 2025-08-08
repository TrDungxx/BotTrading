import React, { useState } from 'react';
import Position from '../tabposition/Position'
import OpenOrder from '../tabposition/OpenOrder';
import OrderHistoryPosition from '../tabposition/OrderHistoryPosition';
import TradeHistory from '../tabposition/TradeHistory';
import PositionRealizedProfitHistory from '../tabposition/PositionRealizedProfitHistory';


interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}
interface PositionData {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unrealizedProfit: string;
  margin: string;
}

interface PositionFunctionProps {
  positions: PositionData[];
  selectedSymbol: string;
  market: 'spot' | 'futures';
  orderBook: OrderBookData | null;
}
interface OrderBookEntry {
  price: string;
  quantity: string;
}
const TABS = [
  { key: 'position', label: 'Postion' },
  { key: 'openOrder', label: 'OpenOrder' },
  { key: 'orderHistory', label: 'OrderHistoryPosition' },
  { key: 'tradeHistory', label: 'TradeHistory' },
  { key: 'pnlHistory', label: 'PositionRealizedProfitHistory' }
];

const PositionFunction: React.FC<PositionFunctionProps> = ({
  positions,
  selectedSymbol,
  market,
  orderBook,
}) => {
  const [activeTab, setActiveTab] = useState('position');

  const renderContent = () => {
    switch (activeTab) {
      case 'position':
        return (
          <Position
            
            
            market={market}
           
          />
        );
      case 'openOrder':
  return <OpenOrder selectedSymbol={selectedSymbol} market={market} />;
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
      {/* Tabs */}
      <div className="flex space-x-4 border-b border-dark-700 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`py-2 px-4 text-sm font-medium border-b-2 ${
              activeTab === tab.key
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>{renderContent()}</div>
    </div>
  );
};

export default PositionFunction;
