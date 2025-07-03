// 📁 src/pages/AccountStats.tsx
import React, { useEffect, useState } from 'react';
import { binanceAccountApi, orderHistoryApi } from '../utils/api';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';
import ReactApexChart from 'react-apexcharts';
import { ArrowDown, ArrowUp } from 'lucide-react';

interface Order {
  orderId: string;
  binanceAccount: string;
  create_time: string;
  side: 'BUY' | 'SELL';
  executedQty: string;
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

  // Tổng hợp BUY / SELL theo ngày
  const buyMap = new Map<string, number>();
  const sellMap = new Map<string, number>();

  orders.forEach((order) => {
    const date = dayjs(order.create_time).format('YYYY-MM-DD');
    const price = parseFloat(order.price);
    const qty = parseFloat(order.executedQty);
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

  const options = {
    chart: {
      type: 'area',
      height: 300,
      toolbar: { show: false },
      background: 'transparent',
    },
    colors: ['#00C9A7', '#E63757'],
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
      type: 'category',
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
      shared: true,
      x: { format: 'dd MMM yyyy' },
      y: {
        formatter: (val: number) => {
  return typeof val === 'number' && !isNaN(val) ? `$${val.toFixed(0)}` : '';
}

      },
      theme: 'dark',
    },
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Account Statistics</h1>

      <div className="flex gap-4">
        {user?.type !== 0 && (
          <select
            className="form-select"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>{acc.Name} - {acc.Email}</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-end justify-between mb-4">
        <div>
          <span className="text-xl sm:text-2xl font-semibold">${lastBuy.toLocaleString()}</span>
          <div className="flex items-center mt-1">
            <span
              className={`flex items-center text-sm font-medium ${
                isPositive ? 'text-success-500' : 'text-danger-500'
              }`}
            >
              {isPositive ? <ArrowUp className="mr-1 h-4 w-4" /> : <ArrowDown className="mr-1 h-4 w-4" />}
              ${Math.abs(change).toFixed(2)} ({Math.abs(changePercent).toFixed(2)}%)
            </span>
            <span className="ml-1.5 text-xs text-dark-400">so với đầu kỳ</span>
          </div>
        </div>
      </div>

      <div className="h-[300px]">
        {!isLoading && typeof window !== 'undefined' && (
          <ReactApexChart
            options={options}
            series={[
              { name: 'Tổng BUY', data: buySeries },
              { name: 'Tổng SELL', data: sellSeries },
            ]}
            type="area"
            height={300}
          />
        )}
      </div>

      <div className="flex items-center space-x-4 text-sm mt-4">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-success-500"></div>
          <span className="text-dark-300">Tổng BUY</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-danger-500"></div>
          <span className="text-dark-300">Tổng SELL</span>
        </div>
      </div>
    </div>
  );
}
