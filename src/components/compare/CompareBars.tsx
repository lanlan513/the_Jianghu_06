import { useRef } from 'react';
import type { Sword } from '../../types';
import { cn } from '@/lib/utils';
import { DIMENSIONS, SWORD_INKS, type CompareStats } from '@/lib/compare';
import { useRafAnimation } from '@/hooks/useRafAnimation';

interface CompareBarsProps {
  swords: Sword[];
  stats: CompareStats;
  /** 变化时重播生长动画 */
  animKey: string;
}

/**
 * 条形图：每根条自零生长（rAF → ref 写宽度与数值），
 * 每维最优条为金色并带脉冲光晕，最差条为淡墨。
 */
export default function CompareBars({ swords, stats, animKey }: CompareBarsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useRafAnimation(
    800,
    (p) => {
      containerRef.current
        ?.querySelectorAll<HTMLElement>('[data-bar-fill]')
        .forEach((el) => {
          const v = Number(el.dataset.value || 0);
          el.style.width = `${v * p}%`;
        });
      containerRef.current
        ?.querySelectorAll<HTMLElement>('[data-bar-value]')
        .forEach((el) => {
          const v = Number(el.dataset.value || 0);
          el.textContent = String(Math.round(v * p));
        });
    },
    [animKey],
  );

  return (
    <div ref={containerRef} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {DIMENSIONS.map((dim) => {
        const ds = stats.dimStats[dim.key];
        return (
          <div key={dim.key} className="ink-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-brush text-xl text-ink-900">{dim.label}</h4>
              {ds.allTied ? (
                <span className="px-2 py-0.5 text-xs bg-ink-200 text-ink-600 font-song">全员并列</span>
              ) : (
                <span className="text-xs text-gold-600 font-song">最优 {ds.max}</span>
              )}
            </div>

            <div className="space-y-3">
              {swords.map((s, i) => {
                const v = s.attributes[dim.key];
                const isBest = !ds.allTied && ds.bestIds.has(s.id);
                const isWorst = !ds.allTied && ds.worstIds.has(s.id);
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 font-song text-sm text-ink-700 truncate">
                      {s.name}
                    </span>
                    <div className="flex-1 h-5 bg-ink-200/50 relative overflow-hidden">
                      <div
                        data-bar-fill
                        data-value={v}
                        className={cn(
                          'h-full',
                          isBest
                            ? 'gold-glow bg-gradient-to-r from-gold-300 to-gold-500'
                            : isWorst
                              ? 'bg-ink-300'
                              : '',
                        )}
                        style={{
                          width: 0,
                          backgroundColor: isBest || isWorst ? undefined : SWORD_INKS[i % SWORD_INKS.length],
                        }}
                      />
                    </div>
                    <span
                      data-bar-value
                      data-value={v}
                      className={cn(
                        'w-8 shrink-0 text-right font-song text-sm',
                        isBest ? 'text-gold-600 font-bold' : isWorst ? 'text-ink-400' : 'text-ink-800',
                      )}
                    >
                      0
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
