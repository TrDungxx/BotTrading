import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import ChartOrderForm from './ChartOrderForm';

interface PlaceOrderParams {
  market: "spot" | "futures";
  symbol: string;
  side: "BUY" | "SELL";
  type: "LIMIT" | "STOP_MARKET";
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: "GTC" | "IOC" | "FOK";
  positionSide: "LONG" | "SHORT";
  workingType?: "MARK_PRICE" | "LAST";
}

interface SymbolInfo {
  tickSize: number;
  stepSize: number;
  minQty: number;
  minNotional: number;
}

interface ChartOrderModalProps {
  open: boolean;
  onClose: () => void;
  symbol: string;
  price: number;
  market?: 'spot' | 'futures';
  defaultOrderType?: 'limit' | 'stop-limit';
  // Truyền từ parent để tính toán chính xác
  availableBalance?: number;
  leverage?: number;
  // Callback đặt lệnh
  onPlaceOrder?: (params: PlaceOrderParams) => void;
  // Symbol info
  symbolInfo?: SymbolInfo;
}

const ChartOrderModal: React.FC<ChartOrderModalProps> = ({
  open,
  onClose,
  symbol,
  price,
  market = 'futures',
  defaultOrderType = 'limit',
  availableBalance = 0,
  leverage = 10,
  onPlaceOrder,
  symbolInfo,
}) => {
  // Đóng modal khi nhấn Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleEsc);
    }
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  // Prevent scroll when modal open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative bg-[#1e293b] rounded-xl shadow-2xl w-[360px] max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-fluid-4 py-fluid-3 border-b border-[#2b3139]">
          <h3 className="text-fluid-base font-medium text-[#eaecef]">Đặt lệnh</h3>
          <button 
            onClick={onClose}
            className="text-[#848e9c] hover:text-[#eaecef] transition-colors p-1 hover:bg-[#2b3139] rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Content */}
        <div className="max-h-[calc(90vh-60px)] overflow-y-auto">
          <ChartOrderForm
            selectedSymbol={symbol}
            price={price}
            selectedMarket={market}
            defaultOrderType={defaultOrderType}
            onClose={onClose}
            availableBalance={availableBalance}
            leverage={leverage}
            onPlaceOrder={onPlaceOrder}
            symbolInfo={symbolInfo}
          />
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ChartOrderModal;