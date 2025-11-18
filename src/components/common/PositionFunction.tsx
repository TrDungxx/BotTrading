import React, { useEffect, useMemo, useState } from 'react';
import Position from '../tabposition/Position';
import OpenOrder from '../tabposition/OpenOrder';
import OrderHistoryPosition from '../tabposition/OrderHistoryPosition';
import TradeHistory from '../tabposition/TradeHistory';
import PositionRealizedProfitHistory from '../tabposition/PositionRealizedProfitHistory';
import {  OPEN_ORDERS_LS_KEY,
  OPEN_ORDERS_EVENT,
  POSITIONS_LS_KEY,
  POSITIONS_EVENT, } from '../binancewebsocket/BinanceWebSocketService';




function readPositionsLS(): any[] {
  try { return JSON.parse(localStorage.getItem(POSITIONS_LS_KEY) || '[]'); }
  catch { return []; }
}
function writePositionsLS(list: any[]) {
  localStorage.setItem(POSITIONS_LS_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(POSITIONS_EVENT, { detail: { list } }));
}

const norm = (s?: string) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function countPositions(symbol?: string) {
  try {
    const want = norm(symbol);
    const list = JSON.parse(localStorage.getItem(POSITIONS_LS_KEY) || '[]') as Array<{symbol:string; positionAmt:string}>;
    return list.filter(p => {
      const amt = parseFloat(p.positionAmt ?? '0');
      return amt !== 0 && (!symbol || norm(p.symbol) === want);
    }).length;
  } catch { return 0; }
}

function countPending(symbol?: string) {
  try {
    const list = JSON.parse(localStorage.getItem(OPEN_ORDERS_LS_KEY) || '[]') as Array<{symbol:string; status:string}>;
    return list.filter(o => o.status === 'NEW' && (!symbol || o.symbol === symbol)).length;
  } catch { return 0; }
}
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

  useEffect(() => {
  // init ngay khi render hoặc khi đổi symbol
  setPositionCount(countPositions(selectedSymbol));

  const onBus = (e: any) => {
    const list = (e?.detail?.list ?? null) as Array<{symbol:string; positionAmt:string}> | null;
    if (Array.isArray(list)) {
      const n = list.filter(p => {
        const amt = parseFloat(p.positionAmt ?? '0');
        return amt !== 0 && (!selectedSymbol || p.symbol === selectedSymbol);
      }).length;
      setPositionCount(n);
    } else {
      setPositionCount(countPositions(selectedSymbol));
    }
  };
  const onStorage = (ev: StorageEvent) => {
    if (ev.key === POSITIONS_LS_KEY) setPositionCount(countPositions(selectedSymbol));
  };

  window.addEventListener(POSITIONS_EVENT, onBus as any);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(POSITIONS_EVENT, onBus as any);
    window.removeEventListener('storage', onStorage);
  };
}, [selectedSymbol]);


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
  { key: 'position',   label: 'Position' },
  { key: 'openOrder',  label: 'Orders' },
  { key: 'orderHistory', label: 'History' },
  { key: 'tradeHistory', label: 'Trades' },
  { key: 'pnlHistory',   label: 'PnL' },
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
useEffect(() => {
  // init ngay khi render hoặc khi đổi symbol
  setOpenOrderCount(countPending(selectedSymbol));

  const onBus = (e: any) => {
    const list = (e?.detail?.list ?? null) as Array<{symbol:string; status:string}> | null;
    if (Array.isArray(list)) {
      const n = list.filter(o => o.status === 'NEW' && (!selectedSymbol || o.symbol === selectedSymbol)).length;
      setOpenOrderCount(n);
    } else {
      setOpenOrderCount(countPending(selectedSymbol));
    }
  };
  const onStorage = (ev: StorageEvent) => {
    if (ev.key === OPEN_ORDERS_LS_KEY) setOpenOrderCount(countPending(selectedSymbol));
  };

  window.addEventListener(OPEN_ORDERS_EVENT, onBus as any);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(OPEN_ORDERS_EVENT, onBus as any);
    window.removeEventListener('storage', onStorage);
  };
}, [selectedSymbol]);

  

  return (
  <div className="w-full max-w-full overflow-hidden p-2 sm:p-4">
  <div className="flex space-x-2 sm:space-x-4 border-b border-dark-700 mb-2 sm:mb-4 overflow-x-auto scrollbar-hide">
      {tabs.map((tab) => (
        <button
          key={tab.key}
           className={`py-2 px-2 sm:px-3 md:px-4 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap flex-shrink-0 ${
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
