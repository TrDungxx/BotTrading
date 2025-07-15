import React, { useState, useEffect } from 'react';
import { ArrowDown, ArrowUp, Calendar, ChevronDown, Clock, DollarSign, BarChart, RefreshCw, Share2 } from 'lucide-react';
import { FormattedMessage, FormattedNumber } from 'react-intl';
import TradingViewChart from '../TradingViewChart';
import TradingForm from '../components/common/TradingForm';
import TradingViewWidget from '../components/common/TradingViewWidget';
import RealTimeChart from './RealTimeChart';
// Generate mock candlestick data
const generateCandlestickData = (days: number) => {
  const data = [];
  let date = new Date();
  date.setDate(date.getDate() - days);

  let price = 38000;

  for (let i = 0; i < days * 24; i++) {
    const open = price + (Math.random() - 0.5) * 200;
    const high = open + Math.random() * 100;
    const low = open - Math.random() * 100;
    const close = (high + low) / 2;

    date.setHours(date.getHours() + 1);

    data.push({
      time: Math.floor(date.getTime() / 1000),
      open,
      high,
      low,
      close,
    });

    price = close;
  }

  return data;
};

// Mock data for the orderbook
const generateOrderbook = () => {
  const asks = [];
  const bids = [];

  let askPrice = 38500;
  let bidPrice = 38450;

  for (let i = 0; i < 10; i++) {
    askPrice += Math.random() * 15 + 5;
    bidPrice -= Math.random() * 15 + 5;

    asks.push({
      price: askPrice,
      amount: Math.random() * 2 + 0.1,
      total: Math.random() * 100000 + 10000,
    });

    bids.push({
      price: bidPrice,
      amount: Math.random() * 2 + 0.1,
      total: Math.random() * 100000 + 10000,
    });
  }

  return { asks, bids };
};

const { asks, bids } = generateOrderbook();

// Mock data for recent trades
const recentTrades = [
  { id: 1, price: 38456.78, amount: 0.12, time: '14:32:45', type: 'buy' },
  { id: 2, price: 38450.23, amount: 0.05, time: '14:32:30', type: 'sell' },
  { id: 3, price: 38455.12, amount: 0.08, time: '14:32:15', type: 'buy' },
  { id: 4, price: 38449.87, amount: 0.15, time: '14:32:00', type: 'sell' },
  { id: 5, price: 38452.34, amount: 0.03, time: '14:31:45', type: 'buy' },
  { id: 6, price: 38447.92, amount: 0.22, time: '14:31:30', type: 'sell' },
  { id: 7, price: 38451.67, amount: 0.11, time: '14:31:15', type: 'buy' },
];

// Mock data for open orders
const openOrders = [
  {
    id: 1,
    pair: 'BTC/USDT',
    type: 'limit',
    side: 'buy',
    price: 37500.00,
    amount: 0.1,
    filled: 0,
    total: 3750.00,
    status: 'open',
    date: '2023-03-15 14:22:45',
  },
  {
    id: 2,
    pair: 'ETH/USDT',
    type: 'limit',
    side: 'sell',
    price: 2400.00,
    amount: 2,
    filled: 0,
    total: 4800.00,
    status: 'open',
    date: '2023-03-15 13:45:12',
  },
];

