import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';

interface TpSlModalProps {
  isOpen: boolean;
  onClose: () => void;
  tradeSide: 'buy' | 'sell';
  setTradeSide: (side: 'buy' | 'sell') => void;

  /** Khối lượng position (theo base asset), ví dụ 27 DOGE */
  quantity: number;

  /** Symbol, ví dụ "DOGEUSDT" */
  symbol: string;

  market: 'futures' | 'spot';
  positionSide: 'LONG' | 'SHORT';

  /** Giá vào lệnh bình quân của position (bắt buộc để tính PnL/ROI) */
  entryPrice: number;

  /** Mark/last hiện tại (không bắt buộc cho công thức) */
  currentPrice?: number;

  initialTakeProfitPrice?: string;
  initialStopLossPrice?: string;
  initialTakeProfitEnabled?: boolean;
  initialStopLossEnabled?: boolean;

  /** Tuỳ chọn: truyền sẵn leverage nếu bạn đã có ở trên */
  initialLeverage?: number;

  onSubmit: (
    orders: any[],
    values: {
      takeProfitPrice: string;
      stopLossPrice: string;
      takeProfitEnabled: boolean;
      stopLossEnabled: boolean;
    }
  ) => void;
}

/** Cố gắng lấy leverage đã lưu; fallback = 1 nếu không có */
function getLeverage(symbol: string, market: 'futures' | 'spot', preferred?: number) {
  if (preferred && preferred > 0) return preferred;

  // Một vài key thường gặp bạn dùng trước đây; thêm/bớt tuỳ dự án của bạn
  const candidates = [
    `tw.leverage.${market}.${symbol}`,
    `tw.leverage.${symbol}`,
    `binance.leverage.${symbol}`,
    `leverage.${symbol}`,
    `leverage`, // global
  ];

  for (const k of candidates) {
    const raw = localStorage.getItem(k);
    if (!raw) continue;
    const v = Number(raw);
    if (Number.isFinite(v) && v > 0) return v;
  }

  return 1; // nếu không tìm thấy → coi như không đòn bẩy để ROI% không sai
}

function formatNumber(n: number, maxFrac = 6) {
  if (!Number.isFinite(n)) return '-';
  // làm gọn số: 0.000123 -> 0.000123 ; 12345.6789 -> 12,345.68
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  }).format(n);
}

