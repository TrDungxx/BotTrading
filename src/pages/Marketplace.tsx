import React, { useState } from 'react';
import { Bot, Download, Filter, Search, ShoppingBag, Star, User } from 'lucide-react';
import { FormattedMessage, FormattedNumber } from 'react-intl';

// Mock data for marketplace bots
const marketplaceBots = [
  {
    id: 1,
    name: 'BTC Grid Master',
    description: 'Advanced grid trading bot for Bitcoin with dynamic grid spacing based on volatility',
    type: 'Grid Bot',
    creator: 'CryptoTrader',
    creatorAvatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=60',
    rating: 4.8,
    reviews: 124,
    price: 49.99,
    tags: ['Grid Trading', 'Bitcoin', 'Volatility'],
    featured: true,
  },
  {
    id: 2,
    name: 'Altcoin DCA Pro',
    description: 'Dollar cost averaging bot optimized for altcoin accumulation during market dips',
    type: 'DCA Bot',
    creator: 'AlgoTrader',
    creatorAvatar: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=60',
    rating: 4.5,
    reviews: 87,
    price: 39.99,
    tags: ['DCA', 'Altcoins', 'Accumulation'],
    featured: false,
  },
  {
    id: 3,
    name: 'ETH Breakout Hunter',
    description: 'Smart trading bot that identifies and trades Ethereum breakout patterns',
    type: 'SMART Trade',
    creator: 'TechTrader',
    creatorAvatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=60',
    rating: 4.7,
    reviews: 56,
    price: 59.99,
    tags: ['Ethereum', 'Breakout', 'Technical Analysis'],
    featured: true,
  },
  {
    id: 4,
    name: 'Scalping Master',
    description: 'High-frequency scalping bot for quick profits in volatile markets',
    type: 'Scalping Bot',
    creator: 'SpeedTrader',
    creatorAvatar: 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=60',
    rating: 4.2,
    reviews: 42,
    price: 69.99,
    tags: ['Scalping', 'High-Frequency', 'Volatility'],
    featured: false,
  },
  {
    id: 5,
    name: 'Bollinger Band Strategy',
    description: 'Trading bot that uses Bollinger Bands to identify market reversals',
    type: 'Technical Bot',
    creator: 'TechnicalTrader',
    creatorAvatar: 'https://images.pexels.com/photos/937481/pexels-photo-937481.jpeg?auto=compress&cs=tinysrgb&w=60',
    rating: 4.4,
    reviews: 38,
    price: 44.99,
    tags: ['Bollinger Bands', 'Technical Analysis', 'Reversals'],
    featured: false,
  },
  {
    id: 6,
    name: 'Market Maker Bot',
    description: 'Provides liquidity and captures spreads on multiple trading pairs',
    type: 'Market Making',
    creator: 'LiquidityProvider',
    creatorAvatar: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=60',
    rating: 4.6,
    reviews: 29,
    price: 79.99,
    tags: ['Market Making', 'Liquidity', 'Spreads'],
    featured: true,
  },
];

// Mock data for bot categories
const botCategories = [
  { id: 'all', name: 'All Bots' },
  { id: 'grid', name: 'Grid Trading' },
  { id: 'dca', name: 'DCA' },
  { id: 'smart', name: 'SMART Trade' },
  { id: 'scalping', name: 'Scalping' },
  { id: 'technical', name: 'Technical' },
  { id: 'market-making', name: 'Market Making' },
];

