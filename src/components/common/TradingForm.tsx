import React, { useEffect, useState } from 'react';
import * as Slider from '@radix-ui/react-slider';
import MarginModeModal from '../modeltrading/MarginModeModal';
import LeverageModal from '../modeltrading/LeverageModal';
import { binanceWS } from '../binancewebsocket/BinanceWebSocketService';
import { binanceAccountApi } from '../../utils/api';
import PositionModeModal from '../formtrading/PositionModeModal';
import TpSlModal from '../formtrading/TpSlModal';
interface Props {
  selectedSymbol: string;
  price: number;
  internalBalance: number;
  selectedMarket: 'spot' | 'futures';
}
interface BinanceAccount {
  id: number;
  Name?: string;
  status?: number;
  description?: string;
}
const TradingForm: React.FC<Props> = ({ selectedSymbol, price }) => {
  const [accounts, setAccounts] = useState<BinanceAccount[]>([]);
const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
const [isPositionModeOpen, setIsPositionModeOpen] = useState(false);
const [isTpSlModalOpen, setIsTpSlModalOpen] = useState(false);
const [tpSlSide, setTpSlSide] = useState<'buy' | 'sell'>('buy');
  const [isPriceOverridden, setIsPriceOverridden] = useState(false);
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'limit' | 'market' | 'stop-limit'>('limit');
  const [priceValue, setPriceValue] = useState('');
  const [amount, setAmount] = useState('');
  const [percent, setPercent] = useState(0);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tif, setTif] = useState<'GTC' | 'IOC' | 'FOK'>('GTC');
  const [tpSl, setTpSl] = useState(false);
  const [isMarginOpen, setIsMarginOpen] = useState(false);
  const [isLeverageOpen, setIsLeverageOpen] = useState(false);
  const [marginMode, setMarginMode] = useState<'cross' | 'isolated'>('cross');
  const [leverage, setLeverage] = useState(2);
  const [dualSidePosition, setDualSidePosition] = useState<boolean | null>(null);
const [selectedMarket, setSelectedMarket] = useState<'spot' | 'futures'>('futures');
  const [internalBalance, setInternalBalance] = useState<number>(0);

  
  const [stopPrice, setStopPrice] = useState(''); // for stop-limit
const [stopPriceType, setStopPriceType] = useState<'MARK' | 'LAST'>('MARK');
useEffect(() => {
  console.log('✅ Effect chạy 1 lần');

  const token = localStorage.getItem('authToken');
  if (!token) return;

  binanceWS.connect(token, (msg) => {
    console.log('🔥 Msg từ socket:', msg);

    // Sau khi xác thực thành công → gọi getMyBinanceAccounts + getPositionMode
    if (msg.type === 'authenticated') {
      binanceWS.getMyBinanceAccounts();

      // ✅ Lấy chế độ position (ONEWAY / HEDGE)
      binanceWS.send({ action: 'getPositionMode' });
    }

    // ✅ Xử lý kết quả position mode
    if (msg.type === 'getPositionMode') {
      console.log('📌 Position mode:', msg.dualSidePosition);
      setDualSidePosition(msg.dualSidePosition); // true = Hedge (S), false = Oneway (M)
    }
  });
}, []);

useEffect(() => {
  binanceAccountApi.getMyAccounts()
    .then((res) => {
      console.log('📦 Response từ getMyAccounts:', res);
      const accounts = (res?.Data?.accounts ?? []) as BinanceAccount[];
      console.log('📋 Accounts:', accounts);
      setAccounts(accounts); // ✅ Chỉ set danh sách, KHÔNG tự chọn
    })
    .catch((err) => {
      console.error('❌ Lỗi khi lấy danh sách tài khoản:', err);
    });
}, []);

useEffect(() => {
  if (selectedAccountId) {
    binanceWS.send({
      action: 'selectBinanceAccount',
      binanceAccountId: selectedAccountId,
      market: selectedMarket, // Hoặc selectedMarket nếu có state
    });
    console.log('✅ Sent selectBinanceAccount:', selectedAccountId);
      
  }
}, [selectedAccountId, selectedSymbol]);



  useEffect(() => {
  

  if (price > 0) {
    setPriceValue(price.toFixed(2));
  }
}, [price]);

