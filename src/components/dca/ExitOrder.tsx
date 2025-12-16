import React from 'react';

const ExitOrder: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Take profit */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="font-medium text-fluid-sm">Take profit</p>
          <button className="btn btn-xs">Video tutorial</button>
        </div>

        <div className="grid grid-cols-1 gap-fluid-3">
          <div className="flex gap-fluid-2">
            <button className="btn btn-toggle active flex-1 justify-center">Price change, %</button>
            <button className="btn btn-toggle flex-1 justify-center">Conditions</button>
          </div>

          <div>
            <label className="block text-xs text-dark-200 mb-1">Take profit type</label>
            <button className="form-input w-full text-left">Percentage from average price</button>
          </div>

          <div>
            <div className="text-xs text-dark-200 mb-1">Single target</div>
            <div className="flex gap-fluid-2">
              <input className="form-input w-full" placeholder="Target profit" />
              <div className="btn btn-toggle">%</div>
            </div>
          </div>

          <button className="btn btn-sm">+ Add additional target profit step</button>

          <div className="flex items-center gap-fluid-3">
            <span className="text-fluid-sm">Trailing</span>
            <button className="btn btn-toggle">Off</button>
            <div className="flex-1" />
            <div className="flex gap-fluid-2 items-center">
              <input className="form-input w-24" placeholder="0.2" disabled />
              <div className="btn btn-toggle">%</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-fluid-4">
            <div>
              <label className="block text-xs text-dark-200 mb-1">Reinvest Profit</label>
              <div className="flex gap-fluid-2">
                <input className="form-input w-full" placeholder="100" />
                <div className="btn btn-toggle">%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stop Loss */}
      <div className="gap-fluid-2">
        <div className="flex items-center gap-fluid-3">
          <span className="text-fluid-sm font-medium">Stop Loss</span>
          <div className="ml-auto"><button className="btn btn-toggle">Off</button></div>
        </div>
      </div>

      {/* Maximum hold period */}
      <div className="gap-fluid-2">
        <div className="flex items-center gap-fluid-3">
          <span className="text-fluid-sm font-medium">Maximum hold period</span>
          <div className="ml-auto"><button className="btn btn-toggle">Off</button></div>
        </div>
      </div>
    </div>
  );
};

export default ExitOrder;
