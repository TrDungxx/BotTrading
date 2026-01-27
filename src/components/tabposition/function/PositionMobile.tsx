import React, { useState, useMemo } from "react";
import { Edit3, TrendingUp, TrendingDown, ChevronDown, ChevronUp, X, Shield } from "lucide-react";
import { PositionData } from "../../../utils/types";

interface PositionMobileProps {
  positions?: PositionData[];
  market?: "spot" | "futures";
  markPrices?: Record<string, number>;
  openOrders?: any[];
  onTpSlClick?: (position: PositionData) => void;
  onAdvancedClick?: (position: PositionData) => void;
  onCloseMarket?: (position: PositionData) => void;
  onCloseLimit?: (position: PositionData) => void;
  onCloseAll?: () => void;
  onCloseByPnl?: () => void;
  onSymbolClick?: (symbol: string) => void;
}

const PositionMobile: React.FC<PositionMobileProps> = ({
  positions = [],
  market = "futures",
  markPrices = {},
  openOrders = [],
  onTpSlClick,
  onAdvancedClick,
  onCloseMarket,
  onCloseLimit,
  onCloseAll,
  onCloseByPnl,
  onSymbolClick,
}) => {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Get real-time mark price
  const getMarkPrice = (pos: PositionData): number => {
    return markPrices[pos.symbol] || Number(pos.markPrice || 0);
  };

  // Calculate PnL
  const calculatePnl = (pos: PositionData): number | undefined => {
    const entry = Number(pos.entryPrice || 0);
    const qty = Number(pos.positionAmt || 0);
    const mark = getMarkPrice(pos);
    if (!entry || !qty || !mark) return undefined;
    return qty * (mark - entry);
  };

  // Calculate ROI%
  const calculateRoi = (pos: PositionData): number | undefined => {
    const pnl = calculatePnl(pos);
    const entry = Number(pos.entryPrice || 0);
    const qty = Math.abs(Number(pos.positionAmt || 0));
    const leverage = Number((pos as any).leverage || 1);
    
    if (pnl == null || !entry || !qty) return undefined;
    const margin = (qty * entry) / leverage;
    return margin ? (pnl / margin) * 100 : 0;
  };

  // Calculate Margin
  const calculateMargin = (pos: PositionData): number => {
    const isolatedWallet = Number((pos as any).isolatedWallet || 0);
    if (isolatedWallet > 0) return isolatedWallet;

    const posMargin = Number((pos as any).positionInitialMargin || 0);
    if (posMargin > 0) return posMargin;

    const entry = Number(pos.entryPrice || 0);
    const qty = Math.abs(Number(pos.positionAmt || 0));
    const leverage = Number((pos as any).leverage || 1);
    
    if (entry > 0 && qty > 0 && leverage > 0) {
      return (qty * entry) / leverage;
    }
    return 0;
  };

  // Get TP/SL orders
  const getTpSlOrders = (pos: PositionData) => {
    const isLong = Number(pos.positionAmt || 0) > 0;
    const expectedSide = isLong ? "SELL" : "BUY";
    
    const tpOrder = openOrders.find((o: any) => 
      o.symbol === pos.symbol && 
      (o.type === 'TAKE_PROFIT_MARKET' || o.type === 'TAKE_PROFIT') &&
      o.side === expectedSide && o.status === 'NEW'
    );
    
    const slOrder = openOrders.find((o: any) => 
      o.symbol === pos.symbol && 
      (o.type === 'STOP_MARKET' || o.type === 'STOP') &&
      o.side === expectedSide && o.status === 'NEW'
    );
    
    return { tpOrder, slOrder };
  };

  const fmt = (n: number | undefined, d = 2): string => {
    if (n == null || !Number.isFinite(n)) return "--";
    return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  };

  const fmtPrice = (n: number | undefined): string => {
    if (n == null || !Number.isFinite(n)) return "--";
    const d = n >= 1000 ? 2 : n >= 1 ? 4 : 6;
    return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  };

  const activePositions = useMemo(() => {
    return positions.filter((p) => Math.abs(Number(p.positionAmt || 0)) > 0.000001);
  }, [positions]);

  const toggleExpand = (key: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      return newSet;
    });
  };

  // Total PnL
  const totalPnl = useMemo(() => {
    return activePositions.reduce((sum, pos) => sum + (calculatePnl(pos) || 0), 0);
  }, [activePositions, markPrices]);

  const renderCard = (pos: PositionData) => {
    const size = Number(pos.positionAmt || 0);
    const mark = getMarkPrice(pos);
    const pnl = calculatePnl(pos);
    const roi = calculateRoi(pos);
    const margin = calculateMargin(pos);
    const isLong = size > 0;
    const cardKey = `${pos.symbol}:${(pos as any).positionSide || "BOTH"}`;
    const isExpanded = expandedCards.has(cardKey);
    const { tpOrder, slOrder } = getTpSlOrders(pos);
    const marginType = ((pos as any).marginType || 'cross').toLowerCase();

    const pnlColor = pnl == null ? "text-gray-400" : pnl > 0 ? "text-green-400" : pnl < 0 ? "text-red-400" : "text-gray-400";
    const sideColor = isLong ? "text-green-400" : "text-red-400";
    const sideBg = isLong ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30";

    return (
      <div key={cardKey} className="bg-slate-800/80 rounded-xl border border-slate-700/50 mb-3 overflow-hidden">
        {/* Header - Symbol + PnL */}
        <div className="px-3 py-2.5 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span 
                className="font-semibold text-white text-sm underline decoration-dotted cursor-pointer hover:text-primary-400"
                onClick={() => onSymbolClick?.(pos.symbol)}
              >
                {pos.symbol}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${sideBg} ${sideColor} font-medium`}>
                {isLong ? "LONG" : "SHORT"}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                {(pos as any).leverage || 1}x
              </span>
            </div>
            <div className="text-right">
              <div className={`font-bold text-sm ${pnlColor}`}>
                {pnl == null ? "--" : `${pnl >= 0 ? "+" : ""}${fmt(pnl)} USDT`}
              </div>
              <div className={`text-[10px] ${pnlColor}`}>
                {roi == null ? "--" : `(${roi >= 0 ? "+" : ""}${fmt(roi)}%)`}
              </div>
            </div>
          </div>
        </div>

        {/* Main Info Grid */}
        <div className="px-3 py-2">
          <div className="grid grid-cols-4 gap-2 text-[11px]">
            <div>
              <div className="text-slate-500 mb-0.5">Size</div>
              <div className={`font-medium ${sideColor}`}>{fmt(Math.abs(size), 0)}</div>
            </div>
            <div>
              <div className="text-slate-500 mb-0.5">Entry</div>
              <div className="text-white font-mono">{fmtPrice(Number(pos.entryPrice))}</div>
            </div>
            <div>
              <div className="text-slate-500 mb-0.5">Mark</div>
              <div className="text-white font-mono">{fmtPrice(mark)}</div>
            </div>
            <div>
              <div className="text-slate-500 mb-0.5">Margin</div>
              <div className="text-white">
                {fmt(margin)}
                <span className={`ml-1 text-[8px] ${marginType === 'isolated' ? 'text-yellow-400' : 'text-blue-400'}`}>
                  {marginType === 'isolated' ? 'Iso' : 'Cross'}
                </span>
              </div>
            </div>
          </div>

          {/* TP/SL Row */}
          {(tpOrder || slOrder) && (
            <div className="flex gap-3 mt-2 text-[10px]">
              {tpOrder && (
                <span className="text-green-400">
                  TP: {fmtPrice(Number(tpOrder.stopPrice))}
                </span>
              )}
              {slOrder && (
                <span className="text-red-400">
                  SL: {fmtPrice(Number(slOrder.stopPrice))}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons - ALWAYS VISIBLE */}
        <div className="px-3 py-2 border-t border-slate-700/50 bg-slate-800/50">
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => onTpSlClick?.(pos)}
              className={`flex items-center justify-center gap-1 px-2 py-2 text-[11px] rounded-lg border font-medium ${
                tpOrder || slOrder 
                  ? 'border-green-500/50 text-green-400 bg-green-500/10' 
                  : 'border-slate-600 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Edit3 size={12} />
              <span className="hidden xs:inline">TP/SL</span>
            </button>
            
            <button
              onClick={() => onAdvancedClick?.(pos)}
              className="flex items-center justify-center gap-1 px-2 py-2 text-[11px] rounded-lg border border-blue-500/50 text-blue-400 hover:bg-slate-700 font-medium"
            >
              <Shield size={12} />
              <span className="hidden xs:inline">Risk</span>
            </button>
            
            <button
              onClick={() => onCloseMarket?.(pos)}
              className="flex items-center justify-center gap-1 px-2 py-2 text-[11px] rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold"
            >
              <X size={12} />
              Market
            </button>
            
            <button
              onClick={() => onCloseLimit?.(pos)}
              className="flex items-center justify-center gap-1 px-2 py-2 text-[11px] rounded-lg border border-red-500 text-red-400 hover:bg-slate-700 font-medium"
            >
              Limit
            </button>
          </div>
        </div>

        {/* Expand Toggle */}
        <div 
          className="flex items-center justify-center py-1.5 cursor-pointer hover:bg-slate-700/50 border-t border-slate-700/30"
          onClick={() => toggleExpand(cardKey)}
        >
          {isExpanded ? (
            <ChevronUp size={16} className="text-slate-500" />
          ) : (
            <ChevronDown size={16} className="text-slate-500" />
          )}
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="px-3 py-2 bg-slate-900/50 border-t border-slate-700/30">
            <div className="grid grid-cols-3 gap-3 text-[11px]">
              <div>
                <div className="text-slate-500 mb-0.5">Break Even</div>
                <div className="text-white font-mono">{fmtPrice(Number((pos as any).breakEvenPrice || pos.entryPrice))}</div>
              </div>
              <div>
                <div className="text-slate-500 mb-0.5">Notional</div>
                <div className="text-white">{fmt(Math.abs(size) * mark)} USDT</div>
              </div>
              <div>
                <div className="text-slate-500 mb-0.5">Liq. Price</div>
                <div className="text-orange-400 font-mono">
                  {fmtPrice(Number((pos as any).liquidationPrice || 0))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="position-mobile-container w-full p-3">
      {/* Top Actions */}
      {activePositions.length > 0 && (
        <>
          <div className="flex gap-2 mb-3">
            <button
              onClick={onCloseAll}
              className="flex-1 py-2 text-xs rounded-lg border border-yellow-500/50 text-yellow-400 hover:bg-slate-800 font-medium"
            >
              Đóng tất cả
            </button>
            <button
              onClick={onCloseByPnl}
              className="flex-1 py-2 text-xs rounded-lg border border-green-500/50 text-green-400 hover:bg-slate-800 font-medium"
            >
              Đóng theo PnL
            </button>
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between px-3 py-2 mb-3 bg-slate-800/50 rounded-lg border border-slate-700/30 text-[11px]">
            <div className="text-center">
              <span className="text-slate-500">Positions: </span>
              <span className="text-white font-medium">{activePositions.length}</span>
            </div>
            <div className="text-center">
              <span className="text-slate-500">Total PnL: </span>
              <span className={`font-medium ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)} USDT
              </span>
            </div>
            <div className="text-center">
              <span className="text-slate-500">Margin: </span>
              <span className="text-white font-medium">
                {fmt(activePositions.reduce((s, p) => s + calculateMargin(p), 0))}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Position Cards */}
      {activePositions.length > 0 ? (
        <div>{activePositions.map(renderCard)}</div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 mb-3 rounded-full bg-slate-800 flex items-center justify-center">
            <TrendingUp className="w-7 h-7 text-slate-600" />
          </div>
          <div className="text-slate-400 text-sm mb-1">Không có vị thế</div>
          <div className="text-slate-500 text-xs">Các vị thế sẽ hiển thị ở đây</div>
        </div>
      )}
    </div>
  );
};

export default PositionMobile;