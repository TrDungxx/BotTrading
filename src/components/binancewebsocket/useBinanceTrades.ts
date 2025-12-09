import { useState, useEffect, useRef, useCallback } from 'react';

export interface TradeData {
  symbol: string;
  tradeId: number;
  price: string;
  qty: string;
  time: number;
  isBuyerMaker: boolean;
}

type MarketType = 'spot' | 'futures';

/**
 * Hook lấy Trade Stream TRỰC TIẾP từ Binance WebSocket
 */
export function useBinanceTrades(
  symbol: string,
  market: MarketType = 'futures',
  maxTrades: number = 50
): TradeData[] {
  const [trades, setTrades] = useState<TradeData[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentSymbolRef = useRef(symbol);

  useEffect(() => {
    currentSymbolRef.current = symbol;
  }, [symbol]);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const symbolLower = symbol.toLowerCase();
    // Futures dùng aggTrade, Spot có thể dùng trade hoặc aggTrade
    const streamName = `${symbolLower}@aggTrade`;
    const wsUrl = market === 'futures'
      ? `wss://fstream.binance.com/ws/${streamName}`
      : `wss://stream.binance.com:9443/ws/${streamName}`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`✅ [Trades] Connected: ${symbol}`);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (currentSymbolRef.current.toLowerCase() === symbolLower) {
            const trade: TradeData = {
              symbol: data.s || symbol.toUpperCase(),
              tradeId: data.a || data.t || 0, // aggTrade: a, trade: t
              price: data.p || '0',
              qty: data.q || '0',
              time: data.T || Date.now(),
              isBuyerMaker: data.m || false,
            };

            setTrades((prev) => {
              const newTrades = [trade, ...prev.slice(0, maxTrades - 1)];
              return newTrades;
            });
          }
        } catch (error) {
          console.error('❌ [Trades] Parse error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ [Trades] Error:', error);
      };

      ws.onclose = (event) => {
        if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (currentSymbolRef.current === symbol) connect();
          }, 2000);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('❌ [Trades] Failed to connect:', error);
    }
  }, [symbol, market, maxTrades]);

  useEffect(() => {
    setTrades([]);
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const timer = setTimeout(() => connect(), 100);

    return () => {
      clearTimeout(timer);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close(1000);
        wsRef.current = null;
      }
    };
  }, [symbol, market, connect]);

  return trades;
}