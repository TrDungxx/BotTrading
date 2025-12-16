import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Bot,
  LayoutDashboard,
  Lock,
  History,
  X,
  Shield,
  LineChart,
  Settings as SettingsIcon,
  Building2,
  Atom,
  Cpu,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { FormattedMessage } from 'react-intl';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const accountStatsItem = { name: "Account Stats", href: '/account-stats', icon: BarChart3 };

const navigation: any[] = [];

const authenticatedNavigation = [
  { name: <FormattedMessage id="nav.tradingTerminal" />, href: '/terminal', icon: Activity },
  { name: "Config Bot", href: '/config-bot', icon: SettingsIcon },
  { name: "BOT", href: '/bots/new', icon: Bot },
  { name: "Indicators", href: '/indicators', icon: LineChart },
  { name: "Binance Accounts", href: '/binance-accounts', icon: Building2 },
  { name: <FormattedMessage id="nav.orderHistory" />, href: '/history', icon: History },
  { name: <FormattedMessage id="nav.settings" />, href: '/settings', icon: Lock },
];

const adminNavigation = [
  { name: "Admin System", href: '/admin', icon: Shield },
  { name: "Admin Dashboard", href: '/admin/dashboard', icon: LayoutDashboard },
  { name: "Terminal Indicator", href: '/admin/terminalindicator', icon: Atom },
  { name: "Monitoring", href: '/admin/monitoring', icon: Activity },
  { name: "System Stats", href: '/admin/system', icon: Cpu },
];

// Export để các component khác có thể dùng
// Values sync với sidebar.css breakpoints
export const SIDEBAR_WIDTH = {
  collapsed: 60,   // Sync với sidebar.css
  expanded: 270,   // Sync với sidebar.css
};

