import React from "react";
import MainSymbolDropdown from "./MainSymbolDropdown";
import { postSignal, SignalType } from "../../utils/signal";

export type IndicatorItem = {
  id: string | number;
  name: string;
  strategy: string;
  symbol: string;
  exchange?: string;
  interval?: string;
  leverage?: string | number;
  marginType?: "ISOLATED" | "CROSSED" | string;
  description?: string;
};

export type IndicatorStats = {
  timeframe?: string;
  totalOrders?: number;
  totalTrades?: number;
  netPnL?: number;
  winRate?: number; // 0..1
  profitFactor?: number;
  maxDrawdown?: number;
};

export type IndicatorMainConfigProps = {
  selectedSymbol: string;
  setSelectedSymbol: (s: string) => void;
  favorites: string[];
  setFavorites: React.Dispatch<React.SetStateAction<string[]>>;
  exchange: string;
  interval: string;
  webhookUrl: string;
  lastOhlc?: { open?: number; high?: number; low?: number; close?: number; volume?: number };

  capitalPct: number;
  setCapitalPct: (v: number) => void;

  manualQty?: number | null;
  setManualQty?: (v: number | null) => void;

  demoBalance: number;

  indicators?: IndicatorItem[];
  selectedIndicatorId?: string | number | null;
  setSelectedIndicatorId?: (id: string | number) => void;

  onSendSignal?: (side: "long" | "short", entry: number) => void;
  onExitSignal?: (side?: "long" | "short") => void;

  selectedIndicatorStats?: IndicatorStats | null;
};

const pctOptions = [1, 2, 5, 10, 20] as const;

function splitSymbol(sym: string) {
  if (sym?.toUpperCase().endsWith("USDT")) {
    return { base: sym.slice(0, -4).toUpperCase(), quote: "USDT" };
  }
  return { base: (sym || "").toUpperCase(), quote: "USDT" };
}
const nowISO = () => new Date().toISOString();
const getBotById = (list: IndicatorItem[] = [], id?: string | number | null) =>
  id == null ? undefined : list.find((it) => String(it.id) === String(id));

