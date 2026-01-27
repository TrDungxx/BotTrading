import React, { useState, useEffect } from 'react';
import { X, Shield, Loader2, TrendingDown, TrendingUp, AlertTriangle, Target, Clock, Percent, Check } from 'lucide-react';
import { apiRequest } from '../../../utils/api';
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

interface RiskConfig {
  id?: number;
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
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface RiskConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  // For Trading Position (optional)
  symbol?: string;
  entryPrice?: number;
  markPrice?: number;
  positionAmt?: number;
  leverage?: number;
  getPriceTick?: (symbol: string) => number;
  // For Binance Account (optional)
  accountId?: number;
  accountName?: string;
  accountEmail?: string;
  riskConfigId?: number;
  // ✅ NEW: Risk config from WebSocket
  wsRiskConfig?: any;
}

// ==================== COMPONENT ====================
const RiskConfigModal: React.FC<RiskConfigModalProps> = ({
  isOpen,
  onClose,
  symbol,
  entryPrice,
  markPrice,
  positionAmt,
  leverage,
  getPriceTick,
  accountId,
  accountName,
  accountEmail,
  riskConfigId,
  wsRiskConfig, // ✅ NEW
}) => {
  const [config, setConfig] = useState<RiskConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false); // ✅ NEW: Loading state khi đặt TP/SL
  const [applySuccess, setApplySuccess] = useState(false); // ✅ NEW: Success state

  const isLong = positionAmt ? positionAmt > 0 : false;
  const isAccountView = !!accountId; // Kiểm tra xem có phải view từ Binance Account không
  const isPositionView = !!symbol && !!positionAmt && positionAmt !== 0; // ✅ NEW: Kiểm tra có position không

  // ✅ Fetch config khi mở modal
  useEffect(() => {
    if (isOpen) {
      // Ưu tiên 1: wsRiskConfig từ props
      if (wsRiskConfig && !riskConfigId) {
        console.log('🛡️ Using risk config from WebSocket props');
        setConfig(wsRiskConfig);
        setLoading(false);
        return;
      }

      // Ưu tiên 2: localStorage (WebSocket đã lưu)
      if (!riskConfigId) {
        try {
          const saved = localStorage.getItem('ws_risk_config');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.config) {
              console.log('🛡️ Using risk config from localStorage (WebSocket)');
              setConfig(parsed.config);
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          console.error('Error loading from localStorage:', err);
        }
      }

      // Ưu tiên 3: Fetch từ API (fallback)
      console.log('📡 Fetching risk config from API...');
      fetchMyRiskConfig();
    }
  }, [isOpen, riskConfigId, wsRiskConfig]);

  const fetchMyRiskConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Fetching risk config...', { riskConfigId, isAccountView });
      
      let response;
      let configData: RiskConfig | null = null;
      
      // Nếu có riskConfigId (từ Binance Account) → fetch trực tiếp theo ID
      if (riskConfigId) {
        console.log(`📌 Fetching risk config by ID: ${riskConfigId}`);
        try {
          response = await apiRequest(`/risk-config/getById?id=${riskConfigId}`, { method: 'GET' });
          console.log('✅ getById response:', response);
          
          const responseData = (response as any).Data || (response as any).data;
          
          // Parse response
          if (responseData) {
            if (responseData.data && responseData.data.id) {
              configData = responseData.data;
            } else if (responseData.id) {
              configData = responseData;
            }
          }
        } catch (err: any) {
          console.error('❌ Failed to fetch by ID:', err);
          
          // Nếu lỗi 403 (User không có quyền) → fallback về my-configs
          if (err?.response?.status === 403 || err?.message?.includes('403')) {
            console.log('⚠️ 403 Forbidden, trying my-configs fallback...');
            // Fallback: fetch my-configs
            try {
              response = await apiRequest('/risk-config/my-configs', { method: 'GET' });
              console.log('✅ my-configs fallback response:', response);
              
              const responseData = (response as any).Data || (response as any).data;
              
              // Parse config - lấy config đầu tiên hoặc active
              if (responseData) {
                if (Array.isArray(responseData)) {
                  configData = responseData.find((c: RiskConfig) => c.isActive) || responseData[0];
                } else if (Array.isArray(responseData.data)) {
                  configData = responseData.data.find((c: RiskConfig) => c.isActive) || responseData.data[0];
                } else if (responseData.id) {
                  configData = responseData;
                }
              }
            } catch (e2) {
              throw new Error('Không thể tải Risk Config');
            }
          } else {
            throw new Error('Không thể tải Risk Config theo ID');
          }
        }
      } else {
        // Không có riskConfigId → fetch "my-configs" (cho Trading)
        console.log('📌 Fetching my-configs...');
        
        // Thử endpoint 1: /risk-config/my-configs
        try {
          response = await apiRequest('/risk-config/my-configs', { method: 'GET' });
          console.log('✅ my-configs response:', response);
        } catch (e1) {
          console.log('⚠️ /risk-config/my-configs failed, trying /m-sys/risk/my-active...');
          // Thử endpoint 2: /m-sys/risk/my-active
          try {
            response = await apiRequest('/m-sys/risk/my-active', { method: 'GET' });
            console.log('✅ my-active response:', response);
          } catch (e2) {
            throw new Error('Không thể tải Risk Config');
          }
        }
        
        const responseData = (response as any).Data || (response as any).data;
        console.log('📦 Response data:', responseData);
        
        // Parse config - có thể là object hoặc array
        if (responseData) {
          if (Array.isArray(responseData)) {
            // Lấy config đầu tiên hoặc config active
            configData = responseData.find((c: RiskConfig) => c.isActive) || responseData[0];
          } else if (Array.isArray(responseData.data)) {
            configData = responseData.data.find((c: RiskConfig) => c.isActive) || responseData.data[0];
          } else if (responseData.id) {
            // Response là 1 object config
            configData = responseData;
          }
        }
      }
      
      console.log('📊 Parsed config:', configData);
      setConfig(configData);
      
    } catch (err: any) {
      console.error('❌ Error fetching risk config:', err);
      setError('Không thể tải Risk Config của bạn');
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Hàm tính giá TP/SL và đặt lệnh
  const handleApplyTpSl = async () => {
    if (!config || !symbol || !entryPrice || !positionAmt) {
      console.error('❌ Missing required data for TP/SL');
      return;
    }

    setApplying(true);
    setApplySuccess(false);

    try {
      const { takeProfitConfig, stopLossConfig } = config;
      const isLongPosition = positionAmt > 0;
      const absPositionAmt = Math.abs(positionAmt);
      
      console.log('📊 Applying TP/SL with config:', {
        symbol,
        entryPrice,
        positionAmt,
        isLong: isLongPosition,
        takeProfitConfig,
        stopLossConfig
      });

      // Helper function để làm tròn giá theo tickSize
      const roundPrice = (price: number): number => {
        if (!getPriceTick) return price;
        const tickSize = getPriceTick(symbol);
        return Math.round(price / tickSize) * tickSize;
      };

      const orders: any[] = [];

      // 🎯 Tính và đặt Take Profit
      if (takeProfitConfig?.enabled && takeProfitConfig.value > 0) {
        const tpPercent = takeProfitConfig.value / 100; // 100% -> 1.0
        let tpPrice = isLongPosition 
          ? entryPrice * (1 + tpPercent)
          : entryPrice * (1 - tpPercent);
        
        tpPrice = roundPrice(tpPrice);

        console.log('🎯 TP Order:', {
          side: isLongPosition ? 'SELL' : 'BUY',
          price: tpPrice,
          percent: tpPercent * 100
        });

        orders.push({
          symbol,
          side: isLongPosition ? 'SELL' : 'BUY',
          type: 'TAKE_PROFIT_MARKET',
          stopPrice: tpPrice,
          quantity: absPositionAmt,
          closePosition: true,
          workingType: 'MARK_PRICE',
          priceProtect: true,
        });
      }

      // 🛑 Tính và đặt Stop Loss
      if (stopLossConfig?.enabled && stopLossConfig.value > 0) {
        const slPercent = stopLossConfig.value / 100; // 1000% -> 10.0
        let slPrice = isLongPosition
          ? entryPrice * (1 - slPercent)
          : entryPrice * (1 + slPercent);
        
        slPrice = roundPrice(slPrice);

        console.log('🛑 SL Order:', {
          side: isLongPosition ? 'SELL' : 'BUY',
          price: slPrice,
          percent: slPercent * 100,
          orderType: stopLossConfig.orderType
        });

        orders.push({
          symbol,
          side: isLongPosition ? 'SELL' : 'BUY',
          type: stopLossConfig.orderType || 'STOP_MARKET',
          stopPrice: slPrice,
          quantity: absPositionAmt,
          closePosition: true,
          workingType: 'MARK_PRICE',
          priceProtect: true,
        });
      }

      // 📤 Gửi các lệnh
      if (orders.length === 0) {
        throw new Error('Không có TP/SL nào được kích hoạt trong config');
      }

      console.log('📤 Placing orders:', orders);

      // Đặt lệnh qua WebSocket hoặc API
      for (const order of orders) {
        try {
          await binanceWS.placeOrder(order);
          console.log('✅ Order placed:', order.type);
        } catch (orderErr: any) {
          console.error('❌ Failed to place order:', orderErr);
          throw new Error(`Lỗi đặt lệnh ${order.type}: ${orderErr.message}`);
        }
      }

      // ✅ Success
      setApplySuccess(true);
      
      // Auto close sau 1.5s
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err: any) {
      console.error('❌ Error applying TP/SL:', err);
      setError(err.message || 'Lỗi khi áp dụng TP/SL');
    } finally {
      setApplying(false);
    }
  };

  // Tính giá TP/SL dự kiến dựa trên config
  const calculatePreviewPrices = () => {
    if (!config || !entryPrice) return { tpPrice: null, slPrice: null };
    
    let tpPrice: number | null = null;
    let slPrice: number | null = null;

    if (config.takeProfitConfig?.enabled && config.takeProfitConfig.value > 0) {
      const tpPercent = config.takeProfitConfig.value / 100;
      tpPrice = isLong 
        ? entryPrice * (1 + tpPercent)
        : entryPrice * (1 - tpPercent);
    }

    if (config.stopLossConfig?.enabled && config.stopLossConfig.value > 0) {
      const slPercent = config.stopLossConfig.value / 100;
      slPrice = isLong
        ? entryPrice * (1 - slPercent)
        : entryPrice * (1 + slPercent);
    }

    return { tpPrice, slPrice };
  };

  const previewPrices = calculatePreviewPrices();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1e293b] rounded-2xl shadow-2xl w-full max-w-2xl border border-[#334155] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#334155] bg-[#0f172a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#fcd535]/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-[#fcd535]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Risk Config của bạn</h2>
              {symbol && (
                <p className="text-sm text-gray-400">{symbol} • Leverage {leverage}x</p>
              )}
              {accountName && (
                <p className="text-sm text-gray-400">{accountName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#334155] rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(85vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#f0b90b] animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-red-400 mb-3" />
              <p className="text-red-400">{error}</p>
              <button
                onClick={fetchMyRiskConfig}
                className="mt-3 text-[#f0b90b] hover:underline text-sm"
              >
                Thử lại
              </button>
            </div>
          ) : !config ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Shield className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-gray-400">Chưa được gán Risk Config</p>
              <p className="text-gray-500 text-sm mt-1">Liên hệ Admin để được cấu hình</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Config Name */}
              <div className="bg-[#1e293b] rounded-xl p-4 border border-[#334155]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white text-lg">{config.name}</h3>
                    {config.description && (
                      <p className="text-sm text-gray-500 mt-1">{config.description}</p>
                    )}
                  </div>
                  {config.isActive !== undefined && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      config.isActive 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {config.isActive ? 'Đang áp dụng' : 'Không hoạt động'}
                    </span>
                  )}
                </div>
              </div>

              {/* ✅ Success Message */}
              {applySuccess && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <p className="text-green-400 font-medium">Đã áp dụng TP/SL thành công!</p>
                </div>
              )}

              {/* TP/SL Settings */}
              <div className="grid grid-cols-2 gap-3">
                {/* Take Profit */}
                <div className={`p-4 rounded-xl border ${
                  config.takeProfitConfig?.enabled 
                    ? 'bg-green-500/10 border-green-500/30' 
                    : 'bg-gray-500/10 border-gray-500/30'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className={`w-4 h-4 ${
                      config.takeProfitConfig?.enabled ? 'text-green-400' : 'text-gray-500'
                    }`} />
                    <span className={`text-sm font-medium ${
                      config.takeProfitConfig?.enabled ? 'text-green-400' : 'text-gray-500'
                    }`}>
                      Take Profit
                    </span>
                  </div>
                  {config.takeProfitConfig?.enabled ? (
                    <>
                      <p className="text-2xl font-bold text-white">
                        +{config.takeProfitConfig.value}%
                      </p>
                      {!isAccountView && previewPrices.tpPrice && (
                        <p className="text-xs text-gray-400 mt-1">
                          ≈ {previewPrices.tpPrice.toFixed(4)} USDT
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-500">Không giới hạn</p>
                  )}
                </div>

                {/* Stop Loss */}
                <div className={`p-4 rounded-xl border ${
                  config.stopLossConfig?.enabled 
                    ? 'bg-red-500/10 border-red-500/30' 
                    : 'bg-gray-500/10 border-gray-500/30'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className={`w-4 h-4 ${
                      config.stopLossConfig?.enabled ? 'text-red-400' : 'text-gray-500'
                    }`} />
                    <span className={`text-sm font-medium ${
                      config.stopLossConfig?.enabled ? 'text-red-400' : 'text-gray-500'
                    }`}>
                      Stop Loss
                    </span>
                  </div>
                  {config.stopLossConfig?.enabled ? (
                    <>
                      <p className="text-2xl font-bold text-white">
                        -{config.stopLossConfig.value}%
                      </p>
                      {!isAccountView && previewPrices.slPrice && (
                        <p className="text-xs text-gray-400 mt-1">
                          ≈ {previewPrices.slPrice.toFixed(4)} USDT
                        </p>
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
                    <p className="text-lg font-semibold text-[#f0b90b]">x{config.leverageLimit}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Max Positions</p>
                    <p className="text-lg font-semibold text-white">{config.maxOpenPositions}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Max Size / Position</p>
                    <p className="text-lg font-semibold text-white">{config.maxPositionSizePercent}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Existing Position Size</p>
                    <p className="text-lg font-semibold text-white">{config.existingPositionSize}%</p>
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
                    <p className="text-lg font-semibold text-orange-400">{config.dailyLossLimit}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Max Drawdown</p>
                    <p className="text-lg font-semibold text-red-400">{config.maxDrawdownPercent}%</p>
                  </div>
                </div>
              </div>

              {/* Trading Hours */}
              {config.tradingHours?.enabled && (
                <div className="bg-[#1e293b] rounded-xl p-4 border border-[#334155]">
                  <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Giờ giao dịch
                  </h4>
                  <div className="flex items-center justify-between">
                    <span className="text-white">
                      {config.tradingHours.allowedHours.start} - {config.tradingHours.allowedHours.end}
                    </span>
                    <span className="text-xs text-gray-500">
                      {config.tradingHours.timezone}
                    </span>
                  </div>
                  {!config.tradingHours.allowWeekends && (
                    <p className="text-xs text-yellow-500 mt-2">⚠️ Không giao dịch cuối tuần</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#334155] bg-[#1e293b]">
          {/* ✅ Hiển thị nút "Áp dụng TP/SL" chỉ khi có position */}
          {isPositionView && config && !applySuccess ? (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-[#334155] hover:bg-[#475569] text-white font-medium rounded-lg transition-colors"
                disabled={applying}
              >
                Đóng
              </button>
              <button
                onClick={handleApplyTpSl}
                disabled={applying || (!config.takeProfitConfig?.enabled && !config.stopLossConfig?.enabled)}
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
                    Áp dụng TP/SL
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

export default RiskConfigModal;