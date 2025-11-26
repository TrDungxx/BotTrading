import { CandlestickData, LineData, HistogramData, Time, UTCTimestamp } from 'lightweight-charts';

/**
 * Tính Simple Moving Average (SMA/MA)
 */
export function calculateMA(
  data: CandlestickData<Time>[], 
  period: number
): LineData<Time>[] {
  const out: LineData<Time>[] = [];
  
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close || 0;
    }
    const avg = sum / period;
    
    if (!Number.isNaN(avg)) {
      out.push({ 
        time: data[i].time, 
        value: +avg.toFixed(8) 
      });
    }
  }
  
  return out;
}

/**
 * Tính Exponential Moving Average (EMA)
 */
export function calculateEMA(
  data: CandlestickData[], 
  period: number
): LineData[] {
  const out: LineData[] = [];
  const multiplier = 2 / (period + 1);
  
  // First EMA = SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close || 0;
  }
  let ema = sum / period;
  out.push({ 
    time: data[period - 1].time, 
    value: +ema.toFixed(8) 
  });
  
  // Calculate EMA for remaining data
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
    out.push({ 
      time: data[i].time, 
      value: +ema.toFixed(8) 
    });
  }
  
  return out;
}

/**
 * Tính Bollinger Bands
 */
export function calculateBollingerBands(
  data: CandlestickData[], 
  period: number, 
  stdDev: number
): { upper: LineData[]; middle: LineData[]; lower: LineData[] } {
  const upper: LineData[] = [];
  const middle: LineData[] = [];
  const lower: LineData[] = [];
  
  for (let i = period - 1; i < data.length; i++) {
    // Calculate SMA (middle band)
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close || 0;
    }
    const sma = sum / period;
    
    // Calculate standard deviation
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = (data[j].close || 0) - sma;
      variance += diff * diff;
    }
    const std = Math.sqrt(variance / period);
    
    // Calculate bands
    const upperBand = sma + (stdDev * std);
    const lowerBand = sma - (stdDev * std);
    
    middle.push({ time: data[i].time, value: +sma.toFixed(8) });
    upper.push({ time: data[i].time, value: +upperBand.toFixed(8) });
    lower.push({ time: data[i].time, value: +lowerBand.toFixed(8) });
  }
  
  return { upper, middle, lower };
}

/**
 * Tính Volume Moving Average
 */
export function calculateVolumeMA(
  volumeData: HistogramData<Time>[], 
  period: number
): LineData<Time>[] {
  const out: LineData<Time>[] = [];
  
  for (let i = period - 1; i < volumeData.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += volumeData[j].value || 0;
    }
    const avg = sum / period;
    
    if (!Number.isNaN(avg)) {
      out.push({ 
        time: volumeData[i].time, 
        value: +avg.toFixed(2) 
      });
    }
  }
  
  return out;
}