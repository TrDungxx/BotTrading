import React from 'react';
import type { ChartSettings } from '../../../pages/TradingTerminal';

const ITEMS: Array<{
  key: keyof ChartSettings;
  label: string;
  disabled?: boolean;
}> = [
  { key: 'quickOrder',    label: 'Lệnh nhanh' },
  { key: 'pendingOrders', label: 'Lệnh chờ' },
  { key: 'positionTag',   label: 'Vị thế' },            // 👈 đang dùng
  { key: 'orderHistory',  label: 'Lịch sử đặt lệnh' },
  { key: 'breakEven',     label: 'Giá hòa vốn' },
  { key: 'liquidation',   label: 'Giá thanh lý' },
  { key: 'alerts',        label: 'Cảnh báo giá' },
  { key: 'priceLine',     label: 'Đường giá' },
  { key: 'scale',         label: 'Thang đo', disabled: true }, // như form cũ
];

interface Props {
  settings: ChartSettings;
  onToggle: (key: keyof ChartSettings, value: boolean) => void;
  onClose?: () => void;
}

const SettingControl: React.FC<Props> = ({ settings, onToggle, onClose }) => {
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-md shadow-lg p-2 w-64 text-sm">
      {ITEMS.map((it) => (
        <label
          key={it.key}
          className={`flex items-center justify-between px-3 py-2 hover:bg-dark-700 cursor-pointer
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
};

export default SettingControl;
