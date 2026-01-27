import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  RefreshCw,
  Search,
  ChevronUp,
  ChevronDown,
  BarChart3,
} from "lucide-react";
import { pnlApi } from "../../utils/api";
import type { SymbolHistory, SymbolsHistoryResponse } from "../../utils/types";

interface Props {
  binanceAccountId: number | null;
  onSymbolClick?: (symbol: string) => void;
}

type SortField = "symbol" | "orderCount" | "longCount" | "shortCount" | "lastTrade";
type SortDirection = "asc" | "desc";

// ===== Helper Functions =====
const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
};

const formatTimeAgo = (dateStr: string): string => {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  } catch {
    return dateStr;
  }
};

// ===== Component =====
const OrderHistoryPosition: React.FC<Props> = ({
  binanceAccountId,
  onSymbolClick,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SymbolsHistoryResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("lastTrade");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Fetch data
  const fetchData = async () => {
    if (!binanceAccountId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await pnlApi.getSymbolsHistory(binanceAccountId);
      setData(response.Data ?? null);
    } catch (err: any) {
      console.error("Failed to fetch symbols history:", err);
      setError(err.message || "Không thể tải dữ liệu");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [binanceAccountId]);

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    if (!data?.symbols) return [];

    let filtered = data.symbols;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toUpperCase();
      filtered = filtered.filter((s) => s.symbol.includes(query));
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "symbol":
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case "orderCount":
          comparison = a.orderCount - b.orderCount;
          break;
        case "longCount":
          comparison = a.longCount - b.longCount;
          break;
        case "shortCount":
          comparison = a.shortCount - b.shortCount;
          break;
        case "lastTrade":
          comparison =
            new Date(a.lastTrade).getTime() - new Date(b.lastTrade).getTime();
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [data, searchQuery, sortField, sortDirection]);

  // Sort indicator component
  const SortIndicator: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) {
      return <ChevronDown size={14} className="text-slate-600 ml-1" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp size={14} className="text-primary-400 ml-1" />
    ) : (
      <ChevronDown size={14} className="text-primary-400 ml-1" />
    );
  };

  // No account selected
  if (!binanceAccountId) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Vui lòng chọn tài khoản Binance
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: '#1e293b' }}>
      {/* Header Stats */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-600">
        <div className="flex items-center gap-6">
          {/* Total Orders */}
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-slate-400" />
            <span className="text-sm text-slate-400">Tổng lệnh:</span>
            <span className="text-sm font-semibold text-white">
              {data?.totalOrders ?? 0}
            </span>
          </div>

          {/* Unique Symbols */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Symbols:</span>
            <span className="text-sm font-semibold text-white">
              {data?.uniqueSymbols ?? 0}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              placeholder="Tìm symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-slate-600 rounded-md pl-9 pr-3 py-1.5 text-sm text-white placeholder-slate-500 outline-none focus:border-primary-500 w-40"
              style={{ backgroundColor: '#334155' }}
            />
          </div>

          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 rounded-md hover:bg-slate-600 transition-colors disabled:opacity-50"
            title="Làm mới"
          >
            <RefreshCw
              size={16}
              className={`text-slate-400 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-danger-500/10 border border-danger-500/30 rounded-md text-danger-400 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10" style={{ backgroundColor: '#1e293b' }}>
            <tr className="text-xs text-slate-400 border-b border-slate-600">
              <th
                className="text-left px-4 py-3 font-medium cursor-pointer hover:text-slate-200 transition-colors"
                onClick={() => handleSort("symbol")}
              >
                <div className="flex items-center">
                  Symbol
                  <SortIndicator field="symbol" />
                </div>
              </th>
              <th
                className="text-center px-4 py-3 font-medium cursor-pointer hover:text-slate-200 transition-colors"
                onClick={() => handleSort("orderCount")}
              >
                <div className="flex items-center justify-center">
                  Tổng lệnh
                  <SortIndicator field="orderCount" />
                </div>
              </th>
              <th className="text-center px-4 py-3 font-medium">
                Buy / Sell
              </th>
              <th
                className="text-center px-4 py-3 font-medium cursor-pointer hover:text-slate-200 transition-colors"
                onClick={() => handleSort("longCount")}
              >
                <div className="flex items-center justify-center">
                  <TrendingUp size={14} className="text-success-500 mr-1" />
                  Long
                  <SortIndicator field="longCount" />
                </div>
              </th>
              <th
                className="text-center px-4 py-3 font-medium cursor-pointer hover:text-slate-200 transition-colors"
                onClick={() => handleSort("shortCount")}
              >
                <div className="flex items-center justify-center">
                  <TrendingDown size={14} className="text-danger-500 mr-1" />
                  Short
                  <SortIndicator field="shortCount" />
                </div>
              </th>
              <th className="text-center px-4 py-3 font-medium">
                Long/Short Ratio
              </th>
              <th className="text-right px-4 py-3 font-medium">
                <div className="flex items-center justify-end">
                  <Clock size={14} className="mr-1" />
                  Giao dịch đầu
                </div>
              </th>
              <th
                className="text-right px-4 py-3 font-medium cursor-pointer hover:text-slate-200 transition-colors"
                onClick={() => handleSort("lastTrade")}
              >
                <div className="flex items-center justify-end">
                  <Clock size={14} className="mr-1" />
                  Giao dịch cuối
                  <SortIndicator field="lastTrade" />
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {isLoading && !data ? (
              <tr>
                <td colSpan={8} className="text-center py-12">
                  <div className="flex items-center justify-center gap-2 text-slate-400">
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Đang tải...</span>
                  </div>
                </td>
              </tr>
            ) : filteredAndSortedData.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-400">
                  {searchQuery
                    ? "Không tìm thấy symbol phù hợp"
                    : "Chưa có dữ liệu giao dịch"}
                </td>
              </tr>
            ) : (
              filteredAndSortedData.map((item, index) => {
                const totalPositions = item.longCount + item.shortCount;
                const longPercent =
                  totalPositions > 0
                    ? (item.longCount / totalPositions) * 100
                    : 50;
                const shortPercent = 100 - longPercent;

                return (
                  <tr
                    key={item.symbol}
                    className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                    style={{ backgroundColor: '#1e293b' }}
                  >
                    {/* Symbol */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onSymbolClick?.(item.symbol)}
                        className="flex items-center gap-2 hover:text-primary-400 transition-colors group"
                      >
                        <span className="font-medium text-white group-hover:text-primary-400">
                          {item.symbol.replace("USDT", "")}
                        </span>
                        <span className="text-xs text-slate-500">/USDT</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning-500/20 text-warning-400 font-medium">
                          Perpetual
                        </span>
                      </button>
                    </td>

                    {/* Order Count */}
                    <td className="text-center px-4 py-3">
                      <span className="font-medium text-white">
                        {item.orderCount}
                      </span>
                    </td>

                    {/* Buy / Sell */}
                    <td className="text-center px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-success-400 font-medium">
                          {item.buyCount}
                        </span>
                        <span className="text-slate-600">/</span>
                        <span className="text-danger-400 font-medium">
                          {item.sellCount}
                        </span>
                      </div>
                    </td>

                    {/* Long Count */}
                    <td className="text-center px-4 py-3">
                      <span className="text-success-400 font-medium">
                        {item.longCount}
                      </span>
                    </td>

                    {/* Short Count */}
                    <td className="text-center px-4 py-3">
                      <span className="text-danger-400 font-medium">
                        {item.shortCount}
                      </span>
                    </td>

                    {/* Long/Short Ratio Bar */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-success-400 w-10 text-right">
                          {longPercent.toFixed(0)}%
                        </span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden bg-slate-600 flex">
                          <div
                            className="h-full bg-success-500 transition-all duration-300"
                            style={{ width: `${longPercent}%` }}
                          />
                          <div
                            className="h-full bg-danger-500 transition-all duration-300"
                            style={{ width: `${shortPercent}%` }}
                          />
                        </div>
                        <span className="text-xs text-danger-400 w-10">
                          {shortPercent.toFixed(0)}%
                        </span>
                      </div>
                    </td>

                    {/* First Trade */}
                    <td className="text-right px-4 py-3">
                      <div className="text-sm text-slate-300">
                        {formatDateTime(item.firstTrade)}
                      </div>
                    </td>

                    {/* Last Trade */}
                    <td className="text-right px-4 py-3">
                      <div className="flex flex-col items-end">
                        <span className="text-sm text-white">
                          {formatDateTime(item.lastTrade)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatTimeAgo(item.lastTrade)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Summary */}
      {data && filteredAndSortedData.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-600 flex items-center justify-between text-xs text-slate-400" style={{ backgroundColor: '#1e293b' }}>
          <span>
            Hiển thị {filteredAndSortedData.length} / {data.symbols.length} symbols
          </span>
          <div className="flex items-center gap-4">
            <span>
              Tổng Long:{" "}
              <span className="text-success-400 font-medium">
                {filteredAndSortedData.reduce((sum, s) => sum + s.longCount, 0)}
              </span>
            </span>
            <span>
              Tổng Short:{" "}
              <span className="text-danger-400 font-medium">
                {filteredAndSortedData.reduce((sum, s) => sum + s.shortCount, 0)}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderHistoryPosition;