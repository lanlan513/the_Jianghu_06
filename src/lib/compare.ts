import type { Sword } from '../types';

/** 对比维度（四维） */
export type DimKey = 'sharpness' | 'hardness' | 'flexibility' | 'craftsmanship';

export const DIMENSIONS: ReadonlyArray<{ key: DimKey; label: string }> = [
  { key: 'sharpness', label: '锋利' },
  { key: 'hardness', label: '硬度' },
  { key: 'flexibility', label: '柔韧' },
  { key: 'craftsmanship', label: '工艺' },
];

export const MIN_SELECT = 2;
export const MAX_SELECT = 4;

/* ------------------------------------------------------------------ */
/* URL 参数：选中集合 / 排序 / 视图，全部由 URL 承载                      */
/* ------------------------------------------------------------------ */

export const COMPARE_VIEWS = ['table', 'radar', 'bar'] as const;
export type CompareView = (typeof COMPARE_VIEWS)[number];
export const DEFAULT_VIEW: CompareView = 'table';

export const COMPARE_SORTS = [
  'score',
  'wins',
  'sharpness',
  'hardness',
  'flexibility',
  'craftsmanship',
] as const;
export type CompareSort = (typeof COMPARE_SORTS)[number];
export const DEFAULT_SORT: CompareSort = 'score';

export const VIEW_OPTIONS: ReadonlyArray<{ value: CompareView; label: string }> = [
  { value: 'table', label: '表格' },
  { value: 'radar', label: '雷达图' },
  { value: 'bar', label: '条形图' },
];

export const SORT_OPTIONS: ReadonlyArray<{ value: CompareSort; label: string }> = [
  { value: 'score', label: '综合评分' },
  { value: 'wins', label: '胜出维度' },
  { value: 'sharpness', label: '锋利' },
  { value: 'hardness', label: '硬度' },
  { value: 'flexibility', label: '柔韧' },
  { value: 'craftsmanship', label: '工艺' },
];

export interface ParsedCompareParams {
  /** URL 中原始出现的编号（未去重、未校验） */
  rawIds: string[];
  sort: CompareSort;
  view: CompareView;
  /** sort / view 出现了非法取值（将被静默归位到默认值） */
  hadInvalidSort: boolean;
  hadInvalidView: boolean;
  /** 与对比无关的多余参数（将被剔除） */
  extraKeys: string[];
}

const KNOWN_KEYS = new Set(['ids', 'sort', 'view']);

