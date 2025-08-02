import React from 'react';

interface MarginModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (mode: 'cross' | 'isolated') => void;
  selectedMode: 'cross' | 'isolated';
  symbol: string;
}

const MarginModeModal: React.FC<MarginModeModalProps> = ({ isOpen, onClose, onSelect, selectedMode, symbol }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-dark-800 rounded-lg w-full max-w-md p-6 border border-dark-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Chế độ Margin</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-white">✕</button>
        </div>

        <p className="text-sm text-dark-400 mb-4">
          BTCUSDT <span className="bg-dark-700 text-xs px-2 py-0.5 rounded ml-1">Vĩnh cửu</span>
        </p>

        <div className="flex space-x-4 mb-4">
          <button
            onClick={() => onSelect('cross')}
            className={`flex-1 py-2 rounded ${selectedMode === 'cross' ? 'bg-primary-500 text-white' : 'bg-dark-700 text-dark-200 hover:bg-dark-600'}`}
          >
            Cross
          </button>
          <button
            onClick={() => onSelect('isolated')}
            className={`flex-1 py-2 rounded ${selectedMode === 'isolated' ? 'bg-primary-500 text-white' : 'bg-dark-700 text-dark-200 hover:bg-dark-600'}`}
          >
            Isolated
          </button>
        </div>

        <div className="text-xs text-dark-400 space-y-3">
          <p>
            <strong>Chế độ Cross Margin:</strong> Tất cả vị thế cross margin sử dụng chung tài sản ký quỹ sẽ chia sẻ số dư tài sản. Trong thanh lý, toàn bộ tài sản ký quỹ của bạn có thể bị sử dụng.
          </p>
          <p>
            <strong>Chế độ Isolated Margin:</strong> Mỗi vị thế sử dụng lượng margin riêng biệt. Khi bị thanh lý, chỉ riêng vị thế đó ảnh hưởng.
          </p>
        </div>

        <div className="pt-6 text-right">
          <button
            onClick={onClose}
            className="btn btn-primary w-full"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarginModeModal;
