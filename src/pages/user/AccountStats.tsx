import React, { useEffect, useState, useRef } from 'react';
import { binanceAccountApi, binanceSyncApi } from '../../utils/api';
import dayjs from 'dayjs';
import { useAuth } from '../../context/AuthContext';
import { Calendar, Loader, CheckCircle, Clock } from 'lucide-react';
import { DateRange } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { indicatorAnalyticsApi } from '../../utils/api';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { toast } from 'react-hot-toast';
import ModalOverlay from '../../components/common/ModalOverlay';


dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const Card = ({ title, value, className = '' }: { title: string; value: any; className?: string }) => (
  <div className="bg-dark-700 p-fluid-4 rounded-lg">
    <div className="text-fluid-sm text-dark-300">{title}</div>
    <div className={`text-lg font-semibold ${className}`}>{value}</div>
  </div>
);

export default function AccountStats() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedInternalAccountId, setSelectedInternalAccountId] = useState<number | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [indicatorPerf, setIndicatorPerf] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'pnl' | 'indicatorStats'>('pnl');
  const calendarRef = useRef<HTMLDivElement>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncSummary, setSyncSummary] = useState<any>(null);
  const syncInterval = useRef<NodeJS.Timeout | null>(null);



  const today = new Date();
  const last7Days = new Date();
  last7Days.setDate(today.getDate() - 6);

  const [range, setRange] = useState<any[]>([{
    startDate: last7Days,
    endDate: today,
    key: 'selection'
  }]);

  const startDate = range[0].startDate;
  const endDate = range[0].endDate;
  const selectedAccountObj = accounts.find(acc => acc.id.toString() === selectedAccountId);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const res = user.type === 0 ? await binanceAccountApi.getMyAccounts() : await binanceAccountApi.getListAccounts();
      const accs = res?.Data?.accounts || [];
      setAccounts(accs);
      const acc = accs[0];
      if (acc) {
        setSelectedInternalAccountId(acc.internalAccountId);
        setSelectedAccountId(acc.id.toString());
      }
    };
    fetch();
  }, [user]);

  useEffect(() => {
    if (!user || !selectedAccountObj || !selectedAccountObj.id) return;

    const accountId = selectedAccountObj.id;

    if (user.type === 0) {
      // 👤 USER → dùng getMyAnalytics(accountId)
      binanceSyncApi.getMyAnalytics(accountId).then((res) => {
        setAnalyticsData(res?.Data || null);
      }).catch((err) => {
        console.error('User analytics error:', err);
        setAnalyticsData(null);
      });
    } else {
      // 👑 ADMIN → dùng getAccountAnalytics(accountId)
      binanceSyncApi.getAccountAnalytics(accountId).then((res) => {
        setAnalyticsData(res?.Data || null);
      }).catch((err) => {
        console.error('Admin analytics error:', err);
        setAnalyticsData(null);
      });
    }
  }, [user, selectedAccountObj]);




  useEffect(() => {
    if (!user || !selectedAccountId || !startDate || !endDate) return;
    const fetchPerf = async () => {
      try {
        const params = {
          startDate: dayjs(startDate).format('YYYY-MM-DD'),
          endDate: dayjs(endDate).format('YYYY-MM-DD'),
        };
        const res = user.type === 0
          ? await indicatorAnalyticsApi.getMyIndicatorPerformance(params)
          : await indicatorAnalyticsApi.getIndicatorPerformance(params);
        const indicators = user.type === 0 ? res?.Data?.accounts?.[0]?.indicators || [] : res?.Data?.indicators || [];
        const filtered = indicators.filter((ind: any) => {
          const tradeTime = dayjs(ind.lastTrade);
          return tradeTime.isSameOrAfter(dayjs(startDate).startOf('day')) &&
            tradeTime.isSameOrBefore(dayjs(endDate).endOf('day')) &&
            (user.type === 0 || ind.accounts?.includes(selectedAccountId));
        });
        setIndicatorPerf(filtered);
      } catch (err) {
        console.error('Indicator performance fetch error:', err);
      }
    };
    fetchPerf();
  }, [user, selectedAccountId, startDate, endDate]);

  const summary = analyticsData?.overall?.summary;

  const handleSyncAccount = async () => {
    if (!selectedAccountObj?.id) {
      toast.error('Không tìm thấy tài khoản để đồng bộ.');
      return;
    }

    setSyncLoading(true);
    setSyncProgress(0);
    setSyncSummary(null);

    // Bắt đầu chạy tiến trình loading giả lập
    syncInterval.current = setInterval(() => {
      setSyncProgress(prev => {
        const next = prev + Math.random() * 8;
        return next >= 95 ? 95 : next;
      });
    }, 200);

    try {
      const res = await binanceSyncApi.syncMyAccount(selectedAccountObj.id);
      const data = res?.Data;

      // Dừng interval khi API trả về
      if (syncInterval.current) {
        clearInterval(syncInterval.current);
        syncInterval.current = null;
      }

      setSyncProgress(100);

      if (data?.summary) {
        setSyncSummary(data.summary);
        toast.success(
          `Đồng bộ thành công sau ${data.summary.durationFormatted}`,
          {
            icon: <CheckCircle className="text-green-500 w-5 h-5" />,
          }
        );
      } else {
        toast.error('Đồng bộ thành công nhưng không có dữ liệu.');
      }
    } catch (err) {
      if (syncInterval.current) {
        clearInterval(syncInterval.current);
        syncInterval.current = null;
      }
      setSyncProgress(0);
      toast.error('Đồng bộ thất bại!');
      console.error('Sync error:', err);
    } finally {
      setTimeout(() => {
        setSyncLoading(false);
        setSyncProgress(0);
      }, 800);
    }
  };


  const handleCancelSync = async () => {
    try {
      await binanceSyncApi.cancelMySyncAccount(selectedAccountObj.id);
      toast.error('⛔ Đã huỷ đồng bộ!');
    } catch (err) {
      toast.error('Không thể huỷ đồng bộ.');
    } finally {
      if (syncInterval.current) {
        clearInterval(syncInterval.current);
        syncInterval.current = null;
      }
      setSyncLoading(false);
      setSyncProgress(0);
    }
  };



  return (
    <div className='space-y-6 px-4 sm:px-4'>
      <div className="flex justify-between items-center mb-4 ">
        <h2 className="text-xl font-semibold text-white">Account Statistics</h2>

        {user?.type === 0 && (
          <button
            onClick={handleSyncAccount}
            disabled={syncLoading}
            className="flex items-center gap-fluid-2 bg-primary-500 hover:bg-primary-600 text-white text-fluid-sm px-fluid-4 py-fluid-1.5 rounded-fluid-md transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncLoading ? (
              <>
                <Loader className="animate-spin w-4 h-4" />
                Đang đồng bộ...
              </>
            ) : (
              'Đồng bộ dữ liệu'
            )}
          </button>
        )}
      </div>

      {/* ✅ Modal blocking UI khi đang sync */}
      {syncLoading && (
        <ModalOverlay
          progress={syncProgress}
          onCancel={handleCancelSync }
        />
      )}

      {/* ✅ Hiển thị thời gian sau khi sync */}
      {syncSummary && (
        <p className="text-fluid-sm text-dark-300 mt-2 flex items-center gap-fluid-1">
          <Clock className="w-4 h-4 text-primary-500" />
          Đã đồng bộ trong: <strong>{syncSummary.durationFormatted}</strong>
        </p>
      )}

      {user?.type !== 0 && accounts.length > 0 && (
        <div className="mb-4">
          <label className="block text-fluid-sm font-medium text-white mb-1">Chọn tài khoản:</label>
          <select
            className="bg-dark-700 border border-dark-500 text-white rounded-fluid-md px-fluid-3 py-2 text-fluid-sm"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>{acc.Name} ({acc.Email})</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap gap-fluid-2 items-center mb-4">
        {['1 ngày', '1 Tuần', '1 Tháng', '3 Tháng'].map((label, idx) => {
          const now = dayjs();
          let start;
          switch (label) {
            case '1 ngày': start = now.subtract(1, 'day'); break;
            case '1 Tuần': start = now.subtract(7, 'day'); break;
            case '1 Tháng': start = now.subtract(30, 'day'); break;
            case '3 Tháng': start = now.subtract(90, 'day'); break;
            default: start = now;
          }
          return (
            <button
              key={idx}
              onClick={() => setRange([{ ...range[0], startDate: start.toDate(), endDate: now.toDate() }])}
              className="bg-dark-700 text-white text-fluid-sm px-fluid-3 py-fluid-1 rounded-fluid-md hover:bg-primary-500"
            >
              {label}
            </button>
          );
        })}

        <div className="relative">
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="flex items-center px-fluid-3 py-fluid-1 bg-dark-700 text-white rounded-fluid-md text-fluid-sm hover:bg-dark-600"
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
        <button onClick={() => setActiveTab('pnl')} className={`pb-2 text-fluid-sm font-medium ${activeTab === 'pnl' ? 'text-white border-b-2 border-primary-500' : 'text-dark-400'}`}>PNL</button>
        <button onClick={() => setActiveTab('indicatorStats')} className={`pb-2 text-fluid-sm font-medium ${activeTab === 'indicatorStats' ? 'text-white border-b-2 border-primary-500' : 'text-dark-400'}`}>Indicator Stats</button>
      </div>

      {activeTab === 'pnl' && summary && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-fluid-4 text-white">
          <Card title="Tổng khối lượng" value={`${summary.totalVolume?.toFixed(2)} USDT`} />
          <Card title="Realized PnL" value={`${summary.totalRealizedPL?.toFixed(4)} USDT`} className={summary.totalRealizedPL >= 0 ? 'text-green-400' : 'text-red-400'} />
          <Card title="Phí (Commission)" value={`${summary.totalCommission?.toFixed(4)} USDT`} />
          <Card title="Net PnL" value={`${summary.netPL?.toFixed(4)} USDT`} className={summary.netPL >= 0 ? 'text-green-400' : 'text-red-400'} />
          <Card title="ROI trung bình" value={`${summary.avgROI?.toFixed(2)}%`} />
          <Card title="Tổng lệnh" value={summary.totalTrades} />
        </div>
      )}

      {activeTab === 'indicatorStats' && (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-fluid-sm text-white border border-dark-600">
            <thead className="bg-dark-700 text-left">
              <tr>
                <th className="px-fluid-4 py-2">Chỉ báo</th>
                <th className="px-fluid-4 py-2 text-right">Số lệnh</th>
                <th className="px-fluid-4 py-2 text-right">Winrate</th>
                <th className="px-fluid-4 py-2 text-right">PnL</th>
                <th className="px-fluid-4 py-2 text-right">ROI TB</th>
                <th className="px-fluid-4 py-2 text-right">Profit Factor</th>
                <th className="px-fluid-4 py-2 text-right">Drawdown</th>
              </tr>
            </thead>
            <tbody>
              {indicatorPerf.map((row, index) => (
                <tr key={index} className="border-b border-dark-700">
                  <td className="px-fluid-4 py-2">{row.indicatorCall}</td>
                  <td className="px-fluid-4 py-2 text-right">{row.totalTrades}</td>
                  <td className="px-fluid-4 py-2 text-right">{row.winRate?.toFixed(2)}%</td>
                  <td className={`px-fluid-4 py-2 text-right ${row.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{row.netPnl?.toFixed(4)} USDT</td>
                  <td className="px-fluid-4 py-2 text-right">{row.avgPnl?.toFixed(4)}</td>
                  <td className="px-fluid-4 py-2 text-right">{row.profitFactor?.toFixed(2)}</td>
                  <td className="px-fluid-4 py-2 text-right">{row.maxDrawdown?.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
