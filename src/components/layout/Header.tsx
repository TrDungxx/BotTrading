import { Bell, Settings, ChevronDown, Languages, LogIn } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
}

export default function Header({ setSidebarOpen }: HeaderProps) {
  const { user, logout, isGuestMode, exitGuestMode } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const intl = useIntl();
  
  const toggleUserMenu = () => {
    setUserMenuOpen(!userMenuOpen);
    if (notificationsOpen) setNotificationsOpen(false);
    if (languageMenuOpen) setLanguageMenuOpen(false);
  };
  
  const toggleNotifications = () => {
    setNotificationsOpen(!notificationsOpen);
    if (userMenuOpen) setUserMenuOpen(false);
    if (languageMenuOpen) setLanguageMenuOpen(false);
  };

  const toggleLanguageMenu = () => {
    setLanguageMenuOpen(!languageMenuOpen);
    if (userMenuOpen) setUserMenuOpen(false);
    if (notificationsOpen) setNotificationsOpen(false);
  };

  const handleLogout = () => {
    if (isGuestMode) {
      exitGuestMode();
    } else {
      logout();
    }
  };
  
  return (
    <header className="fixed top-0 right-0 left-0 z-50 bg-dark-800 border-b border-dark-700 lg:left-64 shadow-lg">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          className="lg:hidden text-dark-400 hover:text-dark-200"
          onClick={() => setSidebarOpen(true)}
        >
          <span className="sr-only">
            <FormattedMessage id="header.openSidebar" />
          </span>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        
        <div className="flex flex-1 justify-end items-center gap-x-4">
          {/* Guest Mode Banner */}
          {isGuestMode && (
            <div className="hidden md:flex items-center bg-warning-300/10 border border-warning-300/20 rounded-lg px-3 py-1">
              <span className="text-xs text-warning-300">Guest Mode</span>
            </div>
          )}

          {/* Language Switcher */}
          <div className="relative">
            <button
              onClick={toggleLanguageMenu}
              className="flex items-center text-dark-400 hover:text-dark-200 focus:outline-none"
            >
              <Languages className="h-5 w-5" />
              <span className="ml-2">{language.toUpperCase()}</span>
            </button>
            
            {languageMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-dark-800 shadow-lg ring-1 ring-dark-700 focus:outline-none">
                <div className="py-1">
                  <button
                    onClick={() => {
                      setLanguage('en');
                      setLanguageMenuOpen(false);
                    }}
                    className={`block w-full text-left px-4 py-2 text-sm ${
                      language === 'en' ? 'bg-primary-500/10 text-primary-500' : 'text-dark-300 hover:bg-dark-700'
                    }`}
                  >
                    <FormattedMessage id="header.english" />
                  </button>
                  <button
                    onClick={() => {
                      setLanguage('vi');
                      setLanguageMenuOpen(false);
                    }}
                    className={`block w-full text-left px-4 py-2 text-sm ${
                      language === 'vi' ? 'bg-primary-500/10 text-primary-500' : 'text-dark-300 hover:bg-dark-700'
                    }`}
                  >
                    <FormattedMessage id="header.vietnamese" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Notifications - only show if authenticated */}
          {!isGuestMode && (
            <div className="relative">
              <button
                onClick={toggleNotifications}
                className="flex items-center text-dark-400 hover:text-dark-200 focus:outline-none"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-primary-500"></span>
              </button>
              
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 origin-top-right rounded-md bg-dark-800 shadow-lg ring-1 ring-dark-700 focus:outline-none z-10">
                  <div className="p-3 border-b border-dark-700">
                    <h3 className="text-sm font-medium">
                      <FormattedMessage id="header.notifications" />
                    </h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <div className="py-2 px-3 hover:bg-dark-700 cursor-pointer">
                      <p className="text-sm font-medium">
                        <FormattedMessage 
                          id="header.notification.botTrade"
                          values={{ botName: "BTC Scalper" }}
                        />
                      </p>
                      <p className="text-xs text-dark-400 mt-0.5">
                        <FormattedMessage id="header.notification.fiveMinutes" />
                      </p>
                    </div>
                    <div className="py-2 px-3 hover:bg-dark-700 cursor-pointer">
                      <p className="text-sm font-medium">
                        <FormattedMessage 
                          id="header.notification.signal"
                          values={{ pair: "BTC/USDT" }}
                        />
                      </p>
                      <p className="text-xs text-dark-400 mt-0.5">
                        <FormattedMessage id="header.notification.oneHour" />
                      </p>
                    </div>
                    <div className="py-2 px-3 hover:bg-dark-700 cursor-pointer">
                      <p className="text-sm font-medium">
                        <FormattedMessage 
                          id="header.notification.portfolioIncrease"
                          values={{ percent: "2.5" }}
                        />
                      </p>
                      <p className="text-xs text-dark-400 mt-0.5">
                        <FormattedMessage id="header.notification.fourHours" />
                      </p>
                    </div>
                  </div>
                  <div className="p-2 border-t border-dark-700">
                    <button className="w-full text-center text-xs text-primary-500 hover:text-primary-400">
                      <FormattedMessage id="header.viewAllNotifications" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* User menu or Login button */}
          <div className="relative">
            {isGuestMode ? (
              <Link
                to="/login"
                className="flex items-center gap-x-2 btn btn-primary py-2 px-4 text-sm"
              >
                <LogIn className="h-4 w-4" />
                <FormattedMessage id="auth.signIn" />
              </Link>
            ) : (
              <>
                <button
                  onClick={toggleUserMenu}
                  className="flex items-center gap-x-2 rounded-full focus:outline-none"
                >
                  <img
                    src={user?.avatar || "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150"}
                    alt={intl.formatMessage({ id: "header.userAvatar" })}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <span className="hidden md:flex items-center gap-x-1 text-sm">
                    {user?.name || <FormattedMessage id="header.user" />}
                    <ChevronDown className="h-4 w-4 text-dark-400" />
                  </span>
                </button>
                
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-dark-800 shadow-lg ring-1 ring-dark-700 focus:outline-none z-10">
                    <div className="py-1">
                      <a href="/settings" className="block px-4 py-2 text-sm hover:bg-dark-700">
                        <div className="flex items-center gap-x-2">
                          <Settings className="h-4 w-4" />
                          <FormattedMessage id="nav.settings" />
                        </div>
                      </a>
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm hover:bg-dark-700 text-danger-500"
                      >
                        <FormattedMessage id="header.signOut" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}