const IndicatorMainConfig: React.FC<IndicatorMainConfigProps> = (props) => {
  const {
    selectedSymbol,
    setSelectedSymbol,
    favorites,
    setFavorites,
    exchange,
    interval,
    webhookUrl,
    lastOhlc,
    capitalPct,
    setCapitalPct,
    manualQty = null,
    setManualQty,
    demoBalance,
    indicators = [],
    selectedIndicatorId,
    setSelectedIndicatorId,
    onSendSignal,
    onExitSignal,
  } = props;

  const [sending, setSending] = React.useState<SignalType | null>(null);

  // Đồng bộ symbol theo indicator khi user đổi trong dropdown
  React.useEffect(() => {
    const bot = getBotById(indicators, selectedIndicatorId);
    if (bot?.symbol) setSelectedSymbol(bot.symbol);
  }, [selectedIndicatorId, indicators]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (type: SignalType) => {
    try {
      setSending(type);
      const bot = getBotById(indicators, selectedIndicatorId);
      if (!bot) {
        console.error("[Signal] ❌ Chưa chọn indicator");
        setSending(null);
        return;
      }

      const map = {
        long: { action: "BUY entry", position: "BUY", finalType: "long" as const },
        short: { action: "SELL entry", position: "SELL", finalType: "short" as const },
        exit_long: { action: "BUY entry", position: "BUY", finalType: "exit" as const },
        exit_short: { action: "SELL entry", position: "SELL", finalType: "exit" as const },
      } as const;
      const ap = map[type];

      const o = lastOhlc ?? {};
      const ex = bot.exchange || exchange;
      const iv = bot.interval || interval;
      const { base, quote } = splitSymbol(bot.symbol);

      const payload = {
        indicatorMessage: {
          strategy: bot.strategy,
          indicator: bot.name,
          type: ap.finalType,
          action: ap.action,
          position: ap.position,
          general: { ticker: bot.symbol, exchange: ex, interval: iv, time: nowISO(), timenow: nowISO() },
          symbolData: {
            volume: String(o.volume ?? 0),
            high: String(o.high ?? 0),
            open: String(o.open ?? 0),
            close: String(o.close ?? 0),
          },
          currency: { quote, base },
          options: {
            capitalPercent: capitalPct,
            manualQuantity: manualQty ?? undefined,
            leverage: bot.leverage ?? undefined,
            marginType: bot.marginType ?? undefined,
            timeframe: bot.interval ?? iv,
          },
        },
      };

      const res = await postSignal(webhookUrl, payload);
      console.info("[Signal] ✅ Sent", { status: res.status, ms: res.ms, requestId: res.requestId });

      const entryForPnl = Number(o.close ?? 0);
      if ((type === "long" || type === "short") && Number.isFinite(entryForPnl)) {
        onSendSignal?.(type, entryForPnl);
      }
      if (type === "exit_long") onExitSignal?.("long");
      if (type === "exit_short") onExitSignal?.("short");
    } catch (e) {
      console.error("[Signal] ❌ Failed", e);
    } finally {
      setSending(null);
    }
  };

  const baseBtn = "px-3 py-2 rounded-md text-sm font-medium border transition disabled:opacity-60";
  const longBtn = `${baseBtn} bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15`;
  const shortBtn = `${baseBtn} bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/15`;
  const exitBtn = `${baseBtn} bg-slate-500/10 text-slate-300 border-slate-500/30 hover:bg-slate-500/15`;

  const currentPrice = lastOhlc?.close ?? undefined;

  return (
    <div className="space-y-5">
      {/* Indicator dropdown */}
      <div className="rounded-lg border border-dark-600 bg-dark-700 p-3 relative">
        <div className="text-xs text-gray-400 mb-2">Indicator</div>
        <IndicatorDropdown
          indicators={indicators}
          selectedId={selectedIndicatorId}
          onChange={setSelectedIndicatorId}
          setSelectedSymbol={setSelectedSymbol} // để set symbol ngay khi chọn
        />

        {/* Stats (nếu có) */}
        {(() => {
          const s = props.selectedIndicatorStats;
          const fmtNum = (v?: number, frac = 2) =>
            typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: frac }) : "—";
          const fmtRate = (r?: number) => (typeof r === "number" ? `${Math.round(r * 100)}%` : "—");
          return (
            <div className="mt-3 rounded-lg border border-dark-600 bg-dark-800 p-3">
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded border border-dark-600 bg-dark-700 p-2">
                  <div className="text-[10px] text-gray-400">Orders</div>
                  <div className="text-sm font-medium">{s ? fmtNum(s.totalOrders, 0) : "—"}</div>
                </div>
                <div className="rounded border border-dark-600 bg-dark-700 p-2">
                  <div className="text-[10px] text-gray-400">Trades</div>
                  <div className="text-sm font-medium">{s ? fmtNum(s.totalTrades, 0) : "—"}</div>
                </div>
                <div className="rounded border border-dark-600 bg-dark-700 p-2">
                  <div className="text-[10px] text-gray-400">Net PnL</div>
                  <div className={`text-sm font-medium ${(s?.netPnL ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {s ? fmtNum(s.netPnL) : "—"} <span className="text-[10px] text-gray-400">USDT</span>
                  </div>
                </div>
                <div className="rounded border border-dark-600 bg-dark-700 p-2">
                  <div className="text-[10px] text-gray-400">Winrate</div>
                  <div className="text-sm font-medium">{fmtRate(s?.winRate)}</div>
                </div>
              </div>
              {s?.timeframe && <div className="mt-2 text-[11px] text-gray-500">Range: <b>{s.timeframe}</b></div>}
            </div>
          );
        })()}
      </div>

      {/* OPEN / HIGH / Current */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-dark-600 bg-dark-700 p-2">
          <div className="text-[10px] text-gray-400">OPEN</div>
          <div className="text-sm font-medium">{lastOhlc?.open ?? "-"}</div>
        </div>
        <div className="rounded-lg border border-dark-600 bg-dark-700 p-2">
          <div className="text-[10px] text-gray-400">HIGH</div>
          <div className="text-sm font-medium">{lastOhlc?.high ?? "-"}</div>
        </div>
        <div className="rounded-lg border border-dark-600 bg-dark-700 p-2">
          <div className="text-[10px] text-gray-400">Current</div>
          <div className="text-sm font-medium">{currentPrice ?? "-"}</div>
        </div>
      </div>

      {/* Capital chips */}
      <div className="space-y-2">
        <div className="text-xs text-gray-400">Capital %</div>
        <div className="flex flex-wrap gap-2">
          {pctOptions.map((p) => (
            <button
              key={p}
              onClick={() => setCapitalPct(p)}
              className={`px-2.5 py-1.5 rounded border text-xs ${
                capitalPct === p ? "border-primary/60 text-primary bg-primary/10" : "border-dark-600 text-gray-300 bg-dark-700 hover:bg-dark-600"
              }`}
            >
              {p}%
            </button>
          ))}
        </div>
      </div>

      {/* Slider + Manual qty */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-dark-600 bg-dark-700 p-3">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>Capital % (slider)</span>
            <span className="text-gray-300 font-medium">{capitalPct}%</span>
          </div>
          <input type="range" min={1} max={100} step={1} value={capitalPct} onChange={(e) => setCapitalPct(Number(e.target.value))} className="w-full accent-primary" />
          <div className="flex justify-between text-[10px] text-gray-500 mt-1">
            <span>1%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
          </div>
        </div>

        <div className="rounded-lg border border-dark-600 bg-dark-700 p-3 space-y-2">
          <div className="text-xs text-gray-400">Manual Quantity (BASE)</div>
          <div className="flex items-center gap-2 min-w-0">
            <input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              placeholder="e.g. 0.05"
              value={manualQty ?? ""}
              onChange={(e) => {
                const val = e.target.value.trim();
                if (!setManualQty) return;
                if (val === "") return setManualQty(null);
                const n = Number(val);
                setManualQty(Number.isFinite(n) && n >= 0 ? n : null);
              }}
              className="w-full min-w-0 bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-sm"
            />
            <span className="shrink-0 w-12 text-right text-xs text-gray-400">{selectedSymbol.replace(/USDT$/i, "")}</span>
          </div>
          
        </div>
      </div>

      {/* Nút gửi tín hiệu */}
      <div className="grid grid-cols-2 gap-2">
        <button className={longBtn} onClick={() => send("long")} disabled={!!sending || !selectedIndicatorId}>
          {sending === "long" ? "Sending..." : "Long Message"}
        </button>
        <button className={shortBtn} onClick={() => send("short")} disabled={!!sending || !selectedIndicatorId}>
          {sending === "short" ? "Sending..." : "Short Message"}
        </button>
        <button className={exitBtn} onClick={() => send("exit_long")} disabled={!!sending || !selectedIndicatorId}>
          {sending === "exit_long" ? "Sending..." : "Exit Long"}
        </button>
        <button className={exitBtn} onClick={() => send("exit_short")} disabled={!!sending || !selectedIndicatorId}>
          {sending === "exit_short" ? "Sending..." : "Exit Short"}
        </button>
      </div>

      <button type="button" className="text-xs text-primary hover:underline">
        Market data insight
      </button>
    </div>
  );
};

export default IndicatorMainConfig;

/* ===========================
   Dropdown nội bộ
   =========================== */
const IndicatorDropdown: React.FC<{
  indicators: IndicatorItem[];
  selectedId?: string | number | null;
  onChange?: (id: string | number) => void;
  setSelectedSymbol?: (s: string) => void;
}> = ({ indicators, selectedId, onChange, setSelectedSymbol }) => {
  const [open, setOpen] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement | null>(null);

  const selected = getBotById(indicators, selectedId);

  React.useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-left hover:bg-dark-700"
      >
        {selected ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-gray-200 truncate">
                {selected.name} — {selected.symbol}
              </div>
              <div className="text-[11px] text-gray-400 truncate">Description: {selected.description || "—"}</div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              {selected.leverage ? (
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px]">
                  {selected.leverage}x
                </span>
              ) : null}
              {selected.marginType ? (
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[11px]">
                  {selected.marginType}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <span className="text-sm text-gray-400">Chọn indicator…</span>
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-md border border-dark-600 bg-dark-800 shadow-lg overflow-hidden" role="listbox">
          <div className="max-h-72 overflow-auto divide-y divide-dark-700">
            {indicators.length === 0 && <div className="px-3 py-2 text-sm text-gray-400">Không có indicator</div>}
            {indicators.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  onChange?.(it.id as any);
                  setSelectedSymbol?.(it.symbol); // ⬅️ set symbol ngay khi chọn
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-dark-700 ${String(selectedId) === String(it.id) ? "bg-dark-700" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-gray-200 truncate">
                      {it.name} — {it.symbol}
                    </div>
                    <div className="text-[11px] text-gray-400 line-clamp-2">Descripsion: {it.description || "—"}</div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {it.leverage ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px]">
                        {it.leverage}x
                      </span>
                    ) : null}
                    {it.marginType ? (
                      <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[11px]">
                        {it.marginType}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