useEffect(() => {
  if (!isPriceOverridden) {
    setPriceValue(price.toFixed(2)); // ✅ Chỉ set lại khi chưa bị người dùng override
  }
}, [selectedSymbol]);
  useEffect(() => {
    if (price > 0 && internalBalance > 0 && percent > 0) {
      const calculated = (internalBalance * percent) / 100 / price;
      setAmount(calculated.toFixed(8));
    }
  }, [percent, price, internalBalance]);

  // ✅ WS: Kết nối và lấy số dư
  useEffect(() => {
  const token = localStorage.getItem('authToken');
  if (!token) return;

  binanceWS.connect(token, (msg) => {
    if (msg.type === 'authenticated') {
      // ✅ Sau khi xác thực, yêu cầu danh sách tài khoản
      binanceWS.getMyBinanceAccounts();
    }

    if (msg.type === 'myBinanceAccounts') {
      const firstAccount = msg.data?.accounts?.[0];
      if (firstAccount?.id) {
        binanceWS.selectAccount(firstAccount.id);         // Gửi select lên backend
        setSelectedAccountId(firstAccount.id);            // ✅ Ghi lại vào React state
      }
    }

    if (msg.type === 'futuresDataLoaded') {
      const usdt = msg.data?.balances?.find((b: any) => b.asset === 'USDT');
      if (usdt) {
        setInternalBalance(parseFloat(usdt.availableBalance || '0'));
      }
    }
  });
}, []);

  // ✅ WS: Gửi order
  const placeOrder = () => {
  if (!amount) return alert('Vui lòng nhập số lượng');

  const market = 'futures';
  const positionSide = tradeSide === 'buy' ? 'LONG' : 'SHORT';

  const basePayload: any = {
    action: 'placeOrder',
    symbol: selectedSymbol,
    side: tradeSide.toUpperCase(),
    quantity: parseFloat(amount),
    market,
  };

  // Chỉ truyền khi là futures + Hedge
  if (market === 'futures') {
    basePayload.positionSide = positionSide;
    basePayload.reduceOnly = !!reduceOnly;
  }

  if (orderType === 'limit') {
    if (!priceValue) return alert('Vui lòng nhập giá limit');
    basePayload.type = 'LIMIT';
    basePayload.price = parseFloat(priceValue);
    basePayload.timeInForce = tif;
  } else if (orderType === 'market') {
    basePayload.type = 'MARKET';
  } else if (orderType === 'stop-limit') {
    if (!stopPrice || !priceValue) return alert('Vui lòng nhập cả giá stop và limit');
    basePayload.type = 'STOP';
    basePayload.stopPrice = parseFloat(stopPrice);
    basePayload.price = parseFloat(priceValue);
    basePayload.timeInForce = tif;
  }

  console.log('📤 Sent order:', basePayload);
  binanceWS.send(basePayload);
};


const handleClickPriceFromOrderBook = (priceFromOrderBook: number) => {
  setIsPriceOverridden(true); // ✅ Không cho auto update nữa
  setPriceValue(priceFromOrderBook.toFixed(2)); // Set theo giá người dùng chọn
};

