import React, { useState, useMemo } from 'react';
import { X, Shield, TrendingDown, TrendingUp, Target, Clock, Percent, AlertTriangle, Wallet, Loader2, Check, Info } from 'lucide-react';
import { binanceWS } from '../../binancewebsocket/BinanceWebSocketService';

// ==================== TYPES ====================
interface TradingHours {
  enabled: boolean;
  timezone: string;
  allowedHours: {
    start: string;
    end: string;
  };
  allowWeekends: boolean;
}

interface StopLossConfig {
  enabled: boolean;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  orderType: 'STOP_MARKET' | 'STOP_LIMIT';
}

interface TakeProfitConfig {
  enabled: boolean;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
}

interface RiskConfigData {
  name: string;
  description?: string;
  maxOpenPositions: number;
  maxPositionSizePercent: string;
  existingPositionSize: string;
  dailyLossLimit: string;
  maxDrawdownPercent: string;
  leverageLimit: number;
  tradingHours: TradingHours;
  stopLossConfig: StopLossConfig;
  takeProfitConfig: TakeProfitConfig;
  isActive?: boolean;
  dailyStartBalance?: string;
  currentBalance?: number;
  timestamp?: number;
}

// ✅ Thêm interface cho OpenOrder
interface OpenOrder {
  orderId: number | string;
  symbol: string;
  type: string;
  side: string;
  positionSide?: string;
  price?: string;
  stopPrice?: string;
  origQty?: string;
  status?: string;
  isAlgo?: boolean;
  algoId?: number;
}

interface RiskConfigAutoModalProps {
  isOpen: boolean;
  onClose: () => void;
  riskConfig: RiskConfigData | null;
  symbol: string;
  entryPrice: number;
  markPrice: number;
  positionAmt: number;
  leverage?: number;
  getPriceTick?: (symbol: string) => number;
  // ✅ Thêm prop mới
  openOrders?: OpenOrder[];
}

