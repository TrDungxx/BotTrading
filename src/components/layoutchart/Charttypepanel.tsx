import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export type ChartType = 
  | 'Bars'
  | 'Candles'
  | 'Hollow candles'
  | 'Line'
  | 'Line with markers'
  | 'Step line'
  | 'Area'
  | 'HLC area'
  | 'Baseline'
  | 'Columns'
  | 'High-low';

interface ChartTypeOption {
  type: ChartType;
  icon: React.ReactNode;
  label: string;
}

interface Props {
  currentType: ChartType;
  onTypeChange: (type: ChartType) => void;
}

// Icon Components
const BarsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M3 17V8M7 17V3M11 17V11M15 17V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const CandlesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="3" y="7" width="3" height="8" fill="currentColor"/>
    <path d="M4.5 3V7M4.5 15V17" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="8" y="4" width="3" height="6" fill="currentColor"/>
    <path d="M9.5 2V4M9.5 10V18" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="13" y="9" width="3" height="7" fill="currentColor"/>
    <path d="M14.5 5V9M14.5 16V18" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const HollowCandlesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="3" y="7" width="3" height="8" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M4.5 3V7M4.5 15V17" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="8" y="4" width="3" height="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M9.5 2V4M9.5 10V18" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="13" y="9" width="3" height="7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M14.5 5V9M14.5 16V18" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const LineIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M2 15L6 10L10 12L14 6L18 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const LineWithMarkersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M2 15L6 10L10 12L14 6L18 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="2" cy="15" r="2" fill="currentColor"/>
    <circle cx="6" cy="10" r="2" fill="currentColor"/>
    <circle cx="10" cy="12" r="2" fill="currentColor"/>
    <circle cx="14" cy="6" r="2" fill="currentColor"/>
    <circle cx="18" cy="8" r="2" fill="currentColor"/>
  </svg>
);

const StepLineIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M2 15H5V10H9V12H13V6H16V8H18" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"/>
  </svg>
);

const AreaIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M2 18V15L6 10L10 12L14 6L18 8V18H2Z" fill="currentColor" opacity="0.3"/>
    <path d="M2 15L6 10L10 12L14 6L18 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const HLCAreaIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M3 18V10L6 7L9 9L12 5L15 8L18 6V18H3Z" fill="currentColor" opacity="0.2"/>
    <path d="M3 10L6 7L9 9L12 5L15 8L18 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const BaselineIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M2 10H18" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.5"/>
    <path d="M2 18V8L6 5L10 7L14 3L18 6V18H2Z" fill="currentColor" opacity="0.2"/>
    <path d="M2 8L6 5L10 7L14 3L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const ColumnsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="2" y="10" width="2.5" height="8" fill="currentColor"/>
    <rect x="5.5" y="7" width="2.5" height="11" fill="currentColor"/>
    <rect x="9" y="12" width="2.5" height="6" fill="currentColor"/>
    <rect x="12.5" y="5" width="2.5" height="13" fill="currentColor"/>
    <rect x="16" y="8" width="2.5" height="10" fill="currentColor"/>
  </svg>
);

const HighLowIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M4 5V15M4 5H6M4 15H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M9 8V13M9 8H11M9 13H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M14 3V17M14 3H16M14 17H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const chartTypeOptions: ChartTypeOption[] = [
  { type: 'Bars', icon: <BarsIcon />, label: 'Bars' },
  { type: 'Candles', icon: <CandlesIcon />, label: 'Candles' },
  { type: 'Hollow candles', icon: <HollowCandlesIcon />, label: 'Hollow candles' },
  { type: 'Line', icon: <LineIcon />, label: 'Line' },
  { type: 'Line with markers', icon: <LineWithMarkersIcon />, label: 'Line with markers' },
  { type: 'Step line', icon: <StepLineIcon />, label: 'Step line' },
  { type: 'Area', icon: <AreaIcon />, label: 'Area' },
  { type: 'HLC area', icon: <HLCAreaIcon />, label: 'HLC area' },
  { type: 'Baseline', icon: <BaselineIcon />, label: 'Baseline' },
  { type: 'Columns', icon: <ColumnsIcon />, label: 'Columns' },
  { type: 'High-low', icon: <HighLowIcon />, label: 'High-low' },
];

const ChartTypePanel: React.FC<Props> = ({ currentType, onTypeChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Lấy icon của type hiện tại
  const currentOption = chartTypeOptions.find(opt => opt.type === currentType);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Get button position
  const buttonRect = buttonRef.current?.getBoundingClientRect();

  return (
    <>
      {/* Button mở panel */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-dark-800/95 hover:bg-dark-700 
                   border border-dark-600 rounded-lg text-dark-100 text-sm
                   transition-colors duration-150 backdrop-blur-sm"
      >
        <span className="flex items-center justify-center w-5 h-5">
          {currentOption?.icon}
        </span>
        <span>{currentType}</span>
        <svg 
          width="12" 
          height="12" 
          viewBox="0 0 12 12" 
          fill="none"
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown menu with Portal */}
      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed w-[240px] bg-dark-800/95 
                     border border-dark-600 rounded-xl shadow-2xl backdrop-blur-md
                     overflow-hidden z-[9999]"
          style={{
            top: buttonRect ? buttonRect.bottom + 4 : 0,
            left: buttonRect ? buttonRect.left : 0,
          }}
        >
          <div className="py-2 max-h-[420px] overflow-y-auto custom-scrollbar">
            {chartTypeOptions.map((option, index) => {
              const isSelected = option.type === currentType;
              const isFirstInSection = 
                index === 0 || 
                index === 3 || 
                index === 6 || 
                index === 9;

              return (
                <React.Fragment key={option.type}>
                  {isFirstInSection && index !== 0 && (
                    <div className="my-1 h-px bg-dark-600" />
                  )}

                  <button
                    onClick={() => {
                      onTypeChange(option.type);
                      setIsOpen(false);
                    }}
                    className={`
                      w-full px-4 py-2.5 text-left text-sm
                      flex items-center gap-3
                      transition-colors duration-150
                      ${isSelected 
                        ? 'bg-blue-600/20 text-blue-400 font-medium' 
                        : 'text-dark-100 hover:bg-dark-700'
                      }
                    `}
                  >
                    <span className="flex items-center justify-center w-5 h-5 flex-shrink-0">
                      {option.icon}
                    </span>
                    <span className="flex-1">{option.label}</span>
                    {isSelected && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                        <path d="M13 4L6 11L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default ChartTypePanel;