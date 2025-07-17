import React from 'react';
import './SymbolDropdown.css'; // optional style
import coinIcons from '../../utils/coinIcons';



interface SymbolItem {
  symbol: string;
  price: number;
  percentChange: number;
  volume: number;
}

interface Props {
  symbols: SymbolItem[];
  onSelect: (symbol: string) => void;
  selectedSymbol: string;
}

const SymbolDropdown: React.FC<Props> = ({ symbols, onSelect, selectedSymbol }) => {
  return (
    <div className="symbol-dropdown w-[350px] max-h-[500px] overflow-y-auto bg-dark-800 border border-dark-700 rounded shadow-lg text-sm">
      {symbols.map((item) => {
        const base = item.symbol.replace(/USDT$/, '');
        const isActive = item.symbol === selectedSymbol;

        return (
          <div
            key={item.symbol}
            className={`flex items-center px-3 py-2 cursor-pointer hover:bg-dark-700 ${
              isActive ? 'bg-dark-700' : ''
            }`}
            onClick={() => onSelect(item.symbol)}
          >
            {/* Icon */}
            {coinIcons[base] ? (
              <img src={coinIcons[base]} alt={base} className="w-5 h-5 mr-2" />
            ) : (
              <div className="w-5 h-5 mr-2 bg-warning-300 text-dark-800 text-xs flex items-center justify-center rounded-full font-bold">
                {base[0]}
              </div>
            )}

            {/* Symbol + Info */}
            <div className="flex-1">
              <div className="font-semibold">{item.symbol}</div>
              <div className="text-xs text-dark-400">Vol: {item.volume.toLocaleString()}</div>
            </div>

            <div className="text-right">
              <div className="font-mono">{item.price.toFixed(2)}</div>
              <div className={`text-xs ${item.percentChange >= 0 ? 'text-success-500' : 'text-danger-500'}`}>
                {item.percentChange >= 0 ? '+' : ''}
                {item.percentChange.toFixed(2)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SymbolDropdown;
