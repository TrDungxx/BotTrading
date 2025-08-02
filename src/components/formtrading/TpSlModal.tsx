import React, { useState } from 'react';
import { X } from 'lucide-react';

interface TpSlModalProps {
  isOpen: boolean;
  onClose: () => void;
  tradeSide: 'buy' | 'sell';
  setTradeSide: (side: 'buy' | 'sell') => void;
  quantity: number;
  symbol: string;
  market: 'futures' | 'spot';
  positionSide: 'LONG' | 'SHORT';
  currentPrice?: number;
  onSubmit: (orders: any[]) => void;
}

const TpSlModal: React.FC<TpSlModalProps> = ({
  isOpen,
  onClose,
  tradeSide,
  setTradeSide,
  quantity,
  symbol,
  market,
  positionSide,
  currentPrice,
  onSubmit
}) => {
  if (!isOpen) return null;

  const [takeProfitEnabled, setTakeProfitEnabled] = useState(true);
  const [stopLossEnabled, setStopLossEnabled] = useState(true);

  const [tpTriggerPrice, setTpTriggerPrice] = useState('');
  const [tpMarketPrice, setTpMarketPrice] = useState('');
  const [tpMarketEditable, setTpMarketEditable] = useState(false);

  const [slTriggerPrice, setSlTriggerPrice] = useState('');
  const [slMarketPrice, setSlMarketPrice] = useState('');
  const [slMarketEditable, setSlMarketEditable] = useState(false);

  const handleSubmit = () => {
    const orders = [];

    if (takeProfitEnabled && tpTriggerPrice) {
      orders.push({
        action: 'placeOrder',
        type: 'TAKE_PROFIT_MARKET',
        stopPrice: parseFloat(tpTriggerPrice),
        quantity,
        symbol,
        market,
        positionSide,
        reduceOnly: true,
        triggerType: tpMarketEditable ? 'manual' : 'market-default'
      });
    }

    if (stopLossEnabled && slTriggerPrice) {
      orders.push({
        action: 'placeOrder',
        type: 'STOP_MARKET',
        stopPrice: parseFloat(slTriggerPrice),
        quantity,
        symbol,
        market,
        positionSide,
        reduceOnly: true,
        triggerType: tpMarketEditable ? 'manual' : 'market-default'
      });
    }
    console.log('[TP/SL Submit]', {
  takeProfitEnabled,
  tpTriggerPrice,
  tpMarketEditable,
  tpTriggerType: tpMarketEditable ? 'manual' : 'market-default',
  stopLossEnabled,
  slTriggerPrice,
  slMarketEditable,
  slTriggerType: slMarketEditable ? 'manual' : 'market-default',
  currentPrice,
  quantity,
  symbol,
  market,
  positionSide,
  orders,
});

    onSubmit(orders);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-dark-800 w-full max-w-md rounded-lg shadow-lg p-6 relative">
        {/* Close */}
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <h2 className="text-lg font-semibold mb-4">Chốt lời/Cắt lỗ</h2>

        {/* Tabs */}
        <div className="relative flex mb-4 rounded-md overflow-hidden border border-dark-600 w-fit">
          <div
            className={`absolute left-0 top-0 h-full w-1/2 rounded-md transition-all duration-300 pointer-events-none ${
              tradeSide === 'buy' ? 'bg-success-500' : 'translate-x-full bg-danger-500'
            }`}
            style={{ clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0% 100%)' }}
          ></div>
          <button
            onClick={() => setTradeSide('buy')}
            className={`relative z-10 px-4 py-1 text-sm font-medium ${
              tradeSide === 'buy' ? 'text-white' : 'text-slate-400'
            }`}
          >
            Mua/Long
          </button>
          <button
            onClick={() => setTradeSide('sell')}
            className={`relative z-10 px-4 py-1 text-sm font-medium ${
              tradeSide === 'sell' ? 'text-white' : 'text-slate-400'
            }`}
          >
            Bán/Short
          </button>
        </div>

        {/* TP */}
        <div className="space-y-2">
          <label className="flex items-center space-x-2 mb-1">
            <input type="checkbox" checked={takeProfitEnabled} onChange={() => setTakeProfitEnabled(!takeProfitEnabled)} />
            <span className="text-sm font-medium">Take Profit</span>
            <span className="ml-auto text-xs text-dark-400">Mark</span>
          </label>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Giá kích hoạt"
              value={tpTriggerPrice}
              onChange={(e) => setTpTriggerPrice(e.target.value)}
              className="form-input w-full"
            />
            <select className="form-select text-sm w-[80px]">
              <option>PnL</option>
              <option>Mark</option>
              <option>Last</option>
            </select>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Giá thị trường"
              value={tpMarketPrice}
              onChange={(e) => setTpMarketPrice(e.target.value)}
              className={`form-input w-full ${tpMarketEditable ? '' : 'bg-dark-700 text-dark-500'}`}
              disabled={!tpMarketEditable}
            />
            <button
              className="btn btn-outline text-sm px-3"
              onClick={() => setTpMarketEditable(!tpMarketEditable)}
            >
              Thị trường
            </button>
          </div>
        </div>

        {/* SL */}
        <div className="space-y-2 mt-6">
          <label className="flex items-center space-x-2 mb-1">
            <input type="checkbox" checked={stopLossEnabled} onChange={() => setStopLossEnabled(!stopLossEnabled)} />
            <span className="text-sm font-medium">Stop Loss</span>
            <span className="ml-auto text-xs text-dark-400">Mark</span>
          </label>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Giá kích hoạt"
              value={slTriggerPrice}
              onChange={(e) => setSlTriggerPrice(e.target.value)}
              className="form-input w-full"
            />
            <select className="form-select text-sm w-[80px]">
              <option>PnL</option>
              <option>Mark</option>
              <option>Last</option>
            </select>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Giá thị trường"
              value={slMarketPrice}
              onChange={(e) => setSlMarketPrice(e.target.value)}
              className={`form-input w-full ${slMarketEditable ? '' : 'bg-dark-700 text-dark-500'}`}
              disabled={!slMarketEditable}
            />
            <button
              className="btn btn-outline text-sm px-3"
              onClick={() => setSlMarketEditable(!slMarketEditable)}
            >
              Thị trường
            </button>
          </div>
        </div>

        {/* Confirm */}
        <button className="btn btn-primary mt-6 w-full" onClick={handleSubmit}>
          Xác nhận
        </button>
      </div>
    </div>
  );
};

export default TpSlModal;
