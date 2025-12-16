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
  triggerRef?: React.RefObject<HTMLElement>;
}

const SettingControl: React.FC<Props> = ({ settings, onToggle, onClose, triggerRef }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<{ top: number; left: number } | null>(null);

  // Calculate position ONCE
  if (!positionRef.current && triggerRef?.current) {
    const rect = triggerRef.current.getBoundingClientRect();
    positionRef.current = {
      top: rect.bottom + 4,
      left: rect.left,
    };
  }

  // Click outside to close - FIX: Bỏ capture mode và kiểm tra kỹ hơn
  useEffect(() => {
    // Delay để đảm bảo portal đã render
    const timeoutId = setTimeout(() => {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node;
        
        // Check nếu click vào panel thì không làm gì
        if (panelRef.current?.contains(target)) {
          return;
        }
        
        // Check nếu click vào trigger button thì không làm gì
        if (triggerRef?.current?.contains(target)) {
          return;
        }
        
        // Click ra ngoài → đóng
        onClose?.();
      };

      document.addEventListener('mousedown', handleClickOutside);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [onClose, triggerRef]);

  const position = positionRef.current || { top: 0, left: 0 };

  const handleToggle = (key: keyof ChartSettings, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const item = ITEMS.find(it => it.key === key);
    if (item?.disabled) {
     
      return;
    }
    
    const currentValue = settings[key];
    const newValue = !currentValue;
    
    
    
    onToggle(key, newValue);
  };

  const content = (
    <div 
      ref={panelRef}
      className="fixed bg-dark-800 border border-dark-600 rounded-fluid-md shadow-lg p-fluid-2 w-64 text-fluid-sm z-[9999]"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {ITEMS.map((it) => {
        const isChecked = settings[it.key];
        
        return (
          <div
            key={it.key}
            className={`flex items-center justify-between px-fluid-3 py-2 rounded transition-colors
              ${it.disabled 
                ? 'opacity-50 cursor-not-allowed' 
                : 'cursor-pointer hover:bg-dark-700'
              }`}
            onClick={(e) => handleToggle(it.key, e)}
            onMouseDown={(e) => {
              // Prevent event from bubbling to document click handler
              e.stopPropagation();
             
            }}
          >
            <span className="select-none">{it.label}</span>
            
            {/* ✅ Custom checkbox visual */}
            <div 
              className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0
                ${isChecked 
                  ? 'bg-blue-500 border-blue-500' 
                  : 'bg-transparent border-dark-400'
                }
                ${it.disabled ? '' : 'hover:border-blue-400'}
              `}
            >
              {isChecked && (
                <svg 
                  className="w-3 h-3 text-white" 
                  fill="none" 
                  strokeWidth="2.5" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex justify-end pt-1 mt-2 border-t border-dark-600">
        <button
          className="text-xs px-fluid-3 py-fluid-1.5 rounded bg-dark-700 hover:bg-dark-600 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onClose?.();
          }}
        >
          Đóng
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default SettingControl;