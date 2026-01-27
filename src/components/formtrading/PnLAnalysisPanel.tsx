import React, { useState, useMemo, useEffect } from "react";
import { ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
import { apiRequest } from "../../utils/api";

// ===== Types =====
interface DailyPnLResponse {
  binanceAccountId: number;
  date: string;
  dailyStartBalance: number;
  currentBalance: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  isProfit: boolean;
  peakBalance: number;
  minBalance: number;
  drawdown: number;
  drawdownPercent: number;
  snapshotCount: number;
  lastUpdate: string;
}

interface WeeklyPnLResponse {
  summary: {
    binanceAccountId: number;
    startDate: string;
    endDate: string;
    startBalance: number;
    endBalance: number;
    weeklyPnl: number;
    weeklyPnlPercent: number;
    totalDays: number;
    profitDays: number;
    lossDays: number;
    avgDailyPnl: number;
    bestDay: { date: string; pnl: number; pnlPercent: number };
    worstDay: { date: string; pnl: number; pnlPercent: number };
    maxDrawdown: number;
    maxDrawdownPercent: number;
    totalSnapshots: number;
  };
  daily: Array<{
    date: string;
    startBalance: number;
    endBalance: number;
    dailyPnl: number;
    dailyPnlPercent: number;
    peakBalance: number;
    minBalance: number;
    snapshotCount: number;
  }>;
}

interface DailyPnL {
  date: number; // ngày trong tháng (1-31)
  pnl: number;
}

interface Props {
  binanceAccountId: number | null;
  // Data từ WebSocket (getFuturesAccount)
  totalMarginBalance?: number;
  totalUnrealizedProfit?: number;
}

// ===== Helper Functions =====
const formatNumber = (num: number, decimals: number = 2): string => {
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const getPnLColor = (value: number): string => {
  if (value > 0) return "text-success-500";
  if (value < 0) return "text-danger-500";
  return "text-slate-400";
};

const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number): number => {
  return new Date(year, month, 1).getDay();
};

// ===== PnL API =====
export const pnlApi = {
  getDailyPnl: (binanceAccountId: number) =>
    apiRequest<DailyPnLResponse>(`/m-sys/pnl/daily`, {
      method: "GET",
      params: { binanceAccountId },
    }),

  getWeeklyPnl: (binanceAccountId: number) =>
    apiRequest<WeeklyPnLResponse>(`/m-sys/pnl/weekly`, {
      method: "GET",
      params: { binanceAccountId },
    }),
};

// ===== Cache Helpers =====
const CACHE_KEY_PREFIX = "pnl_cache_";
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 phút

interface CachedPnLData {
  daily: DailyPnLResponse | null;
  weekly: WeeklyPnLResponse | null;
  timestamp: number;
}

const getCacheKey = (accountId: number): string => {
  return `${CACHE_KEY_PREFIX}${accountId}`;
};

const loadFromCache = (accountId: number): CachedPnLData | null => {
  try {
    const cached = localStorage.getItem(getCacheKey(accountId));
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
};

const saveToCache = (
  accountId: number,
  daily: DailyPnLResponse | null,
  weekly: WeeklyPnLResponse | null
): void => {
  try {
    const data: CachedPnLData = {
      daily,
      weekly,
      timestamp: Date.now(),
    };
    localStorage.setItem(getCacheKey(accountId), JSON.stringify(data));
  } catch (err) {
    console.warn("Failed to save PnL cache:", err);
  }
};

const isCacheValid = (cached: CachedPnLData | null): boolean => {
  if (!cached) return false;
  // Cache hợp lệ nếu chưa quá 10 phút
  const age = Date.now() - cached.timestamp;
  return age < CACHE_DURATION_MS;
};

// ===== Component =====
const PnLAnalysisPanel: React.FC<Props> = ({
  binanceAccountId,
  totalMarginBalance,
  totalUnrealizedProfit,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [dailyData, setDailyData] = useState<DailyPnLResponse | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyPnLResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchDate, setLastFetchDate] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Parse selected month
  const [year, month] = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    return [y, m - 1]; // month is 0-indexed
  }, [selectedMonth]);

  // Load cache on mount or when accountId changes
  useEffect(() => {
    if (!binanceAccountId) return;

    const cached = loadFromCache(binanceAccountId);
    if (cached && isCacheValid(cached)) {
      const ageMinutes = Math.round((Date.now() - cached.timestamp) / 60000);
      console.log(`📦 Loading PnL from cache (${ageMinutes}m old)`);
      setDailyData(cached.daily);
      setWeeklyData(cached.weekly);
      setLastFetchDate(cached.timestamp.toString());
    }
  }, [binanceAccountId]);

  // Fetch data when expanded and cache is invalid
  useEffect(() => {
    if (!isExpanded || !binanceAccountId) return;

    // Check if cache is still valid
    const cached = loadFromCache(binanceAccountId);
    if (cached && isCacheValid(cached)) {
      const ageMinutes = Math.round((Date.now() - cached.timestamp) / 60000);
      console.log(`✅ Using cached PnL data (${ageMinutes}m old, valid for ${10 - ageMinutes}m)`);
      
      // Ensure state is updated from cache
      if (!dailyData && cached.daily) setDailyData(cached.daily);
      if (!weeklyData && cached.weekly) setWeeklyData(cached.weekly);
      return;
    }

    const fetchPnlData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log("🔄 Fetching fresh PnL data from API...");
        const [dailyRes, weeklyRes] = await Promise.all([
          pnlApi.getDailyPnl(binanceAccountId),
          pnlApi.getWeeklyPnl(binanceAccountId),
        ]);

        const newDaily = dailyRes.Data ?? null;
        const newWeekly = weeklyRes.Data ?? null;

        setDailyData(newDaily);
        setWeeklyData(newWeekly);
        setLastFetchDate(Date.now().toString());

        // Save to cache
        saveToCache(binanceAccountId, newDaily, newWeekly);
        console.log("💾 PnL data cached (valid for 10 minutes)");
      } catch (err: any) {
        console.error("Failed to fetch PnL data:", err);
        setError(err.message || "Không thể tải dữ liệu PnL");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPnlData();
  }, [isExpanded, binanceAccountId]);

  // Convert weekly data to calendar format
  const calendarData = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const days: (DailyPnL | null)[] = [];

    // Padding cho ngày đầu tuần
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Các ngày trong tháng
    for (let day = 1; day <= daysInMonth; day++) {
      // Tìm PnL cho ngày này từ weekly data
      let pnlForDay = 0;

      if (weeklyData?.daily) {
        const dayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const found = weeklyData.daily.find((d) => d.date === dayStr);
        if (found) {
          pnlForDay = found.dailyPnl;
        }
      }

      days.push({
        date: day,
        pnl: pnlForDay,
      });
    }

    return days;
  }, [year, month, weeklyData]);

  // Generate month options for dropdown
  const monthOptions = useMemo(() => {
    const options: string[] = [];
    const now = new Date();

    // 12 tháng gần nhất
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      );
    }

    return options;
  }, []);

  const weekDays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  // Calculate display values
  const balance = totalMarginBalance ?? dailyData?.currentBalance ?? 0;
  const unrealizedPnl = totalUnrealizedProfit ?? 0;
  const balanceChange = dailyData?.isProfit ? "up" : dailyData ? "down" : "neutral";
  
  // Daily data from API
  const dailyStartBalance = dailyData?.dailyStartBalance ?? 0;
  const dailyPnl = dailyData?.dailyPnl ?? 0;
  const dailyPnlPercent = dailyData?.dailyPnlPercent ?? 0;
  const peakBalance = dailyData?.peakBalance ?? 0;
  const minBalance = dailyData?.minBalance ?? 0;
  
  // Weekly KPI
  const pnlKpi = weeklyData?.summary?.weeklyPnl ?? 0;

  return (
    <div className="mt-4 border-t border-dark-600">
      {/* Header - Collapsible Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-3 text-left hover:bg-dark-700/30 transition-colors"
      >
        <span className="text-sm font-medium text-slate-200">
          Phân tích Lãi/Lỗ
        </span>
        <ChevronDown
          size={18}
          className={`text-slate-400 transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expandable Content */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="pb-4 space-y-3 relative">
          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-dark-800/80 flex items-center justify-center rounded-lg z-10">
              <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="text-danger-500 text-xs p-2 bg-danger-500/10 rounded">
              {error}
            </div>
          )}

          {/* No Account Selected */}
          {!binanceAccountId && (
            <div className="text-slate-400 text-sm text-center py-4">
              Vui lòng chọn tài khoản Binance
            </div>
          )}

          {binanceAccountId && (
            <>
              {/* Số dư đầu ngày */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Số dư đầu ngày</span>
                <span className="text-sm text-white font-medium">
                  {formatNumber(dailyStartBalance)} USDT
                </span>
              </div>

              {/* Số dư hiện tại */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Số dư hiện tại</span>
                <div className="flex items-center gap-2">
                  {/* Trend Icons */}
                  <div className="flex items-center gap-0.5">
                    <TrendingDown
                      size={14}
                      className={
                        balanceChange === "down"
                          ? "text-danger-500"
                          : "text-dark-500"
                      }
                    />
                    <TrendingUp
                      size={14}
                      className={
                        balanceChange === "up"
                          ? "text-success-500"
                          : "text-dark-500"
                      }
                    />
                  </div>
                  <span className="text-sm text-white font-medium">
                    {formatNumber(balance)} USDT
                  </span>
                </div>
              </div>

              {/* Lãi/Lỗ hôm nay */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Lãi/Lỗ hôm nay</span>
                <span className={`text-sm font-medium ${getPnLColor(dailyPnl)}`}>
                  {dailyPnl >= 0 ? "+" : ""}
                  {formatNumber(dailyPnl)} USDT ({dailyPnlPercent >= 0 ? "+" : ""}{dailyPnlPercent.toFixed(2)}%)
                </span>
              </div>

              {/* Lãi/Lỗ chưa chốt */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Lãi/Lỗ chưa chốt</span>
                <span
                  className={`text-sm font-medium ${getPnLColor(unrealizedPnl)}`}
                >
                  {unrealizedPnl >= 0 ? "+" : ""}
                  {formatNumber(unrealizedPnl)} USDT
                </span>
              </div>

              {/* Đỉnh số dư */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Đỉnh số dư</span>
                <span className="text-sm text-success-500 font-medium">
                  {formatNumber(peakBalance)} USDT
                </span>
              </div>

              {/* Đáy số dư */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Đáy số dư</span>
                <span className="text-sm text-danger-500 font-medium">
                  {formatNumber(minBalance)} USDT
                </span>
              </div>

            

              {/* Daily PnL Section */}
              <div className="pt-2">
               

                {/* Month Picker */}
                <div className="mb-3">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-dark-700 border border-dark-600 rounded px-3 py-1.5 text-sm text-white outline-none focus:border-primary-500 cursor-pointer"
                  >
                    {monthOptions.map((m) => (
                      <option key={m} value={m} className="bg-dark-800">
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Calendar Grid */}
                <div className="rounded-lg overflow-hidden">
                  {/* Week Headers */}
                  <div className="grid grid-cols-7 gap-px mb-1">
                    {weekDays.map((day, i) => (
                      <div
                        key={i}
                        className="text-center text-[11px] text-slate-500 font-medium py-1.5"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Days */}
                  <div className="grid grid-cols-7 gap-px">
                    {calendarData.map((day, i) => {
                      // Xác định background color dựa trên PnL
                      const getBgColor = () => {
                        if (!day || day.pnl === 0) return "";
                        if (day.pnl > 0)
                          return "bg-success-500/20 border-l-1 border-success-500";
                        return "bg-danger-500/20 border-l-1 border-danger-500";
                      };

                      return (
                        <div
                          key={i}
                          className={`
                            aspect-square
                            flex flex-col items-center justify-center
                            rounded-sm
                            ${getBgColor()}
                            ${day ? "hover:opacity-80 cursor-pointer transition-opacity" : ""}
                          `}
                        >
                          {day && (
                            <>
                              <div className="text-[13px] text-slate-200 font-medium leading-none">
                                {day.date}
                              </div>
                              {day.pnl !== 0 && (
                                <div
                                  className={`text-[9px] font-medium mt-0.5 leading-none ${getPnLColor(day.pnl)}`}
                                >
                                  {day.pnl > 0 ? "+" : ""}
                                  {day.pnl.toFixed(2)}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PnLAnalysisPanel;