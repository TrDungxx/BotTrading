import React from "react";

type Side = "long" | "short";

export type PnLPriceProps = {
  symbol: string;
  currentPrice?: number;
  lastSignal: { side: Side; entry: number; at: number } | null;
  demoBalance: number;
  capitalPct: number;
  manualQty?: number | null;
};

const Box: React.FC<{ title: string; value: React.ReactNode; className?: string }> = ({
  title, value, className = "",
}) => (
  <div className={`rounded-lg border border-dark-600 bg-dark-700 p-2 ${className}`}>
    <div className="text-[10px] text-gray-400">{title}</div>
    <div className="text-sm font-medium">{value}</div>
  </div>
);

const pnlColor = (v?: number) =>
  v === undefined ? "text-gray-300" : v > 0 ? "text-emerald-400" : v < 0 ? "text-rose-400" : "text-gray-300";

// format 1d 02:03:04
const fmtDuration = (ms: number) => {
  let s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600);  s %= 3600;
  const m = Math.floor(s / 60);    s %= 60;
  const hh = h.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return (d ? `${d}d ` : "") + `${hh}:${mm}:${ss}`;
};

const PnLPrice: React.FC<PnLPriceProps> = ({
  symbol, currentPrice, lastSignal, demoBalance, capitalPct, manualQty
}) => {
  const entry = lastSignal?.entry;
  const side: Side = lastSignal?.side ?? "long";

  // ===== Timer: đếm thời gian đã chạy từ lúc entry =====
  const [now, setNow] = React.useState<number>(Date.now());
  React.useEffect(() => {
    if (!lastSignal?.at) return;
    const id = setInterval(() => {
      // chỉ tick khi tab visible để tiết kiệm CPU
      if (document.visibilityState === "visible") setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [lastSignal?.at]);
  const elapsedMs = lastSignal ? now - lastSignal.at : undefined;

  // ===== Tính PnL theo Capital % (ưu tiên manualQty nếu có) =====
  const capitalAmount = (demoBalance * capitalPct) / 100;
  const qtyFromCapital = entry ? capitalAmount / entry : undefined;
  const qty = (manualQty ?? undefined) ?? qtyFromCapital;
  const notional = entry && qty ? entry * qty : undefined;

  const pnlAbs =
    entry !== undefined && currentPrice !== undefined && qty !== undefined
      ? (side === "long" ? currentPrice - entry : entry - currentPrice) * qty
      : undefined;

  const pnlPct = pnlAbs !== undefined && notional ? (pnlAbs / notional) * 100 : undefined;

  const sideBadge =
    side === "long"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : "bg-rose-500/10 text-rose-400 border-rose-500/30";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-dark-700 bg-dark-800 p-3">
        <div className="text-xs text-gray-400 mb-2">Summary</div>
        <div className="grid grid-cols-2 gap-3">
          <Box title="Symbol" value={symbol} />
          <Box title="Side" value={<span className={`px-2 py-0.5 rounded-md border text-xs ${sideBadge}`}>{side.toUpperCase()}</span>} />
          <Box title="Entry" value={entry ?? "—"} />
          <Box title="Current" value={currentPrice ?? "—"} />
          <Box title="Notional (by Capital %)" value={notional !== undefined ? `${notional.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT` : "—"} />
          <Box title="Est Qty" value={qty !== undefined ? `${qty.toFixed(6)} ${symbol.replace(/USDT$/i, "")}` : "—"} />
          <Box title="PnL (USDT)" value={pnlAbs !== undefined ? pnlAbs.toFixed(4) : "—"} className={pnlColor(pnlAbs)} />
          <Box title="PnL %" value={pnlPct !== undefined ? `${pnlPct.toFixed(3)} %` : "—"} className={pnlColor(pnlPct)} />
          <Box title="At (Entry time)" value={lastSignal ? new Date(lastSignal.at).toLocaleTimeString() : "—"} />
          {/* ⏱ Duration */}
          <Box title="Running" value={elapsedMs !== undefined ? fmtDuration(elapsedMs) : "—"} />
        </div>
        <div className="mt-2 text-[10px] text-gray-500">
          * Tính theo Capital %: {capitalPct}% của {demoBalance.toLocaleString()} USDT{manualQty ? " (đã ưu tiên Manual Qty)" : ""}.
        </div>
      </div>
    </div>
  );
};

export default PnLPrice;
