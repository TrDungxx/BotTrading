import React, { useEffect, useState } from 'react';
import { binanceAccountApi } from '../../utils/api';
import { binanceWS } from '../binancewebsocket/BinanceWebSocketService';

interface Props {
  onSelect?: (id: number) => void;
  onMultiAssetsModeChange?: (isMulti: boolean) => void;
}

interface BinanceAccount {
  id: number;
  Name?: string;
}

const BinanceAccountSelector: React.FC<Props> = ({
  onSelect,
  onMultiAssetsModeChange,
}) => {
  const [accounts, setAccounts] = useState<BinanceAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  useEffect(() => {
  binanceAccountApi.getMyAccounts().then((res) => {
    const accs = (res?.Data?.accounts || []) as BinanceAccount[];
    setAccounts(accs);
  });
}, []);

// ✅ Khi accounts đã có => khôi phục selected ID
useEffect(() => {
  if (accounts.length === 0) return;

  const savedId = localStorage.getItem('selectedBinanceAccountId');
  const parsedId = savedId ? parseInt(savedId) : null;
  const found = accounts.find((acc) => acc.id === parsedId);

  if (found) {
    setSelectedAccountId(found.id);
    binanceWS.setCurrentAccountId(found.id);

    // ✅ Gửi 2 lệnh cần thiết
    binanceWS.send({ action: 'selectBinanceAccount', binanceAccountId: found.id });
    binanceWS.send({ action: 'getMultiAssetsMode' });
    onSelect?.(found.id);
     binanceWS.send({
    action: "subscribeAccountUpdates",
    types: ["balance", "positions", "orders"],
  });

    // ✅ Lắng nghe phản hồi multiAssetsMode
    const handler = (msg: any) => {
      if (msg?.type === 'getMultiAssetsMode') {
        const isMulti = !!msg.multiAssetsMargin;
        onMultiAssetsModeChange?.(isMulti);
        localStorage.setItem(`multiAssetsMode_${found.id}`, String(isMulti));
        binanceWS.removeMessageHandler(handler);
      }
    };

    binanceWS.onMessage(handler);
  }
}, [accounts]);


  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value);
    setSelectedAccountId(id);
    localStorage.setItem('selectedBinanceAccountId', String(id)); // ✅ Lưu lại ID

    binanceWS.send({ action: 'selectBinanceAccount', binanceAccountId: id });
    binanceWS.setCurrentAccountId(id);
    binanceWS.send({ action: 'getMultiAssetsMode' });

    const handler = (msg: any) => {
      if (msg?.type === 'getMultiAssetsMode') {
        const isMulti = !!msg.multiAssetsMargin;
        onMultiAssetsModeChange?.(isMulti);
        localStorage.setItem(`multiAssetsMode_${id}`, String(isMulti));
        binanceWS.removeMessageHandler(handler);
      }
    };

    binanceWS.onMessage(handler);
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
