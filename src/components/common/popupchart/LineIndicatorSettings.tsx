import React, { useState } from 'react';

export interface MainIndicatorConfig {
  ma7: boolean;
  ma25: boolean;
  ma99: boolean;
  ema12: boolean;
  ema26: boolean;
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
  mainVisible?: MainIndicatorConfig;
  volumeVisible?: VolumeIndicatorConfig;
  subVisible?: SubIndicatorConfig;
  periods?: IndicatorPeriods;
  colors?: IndicatorColors;
  onChange?: (
    mainVis?: MainIndicatorConfig,
    volumeVis?: VolumeIndicatorConfig,
    subVis?: SubIndicatorConfig,
    per?: IndicatorPeriods,
    col?: IndicatorColors
  ) => void;
  onClose: () => void;
}

const LineIndicatorSettings: React.FC<LineIndicatorSettingsProps> = ({
  type,
  mainVisible = { ma7: true, ma25: true, ma99: true, ema12: false, ema26: false },
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
    rsi: '#7E57C2',
    mfi: '#26A69A',
    kdj: { k: '#2962FF', d: '#FF6D00', j: '#9C27B0' },
    obv: '#00BCD4',
    cci: '#FF9800',
    stochRsi: { k: '#2962FF', d: '#FF6D00' },
    wr: '#E91E63',
    macd: { macd: '#2962FF', signal: '#FF6D00', histogram: '#26A69A' },
  },
  onChange,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState(1);
  const [localMainVis, setLocalMainVis] = useState(mainVisible);
  const [localVolVis, setLocalVolVis] = useState(volumeVisible);
  const [localSubVis, setLocalSubVis] = useState(subVisible);
  const [localPeriods, setLocalPeriods] = useState(periods);
  const [localColors, setLocalColors] = useState(colors);

  const tabs = [
    { id: 1, label: 'Chỉ báo chính' },
    { id: 2, label: 'Chỉ báo phụ' },
    { id: 3, label: 'Dữ liệu Giao dịch' },
    { id: 4, label: 'Tùy chỉnh' },
    { id: 5, label: 'Kiểm định' },
  ];

  const handleSave = () => {
    onChange?.(localMainVis, localVolVis, localSubVis, localPeriods, localColors);
    onClose();
  };

  const handleReset = () => {
    if (type === 'main') {
      setLocalMainVis({ ma7: true, ma25: true, ma99: true, ema12: false, ema26: false });
      setLocalPeriods({
        ...localPeriods,
        ma7: 7,
        ma25: 25,
        ma99: 99,
        ema12: 12,
        ema26: 26,
      });
      setLocalColors({
        ...localColors,
        ma7: '#F0B90B',
        ma25: '#EB40B5',
        ma99: '#B385F8',
        ema12: '#2962FF',
        ema26: '#FF6D00',
      });
    } else {
      setLocalVolVis({ mavol1: true, mavol2: true });
      setLocalPeriods({
        ...localPeriods,
        mavol1: 7,
        mavol2: 14,
      });
      setLocalColors({
        ...localColors,
        mavol1: '#0ECB81',
        mavol2: '#EB40B5',
      });
    }
  };

  // Render Main Indicators Tab
  const renderMainIndicators = () => {
    if (type === 'main') {
      return (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-dark-200 mb-3">Moving Averages</h3>
          
          {/* MA7 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={localMainVis.ma7}
                onChange={(e) => setLocalMainVis({ ...localMainVis, ma7: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm text-dark-200">MA7</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={localPeriods.ma7}
                onChange={(e) => setLocalPeriods({ ...localPeriods, ma7: Number(e.target.value) })}
                className="w-16 px-2 py-1 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200"
                min="1"
              />
              <input
                type="color"
                value={localColors.ma7}
                onChange={(e) => setLocalColors({ ...localColors, ma7: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* MA25 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={localMainVis.ma25}
                onChange={(e) => setLocalMainVis({ ...localMainVis, ma25: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm text-dark-200">MA25</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={localPeriods.ma25}
                onChange={(e) => setLocalPeriods({ ...localPeriods, ma25: Number(e.target.value) })}
                className="w-16 px-2 py-1 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200"
                min="1"
              />
              <input
                type="color"
                value={localColors.ma25}
                onChange={(e) => setLocalColors({ ...localColors, ma25: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* MA99 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={localMainVis.ma99}
                onChange={(e) => setLocalMainVis({ ...localMainVis, ma99: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm text-dark-200">MA99</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={localPeriods.ma99}
                onChange={(e) => setLocalPeriods({ ...localPeriods, ma99: Number(e.target.value) })}
                className="w-16 px-2 py-1 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200"
                min="1"
              />
              <input
                type="color"
                value={localColors.ma99}
                onChange={(e) => setLocalColors({ ...localColors, ma99: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer"
              />
            </div>
          </div>

          <div className="my-4 h-px bg-dark-600" />

          <h3 className="text-sm font-medium text-dark-200 mb-3">Exponential Moving Averages</h3>

          {/* EMA12 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={localMainVis.ema12}
                onChange={(e) => setLocalMainVis({ ...localMainVis, ema12: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm text-dark-200">EMA12</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={localPeriods.ema12}
                onChange={(e) => setLocalPeriods({ ...localPeriods, ema12: Number(e.target.value) })}
                className="w-16 px-2 py-1 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200"
                min="1"
              />
              <input
                type="color"
                value={localColors.ema12}
                onChange={(e) => setLocalColors({ ...localColors, ema12: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* EMA26 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={localMainVis.ema26}
                onChange={(e) => setLocalMainVis({ ...localMainVis, ema26: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm text-dark-200">EMA26</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={localPeriods.ema26}
                onChange={(e) => setLocalPeriods({ ...localPeriods, ema26: Number(e.target.value) })}
                className="w-16 px-2 py-1 bg-dark-700 border border-dark-600 rounded text-xs text-dark-200"
                min="1"
              />
              <input
                type="color"
                value={localColors.ema26}
                onChange={(e) => setLocalColors({ ...localColors, ema26: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      );
    } else {
      // Volume chart - show MAVOL settings
      return (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-dark-200 mb-3">Volume - Khối lượng</h3>
          <p className="text-xs text-dark-400 mb-4">
            MAVOL có nghĩa là của khối lượng giao dịch trong một khoảng thời gian nhất định và là giá trị trung bình
            của khối lượng ma hơi trên biểu đồ khối lượng giao dịch, tức là đường khối lượng giao dịch trung bình.
          </p>

          <div className="space-y-3">
            <div className="text-xs font-medium text-dark-300 mb-2">Long</div>
            <div className="pl-4 space-y-3">
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
            </div>

            <div className="text-xs font-medium text-dark-300 mb-2 mt-4">Short</div>
            <div className="pl-4">
              <select className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded text-sm text-dark-200">
                <option>Đường...</option>
              </select>
            </div>
          </div>
        </div>
      );
    }
  };

  // Render Sub Indicators Tab
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

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-dark-200">Chỉ báo phụ</h3>
          <span className="text-xs text-dark-400">Sub Indicators</span>
        </div>

        <div className="space-y-1">
          {subIndicators.map((ind) => (
            <button
              key={ind.key}
              className="w-full px-3 py-2 text-left hover:bg-dark-700 rounded flex items-center justify-between group"
              onClick={() => {
                // TODO: Open detailed settings for this indicator
                console.log('Open settings for', ind.label);
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm text-dark-200 font-medium">{ind.label}</span>
                <span className="text-xs text-dark-400">{ind.desc}</span>
              </div>
              <span className="i-lucide-chevron-right text-dark-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
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
              className="p-2 hover:bg-dark-700 rounded-lg transition-colors ml-4"
            >
              <span className="i-lucide-x text-dark-300" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
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