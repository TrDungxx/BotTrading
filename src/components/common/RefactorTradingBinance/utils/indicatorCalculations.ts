import { CandlestickData, LineData, Time, HistogramData } from 'lightweight-charts';

/**
 * Calculate Simple Moving Average (MA)
 */
export function calculateMA(data: CandlestickData<Time>[], period: number): LineData<Time>[] {
  const out: LineData<Time>[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j].close || 0;
    const avg = sum / period;
    if (!Number.isNaN(avg)) out.push({ time: data[i].time, value: +avg.toFixed(8) });
  }
  return out;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(data: CandlestickData[], period: number): LineData[] {
  const out: LineData[] = [];
  const multiplier = 2 / (period + 1);
  
  // First EMA = SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close || 0;
  }
  let ema = sum / period;
  out.push({ time: data[period - 1].time, value: +ema.toFixed(8) });
  
  // Calculate EMA for remaining data
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
    out.push({ time: data[i].time, value: +ema.toFixed(8) });
  }
  
  return out;
}

/**
 * Calculate Bollinger Bands
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
 * Calculate Volume Moving Average
 */
export function calculateVolumeMA(volumeData: HistogramData[], period: number): LineData[] {
  const out: LineData[] = [];
  
  for (let i = period - 1; i < volumeData.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += volumeData[j].value || 0;
    }
    const avg = sum / period;
    if (!Number.isNaN(avg)) {
      out.push({ 
        time: volumeData[i].time, 
        value: +avg.toFixed(8) 
      });
    }
  }
  
  return out;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
  data: CandlestickData[], 
  fastPeriod: number = 12, 
  slowPeriod: number = 26, 
  signalPeriod: number = 9
): { 
  macdLine: LineData[]; 
  signalLine: LineData[]; 
  histogram: HistogramData[] 
} {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  
  const macdLine: LineData[] = [];
  for (let i = 0; i < Math.min(fastEMA.length, slowEMA.length); i++) {
    macdLine.push({
      time: fastEMA[i].time,
      value: +(fastEMA[i].value - slowEMA[i].value).toFixed(8)
    });
  }
  
  // Calculate signal line (EMA of MACD line)
  const signalLine: LineData[] = [];
  const multiplier = 2 / (signalPeriod + 1);
  
  if (macdLine.length >= signalPeriod) {
    let sum = 0;
    for (let i = 0; i < signalPeriod; i++) {
      sum += macdLine[i].value;
    }
    let ema = sum / signalPeriod;
    signalLine.push({ time: macdLine[signalPeriod - 1].time, value: +ema.toFixed(8) });
    
    for (let i = signalPeriod; i < macdLine.length; i++) {
      ema = (macdLine[i].value - ema) * multiplier + ema;
      signalLine.push({ time: macdLine[i].time, value: +ema.toFixed(8) });
    }
  }
  
  // Calculate histogram
  const histogram: HistogramData[] = [];
  for (let i = 0; i < signalLine.length; i++) {
    const macdIndex = macdLine.findIndex(m => m.time === signalLine[i].time);
    if (macdIndex !== -1) {
      const diff = macdLine[macdIndex].value - signalLine[i].value;
      histogram.push({
        time: signalLine[i].time,
        value: +diff.toFixed(8),
        color: diff >= 0 ? '#26a69a' : '#ef5350'
      });
    }
  }
  
  return { macdLine, signalLine, histogram };
}

/**
 * Calculate RSI (Relative Strength Index)
 */
export function calculateRSI(data: CandlestickData[], period: number = 14): LineData[] {
  if (data.length < period + 1) return [];
  
  const out: LineData[] = [];
  let gains = 0;
  let losses = 0;
  
  // Calculate initial average gain and loss
  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  let rs = avgGain / avgLoss;
  let rsi = 100 - (100 / (1 + rs));
  out.push({ time: data[period].time, value: +rsi.toFixed(2) });
  
  // Calculate subsequent RSI values
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    
    rs = avgGain / avgLoss;
    rsi = 100 - (100 / (1 + rs));
    out.push({ time: data[i].time, value: +rsi.toFixed(2) });
  }
  
  return out;
}