import { useState, useEffect, useRef, useCallback } from 'react';
import { UTCTimestamp } from 'lightweight-charts';
import { Candle, VolumeBar, KlineMessage } from '../types';
import { toTs } from '../utils/chartHelpers';
import { binanceWS } from '../../../binancewebsocket/BinanceWebSocketService';

interface UseChartDataParams {
  symbol: string;
  interval: string;
  market: 'spot' | 'futures';
}

interface UseChartDataReturn {
  candles: Candle[];
  volumeData: VolumeBar[];
  isLoading: boolean;
  error: string | null;
  lastUpdateTime: number;
}

/**
 * Custom hook to manage chart data from Binance API and WebSocket
 */
export function useChartData({
  symbol,
  interval,
  market
}: UseChartDataParams): UseChartDataReturn {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [volumeData, setVolumeData] = useState<VolumeBar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  
  const wsSubRef = useRef<string>('');

  /**
   * Fetch historical klines from Binance API
   */
  const fetchKlines = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const base = market === 'futures'
        ? 'https://fapi.binance.com/fapi/v1/klines'
        : 'https://api.binance.com/api/v3/klines';
      
      const url = `${base}?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=1000`;
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      const data = await res.json();
      
      const candleData: Candle[] = data.map((k: any) => ({
        time: toTs(k[0]),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
      }));
      
      const volData: VolumeBar[] = data.map((k: any) => {
        const isGreen = parseFloat(k[4]) >= parseFloat(k[1]);
        return {
          time: toTs(k[0]),
          value: parseFloat(k[5]),
          color: isGreen ? '#26a69a' : '#ef5350',
        };
      });
      
      setCandles(candleData);
      setVolumeData(volData);
      setLastUpdateTime(Date.now());
    } catch (err) {
      console.error('Failed to fetch klines:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [symbol, interval, market]);

  /**
   * Handle WebSocket kline updates
   */
  const handleKlineUpdate = useCallback((msg: KlineMessage) => {
    const k = msg.k;
    const newCandle: Candle = {
      time: toTs(k.t),
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c),
    };
    
    const isGreen = parseFloat(k.c) >= parseFloat(k.o);
    const newVol: VolumeBar = {
      time: toTs(k.t),
      value: parseFloat(k.v),
      color: isGreen ? '#26a69a' : '#ef5350',
    };

    setCandles(prev => {
      if (!prev.length) return [newCandle];
      
      const lastCandle = prev[prev.length - 1];
      
      // If same time, update existing candle
      if (lastCandle.time === newCandle.time) {
        return [...prev.slice(0, -1), newCandle];
      }
      
      // If closed candle (x: true), add new candle
      if (k.x) {
        return [...prev, newCandle];
      }
      
      // Otherwise update last candle
      return [...prev.slice(0, -1), newCandle];
    });

    setVolumeData(prev => {
      if (!prev.length) return [newVol];
      
      const lastVol = prev[prev.length - 1];
      
      if (lastVol.time === newVol.time) {
        return [...prev.slice(0, -1), newVol];
      }
      
      if (k.x) {
        return [...prev, newVol];
      }
      
      return [...prev.slice(0, -1), newVol];
    });
    
    setLastUpdateTime(Date.now());
  }, []);

  /**
   * Subscribe to WebSocket kline stream
   */
 useEffect(() => {
  const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
  
  // Binance WebSocket URL (public)
  const wsUrl = market === 'futures'
    ? `wss://fstream.binance.com/ws/${streamName}`
    : `wss://stream.binance.com:9443/ws/${streamName}`;
  
  let ws: WebSocket | null = null;
  
  try {
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log(`✅ Connected to ${streamName}`);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.e === 'kline' && data.k) {
          handleKlineUpdate({ k: data.k });
        }
      } catch (err) {
        console.error('Failed to parse kline message:', err);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log(`❌ Disconnected from ${streamName}`);
    };
  } catch (err) {
    console.error('Failed to create WebSocket:', err);
  }
  
  return () => {
    if (ws) {
      ws.close();
      ws = null;
    }
  };
}, [symbol, interval, market, handleKlineUpdate]);

  useEffect(() => {
  fetchKlines();
}, [fetchKlines]);

return {
  candles,
  volumeData,
  isLoading,
  error,
  lastUpdateTime
};
}