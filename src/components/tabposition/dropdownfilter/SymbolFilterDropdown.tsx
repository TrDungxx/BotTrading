import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export type PositionFilter = 'all' | 'long' | 'short' | 'current';

interface SymbolFilterDropdownProps {
  value: PositionFilter;
  onChange: (filter: PositionFilter) => void;
  currentSymbol?: string; // Symbol đang hiển thị trên chart
}

const SymbolFilterDropdown: React.FC<SymbolFilterDropdownProps> = ({ 
  value, 
  onChange,
  currentSymbol 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Lấy currentSymbol từ localStorage nếu không được truyền vào
  const [activeSymbol, setActiveSymbol] = useState<string>(() => {
    return currentSymbol || localStorage.getItem('selectedSymbol') || '';
  });

  // Lắng nghe thay đổi symbol từ chart
  useEffect(() => {
    const handleSymbolChange = (e: CustomEvent) => {
      if (e.detail?.symbol) {
        setActiveSymbol(e.detail.symbol);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'selectedSymbol' && e.newValue) {
        setActiveSymbol(e.newValue);
      }
    };

    window.addEventListener('chart-symbol-change-request', handleSymbolChange as EventListener);
    window.addEventListener('storage', handleStorageChange);

    // Check localStorage periodically for changes within same tab
    const interval = setInterval(() => {
      const stored = localStorage.getItem('selectedSymbol');
      if (stored && stored !== activeSymbol) {
        setActiveSymbol(stored);
      }
    }, 1000);

    return () => {
      window.removeEventListener('chart-symbol-change-request', handleSymbolChange as EventListener);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [activeSymbol]);

  // Cập nhật từ prop
  useEffect(() => {
    if (currentSymbol) {
      setActiveSymbol(currentSymbol);
    }
  }, [currentSymbol]);

  // Tính toán vị trí dropdown
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [isOpen]);

  // Click outside để đóng
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current && 
        !triggerRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getDisplayLabel = () => {
    if (value === 'current' && activeSymbol) {
      return `Symbol (${activeSymbol})`;
    }
    return 'Symbol';
  };

  const options: { value: PositionFilter; label: string; description?: string }[] = [
    { value: 'all', label: 'Mặc định',  },
    { value: 'long', label: 'Lệnh Long',  },
    { value: 'short', label: 'Lệnh Short',  },
    { 
      value: 'current', 
      label: 'Ẩn symbol khác', 
      
    },
  ];

  return (
    <>
      {/* Trigger Button */}
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 cursor-pointer select-none hover:text-[#fcd535] transition-colors"
      >
        <span>{getDisplayLabel()}</span>
        {/* Triangle icon - giống Binance */}
        <svg
          width="8"
          height="5"
          viewBox="0 0 8 5"
          fill="currentColor"
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M4 5L0 0h8L4 5z" />
        </svg>
      </div>

      {/* Dropdown Menu - Portal to body */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] bg-[#1e2329] border border-[#2b3139] rounded shadow-lg py-1 min-w-[160px]"
          style={{
            top: position.top,
            left: position.left,
          }}
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`
                px-3 py-2 cursor-pointer transition-colors
                hover:bg-[#2b3139]
                ${value === opt.value ? 'bg-[#2b3139]' : ''}
              `}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className={`text-xs ${value === opt.value ? 'text-[#fcd535]' : 'text-[#eaecef]'}`}>
                    {opt.label}
                  </div>
                  {opt.description && (
                    <div className="text-[10px] text-[#848e9c]">
                      {opt.description}
                    </div>
                  )}
                </div>
                {value === opt.value && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#fcd535">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                )}
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};

export default SymbolFilterDropdown;