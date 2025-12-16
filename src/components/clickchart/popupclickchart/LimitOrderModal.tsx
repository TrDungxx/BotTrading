import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface LimitOrderModalProps {
  open: boolean;
  onClose: () => void;
  symbol: string;
  defaultPrice: number | null;
  tickSize: number;
  pricePrecision: number;
  maxQty?: number;
  onSubmit: (order: {
    side: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    type: 'LIMIT' | 'STOP_LIMIT';
  }) => void;
}

const LimitOrderModal: React.FC<LimitOrderModalProps> = ({
  open,
  onClose,
  symbol,
  defaultPrice,
  tickSize,
  pricePrecision,
  maxQty = 0,
  onSubmit,
}) => {
  const [tab, setTab] = useState<'open' | 'close'>('open');
  const [orderType, setOrderType] = useState<'limit' | 'stopLimit'>('limit');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [sliderValue, setSliderValue] = useState(0);
  const [unit, setUnit] = useState<'USDT' | 'COIN'>('COIN');

  // Lấy tên coin từ symbol (VD: DOGEUSDT -> DOGE)
  const coinName = symbol.replace('USDT', '').replace('BUSD', '');

  // Reset form khi mở modal
  useEffect(() => {
    if (open && defaultPrice != null) {
      setPrice(defaultPrice.toFixed(pricePrecision));
      setQuantity('');
      setSliderValue(0);
    }
  }, [open, defaultPrice, pricePrecision]);

  // Update quantity khi kéo slider
  useEffect(() => {
    if (maxQty > 0 && sliderValue > 0) {
      const qty = (maxQty * sliderValue) / 100;
      setQuantity(qty.toFixed(2));
    }
  }, [sliderValue, maxQty]);

  const handleSubmit = (side: 'BUY' | 'SELL') => {
    const priceNum = parseFloat(price);
    const qtyNum = parseFloat(quantity);
    
    if (isNaN(priceNum) || isNaN(qtyNum) || qtyNum <= 0) {
      return;
    }

    onSubmit({
      side,
      price: priceNum,
      quantity: qtyNum,
      type: orderType === 'limit' ? 'LIMIT' : 'STOP_LIMIT',
    });
    onClose();
  };

  if (!open) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-[#1e2329] rounded-lg shadow-2xl w-[340px] max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-fluid-4 py-fluid-3 border-b border-[#2b3139]">
          <h3 className="text-fluid-base font-medium text-[#eaecef]">Đặt lệnh</h3>
          <button 
            onClick={onClose}
            className="text-[#848e9c] hover:text-[#eaecef] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-fluid-4">
          {/* Tabs Mở/Đóng */}
          <div className="flex bg-[#2b3139] rounded-lg p-1 mb-4">
            <button
              className={`flex-1 py-2 text-fluid-sm rounded-fluid-md transition-colors ${
                tab === 'open' 
                  ? 'bg-[#3c4043] text-[#eaecef]' 
                  : 'text-[#848e9c] hover:text-[#eaecef]'
              }`}
              onClick={() => setTab('open')}
            >
              Mở
            </button>
            <button
              className={`flex-1 py-2 text-fluid-sm rounded-fluid-md transition-colors ${
                tab === 'close' 
                  ? 'bg-[#3c4043] text-[#eaecef]' 
                  : 'text-[#848e9c] hover:text-[#eaecef]'
              }`}
              onClick={() => setTab('close')}
            >
              Đóng
            </button>
          </div>

          {/* Order Type Tabs */}
          <div className="flex items-center gap-fluid-4 mb-4">
            <button
              className={`text-fluid-sm pb-1 border-b-2 transition-colors ${
                orderType === 'limit'
                  ? 'text-[#f0b90b] border-[#f0b90b]'
                  : 'text-[#848e9c] border-transparent hover:text-[#eaecef]'
              }`}
              onClick={() => setOrderType('limit')}
            >
              Giới hạn
            </button>
            <button
              className={`text-fluid-sm pb-1 border-b-2 transition-colors ${
                orderType === 'stopLimit'
                  ? 'text-[#f0b90b] border-[#f0b90b]'
                  : 'text-[#848e9c] border-transparent hover:text-[#eaecef]'
              }`}
              onClick={() => setOrderType('stopLimit')}
            >
              Stop Limit
            </button>
            <button className="ml-auto text-[#848e9c] hover:text-[#eaecef]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </button>
          </div>

          {/* Price Input */}
          <div className="mb-3">
            <label className="text-xs text-[#848e9c] mb-1.5 block">Giá</label>
            <div className="flex">
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="flex-1 bg-[#2b3139] border border-[#3c4043] rounded-l px-fluid-3 py-2.5 text-fluid-sm text-[#eaecef] outline-none focus:border-[#f0b90b]"
                placeholder="0"
              />
              <button className="px-fluid-3 py-2.5 bg-[#2b3139] border border-l-0 border-[#3c4043] text-fluid-sm text-[#eaecef]">
                USDT
              </button>
              <button className="px-fluid-3 py-2.5 bg-[#2b3139] border border-l-0 border-[#3c4043] rounded-r text-fluid-sm text-[#848e9c] hover:text-[#eaecef]">
                BBO
              </button>
            </div>
          </div>

          {/* Quantity Input */}
          <div className="mb-3">
            <label className="text-xs text-[#848e9c] mb-1.5 block">Số lượng</label>
            <div className="flex">
              <input
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="flex-1 bg-[#2b3139] border border-[#3c4043] rounded-l px-fluid-3 py-2.5 text-fluid-sm text-[#eaecef] outline-none focus:border-[#f0b90b]"
                placeholder="0"
              />
              <button 
                className="px-fluid-3 py-2.5 bg-[#2b3139] border border-l-0 border-[#3c4043] rounded-r text-fluid-sm text-[#eaecef] flex items-center gap-fluid-1"
                onClick={() => setUnit(unit === 'COIN' ? 'USDT' : 'COIN')}
              >
                {coinName}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Slider */}
          <div className="mb-4 px-1">
            <div className="flex items-center gap-fluid-2">
              <svg className="w-4 h-4 text-[#848e9c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              </svg>
              <input
                type="range"
                min="0"
                max="100"
                value={sliderValue}
                onChange={(e) => setSliderValue(parseInt(e.target.value))}
                className="flex-1 h-1 bg-[#2b3139] rounded-lg appearance-none cursor-pointer accent-[#f0b90b]"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-fluid-3 mb-4">
            <button
              onClick={() => handleSubmit('BUY')}
              className="flex-1 py-2.5 bg-[#0ecb81] hover:bg-[#0ecb81]/90 text-white text-fluid-sm font-medium rounded transition-colors"
            >
              Mở lệnh Long
            </button>
            <button
              onClick={() => handleSubmit('SELL')}
              className="flex-1 py-2.5 bg-[#f6465d] hover:bg-[#f6465d]/90 text-white text-fluid-sm font-medium rounded transition-colors"
            >
              Mở lệnh Short
            </button>
          </div>

          {/* Info Footer */}
          <div className="flex justify-between text-xs">
            <div className="text-[#848e9c]">
              <div>Giá thanh lý <span className="text-[#eaecef]">-- USDT</span></div>
              <div>Chi phí <span className="text-[#eaecef]">0,00 USDT</span></div>
              <div>Tối đa <span className="text-[#eaecef]">{maxQty.toFixed(3)} {coinName}</span></div>
            </div>
            <div className="text-[#848e9c] text-right">
              <div>Giá thanh lý <span className="text-[#eaecef]">-- USDT</span></div>
              <div>Chi phí <span className="text-[#eaecef]">0,00 USDT</span></div>
              <div>Tối đa <span className="text-[#eaecef]">{maxQty.toFixed(3)} {coinName}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default LimitOrderModal;