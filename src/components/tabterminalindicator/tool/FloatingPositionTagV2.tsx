import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import type { ISeriesApi } from 'lightweight-charts';

type Side = 'LONG' | 'SHORT';
// ⬇️ thêm 'running' để phân biệt đã khớp
type TagState = 'preview' | 'confirmed' | 'running';

interface Props {
  visible?: boolean;

  entryPrice: number;     // giá entry bám theo
  currentPrice: number;   // giá hiện tại (mark/last) để tính PnL realtime

  side?: Side;
  positionAmt?: number;

  pnl?: number;   // USDT (nếu backend pass vào)
  roi?: number;   // %

  qtyBase?: number;  // size base (để tự tính PnL local)
  leverage?: number;

  series?: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'>;
  containerRef?: React.RefObject<HTMLDivElement>;
  offset?: number;

  // ⬇️ state có 3 mức: preview | confirmed (armed) | running (đã khớp)
  state?: TagState;
  disabled?: boolean;

  onConfirm?: (finalEntryPrice: number) => void;
  onCancelPreview?: () => void;
  onClosePosition?: () => void;
  onChangeEntryPrice?: (nextEntry: number) => void;

  compact?: boolean;

  // ⬇️ mới thêm: ép bật/tắt hiển thị PnL từ bên ngoài (ví dụ file cha truyền showPnL={currentMsg.triggered})
  showPnL?: boolean;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const FloatingPositionTagV2: React.FC<Props> = ({
  visible = true,
  entryPrice,
  currentPrice,
  side,
  positionAmt,
  pnl,
  roi,
  qtyBase,
  leverage,
  series,
  containerRef,
  offset = 12,
  state = 'preview',
  disabled,
  onConfirm,
  onCancelPreview,
  onClosePosition,
  onChangeEntryPrice,
  compact,
  showPnL, // ⬅️ nhận prop mới
}) => {
  const [localEntry, setLocalEntry] = useState(entryPrice);
  const [y, setY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startY: number } | null>(null);

  // đồng bộ prop -> state khi không kéo
  useEffect(() => {
    if (!dragging) setLocalEntry(entryPrice);
  }, [entryPrice, dragging]);

  const recalcY = useCallback(() => {
    if (!series || !containerRef?.current || !localEntry) return;
    const coord = series.priceToCoordinate(localEntry);
    if (coord == null) return;
    const h = containerRef.current.clientHeight;
    setY(clamp(coord, 8, h - 8));
  }, [series, containerRef, localEntry]);

  useEffect(() => { recalcY(); }, [recalcY]);

  useEffect(() => {
    if (!containerRef?.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => recalcY());
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, recalcY]);

  // Kéo thả entry
  const onMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    setDragging(true);
    dragRef.current = { startY: e.clientY };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (ev: MouseEvent) => {
    if (!dragging || !containerRef?.current || !series) return;
    const rect = containerRef.current.getBoundingClientRect();
    const localY = clamp(ev.clientY - rect.top, 8, rect.height - 8);
    setY(localY);
    const price = series.coordinateToPrice(localY);
    if (typeof price === 'number' && isFinite(price)) {
      setLocalEntry(price);
      onChangeEntryPrice?.(price);
    }
  };

  const onMouseUp = () => {
    setDragging(false);
    dragRef.current = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  // xác định LONG/SHORT
  const isLong = (side ?? (positionAmt && positionAmt > 0 ? 'LONG' : 'SHORT')) === 'LONG';

  // ⬇️ chỉ show PnL khi file cha yêu cầu (showPnL=true) **hoặc** state === 'running'
  const shouldShowPnL = (showPnL ?? false) || state === 'running';

  // Tính PnL local nếu không truyền từ props — nhưng chỉ khi shouldShowPnL = true
  const { pnlVal, roiPct } = useMemo(() => {
    if (!shouldShowPnL) return { pnlVal: 0, roiPct: 0 };
    if (typeof pnl === 'number' && typeof roi === 'number') {
      return { pnlVal: pnl, roiPct: roi };
    }
    if (!qtyBase || !localEntry || !currentPrice) {
      return { pnlVal: 0, roiPct: 0 };
    }
    const dir = isLong ? 1 : -1;
    const delta = (currentPrice - localEntry) * dir;
    const pnlLocal = delta * qtyBase; // USDT
    const roiLocal = (currentPrice / localEntry - 1) * 100 * dir;
    return { pnlVal: pnlLocal, roiPct: roiLocal };
  }, [shouldShowPnL, pnl, roi, qtyBase, localEntry, currentPrice, isLong]);

  if (!visible || !localEntry || !containerRef?.current) return null;

  const pnlCls = pnlVal > 0 ? 'text-[#0ecb81]' : pnlVal < 0 ? 'text-[#f6465d]' : 'text-white';
  const closeBg = isLong ? '#f6465d' : '#0ecb81';

  return (
    <div
      className="pointer-events-auto absolute z-[90] select-none"
      style={{ transform: `translate(${Math.max(0, offset)}px, ${Math.max(0, y - 16)}px)` }}
    >
      {/* Tag khung */}
      <div
        className="flex items-center gap-fluid-2 bg-dark-600/90 border border-dark-400 rounded px-fluid-3 py-fluid-1.5 shadow-md"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* drag handle */}
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-white/60 hover:text-white"
          onMouseDown={onMouseDown}
          title="Kéo để thay đổi Entry trên chart"
        >
          ☰
        </button>

        {/* Nội dung */}
        <div className={`flex items-center gap-fluid-2 ${compact ? 'text-fluid-xs' : 'text-xs'}`}>
          <span className="text-white/70">Entry:</span>
          <b className="text-white">{localEntry.toFixed(6)}</b>
          {leverage ? <span className="ml-1 text-white/50">{leverage}x</span> : null}

          <span className="mx-2 text-white/20">•</span>

          <span className="text-white/70">PnL:</span>
          {shouldShowPnL ? (
            <>
              <b className={pnlCls}>{(pnlVal >= 0 ? '+' : '') + pnlVal.toFixed(2)} USDT</b>
              <span className={pnlCls}>&nbsp;({(roiPct >= 0 ? '+' : '') + roiPct.toFixed(2)}%)</span>
            </>
          ) : (
            <b className="text-white/60">—</b>  
          )}
        </div>

        {/* Action */}
        {state === 'preview' ? (
          <>
            <button
              type="button"
              className="text-fluid-xs px-2 py-[3px] bg-primary-600 hover:bg-primary-500 rounded text-white"
              disabled={disabled}
              onClick={() => onConfirm?.(localEntry)}
              title="Xác nhận entry này và gửi message cho bot"
            >
              Xác nhận
            </button>
            <button
              type="button"
              className="text-fluid-xs px-2 py-[3px] bg-dark-400 hover:bg-dark-300 rounded text-white"
              onClick={onCancelPreview}
              title="Huỷ"
            >
              Huỷ
            </button>
          </>
        ) : (
          <button
            type="button"
            className="text-fluid-xs px-2 py-[3px] rounded text-white"
            style={{ background: closeBg }}
            onClick={onClosePosition}
            title="Đóng vị thế"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default FloatingPositionTagV2;