export default function TradingTerminal() {
  const [activeTab, setActiveTab] = useState<'limit' | 'market' | 'stop'>('limit');
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy');
  const [price, setPrice] = useState('38452.12');
  const [amount, setAmount] = useState('');
  const [total, setTotal] = useState('');

  // Calculate total based on price and amount
  const calculateTotal = (price: string, amount: string) => {
    if (price && amount) {
      const calculatedTotal = parseFloat(price) * parseFloat(amount);
      return calculatedTotal.toFixed(2);
    }
    return '';
  };

  // Handle amount change
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAmount = e.target.value;
    setAmount(newAmount);
    setTotal(calculateTotal(price, newAmount));
  };

  // Handle price change
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPrice = e.target.value;
    setPrice(newPrice);
    setTotal(calculateTotal(newPrice, amount));
  };

  // Handle total change
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
  <div className="h-screen overflow-hidden">
    <div className="grid grid-cols-9 gap-4 h-full min-h-0 p-4">

      {/* Chart (chiếm 6 cột) */}
      <div className="col-span-6 card flex flex-col h-full overflow-hidden min-h-0">
        <div className="border-b border-dark-700 p-3 flex justify-between items-center">
          <div className="flex space-x-4">
            <button className="flex items-center text-sm text-dark-400 hover:text-dark-300">
              <Calendar className="h-4 w-4 mr-1" /> 1D
            </button>
            <button className="flex items-center text-sm text-primary-500 border-b-2 border-primary-500 pb-1">
              <Clock className="h-4 w-4 mr-1" /> 4H
            </button>
            <button className="flex items-center text-sm text-dark-400 hover:text-dark-300">
              <Clock className="h-4 w-4 mr-1" /> 1H
            </button>
            <button className="flex items-center text-sm text-dark-400 hover:text-dark-300">
              <Clock className="h-4 w-4 mr-1" /> 15m
            </button>
          </div>
          <div className="flex space-x-2">
            <button className="text-dark-400 hover:text-dark-300 p-1">
              <BarChart className="h-4 w-4" />
            </button>
            <button className="text-dark-400 hover:text-dark-300 p-1">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 relative z-0 overflow-hidden bg-dark-800 rounded min-h-0">
          <TradingViewWidget />
        </div>
      </div>

      {/* Trading Sidebar - col-span-3 bên phải */}
<div className="col-span-3 flex flex-col gap-4 h-full min-h-0 overflow-hidden">
  
  {/* Market Header */}
  <div className="card p-4">
    <div className="flex items-center justify-between">
      {/* Left - Icon + Symbol */}
      <div className="flex items-center">
        <div className="h-8 w-8 rounded-full bg-dark-700 flex items-center justify-center mr-2">
          <span className="text-xs font-medium">B</span>
        </div>
        <div>
          <div className="flex items-center">
            <span className="font-medium">BTC/USDT</span>
            <ChevronDown className="h-4 w-4 ml-1 text-dark-400" />
          </div>
          <div className="text-xs text-dark-400">Bitcoin</div>
        </div>
      </div>

      {/* Right - Price */}
      <div className="text-right">
        <div className="font-medium">
          <FormattedNumber value={38452.12} style="currency" currency="USD" />
        </div>
        <div className="flex items-center justify-end text-xs text-success-500">
          <ArrowUp className="h-3 w-3 mr-0.5" />
          <FormattedNumber value={0.0234} style="percent" minimumFractionDigits={2} />
        </div>
      </div>
    </div>
  </div>

  {/* Trading Form Tay (Limit / Market / Stop) */}
  <div className="card flex-1 flex flex-col overflow-hidden min-h-0">
    <TradingForm />
  </div>
