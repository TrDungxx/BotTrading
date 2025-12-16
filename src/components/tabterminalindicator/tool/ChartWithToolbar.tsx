import React from "react";
import TVChartBinance, { TVReadyCtx } from "../TVChartBinance";

const TF_LIST = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"] as const;
type TF = typeof TF_LIST[number];

type Props = {
  /** Controlled symbol (không dấu /), ví dụ 'ETHUSDT' */
  symbol?: string;
  /** Controlled interval */
  interval?: TF | string;
  /** Với code cũ vẫn dùng được */
  defaultSymbol?: string;
  defaultInterval?: TF | string;

  market?: "spot" | "futures";

  /** Render control chọn pair tuỳ biến */
  renderPairControl?: (
    currentSymbol: string,
    onChange: (s: string) => void
  ) => React.ReactNode;

  /** Callback khi người dùng đổi symbol/interval trên toolbar */
  onSymbolChange?: (s: string) => void;
  onIntervalChange?: (tf: string) => void;

  /** Bắn OHLC realtime ra ngoài */
  onKline?: (k: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    start: number;
  }) => void;

  /** Render overlay đè lên chart (ví dụ FloatingPositionTagV2) */
  renderOverlay?: (ctx: TVReadyCtx | null) => React.ReactNode;
  onPickPrice?: (p: { price: number; x: number; y: number }) => void;
};

const AXIS_RIGHT_PX = 64; // bề rộng price scale bên phải

const ChartWithToolbar: React.FC<Props> = (props) => {
  const {
    symbol: controlledSymbol,
    interval: controlledInterval,
    defaultSymbol = "ETHUSDT",
    defaultInterval = "1h",
    market = "spot",
    renderPairControl,
    onSymbolChange,
    onIntervalChange,
    onKline,
    renderOverlay,
    onPickPrice,
  } = props;

  const [symbol, setSymbol] = React.useState(
    (controlledSymbol ?? defaultSymbol).toUpperCase()
  );
  const [interval, setInterval] = React.useState<string>(
    String(controlledInterval ?? defaultInterval)
  );

  // giữ context chart
  const [ctx, setCtx] = React.useState<TVReadyCtx | null>(null);
  const handleReady = React.useCallback((c: TVReadyCtx) => {
    setCtx(c);
  }, []);
  const handleKline = React.useCallback((k: any) => { onKline?.(k); }, [onKline]);
  const handlePick = React.useCallback((p: { price:number;x:number;y:number }) => { onPickPrice?.(p); }, [onPickPrice]);

  React.useEffect(() => {
    if (!controlledSymbol) return;
    const up = controlledSymbol.toUpperCase();
    if (up !== symbol) setSymbol(up);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledSymbol]);

  React.useEffect(() => {
    const next = String(controlledInterval ?? defaultInterval);
    if (next !== interval) setInterval(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledInterval, defaultInterval]);

  const handleSetSymbol = (s: string) => {
    const up = s.toUpperCase().replace(/\s+/g, "");
    setSymbol(up);
    onSymbolChange?.(up);
  };

  const handleSetInterval = (tf: string) => {
    setInterval(tf);
    onIntervalChange?.(tf);
  };

  const symbolPretty = React.useMemo(() => {
    const s = symbol.toUpperCase();
    if (s.endsWith("USDT")) return `${s.replace("USDT", "")}/USDT`;
    if (s.endsWith("USD")) return `${s.replace("USD", "")}/USD`;
    if (s.endsWith("BTC")) return `${s.replace("BTC", "")}/BTC`;
    return s;
  }, [symbol]);

  const exchangeLabel = market === "futures" ? "Futures USDT‑M" : "BINANCE";

  // ===== đo kích thước overlay & offset header =====
  const containerRef = React.useRef<HTMLDivElement>(null);
  const headerRef = React.useRef<HTMLDivElement>(null);
  const [overlayBox, setOverlayBox] = React.useState({
    width: 0,
    height: 0,
    plotTop: 0,        // chiều cao header (offset từ top container đến pane)
    axisRightPx: AXIS_RIGHT_PX,
  });

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const headerH = headerRef.current?.offsetHeight ?? 0;
      setOverlayBox({
  width: el.clientWidth,
  height: el.clientHeight,
  plotTop: 0,          // 👈 để 0 vì header overlay chứ không chiếm layout
  axisRightPx: 64,
});
    };

    // đo lần đầu
    measure();

    // theo dõi resize container
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);

    // theo dõi resize header (ít khi đổi nhưng cho chắc)
    const roh = new ResizeObserver(() => measure());
    if (headerRef.current) roh.observe(headerRef.current);

    return () => {
      ro.disconnect();
      roh.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {/* header mỏng nằm trong chart, chừa AXIS_RIGHT_PX cho right price scale */}
      <div
        ref={headerRef}
        className="absolute top-0 left-0 z-10 px-2 pt-1 pb-0.5 flex items-center gap-fluid-2 text-fluid-xs leading-none"
        style={{ width: `calc(100% - ${AXIS_RIGHT_PX}px)` }}
      >
        {renderPairControl ? (
          <div className="min-w-[180px]">
            {renderPairControl(symbol, handleSetSymbol)}
          </div>
        ) : (
          <input
            className="bg-transparent border border-dark-600/40 rounded px-2 py-0.5 w-28
                       focus:outline-none focus:border-primary-500/60"
            value={symbol}
            onChange={(e) => handleSetSymbol(e.target.value)}
          />
        )}

        <div className="opacity-80">
          {symbolPretty} · {String(interval)} · {exchangeLabel}
        </div>

        <div className="flex items-center gap-fluid-1 ml-auto">
          {TF_LIST.map((tf) => (
            <button
              key={tf}
              onClick={() => handleSetInterval(tf)}
              className={`px-1.5 py-0.5 rounded border text-fluid-2xs
                ${
                  String(interval) === tf
                    ? "border-primary-600 text-white bg-primary-600/60"
                    : "border-transparent text-gray-300 hover:bg-dark-700/40"
                }`}
              title={`Timeframe ${tf}`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <TVChartBinance
        symbol={symbol}
        interval={String(interval)}
        market={market}
        onKline={handleKline}
        onReady={handleReady}
        onPickPrice={handlePick}
      />

      {/* Overlay wrapper phủ toàn bộ vùng chart */}
      <div className="absolute inset-0 z-[70] pointer-events-none">
        {renderOverlay?.(
          ctx
            ? {
                ...ctx,
                // 👇 bổ sung để overlay (Blinking) canh chuẩn
                width: overlayBox.width,
                height: overlayBox.height,
                plotTop: overlayBox.plotTop,
                axisRightPx: overlayBox.axisRightPx,
              } as any
            : null
        )}
      </div>
    </div>
  );
};

export default ChartWithToolbar;
