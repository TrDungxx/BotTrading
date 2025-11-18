import React, { useEffect, useRef, useState } from 'react';
import { TradingBinanceProps } from '././types';
import { MainChart, MainChartHandle } from './components/MainChart';
import { VolumeChart, VolumeChartHandle } from './components/VolumeChart';
import { ChartContextMenu } from './components/ChartContextMenu';
import { useChartData } from './hooks/useChartData';
import { useIndicators } from './hooks/useIndicators';
import { useChartInteractions } from './hooks/useChartInteractions';
import { getSymbolMeta, hlineKey, parseStoredHLines, saveHLinesToStorage } from './utils/chartHelpers';
import { addHLine, clearAllHLines, getAllLinePrices } from '../../clickchart/hline';
import { copyPrice} from '../../clickchart/CopyPrice'
import FloatingPositionTag from '../../tabposition/FloatingPositionTag';
import ToolMini from '../popupchart/ToolMini';
import AlertModal from '../../clickchart/AlertModal';
import NewOrderModal from '../../clickchart/NewOrderModal';
import LineIndicatorHeader from '../popupchart/LineIndicatorHeader';
import LineIndicatorSettings from '../popupchart/LineIndicatorSettings';
import { binanceWS } from '../../binancewebsocket/BinanceWebSocketService';
import "../../../style/Hidetradingviewlogo.css";

/**
 * Main TradingBinance Component - Refactored
 */