export default function Sidebar({ open, setOpen }: SidebarProps) {
  const location = useLocation();
  const { user, isGuestMode, isAuthenticated } = useAuth();
  
  // Desktop expanded state - lưu vào localStorage
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebar-expanded');
    return saved ? JSON.parse(saved) : true; // Default expanded
  });

  // Lưu state và dispatch event khi thay đổi
  useEffect(() => {
    localStorage.setItem('sidebar-expanded', JSON.stringify(isExpanded));
    window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: { isExpanded } }));
  }, [isExpanded]);

  // Dispatch initial state on mount
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: { isExpanded } }));
  }, []);

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };
 useEffect(() => {
  const updateBodyClass = () => {
    // Chỉ thực sự expanded khi:
    // 1. State isExpanded = true
    // 2. VÀ viewport >= 1280px (sync với sidebar.css breakpoint)
    const isDesktop = window.innerWidth >= 1280;
    const actuallyExpanded = isExpanded && isDesktop;
    
    if (actuallyExpanded) {
      document.body.classList.add('sidebar-expanded');
      document.body.classList.remove('sidebar-collapsed');
    } else {
      document.body.classList.add('sidebar-collapsed');
      document.body.classList.remove('sidebar-expanded');
    }
  };

  updateBodyClass();
  window.addEventListener('resize', updateBodyClass);
  
  return () => {
    window.removeEventListener('resize', updateBodyClass);
  };
}, [isExpanded]);

  let finalNavigation = [...navigation];
  const userNavItems: any[] = [];
  const adminNavItems: any[] = [];

  if (isAuthenticated && user) {
    userNavItems.push(...authenticatedNavigation);
    if ([0, 1, 2, 99].includes(user.type)) {
      userNavItems.push(accountStatsItem);
    }
    if ([1, 2, 99].includes(user.type)) {
      adminNavItems.push(...adminNavigation);
    }
  } else if (isGuestMode) {
    finalNavigation = navigation;
  }

  const renderNavSection = (title: string, items: typeof authenticatedNavigation) => (
    <div className="mt-4">
      {/* Section title - chỉ hiện khi expanded */}
      <p className={cn(
        "text-fluid-sm font-semibold text-dark-500 uppercase tracking-wider mb-2 transition-all duration-200 whitespace-nowrap overflow-hidden",
        isExpanded ? "opacity-100 px-fluid-3" : "opacity-0 px-0 h-0 mb-0"
      )}>
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
                "group flex items-center rounded-fluid-md text-fluid-sm font-medium transition-all duration-200",
                isExpanded ? "gap-x-3 px-fluid-3 py-2" : "justify-center px-2 py-2.5",
                isActive
                  ? "bg-primary-500/10 text-primary-500"
                  : "text-dark-300 hover:bg-dark-700/50 hover:text-dark-200"
              )}
              title={!isExpanded ? (typeof item.name === 'string' ? item.name : '') : undefined}
            >
              <item.icon
                className={cn(
                  "flex-shrink-0 transition-all duration-200 h-5 w-5",
                  isActive ? "text-primary-500" : "text-dark-400 group-hover:text-dark-300"
                )}
              />
              <span className={cn(
                "whitespace-nowrap transition-all duration-200 overflow-hidden",
                isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"
              )}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );

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

      {/* Mobile sidebar - full width */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform overflow-y-auto bg-dark-800 transition duration-300 ease-in-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-fluid-4 border-b border-dark-700">
          <Link to="/" className="flex items-center">
            <div className="flex items-center gap-x-2">
              <div className="h-fluid-input-sm w-8 rounded-fluid-md bg-gradient-to-tr from-primary-600 to-primary-500 flex items-center justify-center text-white font-bold">
                TW
              </div>
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
              <div className="mt-4">
                <p className="text-fluid-sm font-semibold text-dark-500 px-fluid-3 uppercase tracking-wider mb-2">
                  User Navigation
                </p>
                <div className="space-y-1">
                  {userNavItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                          "group flex items-center gap-x-3 rounded-fluid-md px-fluid-3 py-2 text-fluid-sm font-medium",
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
              {adminNavItems.length > 0 && (
                <div className="mt-4">
                  <p className="text-fluid-sm font-semibold text-dark-500 px-fluid-3 uppercase tracking-wider mb-2">
                    Admin Panel
                  </p>
                  <div className="space-y-1">
                    {adminNavItems.map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          to={item.href}
                          className={cn(
                            "group flex items-center gap-x-3 rounded-fluid-md px-fluid-3 py-2 text-fluid-sm font-medium",
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
              )}
            </>
          )}
        </nav>
      </div>

      {/* Desktop sidebar - Click to toggle */}
      <div
        className={cn(
          "sidebar-wrapper hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col lg:bg-dark-800 transition-all duration-300 ease-in-out lg:z-30 lg:border-r lg:border-dark-700",
          isExpanded ? "" : "collapsed"
        )}
      >
        {/* Logo - căn giữa */}
        <div className="flex h-16 items-center justify-center border-b border-dark-700 px-fluid-3">
          <Link to="/" className="flex items-center">
            <div className="h-fluid-input-sm w-8 rounded-fluid-md bg-gradient-to-tr from-primary-600 to-primary-500 flex items-center justify-center text-white font-bold flex-shrink-0">
              TW
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
          <nav className={cn(
            "mt-2 transition-all duration-200",
            isExpanded ? "px-fluid-3" : "px-2"
          )}>
            {isAuthenticated && user && (
              <>
                {renderNavSection("User Navigation", userNavItems)}
                {adminNavItems.length > 0 && renderNavSection("Admin Panel", adminNavItems)}
              </>
            )}
          </nav>

          {/* User info section */}
          <div className="mt-auto p-fluid-2">
            {isAuthenticated && user && (
              <div className={cn(
                "bg-dark-700/50 rounded-lg transition-all duration-200",
                isExpanded ? "p-fluid-3" : "p-fluid-2"
              )}>
                <div className={cn(
                  "flex items-center",
                  isExpanded ? "gap-x-3" : "justify-center"
                )}>
                  <div className="h-fluid-input w-10 rounded-full bg-dark-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-fluid-sm font-medium">{user.username?.[0]?.toUpperCase()}</span>
                  </div>
                  <div className={cn(
                    "flex-1 min-w-0 transition-all duration-200 overflow-hidden",
                    isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"
                  )}>
                    <p className="text-fluid-sm font-medium text-dark-200 truncate">{user.username}</p>
                    <p className="text-fluid-sm text-dark-400">
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
              <div className={cn(
                "bg-warning-300/10 rounded-lg border border-warning-300/20 transition-all duration-200",
                isExpanded ? "p-fluid-3" : "p-fluid-2"
              )}>
                <div className={cn(
                  "flex items-center",
                  isExpanded ? "gap-x-3" : "justify-center"
                )}>
                  <div className="h-fluid-input w-10 rounded-full bg-warning-300/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-fluid-sm font-medium text-warning-300">G</span>
                  </div>
                  <div className={cn(
                    "flex-1 min-w-0 transition-all duration-200 overflow-hidden",
                    isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"
                  )}>
                    <p className="text-fluid-sm font-medium text-warning-300">Guest Mode</p>
                    <p className="text-fluid-sm text-warning-300/80">Limited Access</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Toggle button - nằm ở cạnh sidebar */}
        <button
          onClick={toggleSidebar}
          className={cn(
            "absolute top-1/2 -right-3 transform -translate-y-1/2 transition-all duration-200",
            "h-6 w-6 rounded-full bg-dark-700 border border-dark-600 flex items-center justify-center",
            "hover:bg-dark-600 cursor-pointer z-50"
          )}
          title={isExpanded ? "Thu gọn sidebar" : "Mở rộng sidebar"}
        >
          {isExpanded ? (
            <ChevronLeft className="h-3 w-3 text-dark-400" />
          ) : (
            <ChevronRight className="h-3 w-3 text-dark-400" />
          )}
        </button>
      </div>
    </>
  );
}