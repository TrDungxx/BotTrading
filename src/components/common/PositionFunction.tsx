import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
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
  binanceWS,
} from '../binancewebsocket/BinanceWebSocketService';
import { binancePublicWS } from '../binancewebsocket/binancePublicWS';
import FullscreenPositionModal, { ExpandIcon } from '../common/tabpositionfunction/FullscreenPositionModal';
import PositionTpSlModal from '../tabposition/function/PositionTpSlModal';
import ClosePositionModal from '../popupposition/ClosePositionConfirmModal';
import CloseAllPositionsModal from '../popupposition/CloseAllPositionsModal';
import RiskConfigModal from '../tabposition/dropdownfilter/RiskConfigModal';
import { createPortal } from 'react-dom';
import { PositionData } from '../../utils/types';

function readPositionsLS(): any[] {
  try {
    return JSON.parse(localStorage.getItem(POSITIONS_LS_KEY) || '[]');
  } catch {
    return [];
  }
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
  binanceAccountId: number | null;  // ✅ THÊM DÒNG NÀY
  onSymbolClick?: (symbol: string) => void;  // ✅ THÊM cho việc click symbol switch chart
}

// ===== Helper functions =====
const toNumUndef = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const roundToStep = (qty: number, step: number) => {
  if (step <= 0) return qty;
  const precision = Math.max(0, (step.toString().split('.')[1] || '').length);
  return Number((Math.floor(qty / step) * step).toFixed(precision));
};

const getStepSize = (symbol: string) => {
  // Có thể load từ exchangeInfo hoặc hardcode một số common symbols
  const stepMap: Record<string, number> = {
    'BTCUSDT': 0.001,
    'ETHUSDT': 0.001,
    'DOGEUSDT': 1,
    'XRPUSDT': 0.1,
  };
  return stepMap[symbol] ?? 0.001;
};

const getPriceTick = (symbol: string) => {
  const tickMap: Record<string, number> = {
    'BTCUSDT': 0.1,
    'ETHUSDT': 0.01,
    'DOGEUSDT': 0.00001,
    'XRPUSDT': 0.0001,
  };
  return tickMap[symbol] ?? 0.0001;
};

