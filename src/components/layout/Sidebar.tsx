import { Link, useLocation } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Bot,
  Briefcase,
  LayoutDashboard,
  Lock,
  ShoppingBag,
  History,
  X,
  Shield,
  LineChart,
  Users,
  Settings as SettingsIcon,
  Building2,
  Cpu,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { FormattedMessage } from 'react-intl';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const accountStatsItem = { name: "Account Stats", href: '/account-stats', icon: BarChart3 };

// Base navigation - available to all authenticated users
const navigation: any[] = [
  //{ name: <FormattedMessage id="nav.dashboard" />, href: '/', icon: LayoutDashboard },
  //{ name: <FormattedMessage id="nav.marketAnalysis" />, href: '/market', icon: BarChart3 },
  //{ name: <FormattedMessage id="nav.marketplace" />, href: '/marketplace', icon: ShoppingBag },
];

// Authenticated user navigation - only for logged in users
const authenticatedNavigation = [
  //{ name: <FormattedMessage id="nav.tradingBots" />, href: '/bots', icon: Bot },
  //{ name: <FormattedMessage id="nav.portfolio" />, href: '/portfolio', icon: Briefcase },
  { name: <FormattedMessage id="nav.tradingTerminal" />, href: '/terminal', icon: Activity },
  { name: "Config Bot", href: '/config-bot', icon: SettingsIcon },
  { name: "Indicators", href: '/indicators', icon: LineChart },
  { name: "Binance Accounts", href: '/binance-accounts', icon: Building2 },
  { name: <FormattedMessage id="nav.orderHistory" />, href: '/history', icon: History },
  { name: <FormattedMessage id="nav.settings" />, href: '/settings', icon: Lock },
];

// Admin navigation - chỉ hiển thị cho type 1
const adminNavigation = [
  { name: "Admin System", href: '/admin', icon: Shield },
  { name: "Admin Dashboard", href: '/admin/dashboard', icon: LayoutDashboard },
  { name: "Monitoring", href: '/admin/monitoring', icon: Activity },
  { name: "System Stats", href: '/admin/system', icon: Cpu },
  //{ name: "User Management", href: '/admin/users', icon: Users },
  //{ name: "System Settings", href: '/admin/settings', icon: SettingsIcon },
];

// Hàm render nhóm menu
const renderNavSection = (title: string, items: typeof authenticatedNavigation) => (
  <div className="mt-6">
    <p className="text-xs font-semibold text-dark-500 px-3 uppercase tracking-wider mb-2">
      {title}
    </p>
    <div className="space-y-1">
      {items.map((item) => {
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
    </div>
  </div>
);

export default function Sidebar({ open, setOpen }: SidebarProps) {
  const location = useLocation();
  const { user, isGuestMode, isAuthenticated } = useAuth();

  let finalNavigation = [...navigation];
  const userNavItems: any[] = [];
  const adminNavItems: any[] = [];

  if (isAuthenticated && user) {
    // Add authenticated user navigation
    userNavItems.push(...authenticatedNavigation);
    // Chỉ thêm AccountStats 1 lần dựa vào quyền
    if ([0, 1, 2, 99].includes(user.type)) {
      userNavItems.push(accountStatsItem);
    }

    // Type 1 (Admin) - có quyền cao nhất, thấy tất cả
    if ([1, 2, 99].includes(user.type)) {
      adminNavItems.push(...adminNavigation);
    }

    // Type 3 (User) - chỉ thấy navigation cơ bản + authenticated navigation
  } else if (isGuestMode) {
    // Guest mode - chỉ có basic navigation
    finalNavigation = navigation;
  }

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
                TW
              </div>
              {/*<span className="text-lg font-semibold">TW</span>*/}
            </div>
          </Link>
          <button
            className="text-dark-400 hover:text-dark-200"
            onClick={() => setOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="mt-4 px-2">
          {isAuthenticated && user && (
            <>
              {renderNavSection("User Navigation", userNavItems)}
              {adminNavItems.length > 0 && renderNavSection("Admin Panel", adminNavItems)}
            </>
          )}
        </nav>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-dark-700 lg:bg-dark-800">
        <div className="flex h-16 items-center justify-center border-b border-dark-700">
          <Link to="/" className="flex items-center">
            <div className="flex items-center gap-x-2">
              <div className="h-8 w-8 rounded-md bg-gradient-to-tr from-primary-600 to-primary-500 flex items-center justify-center text-white font-bold">
                TW
              </div>
              {/*<span className="text-lg font-semibold">3Commas</span>*/}
            </div>
          </Link>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto">
          <nav className="mt-4 px-3">
            {isAuthenticated && user && (
              <>
                {renderNavSection("User Navigation", userNavItems)}
                {adminNavItems.length > 0 && renderNavSection("Admin Panel", adminNavItems)}
              </>
            )}
          </nav>

          {/* User info section */}
          <div className="mt-auto p-4">
            {isAuthenticated && user && (
              <div className="mb-4 p-3 bg-dark-700/50 rounded-lg">
                <div className="flex items-center gap-x-3">
                  <div className="h-10 w-10 rounded-full bg-dark-600 flex items-center justify-center">
                    <span className="text-sm font-medium">{user.username?.[0]?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dark-200 truncate">{user.username}</p>
                    <p className="text-xs text-dark-400">
                      {user.type === 1
                        ? 'Admin'
                        : [2, 99].includes(user.type)
                        ? 'SuperAdmin'
                        : 'User'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isGuestMode && (
              <div className="mb-4 p-3 bg-warning-300/10 rounded-lg border border-warning-300/20">
                <div className="flex items-center gap-x-3">
                  <div className="h-10 w-10 rounded-full bg-warning-300/20 flex items-center justify-center">
                    <span className="text-sm font-medium text-warning-300">G</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-warning-300">Guest Mode</p>
                    <p className="text-xs text-warning-300/80">Limited Access</p>
                  </div>
                </div>
              </div>
            )}

            {/* <div className="rounded-md bg-dark-700/50 p-3">
              <div className="flex items-center gap-x-3">
                <div className="h-10 w-10 rounded-md bg-dark-600 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary-500" />
                </div>
                <div>
                  <p className="text-xs font-medium text-dark-300">
                    {isAuthenticated ? 'Upgrade to Pro' : 'Sign up for Pro'}
                  </p>
                  <p className="text-xs text-dark-400">
                    {isAuthenticated ? 'Get advanced features' : 'Get full access'}
                  </p>
                </div>
              </div>
              <button className="mt-3 w-full rounded-md bg-primary-500 py-1.5 text-xs font-medium text-white hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-800">
                {isAuthenticated ? 'Upgrade Now' : 'Sign Up'}
              </button>
            </div> */}
          </div>
        </div>
      </div>
    </>
  );
}
