import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  multiAssetsMargin: boolean;
  onChangeMode: (newMode: boolean) => void;
}

const MultiAssetsModeModal: React.FC<Props> = ({
  isOpen,
  onClose,
  multiAssetsMargin,
  onChangeMode,
}) => {
  const [selectedMode, setSelectedMode] = useState(multiAssetsMargin);

  useEffect(() => {
    if (isOpen) {
      setSelectedMode(multiAssetsMargin); // Đồng bộ lại khi mở modal
    }
  }, [isOpen, multiAssetsMargin]);

  const isChanged = selectedMode !== multiAssetsMargin;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-dark-800 w-full max-w-md rounded-lg shadow-lg p-6 relative">
        <button
          className="absolute top-3 right-3 text-dark-300 hover:text-white"
          onClick={onClose}
        >
          <X size={20} />
        </button>

        <div className="text-sm mb-4 font-semibold">
          Chế độ hiện tại:{' '}
          <span className="text-primary-500 font-bold">
            {multiAssetsMargin ? 'Đa tài sản (Multi-Assets)' : 'Tài sản đơn (Single-Asset)'}
          </span>
        </div>

        {/* Single-Asset Mode */}
        <div
          className={`border rounded p-4 mb-4 cursor-pointer transition ${
            !selectedMode
              ? 'border-primary-500 bg-dark-700'
              : 'border-dark-600 hover:border-primary-500'
          }`}
          onClick={() => setSelectedMode(false)}
        >
          <div className="text-white font-semibold mb-1">Chế độ Tài sản đơn</div>
          <p className="text-xs text-dark-300">
            Mỗi tài sản ký quỹ chỉ áp dụng cho cặp giao dịch tương ứng. Không bù trừ PNL giữa các cặp.
          </p>
        </div>

        {/* Multi-Assets Mode */}
        <div
          className={`border rounded p-4 mb-4 cursor-pointer transition ${
            selectedMode
              ? 'border-primary-500 bg-dark-700'
              : 'border-dark-600 hover:border-primary-500'
          }`}
          onClick={() => setSelectedMode(true)}
        >
          <div className="text-white font-semibold mb-1">Chế độ Đa tài sản</div>
          <p className="text-xs text-dark-300">
            Cho phép bù trừ PNL giữa nhiều cặp giao dịch trong cùng một tài sản (ví dụ: USDT).  
            Hỗ trợ quản lý margin hiệu quả hơn.
          </p>
        </div>

        <button
          className={`btn w-full text-sm ${
            isChanged
              ? 'btn-primary'
              : 'bg-dark-600 text-dark-400 cursor-not-allowed'
          }`}
          disabled={!isChanged}
          onClick={() => {
            if (isChanged) {
              onChangeMode(selectedMode); // ✅ Gửi mode mới
              onClose();
            }
          }}
        >
          Chuyển sang {selectedMode ? 'Đa tài sản' : 'Tài sản đơn'}
        </button>
      </div>
    </div>
  );
};

export default MultiAssetsModeModal;
