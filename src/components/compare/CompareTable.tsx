import { Crown } from 'lucide-react';
import type { Sword } from '../../types';
import { cn } from '@/lib/utils';
import { DIMENSIONS, rankTitle, SWORD_INKS, type CompareStats } from '@/lib/compare';

interface CompareTableProps {
  /** 按当前 sort 参数排列的名剑 */
  swords: Sword[];
  stats: CompareStats;
}

/**
 * 表格视图：每行标出最优（金印·脉冲）与最差（灰印），
 * 全部并列的维度单独标记；移动端可横向滑动。
 */
export default function CompareTable({ swords, stats }: CompareTableProps) {
  return (
    <div className="ink-card overflow-hidden">
      {/* 移动端横向溢出：外层滚动 + 首列吸左 */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse font-song">
          <thead>
            <tr className="border-b-2 border-ink-200">
              <th className="sticky left-0 z-10 bg-ink-50 px-4 py-4 text-left text-sm text-ink-500 font-normal whitespace-nowrap">
                维度 \ 名剑
              </th>
              {swords.map((s, i) => (
                <th key={s.id} className="px-4 py-4 text-center min-w-[120px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ backgroundColor: SWORD_INKS[i % SWORD_INKS.length] }}
                      />
                      <span className="font-brush text-xl text-ink-900 whitespace-nowrap">{s.name}</span>
                    </span>
                    <span className="text-xs text-cinnabar-600">{s.alias}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DIMENSIONS.map((dim) => {
              const ds = stats.dimStats[dim.key];
              return (
                <tr key={dim.key} className="border-b border-ink-200/70">
                  <th className="sticky left-0 z-10 bg-ink-50 px-4 py-3 text-left whitespace-nowrap">
                    <span className="text-ink-700">{dim.label}</span>
                    {ds.allTied && (
                      <span className="ml-2 inline-block px-2 py-0.5 text-xs bg-ink-200 text-ink-600">
                        全员并列
                      </span>
                    )}
                  </th>
                  {swords.map((s) => {
                    const v = s.attributes[dim.key];
                    const isBest = !ds.allTied && ds.bestIds.has(s.id);
                    const isWorst = !ds.allTied && ds.worstIds.has(s.id);
                    return (
                      <td
                        key={s.id}
                        className={cn(
                          'px-4 py-3 text-center',
                          isBest && 'bg-gold-100/70',
                          isWorst && 'bg-ink-100/60',
                        )}
                      >
                        <span
                          className={cn(
                            'text-base',
                            isBest && 'text-gold-700 font-bold',
                            isWorst && 'text-ink-400',
                            !isBest && !isWorst && 'text-ink-800',
                          )}
                        >
                          {v}
                        </span>
                        {isBest && (
                          <span className="gold-pulse ml-2 inline-block px-1.5 py-0.5 text-xs bg-gold-400 text-ink-100 font-brush">
                            优
                          </span>
                        )}
                        {isWorst && (
                          <span className="ml-2 inline-block px-1.5 py-0.5 text-xs bg-ink-300 text-ink-100 font-brush">
                            劣
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* 综合评分 */}
            <tr className="border-b border-ink-200/70 bg-ink-100/40">
              <th className="sticky left-0 z-10 bg-ink-100 px-4 py-3 text-left text-ink-700 whitespace-nowrap">
                综合评分
              </th>
              {swords.map((s) => {
                const rank = stats.ranks[s.id];
                return (
                  <td key={s.id} className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        'font-brush text-2xl',
                        rank === 1 ? 'text-gold-600' : 'text-ink-800',
                      )}
                    >
                      {stats.scores[s.id].toFixed(1)}
                    </span>
                    {rank === 1 && <Crown className="gold-pulse inline-block ml-1.5 w-4 h-4 text-gold-500" />}
                    <div className="text-xs text-ink-500 mt-0.5">{rankTitle(rank)}</div>
                  </td>
                );
              })}
            </tr>

            {/* 胜出维度数 */}
            <tr>
              <th className="sticky left-0 z-10 bg-ink-50 px-4 py-3 text-left text-ink-700 whitespace-nowrap">
                胜出维度
              </th>
              {swords.map((s) => (
                <td key={s.id} className="px-4 py-3 text-center text-ink-800">
                  <span className="font-bold text-cinnabar-600">{stats.wins[s.id]}</span>
                  <span className="text-ink-500 text-sm"> / {DIMENSIONS.length} 维</span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="md:hidden px-4 py-2 text-xs text-ink-400 font-song border-t border-ink-200/60">
        ◂ 左右滑动查看完整表格 ▸
      </p>
    </div>
  );
}
