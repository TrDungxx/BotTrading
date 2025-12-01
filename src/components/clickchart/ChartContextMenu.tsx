import React from 'react';
import { ISeriesApi } from 'lightweight-charts';
import { copyPrice } from '../clickchart/CopyPrice';
import { addHLine, clearAllHLines } from '../clickchart/hline';
import ChartOrderModal from './popupclickchart/ChartOrderModal';

// Icons as inline SVG components
const RefreshIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4 12a8 8 0 018-8c2.5 0 4.7 1.1 6.2 2.8L21 4v5h-5l2.3-2.3A6 6 0 0012 6a6 6 0 00-6 6 6 6 0 006 6c2.2 0 4.1-1.2 5.2-3h2.2a8 8 0 01-7.4 5 8 8 0 01-8-8z"/>
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);

const CopyIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
  </svg>
);

const BellIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
);

const HLineIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 12h18" strokeDasharray="2 2"/>
    <circle cx="3" cy="12" r="1.5" fill="currentColor"/>
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 6v6l4 2"/>
  </svg>
);

const ChartIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 3v18h18"/>
    <path d="M18 9l-5 5-4-4-6 6"/>
  </svg>
);

const ChevronRight = () => (
  <svg className="w-3.5 h-3.5 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 5l7 7-7 7"/>
  </svg>
);

interface ChartContextMenuProps {
  open: boolean;
  position: { x: number; y: number };
  menuRef: React.RefObject<HTMLDivElement | null>;
  hoverPrice: number | null;
  ctxClickPrice: number | null;
  lastCandleClose: number | null;
  candleSeries: ISeriesApi<'Candlestick'> | null;
  selectedSymbol: string;
  market: 'spot' | 'futures';
  tickSize: number;
  precision: number;
  subMenuOpen: boolean;
  onSubMenuOpen: (open: boolean) => void;
  onClose: () => void;
  onRefreshChart?: () => void;
  hlineKey: string;
  snapToTick: (price: number) => number;
  // Thêm props cho order form
  availableBalance?: number;
  leverage?: number;
}

