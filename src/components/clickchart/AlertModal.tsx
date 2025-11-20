import React, { useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  defaultPrice?: number | null;
  symbol: string;
  onCreate?: (p: { symbol: string; price: number; note?: string }) => void;
};

const AlertModal: React.FC<Props> = ({ open, onClose, defaultPrice, symbol, onCreate }) => {
  const [price, setPrice] = useState<number | ''>(defaultPrice ?? '');
  const [note, setNote] = useState('');

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="w-[360px] rounded-xl border border-dark-600 bg-dark-800 p-4">
        <div className="text-lg font-semibold mb-3">Tạo cảnh báo • {symbol}</div>
        <label className="text-sm text-dark-300">Giá</label>
        <input
          className="mt-1 w-full rounded-lg bg-dark-700 px-3 py-2 outline-none"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value) || '')}
          placeholder="0.00"
        />
        <label className="mt-3 block text-sm text-dark-300">Ghi chú</label>
        <input
          className="mt-1 w-full rounded-lg bg-dark-700 px-3 py-2 outline-none"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button className="px-3 py-2 rounded-lg bg-dark-700" onClick={onClose}>Hủy</button>
          <button
            className="px-3 py-2 rounded-lg bg-primary-600"
            onClick={() => {
              if (price === '' || !Number.isFinite(Number(price))) return;
              onCreate?.({ symbol, price: Number(price), note });
              onClose();
            }}
          >
            Tạo cảnh báo
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;
