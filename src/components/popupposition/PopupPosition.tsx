import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  pnlNow?: number;
  takeProfit?: string;
  stopLoss?: string;
  onSubmit: (tp: string, sl: string) => void;
}

const PopupPosition: React.FC<Props> = ({
  isOpen,
  onClose,
  pnlNow = 0,
  takeProfit = '',
  stopLoss = '',
  onSubmit,
}) => {
  const [tpValue, setTpValue] = React.useState(takeProfit);
  const [slValue, setSlValue] = React.useState(stopLoss);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-dark-800 p-6 w-[400px] rounded relative text-white">
        <button
          className="absolute top-fluid-3 right-3 text-white hover:text-red-400"
          onClick={onClose}
        >
          ✕
        </button>

        <h2 className="text-lg font-bold mb-4">Đóng tất cả dựa trên PnL</h2>

        <div className="text-fluid-sm text-dark-400 mb-1">PnL hiện tại</div>
        <div className="text-lg text-red-500 mb-4">{pnlNow.toFixed(2)} USD</div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Take Profit (USD)</label>
            <input
              type="text"
              className="form-input w-full"
              value={tpValue}
              onChange={(e) => setTpValue(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Stop Loss (USD)</label>
            <input
              type="text"
              className="form-input w-full"
              value={slValue}
              onChange={(e) => setSlValue(e.target.value)}
            />
          </div>
        </div>

        <p className="text-xs text-dark-400 mt-4">
          * Khi tổng PnL của bạn đạt tới mục tiêu, hệ thống sẽ tự động đóng tất cả vị thế bằng lệnh thị trường.
        </p>

        <button
          className="btn btn-primary w-full mt-4"
          onClick={() => onSubmit(tpValue, slValue)}
        >
          Xác nhận
        </button>
      </div>
    </div>
  );
};

export default PopupPosition;
