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

  onPlace?: (v: { side: Side; entry: number; tp?: number | null; sl?: number | null }) => void;

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
  onPlace,
  topOffsetClass = "top-10",
}) => {
  const [folded, setFolded] = React.useState(false);
  const [openPanel, setOpenPanel] = React.useState(false);

  // bật/tắt feature
  const [innerEnabled, setInnerEnabled] = React.useState(false);
  const isEnabled = enabled ?? innerEnabled;
  const setEnabled = (v: boolean) => (onEnabledChange ? onEnabledChange(v) : setInnerEnabled(v));

  // ====== STATE ĐƠN GIẢN: GIÁ TUYỆT ĐỐI ======
  const [entry, setEntry] = React.useState<{ time: UTCTimestamp; price: number } | null>(null);
  const [tp, setTp] = React.useState<number | null>(null);
  const [sl, setSl] = React.useState<number | null>(null);

  // show/ẩn TP SL: tắt -> truyền null xuống overlay để ẩn, không tính toán gì khác
  const [showTP, setShowTP] = React.useState(true);
  const [showSL, setShowSL] = React.useState(true);

 // init khi BẬT tool (không phụ thuộc openPanel)
React.useEffect(() => {
  if (!isEnabled) return;
  if (!entry && lastCandleTime && lastPrice != null) {
    const p = lastPrice;
    setEntry({ time: lastCandleTime, price: p });
    setTp(p * 1.01);
    setSl(p * 0.99);
    setShowTP(true);
    setShowSL(true);
  }
}, [isEnabled, entry, lastCandleTime, lastPrice]);


  return (
    <div className={`absolute left-2 ${topOffsetClass} z-20 inline-block`}>
      {/* HEADER */}
      <div className="bg-dark-800/90 rounded-md px-2 py-0.5 text-[11px]">
        <div className="flex items-center gap-2">
          <div
            onClick={() =>
              setFolded(prev => {
                const next = !prev;
                if (next) setOpenPanel(false); // gập -> đóng panel
                return next;
              })
            }
            className="cursor-pointer select-none text-gray-300"
          >
            {folded ? "▶" : "▼"}
          </div>

          {!folded && (
            <>
              <button
                className="px-2 py-0.5 rounded bg-dark-700 border border-dark-600 text-gray-200 hover:bg-dark-700/70 text-[11px]"
                onClick={() => setOpenPanel(s => !s)}
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

      {/* 🔴 OVERLAY: luôn render khi bật, KHÔNG phụ thuộc openPanel */}
      {isEnabled && entry && (
        <RRZoneOverlay
          chart={chart}
          series={series}
          containerEl={containerEl}
          entryTime={entry.time}
          entryPrice={entry.price}
          zoneWidthPx={520}
          tpPrice={showTP ? tp : null}
          slPrice={showSL ? sl : null}
          side={positionSide}
          preserveOffsetsOnEntryDrag={true} // kéo entry -> TP/SL đi theo
          guardCrossing={false}
          onChange={(v) => {
            if (v.tp !== undefined) setTp(v.tp ?? null);
            if (v.sl !== undefined) setSl(v.sl ?? null);
          }}
          onEntryChange={(newEntry) => {
            setEntry(prev => (prev ? { ...prev, price: newEntry } : prev));
          }}
        />
      )}

      {/* 🟡 PANEL UI: chỉ hiện khi mở & không gập */}
      {openPanel && !folded && (
        <div className="mt-1 bg-dark-800/90 rounded-md px-2 py-2 text-xs border border-dark-600 relative w-[340px] sm:w-[380px]">
          <ToolTpSl
            lastPrice={lastPrice}
            positionSide={positionSide}
            enabled={isEnabled}
            onEnabledChange={setEnabled}
            entry={entry?.price ?? null}
            onEntryChange={(v) => {
              if (!lastCandleTime) return;
              setEntry({ time: lastCandleTime, price: v });
            }}
            onHitEntry={() => {
              if (!lastCandleTime || lastPrice == null) return;
              setEntry({ time: lastCandleTime, price: lastPrice });
            }}
            showTP={showTP}
            showSL={showSL}
            onToggleTP={setShowTP}
            onToggleSL={setShowSL}
            controlledTp={tp}
            controlledSl={sl}
            onChange={(v) => {
              if (v.tp !== undefined) setTp(v.tp ?? null);
              if (v.sl !== undefined) setSl(v.sl ?? null);
            }}
            onPlace={() => {
              if (!entry) return;
              onPlace?.({
                side: positionSide,
                entry: entry.price,
                tp: showTP ? tp : null,
                sl: showSL ? sl : null,
              });
            }}
          />
        </div>
      )}
    </div>
  );
};

export default ToolMini;
