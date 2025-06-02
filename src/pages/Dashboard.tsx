import { ArrowDown, ArrowUp, Bot, Briefcase, DollarSign, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { FormattedMessage, FormattedNumber } from 'react-intl';
import PortfolioChart from '../components/dashboard/PortfolioChart';
import ActiveBotsList from '../components/dashboard/ActiveBotsList';
import RecentTransactions from '../components/dashboard/RecentTransactions';
import MarketOverview from '../components/dashboard/MarketOverview';

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState<'1d' | '7d' | '30d' | '90d'>('7d');
  
  // Sample portfolio data
  const portfolioValue = 15247.89;
  const portfolioChange = 427.35;
  const portfolioChangePercent = 2.88;
  const isPositiveChange = portfolioChange > 0;
  
  // Sample bots data
  const totalBots = 5;
  const activeBots = 3;
  
  // Sample trading data
  const totalTrades = 127;
  const winRate = 68;
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          <FormattedMessage id="dashboard.title" />
        </h1>
        <p className="text-dark-400">
          <FormattedMessage id="dashboard.subtitle" />
        </p>
      </div>
      
      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary-500/10">
                  <Briefcase className="h-6 w-6 text-primary-500" />
                </div>
              </div>
              <div className="ml-4">
                <h2 className="text-sm font-medium text-dark-400">
                  <FormattedMessage id="portfolio.value" />
                </h2>
                <p className="text-2xl font-semibold">
                  <FormattedNumber
                    value={portfolioValue}
                    style="currency"
                    currency="USD"
                  />
                </p>
                <div className="mt-1 flex items-center">
                  <span
                    className={`flex items-center text-xs font-medium ${
                      isPositiveChange ? 'text-success-500' : 'text-danger-500'
                    }`}
                  >
                    {isPositiveChange ? <ArrowUp className="mr-1 h-3 w-3" /> : <ArrowDown className="mr-1 h-3 w-3" />}
                    <FormattedNumber
                      value={Math.abs(portfolioChange)}
                      style="currency"
                      currency="USD"
                    />
                    (<FormattedNumber
                      value={Math.abs(portfolioChangePercent) / 100}
                      style="percent"
                      minimumFractionDigits={2}
                      maximumFractionDigits={2}
                    />)
                  </span>
                  <span className="ml-1.5 text-xs text-dark-400">
                    <FormattedMessage id="portfolio.change" />
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
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-success-500/10">
                  <Bot className="h-6 w-6 text-success-500" />
                </div>
              </div>
              <div className="ml-4">
                <h2 className="text-sm font-medium text-dark-400">
                  <FormattedMessage id="trading.bots" />
                </h2>
                <p className="text-2xl font-semibold">{activeBots} <span className="text-lg text-dark-400">/ {totalBots}</span></p>
                <p className="mt-1 text-xs text-dark-400">
                  <FormattedMessage id="trading.activeBots" />
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-warning-300/10">
                  <TrendingUp className="h-6 w-6 text-warning-300" />
                </div>
              </div>
              <div className="ml-4">
                <h2 className="text-sm font-medium text-dark-400">
                  <FormattedMessage id="trading.winRate" />
                </h2>
                <p className="text-2xl font-semibold">
                  <FormattedNumber
                    value={winRate / 100}
                    style="percent"
                    minimumFractionDigits={0}
                    maximumFractionDigits={0}
                  />
                </p>
                <p className="mt-1 text-xs text-dark-400">
                  <FormattedMessage
                    id="trading.lastTrades"
                    values={{ number: totalTrades }}
                  />
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary-500/10">
                  <DollarSign className="h-6 w-6 text-primary-500" />
                </div>
              </div>
              <div className="ml-4">
                <h2 className="text-sm font-medium text-dark-400">
                  <FormattedMessage id="trading.totalProfit" />
                </h2>
                <p className="text-2xl font-semibold text-success-500">+$1,247.89</p>
                <p className="mt-1 text-xs text-dark-400">
                  <FormattedMessage id="trading.allTime" />
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Portfolio chart */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-medium">Portfolio Performance</h2>
          <div className="flex space-x-2">
            {(['1d', '7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-xs font-medium rounded-md ${
                  timeRange === range
                    ? 'bg-primary-500 text-white'
                    : 'text-dark-400 hover:text-dark-300 hover:bg-dark-700'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body">
          <PortfolioChart timeRange={timeRange} />
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Active bots */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-medium">
              <FormattedMessage id="trading.bots" />
            </h2>
            <a href="/bots" className="text-sm text-primary-500 hover:text-primary-400">
              <FormattedMessage id="common.viewAll" />
            </a>
          </div>
          <div className="card-body">
            <ActiveBotsList />
          </div>
        </div>
        
        {/* Recent transactions */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-medium"><FormattedMessage id="trading.recent"/></h2>
            <a href="/terminal" className="text-sm text-primary-500 hover:text-primary-400">
              <FormattedMessage id="common.viewAll" />
            </a>
          </div>
          <div className="card-body">
            <RecentTransactions />
          </div>
        </div>
      </div>
      
      {/* Market overview */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-medium"><FormattedMessage id="trading.market"/></h2>
          <a href="/market" className="text-sm text-primary-500 hover:text-primary-400">
            <FormattedMessage id="common.viewAll" />
          </a>
        </div>
        <div className="card-body">
          <MarketOverview />
        </div>
      </div>
    </div>
  );
}