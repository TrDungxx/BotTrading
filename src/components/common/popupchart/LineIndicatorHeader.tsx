import React, { useState } from 'react';
import { Eye, EyeOff, Settings as SettingsIcon, X, ChevronRight, ChevronDown } from 'lucide-react';
import { IndicatorLine, BollConfig, VolumeMALine } from './indicatorTypes';

// ============================================
// TYPES
// ============================================

export interface IndicatorValue {
  id: string;
  name: string;
  period?: number;
  value: number;
  color: string;
  visible?: boolean;
  label?: string;
  extraValues?: Array<{
    label: string;
    value: number;
    color: string;
  }>;
  stdDev?: number;
}

interface LineIndicatorHeaderProps {
  type: 'main' | 'volume';
  indicatorType?: 'MA' | 'EMA' | 'BOLL' | 'Volume';
  indicators: IndicatorValue[];
  linesVisible: boolean;           // Lines hiện trên chart hay không
  onToggleLinesVisible: () => void; // Toggle ẩn/hiện lines trên chart
  onOpenSetting: () => void;
  onClose: () => void;              // Đóng hẳn (xóa khỏi danh sách)
  noPosition?: boolean;
  onRemoveIndicator?: (id: string) => void;
  // Control collapsed state from parent (optional)
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

// ============================================
// COMPONENT
// ============================================

const LineIndicatorHeader: React.FC<LineIndicatorHeaderProps> = ({
  type = 'main',
  indicatorType,
  indicators,
  linesVisible,
  onToggleLinesVisible,
  onOpenSetting,
  onClose,
  noPosition = false,
  onRemoveIndicator,
  collapsed: controlledCollapsed,
  onToggleCollapsed,
}) => {
  // Internal collapsed state if not controlled
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  
  const isCollapsed = controlledCollapsed ?? internalCollapsed;
  const toggleCollapsed = onToggleCollapsed ?? (() => setInternalCollapsed(!internalCollapsed));

  const headerLabel = indicatorType || (type === 'volume' ? 'Volume' : 'Indicators');

  /**
   * Format value based on indicator type
   */
  const formatValue = (val: number, isVolume: boolean = false) => {
    if (!Number.isFinite(val)) return '--';

    if (isVolume || type === 'volume') {
      if (val >= 1_000_000_000) {
        return (val / 1_000_000_000).toFixed(2) + 'B';
      } else if (val >= 1_000_000) {
        return (val / 1_000_000).toFixed(2) + 'M';
      } else if (val >= 1_000) {
        return (val / 1_000).toFixed(2) + 'K';
      }
      return val.toLocaleString('vi-VN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    }

    let d = 2;
    if (val < 1 && val >= 0.1) d = 4;
    else if (val < 0.1 && val > 0) d = 6;
    else if (val < 10) d = 3;
    else d = 2;

    d = Math.max(0, Math.min(8, d));
    return val.toLocaleString('vi-VN', {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
  };

  // ============================================
  // COLLAPSED STATE - Chỉ hiện icon ">" để mở lại
  // ============================================
  if (isCollapsed) {
    return (
      <div
        className={`${
          noPosition ? '' : 'absolute top-fluid-2 left-2 z-10'
        } select-none`}
      >
        <button
          onClick={toggleCollapsed}
          className="flex items-center justify-center w-5 h-5 rounded bg-dark-800/80 backdrop-blur-sm border border-dark-600/50 hover:bg-dark-700/80 transition-colors"
          title="Mở rộng"
        >
          <ChevronRight size={12} className="text-dark-300" />
        </button>
      </div>
    );
  }

  // ============================================
  // EXPANDED STATE - Hiện đầy đủ header
  // ============================================
  return (
    <div
      className={`${
        noPosition ? '' : 'absolute top-fluid-2 left-2 z-10'
      } flex items-center gap-1 select-none`}
    >
      {/* Collapse Button */}
      <button
        onClick={toggleCollapsed}
        className="flex items-center justify-center w-4 h-4 hover:bg-dark-700/50 rounded transition-colors"
        title="Thu gọn"
      >
        <ChevronDown size={12} className="text-dark-400" />
      </button>

      {/* Indicator Label & Values */}
      <div className="flex items-center gap-1 text-fluid-xs">
        {/* Label với period (cho BOLL) */}
        <span className="text-dark-400">
          {indicatorType === 'BOLL' && indicators[0] ? (
            <>
              {headerLabel}({indicators[0].period}, {indicators[0].stdDev})
            </>
          ) : (
            headerLabel
          )}
        </span>

        {/* Indicator Values */}
        {indicators.map((ind, idx) => (
          <React.Fragment key={ind.id}>
            {/* Dot color */}
            <span
              className="inline-block w-1.5 h-1.5 rounded-full ml-1"
              style={{ backgroundColor: ind.color }}
            />
            
            {/* Name & Value */}
            {ind.label ? (
              // BOLL style: UP 86.522,9
              <span className="font-mono">
                <span style={{ color: ind.color }}>{ind.label}</span>
                <span className="text-dark-300 ml-0.5">{formatValue(ind.value)}</span>
              </span>
            ) : (
              // MA/EMA style: MA(7) 0,1289
              <span className="font-mono">
                <span className="text-dark-300">{ind.name}({ind.period})</span>
                <span className="text-dark-400 ml-0.5">{formatValue(ind.value)}</span>
              </span>
            )}

            {/* Extra values for BOLL (MID, DN) */}
            {ind.extraValues?.map((extra, extraIdx) => (
              <span key={extraIdx} className="font-mono">
                <span style={{ color: extra.color }}>{extra.label}</span>
                <span className="text-dark-300 ml-0.5">{formatValue(extra.value)}</span>
              </span>
            ))}
          </React.Fragment>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-0.5 ml-1">
        {/* Toggle Lines Visibility (Eye icon) */}
        <button
          onClick={onToggleLinesVisible}
          className="p-0.5 hover:bg-dark-700/50 rounded transition-colors"
          title={linesVisible ? 'Ẩn đường' : 'Hiện đường'}
        >
          {linesVisible ? (
            <Eye size={12} className="text-dark-400" />
          ) : (
            <EyeOff size={12} className="text-dark-500" />
          )}
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSetting}
          className="p-0.5 hover:bg-dark-700/50 rounded transition-colors"
          title="Cài đặt"
        >
          <SettingsIcon size={12} className="text-dark-400" />
        </button>

        {/* Close (Remove) */}
        <button
          onClick={onClose}
          className="p-0.5 hover:bg-dark-700/50 rounded transition-colors"
          title="Đóng"
        >
          <X size={12} className="text-dark-400 hover:text-red-400" />
        </button>
      </div>
    </div>
  );
};

export default LineIndicatorHeader;

// ============================================
// HELPER: Convert dynamic config to IndicatorValue[]
// ============================================

export function linesToIndicatorValues(
  lines: IndicatorLine[],
  lastCandle: { close: number } | undefined
): IndicatorValue[] {
  return lines
    .filter(line => line.visible)
    .map(line => ({
      id: line.id,
      name: line.type,
      period: line.period,
      value: lastCandle?.close ?? 0,
      color: line.color,
      visible: line.visible,
    }));
}

export function bollsToIndicatorValues(
  bolls: BollConfig[],
  bollData: { [id: string]: { upper: number; middle: number; lower: number } }
): IndicatorValue[] {
  return bolls
    .filter(boll => boll.visible)
    .map(boll => {
      const data = bollData[boll.id] || { upper: 0, middle: 0, lower: 0 };
      return {
        id: boll.id,
        name: 'BOLL',
        period: boll.period,
        stdDev: boll.stdDev,
        value: data.upper,
        color: boll.colors.upper,
        visible: boll.visible,
        label: 'UP',
        extraValues: [
          { label: 'MB', value: data.middle, color: boll.colors.middle },
          { label: 'DN', value: data.lower, color: boll.colors.lower },
        ],
      };
    });
}

export function volumeMAToIndicatorValues(
  volumeMAs: VolumeMALine[],
  lastVolume: number | undefined
): IndicatorValue[] {
  return volumeMAs
    .filter(vol => vol.visible)
    .map(vol => ({
      id: vol.id,
      name: 'MA',
      period: vol.period,
      value: lastVolume ?? 0,
      color: vol.color,
      visible: vol.visible,
    }));
}