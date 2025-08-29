import React from 'react';

const MainDCA: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Name */}
      <div>
        <label className="block text-xs text-dark-200 mb-1">Name</label>
        <input className="form-input w-full" placeholder="e.g., BTC/USDT Long" />
      </div>

      {/* Exchange */}
      <div>
        <label className="block text-xs text-dark-200 mb-1">Exchange</label>
        <button className="form-input w-full flex items-center justify-between min-w-0">
          <div className="flex items-center gap-2 truncate">
            <div className="size-6 rounded-full bg-dark-700 grid place-content-center text-[10px]">★</div>
            <span className="truncate">Select exchange…</span>
          </div>
          <span className="text-dark-300">$0.00</span>
        </button>
      </div>

      {/* Direction */}
      <div>
        <div className="text-xs text-dark-200 mb-2">Direction</div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-toggle active">Long</button>
          <button className="btn btn-toggle">Short</button>
        </div>
      </div>

      {/* Bot type */}
      <div>
        <div className="text-xs text-dark-200 mb-2">Bot type</div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-toggle active">Single-pair</button>
          <button className="btn btn-toggle">Multi-pair</button>
        </div>
      </div>

      {/* Pair */}
      <div>
        <label className="block text-xs text-dark-200 mb-1">Pair</label>
        <button className="form-input w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-dark-700" />
            <span className="font-medium">Select</span>
            <span className="text-dark-300">/Symbol</span>
          </div>
          <span className="text-dark-300">0 BASE</span>
        </button>
      </div>

      {/* Profit currency */}
      <div>
        <div className="text-xs text-dark-200 mb-2">Profit currency</div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-toggle active">Quote</button>
          <button className="btn btn-toggle">Base</button>
        </div>
      </div>

      {/* Market data insight */}
      <div className="md:col-span-2">
        <button className="text-primary text-sm underline underline-offset-4">Market data insight</button>
      </div>
    </div>
  );
};

export default MainDCA;
