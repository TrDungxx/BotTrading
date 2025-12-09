import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

// ===== TYPES =====
export type SortDirection = 'asc' | 'desc' | null;

// Sort thường (cho các cột khác)
export type StandardSortType = 'default';

// Sort đặc biệt cho ROI
export type RoiSortType = 'all' | 'positive' | 'negative';

export interface SortConfig {
  column: string;
  direction: SortDirection;
  roiType?: RoiSortType; // Chỉ dùng cho cột ROI
}

// ===== STANDARD SORT HEADER (cho Symbol, Size, Entry, Mark Price, Margin, PNL) =====
interface StandardSortHeaderProps {
  label: string;
  column: string;
  currentSort: SortConfig | null;
  onSort: (config: SortConfig | null) => void;
}

export const StandardSortHeader: React.FC<StandardSortHeaderProps> = ({
  label,
  column,
  currentSort,
  onSort,
}) => {
  const isActive = currentSort?.column === column;
  const direction = isActive ? currentSort.direction : null;

  const handleClick = () => {
    if (!isActive || direction === null) {
      // Chưa sort hoặc reset -> sort asc
      onSort({ column, direction: 'asc' });
    } else if (direction === 'asc') {
      // Đang asc -> chuyển desc
      onSort({ column, direction: 'desc' });
    } else {
      // Đang desc -> reset (không sort)
      onSort(null);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="flex items-center gap-1 cursor-pointer select-none hover:text-[#fcd535] transition-colors"
    >
      <span>{label}</span>
      <div className="flex flex-col">
        {/* Up arrow */}
        <svg
          width="8"
          height="4"
          viewBox="0 0 8 4"
          fill="currentColor"
          className={`${
            isActive && direction === 'asc' ? 'text-[#fcd535]' : 'text-gray-500'
          }`}
        >
          <path d="M4 0L8 4H0L4 0z" />
        </svg>
        {/* Down arrow */}
        <svg
          width="8"
          height="4"
          viewBox="0 0 8 4"
          fill="currentColor"
          className={`${
            isActive && direction === 'desc' ? 'text-[#fcd535]' : 'text-gray-500'
          }`}
        >
          <path d="M4 4L0 0h8L4 4z" />
        </svg>
      </div>
    </div>
  );
};

// ===== ROI SORT HEADER (dropdown với 3 loại sort) =====
interface RoiSortHeaderProps {
  currentSort: SortConfig | null;
  onSort: (config: SortConfig | null) => void;
}

export const RoiSortHeader: React.FC<RoiSortHeaderProps> = ({
  currentSort,
  onSort,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const isActive = currentSort?.column === 'roi';
  const direction = isActive ? currentSort.direction : null;
  const roiType = isActive ? (currentSort.roiType || 'all') : 'all';

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

  // Xác định màu icon dựa trên roiType
  const getIconColor = (type: RoiSortType, dir: SortDirection) => {
    if (!dir) return 'text-gray-500';
    switch (type) {
      case 'negative':
        return 'text-[#f6465d]'; // Đỏ
      case 'positive':
        return 'text-[#0ecb81]'; // Xanh
      default:
        return 'text-white'; // Trắng
    }
  };

  const currentIconColor = isActive ? getIconColor(roiType, direction) : 'text-gray-500';

  const handleSortClick = (type: RoiSortType, dir: SortDirection) => {
    if (isActive && roiType === type && direction === dir) {
      // Click lại cùng option -> reset
      onSort(null);
    } else {
      onSort({ column: 'roi', direction: dir, roiType: type });
    }
    setIsOpen(false);
  };

  const options: { type: RoiSortType; label: string; color: string }[] = [
    { type: 'all', label: 'ROI Tất cả', color: 'text-white' },
    { type: 'positive', label: 'ROI Dương', color: 'text-[#0ecb81]' },
    { type: 'negative', label: 'ROI Âm', color: 'text-[#f6465d]' },
  ];

  return (
    <>
      {/* Trigger */}
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 cursor-pointer select-none hover:text-[#fcd535] transition-colors"
      >
        <span>PNL(ROI%)</span>
        <div className="flex flex-col">
          <svg
            width="8"
            height="4"
            viewBox="0 0 8 4"
            fill="currentColor"
            className={isActive && direction === 'asc' ? currentIconColor : 'text-gray-500'}
          >
            <path d="M4 0L8 4H0L4 0z" />
          </svg>
          <svg
            width="8"
            height="4"
            viewBox="0 0 8 4"
            fill="currentColor"
            className={isActive && direction === 'desc' ? currentIconColor : 'text-gray-500'}
          >
            <path d="M4 4L0 0h8L4 4z" />
          </svg>
        </div>
        {/* Small dropdown indicator */}
        <svg
          width="6"
          height="4"
          viewBox="0 0 6 4"
          fill="currentColor"
          className={`ml-0.5 transition-transform duration-200 text-gray-400 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M3 4L0 0h6L3 4z" />
        </svg>
      </div>

      {/* Dropdown Menu */}
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
            <div key={opt.type} className="px-2 py-1">
              <div className={`text-[10px] ${opt.color} mb-1`}>{opt.label}</div>
              <div className="flex gap-2">
                {/* Tăng dần */}
                <button
                  onClick={() => handleSortClick(opt.type, 'asc')}
                  className={`
                    flex items-center gap-1 px-2 py-1 rounded text-[10px]
                    ${isActive && roiType === opt.type && direction === 'asc'
                      ? `bg-[#2b3139] ${opt.color}`
                      : 'text-gray-400 hover:bg-[#2b3139]'
                    }
                  `}
                >
                  <svg width="8" height="4" viewBox="0 0 8 4" fill="currentColor">
                    <path d="M4 0L8 4H0L4 0z" />
                  </svg>
                  Tăng
                </button>
                {/* Giảm dần */}
                <button
                  onClick={() => handleSortClick(opt.type, 'desc')}
                  className={`
                    flex items-center gap-1 px-2 py-1 rounded text-[10px]
                    ${isActive && roiType === opt.type && direction === 'desc'
                      ? `bg-[#2b3139] ${opt.color}`
                      : 'text-gray-400 hover:bg-[#2b3139]'
                    }
                  `}
                >
                  <svg width="8" height="4" viewBox="0 0 8 4" fill="currentColor">
                    <path d="M4 4L0 0h8L4 4z" />
                  </svg>
                  Giảm
                </button>
              </div>
            </div>
          ))}
          
          {/* Reset button */}
          {isActive && (
            <div className="border-t border-[#2b3139] mt-1 pt-1 px-2">
              <button
                onClick={() => {
                  onSort(null);
                  setIsOpen(false);
                }}
                className="w-full text-center text-[10px] text-gray-400 hover:text-white py-1"
              >
                Bỏ sắp xếp
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
};

export default { StandardSortHeader, RoiSortHeader };