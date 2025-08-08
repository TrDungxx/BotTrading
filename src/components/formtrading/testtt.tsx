import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  dualSidePosition: boolean;
  onChangeMode: (newMode: boolean) => void;
}

const PositionModeModal: React.FC<Props> = ({
  isOpen,
  onClose,
  dualSidePosition,
  onChangeMode,
}) => {
  const [selectedMode, setSelectedMode] = useState(dualSidePosition);

  useEffect(() => {
    if (isOpen) {
      setSelectedMode(dualSidePosition); // Đồng bộ lại khi mở modal
    }
  }, [isOpen, dualSidePosition]);

  const isChanged = selectedMode !== dualSidePosition;

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
            {dualSidePosition ? 'Hedge (S)' : 'One-way (M)'}
          </span>
        </div>

        {/* One-way Mode */}
        <div
          className={`border rounded p-4 mb-4 cursor-pointer transition ${
            !selectedMode
              ? 'border-primary-500 bg-dark-700'
              : 'border-dark-600 hover:border-primary-500'
          }`}
          onClick={() => setSelectedMode(false)}
        >
          <div className="text-white font-semibold mb-1">Chế độ Tài sản đơn lẻ</div>
          <p className="text-xs text-dark-300">
            Hỗ trợ giao dịch Futures USDⓈ-M bằng cách chỉ sử dụng tài sản ký quỹ duy nhất cho mỗi cặp.
            Có thể bù trừ PNL nội bộ.
          </p>
        </div>

        {/* Hedge Mode */}
        <div
          className={`border rounded p-4 mb-4 cursor-pointer transition ${
            selectedMode
              ? 'border-primary-500 bg-dark-700'
              : 'border-dark-600 hover:border-primary-500'
          }`}
          onClick={() => setSelectedMode(true)}
        >
          <div className="text-white font-semibold mb-1">Chế độ Đa tài sản (Hedge)</div>
          <p className="text-xs text-dark-300">
            Cho phép giao dịch song song Long & Short. PNL không bù trừ. Hỗ trợ Cross Margin.
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
              onChangeMode(selectedMode); // ✅ Gửi đúng hướng chuyển
              onClose();
            }
          }}
        >
          Chuyển sang {selectedMode ? 'One-way (M)' : 'Hedge (S)'}
        </button>
      </div>
    </div>
  );
};

export default PositionModeModal; 