import React, { useEffect, useCallback, useState } from 'react';
import type { ISeriesApi, IChartApi } from 'lightweight-charts';

interface Props {
  visible?: boolean;
  price: number;
  positionAmt: number;
  pnl: number;
  roi: number;
  series?: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'>;
  containerRef?: React.RefObject<HTMLDivElement>;
  offset?: number;
  onClosePosition?: () => void;
}

const FloatingPositionTag: React.FC<Props> = ({
  visible = true,
  price,
  positionAmt,
  pnl,
  roi,
  series,
  containerRef,
  offset = 12,
  onClosePosition,
}) => {
  const [y, setY] = useState(0);

  const recalcY = useCallback(() => {
    if (!series || !containerRef?.current || !price) return;
    const coord = series.priceToCoordinate(price);
    if (coord == null) return;
    const h = containerRef.current.clientHeight;
    setY(Math.max(8, Math.min(h - 8, coord)));
  }, [series, containerRef, price]);

  useEffect(() => { 
    recalcY(); 
  }, [recalcY]);

  useEffect(() => {
    if (!containerRef?.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => recalcY());
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, recalcY]);

  useEffect(() => {
    if (!series) return;
    const chart = (series as any).chart?.() as IChartApi | undefined;
    if (!chart) return;
    const timeScale = chart.timeScale();
    const handleVisibleRangeChange = () => {
      recalcY();
    };
    timeScale.subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
    return () => {
      timeScale.unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
    };
  }, [series, recalcY]);

  useEffect(() => {
    recalcY();
  }, [price, recalcY]);

  if (!visible || !price) return null;

  const isLong = positionAmt > 0;
  const isProfitable = pnl >= 0;
  
  // ✅ Màu sáng hơn, nổi bật hơn
  const bgColor = isProfitable 
    ? 'rgba(14, 203, 129, 0.2)' // Tăng opacity từ 0.15 lên 0.2
    : 'rgba(246, 70, 93, 0.2)';
  
  const textColor = isProfitable ? '#0ECB81' : '#F6465D';
  const borderColor = isProfitable ? '#0ECB81' : '#F6465D';

  return (
    <div
      className="pointer-events-auto absolute z-[50] select-none"
      style={{ 
        transform: `translate(${Math.max(0, offset)}px, ${Math.max(0, y - 14)}px)`,
      }}
    >
      <div 
        className="flex items-center gap-2 px-2.5 py-1.5 rounded border shadow-lg"
        style={{
          backgroundColor: bgColor,
          borderColor: borderColor,
          borderWidth: '1px',
          backdropFilter: 'blur(4px)', // ✅ Thêm blur effect
        }}
      >
        {/* ✅ PnL Value - CỰC KỲ NỔI BẬT */}
        <span 
          className="font-bold whitespace-nowrap tabular-nums"
          style={{ 
            color: textColor,
            fontSize: '13px', // ✅ Tăng từ 12px (text-xs)
            fontWeight: '700',
            textShadow: `0 0 8px ${isProfitable ? 'rgba(14, 203, 129, 0.4)' : 'rgba(246, 70, 93, 0.4)'}`, // ✅ Thêm glow
          }}
        >
          {isProfitable ? '+' : ''}{pnl.toFixed(2)}
        </span>

        {/* Divider - Mờ hơn để không làm nổi số */}
        <div 
          className="h-3.5 w-px" 
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
        />

        {/* ✅ ROI % - NỔI BẬT VỪA PHẢI */}
        <span 
          className="font-semibold whitespace-nowrap tabular-nums"
          style={{ 
            color: textColor,
            fontSize: '12px', // ✅ Tăng từ 10px
            fontWeight: '600',
          }}
        >
          {isProfitable ? '+' : ''}{roi.toFixed(2)}%
        </span>

        {/* Divider */}
        <div 
          className="h-3.5 w-px" 
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
        />

        {/* ✅ TP/SL Button - Darker background để nổi bật hơn */}
        <button
          type="button"
          className="text-[11px] px-2 py-0.5 rounded font-medium transition-all"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.4)', // ✅ Đen hơn
            color: '#E0E0E0',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
          }}
          title="Take Profit / Stop Loss"
        >
          TP/SL
        </button>

        {/* ✅ Close Button - Cleaner X icon */}
        <button
          type="button"
          className="w-5 h-5 flex items-center justify-center rounded transition-all"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            color: '#E0E0E0',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
            e.currentTarget.style.color = '#E0E0E0';
          }}
          onClick={onClosePosition}
          title="Close position"
        >
          <svg 
            width="11" 
            height="11" 
            viewBox="0 0 11 11" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current"
          >
            <path 
              d="M1.5 1.5L9.5 9.5M9.5 1.5L1.5 9.5" 
              strokeWidth="2" 
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default FloatingPositionTag;