// ✅ AdminSystem.tsx (updated to use ServerDetailDashboard)

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle, Cpu, MemoryStick, HardDrive, CheckCircle, Server, Info, RotateCcw, TimerReset, Loader2,
} from 'lucide-react';
import { monitoringApi } from '../../utils/api';
import dayjs from 'dayjs';
import ServerDetailDashboard from './ServerDetailDashboard';

interface Server {
  id: number | string;
  hostname: string;
  cpu_usage_percent: string;
  memory_usage_percent: string;
  disk_usage_percent?: string;
  uptime_seconds?: number;
  load_average?: number[];
  memory_used_bytes?: string;
  memory_total_bytes?: string;
  disk_used_bytes?: string;
  disk_total_bytes?: string;
  network_interfaces?: { ip: string; mac: string }[];
  cpu_model?: string;
  cpu_cores?: number;
}

interface MetricPoint {
  time: string;
  cpu: string;
  memory: string;
}

export default function AdminSystem() {
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [tab, setTab] = useState<'alert' | 'list' | 'detail'>('list');
  const [metrics, setMetrics] = useState<MetricPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);

  const loadServers = async () => {
    setLoading(true);
    try {
      const res = await monitoringApi.getAllSystemMonitors();
      const raw = res?.Data?.monitors;


      if (Array.isArray(raw)) setServers(raw);
    } catch (err) {
      console.error('❌ Failed to load servers:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async (hostname: string) => {
    setLoading(true);
    try {
      const res = await monitoringApi.getPerformanceMetrics(hostname);
      setMetrics(res?.Data?.metrics ?? []);
    } catch (err) {
      console.error('❌ Failed to load metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectServer = async (server: Server) => {
    setSelectedServer(server);
    await loadMetrics(server.hostname);
    setTab('detail');
  };

  useEffect(() => { loadServers(); }, []);

  useEffect(() => {
    if (tab === 'alert') {
      const fetchAlerts = async () => {
        const fromISOString = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
        try {
          const res = await monitoringApi.getSystemAlertsFrom(fromISOString);
          const ramAlerts = (res?.Data?.alerts ?? []).filter((a: any) => a.alert_types.includes('HIGH_RAM'));
          setAlerts(ramAlerts);
        } catch (err) {
          console.error('❌ Failed to load alerts:', err);
        }
      };
      fetchAlerts();
    }
  }, [tab]);

  const representativeServers = Array.from(new Set(servers.map(s => s.hostname)))
    .map(name => servers.find(s => s.hostname === name)!)
    .filter(Boolean);



  const formatUptime = (seconds: number): string => {
    const d = Math.floor(seconds / 86400); // 3600 * 24
    const h = Math.floor((seconds % 86400) / 3600);
    return `${d}d ${h}h`;
  };
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">System Monitoring Dashboard</h1>

      <div className="flex gap-2 mt-4">
        <button className={`btn ${tab === 'list' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('list')}>
          <Server className="w-4 h-4 mr-1" /> List Server
        </button>
        <button className={`btn ${tab === 'alert' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('alert')}>
          <AlertTriangle className="w-4 h-4 mr-1" /> Alerts
        </button>
        
        <button className={`btn ${tab === 'detail' ? 'btn-primary' : 'btn-outline'} opacity-50`} disabled>
          <Info className="w-4 h-4 mr-1" /> Server Detail
        </button>
        <button className="btn btn-outline" onClick={loadServers} disabled={loading}>
          {loading ? <Loader2 className="animate-spin w-4 h-4 mr-1" /> : <RotateCcw className="w-4 h-4 mr-1" />} Refresh
        </button>
      </div>

      {tab === 'alert' && (
        <div className="bg-dark-800 border border-yellow-600 p-4 rounded shadow-sm">
          <div className="flex items-center gap-2 text-yellow-500 font-semibold mb-2">
            <AlertTriangle className="w-5 h-5" /> High RAM Alerts (Last 5 hours)
          </div>
          {alerts.length > 0 ? (
            <ul className="text-yellow-300 space-y-2 text-sm">
              {alerts.map(alert => (
                <li key={alert.id} className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span><strong>{alert.hostname}</strong> - {alert.alert_types.join(', ')} at {dayjs(alert.create_time).format('HH:mm')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-green-400 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" /> All good. No alerts.
            </div>
          )}
        </div>
      )}

      {tab === 'list' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {representativeServers.map(s => (
            <div key={s.hostname} onClick={() => handleSelectServer(s)} className="bg-dark-700 p-4 rounded border border-dark-500 hover:ring ring-primary-500 cursor-pointer">
              <p className="text-white font-bold mb-1">{s.hostname}</p>
              <p className="text-xs text-dark-400 mb-2 flex items-center gap-1">
                <TimerReset size={14} /> {formatUptime(s.uptime_seconds ?? 0)}
              </p>
              <Bar label="CPU" value={parseFloat(s.cpu_usage_percent)} icon={<Cpu size={18} className='text-blue-600' />} />
              <Bar label="RAM" value={parseFloat(s.memory_usage_percent)} icon={<MemoryStick size={18} />} />
              <Bar label="Disk" value={parseFloat(s.disk_usage_percent ?? '0')} icon={<HardDrive size={18} />} />
            </div>
          ))}
        </div>
      )}

      {tab === 'detail' && selectedServer && metrics.length > 0 && (
        <>
          <button onClick={() => setTab('list')} className="btn btn-outline mb-4">
            ← Back to List
          </button>

          <ServerDetailDashboard

            hostname={selectedServer.hostname}
            cpu={parseFloat(selectedServer.cpu_usage_percent)}
            memory={parseFloat(selectedServer.memory_usage_percent)}
            disk={parseFloat(selectedServer.disk_usage_percent ?? '0')}
            uptime={selectedServer.uptime_seconds ?? 0}
            loadAvg={selectedServer.load_average ?? [0, 0, 0]}
            memoryUsed={parseInt(selectedServer.memory_used_bytes ?? '0')}
            memoryTotal={parseInt(selectedServer.memory_total_bytes ?? '0')}
            diskUsed={parseInt(selectedServer.disk_used_bytes ?? '0')}
            diskTotal={parseInt(selectedServer.disk_total_bytes ?? '0')}
            ip={selectedServer.network_interfaces?.[0]?.ip ?? '-'}
            mac={selectedServer.network_interfaces?.[0]?.mac ?? '-'}
            cpuModel={selectedServer.cpu_model ?? '-'}
            cpuCores={selectedServer.cpu_cores ?? 0}
            metrics={metrics}
          />
        </>
      )}
    </div>
  );
}

const Bar = ({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) => {
  let color = 'bg-green-500';
  if (value > 80) color = 'bg-red-500';
  else if (value >= 60) color = 'bg-yellow-400';

  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-white mb-1">
        <div className="flex gap-1 items-center">{icon}<span>{label}</span></div>
        <span>{value.toFixed(2)}%</span>
      </div>
      <div className="w-full h-2 bg-dark-400 rounded">
        <div className={`h-2 rounded ${color}`} style={{ width: `${value}%` }}></div>
      </div>
    </div>
  );
};