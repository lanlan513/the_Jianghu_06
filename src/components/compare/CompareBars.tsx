import type { CompareAnalysis, CompareEntry } from '@/lib/compare';
import { ENTRY_COLORS } from '@/lib/compare';
import { cn } from '@/lib/utils';

interface CompareBarsProps {
  entries: CompareEntry[];
  analysis: CompareAnalysis;
}

/**
 * 条形图：每个维度一组横条，从零长出，最优条带金色脉冲。
 */
export default function CompareBars({ entries, analysis }: CompareBarsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
      {analysis.dimensions.map((dim, dimIdx) => (
        <div key={dim.key}>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="font-brush text-xl text-ink-900">{dim.label}</h4>
            {dim.allTied && (
              <span className="text-xs px-1.5 py-0.5 border border-ink-400 text-ink-500 font-song">
                全部并列
              </span>
            )}
          </div>
          <div className="space-y-3">
            {entries.map((entry, idx) => {
              const id = entry.sword.id;
              const value = entry.sword.attributes[dim.key];
              const isBest = !dim.allTied && dim.bestIds.has(id);
              const isWorst = !dim.allTied && dim.worstIds.has(id);
              const color = ENTRY_COLORS[idx % ENTRY_COLORS.length];
              return (
                <div key={id} className={cn(isWorst && 'opacity-60')}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-song text-sm text-ink-700">
                      {entry.sword.name}
                      {isBest && <span className="ml-2 text-xs text-gold-600">最优</span>}
                      {isWorst && <span className="ml-2 text-xs text-ink-400">最弱</span>}
                    </span>
                    <span
                      className={cn(
                        'font-song text-sm font-bold',
                        isBest ? 'text-gold-600' : 'text-ink-800',
                      )}
                    >
                      {value}
                    </span>
                  </div>
                  <div className="h-4 bg-ink-200/70 overflow-hidden">
                    <div
                      className={cn('h-full bar-grow', isBest && 'animate-gold-pulse')}
                      style={{
                        width: `${value}%`,
                        background: isBest
                          ? `linear-gradient(90deg, ${color}, #d4af37)`
                          : color,
                        animationDelay: `${dimIdx * 120 + idx * 90}ms, 0s`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
