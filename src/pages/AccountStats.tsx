import React, { useEffect, useState } from 'react';
import { binanceAccountApi, orderHistoryApi } from '../utils/api';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';
import ReactApexChart from 'react-apexcharts';
import { ArrowDown, ArrowUp } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface Order {
  orderId: string;
  binanceAccount: string;
  create_time: string;
  side: 'BUY' | 'SELL';
  executedQty: string;
  origQty: string;
  price: string;
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
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

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

  const buyMap = new Map<string, number>();
  const sellMap = new Map<string, number>();

  filteredOrders.forEach((order) => {
    const date = dayjs(order.create_time).format('YYYY-MM-DD');
    const price = parseFloat(order.price);
    const qty = parseFloat(order.origQty) || parseFloat(order.executedQty);


    if (!qty || isNaN(qty)) return;
    const value = (!price || isNaN(price) ? 1 : price) * qty;

    if (order.side === 'BUY') {
      buyMap.set(date, (buyMap.get(date) || 0) + value);
    } else if (order.side === 'SELL') {
      sellMap.set(date, (sellMap.get(date) || 0) + value);
    }
  });

  const dates = Array.from(new Set([...buyMap.keys(), ...sellMap.keys()])).sort();
  const buySeries = dates.map((d) => ({ x: d, y: buyMap.get(d) || 0 }));
  const sellSeries = dates.map((d) => ({ x: d, y: sellMap.get(d) || 0 }));

  const lastBuy = buySeries[buySeries.length - 1]?.y || 0;
  const firstBuy = buySeries[0]?.y || 0;
  const change = lastBuy - firstBuy;
  const changePercent = firstBuy > 0 ? (change / firstBuy) * 100 : 0;
  const isPositive = change >= 0;

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: 'area',
      height: 300,
      toolbar: { show: false },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
      },
      background: 'transparent',
    },
    colors: ['#0ea5e9', '#ef4444'],
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.1,
        stops: [0, 100],
      },
    },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    grid: {
      borderColor: '#1e293b',
      strokeDashArray: 4,
      yaxis: { lines: { show: true } },
      padding: { top: 0, right: 0, bottom: 0, left: 10 },
    },
    xaxis: {
      type: 'datetime',
      labels: { style: { colors: '#64748b' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: '#64748b' },
        formatter: (value: number) => `$${value.toFixed(0)}`,
      },
    },
    tooltip: {
      x: { format: 'yyyy-MM-dd' },
      y: {
        formatter: (value: number) => `$${value.toFixed(2)}`,
      },
      theme: 'dark',
    },
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-4">Account Statistics</h2>

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

      <div className="flex space-x-4 mb-6">
        <div>
          <label className="block text-sm text-white mb-1">Từ ngày:</label>
          <DatePicker
            selected={startDate}
            onChange={(date) => setStartDate(date)}
            className="bg-dark-700 border border-dark-500 text-white rounded px-3 py-2 text-sm"
            placeholderText="Chọn ngày bắt đầu"
          />
        </div>
        <div>
          <label className="block text-sm text-white mb-1">Đến ngày:</label>
          <DatePicker
            selected={endDate}
            onChange={(date) => setEndDate(date)}
            className="bg-dark-700 border border-dark-500 text-white rounded px-3 py-2 text-sm"
            placeholderText="Chọn ngày kết thúc"
          />
        </div>
      </div>

      <div className="mb-4">
        <span className="text-xl font-bold text-white">${lastBuy.toLocaleString()}</span>
        <div className="flex items-center mt-1">
          <span className={`flex items-center text-sm font-medium ${isPositive ? 'text-success-500' : 'text-danger-500'}`}>
            {isPositive ? <ArrowUp className="w-4 h-4 mr-1" /> : <ArrowDown className="w-4 h-4 mr-1" />}
            ${Math.abs(change).toFixed(2)} ({Math.abs(changePercent).toFixed(2)}%) so với đầu kỳ
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
    </div>
  );
}
