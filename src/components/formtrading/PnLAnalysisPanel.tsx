import React, { useState, useMemo } from "react";
import { ChevronDown, TrendingUp, TrendingDown } from "lucide-react";

// ===== Types =====
interface PnLData {
  balance: number;
  balanceChange: "up" | "down" | "neutral"; // So sánh với ngày hôm trước
  realizedPnl: number;
  unrealizedPnl: number;
  pnlKpi: number;
}

interface DailyPnL {
  date: number; // ngày trong tháng (1-31)
  pnl: number;
}

interface Props {
  // Data từ API - để placeholder nếu chưa có
  data?: PnLData;
  dailyPnlData?: DailyPnL[];
  isLoading?: boolean;
}

// ===== Helper Functions =====
const formatNumber = (num: number, decimals: number = 4): string => {
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

// ===== Component =====
const PnLAnalysisPanel: React.FC<Props> = ({
  data,
  dailyPnlData = [],
  isLoading = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Parse selected month
  const [year, month] = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    return [y, m - 1]; // month is 0-indexed
  }, [selectedMonth]);

  // Generate calendar data
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
      const pnlForDay = dailyPnlData.find((d) => d.date === day);
      days.push({
        date: day,
        pnl: pnlForDay?.pnl ?? 0,
      });
    }
    
    return days;
  }, [year, month, dailyPnlData]);

  // Mock data nếu chưa có API
  const displayData: PnLData = data ?? {
    balance: 1034.8002,
    balanceChange: "down",
    realizedPnl: -18.7468,
    unrealizedPnl: 18.7468,
    pnlKpi: -18.7468,
  };

  // Mock daily PnL data
  const mockDailyPnl: DailyPnL[] = dailyPnlData.length > 0 ? dailyPnlData : [
    { date: 1, pnl: 137.57 },
    { date: 2, pnl: -390.72 },
    { date: 3, pnl: 257.30 },
    { date: 4, pnl: 80.78 },
    { date: 5, pnl: 84.98 },
    { date: 6, pnl: -380.26 },
    { date: 7, pnl: 64.54 },
  ];

  const displayCalendarData = useMemo(() => {
    if (dailyPnlData.length > 0) return calendarData;
    
    // Use mock data for display
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days: (DailyPnL | null)[] = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const pnlForDay = mockDailyPnl.find((d) => d.date === day);
      days.push({
        date: day,
        pnl: pnlForDay?.pnl ?? 0,
      });
    }
    
    return days;
  }, [year, month, dailyPnlData, calendarData, mockDailyPnl]);

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

  const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="mt-4 border-t border-dark-600">
      {/* Header - Collapsible Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-3 text-left hover:bg-dark-700/30 transition-colors"
      >
        <span className="text-sm font-medium text-slate-200">
          Profit and Loss Analysis
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
        <div className="pb-4 space-y-3">
          {/* Balance Row */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Balance</span>
            <div className="flex items-center gap-2">
              {/* Trend Icons */}
              <div className="flex items-center gap-0.5">
                <TrendingDown
                  size={14}
                  className={
                    displayData.balanceChange === "down"
                      ? "text-danger-500"
                      : "text-dark-500"
                  }
                />
                <TrendingUp
                  size={14}
                  className={
                    displayData.balanceChange === "up"
                      ? "text-success-500"
                      : "text-dark-500"
                  }
                />
              </div>
              <span className="text-sm text-white font-medium">
                {formatNumber(displayData.balance)} USDT
              </span>
            </div>
          </div>

          {/* Realized PNL */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Realized PNL</span>
            <span className={`text-sm font-medium ${getPnLColor(displayData.realizedPnl)}`}>
              {displayData.realizedPnl >= 0 ? "+" : ""}
              {formatNumber(displayData.realizedPnl)} USDT
            </span>
          </div>

          {/* Unrealized PNL */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Unrealized PNL</span>
            <span className={`text-sm font-medium ${getPnLColor(displayData.unrealizedPnl)}`}>
              {displayData.unrealizedPnl >= 0 ? "+" : ""}
              {formatNumber(displayData.unrealizedPnl)} USDT
            </span>
          </div>

          {/* PNL KPI */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">PNL KPI</span>
            <span className={`text-sm font-medium ${getPnLColor(displayData.pnlKpi)}`}>
              {displayData.pnlKpi >= 0 ? "+" : ""}
              {formatNumber(displayData.pnlKpi)} USDT
            </span>
          </div>

          {/* Daily PnL Section */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">Daily PnL</span>
            </div>

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
                {displayCalendarData.map((day, i) => {
                  // Xác định background color dựa trên PnL
                  const getBgColor = () => {
                    if (!day || day.pnl === 0) return "";
                    if (day.pnl > 0) return "bg-success-500/20 border-l-2 border-success-500";
                    return "bg-danger-500/20 border-l-2 border-danger-500";
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

          {/* Loading State */}
          {isLoading && (
            <div className="absolute inset-0 bg-dark-800/80 flex items-center justify-center rounded-lg">
              <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PnLAnalysisPanel;