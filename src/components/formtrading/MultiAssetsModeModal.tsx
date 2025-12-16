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
      setSelectedMode(multiAssetsMargin);
    }
  }, [isOpen, multiAssetsMargin]);

  const isChanged = selectedMode !== multiAssetsMargin;

  const handleConfirm = () => {
    if (isChanged) {
      onChangeMode(selectedMode);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-fluid-4">
      <div className="bg-[#1e2329] w-full max-w-lg rounded-lg shadow-xl border border-dark-700">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-dark-700">
          <h2 className="text-lg font-semibold text-white">
            Chế độ hiện tại: <span className="text-blue-500">{multiAssetsMargin ? 'Đa tài sản (Multi-Assets)' : 'Tài sản đơn'}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-dark-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Mode Selection Cards */}
          <div className="space-y-3 mb-5">
            {/* Single Asset Mode Card */}
            <button
              onClick={() => setSelectedMode(false)}
              className={`w-full text-left p-fluid-4 rounded-lg border-2 transition-all ${
                !selectedMode 
                  ? 'border-blue-500 bg-blue-500/10' 
                  : 'border-dark-600 bg-dark-800/50 hover:border-dark-500'
              }`}
            >
              <div className="flex items-start space-x-4">
                {/* Icon */}
                <div className={`flex-shrink-0 w-12 h-fluid-input-lg rounded-lg flex items-center justify-center ${
                  !selectedMode ? 'bg-blue-500/20' : 'bg-dark-700'
                }`}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-cyan-400">
                    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className="text-fluid-base font-medium text-white mb-2">Chế độ Tài sản đơn lẻ</h3>
                  <p className="text-xs text-dark-400 leading-relaxed">
                    Mỗi tài sản ký quỹ chỉ áp dụng cho cặp giao dịch tương ứng. 
                    Không bù trừ PNL giữa các cặp.
                  </p>
                </div>

                {/* Radio Button */}
                <div className="flex-shrink-0 mt-1">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    !selectedMode 
                      ? 'border-blue-500 bg-blue-500' 
                      : 'border-dark-500'
                  }`}>
                    {!selectedMode && (
                      <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                        <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            </button>

            {/* Multi-Assets Mode Card */}
            <button
              onClick={() => setSelectedMode(true)}
              className={`w-full text-left p-fluid-4 rounded-lg border-2 transition-all ${
                selectedMode 
                  ? 'border-blue-500 bg-blue-500/10' 
                  : 'border-dark-600 bg-dark-800/50 hover:border-dark-500'
              }`}
            >
              <div className="flex items-start space-x-4">
                {/* Icon - Multi Coins */}
                <div className={`flex-shrink-0 w-12 h-fluid-input-lg rounded-lg flex items-center justify-center relative ${
                  selectedMode ? 'bg-blue-500/20' : 'bg-dark-700'
                }`}>
                  <div className="relative w-9 h-9">
                    {/* BTC */}
                    <div className="absolute top-0 left-0 w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-fluid-xs font-bold text-white shadow-lg z-10 border-2 border-[#1e2329]">
                      ₿
                    </div>
                    {/* ETH */}
                    <div className="absolute top-0.5 left-2 w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-fluid-xs font-bold text-white shadow-lg z-20 border-2 border-[#1e2329]">
                      Ξ
                    </div>
                    {/* USDT */}
                    <div className="absolute top-1 left-4 w-6 h-6 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-fluid-xs font-bold text-white shadow-lg z-30 border-2 border-[#1e2329]">
                      ₮
                    </div>
                    {/* Plus */}
                    <div className="absolute top-1.5 left-6 w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-fluid-sm font-bold text-white shadow-lg z-40 border-2 border-[#1e2329]">
                      +
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className="text-fluid-base font-medium text-white mb-2">Chế độ Đa tài sản</h3>
                  <p className="text-xs text-dark-400 leading-relaxed">
                    Cho phép bù trừ PNL giữa nhiều cặp giao dịch cùng một tài sản ký quỹ (vd: USDT). 
                    Hỗ trợ quản lý margin hiệu quả hơn.
                  </p>
                </div>

                {/* Radio Button */}
                <div className="flex-shrink-0 mt-1">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedMode 
                      ? 'border-blue-500 bg-blue-500' 
                      : 'border-dark-500'
                  }`}>
                    {selectedMode && (
                      <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                        <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            </button>
          </div>

          {/* Warning Notice */}
          <div className="bg-dark-900/50 rounded-lg p-fluid-4 mb-5">
            <p className="text-xs text-dark-400 leading-relaxed">
              * Xin lưu ý rằng việc thay đổi chế độ ký quỹ cũng sẽ áp dụng cho các vị thế mở và lệnh đang mở.
            </p>
          </div>

          {/* Additional Info (Optional) */}
          <div className="text-xs text-dark-400 leading-relaxed gap-fluid-2">
            <p>
              <span className="text-yellow-500">*</span> Xin lưu ý rằng người dùng chỉ có thể dùng BFUSD làm tài sản thế chấp ở Chế độ đa tài sản. 
              Việc chuyển sang Chế độ một tài sản có thể làm thay đổi giá thanh lý vị thế do giảm mức ký quỹ.
            </p>
            <p>
              Chế độ đa tài sản chỉ áp dụng cho Hợp đồng tương lai USD⊗-M. Trước khi kích hoạt Chế độ đa tài sản, vui lòng đọc{' '}
              <a 
                href="#" 
                className="text-yellow-500 underline hover:text-yellow-400 transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  // Handle navigation to help guide
                }}
              >
                hướng dẫn
              </a>{' '}
              chi tiết để quản lý rủi ro tài khoản USD⊗-M Futures hiệu quả hơn khi sử dụng Chế độ đa tài sản.
            </p>
          </div>
        </div>

        {/* Footer - Confirm Button */}
        <div className="p-5 border-t border-dark-700">
          <button
            onClick={handleConfirm}
            disabled={!isChanged}
            className={`w-full py-fluid-3 rounded-lg font-medium transition-all ${
              isChanged
                ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
                : 'bg-dark-700 text-dark-500 cursor-not-allowed'
            }`}
          >
            {isChanged 
              ? `Chuyển sang ${selectedMode ? 'Đa tài sản' : 'Tài sản đơn'}` 
              : 'Xác nhận'
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiAssetsModeModal;