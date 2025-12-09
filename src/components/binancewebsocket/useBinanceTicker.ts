import { useState, useEffect, useRef, useCallback } from 'react';

export interface TickerData {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  askPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  count: number;
}

type MarketType = 'spot' | 'futures';

/**
 * Hook lấy 24hr Ticker TRỰC TIẾP từ Binance WebSocket
 */
export function useBinanceTicker(
  symbol: string,
  market: MarketType = 'futures'
): TickerData | null {
  const [ticker, setTicker] = useState<TickerData | null>(null);
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
    const streamName = `${symbolLower}@ticker`;
    const wsUrl = market === 'futures'
      ? `wss://fstream.binance.com/ws/${streamName}`
      : `wss://stream.binance.com:9443/ws/${streamName}`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`✅ [Ticker] Connected: ${symbol}`);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (currentSymbolRef.current.toLowerCase() === symbolLower) {
            setTicker({
              symbol: data.s || symbol,
              priceChange: data.p || '0',
              priceChangePercent: data.P || '0',
              weightedAvgPrice: data.w || '0',
              prevClosePrice: data.x || '0',
              lastPrice: data.c || '0',
              lastQty: data.Q || '0',
              bidPrice: data.b || '0',
              askPrice: data.a || '0',
              openPrice: data.o || '0',
              highPrice: data.h || '0',
              lowPrice: data.l || '0',
              volume: data.v || '0',
              quoteVolume: data.q || '0',
              openTime: data.O || 0,
              closeTime: data.C || 0,
              count: data.n || 0,
            });
          }
        } catch (error) {
          console.error('❌ [Ticker] Parse error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ [Ticker] Error:', error);
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
      console.error('❌ [Ticker] Failed to connect:', error);
    }
  }, [symbol, market]);

  useEffect(() => {
    setTicker(null);
    
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

  return ticker;
}