export default function Marketplace() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Filter bots based on search query and selected category
  const filteredBots = marketplaceBots.filter((bot) => {
    const matchesSearch = bot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          bot.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          bot.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || 
                           (selectedCategory === 'grid' && bot.type === 'Grid Bot') ||
                           (selectedCategory === 'dca' && bot.type === 'DCA Bot') ||
                           (selectedCategory === 'smart' && bot.type === 'SMART Trade') ||
                           (selectedCategory === 'scalping' && bot.type === 'Scalping Bot') ||
                           (selectedCategory === 'technical' && bot.type === 'Technical Bot') ||
                           (selectedCategory === 'market-making' && bot.type === 'Market Making');
    
    return matchesSearch && matchesCategory;
  });
  
  // Featured bots
  const featuredBots = marketplaceBots.filter(bot => bot.featured);
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-fluid-4">
        <div>
          <h1 className="text-2xl font-bold">
            <FormattedMessage id="marketplace.title" />
          </h1>
          <p className="text-dark-400">
            <FormattedMessage id="marketplace.subtitle" />
          </p>
        </div>
      </div>
      
      {/* Featured bots carousel */}
      <div className="card p-6">
        <h2 className="text-lg font-medium mb-4">
          <FormattedMessage id="marketplace.featured" />
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featuredBots.map((bot) => (
            <div key={bot.id} className="bg-dark-700 rounded-lg overflow-hidden border border-dark-600 hover:border-primary-500 transition-colors">
              <div className="p-fluid-4 border-b border-dark-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`h-fluid-input w-10 rounded-fluid-md flex items-center justify-center ${
                      bot.type === 'Grid Bot' ? 'bg-primary-500/10' :
                      bot.type === 'DCA Bot' ? 'bg-success-500/10' : 
                      bot.type === 'SMART Trade' ? 'bg-warning-300/10' : 'bg-dark-600'
                    }`}>
                      <Bot className={`h-5 w-5 ${
                        bot.type === 'Grid Bot' ? 'text-primary-500' :
                        bot.type === 'DCA Bot' ? 'text-success-500' : 
                        bot.type === 'SMART Trade' ? 'text-warning-300' : 'text-dark-300'
                      }`} />
                    </div>
                    <div className="ml-3">
                      <div className="font-medium">{bot.name}</div>
                      <div className="text-xs text-dark-400">{bot.type}</div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Star className="h-4 w-4 text-warning-300" fill="currentColor" />
                    <span className="ml-1 text-fluid-sm">{bot.rating}</span>
                  </div>
                </div>
              </div>
              <div className="p-fluid-4">
                <p className="text-fluid-sm text-dark-300 line-clamp-fluid-2 h-fluid-input">{bot.description}</p>
                <div className="flex flex-wrap gap-fluid-1 mt-3">
                  {bot.tags.map((tag, index) => (
                    <span key={index} className="inline-flex rounded-full bg-dark-600 px-2 py-fluid-1 text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center">
                    <img
                      src={bot.creatorAvatar}
                      alt={bot.creator}
                      className="h-6 w-6 rounded-full object-cover"
                    />
                    <span className="ml-2 text-xs text-dark-400">{bot.creator}</span>
                  </div>
                  <span className="font-medium">
                    <FormattedNumber
                      value={bot.price}
                      style="currency"
                      currency="USD"
                    />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Category filter and search */}
      <div className="flex flex-col md:flex-row gap-fluid-4">
        <div className="md:w-64 space-y-6">
          <div className="card p-fluid-4">
            <h3 className="text-fluid-sm font-medium mb-3">
              <FormattedMessage id="marketplace.categories" />
            </h3>
            <div className="gap-fluid-2">
              {botCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex items-center w-full rounded-fluid-md px-fluid-3 py-2 text-fluid-sm ${
                    selectedCategory === category.id
                      ? 'bg-primary-500/10 text-primary-500'
                      : 'text-dark-300 hover:bg-dark-700'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
          
          <div className="card p-fluid-4">
            <h3 className="text-fluid-sm font-medium mb-3">
              <FormattedMessage id="marketplace.priceRange" />
            </h3>
            <div className="gap-fluid-2">
              <div className="flex items-center justify-between">
                <input
                  type="range"
                  min="0"
                  max="100"
                  className="w-full"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-dark-400">$0</span>
                <span className="text-xs text-dark-400">$100</span>
              </div>
            </div>
          </div>
          
          <div className="card p-fluid-4">
            <h3 className="text-fluid-sm font-medium mb-3">
              <FormattedMessage id="marketplace.rating" />
            </h3>
            <div className="gap-fluid-2">
              {[5, 4, 3, 2, 1].map((rating) => (
                <button
                  key={rating}
                  className="flex items-center w-full rounded-fluid-md px-fluid-3 py-2 text-fluid-sm text-dark-300 hover:bg-dark-700"
                >
                  <div className="flex items-center">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star 
                        key={index} 
                        className={`h-4 w-4 ${index < rating ? 'text-warning-300' : 'text-dark-600'}`}
                        fill={index < rating ? 'currentColor' : 'none'}
                      />
                    ))}
                  </div>
                  <span className="ml-2">& Up</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex-1 space-y-4">
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
                <FormattedMessage id="common.filter" />
              </button>
            </div>
          </div>
          
          {/* Bot grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filteredBots.map((bot) => (
              <div key={bot.id} className="card overflow-hidden hover:border-primary-500 transition-colors border border-dark-700">
                <div className="p-fluid-4 border-b border-dark-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`h-fluid-input w-10 rounded-fluid-md flex items-center justify-center ${
                        bot.type === 'Grid Bot' ? 'bg-primary-500/10' :
                        bot.type === 'DCA Bot' ? 'bg-success-500/10' : 
                        bot.type === 'SMART Trade' ? 'bg-warning-300/10' : 'bg-dark-600'
                      }`}>
                        <Bot className={`h-5 w-5 ${
                          bot.type === 'Grid Bot' ? 'text-primary-500' :
                          bot.type === 'DCA Bot' ? 'text-success-500' : 
                          bot.type === 'SMART Trade' ? 'text-warning-300' : 'text-dark-300'
                        }`} />
                      </div>
                      <div className="ml-3">
                        <div className="font-medium">{bot.name}</div>
                        <div className="text-xs text-dark-400">{bot.type}</div>
                      </div>
                    </div>
                    {bot.featured && (
                      <span className="inline-flex items-center rounded-full bg-primary-500/10 px-2.5 py-0.5 text-xs font-medium text-primary-500">
                        <FormattedMessage id="marketplace.featured" />
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="p-fluid-4">
                  <p className="text-fluid-sm text-dark-300 line-clamp-fluid-2 h-fluid-input">{bot.description}</p>
                  
                  <div className="flex flex-wrap gap-fluid-1 mt-3">
                    {bot.tags.map((tag, index) => (
                      <span key={index} className="inline-flex rounded-full bg-dark-700 px-2 py-fluid-1 text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center">
                      <img
                        src={bot.creatorAvatar}
                        alt={bot.creator}
                        className="h-6 w-6 rounded-full object-cover"
                      />
                      <span className="ml-2 text-xs text-dark-400">
                        <FormattedMessage id="marketplace.creator" />: {bot.creator}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-warning-300" fill="currentColor" />
                      <span className="ml-1 text-fluid-sm">{bot.rating}</span>
                      <span className="ml-1 text-xs text-dark-400">({bot.reviews} <FormattedMessage id="marketplace.reviews" />)</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-lg font-medium">
                      <FormattedNumber
                        value={bot.price}
                        style="currency"
                        currency="USD"
                      />
                    </span>
                    <button className="btn btn-primary py-fluid-1.5 px-fluid-3 text-xs">
                      <ShoppingBag className="mr-1 h-3 w-3" />
                      <FormattedMessage id="marketplace.buyNow" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}