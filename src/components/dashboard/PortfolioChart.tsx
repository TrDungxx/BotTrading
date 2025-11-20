import { useEffect, useState } from 'react';
import ReactApexChart from 'react-apexcharts';
import { ArrowDown, ArrowUp } from 'lucide-react';

type TimeRange = '1d' | '7d' | '30d' | '90d';

interface PortfolioChartProps {
  timeRange: TimeRange;
}

// Mock data generator
const generateChartData = (days: number) => {
  const data = [];
  const date = new Date();
  date.setDate(date.getDate() - days);
  
  let value = 12000 + Math.random() * 1000;
  
  for (let i = 0; i < days; i++) {
    date.setDate(date.getDate() + 1);
    
    // Add some randomness to the value
    const change = (Math.random() - 0.4) * 200;
    value += change;
    
    data.push({
      x: new Date(date),
      y: value.toFixed(2),
    });
  }
  
  return data;
};

export default function PortfolioChart({ timeRange }: PortfolioChartProps) {
  const [series, setSeries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(true);
    
    // Get the number of days based on the time range
    const days = timeRange === '1d' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    
    // Simulate API call delay
    setTimeout(() => {
      setSeries([
        {
          name: 'Portfolio Value',
          data: generateChartData(days),
        },
      ]);
      setIsLoading(false);
    }, 500);
  }, [timeRange]);
  
  // Calculate change values
  const firstValue = series[0]?.data[0]?.y || 0;
  const lastValue = series[0]?.data[series[0]?.data?.length - 1]?.y || 0;
  const change = lastValue - firstValue;
  const changePercent = firstValue > 0 ? (change / firstValue) * 100 : 0;
  const isPositive = change >= 0;
  
  const options = {
    chart: {
      type: 'area',
      height: 300,
      toolbar: {
        show: false,
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
      },
      background: 'transparent',
    },
    colors: ['#2C7BE5'],
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.1,
        stops: [0, 100],
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: 'smooth',
      width: 2,
    },
    grid: {
      borderColor: '#1e293b',
      strokeDashArray: 4,
      yaxis: {
        lines: {
          show: true,
        },
      },
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 10,
      },
    },
    xaxis: {
      type: 'datetime',
      labels: {
        style: {
          colors: '#64748b',
        },
        datetimeFormatter: {
          year: 'yyyy',
          month: "MMM 'yy",
          day: 'dd MMM',
          hour: 'HH:mm',
        },
      },
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: '#64748b',
        },
        formatter: (value: number) => {
          return `$${value.toFixed(0)}`;
        },
      },
    },
    tooltip: {
      x: {
        format: 'dd MMM yyyy',
      },
      y: {
        formatter: (value: number) => {
          return `$${value.toFixed(2)}`;
        },
      },
      theme: 'dark',
    },
  };
  
  if (isLoading) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }
  
  return (
    <div>
      <div className="flex items-end justify-between mb-4">
        <div>
          <span className="text-xl sm:text-2xl font-semibold">${lastValue.toLocaleString()}</span>
          <div className="flex items-center mt-1">
            <span
              className={`flex items-center text-sm font-medium ${
                isPositive ? 'text-success-500' : 'text-danger-500'
              }`}
            >
              {isPositive ? <ArrowUp className="mr-1 h-4 w-4" /> : <ArrowDown className="mr-1 h-4 w-4" />}
              ${Math.abs(change).toFixed(2)} ({Math.abs(changePercent).toFixed(2)}%)
            </span>
            <span className="ml-1.5 text-xs text-dark-400">last {timeRange}</span>
          </div>
        </div>
      </div>
      
      <div className="h-[300px]">
        {typeof window !== 'undefined' && (
          <ReactApexChart
            options={options}
            series={series}
            type="area"
            height={300}
          />
        )}
      </div>
    </div>
  );
}