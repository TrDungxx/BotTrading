import React, { useEffect, useState } from 'react';
import { binanceAccountApi } from '../../utils/api';
import { binanceWS } from '../binancewebsocket/BinanceWebSocketService';

interface Props {
  onSelect?: (id: number) => void;
}

interface BinanceAccount {
  id: number;
  Name?: string;
}

const BinanceAccountSelector: React.FC<Props> = ({ onSelect }) => {
  const [accounts, setAccounts] = useState<BinanceAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  useEffect(() => {
  binanceAccountApi.getMyAccounts().then((res) => {
    const accs = (res?.Data?.accounts || []) as BinanceAccount[];
    setAccounts(accs);
    setSelectedAccountId(null); // Không auto chọn
  });
}, []);


  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value);
    setSelectedAccountId(id);
    binanceWS.send({ action: 'selectBinanceAccount', binanceAccountId: id });
    onSelect?.(id);
  };

  return (
    <select
  value={selectedAccountId ?? ''}
  onChange={handleChange}
  className="bg-dark-700 text-white px-2 py-1 rounded border border-dark-500 text-sm"
>
  <option value="" disabled>
    Hãy chọn tài khoản để giao dịch
  </option>
  {accounts.map((acc) => (
    <option key={acc.id} value={acc.id}>
      {acc.Name || `Tài khoản ${acc.id}`}
    </option>
  ))}
</select>
  );
};

export default BinanceAccountSelector;
