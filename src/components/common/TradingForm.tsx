import React, { useEffect, useState } from 'react';
import * as Slider from '@radix-ui/react-slider';
import MarginModeModal from '../modeltrading/MarginModeModal';
import LeverageModal from '../modeltrading/LeverageModal';
import { binanceWS } from '../binancewebsocket/BinanceWebSocketService';
import { binanceAccountApi } from '../../utils/api';
import MultiAssetsModeModal from '../formtrading/MultiAssetsModeModal';
import TpSlModal from '../formtrading/TpSlModal';
import { ExternalLink } from 'lucide-react';
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
  const [isMultiAssetsOpen, setIsMultiAssetsOpen] = useState(false);
  const [isTpSlModalOpen, setIsTpSlModalOpen] = useState(false);
  const [tpSlSide, setTpSlSide] = useState<'buy' | 'sell'>('buy');
  const [tpSl, setTpSl] = useState(false);
  const [tpSlOrders, setTpSlOrders] = useState<any[]>([]); // ✅ Thêm preview TP/SL
const [isMultiAssetsMode, setIsMultiAssetsMode] = useState<boolean>(false);

  const [isPriceOverridden, setIsPriceOverridden] = useState(false);
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'limit' | 'market' | 'stop-limit'>('limit');
  const [priceValue, setPriceValue] = useState('');
  const [amount, setAmount] = useState('');
  const [percent, setPercent] = useState(0);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tif, setTif] = useState<'GTC' | 'IOC' | 'FOK'>('GTC');
  const [isMarginOpen, setIsMarginOpen] = useState(false);
  const [isLeverageOpen, setIsLeverageOpen] = useState(false);
  const [marginMode, setMarginMode] = useState<'cross' | 'isolated'>('cross');
  const [leverage, setLeverage] = useState(2);
  const [multiAssetsMode, setMultiAssetsMode] = useState<boolean | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<'spot' | 'futures'>('futures');
  const [internalBalance, setInternalBalance] = useState<number>(0);
const [tpSlValues, setTpSlValues] = useState({
  takeProfitPrice: '',
  stopLossPrice: '',
  takeProfitEnabled: true,
  stopLossEnabled: true,
});
  const [stopPrice, setStopPrice] = useState('');
  const [stopPriceType, setStopPriceType] = useState<'MARK' | 'LAST'>('MARK');

  // ==== Helpers: safe wrappers (dùng if service chưa có method) ====
  const changeMarginTypeWS = (symbol: string, mode: 'cross' | 'isolated') => {
    const marginType = mode === 'isolated' ? 'ISOLATED' : 'CROSSED';
    if ((binanceWS as any).changeMarginType) {
      (binanceWS as any).changeMarginType(symbol, marginType);
    } else {
      // fallback: gọi private sendAuthed nếu có
      (binanceWS as any).sendAuthed?.({ action: 'changeMarginType', symbol, marginType });
    }
  };

  const adjustLeverageWS = (symbol: string, lev: number) => {
    if ((binanceWS as any).adjustLeverage) {
      (binanceWS as any).adjustLeverage(symbol, lev);
    } else {
      (binanceWS as any).sendAuthed?.({ action: 'adjustLeverage', symbol, leverage: lev });
    }
  };

  // ============================ USE EFFECTS ===============================
  useEffect(() => {
  const token = localStorage.getItem('authToken');
  if (!token) return;

  binanceWS.connect(token, (msg) => {
    switch (msg.type) {
      case 'authenticated':
        binanceWS.getMyBinanceAccounts();
        break;

      case 'changeMultiAssetsMode':
  setMultiAssetsMode(msg.multiAssetsMargin);
        break;

      case 'myBinanceAccounts': {
        const firstAccount = msg.data?.accounts?.[0];
        if (firstAccount?.id) {
          binanceWS.selectAccount(firstAccount.id);
          setSelectedAccountId(firstAccount.id);
        }
        break;
      }

      case 'futuresDataLoaded': {
        const usdt = msg.data?.balances?.find((b: any) => b.asset === 'USDT');
        if (usdt) {
          setInternalBalance(parseFloat(usdt.availableBalance || '0'));
        }
        break;
      }

      default:
        break;
    }
  });
}, []);


   useEffect(() => {
    binanceAccountApi.getMyAccounts()
      .then((res) => {
        const accounts = (res?.Data?.accounts ?? []) as BinanceAccount[];
        setAccounts(accounts);
      })
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
  if (!selectedAccountId) return;

  // chọn account qua wrapper (có queue authed an toàn)
  binanceWS.setCurrentAccountId(selectedAccountId);
  binanceWS.selectAccount(selectedAccountId);

  // lấy Multi-Assets Mode (one-shot callback, không cần tự remove)
  binanceWS.getMultiAssetsMode((isMulti) => {
    setMultiAssetsMode(isMulti);
    localStorage.setItem(
      `multiAssetsMode_${selectedAccountId}`,
      String(isMulti)
    );
  });
}, [selectedAccountId]);

  useEffect(() => {
    if (price > 0) setPriceValue(price.toFixed(2));
  }, [price]);

  useEffect(() => {
    if (!isPriceOverridden) setPriceValue(price.toFixed(2));
  }, [selectedSymbol]);

  useEffect(() => {
    if (price > 0 && internalBalance > 0 && percent > 0) {
      const calculated = (internalBalance * percent) / 100 / price;
      setAmount(calculated.toFixed(8));
    }
  }, [percent, price, internalBalance]);

  
