import React, { useState } from 'react';

interface LeverageModalProps {
  isOpen: boolean;
  onClose: () => void;
  leverage: number;
  onChange: (value: number) => void;
}

const LeverageModal: React.FC<LeverageModalProps> = ({ isOpen, onClose, leverage, onChange }) => {
  const [localLeverage, setLocalLeverage] = useState(leverage);

  const applyChange = () => {
    onChange(localLeverage);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-dark-800 rounded-lg w-full max-w-md p-6 border border-dark-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Điều chỉnh đòn bẩy</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-white">✕</button>
        </div>

        <div className="text-sm text-dark-400 mb-4">Đòn bẩy</div>

        <div className="flex items-center justify-center space-x-4 mb-2">
          <button
            className="btn btn-outline px-2 py-1"
            onClick={() => setLocalLeverage(Math.max(1, localLeverage - 1))}
          >
            -
          </button>

          <div className="text-xl font-bold text-white">{localLeverage}x</div>

          <button
            className="btn btn-outline px-2 py-1"
            onClick={() => setLocalLeverage(Math.min(125, localLeverage + 1))}
          >
            +
          </button>
        </div>

        <input
          type="range"
          min={1}
          max={125}
          step={1}
          value={localLeverage}
          onChange={(e) => setLocalLeverage(Number(e.target.value))}
          className="w-full mt-2"
        />

        <div className="text-xs text-dark-400 mt-4">
          Khi chọn đòn bẩy cao hơn, chẳng hạn như [10x], rủi ro thanh lý sẽ tăng lên. Hãy luôn kiểm soát mức độ rủi ro của bạn.
        </div>

        <div className="pt-6">
          <button onClick={applyChange} className="btn btn-primary w-full">Xác nhận</button>
        </div>
      </div>
    </div>
  );
};

export default LeverageModal;
