import React, { useEffect, useState, useRef } from 'react';
import { binanceAccountApi, orderHistoryApi } from '../utils/api';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';
import ReactApexChart from 'react-apexcharts';
import { ArrowDown, ArrowUp, Calendar } from 'lucide-react';
import { DateRange } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

interface Order {
  orderId: string;
  binanceAccount: string;
  create_time: string;
  side: 'BUY' | 'SELL';
  executedQty: string;
  origQty: string;
  price: string;
  symbol: string;
  indicatorCall?: string;
}

interface AccountInfo {
  id: number;
  Name: string;
  Email: string;
}

export default function AccountStats() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [range, setRange] = useState<any[]>([
    { startDate: null, endDate: null, key: 'selection' },
  ]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [activeTab, setActiveTab] = useState<'buySell' | 'pnl' | 'indicatorStats'>('buySell');

  const calendarRef = useRef<HTMLDivElement>(null);

  const startDate = range[0].startDate;
  const endDate = range[0].endDate;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user) return;

    if (user.type === 0) {
      orderHistoryApi.getMyOrderHistory(1, 1000).then((res) => {
        const all = res?.Data?.orders || [];
        const userAccountId = all[0]?.binanceAccount;
        if (userAccountId) {
          setSelectedAccountId(userAccountId);
          setOrders(all.filter((o: Order) => o.binanceAccount === userAccountId));
        }
        setIsLoading(false);
      });
    } else {
      binanceAccountApi.getListAccounts().then((res) => {
        const accs = res?.Data?.accounts || [];
        setAccounts(accs);
        if (accs.length > 0) setSelectedAccountId(accs[0].id.toString());
      });
    }
  }, [user]);

  useEffect(() => {
    if (!selectedAccountId || user?.type === 0) return;
    setIsLoading(true);
    orderHistoryApi.getAllOrderHistory(1, 1000).then((res) => {
      const all = res?.Data?.orders || [];
      setOrders(all.filter((o: Order) => o.binanceAccount === selectedAccountId));
      setIsLoading(false);
    });
  }, [selectedAccountId, user]);

  const filteredOrders = orders.filter((order) => {
    const orderDate = dayjs(order.create_time);
    if (startDate && orderDate.isBefore(dayjs(startDate).startOf('day'))) return false;
    if (endDate && orderDate.isAfter(dayjs(endDate).endOf('day'))) return false;
    return true;
  });

  const availableSymbols = Array.from(new Set(filteredOrders.map((o) => o.symbol)));

  useEffect(() => {
    if (!selectedSymbol && availableSymbols.length > 0) {
      setSelectedSymbol(availableSymbols[0]);
    }
  }, [availableSymbols]);

  const ordersBySymbol = filteredOrders.filter((o) => o.symbol === selectedSymbol);
  const symbol = selectedSymbol || 'USDT';
  const buyMap = new Map<string, number>();
  const sellMap = new Map<string, number>();

  ordersBySymbol.forEach((order) => {
    const date = dayjs(order.create_time).format('YYYY-MM-DD');
    const price = parseFloat(order.price);
    const qty = parseFloat(order.origQty) || parseFloat(order.executedQty);
    if (!qty || isNaN(qty)) return;
    const value = (!price || isNaN(price) ? 1 : price) * qty;
    if (order.side === 'BUY') buyMap.set(date, (buyMap.get(date) || 0) + value);
    else if (order.side === 'SELL') sellMap.set(date, (sellMap.get(date) || 0) + value);
  });
  const indicatorCountMap = new Map<string, number>();
filteredOrders.forEach((order) => {
  const indicator = (order as any)?.indicatorCall || 'Không rõ';
  indicatorCountMap.set(indicator, (indicatorCountMap.get(indicator) || 0) + 1);
});

const indicatorStats = Array.from(indicatorCountMap.entries()).map(([name, count]) => ({ name, count }));


  const dates = Array.from(new Set([...buyMap.keys(), ...sellMap.keys()])).sort();
  const buySeries = dates.map((d) => ({ x: d, y: buyMap.get(d) || 0 }));
  const sellSeries = dates.map((d) => ({ x: d, y: sellMap.get(d) || 0 }));

  const lastBuy = buySeries[buySeries.length - 1]?.y || 0;
  const firstBuy = buySeries[0]?.y || 0;
  const change = lastBuy - firstBuy;
  const changePercent = firstBuy > 0 ? (change / firstBuy) * 100 : 0;
  const isPositive = change >= 0;

  const indicatorMap: Record<string, Record<string, number>> = {};
  filteredOrders.forEach((order) => {
    const date = dayjs(order.create_time).format('YYYY-MM-DD');
    const indicator = order.indicatorCall || 'Unknown';
    if (!indicatorMap[indicator]) indicatorMap[indicator] = {};
    indicatorMap[indicator][date] = (indicatorMap[indicator][date] || 0) + 1;
  });

  const indicatorDates = Array.from(new Set(filteredOrders.map(o => dayjs(o.create_time).format('YYYY-MM-DD')))).sort();
  const indicators = Object.keys(indicatorMap);

  const options: ApexCharts.ApexOptions = {
    chart: { type: 'area', height: 300, toolbar: { show: false }, animations: { enabled: true, easing: 'easeinout', speed: 800 }, background: 'transparent' },
    colors: ['#0ea5e9', '#ef4444'],
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1, stops: [0, 100] } },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    grid: { borderColor: '#1e293b', strokeDashArray: 4, yaxis: { lines: { show: true } }, padding: { top: 0, right: 0, bottom: 0, left: 10 } },
    xaxis: { type: 'datetime', labels: { style: { colors: '#64748b' } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { style: { colors: '#64748b' }, formatter: (value: number) => `${value.toFixed(0)} ${symbol}` } },
    tooltip: { x: { format: 'yyyy-MM-dd' }, y: { formatter: (value: number) => `${value.toFixed(2)} ${symbol}` }, theme: 'dark' },
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-4">Account Statistics</h2>

      {/* Restore account & symbol selection */}
      {user?.type !== 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-white mb-1">Chọn tài khoản:</label>
          <select
            className="bg-dark-700 border border-dark-500 text-white rounded-md px-3 py-2 text-sm focus:ring focus:outline-none"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.Name} ({acc.Email})
              </option>
            ))}
          </select>
        </div>
      )}

      {availableSymbols.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-white mb-1">Chọn symbol:</label>
          <select
            className="bg-dark-700 border border-dark-500 text-white rounded-md px-3 py-2 text-sm focus:ring focus:outline-none"
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
          >
            {availableSymbols.map((sym) => (
              <option key={sym} value={sym}>{sym}</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center mb-4">
  {['1 ngày', '1 Tuần', '1 Tháng', '3 Tháng'].map((label, idx) => (
    <button
      key={idx}
      onClick={() => {
        const now = dayjs();
        let start, end = now.endOf('day');
        switch (label) {
          case '1 ngày':
            start = now.subtract(1, 'day').startOf('day');
            break;
          case '1 Tuần':
            start = now.subtract(7, 'day').startOf('day');
            break;
          case '1 Tháng':
            start = now.subtract(30, 'day').startOf('day');
            break;
          case '3 Tháng':
            start = now.subtract(90, 'day').startOf('day');
            break;
          default:
            start = null;
        }
        setRange([{ ...range[0], startDate: start?.toDate(), endDate: end.toDate() }]);
      }}
      className="bg-dark-700 text-white text-sm px-3 py-1 rounded-md hover:bg-primary-500"
    >
      {label}
    </button>
  ))}

  <div className="relative">
    <button
      onClick={() => setShowCalendar(!showCalendar)}
      className="flex items-center px-3 py-1 bg-dark-700 text-white rounded-md text-sm hover:bg-dark-600"
    >
      <Calendar className="w-4 h-4 mr-1" />
      {startDate && endDate
        ? `${dayjs(startDate).format('YYYY-MM-DD')} → ${dayjs(endDate).format('YYYY-MM-DD')}`
        : 'Chọn ngày'}
    </button>

    {showCalendar && (
      <div ref={calendarRef} className="absolute z-50 mt-2">
        <DateRange
          editableDateInputs
          onChange={(item) => setRange([item.selection])}
          moveRangeOnFirstSelection={false}
          ranges={range}
          maxDate={new Date()}
        />
      </div>
    )}
  </div>
</div>


      <div className="flex gap-6 border-b border-dark-500 mb-4">
        <button onClick={() => setActiveTab('buySell')} className={`pb-2 text-sm font-medium ${activeTab === 'buySell' ? 'text-white border-b-2 border-primary-500' : 'text-dark-400'}`}>Tổng BUY SELL</button>
        <button onClick={() => setActiveTab('pnl')} className={`pb-2 text-sm font-medium ${activeTab === 'pnl' ? 'text-white border-b-2 border-primary-500' : 'text-dark-400'}`}>PNL</button>
        <button onClick={() => setActiveTab('indicatorStats')} className={`pb-2 text-sm font-medium ${activeTab === 'indicatorStats' ? 'text-white border-b-2 border-primary-500' : 'text-dark-400'}`}>Indicator Stats</button>
      </div>
      {activeTab === 'buySell' && (
  <>
    <div className="mb-4">
      <span className="text-xl font-bold text-white">{lastBuy.toLocaleString()} {symbol}</span>
      <div className="flex items-center mt-1">
        <span className={`flex items-center text-sm font-medium ${isPositive ? 'text-success-500' : 'text-danger-500'}`}>
          {isPositive ? <ArrowUp className="w-4 h-4 mr-1" /> : <ArrowDown className="w-4 h-4 mr-1" />}
          {Math.abs(change).toFixed(2)} {symbol} ({Math.abs(changePercent).toFixed(2)}%) so với đầu kỳ
        </span>
      </div>
    </div>

    <ReactApexChart
      options={options}
      series={[
        { name: 'Tổng BUY', data: buySeries },
        { name: 'Tổng SELL', data: sellSeries },
      ]}
      type="area"
      height={300}
    />

    <div className="flex items-center justify-center space-x-4 mt-4">
      <div className="flex items-center space-x-2">
        <span className="w-3 h-3 bg-sky-500 rounded-full"></span>
        <span className="text-sm text-white">Tổng BUY</span>
      </div>
      <div className="flex items-center space-x-2">
        <span className="w-3 h-3 bg-red-500 rounded-full"></span>
        <span className="text-sm text-white">Tổng SELL</span>
      </div>
    </div>
  </>
)}


      {activeTab === 'pnl' && (
        <div className="mt-4">
          <table className="min-w-full text-sm text-white border border-dark-600">
            <thead className="bg-dark-700">
              <tr>
                <th className="px-4 py-2 border-b border-dark-600 text-left">Ngày</th>
                <th className="px-4 py-2 border-b border-dark-600 text-right">Tổng BUY</th>
                <th className="px-4 py-2 border-b border-dark-600 text-right">Tổng SELL</th>
                <th className="px-4 py-2 border-b border-dark-600 text-right">PNL</th>
              </tr>
            </thead>
            <tbody>
              {dates.map(date => {
                const buy = buyMap.get(date) || 0;
                const sell = sellMap.get(date) || 0;
                const pnl = buy - sell;
                return (
                  <tr key={date} className="border-b border-dark-700">
                    <td className="px-4 py-2">{date}</td>
                    <td className="px-4 py-2 text-right">{buy.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{sell.toFixed(2)}</td>
                    <td className={`px-4 py-2 text-right ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{pnl.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
            
          </table>
        </div>
      )}
      {activeTab === 'indicatorStats' && (
  <div className="mt-4">
    <table className="min-w-full text-sm text-white border border-dark-600">
      <thead className="bg-dark-700">
        <tr>
          <th className="px-4 py-2 border-b border-dark-600 text-left">Chỉ báo</th>
          <th className="px-4 py-2 border-b border-dark-600 text-right">Số lệnh</th>
        </tr>
      </thead>
      <tbody>
        {indicatorStats.map((row) => (
          <tr key={row.name} className="border-b border-dark-700">
            <td className="px-4 py-2">{row.name}</td>
            <td className="px-4 py-2 text-right">{row.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}

      
    </div>
    
  );
}
