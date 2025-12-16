import React, { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  positionCount?: number; // Số lượng vị thế sẽ đóng
}

const CloseAllPositionsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  positionCount = 0,
}) => {
  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      {/* Modal */}
      <div
        className="relative z-10 w-[380px] rounded-2xl bg-dark-800 border border-dark-600 p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-warning-500/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-fluid-input-sm text-warning-500" />
          </div>
        </div>

        {/* Content */}
        <div className="text-center">
          <p className="text-white text-fluid-sm leading-relaxed">
            Bạn có chắc là muốn đóng tất cả các vị thế ở mức giá thị trường và huỷ bỏ tất cả lệnh?
          </p>
          
          {positionCount > 0 && (
            <p className="text-dark-400 text-xs mt-2">
              ({positionCount} vị thế sẽ được đóng)
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-fluid-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-fluid-4 rounded-lg bg-dark-700 text-white font-medium hover:bg-dark-600 transition-colors"
          >
            Huỷ bỏ
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-2.5 px-fluid-4 rounded-lg bg-[#fcd535] text-black font-medium hover:brightness-95 transition-all"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
};

export default CloseAllPositionsModal;