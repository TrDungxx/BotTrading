import React, { useState, useEffect } from "react";
import { Settings, BarChart3, TrendingUp, Percent } from "lucide-react";
import TopCoins from "./TopCoins";
import TopFundingRate from "./popup panel/TopFundingRate";

// ✅ Types match với TradingTerminal hiện tại
interface OrderBookEntry {
  price: number;      // ✅ NUMBER - match với parseFloat trong TradingTerminal
  quantity: number;   // ✅ NUMBER - match với parseFloat trong TradingTerminal
  total?: number;
}

interface OrderBookData {
  symbol?: string;    // ✅ OPTIONAL - orderbookData state không có field này
  lastUpdateId: number;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

interface TickerData {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  [key: string]: any;
}

interface OrderBookPanelProps {
  orderbookData: OrderBookData;
  tickerData: TickerData | null;
  onClickPrice: (price: number) => void;  // ✅ FIXED: Changed to number
  onSymbolClick?: (symbol: string) => void;
  market?: "spot" | "futures";
}

type ViewMode = "orderbook" | "topcoins" | "funding";
const STORAGE_KEY = "orderbook_panel_view_mode";

const OrderBookPanel: React.FC<OrderBookPanelProps> = ({
  orderbookData,
  tickerData,
  onClickPrice,
  onSymbolClick,
  market = "futures"
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved === "orderbook" || saved === "topcoins" || saved === "funding") ? saved : "orderbook";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, viewMode);
  }, [viewMode]);

  return (
    <div className="h-full flex flex-col">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between p-fluid-3 border-b border-dark-700">
        <div className="flex items-center space-x-4">

          {/* Top Coins Tab */}
          <button
            className={`flex items-center gap-fluid-1.5 text-fluid-sm font-medium transition-colors relative pb-1 ${
              viewMode === "topcoins"
                ? "text-primary-400"
                : "text-dark-400 hover:text-dark-200"
            }`}
            onClick={() => setViewMode("topcoins")}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Top Coins</span>
            {viewMode === "topcoins" && (
              <div className="absolute -bottom-3 left-0 right-0 h-0.5 bg-primary-500" />
            )}
          </button>
{/* Funding Rate Tab - Only for futures */}
          {market === "futures" && (
            <button
              className={`flex items-center gap-fluid-1.5 text-fluid-sm font-medium transition-colors relative pb-1 ${
                viewMode === "funding"
                  ? "text-blue-400"
                  : "text-dark-400 hover:text-dark-200"
              }`}
              onClick={() => setViewMode("funding")}
            >
              <Percent className="h-3.5 w-3.5" />
              <span>FR</span>
              {viewMode === "funding" && (
                <div className="absolute -bottom-3 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>
          )}
          {/* OrderBook Tab */}
          <button
            className={`flex items-center gap-fluid-1.5 text-fluid-sm font-medium transition-colors relative pb-1 ${
              viewMode === "orderbook"
                ? "text-primary-400"
                : "text-dark-400 hover:text-dark-200"
            }`}
            onClick={() => setViewMode("orderbook")}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Order Book</span>
            {viewMode === "orderbook" && (
              <div className="absolute -bottom-3 left-0 right-0 h-0.5 bg-primary-500" />
            )}
          </button>

          
        </div>

        {/* Settings (only show for orderbook) */}
        {viewMode === "orderbook" && (
          <div className="flex items-center gap-fluid-2">
            <button className="text-fluid-sm text-dark-400 hover:text-dark-200">
              0.01
            </button>
            <Settings className="h-3 w-3 text-dark-400" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
        {viewMode === "orderbook" ? (
          // OrderBook View
          orderbookData.bids.length > 0 && orderbookData.asks.length > 0 ? (
            <div className="h-full flex flex-col">
              {/* Asks */}
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                <div className="space-y-0.5 p-fluid-2">
                  {orderbookData.asks
                    .slice(0, 15)
                    .reverse()
                    .map((ask, index) => (
                      <div
                        key={index}
                        className="flex justify-between text-fluid-sm relative cursor-pointer hover:bg-dark-700"
                        onClick={() => onClickPrice(ask.price)}
                      >
                        <span className="text-danger-500 font-mono">
                          {ask.price.toFixed(4)}
                        </span>
                        <span className="text-dark-300 font-mono">
                          {ask.quantity.toFixed(3)}
                        </span>
                        <div
                          className="absolute right-0 top-0 h-full bg-danger-500/10"
                          style={{
                            width: `${Math.min(
                              (ask.quantity / 10) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    ))}
                </div>
              </div>

              {/* Current Price */}
              <div className="px-2 py-fluid-1 border-y border-dark-700 flex-shrink-0">
                <div className="text-center">
                  <div
                    className={`text-fluid-sm font-bold ${
                      tickerData && parseFloat(tickerData.priceChange) >= 0
                        ? "text-success-500"
                        : "text-danger-500"
                    }`}
                  >
                    {tickerData
                      ? parseFloat(tickerData.lastPrice).toFixed(4)
                      : "0.0000"}
                  </div>
                  <div className="text-fluid-sm text-dark-400">
                    ≈ $
                    {tickerData
                      ? parseFloat(tickerData.lastPrice).toFixed(2)
                      : "0.00"}
                  </div>
                </div>
              </div>

              {/* Bids */}
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                <div className="space-y-0.5 p-fluid-2">
                  {orderbookData.bids.slice(0, 15).map((bid, index) => (
                    <div
                      key={index}
                      className="flex justify-between text-fluid-sm relative cursor-pointer hover:bg-dark-700"
                      onClick={() => onClickPrice(bid.price)}
                    >
                      <span className="text-success-500 font-mono">
                        {bid.price.toFixed(4)}
                      </span>
                      <span className="text-dark-300 font-mono">
                        {bid.quantity.toFixed(3)}
                      </span>
                      <div
                        className="absolute right-0 top-0 h-full bg-success-500/10"
                        style={{
                          width: `${Math.min(
                            (bid.quantity / 10) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-dark-400">
              <div className="text-center">
                <div className="text-fluid-sm">Đang kết nối Binance...</div>
                <div className="text-fluid-sm mt-1">
                  Real-time orderbook đang tải
                </div>
              </div>
            </div>
          )
        ) : viewMode === "topcoins" ? (
          // Top Coins View
          <div className="flex-1 min-h-0 overflow-hidden">
            <TopCoins onSymbolClick={onSymbolClick} market={market} />
          </div>
        ) : (
          // Funding Rate View
          <div className="flex-1 min-h-0 overflow-hidden">
            <TopFundingRate onSymbolClick={onSymbolClick} />
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderBookPanel;