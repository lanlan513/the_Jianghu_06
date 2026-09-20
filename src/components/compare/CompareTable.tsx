import type { CompareAnalysis, CompareEntry } from '@/lib/compare';
import { rankLabel } from '@/lib/compare';
import { cn } from '@/lib/utils';

interface CompareTableProps {
  entries: CompareEntry[];
  analysis: CompareAnalysis;
}

/**
 * 表格视图：每行标出最优（金色脉冲）与最差（淡墨），
 * 全部并列时整行单独标记「并列」。
 */
export default function CompareTable({ entries, analysis }: CompareTableProps) {
  return (
    <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
      <table className="w-full min-w-[640px] border-collapse font-song">
        <thead>
          <tr>
            <th className="p-3 text-left text-sm text-ink-500 font-normal border-b-2 border-ink-300 w-28">
              维度
            </th>
            {entries.map((entry) => {
              const id = entry.sword.id;
              const rank = analysis.ranks.get(id) ?? 0;
              const isTop = analysis.topIds.has(id) && !analysis.score.allTied;
              return (
                <th key={id} className="p-3 border-b-2 border-ink-300 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5',
                        isTop ? 'bg-gold-400 text-ink-900 animate-gold-pulse' : 'bg-ink-200 text-ink-600',
                      )}
                    >
                      {rankLabel(rank)}
                    </span>
                    <span className="font-brush text-2xl text-ink-900">{entry.sword.name}</span>
                    <span className="text-xs text-cinnabar-600">{entry.sword.alias}</span>
                    <span className="text-xs text-ink-500">
                      胜出 {analysis.wins.get(id) ?? 0} 维
                    </span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {analysis.dimensions.map((dim) => (
            <tr key={dim.key} className="border-b border-ink-200">
              <td className="p-3 text-sm text-ink-700">
                <span className="flex items-center gap-2">
                  {dim.label}
                  {dim.allTied && (
                    <span className="text-xs px-1.5 py-0.5 border border-ink-400 text-ink-500">
                      并列
                    </span>
                  )}
                </span>
              </td>
              {entries.map((entry) => {
                const id = entry.sword.id;
                const value = entry.sword.attributes[dim.key];
                const isBest = !dim.allTied && dim.bestIds.has(id);
                const isWorst = !dim.allTied && dim.worstIds.has(id);
                return (
                  <td
                    key={id}
                    className={cn(
                      'p-3 text-center transition-colors',
                      isBest && 'bg-gold-50 animate-gold-pulse',
                      isWorst && 'opacity-60',
                    )}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={cn(
                          'text-lg font-bold',
                          isBest ? 'text-gold-600' : isWorst ? 'text-ink-400' : 'text-ink-800',
                        )}
                      >
                        {value}
                      </span>
                      <span className="sword-attribute-bar w-24 max-w-full">
                        <span
                          className="sword-attribute-bar-fill block"
                          style={{ width: `${value}%` }}
                        />
                      </span>
                      {isBest && <span className="text-xs text-gold-600">最优</span>}
                      {isWorst && <span className="text-xs text-ink-400">最弱</span>}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="bg-ink-50">
            <td className="p-3 text-sm font-bold text-ink-800">
              <span className="flex items-center gap-2">
                综合评分
                {analysis.score.allTied && (
                  <span className="text-xs px-1.5 py-0.5 border border-ink-400 text-ink-500 font-normal">
                    并列
                  </span>
                )}
              </span>
            </td>
            {entries.map((entry) => {
              const id = entry.sword.id;
              const isBest = !analysis.score.allTied && analysis.score.bestIds.has(id);
              const isWorst = !analysis.score.allTied && analysis.score.worstIds.has(id);
              return (
                <td
                  key={id}
                  className={cn(
                    'p-3 text-center',
                    isBest && 'bg-gold-100 animate-gold-pulse',
                    isWorst && 'opacity-60',
                  )}
                >
                  <span
                    className={cn(
                      'font-brush text-3xl',
                      isBest ? 'text-gold-600' : isWorst ? 'text-ink-400' : 'text-ink-900',
                    )}
                  >
                    {entry.score.toFixed(1)}
                  </span>
                  {isBest && <span className="block text-xs text-gold-600 mt-1">最优</span>}
                  {isWorst && <span className="block text-xs text-ink-400 mt-1">最弱</span>}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
