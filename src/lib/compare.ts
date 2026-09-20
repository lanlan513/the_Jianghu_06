import type { Sword } from '@/types';

export const MIN_COMPARE = 2;
export const MAX_COMPARE = 4;

export const DIMENSIONS = [
  { key: 'sharpness', label: '锋利' },
  { key: 'hardness', label: '硬度' },
  { key: 'flexibility', label: '柔韧' },
  { key: 'craftsmanship', label: '工艺' },
] as const;

export type DimensionKey = (typeof DIMENSIONS)[number]['key'];

export const COMPARE_SORTS = [
  { value: 'score', label: '综合评分' },
  { value: 'sharpness', label: '锋利' },
  { value: 'hardness', label: '硬度' },
  { value: 'flexibility', label: '柔韧' },
  { value: 'craftsmanship', label: '工艺' },
  { value: 'name', label: '名称' },
] as const;

export type CompareSort = (typeof COMPARE_SORTS)[number]['value'];

export const COMPARE_VIEWS = [
  { value: 'table', label: '表格' },
  { value: 'radar', label: '雷达图' },
  { value: 'bar', label: '条形图' },
] as const;

export type CompareView = (typeof COMPARE_VIEWS)[number]['value'];

const DEFAULT_SORT: CompareSort = 'score';
const DEFAULT_VIEW: CompareView = 'table';

/** 每把参选剑的展示配色（朱砂 / 青铜 / 鎏金 / 黛蓝） */
export const ENTRY_COLORS = ['#c41e3a', '#3d5536', '#b99423', '#2d3a4a'];

export interface CompareEntry {
  sword: Sword;
  score: number;
}

export function scoreOf(sword: Sword): number {
  const { sharpness, hardness, flexibility, craftsmanship } = sword.attributes;
  return Math.round(((sharpness + hardness + flexibility + craftsmanship) / 4) * 10) / 10;
}

export interface ParsedCompareParams {
  ids: string[];
  sort: CompareSort;
  view: CompareView;
  /** 规范化的查询串（以 ? 开头），同一状态只对应这一种形态 */
  canonical: string;
}

function isSort(value: string | null): value is CompareSort {
  return COMPARE_SORTS.some((s) => s.value === value);
}

function isView(value: string | null): value is CompareView {
  return COMPARE_VIEWS.some((v) => v.value === value);
}

/**
 * 把一组编号规范化为唯一形态：去非法字符、剔除不存在的编号、
 * 去重、按数值升序、截断到上限。保证同一组选择只有唯一链接。
 */
export function canonicalizeIds(rawIds: string[], validIds: Set<string> | null): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of rawIds) {
    const id = raw.trim();
    if (!/^\d+$/.test(id)) continue;
    if (seen.has(id)) continue;
    if (validIds && !validIds.has(id)) continue;
    seen.add(id);
    cleaned.push(id);
  }
  cleaned.sort((a, b) => Number(a) - Number(b));
  return cleaned.slice(0, MAX_COMPARE);
}

export function serializeCompareParams(ids: string[], sort: CompareSort, view: CompareView): string {
  const params = new URLSearchParams();
  if (ids.length > 0) {
    params.set('ids', ids.join(','));
  }
  params.set('sort', sort);
  params.set('view', view);
  return `?${params.toString()}`;
}

/**
 * 从 URL 查询串解析对比状态。validIds 为 null 表示名剑数据尚未加载，
 * 此时只做格式校验，待数据就绪后再次解析会剔除不存在的编号。
 */
export function parseCompareParams(search: string, validIds: Set<string> | null): ParsedCompareParams {
  const params = new URLSearchParams(search);
  const rawIds = (params.get('ids') ?? '').split(',').filter((s) => s.trim() !== '');
  const ids = canonicalizeIds(rawIds, validIds);

  const rawSort = params.get('sort');
  const sort: CompareSort = isSort(rawSort) ? rawSort : DEFAULT_SORT;

  const rawView = params.get('view');
  const view: CompareView = isView(rawView) ? rawView : DEFAULT_VIEW;

  return { ids, sort, view, canonical: serializeCompareParams(ids, sort, view) };
}

export function sortEntries(entries: CompareEntry[], sort: CompareSort): CompareEntry[] {
  const sorted = [...entries];
  switch (sort) {
    case 'score':
      sorted.sort((a, b) => b.score - a.score || a.sword.name.localeCompare(b.sword.name, 'zh-CN'));
      break;
    case 'name':
      sorted.sort((a, b) => a.sword.name.localeCompare(b.sword.name, 'zh-CN'));
      break;
    default:
      sorted.sort(
        (a, b) =>
          b.sword.attributes[sort] - a.sword.attributes[sort] ||
          b.score - a.score ||
          a.sword.name.localeCompare(b.sword.name, 'zh-CN'),
      );
  }
  return sorted;
}

export interface DimensionStat {
  key: DimensionKey;
  label: string;
  bestIds: Set<string>;
  worstIds: Set<string>;
  /** 全部参选剑在该维度数值相同 */
  allTied: boolean;
}

export interface CompareAnalysis {
  dimensions: DimensionStat[];
  /** 综合评分行的最优 / 最差 / 并列 */
  score: { bestIds: Set<string>; worstIds: Set<string>; allTied: boolean };
  /** 每把剑胜出的维度数（并列第一计入） */
  wins: Map<string, number>;
  /** 按综合评分排出的名次（同分同名次，从 1 开始） */
  ranks: Map<string, number>;
  /** 综合评分最高者 */
  topIds: Set<string>;
}

function extremum(ids: string[], values: Map<string, number>): {
  bestIds: Set<string>;
  worstIds: Set<string>;
  allTied: boolean;
} {
  const nums = ids.map((id) => values.get(id) ?? 0);
  const max = Math.max(...nums);
  const min = Math.min(...nums);
  const allTied = max === min;
  return {
    bestIds: new Set(ids.filter((id) => values.get(id) === max)),
    worstIds: new Set(ids.filter((id) => values.get(id) === min)),
    allTied,
  };
}

export function analyzeCompare(entries: CompareEntry[]): CompareAnalysis {
  const ids = entries.map((e) => e.sword.id);

  const dimensions: DimensionStat[] = DIMENSIONS.map(({ key, label }) => {
    const values = new Map(ids.map((id) => {
      const entry = entries.find((e) => e.sword.id === id);
      return [id, entry ? entry.sword.attributes[key] : 0] as const;
    }));
    return { key, label, ...extremum(ids, values) };
  });

  const scoreValues = new Map(entries.map((e) => [e.sword.id, e.score] as const));
  const score = extremum(ids, scoreValues);

  const wins = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const dim of dimensions) {
    if (dim.allTied) continue;
    for (const id of dim.bestIds) {
      wins.set(id, (wins.get(id) ?? 0) + 1);
    }
  }

  const ranks = new Map<string, number>();
  const byScoreDesc = [...entries].sort((a, b) => b.score - a.score);
  let rank = 0;
  let prevScore: number | null = null;
  byScoreDesc.forEach((entry, index) => {
    if (prevScore === null || entry.score < prevScore) {
      rank = index + 1;
      prevScore = entry.score;
    }
    ranks.set(entry.sword.id, rank);
  });

  return { dimensions, score, wins, ranks, topIds: score.bestIds };
}

const RANK_LABELS = ['榜首', '榜眼', '探花', '殿军'];

export function rankLabel(rank: number): string {
  return RANK_LABELS[rank - 1] ?? `第${rank}名`;
}
