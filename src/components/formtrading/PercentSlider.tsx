import React, { useCallback } from "react";

interface PercentSliderProps {
  percent: number;
  setPercent: (value: number) => void;
  setAmount: (value: string) => void;
  buyQty: number;
  sellQty: number;
  baseAsset: string;
  qtyDecimals: number;
  amount: string;
}

const PERCENTAGES = [0, 0.1, 0.2, 0.5, 1];
const LABELS = ["0%", "0.1%", "0.2%", "0.5%", "1%"];

const PercentSlider: React.FC<PercentSliderProps> = ({
  percent,
  setPercent,
  setAmount,
  buyQty,
  sellQty,
  baseAsset,
  qtyDecimals,
  amount,
}) => {
  const currentIndex = PERCENTAGES.indexOf(percent);
  const progressPercent = currentIndex >= 0 ? (currentIndex / 4) * 100 : 0;

  const handleSelect = useCallback(
    (value: number) => {
      setPercent(value);
      if (value > 0) setAmount("");
    },
    [setPercent, setAmount]
  );

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const targetIndex = Math.round(ratio * 4);
    handleSelect(PERCENTAGES[targetIndex] || 0);
  };

  const handleDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const track = e.currentTarget.parentElement;
    if (!track) return;

    const onMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const rect = track.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      const targetIndex = Math.round(ratio * 4);
      handleSelect(PERCENTAGES[targetIndex] || 0);
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <div className="select-none">
      {/* Mua/Bán Info */}
      {percent > 0 && amount === "" && (
        <div className="flex justify-between items-center mb-3 text-fluid-sm">
          <span className="text-dark-400">
            Mua{" "}
            <span className="text-green-400 font-medium">
              {buyQty.toLocaleString(undefined, {
                maximumFractionDigits: qtyDecimals,
              })}{" "}
              {baseAsset}
            </span>
          </span>
          <span className="text-dark-400">
            Bán{" "}
            <span className="text-red-400 font-medium">
              {sellQty.toLocaleString(undefined, {
                maximumFractionDigits: qtyDecimals,
              })}{" "}
              {baseAsset}
            </span>
          </span>
        </div>
      )}

      {/* Slider Track */}
      <div className="pt-2 pb-1">
        <div
          className="relative h-1 bg-dark-600 rounded-full cursor-pointer"
          onClick={handleTrackClick}
        >
          {/* Progress Bar */}
          <div
            className="absolute left-0 top-0 h-full bg-blue-500 rounded-full transition-all duration-150"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Dots */}
          {PERCENTAGES.map((_, index) => (
            <div
              key={index}
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border-2 transition-all duration-150 ${
                currentIndex >= index
                  ? "bg-blue-500 border-blue-500"
                  : "bg-dark-800 border-dark-500"
              }`}
              style={{ left: `${(index / 4) * 100}%` }}
            />
          ))}

          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-blue-500 rounded-full cursor-grab active:cursor-grabbing transition-all duration-150 hover:scale-110 z-10"
            style={{ left: `${progressPercent}%` }}
            onMouseDown={handleDrag}
          />
        </div>
      </div>

      {/* Percent Buttons */}
      <div className="relative h-5 mt-2">
        {PERCENTAGES.map((value, index) => (
          <button
            key={value}
            onClick={() => handleSelect(value)}
            className={`absolute -translate-x-1/2 text-fluid-2xs font-medium px-0 py-0 rounded transition-all duration-150 ${
              percent === value
                ? "text-blue-500  "
                : "text-dark-400 hover:text-dark-300"
            }`}
            style={{ left: `${(index / 4) * 100}%` }}
          >
            {LABELS[index]}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PercentSlider;