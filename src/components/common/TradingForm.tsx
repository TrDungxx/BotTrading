import React, { useState } from 'react';
import { FormattedMessage, FormattedNumber } from 'react-intl';

export default function TradingForm() {
  const [activeTab, setActiveTab] = useState<'limit' | 'market' | 'stop'>('limit');
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy');
  const [price, setPrice] = useState('38452.12');
  const [amount, setAmount] = useState('');
  const [total, setTotal] = useState('');

  const calculateTotal = (price: string, amount: string) => {
    if (price && amount) {
      const calculatedTotal = parseFloat(price) * parseFloat(amount);
      return calculatedTotal.toFixed(2);
    }
    return '';
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAmount = e.target.value;
    setAmount(newAmount);
    setTotal(calculateTotal(price, newAmount));
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPrice = e.target.value;
    setPrice(newPrice);
    setTotal(calculateTotal(newPrice, amount));
  };

  const handleTotalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTotal = e.target.value;
    setTotal(newTotal);
    if (newTotal && price && parseFloat(price) !== 0) {
      const calculatedAmount = (parseFloat(newTotal) / parseFloat(price)).toFixed(8);
      setAmount(calculatedAmount);
    } else {
      setAmount('');
    }
  };

  return (
    <div className="relative z-10 bg-dark-800 rounded-lg border border-dark-700 shadow-md p-4 space-y-4">
      {/* Tabs: Limit / Market / Stop */}
      <div className="flex border-b border-dark-700">
        {['limit', 'market', 'stop'].map((tab) => (
          <button
            key={tab}
            className={`w-1/3 py-3 text-center text-sm font-medium capitalize ${
              activeTab === tab
                ? 'border-b-2 border-primary-500 text-primary-500'
                : 'text-dark-400 hover:text-dark-300'
            }`}
            onClick={() => setActiveTab(tab as 'limit' | 'market' | 'stop')}
          >
            <FormattedMessage id={`terminal.${tab}`} />
          </button>
        ))}
      </div>

      {/* Buy / Sell buttons */}
      <div className="flex space-x-2">
        <button
          className={`w-1/2 py-2 rounded-md text-sm font-medium ${
            tradeSide === 'buy'
              ? 'bg-success-500 text-white'
              : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
          }`}
          onClick={() => setTradeSide('buy')}
        >
          <FormattedMessage id="common.buy" />
        </button>
        <button
          className={`w-1/2 py-2 rounded-md text-sm font-medium ${
            tradeSide === 'sell'
              ? 'bg-danger-500 text-white'
              : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
          }`}
          onClick={() => setTradeSide('sell')}
        >
          <FormattedMessage id="common.sell" />
        </button>
      </div>

      {/* Input fields */}
      {activeTab !== 'market' && (
        <div>
          <label htmlFor="price" className="form-label">
            <FormattedMessage id="common.price" />
          </label>
          <div className="relative">
            <input
              type="text"
              id="price"
              className="form-input pr-16"
              placeholder="0.00"
              value={price}
              onChange={handlePriceChange}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <span className="text-dark-400 text-sm">USDT</span>
            </div>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="amount" className="form-label">
          <FormattedMessage id="common.amount" />
        </label>
        <div className="relative">
          <input
            type="text"
            id="amount"
            className="form-input pr-16"
            placeholder="0.00000000"
            value={amount}
            onChange={handleAmountChange}
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <span className="text-dark-400 text-sm">BTC</span>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="total" className="form-label">
          <FormattedMessage id="common.total" />
        </label>
        <div className="relative">
          <input
            type="text"
            id="total"
            className="form-input pr-16"
            placeholder="0.00"
            value={total}
            onChange={handleTotalChange}
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <span className="text-dark-400 text-sm">USDT</span>
          </div>
        </div>
      </div>

      {/* % buttons */}
      <div className="grid grid-cols-4 gap-2">
        {[25, 50, 75, 100].map((percent) => (
          <button
            key={percent}
            className="py-1 text-xs bg-dark-700 rounded text-dark-300 hover:bg-dark-600"
          >
            {percent}%
          </button>
        ))}
      </div>

      {/* Submit */}
      <button
        className={`w-full py-3 rounded-md font-medium whitespace-normal break-words ${
          tradeSide === 'buy'
            ? 'bg-success-500 hover:bg-success-600 text-white'
            : 'bg-danger-500 hover:bg-danger-600 text-white'
        }`}
      >
        {tradeSide === 'buy' ? (
          <FormattedMessage id="terminal.buyAmount" values={{ symbol: 'BTC' }} />
        ) : (
          <FormattedMessage id="terminal.sellAmount" values={{ symbol: 'BTC' }} />
        )}
      </button>

      {/* Available funds */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="flex justify-between">
          <span className="text-dark-400">
            <FormattedMessage id="terminal.available" />:
          </span>
          <span>
            <FormattedNumber value={12500} minimumFractionDigits={2} /> USDT
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-dark-400">
            <FormattedMessage id="terminal.available" />:
          </span>
          <span>0.4892 BTC</span>
        </div>
      </div>
    </div>
  );
}
