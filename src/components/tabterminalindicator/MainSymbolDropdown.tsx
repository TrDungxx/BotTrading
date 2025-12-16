// MainSymbolDropdown.tsx (compact - chìm trong chart)
import React, { useEffect, useMemo, useRef, useState } from "react";
import coinIcons from "../../utils/coinIcons";
import symbolList from "../../utils/symbolList";

type Props = {
  selectedSymbol: string;                  // "ETHUSDT"
  onSelect: (s: string) => void;
  favorites?: string[];
  onToggleFavorite?: (s: string) => void;
  balances?: Record<string, number>;       // { BTC: 1, ETH: 50, ... } (BASE)
  symbols?: string[];                      // override list
  disabled?: boolean;
};

const QUOTES = ["USDT","USD","BUSD","USDC","FDUSD","TUSD","BTC"];

const splitSymbol = (s: string) => {
  const U = s.toUpperCase();
  for (const q of QUOTES) {
    if (U.endsWith(q)) return { base: U.slice(0, -q.length), quote: q };
  }
  return { base: U, quote: "" };
};

const MainSymbolDropdown: React.FC<Props> = ({
  selectedSymbol,
  onSelect,
  favorites = [],
  onToggleFavorite,
  balances = {},
  symbols,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { base, quote } = useMemo(() => splitSymbol(selectedSymbol), [selectedSymbol]);

  // list hiển thị
  const fullList = symbols ?? symbolList;
  const filtered = useMemo(() => {
    const query = q.trim().toUpperCase();
    let arr = fullList;
    if (query) arr = arr.filter((s) => s.toUpperCase().includes(query));

    // Ưu tiên favorites, rồi sort có numeric
    return arr.slice().sort((a, b) => {
      const fa = favorites.includes(a) ? 0 : 1;
      const fb = favorites.includes(b) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [fullList, q, favorites]);

  // đóng khi click ngoài
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Esc để đóng + auto focus ô search khi mở
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 0); }, [open]);

  const renderIcon = (s: string) => {
    const sym = splitSymbol(s).base;
    const icon = (coinIcons as any)?.[sym] ?? (coinIcons as any)?.[sym.toLowerCase()];
    if (typeof icon === "string") return <img src={icon} alt={sym} className="w-4 h-4" />;
    if (icon) {
      const IconComp = icon as React.ComponentType<React.SVGProps<SVGSVGElement>>;
      return <IconComp className="w-4 h-4" />;
    }
    return <div className="w-4 h-4 rounded-full bg-dark-600" />;
  };

  return (
    <div ref={boxRef} className="relative select-none">
      {/* Nút compact: nhỏ, trong suốt, dùng trong header chart */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-fluid-1 px-2 py-0.5 rounded border text-fluid-xs leading-none
          ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
          bg-transparent border-dark-600/40 hover:border-primary-500/50`}
        title="Select pair"
      >
        <span
          onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(selectedSymbol); }}
          className="text-gray-400 hover:text-yellow-400"
          aria-label="favorite-symbol"
        >
          {favorites.includes(selectedSymbol) ? "★" : "☆"}
        </span>
        <span className="shrink-0">{renderIcon(selectedSymbol)}</span>
        <span className="truncate">{base}/{quote || "USDT"}</span>
        <span className={`ml-1 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {/* Popup danh sách (nhẹ, chìm) */}
      {open && (
        <div
          role="listbox"
          aria-label="Select symbol"
          className="absolute left-0 mt-1 w-64 rounded-xl border border-dark-600 bg-dark-800 shadow-xl p-fluid-2 z-50"
        >
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search symbol…"
            className="w-full mb-2 px-2 py-fluid-1.5 rounded bg-dark-700 border border-dark-600 text-fluid-sm focus:outline-none focus:border-primary-500/60"
          />
          <div className="max-h-72 overflow-auto pr-1 space-y-1">
            {filtered.length === 0 ? (
              <div className="px-2 py-2 text-xs text-gray-400">No results</div>
            ) : filtered.map((s) => {
              const { base: b, quote: qx } = splitSymbol(s);
              const fav = favorites.includes(s);
              const bal = balances?.[b];
              return (
                <button
                  key={s}
                  type="button"
                  role="option"
                  aria-selected={s === selectedSymbol}
                  onClick={() => { onSelect(s); setOpen(false); }}
                  className={`w-full flex items-center justify-between rounded px-2 py-2 hover:bg-dark-700
                    ${s === selectedSymbol ? "bg-dark-700" : ""}`}
                >
                  <div className="flex items-center gap-fluid-2 min-w-0">
                    <span
                      className={`text-fluid-sm ${fav ? "text-yellow-400" : "text-gray-400"}`}
                      onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(s); }}
                      title={fav ? "Unfavorite" : "Favorite"}
                    >
                      {fav ? "★" : "☆"}
                    </span>
                    {renderIcon(s)}
                    <span className="text-fluid-sm truncate">{b}/{qx || "USDT"}</span>
                  </div>
                  <div className="text-xs text-right text-gray-300 min-w-[80px]">
                    {typeof bal === "number" ? bal.toLocaleString() : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MainSymbolDropdown;
