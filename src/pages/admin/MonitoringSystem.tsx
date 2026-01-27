import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Activity, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { metricsApi, streamPerformanceApi } from '../../utils/api';

export default function MonitoringSystem() {
  const { user } = useAuth();
  const isAdmin = [1, 2, 99].includes(user?.type);

  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [lastPing, setLastPing] = useState<string>('');
  const [performanceStats, setPerformanceStats] = useState<any[]>([]);
  const [latestMetrics, setLatestMetrics] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMonitoringData();
  }, []);

  const loadMonitoringData = async () => {
    setLoading(true);
    setError(null);

    try {
      // --- STREAM PERFORMANCE ---
      if (isAdmin) {
        const perfRes = await streamPerformanceApi.getAllStreamPerformance();
        console.log('🟢 STREAM DATA:', perfRes?.Data);
        const raw = perfRes?.Data?.performance || [];
        const formatted = raw.map((p: any) => ({
          timestamp: p.update_time,
          latency: parseFloat(p.LatencyMs || '0'),
          cpu: parseFloat(p.CpuUsagePercent || '0'),
          memory: parseFloat(p.MemoryUsageMb || '0'),
        }));
        setPerformanceStats(formatted);
        setIsConnected(raw[0]?.Status === 'active');
        setLastPing(raw[0]?.update_time || '');
      } else {
        const res = await streamPerformanceApi.getMyStreamPerformance();
        setIsConnected(res?.data?.connected || false);
        setLastPing(res?.data?.lastPing || '');
      }

      // --- METRICS ---
      if (isAdmin) {
        const metricsRes = await metricsApi.getAllMetrics();
        const rawMetrics = metricsRes?.Data?.metrics || []; // ✅ sửa từ `data` thành `Data`
        const latest = rawMetrics.slice(0, 6).map((m: any) => ({
          CurrentConnections: m.CurrentConnections ?? 0,
          ActivePositions: m.ActivePositions ?? 0,
          PendingOrders: m.PendingOrders ?? 0,
          ApiCallsPerMin: m.ApiCallsPerMin ?? 0,
          CurrentWeight: m.CurrentWeight ?? 0,
          MaxWeight: m.MaxWeight ?? 0,
          TimeOffset: m.TimeOffset ?? '--',
          BotStatus: m.BotStatus ?? '--',
          updateTime: m.update_time ? new Date(m.update_time).toLocaleString() : 'N/A', // ✅ fix ngày
        }));
        setLatestMetrics(latest);
      } else {
        const metricsRes = await metricsApi.getLatestMetrics();
        const latest = (metricsRes?.Data?.metrics || []).slice(0, 6).map((m: any) => ({
          CurrentConnections: m.CurrentConnections ?? 0,
          ActivePositions: m.ActivePositions ?? 0,
          PendingOrders: m.PendingOrders ?? 0,
          ApiCallsPerMin: m.ApiCallsPerMin ?? 0,
          CurrentWeight: m.CurrentWeight ?? 0,
          MaxWeight: m.MaxWeight ?? 0,
          TimeOffset: m.TimeOffset ?? '--',
          BotStatus: m.BotStatus ?? '--',
          updateTime: m.update_time ? new Date(m.update_time).toLocaleString() : 'N/A',
        }));
        setLatestMetrics(latest);
      }

    } catch (err) {
      console.error('🚨 Monitoring load error:', err);
      setError('Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 px-4 sm:px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Monitoring System</h1>
        <button onClick={loadMonitoringData} className="btn btn-outline">
          <Activity className="mr-2 h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-danger-500/10 text-danger-500 border border-danger-500/20 p-fluid-4 rounded-fluid-md flex items-center gap-fluid-3">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Stream Status */}
      <div className="card p-6">
        <h2 className="text-lg font-medium mb-2">Stream Connection</h2>
        <div className="flex items-center gap-fluid-3">
          <span className={`h-3 w-3 rounded-full ${isConnected ? 'bg-success-500 animate-pulse' : 'bg-danger-500'}`} />
          <p className={`text-fluid-sm ${isConnected ? 'text-success-500' : 'text-danger-500'}`}>
            {isConnected === null ? 'Loading...' : isConnected ? 'Connected' : 'Disconnected'}
          </p>
          {lastPing && (
            <p className="ml-4 text-fluid-sm text-dark-400">
              Last Update:{' '}
              <span className="text-dark-300">{new Date(lastPing).toLocaleTimeString()}</span>
            </p>
          )}
        </div>
      </div>

      {/* Chart */}
      {isAdmin && (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={performanceStats}
            margin={{ top: 20, right: 20, left: 0, bottom: 10 }}
          >
            <XAxis
              dataKey="timestamp"
              stroke="#94a3b8"
              tickFormatter={(value) =>
                new Date(value).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })
              }
              interval="preserveStartEnd"
            />
            <YAxis stroke="#94a3b8" />
            <Tooltip
              formatter={(value: any, name: string) => [`${value}`, name]}
              labelFormatter={(label: any) => {
                const date = new Date(label);
                return date.toLocaleString('en-GB', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });
              }}
              contentStyle={{
                backgroundColor: '#1e293b', // bg-dark-800
                border: '1px solid #334155', // border-dark-700
                borderRadius: '8px',
                color: '#e2e8f0', // text color
                fontSize: '0.85rem'
              }}
              labelStyle={{ color: '#94a3b8' }} // nhạt hơn
            />

            <Legend />
            <Line type="monotone" dataKey="latency" stroke="#2C7BE5" strokeWidth={2} name="Latency (ms)" />
            <Line type="monotone" dataKey="cpu" stroke="#E63757" strokeWidth={2} name="CPU (%)" />
            <Line type="monotone" dataKey="memory" stroke="#00FF88" strokeWidth={2} name="Memory (MB)" />

          </LineChart>
        </ResponsiveContainer>
      )}


      {/* Latest Metrics */}
      <div className="card p-6">
        <h2 className="text-lg font-medium mb-4">Latest Metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-fluid-4">
          {latestMetrics.map((m, i) => (
            <div key={i} className="rounded-fluid-md bg-dark-700 p-fluid-4 text-fluid-sm space-y-1 leading-relaxed">
              <div className="flex justify-between font-semibold">
                <span>Conn: {m.CurrentConnections}</span>
                <span>ActivePos: {m.ActivePositions}</span>
              </div>
              <div className="text-dark-300">
                Pending Orders: <span className="text-white">{m.PendingOrders}</span>
              </div>

              <div className="flex justify-between text-dark-300">
                <span>API/min: <span className="text-white">{m.ApiCallsPerMin}</span></span>
                <span>Weight: <span className="text-white">{m.CurrentWeight}</span> / {m.MaxWeight}</span>
              </div>

              <div className="flex justify-between text-dark-300">
                <span>Offset: <span className="text-white">{m.TimeOffset}</span></span>
                <span>Status: <span className="text-white">{m.BotStatus}</span></span>
              </div>

              <div className="text-right text-xs text-dark-400 italic">
                Update: {m.updateTime || 'N/A'}


              </div>
            </div>
          ))}
        </div>


      </div>
    </div>
  );
}
