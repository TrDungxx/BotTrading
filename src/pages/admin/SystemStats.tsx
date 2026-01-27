import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, BarChart3, Settings, Info, Activity } from 'lucide-react';
import { systemStatApi } from '../../utils/api';

export default function SystemStats() {
  const [stats, setStats] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSection, setSelectedSection] = useState<'main' | 'processor' | 'info' | 'health'>('main');

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, healthRes] = await Promise.all([
        systemStatApi.getSystemStats(),
        systemStatApi.getSystemHealth()
      ]);

      if (statsRes.status === 'success') setStats(statsRes);
      else throw new Error('Unexpected stats API status');

      if (healthRes.status === 'healthy') setHealth(healthRes);
      else throw new Error('Unexpected health API status');

    } catch (err) {
      setError('Failed to load system stats or health');
      console.error('❌ Load stats error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs}h ${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6 px-4 sm:px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">System Statistics</h1>
        <button onClick={fetchStats} className="btn btn-outline" disabled={loading}>
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-danger-500/10 text-danger-500 border border-danger-500/20 p-fluid-4 rounded-fluid-md flex items-center gap-fluid-3">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Selector UI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-fluid-2">
        {/* Main Stats */}
        <div
          className={`card p-fluid-4 cursor-pointer transition ${selectedSection === 'main' ? 'ring-2 ring-primary-500' : ''}`}
          onClick={() => setSelectedSection('main')}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex h-fluid-input-sm w-8 items-center justify-center rounded-fluid-md bg-primary-500/10">
                <BarChart3 className="h-4 w-4 text-primary-500" />
              </div>
            </div>
            <div className="ml-3 min-w-0">
              <p className="text-fluid-sm font-medium text-dark-400">Main Stats</p>
            </div>
          </div>
        </div>

        {/* Processor */}
        <div
          className={`card p-fluid-4 cursor-pointer transition ${selectedSection === 'processor' ? 'ring-2 ring-warning-300' : ''}`}
          onClick={() => setSelectedSection('processor')}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex h-fluid-input-sm w-8 items-center justify-center rounded-fluid-md bg-warning-300/10">
                <Settings className="h-4 w-4 text-warning-300" />
              </div>
            </div>
            <div className="ml-3 min-w-0">
              <p className="text-fluid-sm font-medium text-dark-400">Processor</p>
            </div>
          </div>
        </div>

        {/* System Info */}
        <div
          className={`card p-fluid-4 cursor-pointer transition ${selectedSection === 'info' ? 'ring-2 ring-dark-500' : ''}`}
          onClick={() => setSelectedSection('info')}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex h-fluid-input-sm w-8 items-center justify-center rounded-fluid-md bg-dark-500/10">
                <Info className="h-4 w-4 text-dark-500" />
              </div>
            </div>
            <div className="ml-3 min-w-0">
              <p className="text-fluid-sm font-medium text-dark-400">System Info</p>
            </div>
          </div>
        </div>

        {/* Health */}
        <div
          className={`card p-fluid-4 cursor-pointer transition ${selectedSection === 'health' ? 'ring-2 ring-success-500' : ''}`}
          onClick={() => setSelectedSection('health')}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex h-fluid-input-sm w-8 items-center justify-center rounded-fluid-md bg-success-500/10">
                <Activity className="h-4 w-4 text-success-500" />
              </div>
            </div>
            <div className="ml-3 min-w-0">
              <p className="text-fluid-sm font-medium text-dark-400">Health</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section render */}
      {selectedSection === 'main' && stats && (
        <div className="card p-fluid-4 gap-fluid-2">
          <h2 className="text-lg font-semibold">Main Stats</h2>
          <p>Total Requests: {stats.mainStats.totalRequests}</p>
          <p>Success: {stats.mainStats.successfulRequests} ({stats.mainStats.successRate}%)</p>
          <p>Errors: {stats.mainStats.errors} ({stats.mainStats.errorRate}%)</p>
          <p>Uptime: {formatUptime(stats.mainStats.uptime)}</p>
          <p>RPS: {stats.mainStats.requestsPerSecond}</p>
        </div>
      )}

      {selectedSection === 'processor' && stats?.processorStats?.processing && (
        <div className="card p-fluid-4 gap-fluid-2">
          <h2 className="text-lg font-semibold">Processor Stats</h2>
          <p>Processed: {stats.processorStats.processing.totalProcessed}</p>
          <p>Successful Trades: {stats.processorStats.processing.successfulTrades}</p>
          <p>Failed Trades: {stats.processorStats.processing.failedTrades}</p>
          <p>Success Rate: {stats.processorStats.processing.successRate}</p>
          <p>RPS: {stats.processorStats.processing.requestsPerSecond}</p>
        </div>
      )}

      {selectedSection === 'info' && stats && (
        <div className="card p-fluid-4 gap-fluid-2 text-fluid-sm text-dark-400">
          <h2 className="text-lg font-semibold text-dark-300">System Info</h2>
          <p>Status: <span className="text-success-500 font-semibold">{stats.status}</span></p>
          <p>Timestamp: {new Date(stats.timestamp).toLocaleString()}</p>
        </div>
      )}

      {selectedSection === 'health' && health && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="card p-fluid-4 gap-fluid-2">
            <h2 className="text-lg font-semibold">Health: Processing</h2>
            <p>Status: {health.components.processing.status}</p>
            <p>Success Rate: {health.components.processing.successRate}</p>
            <p>Total Processed: {health.components.processing.totalProcessed}</p>
          </div>

          <div className="card p-fluid-4 gap-fluid-2">
            <h2 className="text-lg font-semibold">Health: Cache</h2>
            <p>Size: {health.components.cache.cache.size}</p>
            <p>Utilization: {health.components.cache.cache.utilizationRate}</p>
            <p>Hit Ratio: {health.components.cache.performance.cacheHitRatio}</p>
            <p>Pending: {health.components.cache.performance.pendingRequests}</p>
            <p>Error Rate: {health.components.cache.validation.errorRate}</p>
          </div>
        </div>
      )}
    </div>
  );
}