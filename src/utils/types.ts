import { CandlestickData } from 'lightweight-charts';

export interface ExtendedCandle extends CandlestickData {
  volume: number;
}
export interface Order {
  orderId: number;
  symbol: string;
  side: string;
  type: string;
  price: string;
  origQty: string;
  status: string;
  timeInForce: string;
}

export interface BinanceAccount {
  id: number;
  Name?: string;
  status?: number;
  description?: string;
}
export interface Position {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unrealizedProfit: string;
  margin: string;
}
export interface User {
  id: number;
  username: string;
  email: string;
  type: number;
  status?: number;
  binanceAccountId?: number;
  internalAccountId: number;
}

export type PositionData = {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice?: string;
  leverage?: number;
};

export type FloatingInfo = {
  symbol: string;
  pnl: number;
  roi: number;
  price: number;
  positionAmt: number;
};

// ==================== PnL Types ====================

export interface DailyPnLResponse {
  binanceAccountId: number;
  date: string;
  dailyStartBalance: number;
  currentBalance: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  isProfit: boolean;
  peakBalance: number;
  minBalance: number;
  drawdown: number;
  drawdownPercent: number;
  snapshotCount: number;
  lastUpdate: string;
}

export interface WeeklyPnLSummary {
  binanceAccountId: number;
  startDate: string;
  endDate: string;
  startBalance: number;
  endBalance: number;
  weeklyPnl: number;
  weeklyPnlPercent: number;
  totalDays: number;
  profitDays: number;
  lossDays: number;
  avgDailyPnl: number;
  bestDay: { date: string; pnl: number; pnlPercent: number };
  worstDay: { date: string; pnl: number; pnlPercent: number };
  maxDrawdown: number;
  maxDrawdownPercent: number;
  totalSnapshots: number;
}

export interface WeeklyPnLDaily {
  date: string;
  startBalance: number;
  endBalance: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  peakBalance: number;
  minBalance: number;
  snapshotCount: number;
}

export interface WeeklyPnLResponse {
  summary: WeeklyPnLSummary;
  daily: WeeklyPnLDaily[];
}

export interface SymbolHistory {
  symbol: string;
  orderCount: number;
  buyCount: number;
  sellCount: number;
  longCount: number;
  shortCount: number;
  firstTrade: string;
  lastTrade: string;
}

export interface SymbolsHistoryResponse {
  symbols: SymbolHistory[];
  totalOrders: number;
  uniqueSymbols: number;
  dateRange: {
    start: string | null;
    end: string | null;
  };
}