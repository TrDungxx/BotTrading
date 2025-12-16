// UnitSelectModal.tsx
import React from "react";

interface UnitSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseAsset: string; // e.g., "DOGE"
  selectedUnit: "base" | "quote"; // "base" = DOGE, "quote" = USDT
  onSelectUnit: (unit: "base" | "quote") => void;
}

const UnitSelectModal: React.FC<UnitSelectModalProps> = ({
  isOpen,
  onClose,
  baseAsset,
  selectedUnit,
  onSelectUnit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-dark-800 rounded-xl border border-dark-600 w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-fluid-4 border-b border-dark-700">
          <h3 className="text-fluid-base font-semibold text-white">Đơn vị tạo lệnh</h3>
          <button
            onClick={onClose}
            className="text-dark-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-fluid-4 space-y-3">
          {/* Base Asset Option */}
          <button
            onClick={() => {
              onSelectUnit("base");
              onClose();
            }}
            className={`w-full text-left p-fluid-4 rounded-lg border transition-all ${
              selectedUnit === "base"
                ? "border-primary-500 bg-primary-500/10"
                : "border-dark-700 bg-dark-900/50 hover:border-dark-600"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-semibold text-fluid-base">{baseAsset}</div>
                <div className="text-dark-400 text-fluid-sm mt-1">
                  Nhập và hiển thị quy mô lệnh bằng {baseAsset}.
                </div>
              </div>
              {selectedUnit === "base" && (
                <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0 ml-3">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          </button>

          {/* Quote Asset Option */}
          <button
            onClick={() => {
              onSelectUnit("quote");
              onClose();
            }}
            className={`w-full text-left p-fluid-4 rounded-lg border transition-all ${
              selectedUnit === "quote"
                ? "border-primary-500 bg-primary-500/10"
                : "border-dark-700 bg-dark-900/50 hover:border-dark-600"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-semibold text-fluid-base">USDT</div>
                <div className="text-dark-400 text-fluid-sm mt-1">
                  Nhập và hiển thị quy mô lệnh bằng USDT. Để xét lệnh bằng khoản ký quỹ bạn đầu
                  và nhập số tiền ký quỹ bạn muốn sử dụng.
                </div>
                <div className="flex items-center gap-fluid-3 mt-3">
                  <label className="flex items-center gap-fluid-2 cursor-pointer">
                    <input
                      type="radio"
                      name="usdt-mode"
                      value="total"
                      defaultChecked
                      className="form-radio w-4 h-4"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-white text-fluid-sm">Quy mô lệnh</span>
                  </label>
                  <label className="flex items-center gap-fluid-2 cursor-pointer">
                    <input
                      type="radio"
                      name="usdt-mode"
                      value="margin"
                      className="form-radio w-4 h-4"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-white text-fluid-sm">Ký quỹ ban đầu</span>
                  </label>
                </div>
              </div>
              {selectedUnit === "quote" && (
                <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0 ml-3">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        </div>

        {/* Footer Note */}
        <div className="px-fluid-4 pb-4">
          <div className="flex items-start gap-fluid-2 p-fluid-3 bg-dark-900/50 rounded-lg border border-dark-700">
            <svg className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-dark-400">
              Giao dịch Hợp đồng Tương lai với tài sản linh hoạt <span className="text-primary-400">hoạt</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnitSelectModal;