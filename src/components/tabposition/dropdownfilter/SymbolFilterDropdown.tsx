import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export type PositionFilter = 'all' | 'long' | 'short';

interface SymbolFilterDropdownProps {
  value: PositionFilter;
  onChange: (filter: PositionFilter) => void;
  hideOtherSymbols: boolean;
  onHideOtherSymbolsChange: (hide: boolean) => void;
  currentSymbol?: string;
}

const SymbolFilterDropdown: React.FC<SymbolFilterDropdownProps> = ({ 
  value, 
  onChange,
  hideOtherSymbols,
  onHideOtherSymbolsChange,
  currentSymbol 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const [activeSymbol, setActiveSymbol] = useState<string>(() => {
    return currentSymbol || localStorage.getItem('selectedSymbol') || '';
  });

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

  useEffect(() => {
    if (currentSymbol) {
      setActiveSymbol(currentSymbol);
    }
  }, [currentSymbol]);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [isOpen]);

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

  const options: { value: PositionFilter; label: string }[] = [
    { value: 'all', label: 'Mặc định' },
    { value: 'long', label: 'Lệnh Long' },
    { value: 'short', label: 'Lệnh Short' },
  ];

  return (
    <div className="flex flex-col gap-1.5">
      {/* Row 1: Symbol dropdown */}
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 cursor-pointer select-none hover:text-[#fcd535] transition-colors"
      >
        <span>SYMBOL</span>
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

      {/* Row 2: Custom Checkbox - Hide other Symbols */}
      <div 
        className="flex items-center gap-2 cursor-pointer select-none group"
        onClick={(e) => {
          e.stopPropagation();
          onHideOtherSymbolsChange(!hideOtherSymbols);
        }}
      >
        {/* Custom Checkbox */}
        <div 
          className={`
            relative w-[14px] h-[14px] rounded-[3px] border transition-all duration-200
            flex items-center justify-center shrink-0
            ${hideOtherSymbols 
              ? 'bg-[#256ec2ff] border-[#256ec2ff]' 
              : 'bg-transparent border-[#474d57] group-hover:border-[#848e9c]'
            }
          `}
        >
          {/* Checkmark */}
          {hideOtherSymbols && (
            <svg 
              width="10" 
              height="8" 
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
        </div>
        
        {/* Label */}
        <span 
          className={`
            text-[11px] whitespace-nowrap transition-colors duration-200
            ${hideOtherSymbols ? 'text-[#eaecef]' : 'text-[#848e9c] group-hover:text-[#eaecef]'}
          `}
        >
          Hide other Symbols
        </span>
      </div>

      {/* Dropdown Menu */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] bg-[#1e2329] border border-[#2b3139] rounded shadow-lg py-1 min-w-[140px]"
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
                px-3 py-2 cursor-pointer transition-colors text-xs
                hover:bg-[#2b3139]
                ${value === opt.value ? 'bg-[#2b3139] text-[#f1f1edff]' : 'text-[#eaecef]'}
              `}
            >
              <div className="flex items-center justify-between gap-2">
                <span>{opt.label}</span>
                {value === opt.value && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#f7f70cff">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                )}
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export default SymbolFilterDropdown;