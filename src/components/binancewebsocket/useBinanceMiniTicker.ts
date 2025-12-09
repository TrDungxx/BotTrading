import { useState, useEffect, useRef, useCallback } from 'react';

export interface MiniTickerData {
  symbol: string;
  close: string;
  open: string;
  high: string;
  low: string;
  volume: string;
  quoteVolume: string;
  eventTime: number;
}

type MarketType = 'spot' | 'futures';

/**
 * Hook lấy MiniTicker cho 1 symbol TRỰC TIẾP từ Binance
 */
export function useBinanceMiniTicker(
  symbol: string,
  market: MarketType = 'futures'
): MiniTickerData | null {
  const [ticker, setTicker] = useState<MiniTickerData | null>(null);
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
    const streamName = `${symbolLower}@miniTicker`;
    const wsUrl = market === 'futures'
      ? `wss://fstream.binance.com/ws/${streamName}`
      : `wss://stream.binance.com:9443/ws/${streamName}`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`✅ [MiniTicker] Connected: ${symbol}`);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (currentSymbolRef.current.toLowerCase() === symbolLower) {
            setTicker({
              symbol: data.s || symbol.toUpperCase(),
              close: data.c || '0',
              open: data.o || '0',
              high: data.h || '0',
              low: data.l || '0',
              volume: data.v || '0',
              quoteVolume: data.q || '0',
              eventTime: data.E || Date.now(),
            });
          }
        } catch (error) {
          console.error('❌ [MiniTicker] Parse error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ [MiniTicker] Error:', error);
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
      console.error('❌ [MiniTicker] Failed:', error);
    }
  }, [symbol, market]);

  useEffect(() => {
    setTicker(null);
    
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

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

/**
 * Hook lấy MiniTicker cho TẤT CẢ symbols (dùng !miniTicker@arr stream)
 * Trả về Map<symbol, MiniTickerData>
 */
export function useBinanceAllMiniTickers(
  market: MarketType = 'futures'
): Map<string, MiniTickerData> {
  const [tickers, setTickers] = useState<Map<string, MiniTickerData>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // !miniTicker@arr = tất cả symbols
    const wsUrl = market === 'futures'
      ? 'wss://fstream.binance.com/ws/!miniTicker@arr'
      : 'wss://stream.binance.com:9443/ws/!miniTicker@arr';

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`✅ [AllMiniTickers] Connected (${market})`);
      };

      ws.onmessage = (event) => {
        try {
          const dataArr = JSON.parse(event.data);
          
          if (Array.isArray(dataArr)) {
            setTickers((prev) => {
              const newMap = new Map(prev);
              dataArr.forEach((data: any) => {
                const sym = (data.s || '').toUpperCase();
                if (sym) {
                  newMap.set(sym, {
                    symbol: sym,
                    close: data.c || '0',
                    open: data.o || '0',
                    high: data.h || '0',
                    low: data.l || '0',
                    volume: data.v || '0',
                    quoteVolume: data.q || '0',
                    eventTime: data.E || Date.now(),
                  });
                }
              });
              return newMap;
            });
          }
        } catch (error) {
          console.error('❌ [AllMiniTickers] Parse error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ [AllMiniTickers] Error:', error);
      };

      ws.onclose = (event) => {
        if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => connect(), 3000);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('❌ [AllMiniTickers] Failed:', error);
    }
  }, [market]);

  useEffect(() => {
    const timer = setTimeout(() => connect(), 100);

    return () => {
      clearTimeout(timer);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close(1000);
        wsRef.current = null;
      }
    };
  }, [market, connect]);

  return tickers;
}