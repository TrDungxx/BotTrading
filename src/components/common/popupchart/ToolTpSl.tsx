import React from "react";

type Side = "LONG" | "SHORT";

type Props = {
  lastPrice: number | null;
  positionSide: Side;

  enabled: boolean;
  onEnabledChange?: (v: boolean) => void;

  /** Cho phép chỉnh/kéo Entry (được điều khiển từ ToolMini) */
  canEditEntry?: boolean;

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
  canPlace?: boolean; // mặc định false
  onPlace?: () => void;
   quantity?: number | null;                 // 👈 thêm
  onQuantityChange?: (v: number) => void;   // 👈 thêm
};

const ToolTpSl: React.FC<Props> = (props) => {
  const {
    lastPrice,
    positionSide,
    enabled,
    onEnabledChange,

    canEditEntry = true,

    entry,
    onEntryChange,
    onHitEntry,

    showTP,
    showSL,
    onToggleTP,
    onToggleSL,
     quantity,
  onQuantityChange,

    controlledTp,
    controlledSl,
    onChange,
canPlace = false,
    onPlace,
  } = props;

  const [entryInput, setEntryInput] = React.useState<number | "">("");
  const [tpInput, setTpInput] = React.useState<number | "">("");
  const [slInput, setSlInput] = React.useState<number | "">("");
const [quantityInput, setQuantityInput] = React.useState<number | "">("");
  // sync inputs khi parent đổi
  React.useEffect(() => {
    if (entry != null) setEntryInput(Number(entry.toFixed(6)));
    else setEntryInput("");
  }, [entry]);

React.useEffect(() => {
  if (quantity != null) setQuantityInput(quantity);
}, [quantity]);

  React.useEffect(() => {
    if (controlledTp != null) setTpInput(Number(controlledTp.toFixed(6)));
    else setTpInput(""); // khi uncheck -> clear
  }, [controlledTp]);

  React.useEffect(() => {
    if (controlledSl != null) setSlInput(Number(controlledSl.toFixed(6)));
    else setSlInput("");
  }, [controlledSl]);

  const handleNumeric = (val: string): number | "" => {
    if (val === "") return "";
    const n = Number(val);
    return Number.isFinite(n) ? n : "";
  };

  return (
    <div className="rounded-md border border-dark-600 p-2 bg-dark-800 text-xs">
      {/* Header */}
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

      {/* ENTRY */}
      <div className="mt-2">
        <div className="text-[11px] text-gray-400 mb-1">Entry</div>
        <div className="flex gap-1">
          <input
            className={`w-full h-7 bg-dark-700 border border-dark-600 rounded px-2 text-xs ${
              !enabled || !canEditEntry ? "opacity-60 cursor-not-allowed" : ""
            }`}
            type="number"
            step="0.000001"
            value={entryInput}
            onChange={(e) => {
              const v = handleNumeric(e.target.value);
              setEntryInput(v);
              if (v !== "" && canEditEntry) onEntryChange?.(v as number);
            }}
            disabled={!enabled || !canEditEntry}
          />
          <button
            className="h-7 px-2 rounded border border-gray-500 text-gray-200 disabled:opacity-50 text-xs"
            onClick={() => canEditEntry && onHitEntry?.()}
            disabled={!enabled || !canEditEntry || lastPrice == null}
            title="Hit Last Price"
          >
            Hit
          </button>
        </div>
        <div className="mt-1 text-[11px] text-gray-500">
          Side: <b>{positionSide}</b> • Last: {lastPrice ?? "—"}
        </div>
      </div>

      {/* QTY */}
<div className="mt-2">
  <div className="text-[11px] text-gray-400 mb-1">Số lượng</div>
  <div className="flex gap-1">
    <input
      className={`w-full h-7 bg-dark-700 border border-dark-600 rounded px-2 text-xs ${
        !enabled ? "opacity-60 cursor-not-allowed" : ""
      }`}
      type="number"
      step="0.000001"
      value={quantityInput}
      onChange={(e) => {
        const val = e.target.value;
        if (val === "") {
          setQuantityInput(""); // cho phép rỗng
          onQuantityChange?.(0); // hoặc null nếu bạn muốn
          return;
        }
        const n = Number(val);
        if (Number.isFinite(n) && n >= 0) {
          setQuantityInput(n);
          onQuantityChange?.(n);
        }
      }}
      disabled={!enabled}
      placeholder="Nhập số lượng"
    />
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

      {/* TP / SL */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        {/* TP */}
        <div>
          <div className="text-[11px] text-gray-400 mb-1">Take Profit</div>
          <div className="flex gap-1">
            <input
              className={`w-full h-7 bg-dark-700 border border-dark-600 rounded px-2 text-xs ${
                !enabled || !showTP ? "opacity-60 cursor-not-allowed" : ""
              }`}
              type="number"
              step="0.000001"
              value={tpInput}
              onChange={(e) => {
                const v = handleNumeric(e.target.value);
                setTpInput(v);
                if (v !== "" && enabled && showTP) onChange?.({ tp: v as number });
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
              className={`w-full h-7 bg-dark-700 border border-dark-600 rounded px-2 text-xs ${
                !enabled || !showSL ? "opacity-60 cursor-not-allowed" : ""
              }`}
              type="number"
              step="0.000001"
              value={slInput}
              onChange={(e) => {
                const v = handleNumeric(e.target.value);
                setSlInput(v);
                if (v !== "" && enabled && showSL) onChange?.({ sl: v as number });
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

      {/* ACTIONS */}
<div className="mt-3 flex justify-end gap-2">
  <button
    className="h-7 px-3 rounded border border-dark-600 text-gray-300 hover:bg-dark-700/60"
    disabled={!enabled}
    onClick={() => {
      setTpInput("");
      setSlInput("");
      // (tuỳ chọn) đẩy reset lên parent:
      // onChange?.({ tp: null, sl: null });
    }}
  >
    Reset
  </button>

  {canPlace && (
  <button
    className="h-7 px-3 rounded bg-primary/80 hover:bg-primary text-white disabled:opacity-50"
    disabled={!enabled || entry == null}
    onClick={onPlace}
    title="Xác nhận đặt lệnh"
  >
    Xác nhận
  </button>
)}
</div>

      
    </div>
  );
};

export default ToolTpSl;
