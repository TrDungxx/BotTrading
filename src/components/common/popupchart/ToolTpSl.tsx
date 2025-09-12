import React from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";

type Side = "LONG" | "SHORT";

type Props = {
  chart: IChartApi | null;                 // giữ nguyên cho tương thích, không dùng
  series: ISeriesApi<"Candlestick"> | null;// giữ nguyên, không dùng vẽ line nữa
  containerEl: HTMLDivElement | null;      // không dùng

  lastPrice: number | null;
  positionSide: Side;

  enabled: boolean;
  onEnabledChange?: (v: boolean) => void;

  // đồng bộ từ ToolMini/RRZoneOverlay
  controlledTp?: number | null;
  controlledSl?: number | null;
  onChange?: (v: { tp?: number | null; sl?: number | null }) => void;

  onTrigger?: (type: "tp" | "sl", price: number) => void;
};

const ToolTpSl: React.FC<Props> = ({
  lastPrice,
  positionSide,
  enabled,
  onEnabledChange,
  controlledTp,
  controlledSl,
  onChange,
  onTrigger,
}) => {
  const [tpInput, setTpInput] = React.useState<number | "">("");
  const [slInput, setSlInput] = React.useState<number | "">("");

  // đồng bộ input khi giá từ ngoài đổi
  React.useEffect(() => {
    if (controlledTp != null) setTpInput(Number(controlledTp.toFixed(6)));
  }, [controlledTp]);
  React.useEffect(() => {
    if (controlledSl != null) setSlInput(Number(controlledSl.toFixed(6)));
  }, [controlledSl]);

  // trigger: chỉ kiểm tra giá chạm
  React.useEffect(() => {
    if (!enabled || lastPrice == null) return;
    if (controlledTp == null || controlledSl == null) return;
    if (positionSide === "LONG") {
      if (lastPrice >= controlledTp) onTrigger?.("tp", controlledTp);
      if (lastPrice <= controlledSl) onTrigger?.("sl", controlledSl);
    } else {
      if (lastPrice <= controlledTp) onTrigger?.("tp", controlledTp);
      if (lastPrice >= controlledSl) onTrigger?.("sl", controlledSl);
    }
  }, [enabled, lastPrice, controlledTp, controlledSl, positionSide, onTrigger]);

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
            disabled={!enabled}
          />
          <button
            className="h-7 px-2 rounded border border-success/40 text-success disabled:opacity-50 text-xs"
            onClick={() => controlledTp != null && onTrigger?.("tp", controlledTp)}
            disabled={!enabled}
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
            disabled={!enabled}
          />
          <button
            className="h-7 px-2 rounded border border-danger/40 text-danger disabled:opacity-50 text-xs"
            onClick={() => controlledSl != null && onTrigger?.("sl", controlledSl)}
            disabled={!enabled}
          >
            Hit
          </button>
        </div>
      </div>
    </div>

    <div className="mt-1 text-[11px] text-gray-500">
      Kéo vùng xanh/đỏ hoặc nhập số.
    </div>
  </div>
);

};

export default ToolTpSl;
