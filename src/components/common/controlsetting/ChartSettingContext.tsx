// ChartSettingsContext.tsx
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ChartSettings = {
  showQuickOrder: boolean;
  showPendingOrders: boolean;
  showPositionTag: boolean; // 👈 Vị thế (Floating)
  showOrderHistory: boolean;
  showBreakEven: boolean;
  showLiquidation: boolean;
  showAlerts: boolean;
  showPriceLine: boolean;
  showScale: boolean;
};

const DEFAULT: ChartSettings = {
  showQuickOrder: false,
  showPendingOrders: false,
  showPositionTag: true, // bật sẵn
  showOrderHistory: false,
  showBreakEven: false,
  showLiquidation: false,
  showAlerts: false,
  showPriceLine: false,
  showScale: false,
};

type Ctx = {
  settings: ChartSettings;
  setSetting: (k: keyof ChartSettings, v: boolean) => void;
};

const Ctx = createContext<Ctx | null>(null);

export const ChartSettingsProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [settings, setSettings] = useState<ChartSettings>(() => {
    try {
      const saved = localStorage.getItem('chartSettings');
      return saved ? { ...DEFAULT, ...JSON.parse(saved) } : DEFAULT;
    } catch {
      return DEFAULT;
    }
  });

  const setSetting = useCallback((k: keyof ChartSettings, v: boolean) => {
    setSettings(prev => {
      const next = { ...prev, [k]: v };
      localStorage.setItem('chartSettings', JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, setSetting }), [settings, setSetting]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useChartSettings = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useChartSettings must be used within ChartSettingsProvider');
  return ctx;
};
