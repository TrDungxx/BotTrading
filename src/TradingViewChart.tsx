import { useRef, useState } from 'react';
import MainChart from './components/common/MainChart';
import { ExtendedCandle } from './utils/types';
import { IChartApi } from 'lightweight-charts';

interface Props {
  data: ExtendedCandle[];
}

export default function TradingViewChart({ data }: Props) {
  const mainChartRef = useRef<IChartApi | null>(null);
  const [mainInstance, setMainInstance] = useState<IChartApi | null>(null);

 

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[600px] text-dark-400">
        Đang tải dữ liệu nến...
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <div className="relative w-full h-[600px] rounded overflow-hidden border border-dark-800 bg-dark-900">
        <MainChart
          ref={mainChartRef}
          data={data}
          onChartReady={(chart) => setMainInstance(chart)}
        />
      </div>
    </div>
  );
}
