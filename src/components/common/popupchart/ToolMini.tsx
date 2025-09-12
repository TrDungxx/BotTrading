import React from "react";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import ToolTpSl from "./ToolTpSl";
import RRZoneOverlay from "./RRZoneOverlay";

type Side = "LONG" | "SHORT";

type Props = {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  containerEl: HTMLDivElement | null;

  lastPrice: number | null;
  lastCandleTime: UTCTimestamp | null;

  positionSide: Side;

  enabled?: boolean;
  onEnabledChange?: (v: boolean) => void;
  onTrigger?: (type: "tp" | "sl", price: number) => void;

  topOffsetClass?: string;
};

const ToolMini: React.FC<Props> = ({
  chart,
  series,
  containerEl,
  lastPrice,
  lastCandleTime,
  positionSide,
  enabled,
  onEnabledChange,
  onTrigger,
  topOffsetClass = "top-10",
}) => {
  const [folded, setFolded] = React.useState(false);
  const [openPanel, setOpenPanel] = React.useState(false);
  const [innerEnabled, setInnerEnabled] = React.useState(false);
  const isEnabled = enabled ?? innerEnabled;
  const setEnabled = (v: boolean) => (onEnabledChange ? onEnabledChange(v) : setInnerEnabled(v));

  // source of truth
  const [entry, setEntry] = React.useState<{ time: UTCTimestamp; price: number } | null>(null);
  const [tp, setTp] = React.useState<number | null>(null);
  const [sl, setSl] = React.useState<number | null>(null);

  // init khi mở panel
  React.useEffect(() => {
    if (!openPanel) return;
    if (!entry && lastCandleTime && lastPrice != null) {
      const p = lastPrice;
      setEntry({ time: lastCandleTime, price: p });
      const up = p * 1.01, down = p * 0.99;
      if (positionSide === "LONG") { setTp(up); setSl(down); }
      else { setTp(down); setSl(up); }
    }
  }, [openPanel, entry, lastCandleTime, lastPrice, positionSide]);

  return (
    <div className={`absolute left-2 ${topOffsetClass} z-20 inline-block`}>

  {/* MINI HEADER */}
  <div className="bg-dark-800/90 rounded-md px-2 py-0.5 text-[11px]">
    <div className="flex items-center gap-2">
      <div
        onClick={() => setFolded((s) => !s)}
        className="cursor-pointer select-none text-gray-300"
      >
        {folded ? "▶" : "▼"}
      </div>

      {!folded && (
        <>
          <button
            className="px-2 py-0.5 rounded bg-dark-700 border border-dark-600 text-gray-200 hover:bg-dark-700/70 text-[11px]"
            onClick={() => setOpenPanel((s) => !s)}
          >
            Tool
          </button>

          <label className="ml-1 inline-flex items-center gap-1 text-gray-300 text-[11px]">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>Bật</span>
          </label>
        </>
      )}
    </div>
  </div>

      {openPanel && (
        <div className="mt-1 bg-dark-800/90 rounded-md px-2 py-2 text-xs border border-dark-600 relative w-[340px] sm:w-[380px]">
          {/* VÙNG RR – kéo ở viền trên (TP) và dưới (SL) */}
          {isEnabled && entry && (
            <RRZoneOverlay
              chart={chart}
              series={series}
              containerEl={containerEl}
              entryTime={entry.time}
              entryPrice={entry.price}
              tpPrice={tp}
              slPrice={sl}
              side={positionSide}
              onChange={(v) => {
                if (v.tp != null) setTp(v.tp);
                if (v.sl != null) setSl(v.sl);
              }}
            />
          )}

          {/* Panel nhập – KHÔNG vẽ line, chỉ đồng bộ giá và trigger */}
          <ToolTpSl
            chart={chart}
            series={series}
            containerEl={containerEl}
            lastPrice={lastPrice}
            positionSide={positionSide}
            enabled={isEnabled}
            onEnabledChange={setEnabled}
            controlledTp={tp}
            controlledSl={sl}
            onChange={(v) => {
              if (v.tp != null) setTp(v.tp);
              if (v.sl != null) setSl(v.sl);
            }}
            onTrigger={onTrigger}
          />
          {isEnabled && entry && (() => {
  const e = entry as NonNullable<typeof entry>;
  return (
    <RRZoneOverlay
      chart={chart}
      series={series}
      containerEl={containerEl}
      entryTime={e.time}
      entryPrice={e.price}
      tpPrice={tp}
      slPrice={sl}
      side={positionSide}
      onChange={(v) => { if (v.tp != null) setTp(v.tp); if (v.sl != null) setSl(v.sl); }}
      onEntryChange={(newEntry) => {
        setEntry(prev => {
          if (!prev) return prev;
          const delta = newEntry - prev.price;
          if (tp != null) setTp(tp + delta);
          if (sl != null) setSl(sl + delta);
          return { ...prev, price: newEntry };
        });
      }}
    />
  );
})()}

        </div>
      )}
    </div>
  );
};

export default ToolMini;
