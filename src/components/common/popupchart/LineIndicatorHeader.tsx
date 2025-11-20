import React from 'react';
import { Eye, EyeOff, Settings as SettingsIcon, X } from 'lucide-react'; // 👈

export interface IndicatorValue {
  name: string;
  period?: number;
  value: number;
  color: string;
  visible?: boolean;
  label?: string; // ✅ ADD: Label for first value (e.g., "UP" for BOLL)
  extraValues?: Array<{ // ✅ ADD: Extra values for indicators like BOLL (MB, DN)
    label: string;
    value: number;
    color: string;
  }>;
  stdDev?: number; // ✅ ADD: For BOLL standard deviation display
}

interface LineIndicatorHeaderProps {
  indicators: IndicatorValue[];
  visible: boolean;
  onToggleVisible: () => void;
  onOpenSetting: () => void;
  onClose: () => void;
  type?: 'main' | 'volume';
  noPosition?: boolean; // ✅ ADD: Disable absolute positioning for external control
}

const LineIndicatorHeader: React.FC<LineIndicatorHeaderProps> = ({
  indicators,
  visible,
  onToggleVisible,
  onOpenSetting,
  onClose,
  type = 'main',
  noPosition = false,    
}) => {
  const visibleIndicators = indicators.filter(ind => ind.visible !== false);

  return (
    <div className={`${noPosition ? '' : 'absolute top-2 left-2 z-10'} flex items-center gap-1.5 select-none`}>
      {/* Indicator Name & Toggle */}
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-dark-800/80 backdrop-blur-sm border border-dark-600/50">
        <button onClick={onToggleVisible} className="flex items-center gap-1 hover:opacity-80 transition-opacity" title={visible ? 'Ẩn tất cả' : 'Hiện tất cả'}>
  {visible ? <Eye size={11} className="text-primary" /> : <EyeOff size={11} className="text-dark-400" />}
  <span className="text-[11px] font-medium text-dark-200">{type === 'main' ? 'Indicators' : 'Volume'}</span>
</button>

        {/* Settings Button */}
        <button onClick={onOpenSetting} className="p-0.5 hover:bg-dark-700 rounded transition-colors" title="Cài đặt">
  <SettingsIcon size={11} className="text-dark-300" />
</button>

        {/* Close Button */}
        <button onClick={onClose} className="p-0.5 hover:bg-dark-700 rounded transition-colors" title="Đóng">
  <X size={11} className="text-dark-300" />
</button>
      </div>

      {/* Indicator Values */}
      {visible && visibleIndicators.length > 0 && (
        <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-dark-800/80 backdrop-blur-sm border border-dark-600/50">
          {visibleIndicators.map((ind, idx) => {
            // Helper function to format value
            const formatValue = (val: number) => {
              if (!Number.isFinite(val)) return '--';
              
              if (type === 'volume') {
                return val.toLocaleString('vi-VN', { 
                  minimumFractionDigits: 0, 
                  maximumFractionDigits: 0 
                });
              }
              
              let d = 2;
              if (val < 1 && val >= 0.1) d = 4;
              else if (val < 0.1) d = 6;
              else if (val < 10) d = 3;
              else d = 2;
              
              d = Math.max(0, Math.min(8, d));
              return val.toLocaleString('vi-VN', { 
                minimumFractionDigits: d, 
                maximumFractionDigits: d 
              });
            };

            return (
              <div key={idx} className="flex items-center gap-1">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: ind.color }}
                />
                <span className="text-[11px] font-medium text-dark-200">
                  {ind.name}
                  {ind.period && `(${ind.period}`}
                  {ind.stdDev && `, ${ind.stdDev}`}
                  {ind.period && ')'}
                </span>
                
                {/* Display main value with optional label */}
                {ind.label ? (
                  <span className="text-[11px] font-mono text-dark-300">
                    <span style={{ color: ind.color }}>{ind.label}:</span> {formatValue(ind.value)}
                  </span>
                ) : (
                  <span className="text-[11px] font-mono text-dark-300">
                    {formatValue(ind.value)}
                  </span>
                )}
                
                {/* Display extra values (for BOLL: MB, DN) */}
                {ind.extraValues?.map((extra, extraIdx) => (
                  <span key={extraIdx} className="text-[11px] font-mono text-dark-300">
                    <span style={{ color: extra.color }}>{extra.label}:</span> {formatValue(extra.value)}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LineIndicatorHeader;