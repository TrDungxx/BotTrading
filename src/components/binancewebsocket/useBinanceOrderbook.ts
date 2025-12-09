import { useState, useEffect, useRef, useCallback } from 'react';

interface OrderBookEntry {
  price: number;
  quantity: number;
}

interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastUpdateId: number;
}

type MarketType = 'spot' | 'futures';

/**
 * Hook lấy orderbook TRỰC TIẾP từ Binance WebSocket
 * Không đi qua server proxy để tránh quá tải
 */
export function useBinanceOrderbook(
  symbol: string,
  market: MarketType = 'futures',
  levels: number = 20,
  updateSpeed: string = '100ms'
): OrderBookData {
  const [orderbook, setOrderbook] = useState<OrderBookData>({
    bids: [],
    asks: [],
    lastUpdateId: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountRef = useRef(0);
  const currentSymbolRef = useRef(symbol);

  // Cập nhật ref khi symbol thay đổi
  useEffect(() => {
    currentSymbolRef.current = symbol;
  }, [symbol]);

  const connect = useCallback(() => {
    // Đóng connection cũ nếu có
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const symbolLower = symbol.toLowerCase();
    
    // ✅ Binance WebSocket URL format
    // Futures: wss://fstream.binance.com/ws/btcusdt@depth20@100ms
    // Spot: wss://stream.binance.com:9443/ws/btcusdt@depth20@100ms
    const streamName = `${symbolLower}@depth${levels}@${updateSpeed}`;
    const wsUrl = market === 'futures' 
      ? `wss://fstream.binance.com/ws/${streamName}`
      : `wss://stream.binance.com:9443/ws/${streamName}`;

    console.log(`📊 [Orderbook] Connecting: ${symbol} (${market})`);

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`✅ [Orderbook] Connected: ${symbol}`);
        reconnectCountRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Binance Futures format: có thể là "bids/asks" hoặc "b/a"
          const bids = data.bids || data.b;
          const asks = data.asks || data.a;
          
          if (bids && asks) {
            // Chỉ update nếu vẫn đang xem symbol này
            if (currentSymbolRef.current.toLowerCase() === symbolLower) {
              setOrderbook({
                bids: bids.slice(0, levels).map((b: string[]) => ({
                  price: parseFloat(b[0]),
                  quantity: parseFloat(b[1]),
                })),
                asks: asks.slice(0, levels).map((a: string[]) => ({
                  price: parseFloat(a[0]),
                  quantity: parseFloat(a[1]),
                })),
                lastUpdateId: data.lastUpdateId || data.u || Date.now(),
              });
            }
          }
        } catch (error) {
          console.error('❌ [Orderbook] Parse error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ [Orderbook] WebSocket error:', error);
      };

      ws.onclose = (event) => {
        // Auto reconnect (max 5 lần)
        if (event.code !== 1000 && reconnectCountRef.current < 5) {
          reconnectCountRef.current++;
          const delay = Math.min(1000 * reconnectCountRef.current, 5000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (currentSymbolRef.current === symbol) {
              connect();
            }
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('❌ [Orderbook] Failed to create WebSocket:', error);
    }
  }, [symbol, market, levels, updateSpeed]);

  // Connect khi symbol/market thay đổi
  useEffect(() => {
    // Clear orderbook cũ khi đổi symbol
    setOrderbook({ bids: [], asks: [], lastUpdateId: 0 });
    reconnectCountRef.current = 0;
    
    // Clear pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Đợi một chút trước khi connect (debounce)
    const connectTimer = setTimeout(() => {
      connect();
    }, 150);

    return () => {
      clearTimeout(connectTimer);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (wsRef.current) {
        wsRef.current.close(1000, 'Cleanup');
        wsRef.current = null;
      }
    };
  }, [symbol, market, connect]);

  return orderbook;
}

export default useBinanceOrderbook;