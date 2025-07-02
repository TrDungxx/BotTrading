import React, { useEffect, useState } from 'react';
import { monitoringApi } from '../utils/api';
import {
  Cpu,
  MemoryStick,
  HardDrive,
  ActivitySquare,
  TimerReset,
  RotateCcw,
  AlertTriangle,
  Plus,
  RefreshCw,
  Database,
  Play,
  Pause,
  Trash2,
  ShieldAlert,
  Server,
} from 'lucide-react';

interface SystemStats {
  cpuUsage: number;
  ramUsage: number;
  diskUsage: number;
  loadAvg: number;
  uptime: string;
  alerts: string[];
}

// ✅ Đặt ngoài component
const formatSeconds = (seconds: number): string => {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  return `${d}d ${h}h`;
};

export default function AdminDashBoard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
  setLoading(true);
  setError(null);

  try {
    // 1. Gọi API manual collect
    const collectRes = await monitoringApi.manualCollect();
    const alertsRes = await monitoringApi.getSystemAlerts();

    console.log("📦 manualCollect:", collectRes);
    console.log("🔔 alerts:", alertsRes);

    const data = collectRes?.Data ?? {};

    // 2. Gán vào state
    setStats({
      cpuUsage: parseFloat(data.cpu_usage_percent ?? "0"),
      ramUsage: parseFloat(data.memory_usage_percent ?? "0"),
      diskUsage: parseFloat(data.disk_usage_percent ?? "0"),
      loadAvg: data.load_average?.[0] ?? 0,
      uptime: formatSeconds(data.uptime_seconds ?? 0),
      alerts: alertsRes?.Data?.alerts ?? [],
    });
  } catch (err) {
    console.error("❌ Failed to load dashboard:", err);
    setError("Unable to load system dashboard.");
  } finally {
    setLoading(false);
  }
};


  const handleManualCollect = async () => {
    try {
      const res = await monitoringApi.manualCollect();
      console.log('✅ manualCollect result:', res);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await loadDashboard();
    } catch (err) {
      console.error('❌ Manual collect failed:', err);
    }
  };

  useEffect(() => {
    (async () => {
      await monitoringApi.manualCollect();
      await loadDashboard();
    })();
  }, []);

 

  return (
    <div className="space-y-8">
        
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-xl font-bold">System Monitoring Dashboard</h1>
        <div className="ml-auto flex gap-2">
        <button onClick={handleManualCollect} className="btn btn-outline">
          📥 Collect Now
        </button>
        <button
  onClick={loadDashboard}
  disabled={loading}
  className="btn btn-outline flex items-center gap-2"
>
  {loading ? (
    <>
      <RotateCcw className="h-4 w-4 animate-spin" />
      Refreshing...
    </>
  ) : (
    <>
      <RotateCcw className="h-4 w-4" />
      Refresh
    </>
  )}
</button>

        </div>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-500 px-4 py-2 text-red-300 rounded">
          ⚠ {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 text-left">
  <Card title="CPU Usage" value={`${stats?.cpuUsage?.toFixed(2) ?? '0'}%`} icon={<Cpu size={20} className="text-blue-500"/>} />
  <Card title="RAM Usage" value={`${stats?.ramUsage?.toFixed(2) ?? '0'}%`} icon={<MemoryStick className="text-yellow-500" size={20} />} />
  <Card title="Disk Usage" value={`${stats?.diskUsage?.toFixed(2) ?? '0'}%`} icon={<HardDrive size={20} className='text-red-500' />} />
  <Card title="Load Average" value={`${stats?.loadAvg?.toFixed(2) ?? '0'}`} icon={<ActivitySquare size={20} className='text-amber-800' />} />
  <Card title="Uptime" value={stats?.uptime ?? 'N/A'} icon={<TimerReset size={20} />} />
</div>


      <div className="bg-dark-800 rounded px-4 py-4 border border-dark-600">
        <p className="font-semibold text-red-400 mb-2">🚨 Alerts</p>
        {stats?.alerts.length ? (
          <div className="grid gap-2">
  {stats.alerts.map((alert, idx) => (
    <div key={idx} className="flex items-center gap-2 bg-dark-700 p-3 rounded-md shadow">
      <span className="text-red-400 font-semibold">
        {alert.hostname}
      </span>
      <span className="text-yellow-400">•</span>
      <span className="text-orange-300 font-medium">
        {alert.alert_types}
      </span>
      <span className="ml-auto text-dark-300 text-sm">
        {new Date(alert.create_time).toLocaleString()}
      </span>
    </div>
  ))}
</div>

        ) : (
          <p className="text-dark-300">• No alerts</p>
        )}
      </div>

      <div className="pt-2">
        
      </div>
    </div>
  );
}

function Card({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="bg-dark-800 p-4 rounded-lg border border-dark-600">
      <p className="text-sm text-dark-300">{title}</p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xl font-semibold text-white">{value}</span>
        <span className="text-lg">{icon}</span>
      </div>
    </div>
  );
}
