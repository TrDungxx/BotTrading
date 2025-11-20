// utils/indicatorHistory.ts (hoặc để ngay cạnh component)
export type IndicatorMessage = {
  strategy: string;
  indicator: string;
  type: 'long' | 'short' | 'exit';
  action: string;                 // "BUY entry" | "SELL entry"
  position: 'BUY' | 'SELL';
  general: { ticker: string; exchange: string; interval: string; time: string; timenow: string };
  symbolData: { volume: string; high: string; open: string; close: string };
  currency: { quote: string; base: string };
  options?: { capitalPercent?: number; manualQuantity?: number };
};

export type HistoryRow = {
  id: number;
  name: string;
  strategy: string;
  createdAt: string;          // server time
  timestamp?: string;         // trong content (nếu có)
  requestId?: string;
  type: 'long' | 'short' | 'exit' | 'unknown';
  position?: 'BUY' | 'SELL';
  symbol: string;
  price?: number;             // lấy từ symbolData.close
  capitalPercent?: number;
};

const safeJSON = (s?: string) => {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
};

export const mapHistoryRow = (row: any): HistoryRow => {
  const parsed = safeJSON(row?.IndicatorContent) || {};
  const msg: Partial<IndicatorMessage> = (parsed as any).indicatorMessage || {};
  return {
    id: Number(row?.id),
    name: row?.Name ?? '',
    strategy: row?.Strategy ?? '',
    createdAt: row?.create_time ?? '',
    timestamp: parsed?.timestamp,
    requestId: parsed?.requestId,
    type: (msg?.type as any) ?? 'unknown',
    position: msg?.position,
    symbol: msg?.general?.ticker ?? '',
    price: msg?.symbolData?.close != null ? Number(msg.symbolData.close) : undefined,
    capitalPercent: msg?.options?.capitalPercent != null ? Number(msg.options.capitalPercent) : undefined,
  };
};
