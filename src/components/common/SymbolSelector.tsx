import React, { useEffect, useState } from 'react';

interface SymbolInfo {
  symbol: string;
  volume: number;
  priceChangePercent: number;
}

interface SymbolSelectorProps {
  symbols: SymbolInfo[]; // Danh sách symbol từ API
  currentSymbol: string;
  onChange: (symbol: string) => void;
}

export default function SymbolSelector({
  symbols,
  currentSymbol,
  onChange,
}: SymbolSelectorProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = symbols.filter((s) =>
    s.symbol.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative inline-block w-64 text-white">
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full bg-dark-700 px-4 py-2 rounded flex justify-between items-center border border-dark-600"
      >
        <span className="font-semibold">{currentSymbol}</span>
        <svg className="w-4 h-4 ml-2" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10 12a.75.75 0 01-.53-.22l-3-3a.75.75 0 111.06-1.06L10 10.19l2.47-2.47a.75.75 0 111.06 1.06l-3 3A.75.75 0 0110 12z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-2 w-full bg-dark-800 rounded shadow-lg max-h-72 overflow-y-auto border border-dark-600">
          <input
            type="text"
            className="w-full bg-dark-700 p-2 text-sm border-b border-dark-600 focus:outline-none"
            placeholder="🔍 Tìm symbol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {filtered.map((s) => (
            <button
              key={s.symbol}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-dark-600 ${
                s.symbol === currentSymbol ? 'bg-dark-700' : ''
              }`}
              onClick={() => {
                onChange(s.symbol);
                setOpen(false);
              }}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium">{s.symbol}</span>
                <span
                  className={`text-xs ${
                    s.priceChangePercent >= 0
                      ? 'text-green-500'
                      : 'text-red-500'
                  }`}
                >
                  {s.priceChangePercent >= 0 ? '+' : ''}
                  {s.priceChangePercent.toFixed(2)}%
                </span>
              </div>
              <div className="text-gray-400 text-xs">
                Volume: {s.volume.toLocaleString()}
              </div>
            </button>
          ))}

          {filtered.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-4">
              Không tìm thấy symbol nào.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
