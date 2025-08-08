// FloatingPositionTag.tsx
import React, { useEffect, useState } from 'react';
import { binancePublicWS } from '../binancewebsocket/binancePublicWS';

interface PositionData {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice?: string; // nếu bạn dùng markPrice để tính PnL
}

interface Props {
  position?: PositionData;
  visible?: boolean;
}

const FloatingPositionTag: React.FC<Props> = ({ position, visible = true }) => {
  const [markPrice, setMarkPrice] = useState<number>(0);
  const [pnl, setPnl] = useState<number>(0);

  // Lắng nghe markPrice theo symbol
  useEffect(() => {
    if (!position?.symbol) return;
    const symbol = position.symbol.toUpperCase();

    const handleMarkPrice = (price: string) => {
      setMarkPrice(parseFloat(price));
    };

    binancePublicWS.subscribeMarkPrice(symbol, handleMarkPrice);

    return () => {
      binancePublicWS.unsubscribeMarkPrice(symbol);
    };
  }, [position?.symbol]);

  // Tính lại PnL mỗi khi markPrice thay đổi
  useEffect(() => {
    if (!position || !markPrice) return;

    const entry = parseFloat(position.entryPrice || '0');
    const size = parseFloat(position.positionAmt || '0');
    const pnlNow = (markPrice - entry) * size;
    setPnl(pnlNow);
  }, [position, markPrice]);

  if (!visible || !position) return null;

  return (
    <div className="absolute top-[100px] left-[140px] z-[50] bg-dark-600 border border-dark-400 rounded px-3 py-2 shadow-lg flex items-center space-x-2 text-white text-sm">
      <span>
        PnL:{" "}
        <span className={pnl > 0 ? "text-[#0ecb81]" : pnl < 0 ? "text-[#f6465d]" : ""}>
          {pnl.toFixed(2)} USDT
        </span>
      </span>
      <button className="text-xs px-2 py-1 bg-dark-400 rounded hover:bg-dark-300">TP/SL</button>
      <button
        className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white"
        onClick={() => {
          // TODO: Gửi lệnh đóng lệnh
        }}
      >
        ×
      </button>
    </div>
  );
};

export default FloatingPositionTag;
