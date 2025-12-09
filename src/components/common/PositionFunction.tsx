import React, { useEffect, useMemo, useState } from 'react';
import Position from '../tabposition/Position';
import PositionMobile from '../tabposition/function/PositionMobile';
import OpenOrder from '../tabposition/OpenOrder';
import OrderHistoryPosition from '../tabposition/OrderHistoryPosition';
import TradeHistory from '../tabposition/TradeHistory';
import PositionRealizedProfitHistory from '../tabposition/PositionRealizedProfitHistory';
import {
  OPEN_ORDERS_LS_KEY,
  OPEN_ORDERS_EVENT,
  POSITIONS_LS_KEY,
  POSITIONS_EVENT,
} from '../binancewebsocket/BinanceWebSocketService';

function readPositionsLS(): any[] {
  try {
    return JSON.parse(localStorage.getItem(POSITIONS_LS_KEY) || '[]');
  } catch {
    return [];
  }
}
function writePositionsLS(list: any[]) {
  localStorage.setItem(POSITIONS_LS_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(POSITIONS_EVENT, { detail: { list } }));
}

const norm = (s?: string) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function countPositions(symbol?: string) {
  try {
    const want = norm(symbol);
    const list = JSON.parse(
      localStorage.getItem(POSITIONS_LS_KEY) || '[]'
    ) as Array<{ symbol: string; positionAmt: string }>;
    return list.filter((p) => {
      const amt = parseFloat(p.positionAmt ?? '0');
      return amt !== 0 && (!symbol || norm(p.symbol) === want);
    }).length;
  } catch {
    return 0;
  }
}