const handleClosePosition = () => {
    if (!amount || parseFloat(amount) === 0) return alert('Nhập số lượng để đóng vị thế');
    const side = tradeSide === 'buy' ? 'SELL' : 'BUY';
    const positionSide = tradeSide === 'buy' ? 'LONG' : 'SHORT';
    binanceWS.send({
      action: 'placeOrder',
      symbol: selectedSymbol,
      side,
      type: 'MARKET',
      quantity: parseFloat(amount),
      market: 'futures',
      positionSide,
      reduceOnly: true,
    });
  };
 
  return (
    <div className="p-4 space-y-4">
      
      {/* Margin / Leverage / Position Mode */}
<div className="flex items-center space-x-2">
  {/* Mở modal chọn margin mode */}
  <button
    onClick={() => setIsMarginOpen(true)}
    className="btn btn-outline px-3 py-1 text-xs"
  >
    {marginMode === 'cross' ? 'Cross' : 'Isolated'}
  </button>

  {/* Mở modal chọn leverage */}
  <button
    onClick={() => setIsLeverageOpen(true)}
    className="btn btn-outline px-3 py-1 text-xs"
  >
    {leverage}x
  </button>

  {/* Nút chuyển đổi chế độ One-way / Hedge */}
  <button
  className={`text-xs px-2 py-1 rounded ${
    dualSidePosition ? 'bg-warning-700' : 'bg-dark-700'
  } hover:ring-1 ring-primary-500`}
  onClick={() => setIsPositionModeOpen(true)}
  title={dualSidePosition ? 'Chế độ Hedge (S)' : 'Chế độ One-way (M)'}
>
  {dualSidePosition ? 'S' : 'M'}
</button>

  {/* Hiển thị trạng thái hiện tại: M hoặc S */}
  {dualSidePosition !== null && (
    <span
      className={`text-xs px-2 py-1 rounded ${
        dualSidePosition ? 'bg-warning-700' : 'bg-dark-700'
      }`}
      title={
        dualSidePosition
          ? 'Chế độ Hedge (S): cho phép mở song song Long & Short'
          : 'Chế độ One-way (M): chỉ cho phép 1 chiều lệnh'
      }
    >
      {dualSidePosition ? 'S' : 'M'}
    </span>
  )}
  <PositionModeModal
  isOpen={isPositionModeOpen}
  onClose={() => setIsPositionModeOpen(false)}
  dualSidePosition={!!dualSidePosition}
  onChangeMode={() =>
    binanceWS.send({
      action: 'changePositionMode',
      mode: dualSidePosition ? 'ONEWAY' : 'HEDGE',
    })
  }
/>
</div>


      {/* Tabs */}
      <div className="flex space-x-2 text-sm">
        {['limit', 'market', 'stop-limit'].map((t) => (
          <button
            key={t}
            className={`px-3 py-1 rounded ${orderType === t ? 'bg-primary-500 text-white' : 'text-dark-400 hover:text-white'}`}
            onClick={() => setOrderType(t as any)}
          >
            {t === 'limit' ? 'Giới hạn' : t === 'market' ? 'Thị trường' : 'Stop Limit'}
          </button>
        ))}
      </div>

      <div className="text-xs text-dark-400">
        Số dư khả dụng: <span className="text-white font-medium">{Number(internalBalance).toFixed(2)} USDT</span>
      </div>

      {/* Price input */}
      {(orderType === 'limit' || orderType === 'stop-limit') && (
        <div>
          <label className="form-label">Giá</label>
          <div className="flex gap-2">
            <input
              type="text"
              className="form-input"
              value={priceValue}
              onChange={(e) => setPriceValue(e.target.value)}
            />
            <span className="text-xs text-dark-400">USDT</span>
          </div>
        </div>
      )}

      {/* Stop Price */}
      {orderType === 'stop-limit' && (
  <div>
    <label className="form-label">Giá Stop</label>
    <div className="flex gap-2">
      <input
        type="text"
        className="form-input"
        placeholder="0.00"
        value={stopPrice}
        onChange={(e) => setStopPrice(e.target.value)}
      />
      <select
        value={stopPriceType}
        onChange={(e) => setStopPriceType(e.target.value as 'MARK' | 'LAST')}
        className="form-select text-xs w-[80px]"
      >
        <option value="MARK">Mark</option>
        <option value="LAST">Last</option>
      </select>
    </div>
  </div>
)}


      {/* Amount */}
      <div>
        <label className="form-label">Số lượng</label>
        <div className="flex gap-2">
          <input
            type="text"
            className="form-input"
            placeholder="0.00000000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div className="text-xs text-dark-400">{selectedSymbol.replace('USDT', '')}</div>
        </div>
      </div>

      {/* Slider */}
      <div className="pt-4">
        <Slider.Root
          className="relative flex items-center select-none w-full h-5"
          value={[percent]}
          onValueChange={([v]) => setPercent(v)}
          min={0}
          max={100}
          step={1}
        >
          <Slider.Track className="bg-dark-600 relative grow rounded-full h-1">
            <Slider.Range className="absolute bg-primary-500 rounded-full h-full" />
          </Slider.Track>
         <Slider.Thumb className="block w-4 h-4 bg-primary-500 rounded-full shadow-sm hover:bg-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 relative">
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-dark-800 border border-dark-600 text-xs text-white rounded">
              {percent}%
            </div>
          </Slider.Thumb>
        </Slider.Root>
        <div className="flex justify-between text-xs text-dark-400">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Options */}
      <div className="flex items-center space-x-4 text-xs">
        <label className="flex items-center space-x-2">
  <input
    type="checkbox"
    checked={tpSl}
    onChange={() => {
      setTpSl(!tpSl);
      setIsTpSlModalOpen(!tpSl); // ✅ Mở modal nếu bật
    }}
    className="form-checkbox"
  />
  <span>TP/SL</span>
