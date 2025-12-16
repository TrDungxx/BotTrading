import React, { useState } from 'react';

interface LeverageModalProps {
  isOpen: boolean;
  onClose: () => void;
  leverage: number;
  onChange: (value: number) => void;
  maxPosition?: string;
}

const LeverageModal: React.FC<LeverageModalProps> = ({ 
  isOpen, 
  onClose, 
  leverage, 
  onChange,
  maxPosition = "480,000,000 USDT"
}) => {
  const [localLeverage, setLocalLeverage] = useState(leverage);

  // ✅ Quick leverage buttons
  const quickLeverages = [1, 5, 10, 20, 50, 100];
  
  // ✅ Slider markers
  const sliderMarkers = [
    { value: 1, label: '1x' },
    { value: 30, label: '30x' },
    { value: 60, label: '60x' },
    { value: 90, label: '90x' },
    { value: 120, label: '120x' },
    { value: 150, label: '150x' },
  ];

  const applyChange = () => {
    onChange(localLeverage);
    onClose();
  };

  const handleQuickSelect = (value: number) => {
    setLocalLeverage(value);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-[#1e2329] rounded-lg w-full max-w-md mx-4 border border-[#2b3139]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-fluid-4 border-b border-[#2b3139]">
          <h2 className="text-lg font-semibold text-[#eaecef]">Điều chỉnh đòn bẩy</h2>
          <button 
            onClick={onClose} 
            className="text-[#848e9c] hover:text-[#eaecef] transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Label */}
          <div className="text-fluid-sm text-[#848e9c] mb-4">Đòn bẩy</div>

          {/* Leverage Control with +/- buttons */}
          <div className="flex items-center justify-center space-x-6 mb-6">
            <button
              className="w-10 h-fluid-input rounded border border-[#2b3139] hover:border-[#474d57] text-[#848e9c] hover:text-[#eaecef] transition-colors flex items-center justify-center text-xl font-light"
              onClick={() => setLocalLeverage(Math.max(1, localLeverage - 1))}
            >
              −
            </button>

            <div className="text-3xl font-bold text-[#eaecef] min-w-[100px] text-center">
              {localLeverage}<span className="text-2xl">x</span>
            </div>

            <button
              className="w-10 h-fluid-input rounded border border-[#2b3139] hover:border-[#474d57] text-[#848e9c] hover:text-[#eaecef] transition-colors flex items-center justify-center text-xl font-light"
              onClick={() => setLocalLeverage(Math.min(150, localLeverage + 1))}
            >
              +
            </button>
          </div>

          {/* ✅ Quick Leverage Buttons */}
          <div className="grid grid-cols-6 gap-fluid-2 mb-6">
            {quickLeverages.map((value) => (
              <button
                key={value}
                onClick={() => handleQuickSelect(value)}
                className={`py-2 px-fluid-3 rounded text-fluid-sm font-medium transition-all ${
                  localLeverage === value
                    ? 'bg-[#fcd535] text-[#1e2329]'
                    : 'bg-[#2b3139] text-[#848e9c] hover:bg-[#474d57] hover:text-[#eaecef]'
                }`}
              >
                {value}x
              </button>
            ))}
          </div>

          {/* ✅ Custom Slider - Binance Style */}
          <div className="relative mb-8 px-1">
            {/* Slider Container */}
            <div className="relative pt-2 pb-6">
              <input
                type="range"
                min={1}
                max={150}
                step={1}
                value={localLeverage}
                onChange={(e) => setLocalLeverage(Number(e.target.value))}
                className="leverage-slider"
              />
              
              {/* Progress Fill */}
              <div 
                className="absolute top-fluid-2 left-0 h-1 bg-[#3b82f6] rounded-full pointer-events-none"
                style={{ 
                  width: `${((localLeverage - 1) / 149) * 100}%`,
                  transition: 'width 0.1s ease'
                }}
              />

              {/* Markers */}
              {sliderMarkers.map((marker) => (
                <div 
                  key={marker.value}
                  className="absolute"
                  style={{ 
                    left: `${((marker.value - 1) / 149) * 100}%`,
                    top: '0',
                    transform: 'translateX(-50%)'
                  }}
                >
                  {/* Marker Dot */}
                  <div 
                    className={`w-2 h-2 rounded-full mb-1 ${
                      localLeverage >= marker.value ? 'bg-[#3b82f6]' : 'bg-[#474d57]'
                    }`}
                  />
                  {/* Marker Label */}
                  <div className="text-xs text-[#848e9c] whitespace-nowrap">
                    {marker.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Max Position Info */}
          <div className="text-fluid-sm text-[#848e9c] mb-4">
            * Vị thế tối đa {maxPosition}
          </div>

          {/* Warning Text */}
          <div className="text-xs text-[#848e9c] leading-relaxed mb-4">
            Xin lưu ý rằng việc thay đổi đòn bẩy cũng sẽ áp dụng cho các vị thế mở và lệnh đang mở.
          </div>

          {/* Risk Warning */}
          <div className="text-xs text-[#f6465d] leading-relaxed mb-6">
            * Khi chọn đòn bẩy cao hơn, chẳng hạn như [10x], rủi ro thanh lý sẽ tăng lên. 
            Hãy luôn kiểm soát mức độ rủi ro của bạn.{' '}
            <a 
              href="#" 
              className="underline hover:text-[#ef4444]"
              onClick={(e) => {
                e.preventDefault();
              }}
            >
              Xem bài viết trợ giúp
            </a>{' '}
            của chúng tôi để biết thêm thông tin.
          </div>

          {/* Additional Links */}
          <div className="space-y-3 mb-6">
            <button 
              className="w-full text-left text-fluid-sm text-[#848e9c] hover:text-[#eaecef] flex items-center justify-between group transition-colors py-fluid-1"
              onClick={() => {}}
            >
              <span>Kiểm tra bảng tỷ lệ Đòn bẩy & số tiền Ký quỹ</span>
              <span className="text-[#474d57] group-hover:text-[#848e9c]">›</span>
            </button>
            
            <button 
              className="w-full text-left text-fluid-sm text-[#848e9c] hover:text-[#eaecef] flex items-center justify-between group transition-colors py-fluid-1"
              onClick={() => {}}
            >
              <span>Tăng hạn mức vị thế</span>
              <span className="text-[#474d57] group-hover:text-[#848e9c]">›</span>
            </button>
          </div>

          {/* Confirm Button */}
          <button 
            onClick={applyChange} 
            className="btn btn-primary w-full py-fluid-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Xác nhận
          </button>

          {/* Footer Text */}
          <div className="mt-4 text-center text-xs text-[#fcd535]">
            Chế độ ký quỹ và đòn bẩy mặc định
          </div>
        </div>
      </div>

      <style jsx>{`
        .leverage-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 4px;
          background: #2b3139;
          border-radius: 2px;
          outline: none;
          position: relative;
          cursor: pointer;
        }

        .leverage-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 4px solid #1e2329;
          box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2);
          position: relative;
          z-index: 10;
          transition: all 0.2s ease;
        }

        .leverage-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 4px solid #1e2329;
          box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2);
          position: relative;
          z-index: 10;
          transition: all 0.2s ease;
        }

        .leverage-slider::-webkit-slider-thumb:hover {
          background: #2563eb;
          transform: scale(1.1);
        }

        .leverage-slider::-moz-range-thumb:hover {
          background: #2563eb;
          transform: scale(1.1);
        }

        .leverage-slider::-webkit-slider-thumb:active {
          transform: scale(1.15);
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .leverage-slider::-moz-range-thumb:active {
          transform: scale(1.15);
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        /* Remove default track styling for Firefox */
        .leverage-slider::-moz-range-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
};

export default LeverageModal;