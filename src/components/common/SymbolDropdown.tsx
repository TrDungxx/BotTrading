import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import coinIcons from '../../utils/coinIcons';
import { useAuth } from '../../context/AuthContext';

interface SymbolItem {
  symbol: string;
  price: number;
  percentChange: number;
  volume: number;
}

interface Props {
  symbols: SymbolItem[];
  selectedSymbol: string;
  favorites: string[];
  searchTerm: string;
  activeTab: 'favorites' | 'all';
  onSelect: (symbol: string) => void;
  onToggleFavorite: (symbol: string) => void;
  onSearchChange: (term: string) => void;
  onTabChange: (tab: 'favorites' | 'all') => void;
}

const SymbolDropdown: React.FC<Props> = ({
  symbols,
  selectedSymbol,
  favorites,
  searchTerm,
  activeTab,
  onSelect,
  onToggleFavorite,
  onSearchChange,
  onTabChange,
}) => {
  const { user } = useAuth();
  const favoriteKey = `favoriteSymbols_${user?.id || 'guest'}`;

  const [favoriteSymbols, setFavoriteSymbols] = useState<string[]>(() => {
    const stored = localStorage.getItem(favoriteKey);
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(favoriteKey, JSON.stringify(favoriteSymbols));
    }
  }, [favoriteSymbols, favoriteKey, user?.id]);

  const filtered = symbols.filter(s =>
    s.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const favoriteList = filtered.filter(s => favoriteSymbols.includes(s.symbol));
  const allList = filtered;

  const listToRender = activeTab === 'favorites' ? favoriteList : allList;

  return (
    <div className="symbol-dropdown w-[350px] max-h-[500px] overflow-y-auto bg-dark-800 border border-dark-700 rounded shadow-lg text-sm">
      {/* Search */}
      <div className="p-2">
        <input
          type="text"
          placeholder="Search symbol..."
          className="w-full px-3 py-2 text-xs rounded bg-dark-700 text-white border border-dark-600 focus:outline-none focus:border-primary-500"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-700 text-xs text-dark-400">
        <button
          onClick={() => onTabChange('favorites')}
          className={`flex-1 py-2 text-center ${activeTab === 'favorites' ? 'border-b-2 border-warning-300 text-warning-300 font-semibold' : 'hover:text-white'}`}
        >
          ⭐ Yêu thích
        </button>
        <button
          onClick={() => onTabChange('all')}
          className={`flex-1 py-2 text-center ${activeTab === 'all' ? 'border-b-2 border-primary-500 text-primary-500 font-semibold' : 'hover:text-white'}`}
        >
          Tất cả
        </button>
      </div>

      {/* Symbol List */}
      <div>
        {listToRender.map((item) => {
          const base = item.symbol.replace(/USDT$/, '');
          const isActive = item.symbol === selectedSymbol;
          const isFav = favoriteSymbols.includes(item.symbol);

          return (
            <div
              key={item.symbol}
              className={`flex items-center px-3 py-2 cursor-pointer hover:bg-dark-700 ${isActive ? 'bg-dark-700' : ''}`}
              onClick={() => onSelect(item.symbol)}
            >
              {coinIcons[base] ? (
                <img src={coinIcons[base]} alt={base} className="w-5 h-5 mr-2" />
              ) : (
                <div className="w-5 h-5 mr-2 bg-warning-300 text-dark-800 text-xs flex items-center justify-center rounded-full font-bold">
                  {base[0]}
                </div>
              )}

              <div className="flex-1">
                <div className="font-semibold">{item.symbol}</div>
                <div className="text-xs text-dark-400">Vol: {item.volume.toLocaleString()}</div>
              </div>

              <div className="text-right pr-1">
                <div className="font-mono">{item.price.toFixed(2)}</div>
                <div className={`text-xs ${item.percentChange >= 0 ? 'text-success-500' : 'text-danger-500'}`}>
                  {item.percentChange >= 0 ? '+' : ''}{item.percentChange.toFixed(2)}%
                </div>
              </div>

              <Star
                className={`h-4 w-4 ml-2 ${isFav ? 'text-warning-300' : 'text-dark-400'}`}
                fill={isFav ? 'currentColor' : 'none'}
                onClick={(e) => {
                  e.stopPropagation();
                  setFavoriteSymbols(prev =>
                    prev.includes(item.symbol)
                      ? prev.filter(s => s !== item.symbol)
                      : [...prev, item.symbol]
                  );
                  onToggleFavorite(item.symbol);
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SymbolDropdown;