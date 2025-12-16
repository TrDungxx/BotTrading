import React, { useState } from 'react';
import { ArrowDown, ArrowUp, BarChart3, ChevronDown, Clock, Filter, Search, Star, TrendingUp } from 'lucide-react';
import { FormattedMessage, FormattedNumber } from 'react-intl';

// Mock data for market overview
const marketData = [
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    symbol: 'BTC',
    price: 38452.12,
    change24h: 2.34,
    change7d: 5.67,
    volume24h: 28765432123,
    marketCap: 747582145698,
    favorite: true,
    signal: 'buy',
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    price: 2345.78,
    change24h: -1.24,
    change7d: 3.45,
    volume24h: 15432765987,
    marketCap: 276598432178,
    favorite: true,
    signal: 'neutral',
  },
  {
    id: 'solana',
    name: 'Solana',
    symbol: 'SOL',
    price: 78.45,
    change24h: 5.67,
    change7d: 12.34,
    volume24h: 5432178965,
    marketCap: 32178945612,
    favorite: true,
    signal: 'buy',
  },
  {
    id: 'cardano',
    name: 'Cardano',
    symbol: 'ADA',
    price: 0.65,
    change24h: -0.87,
    change7d: -2.34,
    volume24h: 1234567890,
    marketCap: 21345678901,
    favorite: false,
    signal: 'sell',
  },
  {
    id: 'ripple',
    name: 'Ripple',
    symbol: 'XRP',
    price: 0.54,
    change24h: 1.23,
    change7d: -0.98,
    volume24h: 2345678901,
    marketCap: 25678901234,
    favorite: false,
    signal: 'neutral',
  },
  {
    id: 'polkadot',
    name: 'Polkadot',
    symbol: 'DOT',
    price: 7.83,
    change24h: 3.45,
    change7d: 7.89,
    volume24h: 987654321,
    marketCap: 9876543210,
    favorite: false,
    signal: 'buy',
  },
  {
    id: 'dogecoin',
    name: 'Dogecoin',
    symbol: 'DOGE',
    price: 0.087,
    change24h: -2.34,
    change7d: -5.67,
    volume24h: 876543210,
    marketCap: 11987654321,
    favorite: false,
    signal: 'sell',
  },
  {
    id: 'litecoin',
    name: 'Litecoin',
    symbol: 'LTC',
    price: 78.34,
    change24h: 0.98,
    change7d: 2.34,
    volume24h: 765432109,
    marketCap: 5678901234,
    favorite: false,
    signal: 'neutral',
  },
];

