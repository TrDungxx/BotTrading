import { Menu, Bell, Settings, LogOut, User } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
  sidebarExpanded?: boolean;
}

export default function Header({ setSidebarOpen, sidebarExpanded = true }: HeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header 
      className={cn(
        "fixed top-0 right-0 z-40 flex h-14 md:h-16 items-center gap-x-4 border-b border-dark-700 bg-dark-800 px-4 shadow-sm transition-all duration-300",
        // Left offset theo sidebar state (chỉ trên desktop)
        sidebarExpanded ? "lg:left-64" : "lg:left-16",
        // Mobile: full width
        "left-0"
      )}
    >
      {/* Mobile menu button */}
      <button
        type="button"
        className="lg:hidden -m-2.5 p-2.5 text-dark-400 hover:text-dark-200"
        onClick={() => setSidebarOpen(true)}
      >
        <span className="sr-only">Open sidebar</span>
        <Menu className="h-6 w-6" />
      </button>

      {/* Separator on mobile */}
      <div className="h-6 w-px bg-dark-700 lg:hidden" />

      {/* Right side */}
      <div className="flex flex-1 gap-x-4 items-center justify-end">
        {/* Notifications */}
        <button
          type="button"
          className="p-2 text-dark-400 hover:text-dark-200 hover:bg-dark-700 rounded-md transition-colors"
        >
          <span className="sr-only">View notifications</span>
          <Bell className="h-5 w-5" />
        </button>

        {/* Settings */}
        <Link
          to="/settings"
          className="p-2 text-dark-400 hover:text-dark-200 hover:bg-dark-700 rounded-md transition-colors"
        >
          <span className="sr-only">Settings</span>
          <Settings className="h-5 w-5" />
        </Link>

        {/* User dropdown */}
        <div className="flex items-center gap-x-3">
          <div className="hidden sm:flex sm:flex-col sm:items-end">
            <span className="text-sm font-medium text-dark-200">
              {user?.username || 'User'}
            </span>
            <span className="text-xs text-dark-400">
              {user?.type === 1 ? 'Admin' : [2, 99].includes(user?.type || 0) ? 'SuperAdmin' : 'User'}
            </span>
          </div>
          
          <div className="h-8 w-8 rounded-full bg-dark-600 flex items-center justify-center">
            <User className="h-4 w-4 text-dark-300" />
          </div>

          <button
            onClick={logout}
            className="p-2 text-dark-400 hover:text-danger-400 hover:bg-dark-700 rounded-md transition-colors"
            title="Logout"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}