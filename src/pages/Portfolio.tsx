import React from 'react';
import { ArrowDown, ArrowUp, Briefcase, Clock, Download, Filter, Search, Settings, Share2 } from 'lucide-react';
import { FormattedMessage, FormattedNumber, FormattedDate } from 'react-intl';

// Mock portfolio data
const portfolioAssets = [
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    symbol: 'BTC',
    amount: 0.2875,
    price: 38452.12,
    value: 11055.98,
    allocation: 42.6,
    change24h: 2.34,
    pnl: 1247.89,
    pnlPercent: 12.7,
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    amount: 3.456,
    price: 2345.78,
    value: 8107.01,
    allocation: 31.2,
    change24h: -1.24,
    pnl: 654.32,
    pnlPercent: 8.8,
  },
  {
    id: 'solana',
    name: 'Solana',
    symbol: 'SOL',
    amount: 42.78,
    price: 78.45,
    value: 3356.1,
    allocation: 12.9,
    change24h: 5.67,
    pnl: 876.54,
    pnlPercent: 35.3,
  },
  {
    id: 'cardano',
    name: 'Cardano',
    symbol: 'ADA',
    amount: 4500,
    price: 0.65,
    value: 2925,
    allocation: 11.3,
    change24h: -0.87,
    pnl: -125.78,
    pnlPercent: -4.1,
  },
  {
    id: 'usdt',
    name: 'Tether',
    symbol: 'USDT',
    amount: 520,
    price: 1,
    value: 520,
    allocation: 2.0,
    change24h: 0.01,
    pnl: 0,
    pnlPercent: 0,
  },
];

// Calculate total portfolio value
const totalPortfolioValue = portfolioAssets.reduce((sum, asset) => sum + asset.value, 0);