export const TradingBinance: React.FC<TradingBinanceProps> = ({
  selectedSymbol,
  selectedInterval,
  market,
  floating,
  showPositionTag = true,
  onRequestSymbolChange,
  chartType = 'Candles',
  onChartTypeChange,
}) => {
  // Refs for charts
  const mainChartRef = useRef<MainChartHandle>(null);
  const volumeChartRef = useRef<VolumeChartHandle>(null);

  // Refs for indicator series
  const ma7Ref = useRef<any>(null);
  const ma25Ref = useRef<any>(null);
  const ma99Ref = useRef<any>(null);
  const ema12Ref = useRef<any>(null);
  const ema26Ref = useRef<any>(null);
  const bollUpperRef = useRef<any>(null);
  const bollMiddleRef = useRef<any>(null);
  const bollLowerRef = useRef<any>(null);
  const mavol1Ref = useRef<any>(null);
  const mavol2Ref = useRef<any>(null);

  // Symbol metadata
  const [symbolMeta, setSymbolMeta] = useState<any>(undefined);

  // UI State
  const [mainIndicatorVisible, setMainIndicatorVisible] = useState(false);
  const [volumeIndicatorVisible, setVolumeIndicatorVisible] = useState(false);
  const [showMainSettings, setShowMainSettings] = useState(false);
  const [showVolumeSettings, setShowVolumeSettings] = useState(false);

  // Custom hooks
  const { candles, volumeData, isLoading, error } = useChartData({
    symbol: selectedSymbol,
    interval: selectedInterval,
    market,
  });

  const {
    mainVisible,
    volumeVisible,
    bollFillVisible,
    periods,
    colors,
    setMainVisible,
    setVolumeVisible,
    setBollFillVisible,
    setPeriods,
    setColors,
    calculateMainIndicators,
    calculateVolumeIndicators,
  } = useIndicators();

  const {
    hoverPrice,
    ctxOpen,
    ctxPosition,
    openCtxMenu,
    closeCtxMenu,
    orderOpen,
    alertOpen,
    orderSeedPrice,
    orderPresetType,
    openOrderModal,
    closeOrderModal,
    openAlertModal,
    closeAlertModal,
    handleChartCrosshairMove,
  } = useChartInteractions();

  /**
   * Fetch symbol metadata
   */
  useEffect(() => {
    getSymbolMeta(selectedSymbol, market).then(setSymbolMeta);
  }, [selectedSymbol, market]);

  /**
   * Initialize indicator series
   */
  useEffect(() => {
    if (!mainChartRef.current || !volumeChartRef.current) return;

    // Main chart indicators
    ma7Ref.current = mainChartRef.current.addLineSeries(colors.ma7, mainVisible.ma7);
    ma25Ref.current = mainChartRef.current.addLineSeries(colors.ma25, mainVisible.ma25);
    ma99Ref.current = mainChartRef.current.addLineSeries(colors.ma99, mainVisible.ma99);
    ema12Ref.current = mainChartRef.current.addLineSeries(colors.ema12, mainVisible.ema12);
    ema26Ref.current = mainChartRef.current.addLineSeries(colors.ema26, mainVisible.ema26);
    bollUpperRef.current = mainChartRef.current.addLineSeries(colors.boll, mainVisible.boll);
    bollMiddleRef.current = mainChartRef.current.addLineSeries(colors.boll, mainVisible.boll);
    bollLowerRef.current = mainChartRef.current.addLineSeries(colors.boll, mainVisible.boll);

    // Volume indicators
    mavol1Ref.current = volumeChartRef.current.addLineSeries(colors.mavol1, volumeVisible.mavol1);
    mavol2Ref.current = volumeChartRef.current.addLineSeries(colors.mavol2, volumeVisible.mavol2);
  }, []);

  /**
   * Update main indicators when data changes
   */
  useEffect(() => {
    if (!candles.length) return;

    const indicators = calculateMainIndicators(candles);

    if (indicators.ma7) ma7Ref.current?.setData(indicators.ma7);
    if (indicators.ma25) ma25Ref.current?.setData(indicators.ma25);
    if (indicators.ma99) ma99Ref.current?.setData(indicators.ma99);
    if (indicators.ema12) ema12Ref.current?.setData(indicators.ema12);
    if (indicators.ema26) ema26Ref.current?.setData(indicators.ema26);

    if (indicators.boll) {
      bollUpperRef.current?.setData(indicators.boll.upper);
      bollMiddleRef.current?.setData(indicators.boll.middle);
      bollLowerRef.current?.setData(indicators.boll.lower);

      // Draw Bollinger fill if enabled
      if (bollFillVisible && mainChartRef.current) {
        mainChartRef.current.drawBollingerFill(
          indicators.boll.upper,
          indicators.boll.lower,
          'rgba(179, 133, 248, 0.1)'
        );
      }
    }
  }, [candles, calculateMainIndicators, bollFillVisible]);

  /**
   * Update volume indicators when data changes
   */
  useEffect(() => {
    if (!volumeData.length) return;

    const indicators = calculateVolumeIndicators(volumeData);

    if (indicators.mavol1) mavol1Ref.current?.setData(indicators.mavol1);
    if (indicators.mavol2) mavol2Ref.current?.setData(indicators.mavol2);
  }, [volumeData, calculateVolumeIndicators]);

  /**
   * Load saved H-lines from localStorage
   */
  useEffect(() => {
    if (!mainChartRef.current?.candleSeries) return;

    const key = hlineKey(selectedSymbol, market);
    const prices = parseStoredHLines(key);

    prices.forEach(price => {
      if (mainChartRef.current?.candleSeries) {
        addHLine(mainChartRef.current.candleSeries, price);
      }
    });
  }, [selectedSymbol, market, candles.length]);

  /**
   * Toggle all main indicators
   */
  const toggleAllMainIndicators = () => {
    const anyVisible = Object.values(mainVisible).some(v => v);
    const newState = !anyVisible;

    const newConfig = Object.keys(mainVisible).reduce((acc, key) => {
      acc[key as keyof typeof mainVisible] = newState;
      return acc;
    }, {} as typeof mainVisible);

    setMainVisible(newConfig);
    
    ma7Ref.current?.applyOptions({ visible: newState });
    ma25Ref.current?.applyOptions({ visible: newState });
    ma99Ref.current?.applyOptions({ visible: newState });
    ema12Ref.current?.applyOptions({ visible: newState });
    ema26Ref.current?.applyOptions({ visible: newState });
  };

  /**
   * Toggle all volume indicators
   */
  const toggleAllVolumeIndicators = () => {
    const anyVisible = Object.values(volumeVisible).some(v => v);
    const newState = !anyVisible;

    const newConfig = Object.keys(volumeVisible).reduce((acc, key) => {
      acc[key as keyof typeof volumeVisible] = newState;
      return acc;
    }, {} as typeof volumeVisible);

    setVolumeVisible(newConfig);
    
    mavol1Ref.current?.applyOptions({ visible: newState });
    mavol2Ref.current?.applyOptions({ visible: newState });
  };

  /**
   * Handle placing order
   */
  const handlePlaceOrder = (orderParams: any) => {
    const meta = symbolMeta;
    if (!meta) return;

    const step = meta.stepSize ?? 0.00000001;
    const stepDec = String(step).includes('.') ? String(step).split('.')[1]!.length : 0;
    const roundQty = (q: number) => Number((Math.floor(q / step) * step).toFixed(stepDec));

    const qty = roundQty(orderParams.qty);
    const isFutures = market === 'futures';
    const positionSide = isFutures
      ? (orderParams.side === 'BUY' ? 'LONG' : 'SHORT')
      : 'BOTH';

    if (orderParams.type === 'LIMIT') {
      if (!orderParams.price) return;
      binanceWS.placeOrder({
        market,
        symbol: selectedSymbol,
        side: orderParams.side,
        type: 'LIMIT',
        quantity: qty,
        price: orderParams.price,
        timeInForce: 'GTC',
        ...(isFutures ? { positionSide } : {})
      });
    } else {
      if (!('stopPrice' in orderParams) || !orderParams.stopPrice) return;
      
      if (isFutures) {
        binanceWS.placeOrder({
          market: 'futures',
          symbol: selectedSymbol,
          side: orderParams.side,
          type: 'STOP_MARKET',
          stopPrice: orderParams.stopPrice,
          quantity: qty,
          positionSide,
          workingType: 'MARK'
        });
      } else {
        binanceWS.placeOrder({
          market: 'spot',
          symbol: selectedSymbol,
          side: orderParams.side,
          type: 'STOP_LOSS_LIMIT',
          stopPrice: orderParams.stopPrice,
          price: orderParams.stopPrice,
          quantity: qty,
          timeInForce: 'GTC'
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-dark-900">
        <div className="text-gray-400">Đang tải dữ liệu...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-dark-900">
        <div className="text-red-400">Lỗi: {error}</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-dark-900">
      {/* Floating Position Tag */}
      {showPositionTag && floating && (
        <FloatingPositionTag
          symbol={selectedSymbol}
          positionAmt={floating.positionAmt.toString()}
          entryPrice={floating.price.toString()}
          pnl={floating.pnl}
          roi={floating.roi}
        />
      )}

      {/* Tool Mini */}
      <ToolMini
        chartType={chartType}
        onChartTypeChange={onChartTypeChange}
      />

      {/* Context Menu */}
      <ChartContextMenu
        open={ctxOpen}
        position={ctxPosition}
        onClose={closeCtxMenu}
        onCopyPrice={() => {
          if (hoverPrice !== null) copyPrice(hoverPrice);
        }}
        onAddHorizontalLine={() => {
          if (hoverPrice !== null && mainChartRef.current?.candleSeries) {
            addHLine(mainChartRef.current.candleSeries, hoverPrice);
            
            const key = hlineKey(selectedSymbol, market);
            const prices = getAllLinePrices(mainChartRef.current.candleSeries);
            saveHLinesToStorage(key, prices);
          }
        }}
        onRemoveDrawings={() => {
          if (mainChartRef.current?.candleSeries) {
            clearAllHLines(mainChartRef.current.candleSeries);
            
            try {
              const key = hlineKey(selectedSymbol, market);
              localStorage.removeItem(key);
            } catch {}
          }
        }}
        onRemoveIndicators={() => {
          // Implement remove indicators logic
        }}
        onNewLimitOrder={() => {
          if (hoverPrice !== null) {
            openOrderModal(hoverPrice, 'LIMIT');
          }
        }}
        onNewStopOrder={() => {
          if (hoverPrice !== null) {
            openOrderModal(hoverPrice, 'STOP_MARKET');
          }
        }}
        onCreateAlert={openAlertModal}
      />

      {/* Order Modal */}
      <NewOrderModal
        open={orderOpen}
        onClose={closeOrderModal}
        defaultPrice={orderSeedPrice ?? undefined}
        defaultType={orderPresetType}
        tickSize={symbolMeta?.tickSize}
        pricePrecision={symbolMeta?.precision}
        symbol={selectedSymbol}
        onSubmit={handlePlaceOrder}
      />

      {/* Alert Modal */}
      <AlertModal
        open={alertOpen}
        onClose={closeAlertModal}
        defaultPrice={hoverPrice}
        symbol={selectedSymbol}
        onCreate={(alert) => {
          console.log('[CREATE ALERT]', alert);
        }}
      />

      {/* Charts Container */}
      <div className="relative w-full h-full flex flex-col">
        {/* Main Chart */}
        <div className="relative w-full flex-[3]" onContextMenu={openCtxMenu}>
          <MainChart
            ref={mainChartRef}
            candles={candles}
            chartType={chartType}
            symbolMeta={symbolMeta}
            onCrosshairMove={handleChartCrosshairMove}
          />

          {/* Main Indicator Header */}
          {mainIndicatorVisible && (
            <LineIndicatorHeader
              type="main"
              indicators={[]} // TODO: Calculate indicator values for display
              visible={Object.values(mainVisible).some(v => v)}
              onToggleVisible={toggleAllMainIndicators}
              onOpenSetting={() => setShowMainSettings(true)}
              onClose={() => setMainIndicatorVisible(false)}
            />
          )}

          {/* Main Indicator Settings */}
          {showMainSettings && (
            <LineIndicatorSettings
              type="main"
              defaultTab={1}
              mainVisible={mainVisible}
              volumeVisible={volumeVisible}
              periods={periods}
              colors={colors}
              bollFillVisible={bollFillVisible}
              onChange={(mainVis, _, __, per, col, bollFillVis) => {
                if (mainVis) {
                  setMainVisible(mainVis);
                  ma7Ref.current?.applyOptions({ visible: mainVis.ma7 });
                  ma25Ref.current?.applyOptions({ visible: mainVis.ma25 });
                  ma99Ref.current?.applyOptions({ visible: mainVis.ma99 });
                  ema12Ref.current?.applyOptions({ visible: mainVis.ema12 });
                  ema26Ref.current?.applyOptions({ visible: mainVis.ema26 });
                }
                
                if (bollFillVis !== undefined) {
                  setBollFillVisible(bollFillVis);
                }
                
                if (per) setPeriods(per);
                if (col) {
                  setColors(col);
                  ma7Ref.current?.applyOptions({ color: col.ma7 });
                  ma25Ref.current?.applyOptions({ color: col.ma25 });
                  ma99Ref.current?.applyOptions({ color: col.ma99 });
                  ema12Ref.current?.applyOptions({ color: col.ema12 });
                  ema26Ref.current?.applyOptions({ color: col.ema26 });
                }
              }}
              onClose={() => setShowMainSettings(false)}
            />
          )}
        </div>

        {/* Divider */}
        <div 
          className="w-full h-[2px] bg-[#2b3139] shrink-0 relative z-10"
          style={{ boxShadow: '0 0 3px rgba(80, 77, 77, 0.4)' }}
        />

        {/* Volume Chart */}
        <div className="relative w-full flex-1">
          <VolumeChart
            ref={volumeChartRef}
            volumeData={volumeData}
            timeScale={mainChartRef.current?.chart?.timeScale()}
          />

          {/* Volume Indicator Header */}
          {volumeIndicatorVisible && (
            <LineIndicatorHeader
              type="volume"
              indicators={[]} // TODO: Calculate indicator values for display
              visible={Object.values(volumeVisible).some(v => v)}
              onToggleVisible={toggleAllVolumeIndicators}
              onOpenSetting={() => setShowVolumeSettings(true)}
              onClose={() => setVolumeIndicatorVisible(false)}
            />
          )}

          {/* Volume Indicator Settings */}
          {showVolumeSettings && (
            <LineIndicatorSettings
              type="volume"
              defaultTab={2}
              mainVisible={mainVisible}
              volumeVisible={volumeVisible}
              periods={periods}
              colors={colors}
              bollFillVisible={bollFillVisible}
              onChange={(_, volumeVis, __, per, col) => {
                if (volumeVis) {
                  setVolumeVisible(volumeVis);
                  mavol1Ref.current?.applyOptions({ visible: volumeVis.mavol1 });
                  mavol2Ref.current?.applyOptions({ visible: volumeVis.mavol2 });
                }
                
                if (per) setPeriods(per);
                if (col) {
                  setColors(col);
                  mavol1Ref.current?.applyOptions({ color: col.mavol1 });
                  mavol2Ref.current?.applyOptions({ color: col.mavol2 });
                }
              }}
              onClose={() => setShowVolumeSettings(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default TradingBinance;