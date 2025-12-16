

import React from 'react';
import ReactApexChart from 'react-apexcharts';
import { Cpu, MemoryStick, HardDrive, TimerReset, Info, Network, Gauge } from 'lucide-react';
import dayjs from 'dayjs';

interface MetricPoint {
  time: string;
  cpu: string;
  memory: string;
  disk?: string;
  load1?: string;
  
}

interface ServerDetailProps {
  hostname: string;
  cpu: number;
  memory: number;
  disk: number;
  uptime: number;
  loadAvg: number[];
  memoryUsed: number;
  memoryTotal: number;
  diskUsed: number;
  diskTotal: number;
  ip: string;
  mac: string;
  cpuModel: string;
  cpuCores: number;
  metrics: MetricPoint[];
}

const GaugeCard = ({ label, value, unit = '%', color }: { label: string; value: number; unit?: string; color: string }) => {
  return (
    <div className="bg-dark-800 p-fluid-4 rounded shadow border border-dark-600 w-full">
      <p className="text-white mb-2 font-semibold">{label}</p>
      <ReactApexChart
        type="radialBar"
        height={220}
        series={[value]}
        options={{
          chart: { sparkline: { enabled: true } },
          plotOptions: {
            radialBar: {
              hollow: { size: '60%' },
              dataLabels: {
                name: { show: false },
                value: {
                  fontSize: '22px',
                  color: '#fff',
                  formatter: (val: any) => `${parseFloat(val).toFixed(1)}${unit}`,
                },
              },
            },
          },
          colors: [color],
          labels: [label],
        }}
      />
    </div>
  );
};

const StatCard = ({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) => (
  <div className="bg-dark-800 p-fluid-4 rounded border border-dark-600 flex items-center gap-fluid-3 w-full">
    <div className="text-primary-500">{icon}</div>
    <div>
      <p className="text-white text-fluid-sm">{title}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  </div>
);

const TimeChart = ({ title, data }: { title: string; data: { time: string; value: number }[] }) => (
  <div className="bg-dark-800 p-fluid-4 rounded border border-dark-600">
    <p className="text-white font-semibold mb-2">{title}</p>
    <ReactApexChart
      type="area"
      height={230}
      options={{
        chart: { id: title, toolbar: { show: false } },
        theme: { mode: 'dark' },
        xaxis: {
  categories: data.map(d => d.time),
  labels: {
    formatter: val => dayjs(val).format('HH:mm'),
    rotate: -45,               // 👈 Xoay nhãn để không đè nhau
    style: {
      fontSize: '10px',
      colors: '#ccc'
    }
  },
  tickAmount: 6               // 👈 Giới hạn số lượng mốc
},
        stroke: { curve: 'smooth' },
        fill: {
          type: 'gradient',
          gradient: {
            shade: 'dark',
            gradientToColors: ['#00C9A7'],
            shadeIntensity: 1,
            type: 'horizontal',
            opacityFrom: 0.6,
            opacityTo: 0.1,
          },
        },
        tooltip: {
          theme: 'dark',
          x: { format: 'HH:mm' },
          style: {
            fontSize: '13px',
            fontFamily: 'inherit',
            
          },
        },
        dataLabels: { enabled: false },
        colors: ['#2C7BE5'],
      }}
      series={[{ name: title, data: data.map(d => d.value) }]}
    />
  </div>
);


const formatUptime = (seconds: number) => {
  const d = Math.floor(seconds / 86400); // 3600 * 24
  const h = Math.floor((seconds % 86400) / 3600);
  return `${d}d ${h}h`;
};

export default function ServerDetailDashboard({
  hostname,
  cpu,
  memory,
  disk,
  uptime,
  loadAvg,
  memoryUsed,
  memoryTotal,
  diskUsed,
  diskTotal,
  ip,
  mac,
  cpuModel,
  cpuCores,
  metrics,
}: ServerDetailProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Server: {hostname}</h2>

      {/* Gauge Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-fluid-4">
        <GaugeCard label="CPU Usage" value={cpu} color="#00C9A7" />
        <GaugeCard label="RAM Usage" value={memory} color="#F6C343" />
        <GaugeCard label="Disk Usage" value={disk} color="#E63757" />
        <GaugeCard label="Load Avg (1m)" value={loadAvg[0]} unit="" color="#2C7BE5" />
      </div>

      {/* Stat Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-fluid-4">
        <StatCard icon={<TimerReset />} title="Uptime" value={formatUptime(uptime)} />

        <StatCard icon={<MemoryStick />} title="Memory Used" value={`${(memoryUsed / 1024 / 1024).toFixed(0)} / ${(memoryTotal / 1024 / 1024).toFixed(0)} MB`} />
        <StatCard icon={<HardDrive />} title="Disk Used" value={`${(diskUsed / 1024 / 1024 / 1024).toFixed(1)} / ${(diskTotal / 1024 / 1024 / 1024).toFixed(1)} GB`} />
        <StatCard icon={<Network />} title="IP Address" value={ip} />
        <StatCard icon={<Info />} title="CPU Model" value={`${cpuModel} (${cpuCores} cores)`} />
        <StatCard icon={<Gauge />} title="Load Avg (5m/15m)" value={`${loadAvg[1]} / ${loadAvg[2]}`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <TimeChart title="CPU Usage (%)" data={metrics.map(m => ({ time: m.time, value: parseFloat(m.cpu) }))} />
  <TimeChart title="RAM Usage (%)" data={metrics.map(m => ({ time: m.time, value: parseFloat(m.memory) }))} />
 {/* <TimeChart title="Disk Usage (%)" data={metrics.map(m => ({ time: m.time, value: parseFloat(m.disk ?? '0') }))} />
  <TimeChart title="Load Avg (1m)" data={metrics.map(m => ({ time: m.time, value: parseFloat(m.load1 ?? '0') }))} /> */}
</div>
    </div>
  );
}