const TpSlModal: React.FC<TpSlModalProps> = ({
  isOpen,
  onClose,
  tradeSide,
  setTradeSide,
  quantity,
  symbol,
  market,
  positionSide,
  entryPrice,
  currentPrice,
  initialTakeProfitPrice,
  initialStopLossPrice,
  initialTakeProfitEnabled = true,
  initialStopLossEnabled = true,
  initialLeverage,
  onSubmit,
}) => {
  const [takeProfitEnabled, setTakeProfitEnabled] = useState(initialTakeProfitEnabled);
  const [stopLossEnabled, setStopLossEnabled] = useState(initialStopLossEnabled);

  const [tpMarketPrice, setTpMarketPrice] = useState('');
  const [slMarketPrice, setSlMarketPrice] = useState('');

  const [tpTriggerPrice, setTpTriggerPrice] = useState(initialTakeProfitPrice || '');
  const [tpMarketEditable, setTpMarketEditable] = useState(false);

  const [slTriggerPrice, setSlTriggerPrice] = useState(initialStopLossPrice || '');
  const [slMarketEditable, setSlMarketEditable] = useState(false);

  // leverage dùng để tính ROI%
  const leverage = useMemo(
    () => getLeverage(symbol, market, initialLeverage),
    [symbol, market, initialLeverage]
  );

  // reset khi mở modal
  useEffect(() => {
    if (isOpen) {
      setTakeProfitEnabled(initialTakeProfitEnabled);
      setStopLossEnabled(initialStopLossEnabled);
      setTpTriggerPrice(initialTakeProfitPrice || '');
      setSlTriggerPrice(initialStopLossPrice || '');
      setTpMarketEditable(false);
      setSlMarketEditable(false);
    }
  }, [
    isOpen,
    initialTakeProfitPrice,
    initialStopLossPrice,
    initialTakeProfitEnabled,
    initialStopLossEnabled,
  ]);

  /** Tính PnL & ROI% theo triggerPrice */
  const calcPnLAndRoi = (triggerStr: string) => {
    const trigger = Number(triggerStr);
    if (!Number.isFinite(trigger) || trigger <= 0 || !Number.isFinite(entryPrice) || entryPrice <= 0) {
      return { pnl: NaN, roiPct: NaN };
    }

    // Linear USDT-M: PnL = (Δprice) * qty (LONG), đảo dấu với SHORT
    let pnl =
      positionSide === 'LONG'
        ? (trigger - entryPrice) * quantity
        : (entryPrice - trigger) * quantity;

    // Initial margin = notional / leverage
    const initialMargin = leverage > 0 ? (entryPrice * quantity) / leverage : entryPrice * quantity;
    const roiPct = initialMargin > 0 ? (pnl / initialMargin) * 100 : NaN;

    return { pnl, roiPct };
  };

  const tpEst = useMemo(() => calcPnLAndRoi(tpTriggerPrice), [tpTriggerPrice, entryPrice, quantity, positionSide, leverage]);
  const slEst = useMemo(() => calcPnLAndRoi(slTriggerPrice), [slTriggerPrice, entryPrice, quantity, positionSide, leverage]);

  const handleSubmit = () => {
    const orders: any[] = [];

    if (takeProfitEnabled && tpTriggerPrice && parseFloat(tpTriggerPrice) > 0) {
      orders.push({
        type: 'TAKE_PROFIT_MARKET',
        stopPrice: parseFloat(tpTriggerPrice),
        triggerType: tpMarketEditable ? 'manual' : 'market-default',
      });
    }

    if (stopLossEnabled && slTriggerPrice && parseFloat(slTriggerPrice) > 0) {
      orders.push({
        type: 'STOP_MARKET',
        stopPrice: parseFloat(slTriggerPrice),
        triggerType: slMarketEditable ? 'manual' : 'market-default',
      });
    }

    onSubmit(orders, {
      takeProfitPrice: tpTriggerPrice,
      stopLossPrice: slTriggerPrice,
      takeProfitEnabled,
      stopLossEnabled,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-dark-800 w-full max-w-md rounded-lg shadow-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-fluid-3 right-3 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-semibold mb-4">Chốt lời/Cắt lỗ</h2>

        {/* Header: side toggle */}
        <div className="relative flex mb-4 rounded-fluid-md overflow-hidden border border-dark-600 w-fit">
          <div
            className={`absolute left-0 top-0 h-full w-1/2 rounded-fluid-md transition-all duration-300 pointer-events-none ${
              tradeSide === 'buy' ? 'bg-success-500' : 'translate-x-full bg-danger-500'
            }`}
            style={{ clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0% 100%)' }}
          />
          <button
            onClick={() => setTradeSide('buy')}
            className={`relative z-10 px-fluid-4 py-fluid-1 text-fluid-sm font-medium ${
              tradeSide === 'buy' ? 'text-white' : 'text-slate-400'
            }`}
          >
            Mua/Long
          </button>
          <button
            onClick={() => setTradeSide('sell')}
            className={`relative z-10 px-fluid-4 py-fluid-1 text-fluid-sm font-medium ${
              tradeSide === 'sell' ? 'text-white' : 'text-slate-400'
            }`}
          >
            Bán/Short
          </button>
        </div>

        {/* Entry & leverage info */}
        <div className="text-xs text-slate-400 mb-4 space-y-1">
          <div>Symbol: <span className="text-slate-200">{symbol}</span> · Side: <span className="text-slate-200">{positionSide}</span></div>
          <div>Giá vào lệnh: <span className="text-slate-200">{formatNumber(entryPrice, 8)} USDT</span> · Khối lượng: <span className="text-slate-200">{formatNumber(quantity, 6)}</span></div>
          <div>Đòn bẩy: <span className="text-slate-200">{leverage}x</span>{currentPrice ? <> · Mark: <span className="text-slate-200">{formatNumber(currentPrice, 8)}</span></> : null}</div>
        </div>

        {/* TP */}
        <div className="gap-fluid-2">
          <label className="flex items-center gap-fluid-2 mb-1">
            <input
              type="checkbox"
              checked={takeProfitEnabled}
              onChange={() => setTakeProfitEnabled(!takeProfitEnabled)}
            />
            <span className="text-fluid-sm font-medium">Take Profit</span>
            <span className="ml-auto text-xs text-dark-400">Mark</span>
          </label>

          <div className="flex gap-fluid-2">
            <input
              type="text"
              placeholder="Giá kích hoạt"
              value={tpTriggerPrice}
              onChange={(e) => setTpTriggerPrice(e.target.value)}
              className="form-input w-full"
            />
            <input
              type="text"
              placeholder="Giá thị trường"
              value={tpMarketPrice}
              onChange={(e) => setTpMarketPrice(e.target.value)}
              className={`form-input w-full ${tpMarketEditable ? '' : 'bg-dark-700 text-dark-500'}`}
              disabled={!tpMarketEditable}
            />
            <button
              className="btn btn-outline text-fluid-sm px-fluid-3"
              onClick={() => setTpMarketEditable(!tpMarketEditable)}
            >
              Thị trường
            </button>
          </div>

          {/* ƯỚC TÍNH TP */}
          <p className="text-xs text-slate-400">
            Ước tính: <span className={Number(tpEst.pnl) >= 0 ? 'text-success-400' : 'text-danger-400'}>
              {Number.isFinite(tpEst.pnl) ? `${formatNumber(tpEst.pnl, 4)} USDT` : '-'}
            </span>
            {` (${Number.isFinite(tpEst.roiPct) ? formatNumber(tpEst.roiPct, 2) + '%' : '-'})`}
          </p>
        </div>

        {/* SL */}
        <div className="gap-fluid-2 mt-6">
          <label className="flex items-center gap-fluid-2 mb-1">
            <input
              type="checkbox"
              checked={stopLossEnabled}
              onChange={() => setStopLossEnabled(!stopLossEnabled)}
            />
            <span className="text-fluid-sm font-medium">Stop Loss</span>
            <span className="ml-auto text-xs text-dark-400">Mark</span>
          </label>

          <div className="flex gap-fluid-2">
            <input
              type="text"
              placeholder="Giá kích hoạt"
              value={slTriggerPrice}
              onChange={(e) => setSlTriggerPrice(e.target.value)}
              className="form-input w-full"
            />
            <input
              type="text"
              placeholder="Giá thị trường"
              value={slMarketPrice}
              onChange={(e) => setSlMarketPrice(e.target.value)}
              className={`form-input w-full ${slMarketEditable ? '' : 'bg-dark-700 text-dark-500'}`}
              disabled={!slMarketEditable}
            />
            <button
              className="btn btn-outline text-fluid-sm px-fluid-3"
              onClick={() => setSlMarketEditable(!slMarketEditable)}
            >
              Thị trường
            </button>
          </div>

          {/* ƯỚC TÍNH SL */}
          <p className="text-xs text-slate-400">
            Ước tính: <span className={Number(slEst.pnl) >= 0 ? 'text-success-400' : 'text-danger-400'}>
              {Number.isFinite(slEst.pnl) ? `${formatNumber(slEst.pnl, 4)} USDT` : '-'}
            </span>
            {` (${Number.isFinite(slEst.roiPct) ? formatNumber(slEst.roiPct, 2) + '%' : '-'})`}
          </p>
        </div>

        {/* Confirm */}
        <button className="btn btn-primary mt-6 w-full" onClick={handleSubmit}>
          Xác nhận
        </button>
      </div>
    </div>
  );
};

export default TpSlModal;
