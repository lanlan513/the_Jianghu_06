import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Swords,
  Table2,
  Radar,
  BarChart3,
  X,
  Link2,
  Check,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { swordApi } from '@/api';
import type { Sword } from '@/types';
import {
  analyzeCompare,
  canonicalizeIds,
  COMPARE_SORTS,
  COMPARE_VIEWS,
  MAX_COMPARE,
  MIN_COMPARE,
  parseCompareParams,
  rankLabel,
  scoreOf,
  serializeCompareParams,
  sortEntries,
  type CompareSort,
  type CompareView,
} from '@/lib/compare';
import type { CompareCardData } from '@/lib/compareCard';
import { ENTRY_COLORS } from '@/lib/compare';
import CompareTable from '@/components/compare/CompareTable';
import CompareRadar from '@/components/compare/CompareRadar';
import CompareBars from '@/components/compare/CompareBars';
import CompareCardPreview from '@/components/compare/CompareCardPreview';
import { cn } from '@/lib/utils';

const VIEW_ICONS: Record<CompareView, typeof Table2> = {
  table: Table2,
  radar: Radar,
  bar: BarChart3,
};

export default function SwordCompare() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [swords, setSwords] = useState<Sword[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef(0);

  useEffect(() => {
    let cancelled = false;
    swordApi
      .getSwords({ page: 1, limit: 100, sortBy: 'popularity', sortOrder: 'desc' })
      .then((res) => {
        if (!cancelled) setSwords(res.list);
      })
      .catch((err) => console.error('Failed to fetch swords:', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2600);
  }, []);

  // 数据未就绪时 validIds 为 null，只做格式校验，避免误清 URL
  const validIds = useMemo(
    () => (swords.length > 0 ? new Set(swords.map((s) => s.id)) : null),
    [swords],
  );

  // 选中集合、排序、视图类型全部由 URL 承载，这里只做派生，不复制成状态
  const parsed = useMemo(
    () => parseCompareParams(location.search, validIds),
    [location.search, validIds],
  );

  // 规范化重定向：同一组选择只对应唯一链接形态，重复 / 非法编号被剔除
  useEffect(() => {
    if (!validIds) return;
    if (location.search !== parsed.canonical) {
      const rawCount = (searchParams.get('ids') ?? '').split(',').filter((s) => s.trim() !== '').length;
      if (rawCount > MAX_COMPARE) {
        showNotice(`最多同时对比 ${MAX_COMPARE} 把名剑，已截断`);
      } else if (rawCount !== parsed.ids.length) {
        showNotice('已自动剔除重复或无效的名剑编号');
      }
      navigate(`${location.pathname}${parsed.canonical}`, { replace: true });
    }
  }, [validIds, location.search, location.pathname, parsed, navigate, searchParams, showNotice]);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const pushParams = useCallback(
    (ids: string[], sort: CompareSort, view: CompareView) => {
      const search = serializeCompareParams(canonicalizeIds(ids, validIds), sort, view);
      navigate(`${location.pathname}${search}`);
    },
    [navigate, location.pathname, validIds],
  );

  const toggleSword = useCallback(
    (id: string) => {
      if (parsed.ids.includes(id)) {
        pushParams(parsed.ids.filter((x) => x !== id), parsed.sort, parsed.view);
      } else if (parsed.ids.length >= MAX_COMPARE) {
        showNotice(`最多同时对比 ${MAX_COMPARE} 把名剑，请先移除一把`);
      } else {
        pushParams([...parsed.ids, id], parsed.sort, parsed.view);
      }
    },
    [parsed, pushParams, showNotice],
  );

  const entries = useMemo(() => {
    const byId = new Map(swords.map((s) => [s.id, s]));
    const selected = parsed.ids
      .map((id) => byId.get(id))
      .filter((s): s is Sword => Boolean(s))
      .map((sword) => ({ sword, score: scoreOf(sword) }));
    return sortEntries(selected, parsed.sort);
  }, [parsed.ids, parsed.sort, swords]);

  const analysis = useMemo(() => analyzeCompare(entries), [entries]);
  const ready = entries.length >= MIN_COMPARE;

  const cardData: CompareCardData | null = useMemo(() => {
    if (!ready) return null;
    return {
      generatedAt: new Date(),
      swords: entries.map((entry, idx) => {
        const id = entry.sword.id;
        return {
          name: entry.sword.name,
          alias: entry.sword.alias,
          dynasty: entry.sword.dynasty,
          dims: analysis.dimensions.map((d) => ({
            label: d.label,
            value: entry.sword.attributes[d.key],
          })),
          score: entry.score,
          rankLabel: rankLabel(analysis.ranks.get(id) ?? 0),
          wins: analysis.wins.get(id) ?? 0,
          isTop: analysis.topIds.has(id) && !analysis.score.allTied,
          color: ENTRY_COLORS[idx % ENTRY_COLORS.length],
        };
      }),
    };
  }, [ready, entries, analysis]);

  // 复制链接：剪贴板不可用时逐级降级
  const copyLink = useCallback(async () => {
    const url = window.location.href;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(url);
      showNotice('对比链接已复制');
      return;
    } catch {
      // 继续降级
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      textarea.remove();
      if (!ok) throw new Error('execCommand failed');
      showNotice('对比链接已复制');
    } catch {
      showNotice('复制失败，请手动复制地址栏链接');
    }
  }, [showNotice]);

  return (
    <div className="min-h-screen pt-20 pb-12">
      <div className="container mx-auto px-4">
        {/* 页头 */}
        <div className="flex items-center gap-3 mb-2 mt-6">
          <Swords className="w-8 h-8 text-cinnabar-600" />
          <h1 className="font-brush text-5xl text-ink-900">论剑台</h1>
        </div>
        <p className="font-song text-ink-600 mb-8 ml-11">
          选 {MIN_COMPARE} 至 {MAX_COMPARE} 把名剑同场相较，高下立判。
        </p>

        {/* 选剑区 */}
        <section className="ink-card p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-brush text-2xl text-ink-900">
              选择名剑
              <span className="ml-3 text-base font-song text-ink-500">
                已选 {parsed.ids.length} / {MAX_COMPARE}
              </span>
            </h2>
            {parsed.ids.length > 0 && (
              <button
                onClick={() => pushParams([], parsed.sort, parsed.view)}
                className="text-sm text-cinnabar-600 font-song hover:text-cinnabar-700 transition-colors flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                清空
              </button>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-16 bg-ink-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {swords.map((sword) => {
                const selected = parsed.ids.includes(sword.id);
                const full = !selected && parsed.ids.length >= MAX_COMPARE;
                return (
                  <button
                    key={sword.id}
                    onClick={() => toggleSword(sword.id)}
                    aria-pressed={selected}
                    className={cn(
                      'relative flex items-center gap-3 p-3 border-2 text-left transition-all font-song',
                      selected
                        ? 'border-cinnabar-600 bg-cinnabar-50 shadow-brush'
                        : full
                          ? 'border-ink-200 bg-ink-50 opacity-50 cursor-not-allowed'
                          : 'border-ink-200 bg-ink-50 hover:border-ink-400',
                    )}
                  >
                    <span
                      className={cn(
                        'flex-shrink-0 w-6 h-6 border-2 flex items-center justify-center transition-colors',
                        selected ? 'border-cinnabar-600 bg-cinnabar-600' : 'border-ink-300',
                      )}
                    >
                      {selected ? (
                        <Check className="w-4 h-4 text-ink-100" />
                      ) : (
                        <Plus className="w-4 h-4 text-ink-400" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-brush text-lg text-ink-900 truncate">
                        {sword.name}
                      </span>
                      <span className="block text-xs text-ink-500 truncate">
                        {sword.alias} · {scoreOf(sword).toFixed(1)} 分
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {notice && (
            <p className="mt-4 flex items-center gap-2 font-song text-sm text-cinnabar-600 animate-fade-in-up">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {notice}
            </p>
          )}
        </section>

        {/* 数量不足提示 */}
        {!ready && !loading && (
          <div className="ink-card p-12 text-center mb-8">
            <Swords className="w-14 h-14 text-ink-300 mx-auto mb-4" />
            <h3 className="font-brush text-2xl text-ink-600 mb-2">
              {entries.length === 1 ? '只选了一把，无法论剑' : '尚未开擂'}
            </h3>
            <p className="font-song text-ink-500">
              请至少选择 {MIN_COMPARE} 把名剑，最多 {MAX_COMPARE} 把。
            </p>
          </div>
        )}

        {ready && (
          <>
            {/* 排名总览 */}
            <section className="ink-card p-6 mb-8">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                <h2 className="font-brush text-2xl text-ink-900">综合排名</h2>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-2 px-4 py-2 bg-ink-50 border-2 border-ink-200 hover:border-ink-400 font-song text-sm transition-colors"
                >
                  <Link2 className="w-4 h-4" />
                  复制对比链接
                </button>
              </div>
              <ol className="space-y-3">
                {[...entries]
                  .sort((a, b) => (analysis.ranks.get(a.sword.id) ?? 0) - (analysis.ranks.get(b.sword.id) ?? 0))
                  .map((entry) => {
                    const id = entry.sword.id;
                    const rank = analysis.ranks.get(id) ?? 0;
                    const isTop = analysis.topIds.has(id) && !analysis.score.allTied;
                    return (
                      <li key={id} className="flex items-center gap-4">
                        <span
                          className={cn(
                            'w-16 text-center px-2 py-1 font-song text-sm flex-shrink-0',
                            isTop ? 'bg-gold-400 text-ink-900 animate-gold-pulse' : 'bg-ink-200 text-ink-600',
                          )}
                        >
                          {rankLabel(rank)}
                        </span>
                        <span className="font-brush text-xl text-ink-900 w-24 truncate">
                          {entry.sword.name}
                        </span>
                        <span className="flex-1 h-3 bg-ink-200/70 overflow-hidden hidden sm:block">
                          <span
                            className="block h-full bar-grow bg-gradient-to-r from-gold-400 to-gold-600"
                            style={{ width: `${entry.score}%` }}
                          />
                        </span>
                        <span className="font-song text-sm text-ink-600 w-28 text-right flex-shrink-0">
                          {entry.score.toFixed(1)} 分 · 胜 {analysis.wins.get(id) ?? 0} 维
                        </span>
                      </li>
                    );
                  })}
              </ol>
            </section>

            {/* 排序与视图切换 */}
            <section className="ink-card p-6 mb-8">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-song text-sm text-ink-500 mr-1">排序</span>
                  {COMPARE_SORTS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => pushParams(parsed.ids, option.value, parsed.view)}
                      className={cn(
                        'px-3 py-1.5 text-sm font-song transition-all',
                        parsed.sort === option.value
                          ? 'bg-cinnabar-600 text-ink-100'
                          : 'bg-ink-100 text-ink-700 hover:bg-ink-200',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {COMPARE_VIEWS.map((option) => {
                    const Icon = VIEW_ICONS[option.value];
                    return (
                      <button
                        key={option.value}
                        onClick={() => pushParams(parsed.ids, parsed.sort, option.value)}
                        className={cn(
                          'flex items-center gap-1.5 px-4 py-2 text-sm font-song border-2 transition-all',
                          parsed.view === option.value
                            ? 'bg-ink-800 text-ink-100 border-ink-800'
                            : 'bg-ink-50 text-ink-700 border-ink-200 hover:border-ink-400',
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 视图区：切换时水墨过渡 */}
              <div className="relative overflow-hidden">
                <div key={parsed.view} className="animate-ink-spread">
                  {parsed.view === 'table' && <CompareTable entries={entries} analysis={analysis} />}
                  {parsed.view === 'radar' && <CompareRadar entries={entries} analysis={analysis} />}
                  {parsed.view === 'bar' && <CompareBars entries={entries} analysis={analysis} />}
                </div>
                <div
                  key={`veil-${parsed.view}`}
                  className="ink-veil"
                  aria-hidden="true"
                />
              </div>
            </section>

            {/* 实时预览画布 */}
            {cardData && (
              <section className="ink-card p-6">
                <h2 className="font-brush text-2xl text-ink-900 mb-1">对比卡</h2>
                <p className="font-song text-sm text-ink-500 mb-5">
                  所见即所导出，点击画布即可下载。
                </p>
                <CompareCardPreview data={cardData} />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
