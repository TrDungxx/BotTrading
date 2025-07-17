import { useRef, useState } from 'react';
import MainChart from './components/common/MainChart';
import VolumeChart from './components/common/VolumeChart';
import { ExtendedCandle } from './utils/types';
import { IChartApi } from 'lightweight-charts';

interface Props {
  data: ExtendedCandle[];
}

export default function TradingViewChart({ data }: Props) {
  const mainChartRef = useRef<IChartApi | null>(null);
  const [mainInstance, setMainInstance] = useState<IChartApi | null>(null);

  return (
    <div className="h-full w-full grid grid-rows-[75%_25%] gap-px">
      <MainChart
        ref={mainChartRef}
        data={data}
        onChartReady={(chart) => setMainInstance(chart)}
      />
      {mainInstance && <VolumeChart data={data} syncChart={mainInstance} />}
    </div>
  );
}
