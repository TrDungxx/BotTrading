import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ChartSettings } from '../../../pages/TradingTerminal';

const ITEMS: Array<{
  key: keyof ChartSettings;
  label: string;
  disabled?: boolean;
}> = [
  { key: 'quickOrder',    label: 'Lệnh nhanh' },
  { key: 'pendingOrders', label: 'Lệnh chờ' },
  { key: 'positionTag',   label: 'Vị thế' },
  { key: 'orderHistory',  label: 'Lịch sử đặt lệnh' },
  { key: 'breakEven',     label: 'Giá hòa vốn' },
  { key: 'liquidation',   label: 'Giá thanh lý' },
  { key: 'alerts',        label: 'Cảnh báo giá' },
  { key: 'priceLine',     label: 'Đường giá' },
  { key: 'scale',         label: 'Thang đo', disabled: true },
];

interface Props {
  settings: ChartSettings;
  onToggle: (key: keyof ChartSettings, value: boolean) => void;
  onClose?: () => void;
  triggerRef?: React.RefObject<HTMLElement>; // ✅ Ref của button trigger
}

const SettingControl: React.FC<Props> = ({ settings, onToggle, onClose, triggerRef }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef?.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, triggerRef]);

  // Get trigger button position
  const triggerRect = triggerRef?.current?.getBoundingClientRect();

  const content = (
    <div 
      ref={panelRef}
      className="fixed bg-dark-800 border border-dark-600 rounded-md shadow-lg p-2 w-64 text-sm z-[9999]"
      style={{
        top: triggerRect ? triggerRect.bottom + 4 : 0,
        left: triggerRect ? triggerRect.left : 0,
      }}
    >
      {ITEMS.map((it) => (
        <label
          key={it.key}
          className={`flex items-center justify-between px-3 py-2 hover:bg-dark-700 cursor-pointer rounded
            ${it.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span>{it.label}</span>
          <input
            type="checkbox"
            className="form-checkbox rounded text-primary-500"
            disabled={!!it.disabled}
            checked={settings[it.key]}
            onChange={(e) => onToggle(it.key, e.target.checked)}
          />
        </label>
      ))}

      <div className="flex justify-end pt-1">
        <button
          className="text-xs px-2 py-1 rounded bg-dark-700 hover:bg-dark-600"
          onClick={onClose}
        >
          Đóng
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default SettingControl;