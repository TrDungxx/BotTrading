import React from 'react';

const settings = [
  { label: 'Lệnh nhanh', disabled: false },
  { label: 'Lệnh chờ', disabled: false },
  { label: 'Vị thế', disabled: false },
  { label: 'Lịch sử đặt lệnh', disabled: false },
  { label: 'Giá hòa vốn', disabled: false },
  { label: 'Giá thanh lý', disabled: false },
  { label: 'Cảnh báo giá', disabled: false },
  { label: 'Đường giá', disabled: false },
  { label: 'Thang đo', disabled: true },
];

const SettingControl: React.FC = () => {
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-md shadow-lg p-2 w-64 text-sm">
      {settings.map((item, index) => (
        <label
          key={index}
          className={`flex items-center justify-between px-3 py-2 hover:bg-dark-700 cursor-pointer ${
            item.disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <span>{item.label}</span>
          <input
            type="checkbox"
            disabled={item.disabled}
            className="form-checkbox rounded text-primary-500"
          />
        </label>
      ))}
    </div>
  );
};

export default SettingControl;
