import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  Link2,
  Radar,
  Swords,
  Table as TableIcon,
  X,
} from 'lucide-react';
import { swordApi } from '../api';
import type { Sword } from '../types';
import { cn } from '@/lib/utils';
import {
  buildCompareSearch,
  canonicalizeCompare,
  compareSwordIds,
  computeCompareStats,
  MAX_SELECT,
  MIN_SELECT,
  parseCompareParams,
  rankTitle,
  SORT_OPTIONS,
  sortSwords,
  VIEW_OPTIONS,
  type CompareSort,
  type CompareView,
} from '@/lib/compare';
import type { CompareCardData } from '@/lib/compareCard';
import { copyTextToClipboard } from '@/lib/clipboard';
import SwordPicker from '@/components/compare/SwordPicker';
import CompareTable from '@/components/compare/CompareTable';
import CompareRadar from '@/components/compare/CompareRadar';
import CompareBars from '@/components/compare/CompareBars';
import CompareCardPreview from '@/components/compare/CompareCardPreview';

const VIEW_ICONS: Record<CompareView, typeof TableIcon> = {
  table: TableIcon,
  radar: Radar,
  bar: BarChart3,
};

/** 水墨过渡墨团（视图切换时晕开） */
const INK_BLOBS = [
  { left: '14%', top: '20%', size: 190, delay: 0 },
  { left: '56%', top: '10%', size: 230, delay: 70 },
  { left: '82%', top: '48%', size: 200, delay: 120 },
  { left: '30%', top: '64%', size: 250, delay: 40 },
  { left: '48%', top: '38%', size: 170, delay: 160 },
];

function InkWipe() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">
      {INK_BLOBS.map((b, i) => (
        <div
          key={i}
          className="ink-wipe-blob absolute rounded-full"
          style={{
            left: b.left,
            top: b.top,
            width: b.size,
            height: b.size,
            marginLeft: -b.size / 2,
            marginTop: -b.size / 2,
            background:
              'radial-gradient(circle, rgba(26,26,26,0.72) 0%, rgba(45,58,74,0.4) 45%, transparent 70%)',
            animationDelay: `${b.delay}ms`,
          }}
        />
      ))}
    </div>
  );
}

