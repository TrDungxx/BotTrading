import { ArrowDown, ArrowUp, MoreVertical } from 'lucide-react';

// Mock data for active bots
const activeBots = [
  {
    id: 1,
    name: 'BTC Scalper',
    type: 'DCA Bot',
    pair: 'BTC/USDT',
    profitToday: 35.24,
    profitTotal: 423.89,
    status: 'running',
  },
  {
    id: 2,
    name: 'ETH Swing',
    type: 'Grid Bot',
    pair: 'ETH/USDT',
    profitToday: -12.56,
    profitTotal: 187.42,
    status: 'running',
  },
  {
    id: 3,
    name: 'SOL Breakout',
    type: 'SMART Trade',
    pair: 'SOL/USDT',
    profitToday: 8.74,
    profitTotal: 94.18,
    status: 'running',
  },
];

export default function ActiveBotsList() {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-dark-700">
        <thead>
          <tr>
            <th className="py-fluid-3.5 pl-4 pr-3 text-left text-xs font-medium text-dark-400 sm:pl-0">Bot</th>
            <th className="px-fluid-3 py-fluid-3.5 text-left text-xs font-medium text-dark-400">Pair</th>
            <th className="px-fluid-3 py-fluid-3.5 text-right text-xs font-medium text-dark-400">Today</th>
            <th className="px-fluid-3 py-fluid-3.5 text-right text-xs font-medium text-dark-400">Total</th>
            <th className="px-fluid-3 py-fluid-3.5 text-center text-xs font-medium text-dark-400">Status</th>
            <th className="relative py-fluid-3.5 pl-3 pr-4 sm:pr-0">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dark-700">
          {activeBots.map((bot) => (
            <tr key={bot.id} className="hover:bg-dark-700/40">
              <td className="whitespace-nowrap py-fluid-4 pl-4 pr-3 text-fluid-sm sm:pl-0">
                <div className="flex items-center">
                  <div className="h-fluid-input-sm w-8 flex-shrink-0 rounded-fluid-md bg-primary-500/10 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary-500">{bot.type.substring(0, 1)}</span>
                  </div>
                  <div className="ml-3">
                    <div className="font-medium">{bot.name}</div>
                    <div className="text-xs text-dark-400">{bot.type}</div>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-fluid-3 py-fluid-4 text-fluid-sm">{bot.pair}</td>
              <td className="whitespace-nowrap px-fluid-3 py-fluid-4 text-fluid-sm text-right">
                <span className={`flex items-center justify-end ${bot.profitToday >= 0 ? 'text-success-500' : 'text-danger-500'}`}>
                  {bot.profitToday >= 0 ? <ArrowUp className="mr-1 h-3 w-3" /> : <ArrowDown className="mr-1 h-3 w-3" />}
                  ${Math.abs(bot.profitToday).toFixed(2)}
                </span>
              </td>
              <td className="whitespace-nowrap px-fluid-3 py-fluid-4 text-fluid-sm text-right">
                <span className={bot.profitTotal >= 0 ? 'text-success-500' : 'text-danger-500'}>
                  ${bot.profitTotal.toFixed(2)}
                </span>
              </td>
              <td className="whitespace-nowrap px-fluid-3 py-fluid-4 text-fluid-sm text-center">
                <span className="inline-flex items-center rounded-full bg-success-500/10 px-2.5 py-0.5 text-xs font-medium text-success-500">
                  {bot.status}
                </span>
              </td>
              <td className="relative whitespace-nowrap py-fluid-4 pl-3 pr-4 text-right text-fluid-sm sm:pr-0">
                <button className="text-dark-400 hover:text-dark-300">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}