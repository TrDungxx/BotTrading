import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Bots from './pages/Bots';
import Portfolio from './pages/Portfolio';
import TradingTerminal from './pages/TradingTerminal';
import MarketAnalysis from './pages/MarketAnalysis';
import Marketplace from './pages/Marketplace';
import NotFound from './pages/NotFound';
import Settings from './pages/user/Settings';
import OrderHistory from './pages/user/OrderHistory';
import AdminSystem from './pages/admin/AdminSystem';
import Indicators from './pages/user/Indicators';
import BinanceAccounts from './pages/user/BinanceAccounts';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import CreateAdmin from './pages/CreateAdmin';
import GuestLayout from './components/layout/GuestLayout';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ConfigBot from './pages/user/ConfigBot';
import MonitoringSystem from './pages/admin/MonitoringSystem';
import AdminDashBoard from './pages/admin/AdminDashboard';
import AccountStats from './pages/user/AccountStats';
import SystemStats from './pages/admin/SystemStats';
import DCABot from './pages/user/DCABot';
import TerminalIndicatorLayout from './pages/admin/TerminalIndicator';
function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Routes>
          {/* Public auth routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/create-admin" element={<CreateAdmin />} />

          {/* Guest mode routes - limited access */}
          <Route path="/guest" element={<GuestLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="market" element={<MarketAnalysis />} />
            <Route path="marketplace" element={<Marketplace />} />
          </Route>

          {/* Protected routes - require full authentication */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >

            <Route index element={<Dashboard />} />
            <Route path="bots" element={<Bots />} />
            <Route path="bots/new" element={<DCABot />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="terminal" element={<TradingTerminal />} />
            <Route path="market" element={<MarketAnalysis />} />
            <Route path="marketplace" element={<Marketplace />} />
            <Route path="settings" element={<Settings />} />
            <Route path="history" element={<OrderHistory />} />
            <Route path="indicators" element={<Indicators />} />
            <Route path="binance-accounts" element={<BinanceAccounts />} />

            <Route
              path="account-stats"
              element={
                <ProtectedRoute>
                  <AccountStats />
                </ProtectedRoute>
              }
            />
            {/* Admin routes - chỉ type 1 mới truy cập được */}
            <Route path="admin" element={<AdminSystem />} />
            <Route path="admin/terminalindicator" element={<TerminalIndicatorLayout />} />
            <Route path="admin/users" element={<AdminSystem />} />
            <Route path="admin/settings" element={<AdminSystem />} />
            <Route path="admin/monitoring" element={<MonitoringSystem />} />
            <Route path="admin/dashboard" element={<AdminDashBoard />} />
            <Route path="config-bot" element={<ConfigBot />} />
            <Route path="admin/system" element={<SystemStats/>}/>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;