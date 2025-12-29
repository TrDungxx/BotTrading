import React, { useState, useCallback } from 'react';

interface LeverageModalProps {
  isOpen: boolean;
  onClose: () => void;
  leverage: number;
  onChange: (value: number) => void;
  maxPosition?: string;
}

// Slider markers - giống Binance
const SLIDER_VALUES = [1, 30, 60, 90, 120, 150];
const SLIDER_LABELS = ['1x', '30x', '60x', '90x', '120x', '150x'];

const LeverageModal: React.FC<LeverageModalProps> = ({ 
  isOpen, 
  onClose, 
  leverage, 
  onChange,
  maxPosition = "480,000,000 USDT"
}) => {
  const [localLeverage, setLocalLeverage] = useState(leverage);

  // Quick leverage buttons
  const quickLeverages = [1, 5, 10, 20, 50, 100];

  // Tính index và progress cho slider
  const getSliderIndex = (value: number): number => {
    for (let i = SLIDER_VALUES.length - 1; i >= 0; i--) {
      if (value >= SLIDER_VALUES[i]) return i;
    }
    return 0;
  };

  const currentIndex = getSliderIndex(localLeverage);
  const maxIndex = SLIDER_VALUES.length - 1;
  
  // Tính progress percent dựa trên giá trị thực tế (1-150)
  const progressPercent = ((localLeverage - 1) / 149) * 100;

  const handleSliderSelect = useCallback((index: number) => {
    setLocalLeverage(SLIDER_VALUES[index]);
  }, []);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    
    // Tính giá trị leverage từ 1-150 dựa trên vị trí click
    const leverageValue = Math.round(1 + ratio * 149);
    setLocalLeverage(leverageValue);
  };

  const handleDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const track = e.currentTarget.parentElement;
    if (!track) return;

    const onMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const rect = track.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      
      // Tính giá trị leverage từ 1-150
      const leverageValue = Math.round(1 + ratio * 149);
      setLocalLeverage(leverageValue);
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

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
              className="w-10 h-fluid-input rounded border border-[#2b3139] hover:border-[#474d57]  text-[#848e9c] hover:text-[#eaecef] transition-colors flex items-center justify-center text-xl font-light"
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

          {/* Quick Leverage Buttons */}
          <div className="grid grid-cols-6 gap-fluid-2 mb-6">
            {quickLeverages.map((value) => (
              <button
                key={value}
                onClick={() => handleQuickSelect(value)}
                className={`py-2 px-fluid-3 rounded text-fluid-sm font-medium transition-all ${
                  localLeverage === value
                    ? 'bg-blue-500 text-white-400'
                    : 'bg-[#2b3139] text-[#848e9c] hover:bg-[#474d57] hover:text-[#eaecef]'
                }`}
              >
                {value}x
              </button>
            ))}
          </div>

          {/* ✅ NEW: Custom Slider - PercentSlider Style */}
          <div className="select-none mb-8 px-1">
            {/* Slider Track */}
            <div className="pt-2 pb-1">
              <div
                className="relative h-1 bg-[#2b3139] rounded-full cursor-pointer"
                onClick={handleTrackClick}
              >
                {/* Progress Bar */}
                <div
                  className="absolute left-0 top-0 h-full bg-[#3b82f6] rounded-full transition-all duration-150"
                  style={{ width: `${progressPercent}%` }}
                />

                {/* Dots */}
                {SLIDER_VALUES.map((value, index) => {
                  const dotPosition = ((value - 1) / 149) * 100;
                  return (
                    <div
                      key={index}
                      className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border-2 transition-all duration-150 ${
                        localLeverage >= value
                          ? "bg-[#3b82f6] border-[#3b82f6]"
                          : "bg-[#1e2329] border-[#474d57]"
                      }`}
                      style={{ left: `${dotPosition}%` }}
                    />
                  );
                })}

                {/* Thumb */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-[#3b82f6] rounded-full cursor-grab active:cursor-grabbing transition-all duration-150 hover:scale-110 z-10 border-2 border-[#1e2329] shadow-md"
                  style={{ left: `${progressPercent}%` }}
                  onMouseDown={handleDrag}
                />
              </div>
            </div>

            {/* Leverage Labels */}
            <div className="relative h-5 mt-2">
              {SLIDER_VALUES.map((value, index) => {
                const labelPosition = ((value - 1) / 149) * 100;
                return (
                  <button
                    key={value}
                    onClick={() => handleSliderSelect(index)}
                    className={`absolute -translate-x-1/2 text-xs font-medium px-0 py-0 rounded transition-all duration-150 ${
                      localLeverage === value
                        ? "text-[#3b82f6]"
                        : "text-[#848e9c] hover:text-[#eaecef]"
                    }`}
                    style={{ left: `${labelPosition}%` }}
                  >
                    {SLIDER_LABELS[index]}
                  </button>
                );
              })}
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
    </div>
  );
};

export default LeverageModal;