export function parseCompareParams(search: URLSearchParams): ParsedCompareParams {
  const rawIds = (search.get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const sortRaw = search.get('sort');
  const viewRaw = search.get('view');
  const sortValid = sortRaw != null && (COMPARE_SORTS as readonly string[]).includes(sortRaw);
  const viewValid = viewRaw != null && (COMPARE_VIEWS as readonly string[]).includes(viewRaw);

  const extraKeys: string[] = [];
  search.forEach((_, key) => {
    if (!KNOWN_KEYS.has(key) && !extraKeys.includes(key)) extraKeys.push(key);
  });

  return {
    rawIds,
    sort: sortValid ? (sortRaw as CompareSort) : DEFAULT_SORT,
    view: viewValid ? (viewRaw as CompareView) : DEFAULT_VIEW,
    hadInvalidSort: sortRaw != null && !sortValid,
    hadInvalidView: viewRaw != null && !viewValid,
    extraKeys,
  };
}

export interface CanonicalCompare {
  /** 规范化后的选中集合：去重、剔除非法、升序、不超过 MAX_SELECT */
  ids: string[];
  sort: CompareSort;
  view: CompareView;
  droppedInvalid: string[];
  droppedDuplicateCount: number;
  droppedOverflow: string[];
}

/**
 * 规范化选中集合 —— 同一组选择只对应唯一一种链接形态：
 * 去重 → 剔除不存在的编号 → 数值升序 → 截取前 MAX_SELECT 个。
 */
export function canonicalizeCompare(
  parsed: ParsedCompareParams,
  validIds: ReadonlySet<string>,
): CanonicalCompare {
  const seen = new Set<string>();
  const valid: string[] = [];
  const droppedInvalid: string[] = [];
  let droppedDuplicateCount = 0;

  for (const id of parsed.rawIds) {
    if (seen.has(id)) {
      droppedDuplicateCount += 1;
      continue;
    }
    seen.add(id);
    if (!validIds.has(id)) {
      droppedInvalid.push(id);
      continue;
    }
    valid.push(id);
  }

  valid.sort(compareSwordIds);
  const ids = valid.slice(0, MAX_SELECT);
  const droppedOverflow = valid.slice(MAX_SELECT);

  return {
    ids,
    sort: parsed.sort,
    view: parsed.view,
    droppedInvalid,
    droppedDuplicateCount,
    droppedOverflow,
  };
}

/** 生成唯一形态的链接查询串：编号升序，默认 sort/view 省略 */
export function buildCompareSearch(c: { ids: string[]; sort: CompareSort; view: CompareView }): string {
  const parts: string[] = [];
  if (c.ids.length > 0) parts.push(`ids=${c.ids.join(',')}`);
  if (c.sort !== DEFAULT_SORT) parts.push(`sort=${c.sort}`);
  if (c.view !== DEFAULT_VIEW) parts.push(`view=${c.view}`);
  return parts.join('&');
}

export function compareSwordIds(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return a.localeCompare(b);
}

/* ------------------------------------------------------------------ */
/* 统计：综合评分 / 每维最优最差 / 胜出维度数 / 排名                      */
/* ------------------------------------------------------------------ */

/** 综合评分：四维均值，保留一位小数 */
export function compositeScore(sword: Sword): number {
  const { sharpness, hardness, flexibility, craftsmanship } = sword.attributes;
  return Math.round(((sharpness + hardness + flexibility + craftsmanship) / 4) * 10) / 10;
}

export interface DimensionStat {
  key: DimKey;
  max: number;
  min: number;
  /** 全部参选者该维度数值相同 */
  allTied: boolean;
  bestIds: ReadonlySet<string>;
  worstIds: ReadonlySet<string>;
}

export interface CompareStats {
  dimStats: Record<DimKey, DimensionStat>;
  /** 每把剑的综合评分 */
  scores: Record<string, number>;
  /** 每把剑胜出的维度数（全员并列的维度不计入任何人） */
  wins: Record<string, number>;
  /** 按综合评分排出的名次（并列同名次，竞赛排名） */
  ranks: Record<string, number>;
  /** 按综合评分排序后的名剑（排名展示用） */
  ranked: Sword[];
}

export function computeCompareStats(swords: Sword[]): CompareStats {
  const dimStats = {} as Record<DimKey, DimensionStat>;
  const wins: Record<string, number> = {};
  const scores: Record<string, number> = {};

  for (const s of swords) {
    wins[s.id] = 0;
    scores[s.id] = compositeScore(s);
  }

  for (const dim of DIMENSIONS) {
    const values = swords.map((s) => s.attributes[dim.key]);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const allTied = max === min;
    const bestIds = new Set(swords.filter((s) => s.attributes[dim.key] === max).map((s) => s.id));
    const worstIds = new Set(swords.filter((s) => s.attributes[dim.key] === min).map((s) => s.id));
    dimStats[dim.key] = { key: dim.key, max, min, allTied, bestIds, worstIds };
    if (!allTied) {
      for (const id of bestIds) wins[id] += 1;
    }
  }

  const ranked = [...swords].sort((a, b) => {
    if (scores[b.id] !== scores[a.id]) return scores[b.id] - scores[a.id];
    if (wins[b.id] !== wins[a.id]) return wins[b.id] - wins[a.id];
    if (b.popularity !== a.popularity) return b.popularity - a.popularity;
    return compareSwordIds(a.id, b.id);
  });

  const ranks: Record<string, number> = {};
  ranked.forEach((s, i) => {
    ranks[s.id] = i > 0 && scores[ranked[i - 1].id] === scores[s.id] ? ranks[ranked[i - 1].id] : i + 1;
  });

  return { dimStats, scores, wins, ranks, ranked };
}

/** 按 URL 中的 sort 参数排列展示顺序（所有视图共用） */
export function sortSwords(swords: Sword[], sort: CompareSort, stats: CompareStats): Sword[] {
  const valueOf = (s: Sword): number => {
    switch (sort) {
      case 'score':
        return stats.scores[s.id];
      case 'wins':
        return stats.wins[s.id];
      default:
        return s.attributes[sort];
    }
  };
  return [...swords].sort((a, b) => {
    const diff = valueOf(b) - valueOf(a);
    if (diff !== 0) return diff;
    if (stats.scores[b.id] !== stats.scores[a.id]) return stats.scores[b.id] - stats.scores[a.id];
    return compareSwordIds(a.id, b.id);
  });
}

/** 名次称谓（论剑排名） */
export const RANK_TITLES = ['魁首', '榜眼', '探花', '殿军'] as const;

export function rankTitle(rank: number): string {
  return RANK_TITLES[rank - 1] ?? `第${rank}名`;
}

/** 每把参选名剑的专属墨色（按展示顺序取色） */
export const SWORD_INKS = ['#c41e3a', '#2d3a4a', '#4a6741', '#b99423'] as const;
