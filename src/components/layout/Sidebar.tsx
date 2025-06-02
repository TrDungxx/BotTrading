import { Link, useLocation } from 'react-router-dom';
import { Activity, BarChart3, Bot, Briefcase, LayoutDashboard, Lock, ShoppingBag, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { FormattedMessage } from 'react-intl';

interface SidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const navigation = [
  { name: <FormattedMessage id="nav.dashboard" />, href: '/', icon: LayoutDashboard },
  { name: <FormattedMessage id="nav.tradingBots" />, href: '/bots', icon: Bot },
  { name: <FormattedMessage id="nav.portfolio" />, href: '/portfolio', icon: Briefcase },
  { name: <FormattedMessage id="nav.tradingTerminal" />, href: '/terminal', icon: Activity },
  { name: <FormattedMessage id="nav.marketAnalysis" />, href: '/market', icon: BarChart3 },
  { name: <FormattedMessage id="nav.marketplace" />, href: '/marketplace', icon: ShoppingBag },
  { name: <FormattedMessage id="nav.settings" />, href: '/settings', icon: Lock },
];

export default function Sidebar({ open, setOpen }: SidebarProps) {
  const location = useLocation();
  
  return (
    <>
      {/* Mobile sidebar overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-dark-900/80 lg:hidden",
          open ? "block" : "hidden"
        )}
        onClick={() => setOpen(false)}
      />
      
      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform overflow-y-auto bg-dark-800 transition duration-300 ease-in-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-dark-700">
          <Link to="/" className="flex items-center">
            <div className="flex items-center gap-x-2">
              <div className="h-8 w-8 rounded-md bg-gradient-to-tr from-primary-600 to-primary-500 flex items-center justify-center text-white font-bold">
                3C
              </div>
              <span className="text-lg font-semibold">3Commas</span>
            </div>
          </Link>
          <button
            className="text-dark-400 hover:text-dark-200"
            onClick={() => setOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <nav className="mt-4 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "group flex items-center gap-x-3 rounded-md px-3 py-2 text-sm font-medium",
                  isActive
                    ? "bg-primary-500/10 text-primary-500"
                    : "text-dark-300 hover:bg-dark-700/50 hover:text-dark-200"
                )}
                onClick={() => setOpen(false)}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 flex-shrink-0",
                    isActive ? "text-primary-500" : "text-dark-400 group-hover:text-dark-300"
                  )}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-dark-700 lg:bg-dark-800">
        <div className="flex h-16 items-center justify-center border-b border-dark-700">
          <Link to="/" className="flex items-center">
            <div className="flex items-center gap-x-2">
              <div className="h-8 w-8 rounded-md bg-gradient-to-tr from-primary-600 to-primary-500 flex items-center justify-center text-white font-bold">
                3C
              </div>
              <span className="text-lg font-semibold">3Commas</span>
            </div>
          </Link>
        </div>
        
        <div className="flex flex-1 flex-col overflow-y-auto">
          <nav className="mt-4 px-3 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "group flex items-center gap-x-3 rounded-md px-3 py-2 text-sm font-medium",
                    isActive
                      ? "bg-primary-500/10 text-primary-500"
                      : "text-dark-300 hover:bg-dark-700/50 hover:text-dark-200"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 flex-shrink-0",
                      isActive ? "text-primary-500" : "text-dark-400 group-hover:text-dark-300"
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          
          <div className="mt-auto p-4">
            <div className="rounded-md bg-dark-700/50 p-3">
              <div className="flex items-center gap-x-3">
                <div className="h-10 w-10 rounded-full bg-dark-600 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary-500" />
                </div>
                <div>
                  <p className="text-xs font-medium text-dark-300">Upgrade to Pro</p>
                  <p className="text-xs text-dark-400">Get advanced features</p>
                </div>
              </div>
              <button className="mt-3 w-full rounded-md bg-primary-500 py-1.5 text-xs font-medium text-white hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-800">
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}