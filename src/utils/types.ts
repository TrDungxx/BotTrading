
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
  binanceAccountId?: number; // ✅ thêm dòng này
  internalAccountId: number;
}

export type PositionData = {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice?: string;
};

export type FloatingInfo = {
  symbol: string;
  pnl: number;
  roi: number;
  price: number;
  positionAmt: number;
};