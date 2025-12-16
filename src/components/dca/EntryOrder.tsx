import React from 'react';

const EntryOrder: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Base order */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="font-medium text-fluid-sm">Base order</p>
          <button className="btn btn-xs">Video tutorial</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-fluid-4">
          <div>
            <label className="block text-xs text-dark-200 mb-1">Base order size</label>
            <div className="flex gap-fluid-2">
              <input className="form-input w-full" />
              <button className="btn btn-toggle">USDT</button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-dark-200 mb-1">Start order type</label>
            <div className="flex gap-fluid-2">
              <button className="btn btn-toggle active">Market</button>
              <button className="btn btn-toggle">Limit</button>
            </div>
          </div>
        </div>
      </div>

      {/* Trade start condition */}
      <div className="gap-fluid-2">
        <div className="flex items-center gap-fluid-3">
          <span className="font-medium text-fluid-sm">Trade start condition</span>
          <div className="ml-auto">
            <button className="btn btn-toggle active">On</button>
          </div>
        </div>
        <div>
          <label className="block text-xs text-dark-200 mb-1">Condition</label>
          <button className="form-input w-full text-left">Select condition…</button>
        </div>
        <button className="text-primary text-fluid-sm underline underline-offset-4">Technical Analysis start conditions</button>
      </div>

      {/* Averaging order */}
      <div className="space-y-4">
        <div className="flex items-center gap-fluid-3">
          <span className="font-medium text-fluid-sm">Averaging order</span>
          <div className="ml-auto"><button className="btn btn-toggle active">On</button></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-fluid-4">
          <div>
            <label className="block text-xs text-dark-200 mb-1">Averaging order size</label>
            <div className="flex gap-fluid-2">
              <input className="form-input w-full" />
              <button className="btn btn-toggle">USDT</button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-dark-200 mb-1">Price deviation to open averaging orders</label>
            <div className="flex gap-fluid-2">
              <input className="form-input w-full" />
              <div className="btn btn-toggle">%</div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-dark-200 mb-1">Max averaging orders per trade</label>
            <input className="form-input w-full" />
          </div>
          <div>
            <label className="block text-xs text-dark-200 mb-1">Max averaging orders placed on exchange</label>
            <input className="form-input w-full" />
          </div>

          <div>
            <label className="block text-xs text-dark-200 mb-1">Averaging order size multiplier</label>
            <input className="form-input w-full" />
          </div>
          <div>
            <label className="block text-xs text-dark-200 mb-1">Averaging order step multiplier</label>
            <input className="form-input w-full" />
          </div>
        </div>

        <div className="gap-fluid-2">
          <div className="flex items-center gap-fluid-3">
            <span className="font-medium text-fluid-sm">Averaging orders condition</span>
            <div className="ml-auto"><button className="btn btn-toggle">Off</button></div>
          </div>
          <p className="text-dark-300 text-xs">For example: RSI, QFL, MACD, TradingView custom signals…</p>
        </div>
      </div>
    </div>
  );
};

export default EntryOrder;