// ============================ HANDLE MODE SWITCH ===============================
  const handleChangeMode = (newMode: boolean) => {
  // 1) Đổi Multi-Assets Margin
  binanceWS.changeMultiAssetsMode(
    newMode,
    () => {
      // 2) Khi BE xác nhận đổi multi-assets thành công -> đổi luôn Position Mode
      // Map theo ý bạn: true => HEDGE, false => ONE-WAY
      binanceWS.changePositionMode(
        newMode,
        () => {
          // 3) Xác nhận lại cả 2 trạng thái từ server (không set tay)
          binanceWS.getMultiAssetsMode((isMulti) => {
            setMultiAssetsMode(isMulti);
            const accId = binanceWS.getCurrentAccountId();
            if (accId) localStorage.setItem(`multiAssetsMode_${accId}`, String(isMulti));
          });

          binanceWS.getPositionMode((dual) => {
            // nếu bạn có state riêng cho position mode, set ở đây
            // setDualSidePosition(dual)
          });
        }
      );
    },
  );
};

useEffect(() => {
  const handler = (msg: any) => {
    if (typeof msg?.multiAssetsMargin === 'boolean') {
      console.log('[WS] Nhận được multiAssetsMargin cập nhật: ', msg.multiAssetsMargin);
      setMultiAssetsMode(msg.multiAssetsMargin);
      if (selectedAccountId)
        localStorage.setItem(
          `multiAssetsMode_${selectedAccountId}`,
          String(msg.multiAssetsMargin)
        );
    }
  };

  binanceWS.onMessage(handler);
  return () => {
    binanceWS.removeMessageHandler(handler);
  };
}, [selectedAccountId]);


  // ============================ ORDER ===============================
  const placeOrder = () => {
  if (!amount) return alert('Vui lòng nhập số lượng');

  const qty = parseFloat(amount);
  const isFutures = selectedMarket === 'futures';
  const side = (tradeSide.toUpperCase() as 'BUY' | 'SELL');

  // payload cơ bản
  const order: any = {
    symbol: selectedSymbol,
    side,
    quantity: qty,
    market: selectedMarket, // 'spot' | 'futures'
  };

  // type theo UI
  if (orderType === 'limit') {
    if (!priceValue) return alert('Vui lòng nhập giá limit');
    order.type = 'LIMIT';
    order.price = parseFloat(priceValue);
    order.timeInForce = tif; // 'GTC' | 'IOC' | 'FOK'
  } else if (orderType === 'market') {
    order.type = 'MARKET';
  } else if (orderType === 'stop-limit') {
    // ⚠️ Service hiện hỗ trợ 'STOP_MARKET' (không có giá limit).
    // Nếu bạn thật sự cần Stop-Limit, mở rộng wrapper để nhận 'STOP'.
    if (!stopPrice /* || !priceValue */) return alert('Nhập stop (và limit nếu cần)');
    order.type = 'STOP_MARKET';
    order.stopPrice = parseFloat(stopPrice);
    // order.price = parseFloat(priceValue); // bật nếu BE hỗ trợ STOP (stop-limit)
    // order.timeInForce = tif;
  }

  // futures options
  if (isFutures) {
    order.reduceOnly = !!reduceOnly;
    order.positionSide = (multiAssetsMode
      ? (tradeSide === 'buy' ? 'LONG' : 'SHORT') // HEDGE
      : 'BOTH'                                  // ONE-WAY
    );
  }

  // ✅ gửi qua wrapper (tự queue nếu chưa authed)
  binanceWS.placeOrder(order);

  // TP/SL phụ (nếu có)
  tpSlOrders.forEach((o) => {
    binanceWS.placeOrder({
      symbol: selectedSymbol,
      market: selectedMarket,
      side: tradeSide === 'buy' ? 'SELL' : 'BUY',
      type: o.type,               // 'STOP_MARKET' | 'TAKE_PROFIT_MARKET'
      stopPrice: o.stopPrice,
      triggerType: o.triggerType, // nếu BE dùng
      quantity: qty,
      reduceOnly: true,
      positionSide: isFutures
        ? (tradeSide === 'buy' ? 'LONG' : 'SHORT')
        : undefined,
    } as any);
  });

  setTpSlOrders([]);
};


  //const handleClosePosition = () => {
  //if (!amount || parseFloat(amount) === 0) return alert('Nhập số lượng để đóng vị thế');
  
 // const side = tradeSide === 'buy' ? 'SELL' : 'BUY';
 // const positionSide = tradeSide === 'buy' ? 'LONG' : 'SHORT';

 // const orderPayload: any = {
    //action: 'placeOrder',
   // symbol: selectedSymbol,
   // side,
    //type: 'MARKET',
   // quantity: parseFloat(amount),
    //market: selectedMarket, // ✅ dùng giá trị người dùng chọn
//  };

  // ✅ Chỉ gửi reduceOnly + positionSide nếu là FUTURES
  //if (selectedMarket === 'futures') {
    
    //orderPayload.positionSide = positionSide;
 // }

  //console.log('📤 Gửi lệnh đóng vị thế:', orderPayload);
//  binanceWS.send(orderPayload);
//};


 
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

  {/* Nút để mở modal */}
<button
  onClick={() => setIsMultiAssetsOpen(true)}
  className={`text-xs px-2 py-1 rounded ${
    multiAssetsMode ? 'bg-warning-700' : 'bg-dark-700'
  } hover:ring-1 ring-primary-500`}
  title={
    multiAssetsMode
      ? 'Chế độ Hedge (M): cho phép mở song song Long & Short'
      : 'Chế độ One-way (S): chỉ cho phép 1 chiều lệnh'
  }
>
  {multiAssetsMode ? 'M' : 'S'}
</button>

{/* Modal để thao tác đổi chế độ */}
<MultiAssetsModeModal
  isOpen={isMultiAssetsOpen}
  onClose={() => setIsMultiAssetsOpen(false)}
  multiAssetsMargin={multiAssetsMode ?? false}
  onChangeMode={(newMode) => {
    handleChangeMode(newMode); // chỉ gửi WS command đổi chế độ
  }}
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

      <div className="pl-12 text-xs text-dark-400">
        Số dư khả dụng: <span className="text-white font-medium">{Number(internalBalance).toFixed(2)} USDT</span>
      </div>

      {/* Price input */}
      {(orderType === 'limit' || orderType === 'stop-limit') && (
        <div>
          <label className="form-label mt-0 mb-1">Giá</label>
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
      <div className="pt-3">
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

      {/* Options và Preview TP/SL theo mẫu Binance */}
<div className="space-y-2 mt-2 text-xs text-white select-none">

        {/* TP/SL Toggle + Nâng cao */}
<div className="flex items-center justify-between text-xs text-white pt-2">
  <label className="flex items-center space-x-2 cursor-pointer">
    <input
      type="checkbox"
      checked={tpSl}
      onChange={() => setTpSl(!tpSl)}
      className="form-checkbox"
    />
    <span className="font-semibold">TP/SL</span>
  </label>
  <button
    type="button"
    onClick={() => setIsTpSlModalOpen(true)}
    className="flex items-center text-slate-400 hover:text-white space-x-1"
    title="Chỉnh sửa nâng cao"
  >
    <ExternalLink size={14} />
    <span>Nâng cao</span>
  </button>
</div>

{/* TP/SL Inline Form giống Binance */}
{tpSl && (
  <div className="pl-6 pt-1 space-y-2 border-l border-dark-600 ml-1">
    {/* Take Profit */}
    <div>
      <label className="flex items-center justify-between text-xs mb-1 text-slate-400">
        <span className="font-medium">Take Profit</span>
        <select className="form-select w-[60px] text-xs">
          <option>Mark</option>
          <option>Last</option>
        </select>
      </label>
      <input
        type="text"
        className="form-input w-full text-sm"
        placeholder="Nhập giá TP"
        value={tpSlValues.takeProfitPrice}
        onChange={(e) =>
          setTpSlValues((prev) => ({
            ...prev,
            takeProfitPrice: e.target.value,
            takeProfitEnabled: true,
          }))
        }
      />
    </div>

    {/* Stop Loss */}
    <div>
      <label className="flex items-center justify-between text-xs mb-1 text-slate-400">
        <span className="font-medium">Stop Loss</span>
        <select className="form-select w-[60px] text-xs">
          <option>Mark</option>
          <option>Last</option>
        </select>
      </label>
      <input
        type="text"
        className="form-input w-full text-sm"
        placeholder="Nhập giá SL"
        value={tpSlValues.stopLossPrice}
        onChange={(e) =>
          setTpSlValues((prev) => ({
            ...prev,
            stopLossPrice: e.target.value,
            stopLossEnabled: true,
          }))
        }
      />
    </div>
  </div>
)}


        {/* Lệnh chỉ giảm + TIF */}
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={reduceOnly}
              onChange={() => setReduceOnly(!reduceOnly)}
              className="form-checkbox"
            />
            <span>Lệnh chỉ giảm</span>
          </label>

          <div className="flex items-center space-x-2 ml-auto">
            <span>TIF</span>
            <select
              className="form-select w-auto"
              value={tif}
              onChange={(e) => setTif(e.target.value as any)}
            >
              <option value="GTC">GTC</option>
              <option value="IOC">IOC</option>
              <option value="FOK">FOK</option>
            </select>
          </div>
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

      {/* Nút đặt lệnh */}
      <button
        className={`btn w-full ${tradeSide === 'buy' ? 'btn-success' : 'btn-danger'}`}
        onClick={placeOrder}
      >
        Đặt lệnh {tradeSide === 'buy' ? 'MUA / LONG' : 'BÁN / SHORT'}
      </button>
     {/* <button className="btn btn-outline w-full" onClick={() => handleClosePosition()}>
        Đóng vị thế (Close Position)
      </button>*/}

      
      {/* Modals */}
      <MarginModeModal
        isOpen={isMarginOpen}
        onClose={() => setIsMarginOpen(false)}
        onSelect={(mode) => {
          setMarginMode(mode);
          changeMarginTypeWS(selectedSymbol, mode); // ✅ wrapper an toàn
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
          adjustLeverageWS(selectedSymbol, val); // ✅ wrapper an toàn
        }}
      />

      <TpSlModal
        isOpen={isTpSlModalOpen}
        onClose={() => setIsTpSlModalOpen(false)}
        tradeSide={tpSlSide}
        setTradeSide={setTpSlSide}
        quantity={+amount}
        symbol={selectedSymbol}
        currentPrice={price}
        market={selectedMarket}
        positionSide={tpSlSide === 'buy' ? 'LONG' : 'SHORT'}
        initialTakeProfitPrice={tpSlValues.takeProfitPrice}
        initialStopLossPrice={tpSlValues.stopLossPrice}
        initialTakeProfitEnabled={tpSlValues.takeProfitEnabled}
        initialStopLossEnabled={tpSlValues.stopLossEnabled}
        onSubmit={(orders, values) => {
          setTpSlOrders(orders);
          setTpSlValues(values);
          setTpSl(true);
        }}
      />


    </div>
  );
};

export default TradingForm;
