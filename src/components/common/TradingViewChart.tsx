import { useRef, useState } from 'react';
import MainChart from '../layoutchart/MainChart';
import VolumeChart from '../layoutchart/VolumeChart';
import { ExtendedCandle } from '../../utils/types';
import { IChartApi, TimeRange } from 'lightweight-charts';

interface Props {
  data: ExtendedCandle[];
}

export default function TradingViewChart({ data }: Props) {
  const mainChartRef = useRef<IChartApi | null>(null);
  const [mainInstance, setMainInstance] = useState<IChartApi | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange | null>(null);

  return (
    <div className="h-full w-full grid grid-rows-[75%_25%] gap-px">
      <MainChart
        ref={mainChartRef}
        data={data}
        onChartReady={(chart) => setMainInstance(chart)}
        onTimeRangeChange={setTimeRange}
      />
      {mainInstance && (
        <VolumeChart data={data} syncChart={mainInstance} syncRange={timeRange} />
      )}
    </div>
  );
}
