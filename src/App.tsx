import { Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Bots from './pages/Bots';
import Portfolio from './pages/Portfolio';
import TradingTerminal from './pages/TradingTerminal';
import MarketAnalysis from './pages/MarketAnalysis';
import Marketplace from './pages/Marketplace';
import NotFound from './pages/NotFound';
import Settings from './pages/Settings';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="bots" element={<Bots />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="terminal" element={<TradingTerminal />} />
            <Route path="market" element={<MarketAnalysis />} />
            <Route path="marketplace" element={<Marketplace />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;