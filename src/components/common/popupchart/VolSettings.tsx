import React, { useState } from 'react';

interface VOLSettingsProps {
  visibleSettings: {
    mavol1: boolean;
    mavol2: boolean;
  };
  periods: {
    mavol1: number;
    mavol2: number;
  };
  colors?: {
    mavol1: string;
    mavol2: string;
  };
  onChange: (
    visible: { mavol1: boolean; mavol2: boolean }, 
    periods: { mavol1: number; mavol2: number },
    colors: { mavol1: string; mavol2: string }
  ) => void;
  onClose: () => void;
}

const VOLSettings: React.FC<VOLSettingsProps> = ({
  visibleSettings,
  periods: initialPeriods,
  colors: initialColors,
  onChange,
  onClose,
}) => {
  const [visible, setVisible] = useState(visibleSettings);
  const [periods, setPeriods] = useState(initialPeriods);
  const [colors, setColors] = useState(initialColors || {
    mavol1: '#0ECB81',
    mavol2: '#EB40B5',
  });
  const [longMode, setLongMode] = useState<string>('Đường...');
  const [shortMode, setShortMode] = useState<string>('Đường...');

  const handleSave = () => {
    onChange(visible, periods, colors); // ✅ Truyền colors
    onClose();
  };

  const handlePeriodChange = (key: 'mavol1' | 'mavol2', value: string) => {
    // Allow empty string temporarily while typing
    if (value === '') {
      setPeriods((prev) => ({ ...prev, [key]: 0 }));
      return;
    }
    
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setPeriods((prev) => ({ ...prev, [key]: num }));
    }
  };

  const handleReset = () => {
    setVisible({ mavol1: true, mavol2: true });
    setPeriods({ mavol1: 7, mavol2: 14 });
    setColors({ mavol1: '#0ECB81', mavol2: '#EB40B5' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#1e2329] rounded-lg shadow-2xl w-[580px] max-h-[90vh] overflow-hidden border border-[#2b3139]">
        {/* Header tabs */}
        <div className="flex items-center border-b border-[#2b3139] bg-[#181a20]">
          <button className="px-6 py-3 text-sm font-medium text-white border-b-2 border-[#fcd535] bg-[#1e2329]">
            Chỉ báo chính
          </button>
          <button className="px-6 py-3 text-sm text-[#848e9c] hover:text-white">
            Chỉ báo phụ
          </button>
          <button className="px-6 py-3 text-sm text-[#848e9c] hover:text-white">
            Dữ liệu Giao dịch Chỉ số phụ
          </button>
          <button className="px-6 py-3 text-sm text-[#848e9c] hover:text-white">
            Tùy chỉnh
          </button>
          <button className="px-6 py-3 text-sm text-[#848e9c] hover:text-white">
            Kiểm định
          </button>
          <button
            onClick={onClose}
            className="ml-auto p-3 text-[#848e9c] hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/>
              <path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex h-[500px]">
          {/* Sidebar */}
          <div className="w-[180px] bg-[#181a20] border-r border-[#2b3139] overflow-y-auto">
            <div className="p-3 text-xs text-[#848e9c] font-medium">Sub</div>
            
            <button className="w-full px-4 py-2.5 text-left text-sm text-white bg-[#1e2329] border-l-2 border-[#fcd535] flex items-center justify-between">
              <span>VOL</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#848e9c]">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>

            <button className="w-full px-4 py-2.5 text-left text-sm text-[#848e9c] hover:bg-[#1e2329] flex items-center justify-between">
              <span>MACD</span>
            </button>

            <button className="w-full px-4 py-2.5 text-left text-sm text-[#848e9c] hover:bg-[#1e2329] flex items-center justify-between">
              <span>RSI</span>
            </button>

            <button className="w-full px-4 py-2.5 text-left text-sm text-[#848e9c] hover:bg-[#1e2329] flex items-center justify-between">
              <span>MFI</span>
            </button>

            <button className="w-full px-4 py-2.5 text-left text-sm text-[#848e9c] hover:bg-[#1e2329] flex items-center justify-between">
              <span>KDJ</span>
            </button>

            <button className="w-full px-4 py-2.5 text-left text-sm text-[#848e9c] hover:bg-[#1e2329] flex items-center justify-between">
              <span>OBV</span>
            </button>

            <button className="w-full px-4 py-2.5 text-left text-sm text-[#848e9c] hover:bg-[#1e2329] flex items-center justify-between">
              <span>CCI</span>
            </button>

            <button className="w-full px-4 py-2.5 text-left text-sm text-[#848e9c] hover:bg-[#1e2329] flex items-center justify-between">
              <span>StochRSI</span>
            </button>

            <button className="w-full px-4 py-2.5 text-left text-sm text-[#848e9c] hover:bg-[#1e2329] flex items-center justify-between">
              <span>WR</span>
            </button>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-6">
            <h3 className="text-white font-medium mb-2">Vol - Khối lượng</h3>
            <p className="text-xs text-[#848e9c] leading-relaxed mb-6">
              MAVOL có nghĩa là của khối lượng giao dịch trong một khoảng thời gian nhất định và là giá trị trung bình dề từo mỗi lượng giao dịch mười ma hơn trên biểu cỏ khối lượng giao dịch, tức là đường khối lượng giảo dịch trung bình.
            </p>

            {/* Long dropdown */}
            <div className="mb-4">
              <label className="block text-sm text-[#848e9c] mb-2">Long</label>
              <select
                value={longMode}
                onChange={(e) => setLongMode(e.target.value)}
                className="w-full bg-[#2b3139] border border-[#2b3139] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#fcd535]"
              >
                <option>Đường...</option>
                <option>Cột</option>
                <option>Vùng</option>
              </select>
            </div>

            {/* Short dropdown */}
            <div className="mb-6">
              <label className="block text-sm text-[#848e9c] mb-2">Short</label>
              <select
                value={shortMode}
                onChange={(e) => setShortMode(e.target.value)}
                className="w-full bg-[#2b3139] border border-[#2b3139] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#fcd535]"
              >
                <option>Đường...</option>
                <option>Cột</option>
                <option>Vùng</option>
              </select>
            </div>

            {/* MAVOL1 */}
            <div className="flex items-center gap-4 mb-4">
              <input
                type="checkbox"
                checked={visible.mavol1}
                onChange={(e) => setVisible((prev) => ({ ...prev, mavol1: e.target.checked }))}
                className="w-4 h-4 rounded border-[#2b3139] bg-[#2b3139] text-[#0ecb81] focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-sm text-white min-w-[80px]">MAVOL1</span>
              <input
                type="text"
                value={periods.mavol1 || ''}
                onChange={(e) => handlePeriodChange('mavol1', e.target.value)}
                onBlur={() => {
                  // Ensure minimum value of 1 on blur
                  if (periods.mavol1 < 1) {
                    setPeriods((prev) => ({ ...prev, mavol1: 1 }));
                  }
                }}
                className="w-24 bg-[#2b3139] border border-[#2b3139] rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#fcd535]"
                placeholder="7"
              />
              <div className="flex-1" />
              <input
                type="color"
                value={colors.mavol1}
                onChange={(e) => setColors((prev) => ({ ...prev, mavol1: e.target.value }))}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                title="Chọn màu MAVOL1"
              />
            </div>

            {/* MAVOL2 */}
            <div className="flex items-center gap-4 mb-4">
              <input
                type="checkbox"
                checked={visible.mavol2}
                onChange={(e) => setVisible((prev) => ({ ...prev, mavol2: e.target.checked }))}
                className="w-4 h-4 rounded border-[#2b3139] bg-[#2b3139] text-[#eb40b5] focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-sm text-white min-w-[80px]">MAVOL2</span>
              <input
                type="text"
                value={periods.mavol2 || ''}
                onChange={(e) => handlePeriodChange('mavol2', e.target.value)}
                onBlur={() => {
                  // Ensure minimum value of 1 on blur
                  if (periods.mavol2 < 1) {
                    setPeriods((prev) => ({ ...prev, mavol2: 1 }));
                  }
                }}
                className="w-24 bg-[#2b3139] border border-[#2b3139] rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#fcd535]"
                placeholder="14"
              />
              <div className="flex-1" />
              <input
                type="color"
                value={colors.mavol2}
                onChange={(e) => setColors((prev) => ({ ...prev, mavol2: e.target.value }))}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                title="Chọn màu MAVOL2"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#2b3139] bg-[#181a20]">
          <button
            onClick={handleReset}
            className="px-6 py-2 rounded text-sm font-medium text-[#848e9c] hover:text-white transition-colors"
          >
            Đặt lại
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded text-sm font-medium bg-[#fcd535] text-[#181a20] hover:bg-[#f0b90b] transition-colors"
          >
            Lưu lại
          </button>
        </div>
      </div>
    </div>
  );
};

export default VOLSettings;