export default function Compare() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [swords, setSwords] = useState<Sword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [manualCopyUrl, setManualCopyUrl] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const fetchSwords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await swordApi.getSwords({ limit: 100 });
      setSwords(res.list);
    } catch (e) {
      console.error('Failed to fetch swords:', e);
      setError('名剑谱调取失败，请检查网络后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSwords();
  }, [fetchSwords]);

  /* ---------------- URL 是唯一状态源：选中集合 / 排序 / 视图 ---------------- */

  const validIds = useMemo(() => new Set(swords.map((s) => s.id)), [swords]);
  const byId = useMemo(() => new Map(swords.map((s) => [s.id, s])), [swords]);

  const parsed = useMemo(() => parseCompareParams(searchParams), [searchParams]);
  const canonical = useMemo(() => canonicalizeCompare(parsed, validIds), [parsed, validIds]);
  const canonicalSearch = useMemo(() => buildCompareSearch(canonical), [canonical]);

  /*
   * 规范化：同一组选择只对应唯一链接形态。
   * 去重、剔除非法编号、编号升序、省略默认参数后，
   * 若当前 URL 与规范形态不一致，则以 replace 重定向（不污染前进后退历史）。
   */
  useEffect(() => {
    if (loading || error) return;
    const current = location.search.replace(/^\?/, '');
    if (current === canonicalSearch) return;

    navigate(canonicalSearch ? `?${canonicalSearch}` : location.pathname, { replace: true });

    const notes: string[] = [];
    if (canonical.droppedInvalid.length > 0) {
      notes.push(`已剔除不存在的名剑编号：${canonical.droppedInvalid.join('、')}`);
    }
    if (canonical.droppedDuplicateCount > 0) {
      notes.push('已去除重复的名剑编号');
    }
    if (canonical.droppedOverflow.length > 0) {
      notes.push(`最多同时论剑 ${MAX_SELECT} 把，已自动截取`);
    }
    if (notes.length > 0) showToast(notes.join('；'));
  }, [loading, error, location.search, location.pathname, canonicalSearch, canonical, navigate, showToast]);

  /* ---------------- 由 URL 推导的展示数据（无镜像 state） ---------------- */

  const selectedSwords = useMemo(
    () => canonical.ids.map((id) => byId.get(id)).filter((s): s is Sword => Boolean(s)),
    [canonical.ids, byId],
  );
  const ready = selectedSwords.length >= MIN_SELECT;
  const stats = useMemo(
    () => (selectedSwords.length > 0 ? computeCompareStats(selectedSwords) : null),
    [selectedSwords],
  );
  const displaySwords = useMemo(
    () => (stats ? sortSwords(selectedSwords, canonical.sort, stats) : selectedSwords),
    [selectedSwords, canonical.sort, stats],
  );

  const cardData = useMemo<CompareCardData | null>(() => {
    if (!stats || !ready) return null;
    return {
      swords: stats.ranked,
      scores: stats.scores,
      wins: stats.wins,
      ranks: stats.ranks,
      generatedAt: new Date(),
    };
  }, [stats, ready]);

  /* ---------------- 所有变更只写 URL ---------------- */

  const pushCompare = useCallback(
    (next: { ids: string[]; sort: CompareSort; view: CompareView }) => {
      const search = buildCompareSearch(next);
      navigate(search ? `?${search}` : location.pathname);
    },
    [navigate, location.pathname],
  );

  const handleToggleSword = (id: string) => {
    const next = new Set(canonical.ids);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (next.size >= MAX_SELECT) {
        showToast(`最多同时论剑 ${MAX_SELECT} 把，请先撤下一把`);
        return;
      }
      next.add(id);
    }
    pushCompare({
      ids: [...next].sort(compareSwordIds),
      sort: canonical.sort,
      view: canonical.view,
    });
  };

  const handleSortChange = (sort: CompareSort) => {
    pushCompare({ ids: canonical.ids, sort, view: canonical.view });
  };

  const handleViewChange = (view: CompareView) => {
    pushCompare({ ids: canonical.ids, sort: canonical.sort, view });
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${location.pathname}${canonicalSearch ? `?${canonicalSearch}` : ''}`;
    const result = await copyTextToClipboard(url);
    if (result === 'fail') {
      setManualCopyUrl(url);
    } else {
      showToast('论剑链接已复制，可传予同道');
    }
  };

  useEffect(() => {
    if (manualCopyUrl && manualInputRef.current) {
      manualInputRef.current.focus();
      manualInputRef.current.select();
    }
  }, [manualCopyUrl]);

  const viewAnimKey = `${canonical.view}|${displaySwords.map((s) => s.id).join(',')}|${canonical.sort}`;

  /* ---------------- 渲染 ---------------- */

  return (
    <div className="min-h-screen pt-20 pb-12">
      {/* 页首 */}
      <div className="relative h-56 md:h-64 overflow-hidden mb-10">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url("https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=traditional%20chinese%20ink%20painting%20of%20two%20crossed%20ancient%20swords%20over%20misty%20mountains%2C%20duel%20atmosphere%2C%20ink%20wash%20style%2C%20sepia%20tones&image_size=landscape_16_9")`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink-100/60 via-ink-100/80 to-ink-100" />
        <div className="relative container mx-auto px-4 h-full flex flex-col justify-center">
          <div className="animate-fade-in-up">
            <div className="flex items-center gap-3 mb-3">
              <Swords className="w-8 h-8 text-cinnabar-600" />
              <h1 className="font-brush text-5xl md:text-6xl text-ink-900">名剑论剑</h1>
            </div>
            <p className="font-song text-lg text-ink-600 max-w-xl ml-11">
              选二至四把名剑同场比试，四维相校，立见高下。
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        {loading ? (
          <div className="space-y-4">
            <div className="h-40 bg-ink-50 animate-pulse" />
            <div className="h-72 bg-ink-50 animate-pulse" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <AlertCircle className="w-14 h-14 text-cinnabar-600 mx-auto mb-4" />
            <h3 className="font-brush text-2xl text-ink-700 mb-2">名剑谱调取失败</h3>
            <p className="font-song text-ink-500 mb-4">{error}</p>
            <button
              onClick={fetchSwords}
              className="px-6 py-2 bg-cinnabar-600 text-ink-100 font-song hover:bg-cinnabar-700 transition-colors"
            >
              重新调取
            </button>
          </div>
        ) : (
          <>
            {/* 挑选台 */}
            <SwordPicker swords={swords} selectedIds={canonical.ids} onToggle={handleToggleSword} />

            {/* 人数不足提示 */}
            {!ready && (
              <div className="ink-card mt-6 p-10 text-center animate-ink-spread">
                <Swords className="w-14 h-14 text-ink-300 mx-auto mb-4" />
                <h3 className="font-brush text-2xl text-ink-700 mb-2">
                  {selectedSwords.length === 0 ? '擂台虚位以待' : '孤剑难鸣'}
                </h3>
                <p className="font-song text-ink-500">
                  {selectedSwords.length === 0
                    ? `请自上方剑匣中挑选 ${MIN_SELECT}–${MAX_SELECT} 把名剑，同场一较高下。`
                    : `已邀「${selectedSwords[0].name}」上场，至少再邀一把名剑方可开擂。`}
                </p>
              </div>
            )}

            {ready && stats && (
              <>
                {/* 综合评分排名 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6 mb-6">
                  {stats.ranked.map((s) => {
                    const rank = stats.ranks[s.id];
                    const tied =
                      stats.ranked.filter((o) => stats.ranks[o.id] === rank).length > 1;
                    return (
                      <div
                        key={s.id}
                        className={cn(
                          'ink-card p-4 flex items-center gap-3',
                          rank === 1 && 'ring-1 ring-gold-400',
                        )}
                      >
                        <div
                          className={cn(
                            'w-11 h-11 rounded-full flex items-center justify-center font-brush text-xl shrink-0',
                            rank === 1
                              ? 'bg-gold-400 text-ink-100 shadow-gold'
                              : 'bg-ink-200 text-ink-700',
                          )}
                        >
                          {rank}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="font-brush text-lg text-ink-900 truncate">
                              {s.name}
                            </span>
                            <span className="text-xs text-ink-400 whitespace-nowrap">
                              {tied ? '并列 · ' : ''}
                              {rankTitle(rank)}
                            </span>
                          </div>
                          <div className="text-xs font-song text-ink-500 mt-0.5">
                            综合 <span className="text-gold-600 font-bold">{stats.scores[s.id].toFixed(1)}</span>
                            <span className="mx-1.5">·</span>
                            胜出 <span className="text-cinnabar-600 font-bold">{stats.wins[s.id]}</span> 维
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 视图 + 排序 + 复制链接 */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-5">
                  <div className="flex items-center gap-2">
                    <span className="font-song text-sm text-ink-500">视图</span>
                    <div className="flex border-2 border-ink-200">
                      {VIEW_OPTIONS.map((opt) => {
                        const Icon = VIEW_ICONS[opt.value];
                        const active = canonical.view === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => handleViewChange(opt.value)}
                            className={cn(
                              'flex items-center gap-1.5 px-4 py-2 font-song text-sm transition-colors',
                              active
                                ? 'bg-cinnabar-600 text-ink-100'
                                : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
                            )}
                          >
                            <Icon className="w-4 h-4" />
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-song text-sm text-ink-500">排序</span>
                    <div className="flex flex-wrap gap-1.5">
                      {SORT_OPTIONS.map((opt) => {
                        const active = canonical.sort === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => handleSortChange(opt.value)}
                            className={cn(
                              'px-3 py-1.5 font-song text-sm transition-colors',
                              active
                                ? 'bg-bronze-600 text-ink-100'
                                : 'bg-ink-100 text-ink-700 hover:bg-ink-200',
                            )}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={handleCopyLink}
                    className="ml-auto flex items-center gap-2 px-4 py-2 bg-ink-50 border-2 border-ink-200 hover:border-ink-400 font-song text-sm text-ink-700 transition-colors"
                  >
                    <Link2 className="w-4 h-4" />
                    复制论剑链接
                  </button>
                </div>

                {/* 对比视图（水墨过渡） */}
                <div className="relative mb-8">
                  <InkWipe key={`wipe-${canonical.view}`} />
                  <div key={canonical.view} className="animate-compare-view-in">
                    {canonical.view === 'table' && (
                      <CompareTable swords={displaySwords} stats={stats} />
                    )}
                    {canonical.view === 'radar' && (
                      <CompareRadar swords={displaySwords} stats={stats} animKey={viewAnimKey} />
                    )}
                    {canonical.view === 'bar' && (
                      <CompareBars swords={displaySwords} stats={stats} animKey={viewAnimKey} />
                    )}
                  </div>
                </div>

                {/* 论剑帖：实时预览 + 导出 */}
                {cardData && <CompareCardPreview data={cardData} onToast={showToast} />}
              </>
            )}
          </>
        )}
      </div>

      {/* 剪贴板不可用时的手动复制 */}
      {manualCopyUrl && (
        <div className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-xl ink-card p-4 shadow-ink-hover animate-fade-in-up">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="font-song text-sm text-ink-700">
              剪贴板不可用，请手动复制论剑链接：
            </p>
            <button
              onClick={() => setManualCopyUrl(null)}
              className="text-ink-400 hover:text-ink-700 transition-colors"
              aria-label="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            ref={manualInputRef}
            readOnly
            value={manualCopyUrl}
            onFocus={(e) => e.target.select()}
            className="w-full px-3 py-2 bg-ink-100 border border-ink-200 font-song text-sm text-ink-800 outline-none focus:border-cinnabar-500"
          />
        </div>
      )}

      {/* 提示 Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-ink-900/90 text-ink-100 font-song text-sm shadow-ink animate-fade-in-up max-w-[90vw] text-center">
          {toast}
        </div>
      )}
    </div>
  );
}