</label>
        <label className="flex items-center space-x-2">
          <input type="checkbox" checked={reduceOnly} onChange={() => setReduceOnly(!reduceOnly)} className="form-checkbox" />
          <span>Chỉ giảm</span>
        </label>
        <div className="ml-auto flex items-center space-x-2">
          <span>TIF</span>
          <select className="form-select" value={tif} onChange={(e) => setTif(e.target.value as any)}>
            <option value="GTC">GTC</option>
            <option value="IOC">IOC</option>
            <option value="FOK">FOK</option>
          </select>
        </div>
      </div>

      {/* Toggle chọn Buy/Sell */}
<div className="flex space-x-2 mb-2">
  <button
    className={`flex-1 btn ${tradeSide === 'buy' ? 'btn-success' : 'btn-outline'}`}
    onClick={() => setTradeSide('buy')}
  >
    Mua / Long
  </button>
  <button
    className={`flex-1 btn ${tradeSide === 'sell' ? 'btn-danger' : 'btn-outline'}`}
    onClick={() => setTradeSide('sell')}
  >
    Bán / Short
  </button>
</div>

{/* Nút đặt lệnh riêng biệt */}
<button
  className={`btn w-full ${tradeSide === 'buy' ? 'btn-success' : 'btn-danger'}`}
  onClick={placeOrder}
>
  Đặt lệnh {tradeSide === 'buy' ? 'MUA / LONG' : 'BÁN / SHORT'}
</button>
<button className="btn btn-outline w-full" onClick={handleClosePosition}>
        Đóng vị thế (Close Position)
      </button>

      {/* Modals */}
      <MarginModeModal
        isOpen={isMarginOpen}
        onClose={() => setIsMarginOpen(false)}
        onSelect={(mode) => {
  setMarginMode(mode);
  binanceWS.send({
    action: 'changeMarginType',
    symbol: selectedSymbol,
    marginType: mode === 'isolated' ? 'ISOLATED' : 'CROSSED',
  });
}}
        selectedMode={marginMode}
        symbol={selectedSymbol}
      />
      <LeverageModal
        isOpen={isLeverageOpen}
        onClose={() => setIsLeverageOpen(false)}
        leverage={leverage}
        onChange={(val) => {
  setLeverage(val);
  binanceWS.send({
    action: 'adjustLeverage',
    symbol: selectedSymbol,
    leverage: val,
  });
}}
      />
      <TpSlModal
  isOpen={isTpSlModalOpen}
  onClose={() => setIsTpSlModalOpen(false)}
  tradeSide={tpSlSide}
  setTradeSide={setTpSlSide}
  quantity={+amount} // hoặc số lượng đặt lệnh hiện tại
  symbol={selectedSymbol}
  currentPrice={price}
  market={selectedMarket} // 'futures' | 'spot'
  positionSide={tpSlSide === 'buy' ? 'LONG' : 'SHORT'}
  onSubmit={(orders) => {
  orders.forEach((order) => {
    const {
      market,
      symbol,
      positionSide,
      type,
      triggerType,
      stopPrice,
      reduceOnly,
      quantity,
    } = order;

    const side = positionSide === 'LONG' ? 'SELL' : 'BUY';

    if (!symbol || !quantity || quantity <= 0 || !type || !side) {
      console.error('❌ Invalid TP/SL order parameters:', order);
      return;
    }

    const payload = {
      action: 'placeOrder',
      market,
      symbol,
      side,
      type,
      triggerType,
      positionSide,
      stopPrice,
      reduceOnly: !!reduceOnly,
      quantity: Number(quantity),
    };

    console.log('✅ Sending TP/SL order:', payload);
    binanceWS.send(payload);
  });
}}
/>

    </div>
  );
};

export default TradingForm;
