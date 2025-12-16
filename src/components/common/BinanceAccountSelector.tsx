import React, { useEffect, useRef, useState } from 'react';
import { binanceAccountApi } from '../../utils/api';
import { binanceWS } from '../binancewebsocket/BinanceWebSocketService';

interface Props {
  onSelect?: (id: number) => void;
  // Nếu bạn vẫn muốn hiển thị trạng thái multi-assets ở UI,
  // ta sẽ gọi đúng 1 lần sau khi select xong
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

  // Chống chạy 2 lần ở React 18 StrictMode
  const restoredRef = useRef(false);

  // 1) Load danh sách account (HTTP)
  useEffect(() => {
    let mounted = true;
    binanceAccountApi.getMyAccounts().then((res) => {
      if (!mounted) return;
      const accs = (res?.Data?.accounts || []) as BinanceAccount[];
      setAccounts(accs);
    });
    return () => { mounted = false; };
  }, []);

  // 2) Restore account từ localStorage (chỉ 1 lần khi đã có accounts)
  useEffect(() => {
    if (restoredRef.current || accounts.length === 0) return;

    const savedId = localStorage.getItem('selectedBinanceAccountId');
    const parsedId = savedId ? parseInt(savedId, 10) : NaN;
    const restore = accounts.find((a) => a.id === parsedId) ?? accounts[0];

    if (restore) {
      restoredRef.current = true;
      doSelect(restore.id, /*persist*/ true, /*emit*/ true);
    }
  }, [accounts]);

  // 3) Handle user change
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value, 10);
    if (!Number.isFinite(id) || id === selectedAccountId) return;
    doSelect(id, /*persist*/ true, /*emit*/ true);
  };

  // 4) Thao tác chọn account gói gọn 1 chỗ
  const doSelect = (
    id: number,
    persist = true,
    emit = true,
  ) => {
    setSelectedAccountId(id);
    if (persist) localStorage.setItem('selectedBinanceAccountId', String(id));

    // chỉ chọn account qua service (không subscribe ở đây)
    binanceWS.setCurrentAccountId(id);
    binanceWS.selectAccount(id);

    // Nếu UI cần hiển thị multi-assets -> hỏi 1 lần và trả ra callback
    if (onMultiAssetsModeChange) {
      binanceWS.getMultiAssetsMode((isMulti) => {
        onMultiAssetsModeChange(isMulti);
        localStorage.setItem(`multiAssetsMode_${id}`, String(isMulti));
      });
    }

    if (emit) onSelect?.(id);
  };

  return (
    <select
      value={selectedAccountId ?? ''}
      onChange={handleChange}
      className="bg-dark-700 text-white px-2 py-fluid-1 rounded border border-dark-500 text-fluid-base"
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