const PositionFunction: React.FC<PositionFunctionProps> = ({
  positions,
  selectedSymbol,
  market,
  orderBook,
  onFloatingInfoChange,
  binanceAccountId,    
  onSymbolClick,  
}) => {
  const [activeTab, setActiveTab] = useState<
    'position' | 'openOrder' | 'orderHistory' | 'tradeHistory' | 'pnlHistory'
  >('position');
  const [openOrderCount, setOpenOrderCount] = useState(0);
  const [positionCount, setPositionCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ✅ THÊM: State để sync hideOtherSymbols giữa Position và OpenOrder
  const [hideOtherSymbols, setHideOtherSymbols] = useState(false);

  // ✅ NEW: Real-time mark prices từ Binance Public WS
  const [markPrices, setMarkPrices] = useState<Record<string, number>>({});
  
  // ✅ NEW: Open orders để hiển thị TP/SL
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  
  // ✅ NEW: Modal states cho mobile
  const [showTpSlModal, setShowTpSlModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showCloseAllModal, setShowCloseAllModal] = useState(false);
  const [showRiskConfig, setShowRiskConfig] = useState(false);
  const [activePosition, setActivePosition] = useState<PositionData | null>(null);
  const [closeMode, setCloseMode] = useState<'market' | 'limit'>('market');

  // Track subscribed symbols
  const subscribedSymbolsRef = useRef<Set<string>>(new Set());

  // ✅ Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ✅ Subscribe Mark Price cho các positions (chỉ trên mobile)
  useEffect(() => {
    if (!isMobile || market !== 'futures') return;

    const activePositions = positions.filter(
      (p) => Math.abs(Number(p.positionAmt || 0)) > 0.000001
    );
    const symbolsNeeded = new Set(activePositions.map((p) => p.symbol));
    const currentSubs = subscribedSymbolsRef.current;

    // Subscribe new symbols
    symbolsNeeded.forEach((symbol) => {
      if (currentSubs.has(symbol)) return;
      
      binancePublicWS.subscribeMarkPrice(symbol, (rawPrice: string) => {
        const price = Number(rawPrice);
        if (Number.isFinite(price)) {
          setMarkPrices((prev) => ({ ...prev, [symbol]: price }));
        }
      });
      currentSubs.add(symbol);
    });

    // Unsubscribe removed symbols
    currentSubs.forEach((symbol) => {
      if (!symbolsNeeded.has(symbol)) {
        binancePublicWS.unsubscribeMarkPrice(symbol);
        currentSubs.delete(symbol);
      }
    });

    return () => {
      // Cleanup on unmount
      currentSubs.forEach((symbol) => {
        binancePublicWS.unsubscribeMarkPrice(symbol);
      });
      subscribedSymbolsRef.current.clear();
    };
  }, [positions, isMobile, market]);

  // ✅ Load và listen Open Orders
  useEffect(() => {
    const loadOrders = () => {
      try {
        const orders = JSON.parse(localStorage.getItem(OPEN_ORDERS_LS_KEY) || '[]');
        setOpenOrders(orders.filter((o: any) => o.status === 'NEW'));
      } catch {
        setOpenOrders([]);
      }
    };

    loadOrders();

    const onOrdersUpdate = (e: any) => {
      const list = e?.detail?.list;
      if (Array.isArray(list)) {
        setOpenOrders(list.filter((o: any) => o.status === 'NEW'));
      } else {
        loadOrders();
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === OPEN_ORDERS_LS_KEY) loadOrders();
    };

    window.addEventListener(OPEN_ORDERS_EVENT, onOrdersUpdate as any);
    window.addEventListener('storage', onStorage);
    
    return () => {
      window.removeEventListener(OPEN_ORDERS_EVENT, onOrdersUpdate as any);
      window.removeEventListener('storage', onStorage);
    };
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
    setOpenOrderCount(countPending());

    const onBus = (e: any) => {
      const list = e?.detail?.list;
      if (Array.isArray(list)) {
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

  // ===== CALLBACKS CHO MOBILE =====
  
  // Wait for cancel ack
  const waitForCancelAck = useCallback((symbol: string, timeoutMs = 800) => {
    return new Promise<void>((resolve) => {
      const handler = (m: any) => {
        if (m && m.symbol === symbol && typeof m.canceledOrders === 'number') {
          binanceWS.removeMessageHandler(handler);
          resolve();
        }
      };
      binanceWS.onMessage(handler);
      setTimeout(() => {
        binanceWS.removeMessageHandler(handler);
        resolve();
      }, timeoutMs);
    });
  }, []);

  // ✅ Close Market - Mở popup confirm (dùng ClosePositionModal với mode="market")
  const handleCloseMarketClick = useCallback((pos: PositionData) => {
    setActivePosition(pos);
    setCloseMode('market');
    setShowCloseModal(true);
  }, []);

  // ✅ Thực hiện Close Market sau khi confirm
  const handleCloseMarket = useCallback(async (pos: PositionData) => {
    const rawSize = Number(pos.positionAmt || 0);
    if (!Number.isFinite(rawSize) || rawSize === 0) return;

    const symbol = pos.symbol;
    const side = rawSize > 0 ? 'SELL' : 'BUY';
    const positionSide = (rawSize > 0 ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT';
    const step = getStepSize(symbol);
    const qty = roundToStep(Math.abs(rawSize), step);

    if (qty <= 0) return;

    try {
      // Cancel existing orders first
      await binanceWS.cancelAllOrders(symbol, 'futures');
      await waitForCancelAck(symbol, 800);

      // Place market order
      await binanceWS.placeOrder({
        symbol,
        market: 'futures',
        type: 'MARKET',
        side: side as 'BUY' | 'SELL',
        positionSide,
        quantity: qty,
      });
    } catch (e: any) {
      console.error('Close market error:', e);
      const msg = String(e?.message || '').toLowerCase();
      
      // Retry without positionSide if hedge mode error
      if (msg.includes('position side') && msg.includes('not match')) {
        try {
          await binanceWS.placeOrder({
            symbol,
            market: 'futures',
            type: 'MARKET',
            side: side as 'BUY' | 'SELL',
            quantity: qty,
          });
        } catch (e2) {
          console.error('Close market retry error:', e2);
        }
      }
    }
  }, [waitForCancelAck]);

  // ✅ Close Limit - Mở modal
  const handleCloseLimit = useCallback((pos: PositionData) => {
    setActivePosition(pos);
    setCloseMode('limit');
    setShowCloseModal(true);
  }, []);

  // ✅ Close All
  const handleCloseAll = useCallback(async () => {
    const activePositions = positions.filter(
      (p) => Math.abs(Number(p.positionAmt || 0)) > 0.000001
    );

    for (const pos of activePositions) {
      await handleCloseMarket(pos);
    }
  }, [positions, handleCloseMarket]);

  // ✅ Close by PnL (đóng positions có lãi > 5%) - với confirm
  const handleCloseByPnl = useCallback(async () => {
    const activePositions = positions.filter(
      (p) => Math.abs(Number(p.positionAmt || 0)) > 0.000001
    );

    // Tìm các positions có lãi > 5%
    const profitablePositions = activePositions.filter((pos) => {
      const entry = Number(pos.entryPrice || 0);
      const qty = Number(pos.positionAmt || 0);
      const mark = markPrices[pos.symbol] || Number(pos.markPrice || 0);
      
      if (!entry || !qty || !mark) return false;
      
      const pnl = qty * (mark - entry);
      const leverage = Number((pos as any).leverage || 1);
      const margin = (Math.abs(qty) * entry) / leverage;
      const pnlPercent = margin ? (pnl / margin) * 100 : 0;

      return pnlPercent > 5;
    });

    if (profitablePositions.length === 0) {
      alert('Không có vị thế nào có lợi nhuận > 5%');
      return;
    }

    const confirmed = window.confirm(
      `Đóng ${profitablePositions.length} vị thế có lợi nhuận > 5%?\n\n` +
      profitablePositions.map(p => `• ${p.symbol}`).join('\n')
    );

    if (!confirmed) return;

    for (const pos of profitablePositions) {
      await handleCloseMarket(pos);
    }
  }, [positions, markPrices, handleCloseMarket]);

  // ✅ TP/SL Click - Mở modal
  const handleTpSlClick = useCallback((pos: PositionData) => {
    setActivePosition(pos);
    setShowTpSlModal(true);
  }, []);

  // ✅ Advanced Click - Mở RiskConfigModal
  const handleAdvancedClick = useCallback((pos: PositionData) => {
    setActivePosition(pos);
    setShowRiskConfig(true);
  }, []);

  // ✅ Symbol Click - Chuyển chart sang symbol đó
  const handleSymbolClick = useCallback((symbol: string) => {
    window.dispatchEvent(
      new CustomEvent('chart-symbol-change-request', {
        detail: { symbol },
      })
    );
  }, []);

  // ✅ Confirm close from modal
  const handleConfirmClose = useCallback(async (p: {
    type: 'MARKET' | 'LIMIT';
    symbol: string;
    side: 'BUY' | 'SELL';
    positionSide?: 'LONG' | 'SHORT' | 'BOTH';
    quantity: number;
    price?: number;
  }) => {
    const step = getStepSize(p.symbol);
    const tick = getPriceTick(p.symbol);

    const pos = positions.find((x) => x.symbol === p.symbol);
    const maxQty = Math.abs(Number(pos?.positionAmt || 0));
    const qty = roundToStep(Math.min(p.quantity, maxQty), step);

    if (qty <= 0) return;

    const base: any = {
      symbol: p.symbol,
      market: 'futures',
      side: p.side,
      quantity: qty,
      ...(p.positionSide && p.positionSide !== 'BOTH' ? { positionSide: p.positionSide } : {}),
    };

    try {
      if (p.type === 'MARKET') {
        await binanceWS.placeOrder({ ...base, type: 'MARKET' });
      } else if (p.type === 'LIMIT' && p.price) {
        const px = Number((Math.round(p.price / tick) * tick).toFixed(8));
        await binanceWS.placeOrder({
          ...base,
          type: 'LIMIT',
          price: px,
          timeInForce: 'GTC',
        });
      }
    } catch (e) {
      console.error('placeOrder error:', e);
    }

    setShowCloseModal(false);
  }, [positions]);

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

  // ✅ Render content
  const renderContent = () => {
    switch (activeTab) {
      case 'position':
        if (isMobile) {
          return (
            <PositionMobile
              positions={positions}
              market={market}
              markPrices={markPrices}
              openOrders={openOrders}
              onTpSlClick={handleTpSlClick}
              onAdvancedClick={handleAdvancedClick}
              onCloseMarket={handleCloseMarketClick}
              onCloseLimit={handleCloseLimit}
              onCloseAll={() => setShowCloseAllModal(true)}
              onCloseByPnl={handleCloseByPnl}
              onSymbolClick={handleSymbolClick}
            />
          );
        }
        return (
          <Position
            market={market}
            onPositionCountChange={setPositionCount}
            onFloatingInfoChange={onFloatingInfoChange}
            hideOtherSymbols={hideOtherSymbols}
            onHideOtherSymbolsChange={setHideOtherSymbols}
          />
        );
      case 'openOrder':
        return (
          <OpenOrder
            selectedSymbol={selectedSymbol}
            market={market}
            onPendingCountChange={setOpenOrderCount}
            hideOtherSymbols={hideOtherSymbols}
          />
        );
      case 'orderHistory':
        return (
    <OrderHistoryPosition 
      binanceAccountId={binanceAccountId}
      onSymbolClick={onSymbolClick}
    />
  );
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
        <div className="position-mobile-wrapper">
          {/* Tabs */}
          <div className="position-mobile-tabs sticky top-0 z-10 bg-dark-900 border-b border-dark-700">
            <div className="flex overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-shrink-0 px-fluid-3 py-fluid-2 text-fluid-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-primary-500 text-primary-400'
                      : 'border-transparent text-dark-400 hover:text-dark-200'
                  }`}
                >
                  {tab.label}
                  {tab.key === 'position' && positionCount > 0 && (
                    <span className="ml-1.5 text-fluid-sm px-1.5 py-0.5 rounded-full bg-primary-500/20 text-primary-300">
                      {positionCount}
                    </span>
                  )}
                  {tab.key === 'openOrder' && openOrderCount > 0 && (
                    <span className="ml-1.5 text-fluid-sm px-1.5 py-0.5 rounded-full bg-primary-500/20 text-primary-300">
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

        {/* ✅ TP/SL Modal */}
        {activePosition && showTpSlModal && createPortal(
          <PositionTpSlModal
            isOpen={showTpSlModal}
            onClose={() => {
              setShowTpSlModal(false);
              setActivePosition(null);
            }}
            symbol={activePosition.symbol}
            entryPrice={parseFloat(activePosition.entryPrice || '0')}
            markPrice={markPrices[activePosition.symbol] || parseFloat(activePosition.markPrice || '0')}
            positionAmt={parseFloat(activePosition.positionAmt || '0')}
            getPriceTick={getPriceTick}
            market={market}
            leverage={Number((activePosition as any)?.leverage) || 10}
            existingTpSlOrders={(() => {
              const positionSide = parseFloat(activePosition.positionAmt || '0') > 0 ? 'LONG' : 'SHORT';
              const expectedSide = positionSide === 'LONG' ? 'SELL' : 'BUY';
              
              const tpOrder = openOrders.find((o: any) => 
                o.symbol === activePosition.symbol && 
                (o.type === 'TAKE_PROFIT_MARKET' || o.type === 'TAKE_PROFIT') &&
                o.side === expectedSide &&
                o.status === 'NEW'
              );
              const slOrder = openOrders.find((o: any) => 
                o.symbol === activePosition.symbol && 
                (o.type === 'STOP_MARKET' || o.type === 'STOP') &&
                o.side === expectedSide &&
                o.status === 'NEW'
              );
              
              return { tpOrder, slOrder };
            })()}
            onSubmit={() => {
              setShowTpSlModal(false);
              setActivePosition(null);
            }}
          />,
          document.body
        )}

        {/* ✅ Close Position Modal */}
        {activePosition && showCloseModal && createPortal(
          <ClosePositionModal
            isOpen={showCloseModal}
            onClose={() => {
              setShowCloseModal(false);
              setActivePosition(null);
            }}
            mode={closeMode}
            symbol={activePosition.symbol}
            side={Number(activePosition.positionAmt || 0) > 0 ? 'SELL' : 'BUY'}
            positionSide={Number(activePosition.positionAmt || 0) > 0 ? 'LONG' : 'SHORT'}
            markPrice={markPrices[activePosition.symbol] || Number(activePosition.markPrice || 0)}
            entryPrice={Number(activePosition.entryPrice || 0)}
            maxQty={Math.abs(Number(activePosition.positionAmt || 0))}
            stepSize={getStepSize(activePosition.symbol)}
            tickSize={getPriceTick(activePosition.symbol)}
            qty={String(Math.abs(Number(activePosition.positionAmt || 0)))}
            price={String(markPrices[activePosition.symbol] || Number(activePosition.markPrice || 0))}
            onConfirm={handleConfirmClose}
          />,
          document.body
        )}

        {/* ✅ Close All Modal */}
        {showCloseAllModal && createPortal(
          <CloseAllPositionsModal
            isOpen={showCloseAllModal}
            onClose={() => setShowCloseAllModal(false)}
            onConfirm={() => {
              handleCloseAll();
              setShowCloseAllModal(false);
            }}
            positionCount={positions.filter(p => Math.abs(Number(p.positionAmt || 0)) > 0.000001).length}
          />,
          document.body
        )}

        {/* ✅ Risk Config Modal */}
        {activePosition && showRiskConfig && createPortal(
          <RiskConfigModal
            isOpen={showRiskConfig}
            onClose={() => {
              setShowRiskConfig(false);
              setActivePosition(null);
            }}
            symbol={activePosition.symbol}
            entryPrice={parseFloat(activePosition.entryPrice || '0')}
            markPrice={markPrices[activePosition.symbol] || parseFloat(activePosition.markPrice || '0')}
            positionAmt={parseFloat(activePosition.positionAmt || '0')}
            leverage={Number((activePosition as any).leverage) || 10}
          />,
          document.body
        )}
      </div>
    );
  }

  // ✅ Desktop: Original layout with Fullscreen button
  return (
    <>
      {/* ✅ FIX: Thêm h-full, flex, flex-col để tạo proper flex container */}
      <div className="position-function-wrapper w-full max-w-full h-full flex flex-col overflow-hidden pt-1.5 px-1.5 sm:pt-2 sm:px-2 md:pt-3 md:px-3">
        {/* ✅ Header row - flex-shrink-0 để không bị co lại */}
        <div className="flex-shrink-0 flex items-center justify-between border-b border-dark-700 mb-2 sm:mb-4">
          {/* Tabs */}
          <div className="flex space-x-1.5 sm:space-x-3 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`py-fluid-1.5 px-1.5 sm:px-2 md:px-fluid-3 text-fluid-2xs sm:text-fluid-base font-medium border-b-2 whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.key
                    ? 'border-primary-500 text-primary-500'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="inline-flex items-center">
                  {tab.label}
                  {tab.key === 'position' && positionCount > 0 && (
                    <span className="ml-0.5 inline-flex items-center justify-center text-fluid-xs leading-none px-1 py-[1px] rounded-full bg-primary-100/20 text-primary-300">
                      {positionCount}
                    </span>
                  )}
                  {tab.key === 'openOrder' && openOrderCount > 0 && (
                    <span className="ml-0.5 inline-flex items-center justify-center text-fluid-xs leading-none px-1 py-[1px] rounded-full bg-primary-100/20 text-primary-300">
                      {openOrderCount}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {/* Fullscreen button */}
          <button
            className="expand-fullscreen-btn ml-2 flex-shrink-0"
            onClick={() => setIsFullscreen(true)}
            title="Mở rộng toàn màn hình"
          >
            <ExpandIcon />
          </button>
        </div>

        {/* ✅ FIX: Content area - flex-1 + min-h-0 để scroll đúng trong children */}
        <div className="position-function-content flex-1 min-h-0 overflow-hidden">
          {renderContent()}
        </div>
      </div>

      {/* Fullscreen Modal */}
      <FullscreenPositionModal
        isOpen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={tabs}
        positionCount={positionCount}
        openOrderCount={openOrderCount}
      >
        {renderContent()}
      </FullscreenPositionModal>
    </>
  );
};

export default PositionFunction;