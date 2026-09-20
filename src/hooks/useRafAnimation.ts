import { useEffect, useRef } from 'react';

/**
 * requestAnimationFrame 驱动的进度动画。
 * 进度只写进 ref（progressRef.current），每一帧通过 onFrame 回调暴露，
 * 组件在回调里直接操作 DOM ref —— 全程不经过 React state。
 */
export function useRafAnimation(
  duration: number,
  onFrame: (progress: number) => void,
  deps: readonly unknown[],
) {
  const progressRef = useRef(0);
  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;
  const rafRef = useRef(0);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced || duration <= 0) {
      progressRef.current = 1;
      frameRef.current(1);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      progressRef.current = eased;
      frameRef.current(eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return progressRef;
}
