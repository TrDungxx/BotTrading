import React, { useState } from 'react';
import { Bot, Plus, Search, Filter, ArrowDown, ArrowUp, MoreVertical, PlayCircle, PauseCircle, Trash2 } from 'lucide-react';
import { FormattedMessage, FormattedNumber } from 'react-intl';

const mockBots = [
  {
    id: 1,
    name: 'BTC Scalper',
    description: 'DCA bot for Bitcoin scalping strategy',
    type: 'DCA Bot',
    pair: 'BTC/USDT',
    exchange: 'Binance',
    profitTotal: 423.89,
    profitPercent: 8.4,
    deals: 127,
    status: 'running',
  },
  {
    id: 2,
    name: 'ETH Swing',
    description: 'Grid trading bot for Ethereum',
    type: 'Grid Bot',
    pair: 'ETH/USDT',
    exchange: 'Binance',
    profitTotal: 187.42,
    profitPercent: 5.2,
    deals: 84,
    status: 'running',
  },
  {
    id: 3,
    name: 'SOL Breakout',
    description: 'Smart trade for Solana breakouts',
    type: 'SMART Trade',
    pair: 'SOL/USDT',
    exchange: 'Binance',
    profitTotal: 94.18,
    profitPercent: 12.7,
    deals: 32,
    status: 'running',
  },
  {
    id: 4,
    name: 'MATIC DCA',
    description: 'Dollar cost averaging for Polygon',
    type: 'DCA Bot',
    pair: 'MATIC/USDT',
    exchange: 'Binance',
    profitTotal: -23.45,
    profitPercent: -2.1,
    deals: 18,
    status: 'stopped',
  },
  {
    id: 5,
    name: 'DOT Grid',
    description: 'Grid trading bot for Polkadot',
    type: 'Grid Bot',
    pair: 'DOT/USDT',
    exchange: 'Binance',
    profitTotal: 45.67,
    profitPercent: 3.8,
    deals: 42,
    status: 'stopped',
  },
];

export default function Bots() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'running' | 'stopped'>('all');
  
  const filteredBots = mockBots.filter((bot) => {
    const matchesSearch = bot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          bot.pair.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          bot.type.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTab = activeTab === 'all' ||
                      (activeTab === 'running' && bot.status === 'running') ||
                      (activeTab === 'stopped' && bot.status === 'stopped');
    
    return matchesSearch && matchesTab;
  });
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-fluid-4">
        <div>
          <h1 className="text-2xl font-bold">
            <FormattedMessage id="bots.title" />
          </h1>
          <p className="text-dark-400">
            <FormattedMessage id="bots.subtitle" />
          </p>
        </div>
        <button className="btn btn-primary inline-flex items-center">
          <Plus className="mr-2 h-4 w-4" />
          <FormattedMessage id="bots.createNew" />
        </button>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-fluid-4">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-dark-400" />
          </div>
          <input
            type="text"
            className="form-input pl-10"
            placeholder="Search bots..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex">
          <button className="btn btn-outline inline-flex items-center">
            <Filter className="mr-2 h-4 w-4" />
            <FormattedMessage id="bots.filter" />
          </button>
        </div>
      </div>
      
      <div className="border-b border-dark-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('all')}
            className={`border-b-2 px-1 py-fluid-4 text-fluid-sm font-medium ${
              activeTab === 'all'
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-dark-400 hover:text-dark-300 hover:border-dark-600'
            }`}
          >
            <FormattedMessage id="bots.allBots" />
          </button>
          <button
            onClick={() => setActiveTab('running')}
            className={`border-b-2 px-1 py-fluid-4 text-fluid-sm font-medium ${
              activeTab === 'running'
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-dark-400 hover:text-dark-300 hover:border-dark-600'
            }`}
          >
            <FormattedMessage id="bots.running" />
          </button>
          <button
            onClick={() => setActiveTab('stopped')}
            className={`border-b-2 px-1 py-fluid-4 text-fluid-sm font-medium ${
              activeTab === 'stopped'
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-dark-400 hover:text-dark-300 hover:border-dark-600'
            }`}
          >
            <FormattedMessage id="bots.stopped" />
          </button>
        </nav>
      </div>
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredBots.map((bot) => (
          <div key={bot.id} className="card overflow-hidden">
            <div className="flex justify-between items-center p-fluid-4 border-b border-dark-700">
              <div className="flex items-center">
                <div className={`h-fluid-input w-10 rounded-fluid-md flex items-center justify-center ${
                  bot.type === 'DCA Bot' ? 'bg-primary-500/10' :
                  bot.type === 'Grid Bot' ? 'bg-success-500/10' : 'bg-warning-300/10'
                }`}>
                  <Bot className={`h-5 w-5 ${
                    bot.type === 'DCA Bot' ? 'text-primary-500' :
                    bot.type === 'Grid Bot' ? 'text-success-500' : 'text-warning-300'
                  }`} />
                </div>
                <div className="ml-3">
                  <h3 className="text-fluid-base font-medium">{bot.name}</h3>
                  <p className="text-xs text-dark-400">{bot.type}</p>
                </div>
              </div>
              <div className="relative">
                <button className="text-dark-400 hover:text-dark-300">
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-fluid-4">
              <div className="text-xs text-dark-400 mb-2">{bot.description}</div>
              
              <div className="grid grid-cols-2 gap-fluid-4 mb-4">
                <div>
                  <div className="text-xs text-dark-400">
                    <FormattedMessage id="common.price" />
                  </div>
                  <div className="text-fluid-sm font-medium">{bot.pair}</div>
                </div>
                <div>
                  <div className="text-xs text-dark-400">
                    <FormattedMessage id="bots.exchange" />
                  </div>
                  <div className="text-fluid-sm font-medium">{bot.exchange}</div>
                </div>
                <div>
                  <div className="text-xs text-dark-400">
                    <FormattedMessage id="bots.profitTotal" />
                  </div>
                  <div className={`text-fluid-sm font-medium ${bot.profitTotal >= 0 ? 'text-success-500' : 'text-danger-500'}`}>
                    <FormattedNumber
                      value={bot.profitTotal}
                      style="currency"
                      currency="USD"
                    /> ({bot.profitPercent > 0 ? '+' : ''}{bot.profitPercent}%)
                  </div>
                </div>
                <div>
                  <div className="text-xs text-dark-400">
                    <FormattedMessage id="bots.deals" />
                  </div>
                  <div className="text-fluid-sm font-medium">{bot.deals}</div>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  bot.status === 'running' ? 'bg-success-500/10 text-success-500' : 'bg-dark-600 text-dark-300'
                }`}>
                  <FormattedMessage id={`common.${bot.status}`} />
                </span>
                
                <div className="flex gap-fluid-2">
                  {bot.status === 'running' ? (
                    <button className="p-1 text-dark-400 hover:text-danger-500\" title={<FormattedMessage id="bots.stop" />}>
                      <PauseCircle className="h-5 w-5" />
                    </button>
                  ) : (
                    <button className="p-1 text-dark-400 hover:text-success-500" title={<FormattedMessage id="bots.start" />}>
                      <PlayCircle className="h-5 w-5" />
                    </button>
                  )}
                  <button className="p-1 text-dark-400 hover:text-danger-500" title={<FormattedMessage id="bots.delete" />}>
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}