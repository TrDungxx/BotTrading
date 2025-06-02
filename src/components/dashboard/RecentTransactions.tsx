import { ArrowDown, ArrowUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Mock data for recent transactions
const transactions = [
  {
    id: 1,
    type: 'buy',
    pair: 'BTC/USDT',
    amount: 0.05,
    price: 38452.12,
    total: 1922.61,
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    botName: 'BTC Scalper',
  },
  {
    id: 2,
    type: 'sell',
    pair: 'ETH/USDT',
    amount: 0.8,
    price: 2345.78,
    total: 1876.62,
    timestamp: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
    botName: 'ETH Swing',
  },
  {
    id: 3,
    type: 'buy',
    pair: 'SOL/USDT',
    amount: 12,
    price: 78.45,
    total: 941.4,
    timestamp: new Date(Date.now() - 1000 * 60 * 180), // 3 hours ago
    botName: 'SOL Breakout',
  },
  {
    id: 4,
    type: 'sell',
    pair: 'BTC/USDT',
    amount: 0.03,
    price: 38576.34,
    total: 1157.29,
    timestamp: new Date(Date.now() - 1000 * 60 * 240), // 4 hours ago
    botName: 'BTC Scalper',
  },
];

export default function RecentTransactions() {
  return (
    <div className="space-y-4">
      {transactions.map((transaction) => (
        <div key={transaction.id} className="flex items-center justify-between border-b border-dark-700 pb-4 last:border-0">
          <div className="flex items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                transaction.type === 'buy' ? 'bg-success-500/10' : 'bg-danger-500/10'
              }`}
            >
              {transaction.type === 'buy' ? (
                <ArrowDown className="h-4 w-4 text-success-500" />
              ) : (
                <ArrowUp className="h-4 w-4 text-danger-500" />
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">
                {transaction.type === 'buy' ? 'Buy' : 'Sell'} {transaction.pair}
              </p>
              <p className="text-xs text-dark-400">{formatDistanceToNow(transaction.timestamp, { addSuffix: true })}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">${transaction.total.toFixed(2)}</p>
            <p className="text-xs text-dark-400">
              via {transaction.botName}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}