import React, { useState, useRef, useEffect } from "react";

type TpSlMode = "price" | "pnl" | "roi";

interface Props {
  mode: TpSlMode;
  onChange: (mode: TpSlMode) => void;
}

/**
 * Simple dropdown để chọn mode TP/SL
 * Giống Binance - button có border và arrow
 */
const TpSlModeSelect: React.FC<Props> = ({ mode, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const options: { value: TpSlMode; label: string }[] = [
    { value: "price", label: "Giá" },
    { value: "pnl", label: "PnL" },
    { value: "roi", label: "ROI" },
  ];

  const currentLabel = options.find((opt) => opt.value === mode)?.label || "Giá";

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`text-white text-xs flex items-center gap-fluid-1.5 px-2.5 py-fluid-1  transition-all ${
          isOpen 
            ? "bg-primary-600 border-primary-500" 
            : "bg-transparent border-dark-600 hover:bg-dark-700/30"
        }`}
      >
        {currentLabel}
        <svg
          className={`w-8 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M16.37 8.75H7.63a.75.75 0 00-.569 1.238l4.37 5.098c.299.349.84.349 1.138 0l4.37-5.098a.75.75 0 00-.57-1.238z"
            fill="currentColor"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-1 bg-dark-800 border border-dark-700 rounded shadow-lg z-[9999] min-w-[80px]"
          style={{ top: "100%" }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-fluid-3 py-2 text-xs text-left transition-colors ${
                mode === option.value
                  ? "bg-primary-600 text-white"
                  : "text-slate-300 hover:bg-dark-700"
              } first:rounded-t last:rounded-b`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TpSlModeSelect;