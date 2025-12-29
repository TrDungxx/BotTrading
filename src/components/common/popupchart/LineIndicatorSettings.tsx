import React, { useState, useCallback } from 'react';
import { Plus, Trash2, X, ChevronRight } from 'lucide-react';
import {
  DynamicIndicatorConfig,
  IndicatorLine,
  BollConfig,
  VolumeMALine,
  DEFAULT_COLORS,
  createIndicatorLine,
  createBollConfig,
  createVolumeMALine,
} from '../hooks/indicatorTypes';

// ============================================
// CUSTOM CHECKBOX COMPONENT
// ============================================

interface CustomCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const CustomCheckbox: React.FC<CustomCheckboxProps> = ({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const iconSizes = {
    sm: { width: 8, height: 6 },
    md: { width: 10, height: 8 },
    lg: { width: 12, height: 10 },
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        !disabled && onChange(!checked);
      }}
      className={`
        ${sizeClasses[size]}
        flex items-center justify-center
        rounded
        border
        transition-all duration-150
        shrink-0
        ${checked 
          ? 'bg-[#256ec2ff] border-[#256ec2ff]' 
          : 'bg-transparent border-[#474d57] hover:border-[#848e9c]'
        }
        ${disabled 
          ? 'opacity-50 cursor-not-allowed' 
          : 'cursor-pointer'
        }
        ${className}
      `}
    >
      {checked && (
        <svg 
          width={iconSizes[size].width} 
          height={iconSizes[size].height} 
          viewBox="0 0 10 8" 
          fill="none"
          className="text-[#1e2329]"
        >
          <path 
            d="M1 4L3.5 6.5L9 1" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
};

// ============================================
// TYPES
// ============================================

interface LineIndicatorSettingsProps {
  type: 'main' | 'volume';
  defaultTab?: number;
  config: DynamicIndicatorConfig;
  onChange: (config: DynamicIndicatorConfig) => void;
  onClose: () => void;
}

// ============================================
// COMPONENT
// ============================================

const LineIndicatorSettings: React.FC<LineIndicatorSettingsProps> = ({
  type,
  defaultTab = 1,
  config,
  onChange,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [selectedMainIndicator, setSelectedMainIndicator] = useState<'ma' | 'ema' | 'wma' | 'boll'>('ma');
  const [selectedSubIndicator, setSelectedSubIndicator] = useState('vol');
  
  // Local state for editing
  const [localConfig, setLocalConfig] = useState<DynamicIndicatorConfig>({ ...config });

  const tabs = [
    { id: 1, label: 'Chỉ báo chính' },
    { id: 2, label: 'Chỉ báo phụ' },
    { id: 3, label: 'Dữ liệu Giao dịch' },
    { id: 4, label: 'Tùy chỉnh' },
    { id: 5, label: 'Kiểm định' },
  ];

  const mainIndicatorsList = [
    { key: 'ma' as const, label: 'MA', desc: 'Moving Average' },
    { key: 'ema' as const, label: 'EMA', desc: 'Exponential Moving Average' },
    { key: 'wma' as const, label: 'WMA', desc: 'Weighted Moving Average' },
    { key: 'boll' as const, label: 'BOLL', desc: 'Bollinger Bands' },
  ];

  // ============================================
  // HANDLERS
  // ============================================

  const handleSave = () => {
    onChange(localConfig);
    onClose();
  };

  const handleReset = () => {
    setLocalConfig({
      ...localConfig,
      lines: localConfig.lines.map(l => ({ ...l, visible: false })),
      bollingerBands: localConfig.bollingerBands.map(b => ({ ...b, visible: false })),
      volumeMA: localConfig.volumeMA.map(v => ({ ...v, visible: false })),
    });
  };

  // Line handlers
  const handleAddLine = (lineType: 'MA' | 'EMA' | 'WMA') => {
    const newLine = createIndicatorLine(lineType, localConfig.lines);
    setLocalConfig(prev => ({
      ...prev,
      lines: [...prev.lines, newLine],
    }));
  };

  const handleRemoveLine = (id: string) => {
    setLocalConfig(prev => ({
      ...prev,
      lines: prev.lines.filter(l => l.id !== id),
    }));
  };

  const handleUpdateLine = (id: string, updates: Partial<IndicatorLine>) => {
    setLocalConfig(prev => ({
      ...prev,
      lines: prev.lines.map(l => (l.id === id ? { ...l, ...updates } : l)),
    }));
  };

  // BOLL handlers
  const handleAddBoll = () => {
    const newBoll = createBollConfig(localConfig.bollingerBands);
    setLocalConfig(prev => ({
      ...prev,
      bollingerBands: [...prev.bollingerBands, newBoll],
    }));
  };

  const handleRemoveBoll = (id: string) => {
    setLocalConfig(prev => ({
      ...prev,
      bollingerBands: prev.bollingerBands.filter(b => b.id !== id),
    }));
  };

  const handleUpdateBoll = (id: string, updates: Partial<BollConfig>) => {
    setLocalConfig(prev => ({
      ...prev,
      bollingerBands: prev.bollingerBands.map(b =>
        b.id === id
          ? { ...b, ...updates, colors: { ...b.colors, ...(updates.colors || {}) } }
          : b
      ),
    }));
  };

  // Volume MA handlers
  const handleAddVolumeMA = () => {
    const newLine = createVolumeMALine(localConfig.volumeMA);
    setLocalConfig(prev => ({
      ...prev,
      volumeMA: [...prev.volumeMA, newLine],
    }));
  };

  const handleRemoveVolumeMA = (id: string) => {
    setLocalConfig(prev => ({
      ...prev,
      volumeMA: prev.volumeMA.filter(v => v.id !== id),
    }));
  };

  const handleUpdateVolumeMA = (id: string, updates: Partial<VolumeMALine>) => {
    setLocalConfig(prev => ({
      ...prev,
      volumeMA: prev.volumeMA.map(v => (v.id === id ? { ...v, ...updates } : v)),
    }));
  };

  // ============================================
  // RENDER MA/EMA/WMA SETTINGS
  // ============================================

  const renderLineSettings = (lineType: 'MA' | 'EMA' | 'WMA') => {
    const lines = localConfig.lines.filter(l => l.type === lineType);
    const maxLines = 10;

    return (
      <div className="space-y-6 flex-1 px-2 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-fluid-2">
            <h3 className="text-fluid-sm font-medium text-dark-200">{lineType}</h3>
            <span className="text-dark-500">›</span>
            <span className="text-xs text-dark-400">
              {lineType === 'MA'
                ? 'Đường trung bình động'
                : lineType === 'EMA'
                ? 'Đường trung bình động hàm mũ'
                : 'Đường trung bình động có trọng số'}
            </span>
          </div>
          {lines.length < maxLines && (
            <button
              onClick={() => handleAddLine(lineType)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-dark-700 rounded transition-colors"
            >
              <Plus size={14} />
              Thêm {lineType}
            </button>
          )}
        </div>

        {lines.length === 0 ? (
          <div className="text-center py-8 text-dark-400">
            <p className="text-sm mb-2">Chưa có đường {lineType} nào</p>
            <button
              onClick={() => handleAddLine(lineType)}
              className="text-primary hover:underline text-sm"
            >
              + Thêm đường {lineType} đầu tiên
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Header */}
            <div className="grid grid-cols-[40px_1fr_80px_100px_80px_40px] gap-2 text-xs text-dark-400 px-1">
              <span></span>
              <span>Tên</span>
              <span>Chu kỳ</span>
              <span>Nguồn</span>
              <span>Màu</span>
              <span></span>
            </div>

            {/* Lines */}
            {lines.map((line, index) => (
              <div
                key={line.id}
                className="grid grid-cols-[40px_1fr_80px_100px_80px_40px] gap-2 items-center bg-dark-750 rounded-lg px-2 py-2"
              >
                {/* Checkbox */}
                <CustomCheckbox
                  checked={line.visible}
                  onChange={(checked) => handleUpdateLine(line.id, { visible: checked })}
                />

                {/* Name */}
                <span className="text-fluid-sm text-dark-200">
                  {lineType}{index + 1}
                </span>

                {/* Period */}
                <input
                  type="number"
                  value={line.period}
                  onChange={(e) => handleUpdateLine(line.id, { period: Number(e.target.value) || 1 })}
                  className="w-full px-2 py-1.5 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200"
                  min="1"
                  max="999"
                />

                {/* Source */}
                <select
                  value={line.source}
                  onChange={(e) => handleUpdateLine(line.id, { source: e.target.value as any })}
                  className="w-full px-2 py-1.5 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200"
                >
                  <option value="close">Đóng</option>
                  <option value="open">Mở</option>
                  <option value="high">Cao</option>
                  <option value="low">Thấp</option>
                </select>

                {/* Color */}
                <input
                  type="color"
                  value={line.color}
                  onChange={(e) => handleUpdateLine(line.id, { color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />

                {/* Delete */}
                <button
                  onClick={() => handleRemoveLine(line.id)}
                  className="p-1.5 hover:bg-dark-600 rounded transition-colors text-dark-400 hover:text-red-400"
                  title="Xóa"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {lines.length >= maxLines && (
          <p className="text-xs text-dark-500 mt-2">Đã đạt giới hạn {maxLines} đường {lineType}</p>
        )}
      </div>
    );
  };

  // ============================================
  // RENDER BOLL SETTINGS
  // ============================================

  const renderBollSettings = () => {
    const bolls = localConfig.bollingerBands;
    const maxBolls = 3;

    return (
      <div className="space-y-4 flex-1 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-fluid-2">
            <h3 className="text-fluid-sm font-medium text-dark-200">BOLL</h3>
            <span className="text-dark-500">›</span>
            <span className="text-xs text-dark-400">Dải Bollinger</span>
          </div>
          {bolls.length < maxBolls && (
            <button
              onClick={handleAddBoll}
              className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-dark-700 rounded transition-colors"
            >
              <Plus size={14} />
              Thêm BOLL
            </button>
          )}
        </div>

        {bolls.length === 0 ? (
          <div className="text-center py-8 text-dark-400">
            <p className="text-sm mb-2">Chưa có Bollinger Bands nào</p>
            <button onClick={handleAddBoll} className="text-primary hover:underline text-sm">
              + Thêm BOLL đầu tiên
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {bolls.map((boll, index) => (
              <div key={boll.id} className="bg-dark-750 rounded-lg p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CustomCheckbox
                      checked={boll.visible}
                      onChange={(checked) => handleUpdateBoll(boll.id, { visible: checked })}
                    />
                    <span className="text-fluid-sm font-medium text-dark-200">BOLL {index + 1}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveBoll(boll.id)}
                    className="p-1.5 hover:bg-dark-600 rounded transition-colors text-dark-400 hover:text-red-400"
                    title="Xóa"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Settings grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Period */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-dark-400">Chu kỳ</span>
                    <input
                      type="number"
                      value={boll.period}
                      onChange={(e) => handleUpdateBoll(boll.id, { period: Number(e.target.value) || 20 })}
                      className="w-20 px-2 py-1.5 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200"
                      min="1"
                    />
                  </div>

                  {/* StdDev */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-dark-400">Hệ số nhân</span>
                    <input
                      type="number"
                      value={boll.stdDev}
                      onChange={(e) => handleUpdateBoll(boll.id, { stdDev: Number(e.target.value) || 2 })}
                      className="w-20 px-2 py-1.5 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200"
                      min="0.1"
                      step="0.1"
                    />
                  </div>
                </div>

                {/* Fill toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CustomCheckbox
                      checked={boll.fillVisible}
                      onChange={(checked) => handleUpdateBoll(boll.id, { fillVisible: checked })}
                    />
                    <span className="text-xs text-dark-400">Phông nền</span>
                  </div>
                  <input
                    type="color"
                    value={boll.colors.fill.includes('rgba') 
                      ? '#' + boll.colors.fill.match(/\d+/g)?.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('') || 'B385F8'
                      : boll.colors.fill
                    }
                    onChange={(e) => {
                      const hex = e.target.value;
                      const rgba = `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, 0.1)`;
                      handleUpdateBoll(boll.id, { colors: { ...boll.colors, fill: rgba } });
                    }}
                    className="w-8 h-6 rounded cursor-pointer border-0"
                  />
                </div>

                {/* Band colors */}
                <div className="space-y-2">
                  {/* Upper */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-dark-400">Upper</span>
                    <input
                      type="color"
                      value={boll.colors.upper}
                      onChange={(e) => handleUpdateBoll(boll.id, { colors: { ...boll.colors, upper: e.target.value } })}
                      className="w-8 h-6 rounded cursor-pointer border-0"
                    />
                  </div>
                  {/* Middle */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-dark-400">Middle</span>
                    <input
                      type="color"
                      value={boll.colors.middle}
                      onChange={(e) => handleUpdateBoll(boll.id, { colors: { ...boll.colors, middle: e.target.value } })}
                      className="w-8 h-6 rounded cursor-pointer border-0"
                    />
                  </div>
                  {/* Lower */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-dark-400">Lower</span>
                    <input
                      type="color"
                      value={boll.colors.lower}
                      onChange={(e) => handleUpdateBoll(boll.id, { colors: { ...boll.colors, lower: e.target.value } })}
                      className="w-8 h-6 rounded cursor-pointer border-0"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // RENDER VOLUME MA SETTINGS
  // ============================================

  const renderVolumeSettings = () => {
    const volumeMAs = localConfig.volumeMA;
    const maxLines = 5;

    return (
      <div className="space-y-4 flex-1 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-fluid-2">
            <h3 className="text-fluid-sm font-medium text-dark-200">VOL</h3>
            <span className="text-dark-500">›</span>
            <span className="text-xs text-dark-400">Khối lượng giao dịch</span>
          </div>
          {volumeMAs.length < maxLines && (
            <button
              onClick={handleAddVolumeMA}
              className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-dark-700 rounded transition-colors"
            >
              <Plus size={14} />
              Thêm MAVOL
            </button>
          )}
        </div>

        <p className="text-xs text-dark-500 mb-4">
          MAVOL là đường trung bình động của khối lượng giao dịch, giúp xác định xu hướng khối lượng.
        </p>

        {volumeMAs.length === 0 ? (
          <div className="text-center py-8 text-dark-400">
            <p className="text-sm mb-2">Chưa có đường MAVOL nào</p>
            <button onClick={handleAddVolumeMA} className="text-primary hover:underline text-sm">
              + Thêm MAVOL đầu tiên
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {volumeMAs.map((vol, index) => (
              <div
                key={vol.id}
                className="flex items-center justify-between bg-dark-750 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <CustomCheckbox
                    checked={vol.visible}
                    onChange={(checked) => handleUpdateVolumeMA(vol.id, { visible: checked })}
                  />
                  <span className="text-fluid-sm text-dark-200">MAVOL{index + 1}</span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={vol.period}
                    onChange={(e) => handleUpdateVolumeMA(vol.id, { period: Number(e.target.value) || 7 })}
                    className="w-16 px-2 py-1.5 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200"
                    min="1"
                  />
                  <input
                    type="color"
                    value={vol.color}
                    onChange={(e) => handleUpdateVolumeMA(vol.id, { color: e.target.value })}
                    className="w-8 h-6 rounded cursor-pointer border-0"
                  />
                  <button
                    onClick={() => handleRemoveVolumeMA(vol.id)}
                    className="p-1.5 hover:bg-dark-600 rounded transition-colors text-dark-400 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // RENDER MAIN INDICATORS TAB
  // ============================================

  const renderMainIndicators = () => {
    // Count visible indicators for sidebar
    const getIndicatorCount = (key: string): number => {
      if (key === 'ma') return localConfig.lines.filter(l => l.type === 'MA' && l.visible).length;
      if (key === 'ema') return localConfig.lines.filter(l => l.type === 'EMA' && l.visible).length;
      if (key === 'wma') return localConfig.lines.filter(l => l.type === 'WMA' && l.visible).length;
      if (key === 'boll') return localConfig.bollingerBands.filter(b => b.visible).length;
      return 0;
    };

    return (
      <div className="flex h-full">
        {/* Sidebar */}
        <div className="w-44 border-r border-dark-600 overflow-y-auto">
          <div className="py-2">
            <div className="px-3 py-2 text-xs font-medium text-dark-500 uppercase">Main</div>
            {mainIndicatorsList.map((ind) => {
              const count = getIndicatorCount(ind.key);
              // Check if any indicator of this type is visible
              const isTypeVisible = ind.key === 'boll'
                ? localConfig.bollingerBands.some(b => b.visible)
                : localConfig.lines.filter(l => l.type === ind.key.toUpperCase()).some(l => l.visible);
              
              // Toggle all indicators of this type
              const handleToggleType = (checked: boolean) => {
                if (ind.key === 'boll') {
                  setLocalConfig(prev => ({
                    ...prev,
                    bollingerBands: prev.bollingerBands.map(b => ({ ...b, visible: checked })),
                  }));
                } else {
                  const typeUpper = ind.key.toUpperCase();
                  setLocalConfig(prev => ({
                    ...prev,
                    lines: prev.lines.map(l => 
                      l.type === typeUpper ? { ...l, visible: checked } : l
                    ),
                  }));
                }
              };

              return (
                <div
                  key={ind.key}
                  onClick={() => setSelectedMainIndicator(ind.key)}
                  className={`w-full px-3 py-2.5 text-left flex items-center justify-between transition-colors cursor-pointer ${
                    selectedMainIndicator === ind.key
                      ? 'bg-dark-700 text-dark-100'
                      : 'text-dark-300 hover:bg-dark-750'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {/* Checkbox for toggle visibility */}
                    <CustomCheckbox
                      checked={isTypeVisible}
                      onChange={handleToggleType}
                      size="sm"
                    />
                    <span className="text-fluid-sm">{ind.label}</span>
                  </div>
                  <ChevronRight size={14} className="text-dark-500" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Settings Panel */}
        <div className="flex-1 overflow-y-auto">
          {selectedMainIndicator === 'ma' && renderLineSettings('MA')}
          {selectedMainIndicator === 'ema' && renderLineSettings('EMA')}
          {selectedMainIndicator === 'wma' && renderLineSettings('WMA')}
          {selectedMainIndicator === 'boll' && renderBollSettings()}
        </div>
      </div>
    );
  };

  // ============================================
  // RENDER SUB INDICATORS TAB
  // ============================================

  const renderSubIndicators = () => {
    const subIndicators = [
      { key: 'vol', label: 'VOL', desc: 'Volume' },
      { key: 'macd', label: 'MACD', desc: 'Moving Average Convergence Divergence' },
      { key: 'rsi', label: 'RSI', desc: 'Relative Strength Index' },
    ];

    const visibleVolCount = localConfig.volumeMA.filter(v => v.visible).length;

    return (
      <div className="flex h-full">
        {/* Sidebar */}
        <div className="w-44 border-r border-dark-600 overflow-y-auto">
          <div className="py-2">
            <div className="px-3 py-2 text-xs font-medium text-dark-500 uppercase">Sub</div>
            {subIndicators.map((ind) => {
              // Check visibility for VOL
              const isTypeVisible = ind.key === 'vol'
                ? localConfig.volumeMA.some(v => v.visible)
                : false;
              
              // Toggle visibility
              const handleToggleType = (checked: boolean) => {
                if (ind.key === 'vol') {
                  setLocalConfig(prev => ({
                    ...prev,
                    volumeMA: prev.volumeMA.map(v => ({ ...v, visible: checked })),
                  }));
                }
              };

              return (
                <div
                  key={ind.key}
                  onClick={() => setSelectedSubIndicator(ind.key)}
                  className={`w-full px-3 py-2.5 text-left flex items-center justify-between transition-colors cursor-pointer ${
                    selectedSubIndicator === ind.key
                      ? 'bg-dark-700 text-dark-100'
                      : 'text-dark-300 hover:bg-dark-750'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {/* Checkbox for toggle visibility */}
                    {ind.key === 'vol' ? (
                      <CustomCheckbox
                        checked={isTypeVisible}
                        onChange={handleToggleType}
                        size="sm"
                      />
                    ) : (
                      <div className="w-3.5 h-3.5" /> // Placeholder for alignment
                    )}
                    <span className="text-fluid-sm">{ind.label}</span>
                    {ind.key === 'vol' && visibleVolCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-primary/20 text-primary rounded">
                        {visibleVolCount}
                      </span>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-dark-500" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Settings Panel */}
        <div className="flex-1 overflow-y-auto">
          {selectedSubIndicator === 'vol' && renderVolumeSettings()}
          {selectedSubIndicator !== 'vol' && (
            <div className="flex items-center justify-center h-48 text-dark-400">
              <p className="text-sm">Đang phát triển...</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-dark-800 rounded-2xl border border-dark-600 shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header with Tabs */}
        <div className="border-b border-dark-600">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2 flex-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-dark-400 hover:text-dark-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-dark-700 rounded-lg transition-colors ml-4"
            >
              <X size={20} className="text-dark-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 1 && renderMainIndicators()}
          {activeTab === 2 && renderSubIndicators()}
          {activeTab > 2 && (
            <div className="flex items-center justify-center h-48 text-dark-400">
              <p className="text-sm">Tab đang được phát triển...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-dark-600 p-4 flex items-center justify-end gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm text-dark-400 hover:text-dark-200 hover:bg-dark-700 rounded-lg transition-colors"
          >
            Đặt lại
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-primary text-dark-900 font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            Lưu lại
          </button>
        </div>
      </div>
    </div>
  );
};

export default LineIndicatorSettings;