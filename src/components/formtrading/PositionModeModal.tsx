
import React from 'react';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  dualSidePosition: boolean;
  onChangeMode: () => void;
}

const PositionModeModal: React.FC<Props> = ({ isOpen, onClose, dualSidePosition, onChangeMode }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-dark-800 w-full max-w-md rounded-lg shadow-lg p-6 relative">
        <button className="absolute top-3 right-3 text-dark-300 hover:text-white" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="text-sm mb-4 font-semibold">USDⓈ-{dualSidePosition ? 'S' : 'M'}</div>

        <div className={`border rounded p-4 mb-4 ${!dualSidePosition ? 'border-primary-500 bg-dark-700' : 'border-dark-600'}`}>
          <div className="text-white font-semibold mb-1">Chế độ Tài sản đơn lẻ</div>
          <p className="text-xs text-dark-300">
            Hỗ trợ giao dịch Futures USDⓈ-M bằng cách chỉ sử dụng tài sản ký quỹ duy nhất cho mỗi cặp. Có thể bù trừ PNL nội bộ...
          </p>
        </div>

        <div className={`border rounded p-4 mb-4 ${dualSidePosition ? 'border-primary-500 bg-dark-700' : 'border-dark-600'}`}>
          <div className="text-white font-semibold mb-1">Chế độ Đa tài sản</div>
          <p className="text-xs text-dark-300">
            Cho phép giao dịch song song Long & Short. PNL không bù trừ. Hỗ trợ Cross Margin.
          </p>
        </div>

        <button
          className="btn btn-primary w-full text-sm"
          onClick={() => {
            onChangeMode();
            onClose();
          }}
        >
          Chuyển sang {dualSidePosition ? 'One-way (M)' : 'Hedge (S)'}
        </button>
      </div>
    </div>
  );
};

export default PositionModeModal;