// ==================== COMPONENT ====================
const RiskConfigAutoModal: React.FC<RiskConfigAutoModalProps> = ({
  isOpen,
  onClose,
  riskConfig,
  symbol,
  entryPrice,
  markPrice,
  positionAmt,
  leverage,
  getPriceTick,
  openOrders = [], // ✅ Default empty array
}) => {
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLong = positionAmt > 0;
  const effectiveLeverage = leverage || 10;
  const positionSide = isLong ? 'LONG' : 'SHORT';

  // ✅ Tìm existing TP/SL orders cho symbol và positionSide này
  const existingTpSlOrders = useMemo(() => {
    return openOrders.filter(order => 
      order.symbol === symbol &&
      order.positionSide === positionSide &&
      (order.type === 'TAKE_PROFIT_MARKET' || 
       order.type === 'TAKE_PROFIT' ||
       order.type === 'STOP_MARKET' || 
       order.type === 'STOP' ||
       order.type === 'STOP_LOSS' ||
       order.type === 'STOP_LOSS_MARKET')
    );
  }, [openOrders, symbol, positionSide]);

  // ============================================
  // ✅ SMART ROUND PRICE FUNCTION (dùng chung)
  // ============================================
  const smartRoundPrice = (
    rawPrice: number, 
    targetRoiPercent: number,
    isForTP: boolean  // true = TP, false = SL
  ): { 
    priceStr: string; 
    rounded: number;
    decimals: number;
    actualRoi: number;
    roiDeviation: number;
  } => {
    const tickSize = getPriceTick ? getPriceTick(symbol) : null;
    
    // ✅ Helper: Calculate actual ROI from price
    const calculateRoi = (price: number): number => {
      const priceMove = isLong 
        ? (isForTP ? price - entryPrice : entryPrice - price)
        : (isForTP ? entryPrice - price : price - entryPrice);
      return (priceMove / entryPrice) * effectiveLeverage * 100;
    };

    // ✅ Helper: Smart decimals based on price magnitude
    const getSmartDecimals = (price: number): number => {
  if (price >= 10000) return 1;
  if (price >= 1000) return 2;
  if (price >= 100) return 3;
  if (price >= 10) return 4;
  if (price >= 1) return 5;
  if (price >= 0.1) return 5;
  if (price >= 0.01) return 6;
  if (price >= 0.0001) return 7;  // ✅ FIX: 0.0001 - 0.01 → 7 decimals
  return 8;
};

    // ✅ Helper: Clean floating point error
    const cleanFloat = (num: number, dec: number): number => {
      return Number(num.toFixed(dec));
    };

    let decimals: number;
    let rounded: number;

    // ✅ Thử dùng tickSize trước
    if (tickSize && tickSize > 0) {
      const tickStr = tickSize.toString();
      let tickDecimals = 0;
      if (tickStr.includes('e-')) {
        tickDecimals = parseInt(tickStr.split('e-')[1], 10);
      } else if (tickStr.includes('.')) {
        tickDecimals = tickStr.split('.')[1].length;
      }
      
      // ✅ FIX: Clean floating point ngay sau khi round
      const tickRounded = Math.round(rawPrice / tickSize) * tickSize;
      const tickRoundedClean = cleanFloat(tickRounded, tickDecimals);
      
      // ✅ CHECK: Nếu tickSize gây deviation giá > 3% → tickSize sai, dùng smart decimals
      const priceDeviation = Math.abs(tickRoundedClean - rawPrice) / rawPrice * 100;
      
      if (priceDeviation > 3) {
        console.warn(`⚠️ tickSize ${tickSize} gây price deviation ${priceDeviation.toFixed(1)}%, dùng smart decimals`);
        decimals = getSmartDecimals(rawPrice);
        rounded = cleanFloat(rawPrice, decimals);
      } else {
        // tickSize OK, dùng nó
        decimals = tickDecimals;
        rounded = tickRoundedClean;
      }
    } else {
      // Không có tickSize, dùng smart decimals
      decimals = getSmartDecimals(rawPrice);
      rounded = cleanFloat(rawPrice, decimals);
    }

    // ✅ FIX: Đảm bảo priceStr không có floating point error
    const priceStr = rounded.toFixed(decimals);
    const actualRoi = calculateRoi(rounded);
    const roiDeviation = targetRoiPercent > 0 
      ? Math.abs(actualRoi - targetRoiPercent) / targetRoiPercent * 100
      : 0;

    console.log('🔢 smartRoundPrice:', {
      rawPrice,
      tickSize,
      decimals,
      rounded,
      priceStr,
      targetRoi: targetRoiPercent + '%',
      actualRoi: actualRoi.toFixed(2) + '%',
      roiDeviation: roiDeviation.toFixed(2) + '%'
    });

    return { priceStr, rounded, decimals, actualRoi, roiDeviation };
  };

  // ============================================
  // ✅ CALCULATE ROI-BASED PREVIEW PRICES
  // ============================================
  const previewPrices = useMemo(() => {
    if (!riskConfig || !entryPrice) {
      return { tp: null, sl: null };
    }

    let tp: { raw: number; rounded: string; actualRoi: number; roiDeviation: number } | null = null;
    let sl: { raw: number; rounded: string; actualRoi: number; roiDeviation: number } | null = null;

    // ✅ TP: ROI-based calculation
    if (riskConfig.takeProfitConfig?.enabled && riskConfig.takeProfitConfig.value > 0) {
      const tpRoiPercent = riskConfig.takeProfitConfig.value;
      const tpPriceMove = entryPrice * (tpRoiPercent / 100) / effectiveLeverage;
      const tpRaw = isLong 
        ? entryPrice + tpPriceMove
        : entryPrice - tpPriceMove;

      if (tpRaw > 0) {
        const result = smartRoundPrice(tpRaw, tpRoiPercent, true);
        tp = { 
          raw: tpRaw, 
          rounded: result.priceStr, 
          actualRoi: result.actualRoi, 
          roiDeviation: result.roiDeviation
        };
      }
    }

    // ✅ SL: ROI-based calculation
    if (riskConfig.stopLossConfig?.enabled && riskConfig.stopLossConfig.value > 0) {
      const slRoiPercent = riskConfig.stopLossConfig.value;
      const slPriceMove = entryPrice * (slRoiPercent / 100) / effectiveLeverage;
      const slRaw = isLong
        ? entryPrice - slPriceMove
        : entryPrice + slPriceMove;

      if (slRaw > 0) {
        const result = smartRoundPrice(slRaw, slRoiPercent, false);
        sl = { 
          raw: slRaw, 
          rounded: result.priceStr, 
          actualRoi: result.actualRoi, 
          roiDeviation: result.roiDeviation
        };
      }
    }

    return { tp, sl };
  }, [riskConfig, entryPrice, effectiveLeverage, isLong, symbol]);

  // Daily PnL
  const dailyPnL = riskConfig?.currentBalance && riskConfig?.dailyStartBalance
    ? riskConfig.currentBalance - parseFloat(riskConfig.dailyStartBalance)
    : null;
  
  const dailyPnLPercent = dailyPnL && riskConfig?.dailyStartBalance
    ? (dailyPnL / parseFloat(riskConfig.dailyStartBalance)) * 100
    : null;

  const dailyLossLimit = riskConfig ? parseFloat(riskConfig.dailyLossLimit) : 0;
  const isOverDailyLimit = dailyPnLPercent !== null && dailyPnLPercent < -dailyLossLimit;

  // ============================================
// ✅ CANCEL EXISTING TP/SL ORDERS - GỌI cancelFuturesAlgoOrder
// ============================================
const cancelExistingTpSl = async (): Promise<{ cancelled: number; errors: string[] }> => {
  const errors: string[] = [];
  let cancelled = 0;

  if (existingTpSlOrders.length === 0) {
    console.log('📋 Không có TP/SL cũ cần hủy');
    return { cancelled: 0, errors: [] };
  }

  console.log(`🗑️ Đang hủy ${existingTpSlOrders.length} TP/SL cũ...`, existingTpSlOrders);

  for (const order of existingTpSlOrders) {
    try {
      const orderSymbol = order.symbol;
      
      // ✅ Lấy algoId - TP/SL orders là algo orders
      const algoId = order.algoId || order.orderId;
      
      if (!algoId) {
        console.warn('⚠️ Order không có ID:', order);
        continue;
      }

      console.log(`🗑️ Cancelling Algo order:`, {
        symbol: orderSymbol,
        algoId: algoId,
        type: order.type
      });
      
      // ✅ Gọi action cancelFuturesAlgoOrder
      (binanceWS as any).sendAuthed({
        action: 'cancelFuturesAlgoOrder',
        symbol: orderSymbol,
        algoId: Number(algoId)
      });
      
      cancelled++;
      console.log(`✅ Đã gửi cancel algo: ${order.type} #${algoId}`);
    } catch (err: any) {
      const errMsg = `Hủy ${order.type} thất bại: ${err?.message || 'Unknown'}`;
      console.error(`❌ ${errMsg}`);
      errors.push(errMsg);
    }
  }

  // ✅ Đợi backend xử lý xong
  if (cancelled > 0) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { cancelled, errors };
};

  // ============================================
  // ✅ HANDLE APPLY TP/SL
  // ============================================
  const handleApplyTpSl = async () => {
    if (!riskConfig) {
      console.error('❌ No risk config');
      return;
    }

    setApplying(true);
    setApplySuccess(false);
    setError(null);

    try {
      const { takeProfitConfig, stopLossConfig } = riskConfig;
      const isLongPosition = positionAmt > 0;
      const absPositionAmt = Math.abs(positionAmt);
      const currentPositionSide = isLongPosition ? 'LONG' : 'SHORT';

      console.log('📊 Applying TP/SL with config:', {
        symbol,
        entryPrice,
        positionAmt,
        isLong: isLongPosition,
        positionSide: currentPositionSide,
        leverage: effectiveLeverage,
        takeProfitConfig,
        stopLossConfig,
        existingOrders: existingTpSlOrders.length
      });

      // ✅ STEP 1: Hủy TP/SL cũ trước
      const { cancelled, errors: cancelErrors } = await cancelExistingTpSl();
      if (cancelled > 0) {
        console.log(`✅ Đã hủy ${cancelled} TP/SL cũ`);
      }

      // Log tickSize để debug
      const tickSize = getPriceTick ? getPriceTick(symbol) : null;
      console.log('🔢 TickSize for', symbol, ':', tickSize);

      const formatQuantity = (qty: number): string => {
        if (qty >= 1) {
          return String(Math.floor(qty * 100000) / 100000);
        }
        return qty.toFixed(8);
      };

      const orders: any[] = [];
      const warnings: string[] = [...cancelErrors]; // Include cancel errors as warnings

      // 🎯 TAKE PROFIT
      if (takeProfitConfig?.enabled && takeProfitConfig.value > 0 && previewPrices.tp) {
        const tpRounded = parseFloat(previewPrices.tp.rounded);
        
        // ✅ Chỉ validate: TP phải có lãi (đúng hướng)
        const tpValid = isLongPosition ? tpRounded > entryPrice : tpRounded < entryPrice;
        
        if (!tpValid) {
          warnings.push(`TP không hợp lệ: giá ${previewPrices.tp.rounded} không có lãi`);
        } else {
          // ✅ Warning nếu ROI lệch nhiều, nhưng VẪN ĐẶT
          if (previewPrices.tp.roiDeviation > 10) {
            warnings.push(`TP: ${takeProfitConfig.value}% → ${previewPrices.tp.actualRoi.toFixed(1)}%`);
          }

          console.log('🎯 TP Order:', {
            targetRoi: takeProfitConfig.value + '%',
            actualRoi: previewPrices.tp.actualRoi.toFixed(2) + '%',
            stopPrice: previewPrices.tp.rounded,
          });

          orders.push({
            symbol,
            side: isLongPosition ? 'SELL' : 'BUY',
            positionSide: currentPositionSide,
            type: 'TAKE_PROFIT_MARKET',
            stopPrice: previewPrices.tp.rounded,
            quantity: formatQuantity(absPositionAmt),
            closePosition: 'true',
            workingType: 'MARK_PRICE',
            priceProtect: 'TRUE',
          });
        }
      }

      // 🛑 STOP LOSS
      if (stopLossConfig?.enabled && stopLossConfig.value > 0 && previewPrices.sl) {
        const slRounded = parseFloat(previewPrices.sl.rounded);
        
        // ✅ Chỉ validate: SL phải có lỗ (đúng hướng)
        const slValid = isLongPosition ? slRounded < entryPrice : slRounded > entryPrice;
        
        if (!slValid) {
          warnings.push(`SL không hợp lệ: giá ${previewPrices.sl.rounded} không có lỗ`);
        } else {
          // ✅ Warning nếu ROI lệch nhiều, nhưng VẪN ĐẶT
          if (previewPrices.sl.roiDeviation > 10) {
            warnings.push(`SL: ${stopLossConfig.value}% → ${previewPrices.sl.actualRoi.toFixed(1)}%`);
          }

          console.log('🛑 SL Order:', {
            targetRoi: '-' + stopLossConfig.value + '%',
            actualRoi: '-' + previewPrices.sl.actualRoi.toFixed(2) + '%',
            stopPrice: previewPrices.sl.rounded,
          });

          orders.push({
            symbol,
            side: isLongPosition ? 'SELL' : 'BUY',
            positionSide: currentPositionSide,
            type: stopLossConfig.orderType || 'STOP_MARKET',
            stopPrice: previewPrices.sl.rounded,
            quantity: formatQuantity(absPositionAmt),
            closePosition: 'true',
            workingType: 'MARK_PRICE',
            priceProtect: 'TRUE',
          });
        }
      }

      if (orders.length === 0) {
        throw new Error(warnings.length > 0 
          ? `Không có lệnh hợp lệ: ${warnings.join(', ')}`
          : 'Không có TP/SL nào được kích hoạt');
      }

      console.log('📤 Placing orders:', JSON.stringify(orders, null, 2));

      let successCount = 0;
      const orderErrors: string[] = [];
      
      for (const order of orders) {
        try {
          await binanceWS.placeOrder(order);
          console.log('✅ Order placed:', order.type, '@', order.stopPrice);
          successCount++;
        } catch (orderErr: any) {
          console.error('❌ Order failed:', order.type, orderErr);
          orderErrors.push(`${order.type}: ${orderErr?.message || 'Unknown'}`);
        }
      }

      if (successCount > 0) {
  setApplySuccess(true);
  
  // ✅ Lưu metadata VỚI isAuto flag
  const tpslMetadata = JSON.parse(localStorage.getItem('tpsl_metadata') || '{}');
  const metaKey = `${symbol}:${currentPositionSide}`;
  tpslMetadata[metaKey] = {
    tpInputRoi: takeProfitConfig?.enabled ? String(takeProfitConfig.value) : null,
    slInputRoi: stopLossConfig?.enabled ? String(stopLossConfig.value) : null,
    entryPrice,
    timestamp: Date.now(),
    isAuto: true  // ✅ THÊM FLAG NÀY
  };
  localStorage.setItem('tpsl_metadata', JSON.stringify(tpslMetadata));
  console.log('💾 Saved tpsl_metadata (AUTO):', metaKey, tpslMetadata[metaKey]);
        const allIssues = [...warnings, ...orderErrors];
        if (allIssues.length > 0) {
          setError(`Đặt ${successCount}/${orders.length} lệnh. ⚠️ ${allIssues.join('; ')}`);
        }
        setTimeout(() => onClose(), 1500);
      } else {
        throw new Error(`Thất bại: ${orderErrors.join(', ')}`);
      }

    } catch (err: any) {
      console.error('❌ Error:', err);
      setError(err.message || 'Lỗi khi áp dụng TP/SL');
    } finally {
      setApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl w-full max-w-md max-h-[85vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#334155]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#f0b90b]/20 rounded-lg">
              <Shield className="w-5 h-5 text-[#f0b90b]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Risk Config của bạn</h2>
              <p className="text-xs text-gray-400">{symbol} • Leverage {effectiveLeverage}x</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#334155] rounded-lg transition-colors text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(85vh-180px)]">
          {!riskConfig ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Shield className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-gray-400">Không có risk config</p>
            </div>
          ) : applySuccess ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-xl font-bold text-white mb-2">Thành công!</p>
              <p className="text-gray-400">Đã áp dụng TP/SL theo Risk Config</p>
              {error && (
                <p className="text-yellow-400 text-sm mt-2">{error}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Config Name */}
              <div className="bg-gradient-to-r from-[#f0b90b]/10 to-transparent p-3 rounded-xl border border-[#f0b90b]/20">
                <p className="text-[#f0b90b] font-medium">{riskConfig.name}</p>
                {riskConfig.description && (
                  <p className="text-xs text-gray-400 mt-1">{riskConfig.description}</p>
                )}
              </div>

              {/* ✅ Hiển thị cảnh báo nếu có TP/SL cũ */}
              {existingTpSlOrders.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Có {existingTpSlOrders.length} TP/SL cũ sẽ được thay thế
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {existingTpSlOrders.map((order, idx) => (
                      <p key={idx} className="text-xs text-gray-400">
                        • {order.type} @ {order.stopPrice || order.price}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && !applySuccess && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm">{error}</span>
                  </div>
                </div>
              )}

              {/* Daily PnL Warning */}
              {isOverDailyLimit && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">Đã vượt Daily Loss Limit!</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    PnL hôm nay: {dailyPnLPercent?.toFixed(2)}% (Limit: -{dailyLossLimit}%)
                  </p>
                </div>
              )}

              {/* TP/SL Preview */}
              <div className="grid grid-cols-2 gap-3">
                {/* Take Profit */}
                <div className={`p-4 rounded-xl border ${
                  riskConfig.takeProfitConfig?.enabled 
                    ? 'bg-green-500/10 border-green-500/30' 
                    : 'bg-gray-500/10 border-gray-500/30'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className={`w-4 h-4 ${
                      riskConfig.takeProfitConfig?.enabled ? 'text-green-400' : 'text-gray-500'
                    }`} />
                    <span className={`text-sm font-medium ${
                      riskConfig.takeProfitConfig?.enabled ? 'text-green-400' : 'text-gray-500'
                    }`}>
                      Take Profit
                    </span>
                  </div>
                  {riskConfig.takeProfitConfig?.enabled ? (
                    <>
                      <p className="text-2xl font-bold text-white">
                        +{riskConfig.takeProfitConfig.value}%
                      </p>
                      {previewPrices.tp && (
                        <>
                          <p className="text-xs text-gray-400 mt-1">
                            ≈ {previewPrices.tp.rounded} USDT
                          </p>
                          {/* ✅ Hiện actual ROI nếu khác target */}
                          {previewPrices.tp.roiDeviation > 5 && (
                            <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                              <Info className="w-3 h-3" />
                              ROI thực: +{previewPrices.tp.actualRoi.toFixed(1)}%
                            </p>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-500">Không giới hạn</p>
                  )}
                </div>

                {/* Stop Loss */}
                <div className={`p-4 rounded-xl border ${
                  riskConfig.stopLossConfig?.enabled 
                    ? 'bg-red-500/10 border-red-500/30' 
                    : 'bg-gray-500/10 border-gray-500/30'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className={`w-4 h-4 ${
                      riskConfig.stopLossConfig?.enabled ? 'text-red-400' : 'text-gray-500'
                    }`} />
                    <span className={`text-sm font-medium ${
                      riskConfig.stopLossConfig?.enabled ? 'text-red-400' : 'text-gray-500'
                    }`}>
                      Stop Loss
                    </span>
                  </div>
                  {riskConfig.stopLossConfig?.enabled ? (
                    <>
                      <p className="text-2xl font-bold text-white">
                        -{riskConfig.stopLossConfig.value}%
                      </p>
                      {previewPrices.sl && (
                        <>
                          <p className="text-xs text-gray-400 mt-1">
                            ≈ {previewPrices.sl.rounded} USDT
                          </p>
                          {/* ✅ Hiện actual ROI nếu khác target */}
                          {previewPrices.sl.roiDeviation > 5 && (
                            <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                              <Info className="w-3 h-3" />
                              ROI thực: -{previewPrices.sl.actualRoi.toFixed(1)}%
                            </p>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-500">Không giới hạn</p>
                  )}
                </div>
              </div>

              {/* Position Limits */}
              <div className="bg-[#1e293b] rounded-xl p-4 border border-[#334155]">
                <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Giới hạn Position
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Leverage tối đa</p>
                    <p className="text-lg font-semibold text-[#f0b90b]">x{riskConfig.leverageLimit}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Max Positions</p>
                    <p className="text-lg font-semibold text-white">{riskConfig.maxOpenPositions}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Max Size / Position</p>
                    <p className="text-lg font-semibold text-white">{riskConfig.maxPositionSizePercent}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Existing Position Size</p>
                    <p className="text-lg font-semibold text-white">{riskConfig.existingPositionSize}%</p>
                  </div>
                </div>
              </div>

              {/* Risk Limits */}
              <div className="bg-[#1e293b] rounded-xl p-4 border border-[#334155]">
                <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                  <Percent className="w-4 h-4" />
                  Giới hạn Rủi ro
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Daily Loss Limit</p>
                    <p className={`text-lg font-semibold ${isOverDailyLimit ? 'text-red-400' : 'text-orange-400'}`}>
                      {riskConfig.dailyLossLimit}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Max Drawdown</p>
                    <p className="text-lg font-semibold text-red-400">{riskConfig.maxDrawdownPercent}%</p>
                  </div>
                </div>
              </div>

              {/* Trading Hours */}
              {riskConfig.tradingHours?.enabled && (
                <div className="bg-[#1e293b] rounded-xl p-4 border border-[#334155]">
                  <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Giờ giao dịch
                  </h4>
                  <div className="flex items-center justify-between">
                    <span className="text-white">
                      {riskConfig.tradingHours.allowedHours.start} - {riskConfig.tradingHours.allowedHours.end}
                    </span>
                    <span className="text-xs text-gray-500">
                      {riskConfig.tradingHours.timezone}
                    </span>
                  </div>
                  {!riskConfig.tradingHours.allowWeekends && (
                    <p className="text-xs text-yellow-500 mt-2">⚠️ Không giao dịch cuối tuần</p>
                  )}
                </div>
              )}

              {/* Last Updated */}
              {riskConfig.timestamp && (
                <p className="text-xs text-gray-500 text-center">
                  Cập nhật lúc: {new Date(riskConfig.timestamp).toLocaleString('vi-VN')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#334155] bg-[#1e293b]">
          {riskConfig && !applySuccess ? (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={applying}
                className="flex-1 px-4 py-2.5 bg-[#334155] hover:bg-[#475569] text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Đóng
              </button>
              <button
                onClick={handleApplyTpSl}
                disabled={applying || (!riskConfig.takeProfitConfig?.enabled && !riskConfig.stopLossConfig?.enabled)}
                className="flex-1 px-4 py-2.5 bg-[#f0b90b] hover:bg-[#d19b09] text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {applying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang áp dụng...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    {existingTpSlOrders.length > 0 ? 'Thay thế TP/SL' : 'Áp dụng TP/SL'}
                  </>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 bg-[#334155] hover:bg-[#475569] text-white font-medium rounded-lg transition-colors"
            >
              Đóng
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RiskConfigAutoModal;