import React from 'react';
import { X, Shield, TrendingDown, TrendingUp, Target, Clock, Percent, AlertTriangle, Wallet } from 'lucide-react';

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
  // Thêm từ WS event
  dailyStartBalance?: string;
  currentBalance?: number;
  timestamp?: number;
}

interface RiskConfigViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  riskConfig: RiskConfigData | null;
}

// ==================== COMPONENT ====================
const RiskConfigViewModal: React.FC<RiskConfigViewModalProps> = ({
  isOpen,
  onClose,
  riskConfig,
}) => {
  if (!isOpen) return null;

  // Tính Daily PnL nếu có balance data
  const dailyPnL = riskConfig?.currentBalance && riskConfig?.dailyStartBalance
    ? riskConfig.currentBalance - parseFloat(riskConfig.dailyStartBalance)
    : null;
  
  const dailyPnLPercent = dailyPnL && riskConfig?.dailyStartBalance
    ? (dailyPnL / parseFloat(riskConfig.dailyStartBalance)) * 100
    : null;

  // Check nếu đã vượt daily loss limit
  const dailyLossLimit = riskConfig ? parseFloat(riskConfig.dailyLossLimit) : 0;
  const isOverDailyLimit = dailyPnLPercent !== null && dailyPnLPercent < -dailyLossLimit;

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
              <p className="text-xs text-gray-400">Giới hạn giao dịch được Admin cấu hình</p>
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
          {!riskConfig ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Shield className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-gray-400">Chưa có Risk Config</p>
              <p className="text-gray-500 text-sm mt-1">Đang chờ dữ liệu từ server...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Config Name */}
              <div className="bg-[#1e293b] rounded-xl p-4 border border-[#334155]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white text-lg">{riskConfig.name}</h3>
                    {riskConfig.description && (
                      <p className="text-sm text-gray-500 mt-1">{riskConfig.description}</p>
                    )}
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                    Đang áp dụng
                  </span>
                </div>
              </div>

              {/* Daily Balance Info */}
              {(riskConfig.dailyStartBalance || riskConfig.currentBalance) && (
                <div className={`rounded-xl p-4 border ${isOverDailyLimit ? 'bg-red-500/10 border-red-500/30' : 'bg-[#1e293b] border-[#334155]'}`}>
                  <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Số dư hôm nay
                    {isOverDailyLimit && (
                      <span className="ml-auto flex items-center gap-1 text-red-400 text-xs">
                        <AlertTriangle className="w-3 h-3" />
                        Vượt giới hạn!
                      </span>
                    )}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Số dư đầu ngày</p>
                      <p className="text-lg font-semibold text-white">
                        {parseFloat(riskConfig.dailyStartBalance || "0").toFixed(2)} USDT
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Số dư hiện tại</p>
                      <p className="text-lg font-semibold text-white">
                        {(riskConfig.currentBalance || 0).toFixed(2)} USDT
                      </p>
                    </div>
                  </div>
                  {dailyPnL !== null && (
                    <div className="mt-3 pt-3 border-t border-[#334155]">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Lãi/Lỗ hôm nay</span>
                        <span className={`text-lg font-bold ${dailyPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {dailyPnL >= 0 ? '+' : ''}{dailyPnL.toFixed(2)} USDT
                          <span className="text-sm ml-1">
                            ({dailyPnLPercent! >= 0 ? '+' : ''}{dailyPnLPercent!.toFixed(2)}%)
                          </span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TP/SL Settings */}
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
                    <p className="text-2xl font-bold text-white">
                      +{riskConfig.takeProfitConfig.value}%
                    </p>
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
                    <p className="text-2xl font-bold text-white">
                      -{riskConfig.stopLossConfig.value}%
                    </p>
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
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-[#334155] hover:bg-[#475569] text-white font-medium rounded-lg transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default RiskConfigViewModal;