export default function Portfolio() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            <FormattedMessage id="nav.portfolio" />
          </h1>
          <p className="text-dark-400">
            <FormattedMessage id="portfolio.subtitle" />
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline inline-flex items-center">
            <Download className="mr-2 h-4 w-4" />
            <FormattedMessage id="portfolio.export" />
          </button>
          <button className="btn btn-outline inline-flex items-center">
            <Share2 className="mr-2 h-4 w-4" />
            <FormattedMessage id="portfolio.share" />
          </button>
          <button className="btn btn-outline inline-flex items-center">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {/* Portfolio summary */}
      <div className="card p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div>
            <h2 className="text-sm font-medium text-dark-400">
              <FormattedMessage id="portfolio.totalValue" />
            </h2>
            <p className="mt-1 text-3xl font-semibold">
              <FormattedNumber
                value={totalPortfolioValue}
                style="currency"
                currency="USD"
              />
            </p>
            <div className="mt-1 flex items-center">
              <span className="flex items-center text-sm font-medium text-success-500">
                <ArrowUp className="mr-1 h-3 w-3" />
                <FormattedNumber
                  value={0.0428}
                  style="percent"
                  minimumFractionDigits={2}
                />
              </span>
              <span className="ml-1.5 text-xs text-dark-400">
                <FormattedMessage id="portfolio.last24h" />
              </span>
            </div>
          </div>
          
          <div>
            <h2 className="text-sm font-medium text-dark-400">
              <FormattedMessage id="portfolio.totalPnL" />
            </h2>
            <p className="mt-1 text-3xl font-semibold text-success-500">
              <FormattedNumber
                value={2652.97}
                style="currency"
                currency="USD"
                signDisplay="always"
              />
            </p>
            <div className="mt-1 flex items-center">
              <span className="flex items-center text-sm font-medium text-success-500">
                <ArrowUp className="mr-1 h-3 w-3" />
                <FormattedNumber
                  value={0.114}
                  style="percent"
                  minimumFractionDigits={1}
                />
              </span>
              <span className="ml-1.5 text-xs text-dark-400">
                <FormattedMessage id="portfolio.allTime" />
              </span>
            </div>
          </div>
          
          <div>
            <h2 className="text-sm font-medium text-dark-400">
              <FormattedMessage id="portfolio.age" />
            </h2>
            <div className="mt-1 flex items-center">
              <Clock className="mr-2 h-5 w-5 text-primary-500" />
              <p className="text-lg font-medium">
                <FormattedMessage
                  id="portfolio.days"
                  values={{ days: 187 }}
                />
              </p>
            </div>
            <div className="mt-1 text-xs text-dark-400">
              <FormattedMessage
                id="portfolio.since"
                values={{
                  date: <FormattedDate
                    value={new Date(2023, 8, 12)}
                    year="numeric"
                    month="long"
                    day="numeric"
                  />
                }}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-dark-400" />
          </div>
          <input
            type="text"
            className="form-input pl-10"
            placeholder="Search assets..."
          />
        </div>
        <div className="flex">
          <button className="btn btn-outline inline-flex items-center">
            <Filter className="mr-2 h-4 w-4" />
            <FormattedMessage id="common.filter" />
          </button>
        </div>
      </div>
      
      {/* Assets table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-dark-700">
            <thead>
              <tr>
                <th className="py-3.5 pl-4 pr-3 text-left text-xs font-medium text-dark-400 sm:pl-6">
                  <FormattedMessage id="portfolio.asset" />
                </th>
                <th className="px-3 py-3.5 text-right text-xs font-medium text-dark-400">
                  <FormattedMessage id="common.price" />
                </th>
                <th className="px-3 py-3.5 text-right text-xs font-medium text-dark-400">24h</th>
                <th className="px-3 py-3.5 text-right text-xs font-medium text-dark-400">
                  <FormattedMessage id="portfolio.holdings" />
                </th>
                <th className="px-3 py-3.5 text-right text-xs font-medium text-dark-400">
                  <FormattedMessage id="portfolio.value" />
                </th>
                <th className="px-3 py-3.5 text-right text-xs font-medium text-dark-400">
                  <FormattedMessage id="portfolio.allocation" />
                </th>
                <th className="px-3 py-3.5 text-right text-xs font-medium text-dark-400">
                  <FormattedMessage id="portfolio.profitLoss" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {portfolioAssets.map((asset) => (
                <tr key={asset.id} className="hover:bg-dark-700/40 cursor-pointer">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                    <div className="flex items-center">
                      <div className="h-8 w-8 flex-shrink-0 rounded-full bg-dark-700 flex items-center justify-center">
                        <span className="text-xs font-medium">{asset.symbol.substring(0, 1)}</span>
                      </div>
                      <div className="ml-3">
                        <div className="font-medium">{asset.name}</div>
                        <div className="text-xs text-dark-400">{asset.symbol}</div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                    <FormattedNumber
                      value={asset.price}
                      style="currency"
                      currency="USD"
                      minimumFractionDigits={asset.price < 1 ? 4 : 2}
                      maximumFractionDigits={asset.price < 1 ? 4 : 2}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                    <span
                      className={`inline-flex items-center ${
                        asset.change24h >= 0 ? 'text-success-500' : 'text-danger-500'
                      }`}
                    >
                      {asset.change24h >= 0 ? (
                        <ArrowUp className="mr-1 h-3 w-3" />
                      ) : (
                        <ArrowDown className="mr-1 h-3 w-3" />
                      )}
                      <FormattedNumber
                        value={Math.abs(asset.change24h) / 100}
                        style="percent"
                        minimumFractionDigits={2}
                      />
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                    <FormattedNumber
                      value={asset.amount}
                      minimumFractionDigits={asset.amount < 1 ? 4 : 0}
                      maximumFractionDigits={asset.amount < 1 ? 4 : 4}
                    /> {asset.symbol}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-right">
                    <FormattedNumber
                      value={asset.value}
                      style="currency"
                      currency="USD"
                      minimumFractionDigits={2}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                    <div className="flex items-center justify-end">
                      <span className="mr-2">
                        <FormattedNumber
                          value={asset.allocation / 100}
                          style="percent"
                          minimumFractionDigits={1}
                        />
                      </span>
                      <div className="w-16 bg-dark-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${
                            asset.pnlPercent >= 0 ? 'bg-success-500' : 'bg-danger-500'
                          }`}
                          style={{ width: `${asset.allocation}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                    <span
                      className={asset.pnl >= 0 ? 'text-success-500' : 'text-danger-500'}
                    >
                      <FormattedNumber
                        value={asset.pnl}
                        style="currency"
                        currency="USD"
                        signDisplay="always"
                      />
                      {' ('}
                      <FormattedNumber
                        value={asset.pnlPercent / 100}
                        style="percent"
                        signDisplay="always"
                        minimumFractionDigits={1}
                      />
                      {')'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}