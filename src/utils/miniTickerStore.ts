import { create } from 'zustand';

interface MiniTickerData {
  lastPrice: number;
  // thêm các field khác nếu cần
}

interface MiniTickerState {
  miniTickerMap: Record<string, MiniTickerData>;
  setMiniTicker: (symbol: string, data: MiniTickerData) => void;
  setMiniTickerMap: (map: Record<string, MiniTickerData>) => void;
}

export const useMiniTickerStore = create<MiniTickerState>((set) => ({
  miniTickerMap: {},
  setMiniTicker: (symbol, data) =>
    set((state) => ({
      miniTickerMap: {
        ...state.miniTickerMap,
        [symbol]: data,
      },
    })),
  setMiniTickerMap: (map) => set({ miniTickerMap: map }),
}));