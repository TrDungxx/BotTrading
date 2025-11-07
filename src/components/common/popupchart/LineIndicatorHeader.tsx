import React from 'react';
import { Eye, EyeOff, Settings as SettingsIcon, X } from 'lucide-react'; // 👈
export interface IndicatorValue {
  name: string;
  period?: number;
  value: number;
  color: string;
  visible?: boolean;
}

interface LineIndicatorHeaderProps {
  indicators: IndicatorValue[];
  visible: boolean;
  onToggleVisible: () => void;
  onOpenSetting: () => void;
  onClose: () => void;
  type?: 'main' | 'volume';
}

const LineIndicatorHeader: React.FC<LineIndicatorHeaderProps> = ({
  indicators,
  visible,
  onToggleVisible,
  onOpenSetting,
  onClose,
  type = 'main',    
}) => {
  const visibleIndicators = indicators.filter(ind => ind.visible !== false);

  return (
    <div className="absolute top-2 left-2 z-10 flex items-center gap-2 select-none">
      {/* Indicator Name & Toggle */}
      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-dark-800/80 backdrop-blur-sm border border-dark-600/50">
        <button onClick={onToggleVisible} className="flex items-center gap-1 hover:opacity-80 transition-opacity" title={visible ? 'Ẩn tất cả' : 'Hiện tất cả'}>
  {visible ? <Eye size={12} className="text-primary" /> : <EyeOff size={12} className="text-dark-400" />}
  <span className="text-xs font-medium text-dark-200">{type === 'main' ? 'Indicators' : 'Volume'}</span>
</button>

        {/* Settings Button */}
        <button onClick={onOpenSetting} className="p-0.5 hover:bg-dark-700 rounded transition-colors" title="Cài đặt">
  <SettingsIcon size={12} className="text-dark-300" />  {/* 👈 thay span icon */}
</button>

        {/* Close Button */}
        <button onClick={onClose} className="p-0.5 hover:bg-dark-700 rounded transition-colors" title="Đóng">
  <X size={12} className="text-dark-300" /> {/* 👈 thay span icon */}
</button>
      </div>

      {/* Indicator Values */}
      {visible && visibleIndicators.length > 0 && (
        <div className="flex items-center gap-2 px-2 py-1 rounded bg-dark-800/80 backdrop-blur-sm border border-dark-600/50">
          {visibleIndicators.map((ind, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: ind.color }}
              />
              <span className="text-xs font-medium text-dark-200">
                {ind.name}
                {ind.period && `(${ind.period})`}
              </span>
              <span className="text-xs font-mono text-dark-300">
  {Number.isFinite(ind.value)
    ? ind.value.toLocaleString('vi-VN', (() => {
        // volume: không có phần thập phân
        if (type === 'volume') return { minimumFractionDigits: 0, maximumFractionDigits: 0 };

        // giá/MA/EMA: chọn số thập phân theo độ lớn giá
        const v = ind.value;
        let d = 2;
        if (v < 1 && v >= 0.1) d = 4;
        else if (v < 0.1) d = 6;
        else if (v < 10) d = 3;
        else d = 2;

        // clamp 0..8 cho chắc
        d = Math.max(0, Math.min(8, d));
        return { minimumFractionDigits: d, maximumFractionDigits: d };
      })())
    : '--'}
</span>

            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LineIndicatorHeader;