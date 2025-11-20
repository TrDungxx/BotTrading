import React, { useState } from 'react';

interface MarginModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (mode: 'cross' | 'isolated') => void;
  selectedMode: 'cross' | 'isolated';
  symbol: string;
}

const MarginModeModal: React.FC<MarginModeModalProps> = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  selectedMode, 
  symbol 
}) => {
  const [tempMode, setTempMode] = useState<'cross' | 'isolated'>(selectedMode);

  const handleConfirm = () => {
    onSelect(tempMode);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#1e2329] rounded-lg w-full max-w-md border border-dark-700">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-dark-700">
          <h2 className="text-lg font-semibold text-white">Chế độ Margin</h2>
          <button 
            onClick={onClose}
            className="text-dark-400 hover:text-white transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Symbol Info */}
          <div className="mb-5">
            <span className="text-sm text-white font-medium">{symbol}</span>
            <span className="ml-2 text-xs bg-dark-700 text-dark-300 px-2 py-1 rounded">
              Vĩnh cửu
            </span>
          </div>

          {/* Mode Toggle Buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setTempMode('cross')}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${
                tempMode === 'cross'
                  ? 'bg-blue-500 text-white'
                  : 'bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-white'
              }`}
            >
              Cross
            </button>
            <button
              onClick={() => setTempMode('isolated')}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${
                tempMode === 'isolated'
                  ? 'bg-blue-500 text-white'
                  : 'bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-white'
              }`}
            >
              Isolated
            </button>
          </div>

          {/* Info Text */}
          <div className="text-xs text-dark-400 mb-4">
            * Chuyển chế độ margin chỉ áp dụng cho những hợp đồng được chọn.
          </div>

          {/* Descriptions */}
          <div className="space-y-4 text-xs text-dark-400 leading-relaxed">
            <div>
              <span className="text-white font-medium">* Chế độ Cross Margin:</span> Tất cả vị thế cross margin sử dụng cùng tài sản 
              ký quỹ sẽ chia sẻ số dư tài sản cross margin. Trong thời điểm 
              thanh lý, số dư tài sản ký quỹ của bạn cùng với tất cả vị thế đang mở 
              có thể bị tịch thu.
            </div>
            <div>
              <span className="text-white font-medium">Chế độ Isolated Margin:</span> Lượng margin của vị thế được giới hạn trong 
              một khoảng nhất định. Nếu giảm xuống thấp hơn mức Margin duy trì, 
              vị thế sẽ bị thanh lý, chế độ này cho phép bạn thêm hoặc 
              gỡ margin tùy ý muốn.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-dark-700 space-y-3">
          {/* Confirm Button */}
          <button 
            onClick={handleConfirm}
            className="w-full py-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-gray-900 font-semibold transition-colors"
          >
            Xác nhận
          </button>

          {/* Bottom Text */}
          <div className="text-center text-xs text-yellow-500">
            Chế độ ký quỹ và đòn bẩy mặc định
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarginModeModal;