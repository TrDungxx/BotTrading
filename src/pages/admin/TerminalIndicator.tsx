import React, { useState, useEffect } from "react";
import ChartWithToolbar from "../../components/tabterminalindicator/tool/ChartWithToolbar";
import MainSymbolDropdown from "../../components/tabterminalindicator/MainSymbolDropdown";
import symbolList from "../../utils/symbolList";
import IndicatorMainConfig, {
  IndicatorItem,
} from "../../components/tabterminalindicator/IndicatorMainconfig";
import IndicatorHistory from "../../components/tabterminalindicator/IndicatorHistory";
import { indicatorApi, indicatorAnalyticsApi } from "../../utils/api";
import type { IndicatorStats } from "../../components/tabterminalindicator/IndicatorMainconfig";
import { postSignal } from "../../utils/signal";
import RightClickEntryMenu from "../../components/tabterminalindicator/tool/RightClickEntryMenu";
import BlinkingPriceLines, {
  ArmedMsg,
} from "../../components/tabterminalindicator/tool/BlinkingPriceLines";

// ===== LocalStorage keys & helpers =====
const LS_KEYS = {
  activeMsgs: "ti.activeMsgs.v1",
  selectedSymbol: "ti.selectedSymbol",
  selectedIndicatorId: "ti.selectedIndicatorId",
  favorites: "ti.favorites",
  filterMode: "ti.filterMode",
  capitalPct: "ti.capitalPct",
};

function safeLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function safeSave<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
/* ========= Types ========= */
type FilterMode = "bot" | "all";

type ActiveMsg = {
  side: "long" | "short";
  entry: number;
  timeISO: string;
  symbol: string;
  indicatorId: string;
  confirmed?: boolean;
  triggered?: boolean;
  armedFromPrice?: number;
  // 👇 thêm để chống gửi trùng & log:
  signalSent?: boolean;         // đã gửi tín hiệu khi khớp
  executedPrice?: number;       // giá thực thi (thường = entry)
  executedAt?: string;          // thời điểm khớp
};

type AccordionItemProps = {
  title: string;
  right?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
};
// ===== Number formatting =====
const LOCALE = "vi-VN"; // hoặc 'en-US'
const USE_GROUPING = false; // 👈 bỏ dấu chấm ngăn cách hàng nghìn

// nếu muốn fix số lẻ theo từng symbol, set ở đây:
const DECIMALS_MAP: Record<string, number> = {
  BTCUSDT: 2,
  // ETHUSDT: 2,
  // DOGEUSDT: 5,
};

export const decimalsOf = (n: number, max = 6): number => {
  if (!Number.isFinite(n)) return 2;
  const s = String(n);
  const i = s.indexOf(".");
  return i >= 0 ? Math.min(max, s.length - i - 1) : 0;
};

const getDecimals = (symbol: string, cur?: number, entry?: number) =>
  DECIMALS_MAP[symbol.toUpperCase()] ??
  decimalsOf(typeof cur === "number" ? cur : Number(entry));

// format chung
const fmt = (n: number, d: number) =>
  n.toLocaleString(LOCALE, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
    useGrouping: USE_GROUPING, // 👈 bỏ dấu . ngăn cách
  });
// chống trượt giá

/* ========= Small UI helpers ========= */
const AccordionItem: React.FC<AccordionItemProps> = ({
  title,
  right,
  defaultOpen,
  children,
}) => {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-fluid-4 py-fluid-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-between gap-fluid-3 flex-1 text-left hover:bg-dark-700/40 px-2 py-fluid-1.5 rounded-xl"
        >
          <span className="text-fluid-sm font-semibold">{title}</span>
          <span className={`transition-transform ${open ? "" : "rotate-180"}`}>
            ▾
          </span>
        </button>
        <div className="ml-2 shrink-0">
          {right ?? <button className="btn btn-xs">Video tutorial</button>}
        </div>
      </div>
      {open && <div className="p-fluid-4">{children}</div>}
    </div>
  );
};

/* ========= Left Panel ========= */
const LeftPanel: React.FC<{
  prices: Record<string, number>;
  activeMsgs: ActiveMsg[];
  indicators: IndicatorItem[];
  filterMode: FilterMode; // 👈 thêm
  selectedSymbol: string; // 👈 thêm
  selectedIndicatorId: string | null; // 👈 thêm
}> = ({
  prices,
  activeMsgs,
  indicators,
  filterMode,
  selectedSymbol,
  selectedIndicatorId,
}) => {
  // áp filter theo mode
  const list = React.useMemo(() => {
    if (filterMode === "all") return activeMsgs;
    const id = String(selectedIndicatorId ?? "");
    return activeMsgs.filter(
      (x) => x.symbol === selectedSymbol && String(x.indicatorId) === id
    );
  }, [filterMode, activeMsgs, selectedSymbol, selectedIndicatorId]);

  return (
    <div className="space-y-4">
      <AccordionItem title="PnL / Price (Running)" defaultOpen>
        <div className="gap-fluid-2">
          {list.length === 0 && (
            <div className="rounded border border-dark-600 bg-dark-700 p-fluid-3 text-fluid-sm text-gray-400">
              No Bot Running
            </div>
          )}

          {list.map((m, idx) => {
            const cur = prices[m.symbol];
            const isTriggered = !!m.triggered;
            const isArmed = !!m.confirmed && !isTriggered;
            // số lẻ: ưu tiên map theo symbol, không có thì bám theo current
            const d = getDecimals(m.symbol, cur, m.entry);

            // 🔒 Chỉ tính khi đã khớp
            const pnlPct =
              isTriggered &&
              typeof cur === "number" &&
              Number.isFinite(cur) &&
              m.entry
                ? (m.side === "long" ? cur / m.entry - 1 : 1 - cur / m.entry) *
                  100
                : undefined;

            const bot = indicators.find(
              (b) => String(b.id) === String(m.indicatorId)
            );

            return (
              <div
                key={`${m.symbol}-${m.indicatorId}-${m.side}-${idx}`}
                className="rounded border border-dark-600 bg-dark-800 px-fluid-3 py-2"
              >
                <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-6 gap-y-1">
                  {/* Side + Bot name */}
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-fluid-2">
                      <span
                        className={`px-2 py-0.5 text-fluid-xs rounded ${
                          m.side === "long"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {m.side.toUpperCase()}
                      </span>

                      {/* trạng thái */}
                      {isArmed && (
                        <span className="px-1.5 py-0.5 text-fluid-2xs rounded border border-amber-500/30 bg-amber-500/10 text-amber-400">
                          Wait for match
                        </span>
                      )}
                      {isTriggered && (
                        <span className="px-1.5 py-0.5 text-fluid-2xs rounded border border-primary/30 bg-primary/10 text-primary">
                          RUNNING
                        </span>
                      )}
                    </div>

                    <span className="mt-1 text-xs text-gray-200 truncate max-w-[160px]">
                      {bot?.name || "Bot"}
                    </span>
                  </div>

                  {/* Entry + time */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-fluid-2">
                      <span className="text-xs text-gray-400">Entry:</span>
                      <span className="text-fluid-sm text-gray-200 font-medium">
                        {fmt(m.entry, d)} {/* 👈 dùng fmt */}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(m.timeISO).toLocaleTimeString()}
                    </div>
                  </div>

                  {/* Current price */}
                  <div className="text-right">
                    <div className="text-fluid-2xs text-gray-400">
                      Current ({m.symbol})
                    </div>
                    <div className="text-fluid-sm font-medium">
                      {typeof cur === "number" ? fmt(cur, d) : "—"}{" "}
                      {/* 👈 dùng fmt */}
                    </div>
                  </div>

                  {/* PnL%: chỉ hiện khi đã khớp */}
                  <div className="text-right min-w-[88px]">
                    <div className="text-fluid-2xs text-gray-400">PnL %</div>
                    <div
                      className={`text-fluid-sm font-semibold ${
                        (pnlPct ?? 0) >= 0
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {isTriggered && typeof pnlPct === "number"
                        ? `${pnlPct.toFixed(2)}%`
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </AccordionItem>
    </div>
  );
};
function splitSymbol(sym: string) {
  if (sym?.toUpperCase().endsWith("USDT")) {
    return { base: sym.slice(0, -4).toUpperCase(), quote: "USDT" };
  }
  return { base: (sym || "").toUpperCase(), quote: "USDT" };
}
const nowISO = () => new Date().toISOString();
/* ========= Page ========= */
export default function TerminalIndicatorLayout() {
  // ======= State chính =======
  const [selectedSymbol, setSelectedSymbol] = useState<string>(() =>
    safeLoad<string>(LS_KEYS.selectedSymbol, "ETHUSDT")
  );
  const [favorites, setFavorites] = useState<string[]>(() =>
    safeLoad<string[]>(LS_KEYS.favorites, [])
  );
  const [activeMsgs, setActiveMsgs] = useState<ActiveMsg[]>(() =>
  (safeLoad<ActiveMsg[]>(LS_KEYS.activeMsgs, []) || []).map((m) => ({
    side: m.side,
    entry: m.entry,
    timeISO: m.timeISO,
    symbol: m.symbol,
    indicatorId: m.indicatorId,
    confirmed: !!m.confirmed,
    triggered: !!m.triggered,
    armedFromPrice: m.armedFromPrice,
    signalSent: !!m.signalSent,
    executedPrice: m.executedPrice,
    executedAt: m.executedAt,
  }))
);
  const [indicators, setIndicators] = useState<IndicatorItem[]>([]);
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | null>(
    () => safeLoad<string | null>(LS_KEYS.selectedIndicatorId, null)
  );
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [prevPrices, setPrevPrices] = useState<
    Record<string, number | undefined>
  >({});
  const [indicatorStats, setIndicatorStats] = useState<IndicatorStats | null>(
    null
  );
  const [statsLoading, setStatsLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<"bot" | "all">(() =>
    safeLoad<"bot" | "all">(LS_KEYS.filterMode, "bot")
  );

  // Capital & OHLC
  const [capitalPct, setCapitalPct] = useState<number>(() =>
    safeLoad<number>(LS_KEYS.capitalPct, 10)
  );
  const [lastOhlc, setLastOhlc] = useState<{
    start?: number;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    volume?: number;
  }>({});
  // hàm local lưu các số
  // ======= Persist to localStorage on change =======
  useEffect(() => {
    safeSave(LS_KEYS.activeMsgs, activeMsgs);
  }, [activeMsgs]);

  useEffect(() => {
    safeSave(LS_KEYS.selectedSymbol, selectedSymbol);
  }, [selectedSymbol]);

  useEffect(() => {
    safeSave(LS_KEYS.selectedIndicatorId, selectedIndicatorId);
  }, [selectedIndicatorId]);

  useEffect(() => {
    safeSave(LS_KEYS.favorites, favorites);
  }, [favorites]);

  useEffect(() => {
    safeSave(LS_KEYS.filterMode, filterMode);
  }, [filterMode]);

  useEffect(() => {
    safeSave(LS_KEYS.capitalPct, capitalPct);
  }, [capitalPct]);

  // Hằng số
  const exchange = "BINANCE Futures USDT-M";
  const interval = "1h";
  const webhookUrl = "http://45.77.33.141/listen/indicator";
  const demoBalance = 1_200_000;
  // ====
  const currentMsg = React.useMemo(() => {
    const id = String(selectedIndicatorId ?? "");
    return (
      activeMsgs.find(
        (m) => m.symbol === selectedSymbol && String(m.indicatorId) === id
      ) || null
    );
  }, [activeMsgs, selectedSymbol, selectedIndicatorId]);
  // chống trượt giá
  // === Tick-safe crossover detection (bắt cross ngay trên mỗi tick) ===
  const prevTickRef = React.useRef<number | undefined>(undefined);
  const armSkipRef = React.useRef<number>(0); // bỏ qua X tick đầu sau khi arm để tránh nhiễu

  // Epsilon: biên độ an toàn (0.01%); coin biến động mạnh có thể tăng 0.02–0.05%
  const EPS_PCT = 0.0001;

  const safeBand = (entry: number) => {
    const eps = Math.max(Math.abs(entry) * EPS_PCT, 1e-8);
    return { lo: entry - eps, hi: entry + eps };
  };

  


  // Khi đổi symbol thì reset prev tick để không bị “ký ức” symbol cũ
  React.useEffect(() => {
    prevTickRef.current = undefined;
  }, [selectedSymbol]);

  const [ctxMenu, setCtxMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    price: number;
    side: "long" | "short";
  } | null>(null);

  // khi user right-click, mở menu với side mặc định là long (tuỳ bạn)
  const handlePickPrice = React.useCallback(
    (p: { price: number; x: number; y: number }) => {
      setCtxMenu({ show: true, x: p.x, y: p.y, price: +p.price, side: "long" });
    },
    []
  );
  // xử lý rightclick khớp lệnh
  const sendRightClickSignal = React.useCallback(
    async (side: "long" | "short", entry: number) => {
      const bot = indicators.find(
        (it) => String(it.id) === String(selectedIndicatorId)
      );
      if (!bot) {
        console.error("[RightClick] ❌ No indicator selected");
        return;
      }

      // map action
      const map = {
        long: {
          action: "BUY entry",
          position: "BUY",
          finalType: "long" as const,
        },
        short: {
          action: "SELL entry",
          position: "SELL",
          finalType: "short" as const,
        },
      } as const;
      const ap = map[side];

      const o = lastOhlc ?? {};
      const ex = bot.exchange || exchange;
      const iv = bot.interval || interval;
      const { base, quote } = splitSymbol(bot.symbol);

      // payload giống IndicatorMainConfig, bổ sung entryPrice
      const payload = {
        indicatorMessage: {
          strategy: bot.strategy,
          indicator: bot.name,
          type: ap.finalType,
          action: ap.action,
          position: ap.position,
          general: {
            ticker: bot.symbol,
            exchange: ex,
            interval: iv,
            time: nowISO(),
            timenow: nowISO(),
          },
          symbolData: {
            volume: String(o.volume ?? 0),
            high: String(o.high ?? 0),
            open: String(o.open ?? 0),
            close: String(o.close ?? 0),
          },
          currency: { quote, base },
          options: {
            capitalPercent: capitalPct,
            manualQuantity: null,
            leverage: bot.leverage ?? undefined,
            marginType: bot.marginType ?? undefined,
            timeframe: bot.interval ?? iv,
            entryPrice: entry, // 👈 gửi entry người dùng chọn
          },
        },
      };

      try {
        const res = await postSignal(webhookUrl, payload);
        console.info("[RightClick] ✅ Sent", {
          status: res.status,
          ms: res.ms,
        });
      } catch (e) {
        console.error("[RightClick] ❌ Failed", e);
      }
    },
    [
      indicators,
      selectedIndicatorId,
      lastOhlc,
      exchange,
      interval,
      capitalPct,
      webhookUrl,
    ]
  );


  const handleTick = React.useCallback(
  (curPrice: number) => {
    const msg = currentMsg;
    if (!msg || !msg.confirmed || msg.triggered) {
      prevTickRef.current = curPrice;
      return;
    }

    // Bỏ qua tick ngay sau khi arm
    if (armSkipRef.current > 0) {
      armSkipRef.current--;
      prevTickRef.current = curPrice;
      return;
    }

    const prev = prevTickRef.current ?? msg.armedFromPrice;
    if (!Number.isFinite(curPrice) || !Number.isFinite(prev ?? NaN)) {
      prevTickRef.current = curPrice;
      return;
    }

    const { lo, hi } = safeBand(msg.entry);
    const crossed =
      msg.side === "long"
        ? prev < lo && curPrice >= lo
        : prev > hi && curPrice <= hi;

    if (crossed) {
      // 👇 CHỈ gửi nếu chưa gửi lần nào
      if (!msg.signalSent) {
        // fire-and-forget để không block tick
        (async () => {
          try {
            await sendRightClickSignal(msg.side, msg.entry);
          } catch (e) {
            console.error("[Trigger] send signal failed:", e);
          }
        })();
      }

      const executedAt = new Date().toISOString();
      const executedPrice = msg.entry; // hoặc curPrice; dùng entry theo đúng logic bạn

      setActiveMsgs((list) =>
        list.map((x) =>
          x.symbol === msg.symbol &&
          x.indicatorId === msg.indicatorId &&
          x.side === msg.side &&
          x.entry === msg.entry
            ? {
                ...x,
                triggered: true,
                signalSent: true,
                executedAt,
                executedPrice,
              }
            : x
        )
      );
    }

    prevTickRef.current = curPrice;
  },
  [currentMsg, setActiveMsgs, sendRightClickSignal]
);

  // ======= Load indicators =======
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp: any = await indicatorApi.getAllIndicatorConfigs();
        const raw = Array.isArray(resp?.Data?.indicators)
          ? resp.Data.indicators
          : Array.isArray(resp?.data)
          ? resp.data
          : Array.isArray(resp)
          ? resp
          : [];

        const mapped: IndicatorItem[] = (raw ?? []).map((ind: any) => ({
          id: ind.id ?? ind.Id ?? ind.ID,
          name: ind.Name ?? ind.name ?? "Unnamed",
          strategy: ind.Strategy ?? ind.Name ?? ind.name ?? "Strategy",
          symbol: ind.Symbol ?? ind.symbol ?? "ETHUSDT",
          interval: ind.IndicatorTimeframe ?? ind.interval ?? "1m",
          exchange: ind.exchange ?? exchange,
          leverage: ind.Leverage ?? ind.leverage,
          marginType: ind.MarginType ?? ind.marginType,
          description: ind.Description ?? ind.description,
          indicatorType: ind.IndicatorType ?? ind.indicatorType,
          candles: ind.IndicatorCandles ?? ind.candles,
          createdAt: ind.create_time,
          updatedAt: ind.update_time,
        }));

        if (cancelled) return;
        setIndicators(mapped);
        if (mapped.length > 0) {
          // nếu chưa có lựa chọn (ví dụ lần đầu vào) thì set mặc định
          if (!selectedIndicatorId) {
            setSelectedIndicatorId(String(mapped[0].id));
          } else {
            // có id cũ nhưng check xem còn tồn tại không
            const stillExists = mapped.some(
              (ind) => String(ind.id) === String(selectedIndicatorId)
            );
            if (!stillExists) {
              setSelectedIndicatorId(String(mapped[0].id));
            }
          }

          // symbol cũng tương tự
          if (!selectedSymbol) {
            if (mapped[0].symbol) setSelectedSymbol(mapped[0].symbol);
          } else {
            const stillExists = mapped.some(
              (ind) => String(ind.symbol) === String(selectedSymbol)
            );
            if (!stillExists && mapped[0].symbol) {
              setSelectedSymbol(mapped[0].symbol);
            }
          }
        }
      } catch (e) {
        console.error("Load indicators failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // once

  // ======= Đồng bộ symbol khi đổi indicator =======
  useEffect(() => {
  if (!currentMsg || !currentMsg.confirmed || currentMsg.triggered) return;

  const cur = prices[selectedSymbol] ?? lastOhlc.close;
  const prev = prevPrices[selectedSymbol] ?? currentMsg.armedFromPrice;

  if (!Number.isFinite(cur) || !Number.isFinite(prev ?? NaN)) return;

  const crossed =
    currentMsg.side === "long"
      ? prev! < currentMsg.entry && cur >= currentMsg.entry
      : prev! > currentMsg.entry && cur <= currentMsg.entry;

  if (!crossed) return;

  // 👇 chỉ gửi nếu chưa gửi
  if (!currentMsg.signalSent) {
    (async () => {
      try {
        await sendRightClickSignal(currentMsg.side, currentMsg.entry);
      } catch (e) {
        console.error("[SyncCross] send signal failed:", e);
      }
    })();
  }

  setActiveMsgs((list) =>
    list.map((x) =>
      x === currentMsg
        ? {
            ...x,
            triggered: true,
            signalSent: true,
            executedAt: new Date().toISOString(),
            executedPrice: currentMsg.entry,
          }
        : x
    )
  );
}, [
  prices[selectedSymbol],
  lastOhlc.close,
  prevPrices[selectedSymbol],
  currentMsg,
  selectedSymbol,
]);

useEffect(() => {
  prevTickRef.current = undefined;
}, [selectedIndicatorId]);

  // ======= Indicator overview theo lựa chọn =======
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        if (!selectedIndicatorId || !indicators?.length) {
          if (!cancel) setIndicatorStats(null);
          return;
        }
        setStatsLoading(true);

        const res: any = await indicatorAnalyticsApi.getIndicatorOverview();
        const data = res?.Data ?? res ?? {};
        const rows: any[] = Array.isArray(data.overview) ? data.overview : [];
        const timeframe = data?.timeframe;

        const bot = indicators.find(
          (it) => String(it.id) === String(selectedIndicatorId)
        );
        const names = [bot?.name, bot?.strategy]
          .filter(Boolean)
          .map((s) => String(s).toLowerCase().trim());
        const row = rows.find((r) =>
          names.includes(
            String(r?.indicatorCall || "")
              .toLowerCase()
              .trim()
          )
        );

        if (!row) {
          if (!cancel) setIndicatorStats(null);
          return;
        }

        const totalTrades =
          typeof row.totalTrades === "number"
            ? row.totalTrades
            : typeof row.tradeCount === "number"
            ? row.tradeCount
            : undefined;
        const totalOrders =
          typeof row.orderCount === "number" ? row.orderCount : totalTrades;

        let winRate = typeof row.winRate === "number" ? row.winRate : undefined;
        if (typeof winRate === "number" && winRate > 1) winRate = winRate / 100;

        const stats: IndicatorStats = {
          timeframe,
          totalOrders,
          totalTrades,
          netPnL:
            typeof row.netPnl === "number"
              ? row.netPnl
              : typeof row.totalPnl === "number"
              ? row.totalPnl
              : undefined,
          winRate,
          profitFactor:
            typeof row.profitFactor === "number" ? row.profitFactor : undefined,
          maxDrawdown:
            typeof row.maxDrawdown === "number" ? row.maxDrawdown : undefined,
        };

        if (!cancel) setIndicatorStats(stats);
      } catch (e) {
        console.error("Load indicator overview failed:", e);
        if (!cancel) setIndicatorStats(null);
      } finally {
        if (!cancel) setStatsLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [selectedIndicatorId, indicators]);

  // ======= Subscribe miniTicker cho mọi symbol đang chạy (đa bot độc lập) =======
  useEffect(() => {
    const symbols = Array.from(new Set(activeMsgs.map((m) => m.symbol)));
    if (symbols.length === 0) return;

    const sockets = new Map<string, WebSocket>();
    symbols.forEach((sym) => {
      const url = `wss://fstream.binance.com/ws/${sym.toLowerCase()}@miniTicker`;
      const ws = new WebSocket(url);
      sockets.set(sym, ws);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const price = Number(msg.c);
          if (Number.isFinite(price)) {
            setPrices((prev) =>
              prev[sym] === price ? prev : { ...prev, [sym]: price }
            );
          }
        } catch {}
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {}
      };
    });

    return () => {
      sockets.forEach((ws) => {
        try {
          ws.close();
        } catch {}
      });
    };
  }, [activeMsgs]);

  // Dropdown symbols (nếu cần)
  const dropdownSymbols = symbolList.map((s) => ({
    symbol: s,
    price: 0,
    percentChange: 0,
    volume: 0,
  }));

  async function sendIndicatorConfirm(payload: {
    symbol: string;
    side: "long" | "short";
    entry: number;
    indicatorId: string;
  }) {
    // TODO: gọi webhook/ws của bạn
    // await fetch(webhookUrl, {method:'POST', body: JSON.stringify(payload)});
    return true;
  }
  return (
    <div
      className="h-[calc(100dvh-4rem)] bg-dark-900 flex flex-col"
      data-test="terminal-indicator"
    >
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1.2fr_1.3fr_0.9fr] gap-fluid-3 p-fluid-3">
        {/* LEFT */}
        <div className="min-h-0 overflow-hidden">
          <div className="card h-full flex flex-col min-h-0">
            <div className="card-header flex items-center justify-between">
              <p className="text-fluid-sm font-semibold">Configuration</p>

              {/* Toggle filter */}
              <div className="flex items-center gap-fluid-1">
                <button
                  className={`px-fluid-3 py-fluid-1 text-xs rounded font-medium transition ${
                    filterMode === "bot"
                      ? "bg-primary-600 text-white shadow-sm"
                      : "bg-dark-700 text-gray-300 hover:bg-dark-600"
                  }`}
                  onClick={() => setFilterMode("bot")}
                  title="Chỉ hiển thị lệnh của bot & symbol đang chọn"
                >
                  BOT
                </button>

                <button
                  className={`px-fluid-3 py-fluid-1 text-xs rounded font-medium transition ${
                    filterMode === "all"
                      ? "bg-primary-600 text-white shadow-sm"
                      : "bg-dark-700 text-gray-300 hover:bg-dark-600"
                  }`}
                  onClick={() => setFilterMode("all")}
                  title="Hiển thị tất cả lệnh đang chạy"
                >
                  All Bot
                </button>
              </div>
            </div>

            <div className="card-body flex-1 overflow-y-auto min-h-0 space-y-4 pr-2">
              <LeftPanel
                prices={prices}
                activeMsgs={activeMsgs}
                indicators={indicators}
                filterMode={filterMode} // 👈 truyền mode
                selectedSymbol={selectedSymbol} // 👈 truyền bot hiện tại
                selectedIndicatorId={selectedIndicatorId} // 👈 truyền bot hiện tại
              />
            </div>
          </div>
        </div>

        {/* MIDDLE */}
        <div className="min-h-0 overflow-hidden flex flex-col gap-fluid-3">
          <section className="rounded-2xl border border-dark-700 bg-dark-800 overflow-hidden">
            {/* Header giữ padding */}
            <div className="flex items-center justify-between px-fluid-3 py-2 border-b border-dark-700">
              <h2 className="text-fluid-sm font-semibold">Chart</h2>
            </div>

            <div className="h-64 md:h-72 lg:h-fluid-input-sm0 xl:h-96">
              <ChartWithToolbar
                symbol={selectedSymbol}
                interval={interval}
                market="futures"
                onSymbolChange={setSelectedSymbol}
                onKline={(k) => {
                  // 2.1 Cập nhật OHLC như cũ
                  setLastOhlc((prev) => {
                    if (prev.start !== k.start) {
                      return {
                        start: k.start,
                        open: k.open,
                        high: k.high,
                        low: k.low,
                        close: k.close,
                        volume: k.volume,
                      };
                    }
                    return {
                      ...prev,
                      high: k.high,
                      low: k.low,
                      close: k.close,
                      volume: k.volume,
                    };
                  });

                  // 2.2 Cập nhật prev & cur NGUYÊN TỬ để tránh stale
                  setPrices((p) => {
                    const prev = p[selectedSymbol];
                    // lưu prev đúng thời điểm của tick này
                    setPrevPrices((pp) =>
                      pp[selectedSymbol] === prev
                        ? pp
                        : { ...pp, [selectedSymbol]: prev }
                    );
                    // trả về cur mới
                    return p[selectedSymbol] === k.close
                      ? p
                      : { ...p, [selectedSymbol]: k.close };
                  });

                  // 2.3 Bắt cross NGAY trên tick này (không đợi render/effect)
                  handleTick(k.close);
                }}
                // control chọn cặp
                renderPairControl={(current, setCurrent) => (
                  <MainSymbolDropdown
                    selectedSymbol={current}
                    onSelect={(s) => {
                      setCurrent(s);
                      setSelectedSymbol(s);
                    }}
                    favorites={favorites}
                    onToggleFavorite={(s) =>
                      setFavorites((prev) =>
                        prev.includes(s)
                          ? prev.filter((f) => f !== s)
                          : [...prev, s]
                      )
                    }
                    balances={{}}
                  />
                )}
                // 👇 TRUYỀN SỰ KIỆN CHUỘT PHẢI
                onPickPrice={handlePickPrice}
                /* Overlay: gộp FloatingPositionTagV2 (kéo‑thả entry) + RightClickEntryMenu (chuột phải) */
                renderOverlay={(ctx) => {
                  const nodes: React.ReactNode[] = [];
                  // lấy danh sách lệnh đang chờ khớp (confirmed && !triggered)
                  const armedList: ArmedMsg[] = activeMsgs
                    .filter((m) => m.confirmed && !m.triggered)
                    .map((m) => ({
                      side: m.side,
                      entry: m.entry,
                      symbol: m.symbol,
                      indicatorId: m.indicatorId,
                    }));

                  nodes.push(
                    <BlinkingPriceLines
                      key="blink"
                      ctx={ctx}
                      armed={armedList}
                        setActiveMsgs={setActiveMsgs}
                    />
                  );

                  // ===== RightClickEntryMenu (mới thêm) =====
                  if (ctxMenu?.show) {
                    nodes.push(
                      <RightClickEntryMenu
                        key="rcm"
                        x={ctxMenu.x}
                        y={ctxMenu.y}
                        price={ctxMenu.price}
                        decimals={4}
                        side={ctxMenu.side}
                        onChangeSide={(s) =>
                          setCtxMenu((m) => (m ? { ...m, side: s } : m))
                        }
                        onConfirm={({ side, price }) => {
    // ❌ LOẠI BỎ: sendRightClickSignal(side, price);

    // Giữ lại bỏ qua 2 tick đầu nếu muốn
    armSkipRef.current = 2;

    // Chỉ ARM lệnh (confirmed, chưa triggered)
    setActiveMsgs((prev) => {
      const id = String(selectedIndicatorId ?? "");
      const others = prev.filter(
        (x) =>
          !(
            x.side === side &&
            x.symbol === selectedSymbol &&
            String(x.indicatorId) === id
          )
      );
      const nowPrice = prices[selectedSymbol] ?? lastOhlc.close;
      return [
        ...others,
        {
          side,
          entry: price,
          timeISO: new Date().toISOString(),
          symbol: selectedSymbol,
          indicatorId: id,
          confirmed: true,
          triggered: false,
          armedFromPrice: nowPrice,

          // 👇 mới
          signalSent: false,
          executedPrice: undefined,
          executedAt: undefined,
        },
      ];
    });

    setCtxMenu(null);
  }}
  onClose={() => setCtxMenu(null)}
                      />
                    );
                  }

                  return <>{nodes}</>;
                }}
              />
            </div>
          </section>

          <section className="min-h-0 flex-1 rounded-2xl border border-dark-700 bg-dark-800 flex flex-col">
            <header className="border-b border-dark-700 p-fluid-3">
              <h2 className="text-fluid-sm font-semibold">Orders History</h2>
            </header>
            <div className="flex-1 min-h-0 overflow-auto">
              <IndicatorHistory />
            </div>
          </section>
        </div>

        {/* RIGHT */}
        <div className="min-h-0">
          <section className="sticky top-fluid-3 rounded-2xl border border-dark-700 bg-dark-800 p-fluid-3 max-h-[calc(100dvh-5rem)] overflow-auto">
            <header className="mb-3">
              <h2 className="text-fluid-sm font-semibold">Trade Panel</h2>
            </header>

            <IndicatorMainConfig
              selectedSymbol={selectedSymbol}
              setSelectedSymbol={setSelectedSymbol}
              favorites={favorites}
              setFavorites={setFavorites}
              exchange={exchange}
              interval={interval}
              webhookUrl={webhookUrl}
              lastOhlc={lastOhlc}
              capitalPct={capitalPct}
              setCapitalPct={setCapitalPct}
              manualQty={null}
              setManualQty={() => {}}
              demoBalance={demoBalance}
              indicators={indicators}
              selectedIndicatorId={selectedIndicatorId}
              setSelectedIndicatorId={(id) =>
                setSelectedIndicatorId(String(id))
              }
              onSendSignal={(side, entry) => {
                armSkipRef.current = 1; // optional
                setActiveMsgs((prev) => {
                  const id = String(selectedIndicatorId ?? "");
                  const others = prev.filter(
                    (x) =>
                      !(
                        x.side === side &&
                        x.symbol === selectedSymbol &&
                        String(x.indicatorId) === id
                      )
                  );

                  const nowPrice = prices[selectedSymbol] ?? lastOhlc.close; // giá hiện tại
                  const e = Number.isFinite(entry) ? entry : nowPrice; // fallback nếu entry trống

                  return [
                    ...others,
                    {
                      side,
                      entry: e,
                      timeISO: new Date().toISOString(),
                      symbol: selectedSymbol,
                      indicatorId: id,
                      confirmed: true, // đã gửi lệnh
                      triggered: true, // market => chạy PnL ngay
                      armedFromPrice: nowPrice, // lưu mốc (để log/so sánh nếu cần)
                    },
                  ];
                });
              }}
              onExitSignal={(side) => {
                setActiveMsgs((prev) => {
                  const id = String(selectedIndicatorId ?? "");
                  return prev.filter(
                    (x) =>
                      !(
                        x.symbol === selectedSymbol &&
                        x.indicatorId === id &&
                        (!side || x.side === side)
                      )
                  );
                });
              }}
              selectedIndicatorStats={indicatorStats}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
