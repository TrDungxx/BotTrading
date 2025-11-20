import React, { useEffect, useMemo, useState } from 'react';

type Side = 'BUY' | 'SELL';
type OrderType = 'LIMIT' | 'STOP';

type Props = {
  open: boolean;
  onClose: () => void;
  symbol: string;

  defaultPrice?: number | null;          // giá tại điểm click
  defaultType?: OrderType;               // 'LIMIT' | 'STOP'
  tickSize?: number;                     // để step đúng
  pricePrecision?: number;               // để format đẹp

  onSubmit?: (p: {
    symbol: string;
    side: Side;
    type: OrderType;
    qty: number;
    price?: number;      // dùng khi LIMIT
    stopPrice?: number;  // dùng khi STOP
  }) => void;
};

const NewOrderModal: React.FC<Props> = ({
  open, onClose, symbol, defaultPrice, defaultType = 'LIMIT',
  tickSize, pricePrecision, onSubmit,
}) => {
  const [side, setSide] = useState<Side>('BUY');
  const [type, setType] = useState<OrderType>(defaultType);
  const [price, setPrice] = useState<number | ''>('');
  const [stopPrice, setStopPrice] = useState<number | ''>('');
  const [qty, setQty] = useState<number | ''>('');

  const step = useMemo(() => {
    if (tickSize && tickSize > 0) return tickSize;
    if (typeof pricePrecision === 'number')
      return Number((1 / Math.pow(10, pricePrecision)).toFixed(pricePrecision));
    return undefined;
  }, [tickSize, pricePrecision]);

  const prec = useMemo(() => {
    if (typeof pricePrecision === 'number') return pricePrecision;
    if (tickSize) return (String(tickSize).split('.')[1]?.length ?? 0);
    return 8;
  }, [pricePrecision, tickSize]);

  const snap = (n: number) => {
    if (!tickSize || tickSize <= 0) return n;
    return Number((Math.round(n / tickSize) * tickSize).toFixed(prec));
  };

  // seed lại mỗi lần mở / đổi default
  useEffect(() => {
    if (!open) return;
    setType(defaultType);
    if (defaultPrice != null && Number.isFinite(defaultPrice)) {
      const seed = snap(defaultPrice);
      setPrice(seed);
      setStopPrice(seed);
    } else {
      setPrice('');
      setStopPrice('');
    }
  }, [open, defaultPrice, defaultType]); // eslint-disable-line

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="w-[420px] rounded-xl border border-dark-600 bg-dark-800 p-4">
        <div className="text-lg font-semibold mb-3">Đặt lệnh mới • {symbol}</div>

        <div className="grid grid-cols-2 gap-3">
          <select className="rounded-lg bg-dark-700 px-3 py-2" value={side}
                  onChange={(e)=>setSide(e.target.value as Side)}>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>

          <select className="rounded-lg bg-dark-700 px-3 py-2" value={type}
                  onChange={(e)=>setType(e.target.value as OrderType)}>
            <option value="LIMIT">LIMIT</option>
            <option value="STOP">DỪNG</option>
          </select>
        </div>

        {type === 'LIMIT' && (
          <>
            <label className="mt-3 block text-sm text-dark-300">Giá</label>
            <input
              className="mt-1 w-full rounded-lg bg-dark-700 px-3 py-2 outline-none"
              inputMode="decimal"
              step={step}
              value={price}
              onChange={(e)=>{
                const v = e.target.value.trim();
                if (v==='') return setPrice('');
                const num = Number(v); if (!Number.isFinite(num)) return;
                setPrice(snap(num));
              }}
              placeholder="0.00"
            />
          </>
        )}

        {type === 'STOP' && (
          <>
            <label className="mt-3 block text-sm text-dark-300">Giá dừng</label>
            <input
              className="mt-1 w-full rounded-lg bg-dark-700 px-3 py-2 outline-none"
              inputMode="decimal"
              step={step}
              value={stopPrice}
              onChange={(e)=>{
                const v = e.target.value.trim();
                if (v==='') return setStopPrice('');
                const num = Number(v); if (!Number.isFinite(num)) return;
                setStopPrice(snap(num));
              }}
              placeholder="0.00"
            />
          </>
        )}

        <label className="mt-3 block text-sm text-dark-300">Số lượng</label>
        <input
          className="mt-1 w-full rounded-lg bg-dark-700 px-3 py-2 outline-none"
          inputMode="decimal"
          value={qty}
          onChange={(e)=>{
            const v = e.target.value.trim();
            if (v==='') return setQty('');
            const num = Number(v); if (!Number.isFinite(num)) return;
            setQty(num);
          }}
          placeholder="0.00"
        />

        <div className="mt-4 flex justify-end gap-2">
          <button className="px-3 py-2 rounded-lg bg-dark-700" onClick={onClose}>Hủy</button>
          <button
            className="px-3 py-2 rounded-lg bg-primary-600"
            onClick={()=>{
              const q = qty === '' ? NaN : Number(qty);
              if (!Number.isFinite(q) || q<=0) return;

              if (type==='LIMIT') {
                const p = price === '' ? NaN : Number(price);
                if (!Number.isFinite(p) || p<=0) return;
                onSubmit?.({ symbol, side, type, qty: q, price: p });
              } else {
                const sp = stopPrice === '' ? NaN : Number(stopPrice);
                if (!Number.isFinite(sp) || sp<=0) return;
                onSubmit?.({ symbol, side, type, qty: q, stopPrice: sp });
              }
              onClose();
            }}
          >
            Gửi lệnh
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewOrderModal;
