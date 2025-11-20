import React, { useState, useEffect } from "react";
import { Edit3, TrendingUp, TrendingDown } from "lucide-react";
import { PositionData } from "../../../utils/types";

interface PositionMobileProps {
  positions?: PositionData[];
  market?: "spot" | "futures";
  onTpSlClick?: (position: PositionData) => void;
  onAdvancedClick?: (position: PositionData) => void;
  onCloseMarket?: (position: PositionData) => void;
  onCloseLimit?: (position: PositionData) => void;
  onCloseAll?: () => void;
  onCloseByPnl?: () => void;
}

const PositionMobile: React.FC<PositionMobileProps> = ({
  positions = [],
  market = "futures",
  onTpSlClick,
  onAdvancedClick,
  onCloseMarket,
  onCloseLimit,
  onCloseAll,
  onCloseByPnl,
}) => {
  // ✅ FIX 1: Track which cards are expanded using Set
  // Default: all cards expanded (empty Set means all expanded)
  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(new Set());

  // Helper functions
  const calculatePnl = (pos: PositionData): number | undefined => {
    const entry = Number(pos.entryPrice || 0);
    const qty = Number(pos.positionAmt || 0);
    const mark = Number(pos.markPrice || 0);
    if (!entry || !qty || !mark) return undefined;
    return qty * (mark - entry);
  };

  const calculatePnlPercentage = (pos: PositionData): number | undefined => {
    const pnl = calculatePnl(pos);
    const entry = Number(pos.entryPrice || 0);
    const qty = Math.abs(Number(pos.positionAmt || 0));
    const leverage = Number((pos as any).leverage || 1);
    
    if (pnl == null || !entry || !qty) return undefined;
    const initialMargin = (qty * entry) / leverage;
    return initialMargin ? (pnl / initialMargin) * 100 : 0;
  };

  const formatNumber = (num: number | undefined, decimals = 2): string => {
    if (num == null) return "--";
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    });
  };

  // ✅ FIX 2: Filter active positions correctly
  const activePositions = positions.filter(
    (p) => Math.abs(Number(p.positionAmt || 0)) > 0.000001
  );

  // ✅ Debug log
  useEffect(() => {
    console.log("📊 PositionMobile - Active positions:", activePositions.length);
    console.log("📊 All positions:", positions);
    console.log("📊 Filtered active:", activePositions);
  }, [positions]);

  const toggleCard = (key: string) => {
    setCollapsedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key); // Expand
      } else {
        newSet.add(key); // Collapse
      }
      return newSet;
    });
  };

  const renderPositionCard = (pos: PositionData) => {
    const size = Number(pos.positionAmt || 0);
    const pnl = calculatePnl(pos);
    const pnlPercent = calculatePnlPercentage(pos);
    const isLong = size > 0;
    const cardKey = `${pos.symbol}:${(pos as any).positionSide || "BOTH"}`;
    
    // ✅ FIX 1: Card is expanded if NOT in collapsedCards Set
    const isExpanded = !collapsedCards.has(cardKey);

    const pnlColor = 
      pnl == null ? "text-dark-300" :
      pnl > 0 ? "text-success-500" :
      pnl < 0 ? "text-danger-500" : "text-dark-300";

    const sideColor = isLong ? "text-success-500" : "text-danger-500";
    const sideBg = isLong ? "bg-success-500/10" : "bg-danger-500/10";

    return (
      <div
        key={cardKey}
        className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden mb-3"
      >
        {/* Card Header - Always Visible */}
        <div
          className="p-4 cursor-pointer active:bg-dark-700"
          
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-white text-base">
                {pos.symbol}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-medium ${sideBg} ${sideColor}`}
              >
                {isLong ? "LONG" : "SHORT"}
              </span>
            </div>
            <div className="text-right">
              <div className={`font-bold text-base ${pnlColor}`}>
                {pnl == null
                  ? "--"
                  : `${pnl > 0 ? "+" : ""}${formatNumber(pnl, 2)} USDT`}
              </div>
              <div className={`text-xs ${pnlColor}`}>
                {pnlPercent == null
                  ? "--"
                  : `(${pnlPercent > 0 ? "+" : ""}${formatNumber(pnlPercent, 2)}%)`}
              </div>
            </div>
          </div>

          {/* Quick Info Row */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-dark-400 mb-0.5">Số lượng</div>
              <div className={`font-medium ${sideColor}`}>
                {formatNumber(Math.abs(size), 0)}
              </div>
            </div>
            <div>
              <div className="text-dark-400 mb-0.5">Entry</div>
              <div className="text-white font-mono">
                {formatNumber(Number(pos.entryPrice || 0), 4)}
              </div>
            </div>
            <div>
              <div className="text-dark-400 mb-0.5">Mark</div>
              <div className="text-white font-mono">
                {formatNumber(Number(pos.markPrice || 0), 4)}
              </div>
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t border-dark-700 p-4 space-y-3">
            {/* Additional Info */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-dark-400 mb-1">Break Even</div>
                <div className="text-white font-mono">
                  {formatNumber(Number((pos as any).breakEvenPrice || pos.entryPrice || 0), 4)}
                </div>
              </div>
              <div>
                <div className="text-dark-400 mb-1">Leverage</div>
                <div className="text-white font-medium">
                  {(pos as any).leverage || 1}x
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              {/* TP/SL & Advanced */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTpSlClick?.(pos);
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm rounded-lg border border-dark-600 text-dark-200 hover:bg-dark-700 active:bg-dark-600 font-medium"
                >
                  <Edit3 size={16} />
                  TP/SL
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdvancedClick?.(pos);
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm rounded-lg border border-primary-600 text-primary-400 hover:bg-dark-700 active:bg-dark-600 font-medium"
                >
                  {isLong ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  Nâng cao
                </button>
              </div>

              {/* Close Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseMarket?.(pos);
                  }}
                  className="px-3 py-2.5 text-sm rounded-lg bg-danger-500 hover:bg-danger-600 active:bg-danger-700 text-white font-medium"
                >
                  Đóng Market
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseLimit?.(pos);
                  }}
                  className="px-3 py-2.5 text-sm rounded-lg border border-danger-500 text-danger-400 hover:bg-dark-700 active:bg-dark-600 font-medium"
                >
                  Đóng Limit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="position-mobile-container bg-dark-900 w-full p-4">
      {/* Action Buttons */}
      {activePositions.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={onCloseAll}
            className="flex-1 px-4 py-2 text-sm rounded-lg border border-warning-500 text-warning-400 hover:bg-dark-800 active:bg-dark-700 font-medium"
          >
            Đóng tất cả
          </button>
          <button
            onClick={onCloseByPnl}
            className="flex-1 px-4 py-2 text-sm rounded-lg border border-success-500 text-success-400 hover:bg-dark-800 active:bg-dark-700 font-medium"
          >
            Đóng theo PnL
          </button>
        </div>
      )}

      {/* Position Cards - ✅ FIX 2: Map all active positions */}
      {activePositions.length > 0 ? (
        <div className="space-y-0">
          {activePositions.map((pos) => renderPositionCard(pos))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 mb-4 rounded-full bg-dark-800 flex items-center justify-center">
            <TrendingUp className="w-8 h-8 text-dark-600" />
          </div>
          <div className="text-dark-400 text-sm mb-1">
            Không có vị thế nào
          </div>
          <div className="text-dark-500 text-xs">
            Các vị thế của bạn sẽ hiển thị ở đây
          </div>
        </div>
      )}
    </div>
  );
};

export default PositionMobile;