// Mock data for market news
const marketNews = [
  {
    id: 1,
    title: 'Bitcoin Breaks $38,000 Resistance Level, Eyes $40,000 Next',
    source: 'CryptoNews',
    date: '1 hour ago',
    image: 'https://images.pexels.com/photos/844124/pexels-photo-844124.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
  {
    id: 2,
    title: 'Ethereum 2.0 Upgrade Set for Q3, Developers Confirm',
    source: 'BlockchainReport',
    date: '3 hours ago',
    image: 'https://images.pexels.com/photos/8370752/pexels-photo-8370752.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
  {
    id: 3,
    title: 'Solana Ecosystem Sees Record Growth Despite Market Volatility',
    source: 'CoinTelegraph',
    date: '5 hours ago',
    image: 'https://images.pexels.com/photos/6765370/pexels-photo-6765370.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
  {
    id: 4,
    title: 'Regulatory Concerns Grow as Countries Consider New Crypto Policies',
    source: 'CryptoInsider',
    date: '8 hours ago',
    image: 'https://images.pexels.com/photos/7788009/pexels-photo-7788009.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
];

// Market signals data
const marketSignals = [
  {
    id: 1,
    pair: 'BTC/USDT',
    timeframe: '4h',
    signal: 'buy',
    price: 38452.12,
    targetPrice: 40000,
    confidence: 'high',
    timestamp: '2 hours ago',
  },
  {
    id: 2,
    pair: 'SOL/USDT',
    timeframe: '1d',
    signal: 'buy',
    price: 78.45,
    targetPrice: 85.00,
    confidence: 'medium',
    timestamp: '4 hours ago',
  },
  {
    id: 3,
    pair: 'ADA/USDT',
    timeframe: '4h',
    signal: 'sell',
    price: 0.65,
    targetPrice: 0.60,
    confidence: 'medium',
    timestamp: '5 hours ago',
  },
  {
    id: 4,
    pair: 'DOGE/USDT',
    timeframe: '1h',
    signal: 'sell',
    price: 0.087,
    targetPrice: 0.082,
    confidence: 'high',
    timestamp: '1 hour ago',
  },
];

export default function MarketAnalysis() {
  const [activeTab, setActiveTab] = useState<'overview' | 'signals' | 'news'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredMarketData = marketData.filter((coin) => {
    return coin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           coin.symbol.toLowerCase().includes(searchQuery.toLowerCase());
  });
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-fluid-4">
        <div>
          <h1 className="text-2xl font-bold">
            <FormattedMessage id="market.title" />
          </h1>
          <p className="text-dark-400">
            <FormattedMessage id="market.subtitle" />
          </p>
        </div>
      </div>
      
      {/* Market overview stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-fluid-input-lg w-12 items-center justify-center rounded-fluid-md bg-primary-500/10">
                  <BarChart3 className="h-6 w-6 text-primary-500" />
                </div>
              </div>
              <div className="ml-4">
                <h2 className="text-fluid-sm font-medium text-dark-400">
                  <FormattedMessage id="market.globalCap" />
                </h2>
                <p className="text-2xl font-semibold">
                  <FormattedNumber
                    value={1.82e12}
                    style="currency"
                    currency="USD"
                    notation="compact"
                    maximumFractionDigits={2}
                  />
                </p>
                <div className="mt-1 flex items-center">
                  <span className="flex items-center text-xs font-medium text-success-500">
                    <ArrowUp className="mr-1 h-3 w-3" />
                    <FormattedNumber
                      value={0.028}
                      style="percent"
                      minimumFractionDigits={1}
                    />
                  </span>
                  <span className="ml-1.5 text-xs text-dark-400">
                    <FormattedMessage id="portfolio.last24h" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-fluid-input-lg w-12 items-center justify-center rounded-fluid-md bg-primary-500/10">
                  <Clock className="h-6 w-6 text-primary-500" />
                </div>
              </div>
              <div className="ml-4">
                <h2 className="text-fluid-sm font-medium text-dark-400">
                  <FormattedMessage id="market.volume" />
                </h2>
                <p className="text-2xl font-semibold">
                  <FormattedNumber
                    value={78.5e9}
                    style="currency"
                    currency="USD"
                    notation="compact"
                    maximumFractionDigits={1}
                  />
                </p>
                <div className="mt-1 flex items-center">
                  <span className="flex items-center text-xs font-medium text-success-500">
                    <ArrowUp className="mr-1 h-3 w-3" />
                    <FormattedNumber
                      value={0.053}
                      style="percent"
                      minimumFractionDigits={1}
                    />
                  </span>
                  <span className="ml-1.5 text-xs text-dark-400">vs yesterday</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-fluid-input-lg w-12 items-center justify-center rounded-fluid-md bg-success-500/10">
                  <TrendingUp className="h-6 w-6 text-success-500" />
                </div>
              </div>
              <div className="ml-4">
                <h2 className="text-fluid-sm font-medium text-dark-400">
                  <FormattedMessage id="market.dominance" />
                </h2>
                <p className="text-2xl font-semibold">
                  <FormattedNumber
                    value={0.412}
                    style="percent"
                    minimumFractionDigits={1}
                  />
                </p>
                <div className="mt-1 flex items-center">
                  <span className="flex items-center text-xs font-medium text-danger-500">
                    <ArrowDown className="mr-1 h-3 w-3" />
                    <FormattedNumber
                      value={0.008}
                      style="percent"
                      minimumFractionDigits={1}
                    />
                  </span>
                  <span className="ml-1.5 text-xs text-dark-400">7d change</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-fluid-input-lg w-12 items-center justify-center rounded-fluid-md bg-warning-300/10">
                  <svg className="h-6 w-6 text-warning-300" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h2 className="text-fluid-sm font-medium text-dark-400">
                  <FormattedMessage id="market.fearGreed" />
                </h2>
                <p className="text-2xl font-semibold">62</p>
                <div className="mt-1 flex items-center">
                  <span className="text-xs text-warning-300">Greed</span>
                  <span className="ml-1.5 text-xs text-dark-400">Neutral yesterday</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-dark-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`border-b-2 px-1 py-fluid-4 text-fluid-sm font-medium ${
              activeTab === 'overview'
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-dark-400 hover:text-dark-300 hover:border-dark-600'
            }`}
          >
            <FormattedMessage id="market.overview" />
          </button>
          <button
            onClick={() => setActiveTab('signals')}
            className={`border-b-2 px-1 py-fluid-4 text-fluid-sm font-medium ${
              activeTab === 'signals'
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-dark-400 hover:text-dark-300 hover:border-dark-600'
            }`}
          >
            <FormattedMessage id="market.signals" />
          </button>
          <button
            onClick={() => setActiveTab('news')}
            className={`border-b-2 px-1 py-fluid-4 text-fluid-sm font-medium ${
              activeTab === 'news'
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-dark-400 hover:text-dark-300 hover:border-dark-600'
            }`}
          >
            <FormattedMessage id="market.news" />
          </button>
        </nav>
      </div>
      
      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row gap-fluid-4">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-dark-400" />
          </div>
          <input
            type="text"
            className="form-input pl-10"
            placeholder="Search markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex">
          <button className="btn btn-outline inline-flex items-center">
            <Filter className="mr-2 h-4 w-4" />
            <FormattedMessage id="common.filter" />
          </button>
        </div>
      </div>
      
      {/* Content based on active tab */}
      {activeTab === 'overview' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-dark-700">
              <thead>
                <tr>
                  <th className="py-fluid-3.5 pl-4 pr-3 text-left text-xs font-medium text-dark-400 sm:pl-6">#</th>
                  <th className="py-fluid-3.5 pl-3 pr-3 text-left text-xs font-medium text-dark-400">
                    <FormattedMessage id="portfolio.asset" />
                  </th>
                  <th className="px-fluid-3 py-fluid-3.5 text-right text-xs font-medium text-dark-400">
                    <FormattedMessage id="common.price" />
                  </th>
                  <th className="px-fluid-3 py-fluid-3.5 text-right text-xs font-medium text-dark-400">24h %</th>
                  <th className="px-fluid-3 py-fluid-3.5 text-right text-xs font-medium text-dark-400">7d %</th>
                  <th className="px-fluid-3 py-fluid-3.5 text-right text-xs font-medium text-dark-400 hidden md:table-cell">
                    <FormattedMessage id="market.volume" />
                  </th>
                  <th className="px-fluid-3 py-fluid-3.5 text-right text-xs font-medium text-dark-400 hidden lg:table-cell">
                    <FormattedMessage id="market.globalCap" />
                  </th>
                  <th className="px-fluid-3 py-fluid-3.5 text-center text-xs font-medium text-dark-400">Signal</th>
                  <th className="relative py-fluid-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">
                      <FormattedMessage id="market.favorite" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {filteredMarketData.map((coin, index) => (
                  <tr key={coin.id} className="hover:bg-dark-700/40 cursor-pointer">
                    <td className="whitespace-nowrap py-fluid-4 pl-4 pr-3 text-fluid-sm font-medium sm:pl-6">
                      {index + 1}
                    </td>
                    <td className="whitespace-nowrap py-fluid-4 pl-3 pr-3 text-fluid-sm">
                      <div className="flex items-center">
                        <div className="h-fluid-input-sm w-8 flex-shrink-0 rounded-full bg-dark-700 flex items-center justify-center">
                          <span className="text-xs font-medium">{coin.symbol.substring(0, 1)}</span>
                        </div>
                        <div className="ml-3">
                          <div className="font-medium">{coin.name}</div>
                          <div className="text-xs text-dark-400">{coin.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-fluid-3 py-fluid-4 text-fluid-sm text-right font-medium">
                      <FormattedNumber
                        value={coin.price}
                        style="currency"
                        currency="USD"
                        minimumFractionDigits={coin.price < 1 ? 4 : 2}
                        maximumFractionDigits={coin.price < 1 ? 4 : 2}
                      />
                    </td>
                    <td className="whitespace-nowrap px-fluid-3 py-fluid-4 text-fluid-sm text-right">
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
                        <FormattedNumber
                          value={Math.abs(coin.change24h) / 100}
                          style="percent"
                          minimumFractionDigits={2}
                        />
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-fluid-3 py-fluid-4 text-fluid-sm text-right">
                      <span
                        className={`inline-flex items-center ${
                          coin.change7d >= 0 ? 'text-success-500' : 'text-danger-500'
                        }`}
                      >
                        {coin.change7d >= 0 ? (
                          <ArrowUp className="mr-1 h-3 w-3" />
                        ) : (
                          <ArrowDown className="mr-1 h-3 w-3" />
                        )}
                        <FormattedNumber
                          value={Math.abs(coin.change7d) / 100}
                          style="percent"
                          minimumFractionDigits={2}
                        />
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-fluid-3 py-fluid-4 text-fluid-sm text-right hidden md:table-cell">
                      <FormattedNumber
                        value={coin.volume24h}
                        style="currency"
                        currency="USD"
                        notation="compact"
                        minimumFractionDigits={2}
                      />
                    </td>
                    <td className="whitespace-nowrap px-fluid-3 py-fluid-4 text-fluid-sm text-right hidden lg:table-cell">
                      <FormattedNumber
                        value={coin.marketCap}
                        style="currency"
                        currency="USD"
                        notation="compact"
                        minimumFractionDigits={2}
                      />
                    </td>
                    <td className="whitespace-nowrap px-fluid-3 py-fluid-4 text-fluid-sm text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          coin.signal === 'buy' 
                            ? 'bg-success-500/10 text-success-500' 
                            : coin.signal === 'sell'
                              ? 'bg-danger-500/10 text-danger-500'
                              : 'bg-dark-600 text-dark-300'
                        }`}
                      >
                        <FormattedMessage id={`market.signal.${coin.signal}`} />
                      </span>
                    </td>
                    <td className="relative whitespace-nowrap py-fluid-4 pl-3 pr-4 text-right text-fluid-sm sm:pr-6">
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
        </div>
      )}
      
      {activeTab === 'signals' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {marketSignals.map((signal) => (
            <div key={signal.id} className="card overflow-hidden">
              <div className="p-fluid-4 border-b border-dark-700 flex justify-between items-center">
                <div className="flex items-center">
                  <div className={`h-fluid-input w-10 rounded-fluid-md flex items-center justify-center ${
                    signal.signal === 'buy' ? 'bg-success-500/10' : 'bg-danger-500/10'
                  }`}>
                    {signal.signal === 'buy' ? (
                      <ArrowUp className={`h-5 w-5 text-success-500`} />
                    ) : (
                      <ArrowDown className={`h-5 w-5 text-danger-500`} />
                    )}
                  </div>
                  <div className="ml-3">
                    <div className="text-fluid-base font-medium">{signal.pair}</div>
                    <div className="text-xs text-dark-400">{signal.timeframe} timeframe</div>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    signal.signal === 'buy' 
                      ? 'bg-success-500/10 text-success-500' 
                      : 'bg-danger-500/10 text-danger-500'
                  }`}
                >
                  <FormattedMessage id={`market.signal.${signal.signal}`} />
                </span>
              </div>
              
              <div className="p-fluid-4">
                <div className="grid grid-cols-2 gap-fluid-4 mb-4">
                  <div>
                    <div className="text-xs text-dark-400">
                      <FormattedMessage id="common.price" />
                    </div>
                    <div className="text-fluid-sm font-medium">
                      <FormattedNumber
                        value={signal.price}
                        style="currency"
                        currency="USD"
                        minimumFractionDigits={2}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-dark-400">Target Price</div>
                    <div className="text-fluid-sm font-medium">
                      <FormattedNumber
                        value={signal.targetPrice}
                        style="currency"
                        currency="USD"
                        minimumFractionDigits={2}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-dark-400">Confidence</div>
                    <div className="text-fluid-sm font-medium capitalize">{signal.confidence}</div>
                  </div>
                  <div>
                    <div className="text-xs text-dark-400">Generated</div>
                    <div className="text-fluid-sm font-medium">{signal.timestamp}</div>
                  </div>
                </div>
                
                <button className="w-full py-2 rounded-fluid-md text-fluid-sm font-medium bg-primary-500 hover:bg-primary-600 text-white">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {activeTab === 'news' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {marketNews.map((news) => (
            <div key={news.id} className="card hover:bg-dark-700/40 cursor-pointer overflow-hidden">
              <div className="flex">
                <div className="w-1/3 h-full">
                  <img 
                    src={news.image} 
                    alt={news.title} 
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="w-2/3 p-fluid-4">
                  <h3 className="font-medium line-clamp-fluid-2">{news.title}</h3>
                  <div className="mt-2 flex items-center text-xs text-dark-400">
                    <span>{news.source}</span>
                    <span className="mx-2">•</span>
                    <span>{news.date}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}