import { useEffect } from 'react';
import { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';

export type ChartType =
  | 'Bars'
  | 'Candles'
  | 'Hollow candles'
  | 'Line'
  | 'Line with markers'
  | 'Step line'
  | 'Area'
  | 'HLC area'
  | 'Baseline'
  | 'Columns'
  | 'High-low';

interface Candle {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface UseChartTypeProps {
  chartType: ChartType;
  chartRef: React.RefObject<IChartApi | null>;
  candleSeriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>;
  candles: Candle[];
  selectedSymbol: string;
  market: 'spot' | 'futures';
  sessionRef: React.RefObject<number>;
  updateMainIndicators: (candles: Candle[]) => void;
  updateBollingerBands: (candles: Candle[]) => void;
  addHLine: (series: ISeriesApi<any>, price: number) => void;
  hlineKey: (symbol: string, market: string) => string;
}

export const useChartType = ({
  chartType,
  chartRef,
  candleSeriesRef,
  candles,
  selectedSymbol,
  market,
  sessionRef,
  updateMainIndicators,
  updateBollingerBands,
  addHLine,
  hlineKey,
}: UseChartTypeProps) => {
  
  useEffect(() => {
    if (!candleSeriesRef.current || !chartRef.current) return;
    if (!candles.length) return;
    if (sessionRef.current === 0) return;

    const chart = chartRef.current;
    const currentData = candles;
    
    console.log('[ChartType] Switching to:', chartType);

    try {
      chart.removeSeries(candleSeriesRef.current);

      switch (chartType) {
        case 'Candles':
          (candleSeriesRef.current as any) = chart.addCandlestickSeries({
            upColor: '#0ECB81',
            downColor: '#F6465D',
            borderUpColor: '#0ECB81',
            borderDownColor: '#F6465D',
            wickUpColor: '#0ECB81',
            wickDownColor: '#F6465D',
            borderVisible: false,
            priceScaleId: 'right',
            lastValueVisible: true,
            priceLineVisible: true,
            priceLineColor: '#e0e3e8',
            priceLineStyle: 2,
            priceLineWidth: 1,
          });
          candleSeriesRef.current.setData(currentData);
          break;

        case 'Hollow candles':
          (candleSeriesRef.current as any) = chart.addCandlestickSeries({
            upColor: 'rgba(14, 203, 129, 0)',
            downColor: '#F6465D',
            borderUpColor: '#0ECB81',
            borderDownColor: '#F6465D',
            wickUpColor: '#0ECB81',
            wickDownColor: '#F6465D',
            borderVisible: true,
            priceScaleId: 'right',
            lastValueVisible: true,
            priceLineVisible: true,
            priceLineColor: '#e0e3e8',
            priceLineStyle: 2,
            priceLineWidth: 1,
          });
          candleSeriesRef.current.setData(currentData);
          break;

        case 'Bars':
          (candleSeriesRef.current as any) = chart.addBarSeries({
            upColor: '#0ECB81',
            downColor: '#F6465D',
            openVisible: true,
            thinBars: false,
            priceScaleId: 'right',
            lastValueVisible: true,
            priceLineVisible: true,
            priceLineColor: '#e0e3e8',
            priceLineStyle: 2,
            priceLineWidth: 1,
          }) as any;
          (candleSeriesRef.current as any).setData(currentData);
          break;

        case 'Line':
          (candleSeriesRef.current as any) = chart.addLineSeries({
            color: '#2962FF',
            lineWidth: 2,
            lineType: 0,
            priceScaleId: 'right',
            lastValueVisible: true,
            priceLineVisible: true,
            priceLineColor: '#2962FF',
            priceLineStyle: 2,
            priceLineWidth: 1,
          }) as any;
          const lineData = currentData.map(c => ({
            time: c.time,
            value: c.close,
          }));
          (candleSeriesRef.current as any).setData(lineData);
          break;

        case 'Line with markers':
          (candleSeriesRef.current as any) = chart.addLineSeries({
            color: '#2962FF',
            lineWidth: 2,
            lineType: 0,
            priceScaleId: 'right',
            lastValueVisible: true,
            priceLineVisible: true,
            priceLineColor: '#2962FF',
            priceLineStyle: 2,
            priceLineWidth: 1,
          }) as any;
          const markerData = currentData.map(c => ({
            time: c.time,
            value: c.close,
          }));
          (candleSeriesRef.current as any).setData(markerData);
          const markers = currentData
            .filter((c, i) => i % 20 === 0)
            .map(c => ({
              time: c.time,
              position: 'aboveBar' as const,
              color: '#2962FF',
              shape: 'circle' as const,
              text: '',
            }));
          (candleSeriesRef.current as any).setMarkers(markers);
          break;

        case 'Step line':
          (candleSeriesRef.current as any) = chart.addLineSeries({
            color: '#2962FF',
            lineWidth: 2,
            lineType: 1,
            priceScaleId: 'right',
            lastValueVisible: true,
            priceLineVisible: true,
            priceLineColor: '#2962FF',
            priceLineStyle: 2,
            priceLineWidth: 1,
          }) as any;
          const stepData = currentData.map(c => ({
            time: c.time,
            value: c.close,
          }));
          (candleSeriesRef.current as any).setData(stepData);
          break;

        case 'Area':
          (candleSeriesRef.current as any) = chart.addAreaSeries({
            topColor: 'rgba(41, 98, 255, 0.4)',
            bottomColor: 'rgba(41, 98, 255, 0.0)',
            lineColor: '#2962FF',
            lineWidth: 2,
            priceScaleId: 'right',
            lastValueVisible: true,
            priceLineVisible: true,
            priceLineColor: '#2962FF',
            priceLineStyle: 2,
            priceLineWidth: 1,
          }) as any;
          const areaData = currentData.map(c => ({
            time: c.time,
            value: c.close,
          }));
          (candleSeriesRef.current as any).setData(areaData);
          break;

        case 'HLC area':
          (candleSeriesRef.current as any) = chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: { type: 'price', precision: 8, minMove: 0.00000001 },
            priceScaleId: 'right',
            lastValueVisible: true,
            priceLineVisible: true,
          }) as any;
          const hlcData = currentData.map(c => ({
            time: c.time,
            value: c.close,
            color: c.close >= c.open ? '#0ECB8180' : '#F6465D80',
          }));
          (candleSeriesRef.current as any).setData(hlcData);
          break;

        case 'Baseline':
          (candleSeriesRef.current as any) = chart.addBaselineSeries({
            topLineColor: '#0ECB81',
            topFillColor1: 'rgba(14, 203, 129, 0.28)',
            topFillColor2: 'rgba(14, 203, 129, 0.05)',
            bottomLineColor: '#F6465D',
            bottomFillColor1: 'rgba(246, 70, 93, 0.05)',
            bottomFillColor2: 'rgba(246, 70, 93, 0.28)',
            baseValue: { type: 'price', price: currentData[0]?.close || 0 },
            priceScaleId: 'right',
            lastValueVisible: true,
            priceLineVisible: true,
          }) as any;
          const baselineData = currentData.map(c => ({
            time: c.time,
            value: c.close,
          }));
          (candleSeriesRef.current as any).setData(baselineData);
          break;

        case 'Columns':
          (candleSeriesRef.current as any) = chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: { type: 'price', precision: 8, minMove: 0.00000001 },
            priceScaleId: 'right',
            lastValueVisible: true,
            priceLineVisible: true,
          }) as any;
          const columnData = currentData.map(c => ({
            time: c.time,
            value: c.close,
            color: c.close >= c.open ? '#0ECB81' : '#F6465D',
          }));
          (candleSeriesRef.current as any).setData(columnData);
          break;

        case 'High-low':
          (candleSeriesRef.current as any) = chart.addBarSeries({
            upColor: '#0ECB81',
            downColor: '#F6465D',
            openVisible: false,
            thinBars: true,
            priceScaleId: 'right',
            lastValueVisible: true,
            priceLineVisible: true,
            priceLineColor: '#e0e3e8',
            priceLineStyle: 2,
            priceLineWidth: 1,
          }) as any;
          (candleSeriesRef.current as any).setData(currentData);
          break;

        default:
          (candleSeriesRef.current as any) = chart.addCandlestickSeries({
            upColor: '#0ECB81',
            downColor: '#F6465D',
            borderUpColor: '#0ECB81',
            borderDownColor: '#F6465D',
            wickUpColor: '#0ECB81',
            wickDownColor: '#F6465D',
            borderVisible: false,
            priceScaleId: 'right',
            lastValueVisible: true,
            priceLineVisible: true,
          });
          candleSeriesRef.current.setData(currentData);
      }

      if (currentData.length > 0) {
        updateMainIndicators(currentData);
        updateBollingerBands(currentData);
      }

      try {
        const raw = localStorage.getItem(hlineKey(selectedSymbol, market));
        const arr = raw ? (JSON.parse(raw) as number[]) : [];
        if (Array.isArray(arr) && candleSeriesRef.current) {
          arr.forEach((p) => addHLine(candleSeriesRef.current!, p));
        }
      } catch { }

      console.log('[ChartType] Switched successfully to:', chartType);
    } catch (error) {
      console.error('[ChartType] Switch failed:', error);
      try {
        (candleSeriesRef.current as any) = chart.addCandlestickSeries({
          upColor: '#0ECB81',
          downColor: '#F6465D',
          borderUpColor: '#0ECB81',
          borderDownColor: '#F6465D',
          wickUpColor: '#0ECB81',
          wickDownColor: '#F6465D',
          borderVisible: false,
          priceScaleId: 'right',
          lastValueVisible: true,
          priceLineVisible: true,
        });
        candleSeriesRef.current.setData(candles);
      } catch { }
    }
    
  }, [chartType]);

  const updateSeriesData = (candle: Candle) => {
    if (!candleSeriesRef.current) return;

    const lineTypes = ['Line', 'Line with markers', 'Step line', 'Area', 'Baseline'];
    const histogramTypes = ['HLC area', 'Columns'];
    
    try {
      if (lineTypes.includes(chartType)) {
        (candleSeriesRef.current as any).update({
          time: candle.time,
          value: candle.close,
        });
      } else if (histogramTypes.includes(chartType)) {
        (candleSeriesRef.current as any).update({
          time: candle.time,
          value: candle.close,
          color: candle.close >= candle.open ? '#0ECB81' : '#F6465D',
        });
      } else {
        candleSeriesRef.current.update(candle);
      }
    } catch (error) {
      console.error('[ChartType] Update failed:', error);
    }
  };

  return { updateSeriesData };
};