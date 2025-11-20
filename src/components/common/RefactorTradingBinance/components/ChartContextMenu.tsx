import React, { useEffect, useRef } from 'react';
import { ContextMenuPosition } from '../types';

interface ChartContextMenuProps {
  open: boolean;
  position: ContextMenuPosition | null;
  onClose: () => void;
  onCopyPrice: () => void;
  onAddHorizontalLine: () => void;
  onRemoveDrawings: () => void;
  onRemoveIndicators: () => void;
  onNewLimitOrder: () => void;
  onNewStopOrder: () => void;
  onCreateAlert: () => void;
}

/**
 * Context menu component for chart interactions
 */
export const ChartContextMenu: React.FC<ChartContextMenuProps> = ({
  open,
  position,
  onClose,
  onCopyPrice,
  onAddHorizontalLine,
  onRemoveDrawings,
  onRemoveIndicators,
  onNewLimitOrder,
  onNewStopOrder,
  onCreateAlert,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  /**
   * Close menu when clicking outside
   */
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  if (!open || !position) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] w-64 bg-dark-800 border border-dark-600 rounded-lg shadow-2xl py-2"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {/* Price Actions */}
      <div className="px-2">
        <button
          className="w-full px-4 py-2 text-left hover:bg-dark-700 rounded-lg flex items-center gap-3"
          onClick={() => {
            onCopyPrice();
            onClose();
          }}
        >
          <span className="i-lucide-copy shrink-0" />
          Sao chép giá
        </button>

        <button
          className="w-full px-4 py-2 text-left hover:bg-dark-700 rounded-lg flex items-center gap-3"
          onClick={() => {
            onAddHorizontalLine();
            onClose();
          }}
        >
          <span className="i-lucide-minus shrink-0" />
          Thêm đường ngang
        </button>
      </div>

      <div className="my-2 h-px bg-dark-600" />

      {/* Order Actions */}
      <div className="px-2">
        <button
          className="w-full px-4 py-2 text-left hover:bg-dark-700 rounded-lg"
          onClick={() => {
            onNewLimitOrder();
            onClose();
          }}
        >
          Lệnh Limit mới
        </button>

        <button
          className="w-full px-4 py-2 text-left hover:bg-dark-700 rounded-lg"
          onClick={() => {
            onNewStopOrder();
            onClose();
          }}
        >
          Lệnh Stop mới
        </button>

        <button
          className="w-full px-4 py-2 text-left hover:bg-dark-700 rounded-lg"
          onClick={() => {
            onCreateAlert();
            onClose();
          }}
        >
          Tạo cảnh báo
        </button>
      </div>

      <div className="my-2 h-px bg-dark-600" />

      {/* Chart Actions */}
      <div className="px-2">
        <button
          className="w-full px-4 py-2 text-left hover:bg-dark-700 rounded-lg flex items-center gap-3"
          onClick={() => {
            onRemoveDrawings();
            onClose();
          }}
        >
          Xóa bản vẽ
        </button>

        <button
          className="w-full px-4 py-2 text-left hover:bg-dark-700 rounded-lg flex items-center gap-3"
          onClick={() => {
            onRemoveIndicators();
            onClose();
          }}
        >
          <span className="i-lucide-sliders-horizontal shrink-0" />
          Xóa chỉ báo
        </button>
      </div>

      <div className="my-2 h-px bg-dark-600" />

      {/* Settings */}
      <div className="px-2">
        <button className="w-full px-4 py-2 text-left hover:bg-dark-700 rounded-lg flex items-center gap-3">
          <span className="i-lucide-clock shrink-0" />
          Công cụ thời gian
        </button>

        <button className="w-full px-4 py-2 text-left hover:bg-dark-700 rounded-lg flex items-center gap-3">
          <span className="i-lucide-monitor-cog shrink-0" />
          Cài đặt đồ thị
        </button>
      </div>
    </div>
  );
};