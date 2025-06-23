import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, User, Lock, ArrowRight, AlertCircle, Home, Info, RefreshCw, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FormattedMessage, useIntl } from 'react-intl';
import { ApiError, API_BASE_URL } from '../utils/api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showApiInfo, setShowApiInfo] = useState(false);
  
  const { login, enterGuestMode } = useAuth();
  const navigate = useNavigate();
  const intl = useIntl();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login(username, password,rememberMe);
      
      // Lưu remember me preference
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('savedUsername', username);
      } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('savedUsername');
      }
      
      navigate('/');
    } catch (err) {
      console.error('Login error:', err);
      
      if (err instanceof ApiError) {
        // Xử lý các loại lỗi khác nhau từ API
        switch (err.status) {
          case 0:
            // Network/connection error - show detailed error message
            setError(err.message);
            setShowApiInfo(true);
            break;
          case 401:
            setError('Tên đăng nhập hoặc mật khẩu không đúng');
            break;
          case 403:
            setError('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ admin.');
            break;
          case 429:
            setError('Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau.');
            break;
          default:
            setError(err.message || 'Đăng nhập thất bại');
        }
      } else {
        setError('Đăng nhập thất bại. Vui lòng thử lại.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestMode = () => {
    enterGuestMode();
    navigate('/guest');
  };

  const handleQuickLogin = (testUsername: string, testPassword: string) => {
    setUsername(testUsername);
    setPassword(testPassword);
  };

  const handleRetry = () => {
    setError('');
    setShowApiInfo(false);
  };

  // Load saved username on component mount
  React.useEffect(() => {
    const savedUsername = localStorage.getItem('savedUsername');
    const rememberMeEnabled = localStorage.getItem('rememberMe') === 'true';
    
    if (rememberMeEnabled && savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-success-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Guest Mode button */}
      <button
        onClick={handleGuestMode}
        className="absolute top-6 left-6 flex items-center gap-2 text-dark-400 hover:text-dark-200 transition-colors"
      >
        <Home className="h-5 w-5" />
        <span className="text-sm">
          <FormattedMessage id="auth.guestMode" />
        </span>
      </button>

      <div className="relative w-full max-w-md">
        {/* Development Helper - Only show in development mode */}
        {import.meta.env.DEV && (
          <div className="mb-6 p-4 bg-info-500/10 border border-info-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Info className="h-4 w-4 text-info-500" />
              <span className="text-sm font-medium text-info-500">Development Mode - Test Credentials</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleQuickLogin('admin123', 'password')}
                  className="px-2 py-1 bg-primary-500/20 text-primary-400 rounded text-left hover:bg-primary-500/30 transition-colors"
                >
                  <div className="font-medium">Admin</div>
                  <div className="opacity-75">admin123</div>
                </button>
                <button
                  onClick={() => handleQuickLogin('super', 'password')}
                  className="px-2 py-1 bg-warning-500/20 text-warning-400 rounded text-left hover:bg-warning-500/30 transition-colors"
                >
                  <div className="font-medium">Super</div>
                  <div className="opacity-75">super</div>
                </button>
                <button
                  onClick={() => handleQuickLogin('trdung0107', 'limlim0107')}
                  className="px-2 py-1 bg-success-500/20 text-success-400 rounded text-left hover:bg-success-500/30 transition-colors"
                >
                  <div className="font-medium">User</div>
                  <div className="opacity-75">user</div>
                </button>
              </div>
              <p className="text-dark-400 text-center">Click any credential above to auto-fill the form</p>
            </div>
          </div>
        )}

        {/* API Connection Info - Show when there's a connection error */}
        {showApiInfo && (
          <div className="mb-6 p-4 bg-warning-500/10 border border-warning-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-warning-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-warning-500 mb-2">API Connection Issue</h3>
                <div className="text-xs text-warning-400 space-y-2">
                  <p><strong>Current API URL:</strong> {API_BASE_URL}</p>
                  <div className="bg-dark-800/50 p-2 rounded text-xs">
                    <p className="mb-1"><strong>To fix this:</strong></p>
                    <ol className="list-decimal list-inside space-y-1 text-warning-300">
                      <li>Make sure your backend server is running</li>
                      <li>If using ngrok, get a new URL and update .env file</li>
                      <li>Restart the frontend server after updating .env</li>
                    </ol>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleRetry}
                      className="flex items-center gap-1 px-2 py-1 bg-warning-500/20 text-warning-400 rounded text-xs hover:bg-warning-500/30 transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Retry
                    </button>
                    <a
                      href={API_BASE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1 bg-info-500/20 text-info-400 rounded text-xs hover:bg-info-500/30 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Test API
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-primary-600 to-primary-500 rounded-2xl mb-4">
            <span className="text-2xl font-bold text-white">TW</span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-dark-300 bg-clip-text text-transparent">
            <FormattedMessage id="auth.welcome" />
          </h1>
          <p className="text-dark-400 mt-2">
            <FormattedMessage id="auth.loginSubtitle" />
          </p>
        </div>

        {/* Login Form */}
        <div className="card p-8 backdrop-blur-sm bg-dark-800/80 border border-dark-700/50">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-start gap-3 p-4 bg-danger-500/10 border border-danger-500/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-danger-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-danger-500 whitespace-pre-line">{error}</p>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="username" className="form-label">
                Tên đăng nhập
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-dark-400" />
                </div>
                <input
                  id="username"
                  type="text"
                  required
                  className="form-input pl-12 h-12 text-white placeholder:text-dark-400"
                  placeholder="Nhập tên đăng nhập"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="form-label">
                <FormattedMessage id="auth.password" />
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-dark-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="form-input pl-10 pr-10 h-12"
                  placeholder={intl.formatMessage({ id: 'auth.passwordPlaceholder' })}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-dark-400 hover:text-dark-300" />
                  ) : (
                    <Eye className="h-5 w-5 text-dark-400 hover:text-dark-300" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  className="form-checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <label htmlFor="remember-me" className="ml-2 text-sm text-dark-300">
                  <FormattedMessage id="auth.rememberMe" />
                </label>
              </div>
              <Link
                to="/forgot-password"
                className="text-sm text-primary-500 hover:text-primary-400 transition-colors"
              >
                <FormattedMessage id="auth.forgotPassword" />
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn btn-primary py-3 text-base font-medium relative overflow-hidden group"
            >
              <span className="relative z-10 flex items-center justify-center">
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <FormattedMessage id="auth.signIn" />
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-primary-600 to-primary-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-dark-400">
              <FormattedMessage id="auth.noAccount" />{' '}
              <Link
                to="/register"
                className="text-primary-500 hover:text-primary-400 font-medium transition-colors"
              >
                <FormattedMessage id="auth.signUp" />
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-dark-500">
          <FormattedMessage id="auth.termsText" />{' '}
          <a href="#" className="text-primary-500 hover:text-primary-400">
            <FormattedMessage id="auth.terms" />
          </a>{' '}
          <FormattedMessage id="auth.and" />{' '}
          <a href="#" className="text-primary-500 hover:text-primary-400">
            <FormattedMessage id="auth.privacy" />
          </a>
        </div>
      </div>
    </div>
  );
}