import React, { useState } from 'react';

export interface MainIndicatorConfig {
  ma7: boolean;
  ma25: boolean;
  ma99: boolean;
  ema12: boolean;
  ema26: boolean;
  boll: boolean;
}

export interface VolumeIndicatorConfig {
  mavol1: boolean;
  mavol2: boolean;
}

export interface SubIndicatorConfig {
  vol: boolean;
  macd: boolean;
  rsi: boolean;
  mfi: boolean;
  kdj: boolean;
  obv: boolean;
  cci: boolean;
  stochRsi: boolean;
  wr: boolean;
}

export interface IndicatorPeriods {
  ma7?: number;
  ma25?: number;
  ma99?: number;
  ema12?: number;
  ema26?: number;
  mavol1?: number;
  mavol2?: number;
  boll?: { period: number; stdDev: number };
  macd?: { fast: number; slow: number; signal: number };
  rsi?: number;
  mfi?: number;
  kdj?: { k: number; d: number };
  cci?: number;
  stochRsi?: { period: number; k: number; d: number };
  wr?: number;
}

export interface IndicatorColors {
  ma7?: string;
  ma25?: string;
  ma99?: string;
  ema12?: string;
  ema26?: string;
  mavol1?: string;
  mavol2?: string;
  boll?: { upper: string; middle: string; lower: string; fill: string };
  macd?: { macd: string; signal: string; histogram: string };
  rsi?: string;
  mfi?: string;
  kdj?: { k: string; d: string; j: string };
  obv?: string;
  cci?: string;
  stochRsi?: { k: string; d: string };
  wr?: string;
}

interface LineIndicatorSettingsProps {
  type: 'main' | 'volume';
  defaultTab?: number; // Tab mặc định: 1 = Chỉ báo chính, 2 = Chỉ báo phụ
  mainVisible?: MainIndicatorConfig;
  volumeVisible?: VolumeIndicatorConfig;
  subVisible?: SubIndicatorConfig;
  periods?: IndicatorPeriods;
  colors?: IndicatorColors;
  bollFillVisible?: boolean; // ✅ ADD: Pass bollFillVisible from parent
  onChange?: (
    mainVis?: MainIndicatorConfig,
    volumeVis?: VolumeIndicatorConfig,
    subVis?: SubIndicatorConfig,
    per?: IndicatorPeriods,
    col?: IndicatorColors,
    bollFillVisible?: boolean
  ) => void;
  onClose: () => void;
}


