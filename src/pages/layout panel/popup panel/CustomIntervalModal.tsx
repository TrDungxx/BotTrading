import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Unit = "s" | "m" | "h" | "d" | "w" | "M";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (interval: string) => void;
}

const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: "s", label: "Giây" },
  { value: "m", label: "Phút" },
  { value: "h", label: "Giờ" },
  { value: "d", label: "Ngày" },
  { value: "w", label: "Tuần" },
  { value: "M", label: "Tháng" },
];

export default function CustomIntervalModal({ open, onClose, onSubmit }: Props) {
  
  const [unit, setUnit] = useState<Unit>("m");
  const [value, setValue] = useState<string>("");
  const [error, setError] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | null>(null);
 
   
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = originalOverflow; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setUnit("m");
    setValue("");
    setError("");
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  const handleAdd = () => {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) {
      setError("Vui lòng nhập số nguyên dương.");
      return;
    }
    if (n > 100000) {
      setError("Giá trị quá lớn.");
      return;
    }
    setError("");
    onSubmit(`${n}${unit}`);
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative z-[10001] w-[460px] rounded-2xl border border-dark-700 bg-dark-800 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="text-lg font-semibold text-white">
            Thêm khoảng thời gian tuỳ chỉnh
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-dark-300 hover:bg-dark-700 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-dark-300">Loại</label>
            <select
              className="w-full rounded-xl border border-dark-600 bg-dark-700 p-2.5 text-sm text-white outline-none focus:border-blue-500"
              value={unit}
              onChange={(e) => {
                
                setUnit(e.target.value as Unit);
                setError("");
              }}
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-dark-300">Khung thời gian</label>
            <input
              ref={inputRef}
              type="number"
              min={1}
              step={1}
              placeholder="VD: 7"
              className="w-full rounded-xl border border-dark-600 bg-dark-700 p-2.5 text-sm text-white outline-none focus:border-blue-500"
              value={value}
              onChange={(e) => {
                
                setValue(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            {error && (
              <div className="mt-1 text-xs text-red-500">{error}</div>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-dark-600 bg-dark-700 py-2.5 text-sm font-medium text-white hover:bg-dark-600"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="flex-1 rounded-xl bg-[#fcd535] py-2.5 text-sm font-semibold text-black hover:brightness-95"
          >
            Thêm
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}