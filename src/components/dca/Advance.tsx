import React from 'react';

const Advance: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-fluid-4">
        <div>
          <label className="block text-xs text-dark-200 mb-1">Minimum daily volume</label>
          <div className="flex gap-fluid-2">
            <input className="form-input w-full" />
            <div className="btn btn-toggle">BASE</div>
          </div>
        </div>
        <div>
          <label className="block text-xs text-dark-200 mb-1">Minimum price to open trade</label>
          <div className="flex gap-fluid-2">
            <input className="form-input w-full" />
            <div className="btn btn-toggle">QUOTE</div>
          </div>
        </div>

        <div>
          <label className="block text-xs text-dark-200 mb-1">Cooldown between trades</label>
          <div className="flex gap-fluid-2">
            <input className="form-input w-full" />
            <div className="btn btn-toggle">Sec</div>
          </div>
        </div>
        <div>
          <label className="block text-xs text-dark-200 mb-1">Maximum price to open trade</label>
          <div className="flex gap-fluid-2">
            <input className="form-input w-full" />
            <div className="btn btn-toggle">QUOTE</div>
          </div>
        </div>

        <div>
          <label className="block text-xs text-dark-200 mb-1">Maximum trade iterations</label>
          <input className="form-input w-full" />
        </div>
        <div className="flex items-end justify-between gap-fluid-2">
          <div>
            <label className="block text-xs text-dark-200 mb-1">Autoconvert new DCA trades to SmartTrade</label>
          </div>
          <button className="btn btn-toggle">Off</button>
        </div>
      </div>
    </div>
  );
};

export default Advance;