const ChartContextMenu: React.FC<ChartContextMenuProps> = ({
  open,
  position,
  menuRef,
  hoverPrice,
  ctxClickPrice,
  lastCandleClose,
  candleSeries,
  selectedSymbol,
  market,
  tickSize,
  precision,
  subMenuOpen,
  onSubMenuOpen,
  onClose,
  onRefreshChart,
  hlineKey,
  snapToTick,
  availableBalance = 0,
  leverage = 10,
}) => {
  // State cho submenu đặt lệnh
  const [orderSubMenuOpen, setOrderSubMenuOpen] = React.useState(false);
  // State cho modal - chỉ có limit và stop-limit (không có market)
  const [orderModalOpen, setOrderModalOpen] = React.useState(false);
  const [orderModalType, setOrderModalType] = React.useState<'limit' | 'stop-limit'>('limit');

  if (!open && !orderModalOpen) return null;

  // Sử dụng giá tại thời điểm click, không thay đổi khi di chuột
  const displayPrice = ctxClickPrice ?? hoverPrice ?? lastCandleClose;

  const formatPrice = (price: number | null) => {
    if (price == null) return '--';
    return price.toLocaleString('vi-VN', {
      minimumFractionDigits: price >= 100 ? 2 : 5,
      maximumFractionDigits: price >= 100 ? 2 : 5,
    });
  };

  const handleNewOrder = () => {
    const snapped = displayPrice != null ? snapToTick(displayPrice) : null;
    console.log('[New Order] Price:', snapped);
    // TODO: Implement new UI
    onClose();
  };

  const handleLimitOrder = () => {
    setOrderModalType('limit');
    setOrderModalOpen(true);
    onClose();
  };

  const handleStopOrder = () => {
    setOrderModalType('stop-limit');
    setOrderModalOpen(true);
    onClose();
  };

  const handleCopyPrice = async () => {
    const ok = await copyPrice(displayPrice);
    onClose();
    if (!ok) console.warn('[Copy] Không copy được giá');
  };

  const handleDrawHLine = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const price = displayPrice;

    if (!candleSeries || price == null || !Number.isFinite(price)) {
      console.warn('[HLINE] missing series/price after all fallbacks', {
        seriesOk: !!candleSeries,
        price,
      });
      onClose();
      return;
    }

    const snapped = Math.round(price / tickSize) * tickSize;
    console.log('[HLINE] creating from menu', {
      displayPrice,
      tick: tickSize,
      snapped,
    });

    addHLine(candleSeries, snapped);

    try {
      const raw = localStorage.getItem(hlineKey);
      const arr: number[] = raw ? JSON.parse(raw) : [];
      arr.push(snapped);
      localStorage.setItem(hlineKey, JSON.stringify(arr));
    } catch {}

    onClose();
  };

  const handleClearHLines = () => {
    if (candleSeries) {
      clearAllHLines(candleSeries);
      try {
        localStorage.removeItem(hlineKey);
      } catch {}
    }
    onClose();
  };

  const handleCreateAlert = () => {
    console.log('[Create Alert] Price:', displayPrice);
    // TODO: Implement new UI
    onClose();
  };

  return (
    <>
    {open && (
    <div
      ref={menuRef}
      className="fixed z-[9999] py-2 rounded-md bg-[#1e2329] border border-[#2b3139]/50 shadow-xl select-none"
      style={{ left: position.x, top: position.y, minWidth: 220 }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Làm mới biểu đồ */}
      <button
        className="w-full px-3 py-2 text-left text-[13px] text-[#eaecef] hover:bg-[#2b3139] flex items-center gap-3"
        onClick={() => {
          onRefreshChart?.();
          onClose();
        }}
      >
        <RefreshIcon />
        <span>Làm mới biểu đồ</span>
      </button>

      {/* Đặt lệnh mới - với submenu */}
      <div 
        className="relative"
        onMouseEnter={() => setOrderSubMenuOpen(true)}
        onMouseLeave={() => setOrderSubMenuOpen(false)}
      >
        <button
          className="w-full px-3 py-2 text-left text-[13px] text-[#eaecef] hover:bg-[#2b3139] flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <PlusIcon />
            <span>Đặt lệnh mới</span>
          </div>
          <ChevronRight />
        </button>

        {orderSubMenuOpen && (
          <div 
            className="absolute left-full top-0 ml-0.5 py-2 rounded-md bg-[#1e2329] border border-[#2b3139]/50 shadow-xl" 
            style={{ minWidth: 200 }}
          >
            <button 
              className="w-full px-3 py-2 text-left text-[13px] text-[#eaecef] hover:bg-[#2b3139]"
              onClick={handleLimitOrder}
            >
              Giao dịch {selectedSymbol.replace('USDT', '')} @ {formatPrice(displayPrice)} Limit
            </button>
            <button 
              className="w-full px-3 py-2 text-left text-[13px] text-[#eaecef] hover:bg-[#2b3139]"
              onClick={handleStopOrder}
            >
              Giao dịch {selectedSymbol.replace('USDT', '')} @ {formatPrice(displayPrice)} Dừng
            </button>
          </div>
        )}
      </div>

      {/* Sao chép giá */}
      <button
        className="w-full px-3 py-2 text-left text-[13px] text-[#eaecef] hover:bg-[#2b3139] flex items-center gap-3"
        onClick={handleCopyPrice}
      >
        <CopyIcon />
        <span>Sao chép giá {formatPrice(displayPrice)}</span>
      </button>

      {/* Tạo cảnh báo */}
      <button
        className="w-full px-3 py-2 text-left text-[13px] text-[#eaecef] hover:bg-[#2b3139] flex items-center gap-3"
        onClick={handleCreateAlert}
      >
        <BellIcon />
        <span>Tạo cảnh báo {formatPrice(displayPrice)}</span>
      </button>

      {/* Vẽ đường kẻ ngang */}
      <button
        className="w-full px-3 py-2 text-left text-[13px] text-[#eaecef] hover:bg-[#2b3139] flex items-center gap-3"
        onMouseDown={handleDrawHLine}
      >
        <HLineIcon />
        <span>Vẽ đường kẻ ngang trên {formatPrice(displayPrice)}</span>
      </button>

      {/* Thêm cài đặt - với submenu */}
      <div
        className="relative"
        onMouseEnter={() => onSubMenuOpen(true)}
        onMouseLeave={() => onSubMenuOpen(false)}
      >
        <button className="w-full px-3 py-2 text-left text-[13px] text-[#eaecef] hover:bg-[#2b3139] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SettingsIcon />
            <span>Thêm cài đặt</span>
          </div>
          <ChevronRight />
        </button>

        {subMenuOpen && (
          <div 
            className="absolute left-full top-0 ml-0.5 py-2 rounded-md bg-[#1e2329] border border-[#2b3139]/50 shadow-xl" 
            style={{ minWidth: 160 }}
          >
            <button className="w-full px-3 py-2 text-left text-[13px] text-[#eaecef] hover:bg-[#2b3139]">
              Ẩn thanh công cụ
            </button>
            <button className="w-full px-3 py-2 text-left text-[13px] text-[#eaecef] hover:bg-[#2b3139]">
              Khóa bản vẽ
            </button>
            <button className="w-full px-3 py-2 text-left text-[13px] text-[#eaecef] hover:bg-[#2b3139]">
              Hiển thị lưới
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="my-1.5 h-px bg-[#2b3139]" />

      {/* Xóa bản vẽ */}
      <button
        className="w-full px-3 py-2 text-left text-[13px] text-[#eaecef] hover:bg-[#2b3139] flex items-center gap-3"
        onClick={handleClearHLines}
      >
        <span className="w-4" />
        <span>Xóa bản vẽ</span>
      </button>

      {/* Xóa chỉ báo */}
      <button className="w-full px-3 py-2 text-left text-[13px] text-[#eaecef] hover:bg-[#2b3139] flex items-center gap-3">
        <span className="w-4" />
        <span>Xóa chỉ báo</span>
      </button>

      {/* Divider */}
      <div className="my-1.5 h-px bg-[#2b3139]" />

      {/* Công cụ thời gian */}
      <button className="w-full px-3 py-2 text-left text-[13px] text-[#eaecef] hover:bg-[#2b3139] flex items-center gap-3">
        <ClockIcon />
        <span>Công cụ thời gian</span>
      </button>

      {/* Cài đặt đồ thị */}
      <button className="w-full px-3 py-2 text-left text-[13px] text-[#eaecef] hover:bg-[#2b3139] flex items-center gap-3">
        <ChartIcon />
        <span>Cài đặt đồ thị</span>
      </button>
    </div>
    )}

    {/* Order Modal - Sử dụng TradingForm */}
    <ChartOrderModal
      open={orderModalOpen}
      onClose={() => setOrderModalOpen(false)}
      symbol={selectedSymbol}
      price={displayPrice ?? lastCandleClose ?? 0}
      market={market}
      defaultOrderType={orderModalType}
      availableBalance={availableBalance}
      leverage={leverage}
    />
    </>
  );
};

export default ChartContextMenu;