import React, { useState } from 'react';
import { Bell, CreditCard, Key, Lock, Save, Shield, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FormattedMessage, FormattedNumber } from 'react-intl';

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'api' | 'notifications' | 'payment'>('profile');
  
  // Form states
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [timezone, setTimezone] = useState('UTC');
  const [language, setLanguage] = useState('en');
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          <FormattedMessage id="settings.title" />
        </h1>
        <p className="text-dark-400">
          <FormattedMessage id="settings.subtitle" />
        </p>
      </div>
      
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <div className="w-full md:w-64">
          <div className="card">
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-none ${
                  activeTab === 'profile'
                    ? 'bg-primary-500/10 text-primary-500 border-l-4 border-primary-500'
                    : 'text-dark-300 hover:bg-dark-700 hover:text-dark-200'
                }`}
              >
                <User className="mr-3 h-5 w-5" />
                <FormattedMessage id="settings.profile" />
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-none ${
                  activeTab === 'security'
                    ? 'bg-primary-500/10 text-primary-500 border-l-4 border-primary-500'
                    : 'text-dark-300 hover:bg-dark-700 hover:text-dark-200'
                }`}
              >
                <Shield className="mr-3 h-5 w-5" />
                <FormattedMessage id="settings.security" />
              </button>
              <button
                onClick={() => setActiveTab('api')}
                className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-none ${
                  activeTab === 'api'
                    ? 'bg-primary-500/10 text-primary-500 border-l-4 border-primary-500'
                    : 'text-dark-300 hover:bg-dark-700 hover:text-dark-200'
                }`}
              >
                <Key className="mr-3 h-5 w-5" />
                <FormattedMessage id="settings.api" />
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-none ${
                  activeTab === 'notifications'
                    ? 'bg-primary-500/10 text-primary-500 border-l-4 border-primary-500'
                    : 'text-dark-300 hover:bg-dark-700 hover:text-dark-200'
                }`}
              >
                <Bell className="mr-3 h-5 w-5" />
                <FormattedMessage id="settings.notifications" />
              </button>
              <button
                onClick={() => setActiveTab('payment')}
                className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-none ${
                  activeTab === 'payment'
                    ? 'bg-primary-500/10 text-primary-500 border-l-4 border-primary-500'
                    : 'text-dark-300 hover:bg-dark-700 hover:text-dark-200'
                }`}
              >
                <CreditCard className="mr-3 h-5 w-5" />
                <FormattedMessage id="settings.payment" />
              </button>
            </nav>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1">
          <div className="card">
            {activeTab === 'profile' && (
              <div className="p-6">
                <h2 className="text-lg font-medium mb-6">
                  <FormattedMessage id="settings.profile" />
                </h2>
                
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row gap-6">
                    <div className="sm:w-32">
                      <div className="aspect-square rounded-full bg-dark-700 overflow-hidden">
                        <img
                          src={user?.avatar || "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150"}
                          alt="Profile"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <button className="mt-2 text-xs text-primary-500 hover:text-primary-400 w-full text-center">
                        <FormattedMessage id="settings.changePhoto" />
                      </button>
                    </div>
                    
                    <div className="flex-1 space-y-4">
                      <div>
                        <label htmlFor="name" className="form-label">
                          <FormattedMessage id="settings.name" />
                        </label>
                        <input
                          type="text"
                          id="name"
                          className="form-input"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="email" className="form-label">
                          <FormattedMessage id="settings.email" />
                        </label>
                        <input
                          type="email"
                          id="email"
                          className="form-input"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="timezone" className="form-label">
                            <FormattedMessage id="settings.timezone" />
                          </label>
                          <select
                            id="timezone"
                            className="form-select"
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                          >
                            <option value="UTC">UTC</option>
                            <option value="EST">Eastern Time (ET)</option>
                            <option value="CST">Central Time (CT)</option>
                            <option value="MST">Mountain Time (MT)</option>
                            <option value="PST">Pacific Time (PT)</option>
                          </select>
                        </div>
                        
                        <div>
                          <label htmlFor="language" className="form-label">
                            <FormattedMessage id="settings.language" />
                          </label>
                          <select
                            id="language"
                            className="form-select"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                          >
                            <option value="en">English</option>
                            <option value="es">Spanish</option>
                            <option value="fr">French</option>
                            <option value="de">German</option>
                            <option value="ja">Japanese</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-dark-700 pt-6">
                    <button className="btn btn-primary">
                      <Save className="mr-2 h-4 w-4" />
                      <FormattedMessage id="settings.saveChanges" />
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'security' && (
              <div className="p-6">
                <h2 className="text-lg font-medium mb-6">
                  <FormattedMessage id="settings.security" />
                </h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-medium mb-4">
                      <FormattedMessage id="settings.updatePassword" />
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="current-password" className="form-label">
                          <FormattedMessage id="settings.currentPassword" />
                        </label>
                        <input
                          type="password"
                          id="current-password"
                          className="form-input"
                          placeholder="••••••••"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="new-password" className="form-label">
                          <FormattedMessage id="settings.newPassword" />
                        </label>
                        <input
                          type="password"
                          id="new-password"
                          className="form-input"
                          placeholder="••••••••"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="confirm-password" className="form-label">
                          <FormattedMessage id="settings.confirmPassword" />
                        </label>
                        <input
                          type="password"
                          id="confirm-password"
                          className="form-input"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                    
                    <button className="btn btn-primary mt-4">
                      <Lock className="mr-2 h-4 w-4" />
                      <FormattedMessage id="settings.updatePassword" />
                    </button>
                  </div>
                  
                  <div className="border-t border-dark-700 pt-6">
                    <h3 className="text-base font-medium mb-4">
                      <FormattedMessage id="settings.enable2FA" />
                    </h3>
                    <p className="text-dark-400 text-sm mb-4">
                      Two-factor authentication adds an extra layer of security to your account by requiring more than just a password to sign in.
                    </p>
                    
                    <button className="btn btn-outline">
                      <FormattedMessage id="settings.enable2FA" />
                    </button>
                  </div>
                  
                  <div className="border-t border-dark-700 pt-6">
                    <h3 className="text-base font-medium mb-4">
                      <FormattedMessage id="settings.sessions" />
                    </h3>
                    <p className="text-dark-400 text-sm mb-4">
                      These are the devices that are currently logged into your account.
                    </p>
                    
                    <div className="card bg-dark-700 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Chrome on Windows</p>
                          <p className="text-xs text-dark-400">Last active 2 minutes ago • New York, USA</p>
                        </div>
                        <span className="badge badge-success">Current</span>
                      </div>
                    </div>
                    
                    <button className="btn btn-outline mt-4 text-danger-500 border-danger-500 hover:bg-danger-500/10">
                      <FormattedMessage id="settings.signOutOthers" />
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'api' && (
              <div className="p-6">
                <h2 className="text-lg font-medium mb-6">
                  <FormattedMessage id="settings.api" />
                </h2>
                
                <div className="space-y-6">
                  <p className="text-dark-400">
                    API keys allow you to connect your exchange accounts and automate your trading strategies.
                  </p>
                  
                  <div className="card bg-dark-700 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Binance API Key</p>
                        <p className="text-xs text-dark-400">Connected 30 days ago • Last used 2 hours ago</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn btn-outline py-1 px-3 text-xs">Edit</button>
                        <button className="btn btn-outline py-1 px-3 text-xs text-danger-500 border-danger-500 hover:bg-danger-500/10">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <button className="btn btn-primary">
                    <Key className="mr-2 h-4 w-4" />
                    Connect New API Key
                  </button>
                </div>
              </div>
            )}
            
            {activeTab === 'notifications' && (
              <div className="p-6">
                <h2 className="text-lg font-medium mb-6">
                  <FormattedMessage id="settings.notifications" />
                </h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-medium mb-4">Email Notifications</h3>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Bot Activity</p>
                          <p className="text-xs text-dark-400">Get notified when your bots complete trades</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" defaultChecked />
                          <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                        </label>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Market Alerts</p>
                          <p className="text-xs text-dark-400">Get notified about significant market movements</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" defaultChecked />
                          <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                        </label>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Security Alerts</p>
                          <p className="text-xs text-dark-400">Get notified about security events on your account</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" defaultChecked />
                          <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                        </label>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Newsletter</p>
                          <p className="text-xs text-dark-400">Receive our weekly newsletter with updates and tips</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" />
                          <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-dark-700 pt-6">
                    <h3 className="text-base font-medium mb-4">Push Notifications</h3>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Trading Signals</p>
                          <p className="text-xs text-dark-400">Get notified about new trading signals</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" defaultChecked />
                          <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                        </label>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Price Alerts</p>
                          <p className="text-xs text-dark-400">Get notified when prices hit your target levels</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" defaultChecked />
                          <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-dark-700 pt-6">
                    <button className="btn btn-primary">
                      <Save className="mr-2 h-4 w-4" />
                      <FormattedMessage id="settings.saveChanges" />
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'payment' && (
              <div className="p-6">
                <h2 className="text-lg font-medium mb-6">
                  <FormattedMessage id="settings.payment" />
                </h2>
                
                <div className="space-y-6">
                  <p className="text-dark-400">
                    Manage your payment methods for premium subscriptions and marketplace purchases.
                  </p>
                  
                  <div className="card bg-dark-700 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center">
                        <div className="h-10 w-16 bg-dark-600 rounded flex items-center justify-center">
                          <CreditCard className="h-6 w-6 text-dark-300" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium">•••• •••• •••• 4242</p>
                          <p className="text-xs text-dark-400">Visa • Expires 12/2025</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <span className="badge badge-success">Default</span>
                        <button className="btn btn-outline py-1 px-3 text-xs">Edit</button>
                        <button className="btn btn-outline py-1 px-3 text-xs text-danger-500 border-danger-500 hover:bg-danger-500/10">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <button className="btn btn-primary">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Add Payment Method
                  </button>
                  
                  <div className="border-t border-dark-700 pt-6">
                    <h3 className="text-base font-medium mb-4">Billing History</h3>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-dark-700">
                        <thead>
                          <tr>
                            <th className="py-3.5 pl-4 pr-3 text-left text-xs font-medium text-dark-400 sm:pl-0">Date</th>
                            <th className="px-3 py-3.5 text-left text-xs font-medium text-dark-400">Description</th>
                            <th className="px-3 py-3.5 text-right text-xs font-medium text-dark-400">Amount</th>
                            <th className="px-3 py-3.5 text-right text-xs font-medium text-dark-400">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-700">
                          <tr>
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium sm:pl-0">
                              Mar 12, 2023
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              Pro Plan Subscription
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                              <FormattedNumber
                                value={49.99}
                                style="currency"
                                currency="USD"
                              />
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                              <span className="badge badge-success">Paid</span>
                            </td>
                          </tr>
                          <tr>
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium sm:pl-0">
                              Feb 12, 2023
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              Pro Plan Subscription
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                              <FormattedNumber
                                value={49.99}
                                style="currency"
                                currency="USD"
                              />
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                              <span className="badge badge-success">Paid</span>
                            </td>
                          </tr>
                          <tr>
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium sm:pl-0">
                              Jan 25, 2023
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              ETH Breakout Hunter Bot
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                              <FormattedNumber
                                value={59.99}
                                style="currency"
                                currency="USD"
                              />
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                              <span className="badge badge-success">Paid</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}