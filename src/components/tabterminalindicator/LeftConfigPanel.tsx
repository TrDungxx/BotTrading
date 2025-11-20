// LeftConfigPanel.tsx
import React from "react";
import type { IndicatorItem } from "./IndicatorMainconfig";

export type ActiveMsg = {
  side: "long" | "short";
  entry: number;
  timeISO: string;
  symbol: string;
  indicatorId: string;
};

type Props = {
  rows: ActiveMsg[];                            // tất cả lệnh đang chạy
  prices: Record<string, number>;               // map symbol -> current price
  indicators: IndicatorItem[];                  // để lookup tên bot
  // Nếu muốn giữ Capital, bạn truyền thêm 2 props dưới và bỏ comment phần cuối file:
  // capitalPct?: number;
  // setCapitalPct?: (v: number) => void;
};

const fmt = (n?: number, frac = 6) =>
  typeof n === "number"
    ? n.toLocaleString(undefined, { maximumFractionDigits: frac })
    : "—";

const LeftConfigPanel: React.FC<Props> = ({ rows, prices, indicators }) => {
  const getBot = (id: string) => indicators.find(b => String(b.id) === id);

  // Sắp xếp mới nhất lên đầu (tuỳ bạn)
  const sorted = [...rows].sort((a, b) => +new Date(b.timeISO) - +new Date(a.timeISO));

  return (
    <div className="space-y-4">
      {/* PnL / Price (All running) */}
      <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm font-semibold">PnL / Price (All running)</div>
        </div>

        <div className="p-4 space-y-2">
          {sorted.length === 0 && (
            <div className="rounded border border-dark-600 bg-dark-700 p-3 text-sm text-gray-400">
              Chưa có message đang chạy
            </div>
          )}

          {sorted.map((r, idx) => {
            const cur = prices[r.symbol];
            const pnlPct =
              cur && r.entry
                ? (r.side === "long" ? (cur / r.entry - 1) : (1 - cur / r.entry)) * 100
                : undefined;
            const bot = getBot(r.indicatorId);

            return (
              <div
                key={`${r.indicatorId}-${r.symbol}-${r.side}-${idx}`}
                className="flex items-center justify-between rounded border border-dark-600 bg-dark-800 px-3 py-2"
              >
                {/* LEFT: Side + Bot + Symbol + Entry + Time */}
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`px-2 py-0.5 text-[11px] rounded ${
                      r.side === "long"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {r.side.toUpperCase()}
                  </span>

                  <span className="text-sm text-gray-200 truncate max-w-[18rem]">
                    {(bot?.name || "Bot")} — {r.symbol}
                  </span>

                  <span className="text-xs text-gray-400 ml-2">Entry:</span>
                  <span className="text-sm text-gray-200 font-medium">{fmt(r.entry)}</span>

                  <span className="text-xs text-gray-500 ml-2">
                    {new Date(r.timeISO).toLocaleTimeString()}
                  </span>
                </div>

                {/* RIGHT: Current + PnL% */}
                <div className="flex items-end gap-6">
                  <div className="text-right">
                    <div className="text-[10px] text-gray-400">Current ({r.symbol})</div>
                    <div className="text-sm font-medium">{fmt(cur)}</div>
                  </div>

                  <div className="text-right min-w-[90px]">
                    <div className="text-[10px] text-gray-400">PnL %</div>
                    <div
                      className={`text-sm font-semibold ${
                        (pnlPct ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {typeof pnlPct === "number" ? `${pnlPct.toFixed(2)}%` : "—"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/*
      // ============ (Tuỳ chọn) Capital block ============
      // Nếu muốn hiển thị Capital ở panel trái, bạn có thể đưa lại block cũ vào đây
      // và thêm props: capitalPct, setCapitalPct ở type Props
      */}
    </div>
  );
};

export default LeftConfigPanel;
