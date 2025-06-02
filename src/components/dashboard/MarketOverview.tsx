import { ArrowDown, ArrowUp, Star } from 'lucide-react';

// Mock data for market overview
const marketData = [
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    symbol: 'BTC',
    price: 38452.12,
    change24h: 2.34,
    volume24h: 28765432123,
    marketCap: 747582145698,
    favorite: true,
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    price: 2345.78,
    change24h: -1.24,
    volume24h: 15432765987,
    marketCap: 276598432178,
    favorite: true,
  },
  {
    id: 'solana',
    name: 'Solana',
    symbol: 'SOL',
    price: 78.45,
    change24h: 5.67,
    volume24h: 5432178965,
    marketCap: 32178945612,
    favorite: true,
  },
  {
    id: 'cardano',
    name: 'Cardano',
    symbol: 'ADA',
    price: 0.65,
    change24h: -0.87,
    volume24h: 1234567890,
    marketCap: 21345678901,
    favorite: false,
  },
  {
    id: 'ripple',
    name: 'Ripple',
    symbol: 'XRP',
    price: 0.54,
    change24h: 1.23,
    volume24h: 2345678901,
    marketCap: 25678901234,
    favorite: false,
  },
];

export default function MarketOverview() {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-dark-700">
        <thead>
          <tr>
            <th className="py-3.5 pl-4 pr-3 text-left text-xs font-medium text-dark-400 sm:pl-0">Name</th>
            <th className="px-3 py-3.5 text-right text-xs font-medium text-dark-400">Price</th>
            <th className="px-3 py-3.5 text-right text-xs font-medium text-dark-400">24h Change</th>
            <th className="px-3 py-3.5 text-right text-xs font-medium text-dark-400 hidden md:table-cell">24h Volume</th>
            <th className="px-3 py-3.5 text-right text-xs font-medium text-dark-400 hidden lg:table-cell">Market Cap</th>
            <th className="relative py-3.5 pl-3 pr-4 sm:pr-0">
              <span className="sr-only">Favorite</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dark-700">
          {marketData.map((coin) => (
            <tr key={coin.id} className="hover:bg-dark-700/40 cursor-pointer">
              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-0">
                <div className="flex items-center">
                  <div className="h-8 w-8 flex-shrink-0 rounded-full bg-dark-700 flex items-center justify-center">
                    <span className="text-xs font-medium">{coin.symbol.substring(0, 1)}</span>
                  </div>
                  <div className="ml-3">
                    <div className="font-medium">{coin.name}</div>
                    <div className="text-xs text-dark-400">{coin.symbol}</div>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-right font-medium">
                ${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                <span
                  className={`inline-flex items-center ${
                    coin.change24h >= 0 ? 'text-success-500' : 'text-danger-500'
                  }`}
                >
                  {coin.change24h >= 0 ? (
                    <ArrowUp className="mr-1 h-3 w-3" />
                  ) : (
                    <ArrowDown className="mr-1 h-3 w-3" />
                  )}
                  {Math.abs(coin.change24h).toFixed(2)}%
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-right hidden md:table-cell">
                ${(coin.volume24h / 1000000).toFixed(2)}M
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-right hidden lg:table-cell">
                ${(coin.marketCap / 1000000000).toFixed(2)}B
              </td>
              <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm sm:pr-0">
                <button
                  className={`text-dark-400 hover:text-warning-300 ${
                    coin.favorite ? 'text-warning-300' : ''
                  }`}
                >
                  <Star className="h-4 w-4" fill={coin.favorite ? 'currentColor' : 'none'} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}