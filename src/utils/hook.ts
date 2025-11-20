// src/utils/hooks.ts
import { useEffect, useRef, useState } from "react";

/** Giới hạn tần suất cập nhật (throttle) để tránh giá nhảy "rétttt" */
export function useThrottledValue<T>(value: T, intervalMs = 150) {
  const [throttled, setThrottled] = useState(value);
  const last = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const now = Date.now();
    const remain = intervalMs - (now - last.current);

    if (remain <= 0) {
      last.current = now;
      setThrottled(value);
    } else {
      if (timer.current) clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        last.current = Date.now();
        setThrottled(value);
      }, remain);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, intervalMs]);

  return throttled;
}

/** Làm mượt giá bằng EMA (Exponential Moving Average) */
export function useEMA(value: number, alpha = 0.35) {
  const [ema, setEma] = useState(value);
  const ref = useRef(value);
  useEffect(() => {
    const next = ref.current + alpha * (value - ref.current);
    ref.current = next;
    setEma(next);
  }, [value, alpha]);
  return ema;
}