</div>


      {/* Bottom Row: Orderbook + Recent Trades + Open Orders (3 cột đều nhau) */}
      <div className="col-span-9 grid grid-cols-9 gap-4">
        {/* Orderbook */}
        <div className="col-span-3 card flex flex-col overflow-hidden min-h-0">
          <div className="card-header py-3 flex justify-between items-center">
            <h2 className="text-sm font-medium"><FormattedMessage id="terminal.orderbook" /></h2>
            <button className="text-dark-400 hover:text-dark-300">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 px-4 py-2 min-h-0">
            {/* Asks */}
            <div className="space-y-1 mb-4">
              {asks.map((ask, index) => (
                <div key={`ask-${index}`} className="relative flex text-xs h-5">
                  <div className="absolute right-0 top-0 h-full bg-danger-500/10" style={{ width: `${(ask.total / 200000) * 100}%` }} />
                  <div className="w-1/3 text-danger-500 z-10">
                    <FormattedNumber value={ask.price} minimumFractionDigits={2} />
                  </div>
                  <div className="w-1/3 text-right z-10">
                    <FormattedNumber value={ask.amount} minimumFractionDigits={4} />
                  </div>
                  <div className="w-1/3 text-right text-dark-400 z-10">
                    <FormattedNumber value={ask.total / 1000} />K
                  </div>
                </div>
              ))}
            </div>

            {/* Price Line */}
            <div className="flex justify-between items-center py-2 border-y border-dark-700">
              <span className="text-sm font-medium">
                <FormattedNumber value={38452.12} style="currency" currency="USD" />
              </span>
              <span className="text-xs text-dark-400">
                <FormattedNumber value={38452.12} style="currency" currency="USD" />
              </span>
            </div>

            {/* Bids */}
            <div className="space-y-1 mt-4">
              {bids.map((bid, index) => (
                <div key={`bid-${index}`} className="relative flex text-xs h-5">
                  <div className="absolute right-0 top-0 h-full bg-success-500/10" style={{ width: `${(bid.total / 200000) * 100}%` }} />
                  <div className="w-1/3 text-success-500 z-10">
                    <FormattedNumber value={bid.price} minimumFractionDigits={2} />
                  </div>
                  <div className="w-1/3 text-right z-10">
                    <FormattedNumber value={bid.amount} minimumFractionDigits={4} />
                  </div>
                  <div className="w-1/3 text-right text-dark-400 z-10">
                    <FormattedNumber value={bid.total / 1000} />K
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Trades */}
        <div className="col-span-3 card flex flex-col overflow-hidden min-h-0">
          <div className="card-header py-3">
            <h2 className="text-sm font-medium"><FormattedMessage id="terminal.recentTrades" /></h2>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0">
            <table className="min-w-full divide-y divide-dark-700">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-dark-400"><FormattedMessage id="common.price" /></th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-dark-400"><FormattedMessage id="common.amount" /></th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-dark-400"><FormattedMessage id="common.time" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {recentTrades.map((trade) => (
                  <tr key={trade.id}>
                    <td className={`px-4 py-2 text-xs ${trade.type === 'buy' ? 'text-success-500' : 'text-danger-500'}`}>
                      <FormattedNumber value={trade.price} minimumFractionDigits={2} />
                    </td>
                    <td className="px-4 py-2 text-xs text-right">
                      <FormattedNumber value={trade.amount} minimumFractionDigits={4} />
                    </td>
                    <td className="px-4 py-2 text-xs text-right text-dark-400">{trade.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Open Orders */}
        <div className="col-span-3 card flex flex-col overflow-hidden min-h-0">
          <div className="card-header py-3 flex justify-between items-center">
            <h2 className="text-sm font-medium"><FormattedMessage id="terminal.openOrders" /></h2>
            {openOrders.length > 0 && (
              <button className="text-xs text-danger-500 hover:text-danger-400">
                <FormattedMessage id="terminal.cancelAll" />
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1 min-h-0">
            {openOrders.length > 0 ? (
              <table className="min-w-full divide-y divide-dark-700">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-dark-400"><FormattedMessage id="common.pair" /></th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-dark-400"><FormattedMessage id="common.price" /></th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-dark-400"><FormattedMessage id="common.amount" /></th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-dark-400"><FormattedMessage id="common.action" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {openOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 py-2 text-xs">
                        <div>
                          <div className={order.side === 'buy' ? 'text-success-500' : 'text-danger-500'}>
                            <FormattedMessage id={`common.${order.side}`} />
                          </div>
                          <div className="text-dark-400">{order.pair}</div>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-xs text-right">
                        <FormattedNumber value={order.price} minimumFractionDigits={2} />
                      </td>
                      <td className="px-4 py-2 text-xs text-right">
                        <FormattedNumber value={order.amount} minimumFractionDigits={order.amount < 1 ? 4 : 2} />
                        <div className="text-dark-400">
                          <FormattedNumber value={order.total} style="currency" currency="USD" />
                        </div>
                      </td>
                      <td className="px-4 py-2 text-xs text-right">
                        <button className="text-danger-500 hover:text-danger-400">
                          <FormattedMessage id="terminal.cancel" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <DollarSign className="h-8 w-8 text-dark-600 mb-2" />
                <p className="text-sm text-dark-400"><FormattedMessage id="terminal.noOrders" /></p>
                <p className="text-xs text-dark-500 mt-1"><FormattedMessage id="terminal.ordersWillAppear" /></p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
);



}