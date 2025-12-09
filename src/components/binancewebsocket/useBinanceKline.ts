import { useState, useEffect, useRef, useCallback } from 'react';

export interface KlineData {
  symbol: string;
  interval: string;
  openTime: number;
  closeTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  trades: number;
  isClosed: boolean;
}

type MarketType = 'spot' | 'futures';

/**
 * Hook lấy Kline Stream TRỰC TIẾP từ Binance WebSocket
 */
export function useBinanceKline(
  symbol: string,
  interval: string = '1m',
  market: MarketType = 'futures'
): KlineData | null {
  const [kline, setKline] = useState<KlineData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentSymbolRef = useRef(symbol);
  const currentIntervalRef = useRef(interval);

  useEffect(() => {
    currentSymbolRef.current = symbol;
    currentIntervalRef.current = interval;
  }, [symbol, interval]);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const symbolLower = symbol.toLowerCase();
    const streamName = `${symbolLower}@kline_${interval}`;
    const wsUrl = market === 'futures'
      ? `wss://fstream.binance.com/ws/${streamName}`
      : `wss://stream.binance.com:9443/ws/${streamName}`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`✅ [Kline] Connected: ${symbol} ${interval}`);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const k = data.k;
          
          if (k && currentSymbolRef.current.toLowerCase() === symbolLower 
              && currentIntervalRef.current === interval) {
            setKline({
              symbol: k.s || symbol.toUpperCase(),
              interval: k.i || interval,
              openTime: k.t || 0,
              closeTime: k.T || 0,
              open: k.o || '0',
              high: k.h || '0',
              low: k.l || '0',
              close: k.c || '0',
              volume: k.v || '0',
              trades: k.n || 0,
              isClosed: k.x || false,
            });
          }
        } catch (error) {
          console.error('❌ [Kline] Parse error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ [Kline] Error:', error);
      };

      ws.onclose = (event) => {
        if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (currentSymbolRef.current === symbol && currentIntervalRef.current === interval) {
              connect();
            }
          }, 2000);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('❌ [Kline] Failed to connect:', error);
    }
  }, [symbol, interval, market]);

  useEffect(() => {
    setKline(null);
    
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
  }, [symbol, interval, market, connect]);

  return kline;
}