function countPending() {
  try {
    const list = JSON.parse(
      localStorage.getItem(OPEN_ORDERS_LS_KEY) || '[]'
    ) as Array<{ status: string; _optimistic?: boolean; orderId?: string | number }>;
    
    // ✅ Chỉ đếm order THẬT (không phải optimistic)
    return list.filter((o) => 
      o.status === 'NEW' && 
      !o._optimistic && 
      !String(o.orderId || '').startsWith('tmp_')
    ).length;
  } catch {
    return 0;
  }
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
  const [activeTab, setActiveTab] = useState<
    'position' | 'openOrder' | 'orderHistory' | 'tradeHistory' | 'pnlHistory'
  >('position');
  const [openOrderCount, setOpenOrderCount] = useState(0);
  const [positionCount, setPositionCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // ✅ Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Position count tracking
  useEffect(() => {
    setPositionCount(countPositions(selectedSymbol));

    const onBus = (e: any) => {
      const list = (e?.detail?.list ?? null) as Array<{
        symbol: string;
        positionAmt: string;
      }> | null;
      if (Array.isArray(list)) {
        const n = list.filter((p) => {
          const amt = parseFloat(p.positionAmt ?? '0');
          return amt !== 0 && (!selectedSymbol || p.symbol === selectedSymbol);
        }).length;
        setPositionCount(n);
      } else {
        setPositionCount(countPositions(selectedSymbol));
      }
    };
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === POSITIONS_LS_KEY)
        setPositionCount(countPositions(selectedSymbol));
    };

    window.addEventListener(POSITIONS_EVENT, onBus as any);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(POSITIONS_EVENT, onBus as any);
      window.removeEventListener('storage', onStorage);
    };
  }, [selectedSymbol]);

  // Open orders count tracking
  useEffect(() => {
  setOpenOrderCount(countPending());  // ✅ Không truyền symbol

  const onBus = (e: any) => {
    const list = e?.detail?.list;
    if (Array.isArray(list)) {
      // ✅ Chỉ đếm order THẬT
      const realOrders = list.filter((o: any) => 
        o.status === 'NEW' && 
        !o._optimistic && 
        !String(o.orderId || '').startsWith('tmp_')
      );
      setOpenOrderCount(realOrders.length);
    } else {
      setOpenOrderCount(countPending());
    }
  };
  
  const onStorage = (ev: StorageEvent) => {
    if (ev.key === OPEN_ORDERS_LS_KEY) setOpenOrderCount(countPending());
  };

  window.addEventListener(OPEN_ORDERS_EVENT, onBus as any);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(OPEN_ORDERS_EVENT, onBus as any);
    window.removeEventListener('storage', onStorage);
  };
}, []);

  const tabs = useMemo(
    () =>
      [
        { key: 'position', label: 'Position' },
        { key: 'openOrder', label: 'Orders' },
        { key: 'orderHistory', label: 'History' },
        { key: 'tradeHistory', label: 'Trades' },
        { key: 'pnlHistory', label: 'PnL' },
      ] as const,
    []
  );

  // ✅ Render content - sử dụng PositionMobile khi mobile và tab là position
  const renderContent = () => {
    switch (activeTab) {
      case 'position':
        // ✅ Render mobile hoặc desktop component
        if (isMobile) {
          return (
            <PositionMobile
              positions={positions}
              market={market}
              onTpSlClick={(pos) => {
                // Handle TP/SL modal - bạn có thể emit event hoặc callback
                console.log('TP/SL clicked:', pos);
              }}
              onAdvancedClick={(pos) => {
                // Handle advanced tool
                const size = parseFloat(pos.positionAmt || '0');
                if (!size) return;
                const side = (size > 0 ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT';
                const payload = {
                  positionId: `${pos.symbol}:${(pos as any).positionSide ?? side}`,
                  symbol: pos.symbol,
                  side,
                  entry: parseFloat(pos.entryPrice || '0'),
                };
                try {
                  localStorage.setItem('activeTool', JSON.stringify(payload));
                } catch {}
                window.dispatchEvent(
                  new CustomEvent('chart-symbol-change-request', {
                    detail: { symbol: pos.symbol },
                  })
                );
                setTimeout(() => {
                  window.dispatchEvent(
                    new CustomEvent('active-tool-changed', {
                      detail: payload,
                    })
                  );
                }, 300);
              }}
              onCloseMarket={(pos) => {
                console.log('Close market:', pos);
                // Implement close logic
              }}
              onCloseLimit={(pos) => {
                console.log('Close limit:', pos);
                // Implement close logic
              }}
              onCloseAll={() => {
                console.log('Close all');
                // Implement close all logic
              }}
              onCloseByPnl={() => {
                console.log('Close by PnL');
                // Implement close by PnL logic
              }}
            />
          );
        }
        return (
          <Position
            market={market}
            onPositionCountChange={setPositionCount}
            onFloatingInfoChange={onFloatingInfoChange}
          />
        );
      case 'openOrder':
        return (
          <OpenOrder
            selectedSymbol={selectedSymbol}
            market={market}
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

  // ✅ Mobile: Render tabs inside PositionMobile component
  if (isMobile) {
    return (
      <div className="w-full max-w-full overflow-hidden">
        {/* Mobile tabs integrated inside PositionMobile */}
        <div className="position-mobile-wrapper">
          {/* Tabs */}
          <div className="position-mobile-tabs sticky top-0 z-10 bg-dark-900 border-b border-dark-700">
            <div className="flex overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-shrink-0 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-primary-500 text-primary-400'
                      : 'border-transparent text-dark-400 hover:text-dark-200'
                  }`}
                >
                  {tab.label}
                  {tab.key === 'position' && positionCount > 0 && (
                    <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-primary-500/20 text-primary-300">
                      {positionCount}
                    </span>
                  )}
                  {tab.key === 'openOrder' && openOrderCount > 0 && (
                    <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-primary-500/20 text-primary-300">
                      {openOrderCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="position-mobile-content">{renderContent()}</div>
        </div>
      </div>
    );
  }

  // ✅ Desktop: Original layout
  return (
    <div className="w-full max-w-full overflow-hidden p-1.5 sm:p-3">
      <div className="flex space-x-1.5 sm:space-x-3  border-b border-dark-700 mb-2 sm:mb-4 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`py-1.5 px-1.5 sm:px-2 md:px-3 text-[10px] sm:text-xs font-medium border-b-2 whitespace-nowrap flex-shrink-0 ${
              activeTab === tab.key
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="inline-flex items-center">
              {tab.label}
              {tab.key === 'position' && positionCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center text-[8px] leading-none px-1 py-[1px] rounded-full bg-primary-500/20 text-primary-300">
                  {positionCount}
                </span>
              )}
              {tab.key === 'openOrder' && openOrderCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center text-[8px] leading-none px-1 py-[1px] rounded-full bg-primary-500/20 text-primary-300">
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