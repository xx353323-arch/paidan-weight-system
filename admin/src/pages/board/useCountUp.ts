import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function useCountUp(target: number, duration = 900, delay = 0) {
  const [value, setValue] = useState(prefersReducedMotion() ? target : 0);
  const frameRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const run = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setValue(target * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(run);
      }
    };
    timerRef.current = setTimeout(() => {
      frameRef.current = requestAnimationFrame(run);
    }, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration, delay]);

  return value;
}