const LineIndicatorSettings: React.FC<LineIndicatorSettingsProps> = ({
  type,
  defaultTab = 1, // Mặc định mở tab 1
  mainVisible = { ma7: true, ma25: true, ma99: true, ema12: false, ema26: false, boll: false },
  volumeVisible = { mavol1: true, mavol2: true },
  subVisible = {
    vol: true,
    macd: false,
    rsi: false,
    mfi: false,
    kdj: false,
    obv: false,
    cci: false,
    stochRsi: false,
    wr: false,
  },
  periods = {
    ma7: 7,
    ma25: 25,
    ma99: 99,
    ema12: 12,
    ema26: 26,
    mavol1: 7,
    mavol2: 14,
    boll: { period: 20, stdDev: 2 },
    rsi: 14,
    mfi: 14,
    kdj: { k: 9, d: 3 },
    cci: 20,
    stochRsi: { period: 14, k: 3, d: 3 },
    wr: 14,
    macd: { fast: 12, slow: 26, signal: 9 },
  },
  colors = {
    ma7: '#F0B90B',
    ma25: '#EB40B5',
    ma99: '#B385F8',
    ema12: '#2962FF',
    ema26: '#FF6D00',
    mavol1: '#0ECB81',
    mavol2: '#EB40B5',
    boll: { upper: '#B385F8', middle: '#EB40B5', lower: '#B385F8', fill: 'rgba(179, 133, 248, 0.1)' },
    rsi: '#7E57C2',
    mfi: '#26A69A',
    kdj: { k: '#2962FF', d: '#FF6D00', j: '#9C27B0' },
    obv: '#00BCD4',
    cci: '#FF9800',
    stochRsi: { k: '#2962FF', d: '#FF6D00' },
    wr: '#E91E63',
    macd: { macd: '#2962FF', signal: '#FF6D00', histogram: '#26A69A' },
  },
  bollFillVisible = false, // ✅ ADD: Receive bollFillVisible from parent
  onChange,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab); // Sử dụng defaultTab thay vì hardcode 1
  const [localMainVis, setLocalMainVis] = useState({ ...mainVisible, boll: mainVisible.boll ?? false });
  const [localVolVis, setLocalVolVis] = useState(volumeVisible);
  const [localSubVis, setLocalSubVis] = useState(subVisible);
  const [localPeriods, setLocalPeriods] = useState(periods);
  const [localColors, setLocalColors] = useState(colors);
  const [selectedMainIndicator, setSelectedMainIndicator] = useState('ma'); // For main indicators sidebar
  const [selectedSubIndicator, setSelectedSubIndicator] = useState('vol'); // For sub indicators sidebar
  const [localBollFillVisible, setLocalBollFillVisible] = useState(bollFillVisible); // ✅ Use bollFillVisible from props

  const tabs = [
    { id: 1, label: 'Chỉ báo chính' },
    { id: 2, label: 'Chỉ báo phụ' },
    { id: 3, label: 'Dữ liệu Giao dịch' },
    { id: 4, label: 'Tùy chỉnh' },
    { id: 5, label: 'Kiểm định' },
  ];

  const handleSave = () => {
    onChange?.(localMainVis, localVolVis, localSubVis, localPeriods, localColors, localBollFillVisible); // ✅ Pass localBollFillVisible
    onClose();
  };

  const handleReset = () => {
    // Reset Main indicators
    setLocalMainVis({ ma7: true, ma25: true, ma99: true, ema12: false, ema26: false, boll: false });
    
    // Reset Volume indicators
    setLocalVolVis({ mavol1: true, mavol2: true });
    
    // Reset all periods
    setLocalPeriods({
      ma7: 7,
      ma25: 25,
      ma99: 99,
      ema12: 12,
      ema26: 26,
      mavol1: 7,
      mavol2: 14,
      boll: { period: 20, stdDev: 2 },
    });
    
    // Reset all colors
    setLocalColors({
      ma7: '#F0B90B',
      ma25: '#EB40B5',
      ma99: '#B385F8',
      ema12: '#2962FF',
      ema26: '#FF6D00',
      mavol1: '#0ECB81',
      mavol2: '#EB40B5',
      boll: { upper: '#B385F8', middle: '#EB40B5', lower: '#B385F8', fill: 'rgba(179, 133, 248, 0.1)' },
    });
  };

  // Render Main Indicators Tab (with sidebar like Binance)
  const renderMainIndicators = () => {
    const mainIndicatorsList = [
      { key: 'ma', label: 'MA', desc: 'Moving Average' },
      { key: 'ema', label: 'EMA', desc: 'Exponential Moving Average' },
      { key: 'wma', label: 'WMA', desc: 'Weighted Moving Average' },
      { key: 'boll', label: 'BOLL', desc: 'Bollinger Bands' },
      { key: 'vwap', label: 'VWAP', desc: 'Volume Weighted Average Price' },
      { key: 'avl', label: 'AVL', desc: 'Average Line' },
      { key: 'trix', label: 'TRIX', desc: 'Triple Exponential Average' },
      { key: 'sar', label: 'SAR', desc: 'Parabolic SAR' },
    ];

    // Render settings for selected main indicator
    const renderMainIndicatorSettings = () => {
      if (selectedMainIndicator === 'ma') {
        // MA Settings - support up to 10 MA lines
        const maLines = [
          { 
            key: 'ma7', 
            label: 'MA1', 
            period: localPeriods.ma7 ?? 7, 
            color: localColors.ma7 ?? '#F0B90B', 
            visible: localMainVis.ma7 
          },
          { 
            key: 'ma25', 
            label: 'MA2', 
            period: localPeriods.ma25 ?? 25, 
            color: localColors.ma25 ?? '#EB40B5', 
            visible: localMainVis.ma25 
          },
          { 
            key: 'ma99', 
            label: 'MA3', 
            period: localPeriods.ma99 ?? 99, 
            color: localColors.ma99 ?? '#B385F8', 
            visible: localMainVis.ma99 
          },
        ];

        return (
          <div className="space-y-4 flex-1 px-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-medium text-dark-200">MA</h3>
              <span className="text-dark-500">&gt;</span>
              <span className="text-xs text-dark-400">Đường trung bình động</span>
            </div>

            <div className="space-y-3">
              {maLines.map((ma, index) => (
                <div key={ma.key} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-[80px]">
                    <input
                      type="checkbox"
                      checked={ma.visible}
                      onChange={(e) => {
                        if (ma.key === 'ma7') setLocalMainVis({ ...localMainVis, ma7: e.target.checked });
                        else if (ma.key === 'ma25') setLocalMainVis({ ...localMainVis, ma25: e.target.checked });
                        else if (ma.key === 'ma99') setLocalMainVis({ ...localMainVis, ma99: e.target.checked });
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-dark-200">{ma.label}</span>
                  </div>

                  <input
                    type="number"
                    value={ma.period}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (ma.key === 'ma7') setLocalPeriods({ ...localPeriods, ma7: val });
                      else if (ma.key === 'ma25') setLocalPeriods({ ...localPeriods, ma25: val });
                      else if (ma.key === 'ma99') setLocalPeriods({ ...localPeriods, ma99: val });
                    }}
                    className="w-20 px-2 py-1.5 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200"
                    min="1"
                  />

                  <select className="px-3 py-1.5 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200">
                    <option>Đóng</option>
                    <option>Mở</option>
                    <option>Cao</option>
                    <option>Thấp</option>
                  </select>

                  <select className="w-24 px-2 py-1.5 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200 flex items-center gap-1">
                    <option>━━━</option>
                  </select>

                  <input
                    type="color"
                    value={ma.color}
                    onChange={(e) => {
                      if (ma.key === 'ma7') setLocalColors({ ...localColors, ma7: e.target.value });
                      else if (ma.key === 'ma25') setLocalColors({ ...localColors, ma25: e.target.value });
                      else if (ma.key === 'ma99') setLocalColors({ ...localColors, ma99: e.target.value });
                    }}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </div>
        );
      } else if (selectedMainIndicator === 'ema') {
        // EMA Settings
        const emaLines = [
          { 
            key: 'ema12', 
            label: 'EMA1', 
            period: localPeriods.ema12 ?? 12, 
            color: localColors.ema12 ?? '#2962FF', 
            visible: localMainVis.ema12 
          },
          { 
            key: 'ema26', 
            label: 'EMA2', 
            period: localPeriods.ema26 ?? 26, 
            color: localColors.ema26 ?? '#FF6D00', 
            visible: localMainVis.ema26 
          },
        ];

        return (
          <div className="space-y-4 flex-1 px-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-medium text-dark-200">EMA</h3>
              <span className="text-dark-500">&gt;</span>
              <span className="text-xs text-dark-400">Đường trung bình động hàm mũ</span>
            </div>

            <div className="space-y-3">
              {emaLines.map((ema) => (
                <div key={ema.key} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-[80px]">
                    <input
                      type="checkbox"
                      checked={ema.visible}
                      onChange={(e) => {
                        if (ema.key === 'ema12') setLocalMainVis({ ...localMainVis, ema12: e.target.checked });
                        else if (ema.key === 'ema26') setLocalMainVis({ ...localMainVis, ema26: e.target.checked });
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-dark-200">{ema.label}</span>
                  </div>

                  <input
                    type="number"
                    value={ema.period}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (ema.key === 'ema12') setLocalPeriods({ ...localPeriods, ema12: val });
                      else if (ema.key === 'ema26') setLocalPeriods({ ...localPeriods, ema26: val });
                    }}
                    className="w-20 px-2 py-1.5 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200"
                    min="1"
                  />

                  <select className="px-3 py-1.5 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200">
                    <option>Đóng</option>
                    <option>Mở</option>
                    <option>Cao</option>
                    <option>Thấp</option>
                  </select>

                  <select className="w-24 px-2 py-1.5 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200">
                    <option>━━━</option>
                  </select>

                  <input
                    type="color"
                    value={ema.color}
                    onChange={(e) => {
                      if (ema.key === 'ema12') setLocalColors({ ...localColors, ema12: e.target.value });
                      else if (ema.key === 'ema26') setLocalColors({ ...localColors, ema26: e.target.value });
                    }}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </div>
        );
      } else if (selectedMainIndicator === 'boll') {
        // BOLL (Bollinger Bands) Settings
        const bollPeriod = localPeriods.boll?.period ?? 20;
        const bollStdDev = localPeriods.boll?.stdDev ?? 2;
        const bollColors = localColors.boll ?? { upper: '#B385F8', middle: '#EB40B5', lower: '#B385F8' };

        return (
          <div className="space-y-4 flex-1 px-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-medium text-dark-200">BOLL</h3>
              <span className="text-dark-500">-</span>
              <span className="text-xs text-dark-400">Dải Bollinger</span>
            </div>

            <div className="space-y-4">
              {/* Thời gian (Period) */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-dark-300">Thời gian</span>
                <input
                  type="number"
                  value={bollPeriod}
                  onChange={(e) => setLocalPeriods({ 
                    ...localPeriods, 
                    boll: { period: Number(e.target.value), stdDev: bollStdDev } 
                  })}
                  className="w-24 px-3 py-1.5 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200"
                  min="1"
                />
              </div>

              {/* Hệ số nhân (Standard Deviation) */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-dark-300">Hệ số nhân</span>
                <input
                  type="number"
                  value={bollStdDev}
                  onChange={(e) => setLocalPeriods({ 
                    ...localPeriods, 
                    boll: { period: bollPeriod, stdDev: Number(e.target.value) } 
                  })}
                  className="w-24 px-3 py-1.5 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200"
                  min="0.1"
                  step="0.1"
                />
              </div>

              {/* Phông nền checkbox với color picker */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={localBollFillVisible}
                    onChange={(e) => setLocalBollFillVisible(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-dark-300">Phông nền</span>
                </div>
                <input
                  type="color"
                  value={bollColors.fill ? bollColors.fill.replace(/rgba?\((\d+),\s*(\d+),\s*(\d+).*\)/, (_, r, g, b) => 
                    '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0')).join('')
                  ) : '#B385F8'}
                  onChange={(e) => {
                    const hex = e.target.value;
                    const rgba = `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, 0.1)`;
                    setLocalColors({ 
                      ...localColors, 
                      boll: { ...bollColors, fill: rgba } 
                    });
                  }}
                  className="w-8 h-8 rounded cursor-pointer"
                />
              </div>

              {/* UP - Upper Band */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-[80px]">
                  <input
                    type="checkbox"
                    checked={localMainVis.boll}
                    onChange={(e) => setLocalMainVis({ ...localMainVis, boll: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-dark-200">UP</span>
                </div>

                <select className="w-32 px-2 py-1.5 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200">
                  <option>━━━</option>
                </select>

                <input
                  type="color"
                  value={bollColors.upper}
                  onChange={(e) => setLocalColors({ 
                    ...localColors, 
                    boll: { ...bollColors, upper: e.target.value } 
                  })}
                  className="w-8 h-8 rounded cursor-pointer"
                />
              </div>

              {/* MB - Middle Band */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-[80px]">
                  <input
                    type="checkbox"
                    checked={localMainVis.boll}
                    onChange={(e) => setLocalMainVis({ ...localMainVis, boll: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-dark-200">MB</span>
                </div>

                <select className="w-32 px-2 py-1.5 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200">
                  <option>━━━</option>
                </select>

                <input
                  type="color"
                  value={bollColors.middle}
                  onChange={(e) => setLocalColors({ 
                    ...localColors, 
                    boll: { ...bollColors, middle: e.target.value } 
                  })}
                  className="w-8 h-8 rounded cursor-pointer"
                />
              </div>

              {/* DN - Lower Band */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-[80px]">
                  <input
                    type="checkbox"
                    checked={localMainVis.boll}
                    onChange={(e) => setLocalMainVis({ ...localMainVis, boll: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-dark-200">DN</span>
                </div>

                <select className="w-32 px-2 py-1.5 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200">
                  <option>━━━</option>
                </select>

                <input
                  type="color"
                  value={bollColors.lower}
                  onChange={(e) => setLocalColors({ 
                    ...localColors, 
                    boll: { ...bollColors, lower: e.target.value } 
                  })}
                  className="w-8 h-8 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        );
      }

      // Placeholder for other indicators
      return (
        <div className="flex-1 px-6 flex items-center justify-center">
          <p className="text-sm text-dark-400">
            Cài đặt cho {mainIndicatorsList.find(i => i.key === selectedMainIndicator)?.label} đang được phát triển...
          </p>
        </div>
      );
    };

    return (
      <div className="flex h-full">
        {/* Sidebar */}
        <div className="w-40 border-r border-dark-600 overflow-y-auto">
          <div className="py-2">
            <div className="px-3 py-2 text-xs font-medium text-dark-400">Main</div>
            {mainIndicatorsList.map((ind) => {
              // Calculate if any line in this indicator is enabled
              let isChecked = false;
              if (ind.key === 'ma') isChecked = localMainVis.ma7 || localMainVis.ma25 || localMainVis.ma99;
              else if (ind.key === 'ema') isChecked = localMainVis.ema12 || localMainVis.ema26;
              else if (ind.key === 'boll') isChecked = localMainVis.boll;

              return (
                <button
                  key={ind.key}
                  onClick={() => setSelectedMainIndicator(ind.key)}
                  className={`w-full px-3 py-2.5 text-left flex items-center justify-between transition-colors ${
                    selectedMainIndicator === ind.key
                      ? 'bg-dark-700 text-dark-100'
                      : 'text-dark-300 hover:bg-dark-750'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        e.stopPropagation();
                        const newState = e.target.checked;
                        if (ind.key === 'ma') {
                          setLocalMainVis({ ...localMainVis, ma7: newState, ma25: newState, ma99: newState });
                        } else if (ind.key === 'ema') {
                          setLocalMainVis({ ...localMainVis, ema12: newState, ema26: newState });
                        } else if (ind.key === 'boll') {
                          setLocalMainVis({ ...localMainVis, boll: newState });
                        }
                      }}
                      className="w-3.5 h-3.5"
                    />
                    <span className="text-sm">{ind.label}</span>
                  </div>
                  <span className="i-lucide-chevron-right text-xs opacity-60" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings Panel */}
        {renderMainIndicatorSettings()}
      </div>
    );
  };

  // Render Sub Indicators Tab (with sidebar like Binance)
  const renderSubIndicators = () => {
    const subIndicators = [
      { key: 'vol', label: 'VOL', desc: 'Volume' },
      { key: 'macd', label: 'MACD', desc: 'Moving Average Convergence Divergence' },
      { key: 'rsi', label: 'RSI', desc: 'Relative Strength Index' },
      { key: 'mfi', label: 'MFI', desc: 'Money Flow Index' },
      { key: 'kdj', label: 'KDJ', desc: 'Stochastic Oscillator' },
      { key: 'obv', label: 'OBV', desc: 'On-Balance Volume' },
      { key: 'cci', label: 'CCI', desc: 'Commodity Channel Index' },
      { key: 'stochRsi', label: 'StochRSI', desc: 'Stochastic RSI' },
      { key: 'wr', label: 'WR', desc: 'Williams %R' },
    ];

    // Render settings for selected indicator
    const renderIndicatorSettings = () => {
      if (selectedSubIndicator === 'vol') {
        return (
          <div className="space-y-4 flex-1 px-6">
            <h3 className="text-sm font-medium text-dark-200 mb-1">Vol - Khối lượng</h3>
            <p className="text-xs text-dark-400 mb-4">
              MAVOL có nghĩa là cộng khối lượng giao dịch trong một khoảng thời gian nhất định và là giá trị trung bình để tạo một đường cong mượt mà hơn trên biểu đồ khối lượng giao dịch, tức là đường khối lượng giao dịch trung bình.
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-dark-300">Long</div>
                <select className="px-3 py-1 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200">
                  <option>Đường...</option>
                </select>
              </div>

              {/* MAVOL1 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={localVolVis.mavol1}
                    onChange={(e) => setLocalVolVis({ ...localVolVis, mavol1: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-dark-200">MAVOL1</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={localPeriods.mavol1}
                    onChange={(e) => setLocalPeriods({ ...localPeriods, mavol1: Number(e.target.value) })}
                    className="w-16 px-2 py-1 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200"
                    min="1"
                  />
                  <input
                    type="color"
                    value={localColors.mavol1}
                    onChange={(e) => setLocalColors({ ...localColors, mavol1: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* MAVOL2 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={localVolVis.mavol2}
                    onChange={(e) => setLocalVolVis({ ...localVolVis, mavol2: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-dark-200">MAVOL2</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={localPeriods.mavol2}
                    onChange={(e) => setLocalPeriods({ ...localPeriods, mavol2: Number(e.target.value) })}
                    className="w-16 px-2 py-1 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200"
                    min="1"
                  />
                  <input
                    type="color"
                    value={localColors.mavol2}
                    onChange={(e) => setLocalColors({ ...localColors, mavol2: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 mb-2">
                <div className="text-xs font-medium text-dark-300">Short</div>
                <select className="px-3 py-1 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200">
                  <option>Đường...</option>
                </select>
              </div>
            </div>
          </div>
        );
      }

      // Placeholder for other indicators
      return (
        <div className="flex-1 px-6 flex items-center justify-center">
          <p className="text-sm text-dark-400">
            Cài đặt cho {subIndicators.find(i => i.key === selectedSubIndicator)?.label} đang được phát triển...
          </p>
        </div>
      );
    };

    return (
      <div className="flex h-full">
        {/* Sidebar */}
        <div className="w-40 border-r border-dark-600 overflow-y-auto">
          <div className="py-2">
            <div className="px-3 py-2 text-xs font-medium text-dark-400">Sub</div>
            {subIndicators.map((ind) => (
              <button
                key={ind.key}
                onClick={() => setSelectedSubIndicator(ind.key)}
                className={`w-full px-3 py-2.5 text-left flex items-center justify-between transition-colors ${
                  selectedSubIndicator === ind.key
                    ? 'bg-dark-700 text-dark-100'
                    : 'text-dark-300 hover:bg-dark-750'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={ind.key === 'vol' ? (localVolVis.mavol1 || localVolVis.mavol2) : false}
                    onChange={(e) => {
                      e.stopPropagation();
                      // TODO: Handle checkbox for other indicators
                      if (ind.key === 'vol') {
                        const newState = e.target.checked;
                        setLocalVolVis({ mavol1: newState, mavol2: newState });
                      }
                    }}
                    className="w-3.5 h-3.5"
                  />
                  <span className="text-sm">{ind.label}</span>
                </div>
                <span className="i-lucide-chevron-right text-xs opacity-60" />
              </button>
            ))}
          </div>
        </div>

        {/* Settings Panel */}
        {renderIndicatorSettings()}
      </div>
    );
  };

  // Render other tabs (placeholder)
  const renderPlaceholderTab = (title: string) => (
    <div className="flex items-center justify-center h-48">
      <p className="text-sm text-dark-400">Tab "{title}" đang được phát triển...</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-dark-800 rounded-2xl border border-dark-600 shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header with Tabs */}
        <div className="border-b border-dark-600">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4 flex-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-dark-300 hover:text-dark-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-dark-700 rounded-lg transition-colors ml-4 shrink-0 group"
              title="Đóng"
            >
              <svg 
                className="w-5 h-5 text-dark-300 group-hover:text-dark-100 transition-colors" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-y-auto ${activeTab === 1 || activeTab === 2 ? '' : 'p-6'}`}>
          {activeTab === 1 && renderMainIndicators()}
          {activeTab === 2 && renderSubIndicators()}
          {activeTab === 3 && renderPlaceholderTab('Dữ liệu Giao dịch')}
          {activeTab === 4 && renderPlaceholderTab('Tùy chỉnh')}
          {activeTab === 5 && renderPlaceholderTab('Kiểm định')}
        </div>

        {/* Footer */}
        <div className="border-t border-dark-600 p-4 flex items-center justify-end gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm text-dark-300 hover:text-dark-200 hover:bg-dark-700 rounded-lg transition-colors"
          >
            Đặt lại
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Lưu lại
          </button>
        </div>
      </div>
    </div>
  );
};

export default LineIndicatorSettings;