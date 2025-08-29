import React, { useEffect, useCallback, useState } from 'react';
import type { ISeriesApi } from 'lightweight-charts';

interface Props {
  visible?: boolean;
  // giá đang dùng để bám theo (mark price) — bắt buộc
  price: number;
  // số lượng vị thế để xác định LONG/SHORT cho màu nút đóng
  positionAmt: number;
  // đã tính sẵn ở Position:
  pnl: number;
  roi: number;
  // để quy đổi price -> Y
  series?: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'>;
  containerRef?: React.RefObject<HTMLDivElement>;
  offset?: number; // lề trái px, default 12
  onClosePosition?: () => void; // optional callback đóng lệnh
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

  useEffect(() => { recalcY(); }, [recalcY]);

  useEffect(() => {
    if (!containerRef?.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => recalcY());
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, recalcY]);

  if (!visible || !price) return null;

  const isLong = positionAmt > 0;
  const pnlCls = pnl > 0 ? 'text-[#0ecb81]' : pnl < 0 ? 'text-[#f6465d]' : 'text-white';

  return (
    <div
      className="pointer-events-auto absolute z-[50] select-none"
      style={{ transform: `translate(${Math.max(0, offset)}px, ${Math.max(0, y - 16)}px)` }}
    >
      <div className="flex items-center gap-2 bg-dark-600/90 border border-dark-400 rounded px-3 py-1.5 shadow-md">
        <span className="text-xs text-white/80">
          PnL:&nbsp;
          <b className={pnlCls}>{(pnl >= 0 ? '+' : '') + pnl.toFixed(2)} USDT</b>
          &nbsp;(<span className={pnlCls}>{(roi >= 0 ? '+' : '') + roi.toFixed(2)}%</span>)
        </span>

        <button
          type="button"
          className="text-[11px] px-2 py-[3px] bg-dark-400 rounded hover:bg-dark-300 text-white"
        >
          TP/SL
        </button>

        <button
          type="button"
          className="text-[11px] px-2 py-[3px] rounded text-white"
          style={{ background: isLong ? '#f6465d' : '#0ecb81' }}
          onClick={onClosePosition}
          title="Đóng vị thế"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default FloatingPositionTag;
