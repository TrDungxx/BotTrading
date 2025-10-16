import React from "react";

type Side = "LONG" | "SHORT";

type Props = {
  lastPrice: number | null;
  positionSide: Side;

  enabled: boolean;
  onEnabledChange?: (v: boolean) => void;

  // ENTRY
  entry: number | null;
  onEntryChange?: (v: number) => void;
  onHitEntry?: () => void;

  // Show toggles
  showTP: boolean;
  showSL: boolean;
  onToggleTP?: (v: boolean) => void;
  onToggleSL?: (v: boolean) => void;

  // absolute prices (derive từ parent)
  controlledTp?: number | null;
  controlledSl?: number | null;

  // nhập tay TP/SL -> parent convert sang offsets
  onChange?: (v: { tp?: number | null; sl?: number | null }) => void;

  // submit
  onPlace?: () => void;
};

const ToolTpSl: React.FC<Props> = ({
  lastPrice,
  positionSide,
  enabled,
  onEnabledChange,

  entry,
  onEntryChange,
  onHitEntry,

  showTP,
  showSL,
  onToggleTP,
  onToggleSL,

  controlledTp,
  controlledSl,
  onChange,

  onPlace,
}) => {
  const [entryInput, setEntryInput] = React.useState<number | "">("");
  const [tpInput, setTpInput] = React.useState<number | "">("");
  const [slInput, setSlInput] = React.useState<number | "">("");

  // sync inputs khi parent đổi
  React.useEffect(() => {
    if (entry != null) setEntryInput(Number(entry.toFixed(6)));
  }, [entry]);

  React.useEffect(() => {
    if (controlledTp != null) setTpInput(Number(controlledTp.toFixed(6)));
    else setTpInput(""); // khi uncheck -> clear
  }, [controlledTp]);

  React.useEffect(() => {
    if (controlledSl != null) setSlInput(Number(controlledSl.toFixed(6)));
    else setSlInput("");
  }, [controlledSl]);

  return (
    <div className="rounded-md border border-dark-600 p-2 bg-dark-800 text-xs">
      <div className="flex items-center justify-between">
        <div className="font-medium">TP/SL</div>
        <label className="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange?.(e.target.checked)}
          />
          <span>Bật</span>
        </label>
      </div>

      {/* ENTRY ROW */}
      <div className="mt-2">
        <div className="text-[11px] text-gray-400 mb-1">Entry</div>
        <div className="flex gap-1">
          <input
            className="w-full h-7 bg-dark-700 border border-dark-600 rounded px-2 text-xs"
            type="number"
            step="0.000001"
            value={entryInput}
            onChange={(e) => {
              const v = e.target.value === "" ? "" : Number(e.target.value);
              setEntryInput(v);
              if (v !== "" && isFinite(v as number)) onEntryChange?.(v as number);
            }}
            disabled={!enabled}
          />
          <button
            className="h-7 px-2 rounded border border-gray-500 text-gray-200 disabled:opacity-50 text-xs"
            onClick={onHitEntry}
            disabled={!enabled || lastPrice == null}
            title="Hit Last Price"
          >
            Hit
          </button>
        </div>
        <div className="mt-1 text-[11px] text-gray-500">
          Side: <b>{positionSide}</b> • Last: {lastPrice ?? "—"}
        </div>
      </div>

      {/* SHOW TOGGLES */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={showTP}
            onChange={(e) => onToggleTP?.(e.target.checked)}
            disabled={!enabled}
          />
          <span>Show TP</span>
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={showSL}
            onChange={(e) => onToggleSL?.(e.target.checked)}
            disabled={!enabled}
          />
          <span>Show SL</span>
        </label>
      </div>

      {/* TP / SL INPUTS */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        {/* TP */}
        <div>
          <div className="text-[11px] text-gray-400 mb-1">Take Profit</div>
          <div className="flex gap-1">
            <input
              className="w-full h-7 bg-dark-700 border border-dark-600 rounded px-2 text-xs"
              type="number"
              step="0.000001"
              value={tpInput}
              onChange={(e) => {
                const v = e.target.value === "" ? "" : Number(e.target.value);
                setTpInput(v);
                if (v !== "" && isFinite(v as number)) onChange?.({ tp: v as number });
              }}
              disabled={!enabled || !showTP}
            />
            <button
              className="h-7 px-2 rounded border border-success/40 text-success disabled:opacity-50 text-xs"
              onClick={() => controlledTp != null && onChange?.({ tp: controlledTp })}
              disabled={!enabled || !showTP || controlledTp == null}
              title="Use current TP value"
            >
              Hit
            </button>
          </div>
        </div>

        {/* SL */}
        <div>
          <div className="text-[11px] text-gray-400 mb-1">Stop Loss</div>
          <div className="flex gap-1">
            <input
              className="w-full h-7 bg-dark-700 border border-dark-600 rounded px-2 text-xs"
              type="number"
              step="0.000001"
              value={slInput}
              onChange={(e) => {
                const v = e.target.value === "" ? "" : Number(e.target.value);
                setSlInput(v);
                if (v !== "" && isFinite(v as number)) onChange?.({ sl: v as number });
              }}
              disabled={!enabled || !showSL}
            />
            <button
              className="h-7 px-2 rounded border border-danger/40 text-danger disabled:opacity-50 text-xs"
              onClick={() => controlledSl != null && onChange?.({ sl: controlledSl })}
              disabled={!enabled || !showSL || controlledSl == null}
              title="Use current SL value"
            >
              Hit
            </button>
          </div>
        </div>
      </div>

      {/* PLACE */}
      <div className="mt-3 flex justify-end gap-2">
        <button
          className="h-7 px-3 rounded border border-dark-600 text-gray-300 hover:bg-dark-700/60"
          disabled={!enabled}
          onClick={() => {
            // reset nhanh
            setTpInput("");
            setSlInput("");
          }}
        >
          Reset
        </button>
        <button
          className="h-7 px-3 rounded bg-primary/80 hover:bg-primary text-white disabled:opacity-50"
          disabled={!enabled || entry == null}
          onClick={onPlace}
          title="Place order(s)"
        >
          Place
        </button>
      </div>

      <div className="mt-1 text-[11px] text-gray-500">
        Tick TP/SL để hiện/ẩn trên chart. Kéo vạch trên chart hoặc nhập số ở đây.
      </div>
    </div>
  );
};

export default ToolTpSl;
