import type { Sword } from '../types';
import { DIMENSIONS, rankTitle } from './compare';

/**
 * 名剑论剑 · 对比卡绘制 —— 1200 × 630，Canvas 2D，水墨风格。
 * 页面实时预览与点击导出调用同一个 drawCompareCard，绝不另写一套。
 */

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export interface CompareCardData {
  /** 按综合评分排名排列的参选名剑（2–4 把） */
  swords: Sword[];
  scores: Record<string, number>;
  wins: Record<string, number>;
  ranks: Record<string, number>;
  generatedAt: Date;
}

const INK = '#1a1a1a';
const INK_SOFT = '#5c5854';
const INK_FAINT = '#8b8680';
const PAPER = '#f5f0e6';
const CINNABAR = '#c41e3a';
const GOLD = '#b99423';
const GOLD_DEEP = '#99751d';
const LINE = '#2d3a4a';

const BRUSH = (size: number) => `${size}px "Ma Shan Zheng", "ZCOOL KuaiLe", "Noto Serif SC", serif`;
const SONG = (size: number, weight = 400) => `${weight} ${size}px "Noto Serif SC", SimSun, serif`;

/** 确定性伪随机（由参选名剑决定），保证预览与导出画面一致 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedOf(data: CompareCardData): number {
  let h = 2166136261;
  const s = data.swords.map((x) => x.id).join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawSeal(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  fontSize: number,
  rotate = -0.035,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotate);
  ctx.font = BRUSH(fontSize);
  const w = ctx.measureText(text).width + fontSize * 0.9;
  const h = fontSize * 1.5;
  ctx.fillStyle = CINNABAR;
  roundRectPath(ctx, -w / 2, -h / 2, w, h, 3);
  ctx.fill();
  ctx.fillStyle = '#f8f6f2';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, fontSize * 0.06);
  ctx.restore();
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** 卡片上的生成时间（固定格式，避免本地化差异） */
export function formatCardTimestamp(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** 导出文件名：按日期时间命名 */
export function cardFileName(d: Date): string {
  return `名剑论剑_${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}.png`;
}

/**
 * 在 1200×630 逻辑坐标系内绘制对比卡。
 * 调用方负责设置变换（如按设备像素比缩放），本函数只认逻辑坐标。
 */
export function drawCompareCard(ctx: CanvasRenderingContext2D, data: CompareCardData): void {
  const W = CARD_WIDTH;
  const H = CARD_HEIGHT;
  const rand = mulberry32(seedOf(data));

  /* ---------- 宣纸底 ---------- */
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  const vg = ctx.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, 'rgba(236,228,210,0)');
  vg.addColorStop(1, 'rgba(236,228,210,0.85)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  /* 纸纹噪点（确定性） */
  for (let i = 0; i < 520; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const a = 0.02 + rand() * 0.045;
    ctx.fillStyle = `rgba(26,26,26,${a.toFixed(3)})`;
    ctx.fillRect(x, y, 1 + rand() * 1.6, 1 + rand() * 1.2);
  }

  /* 角落水墨晕染 */
  const blobs: Array<[number, number, number, string]> = [
    [W * 0.06, H * 0.1, 260, '45,58,74'],
    [W * 0.96, H * 0.9, 300, '45,58,74'],
    [W * 0.9, H * 0.06, 200, '196,30,58'],
  ];
  for (const [bx, by, br, rgb] of blobs) {
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    g.addColorStop(0, `rgba(${rgb},0.07)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(bx - br, by - br, br * 2, br * 2);
  }

  /* ---------- 水印：斜向重复 + 中央大字 ---------- */
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = INK;
  ctx.font = SONG(26, 600);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-Math.PI / 7);
  for (let row = -3; row <= 3; row++) {
    for (let col = -4; col <= 4; col++) {
      ctx.fillText('江湖名剑谱', col * 300, row * 150);
    }
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.fillStyle = INK;
  ctx.font = BRUSH(300);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('剑', W / 2, H / 2 + 30);
  ctx.restore();

  /* ---------- 边框 ---------- */
  ctx.strokeStyle = LINE;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, W - 32, H - 32);
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.strokeRect(26, 26, W - 52, H - 52);
  ctx.globalAlpha = 1;
  /* 四角朱砂 */
  ctx.fillStyle = CINNABAR;
  for (const [cx, cy] of [
    [16, 16],
    [W - 16, 16],
    [16, H - 16],
    [W - 16, H - 16],
  ] as const) {
    ctx.fillRect(cx - 4, cy - 4, 8, 8);
  }

  /* ---------- 标题 ---------- */
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.font = BRUSH(58);
  ctx.fillText('名 剑 论 剑', W / 2, 96);
  drawSeal(ctx, '论剑', W / 2 + 218, 78, 22);
  ctx.fillStyle = INK_FAINT;
  ctx.font = SONG(19);
  ctx.fillText('江 湖 名 剑 谱 · 神 兵 对 比 一 览', W / 2, 130);

  /* 标题下分隔线 */
  ctx.strokeStyle = LINE;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(90, 152);
  ctx.lineTo(W / 2 - 14, 152);
  ctx.moveTo(W / 2 + 14, 152);
  ctx.lineTo(W - 90, 152);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(W / 2, 152);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = INK_FAINT;
  ctx.fillRect(-5, -5, 10, 10);
  ctx.restore();

  /* ---------- 参选名剑分栏 ---------- */
  const swords = data.swords;
  const n = swords.length;

  if (n === 0) {
    ctx.fillStyle = INK_SOFT;
    ctx.font = SONG(26);
    ctx.textAlign = 'center';
    ctx.fillText('暂无参选名剑', W / 2, H / 2);
  } else {
    const areaL = 60;
    const areaR = W - 60;
    const gap = 34;
    const colW = (areaR - areaL - gap * (n - 1)) / n;
    const top = 168;

    swords.forEach((sword, i) => {
      const x = areaL + i * (colW + gap);
      const cx = x + colW / 2;
      const rank = data.ranks[sword.id] ?? i + 1;
      const tied = swords.some((o) => o.id !== sword.id && data.ranks[o.id] === rank);

      /* 栏间分隔线 */
      if (i > 0) {
        ctx.strokeStyle = LINE;
        ctx.globalAlpha = 0.14;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - gap / 2, top + 4);
        ctx.lineTo(x - gap / 2, 544);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      /* 名次圆 */
      ctx.beginPath();
      ctx.arc(cx, top + 24, 21, 0, Math.PI * 2);
      if (rank === 1) {
        ctx.fillStyle = GOLD;
        ctx.fill();
        ctx.strokeStyle = GOLD_DEEP;
      } else {
        ctx.fillStyle = 'rgba(45,58,74,0.08)';
        ctx.fill();
        ctx.strokeStyle = LINE;
      }
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = rank === 1 ? '#f8f6f2' : INK;
      ctx.font = BRUSH(24);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(rank), cx, top + 26);
      ctx.textBaseline = 'alphabetic';

      ctx.fillStyle = rank === 1 ? GOLD_DEEP : INK_FAINT;
      ctx.font = SONG(14, 600);
      ctx.fillText(`${tied ? '并列 · ' : ''}${rankTitle(rank)}`, cx, top + 60);

      /* 剑名与别号 */
      ctx.fillStyle = INK;
      ctx.font = BRUSH(40);
      ctx.fillText(sword.name, cx, top + 106);
      drawSeal(ctx, sword.alias, cx, top + 130, 14);
      ctx.fillStyle = INK_FAINT;
      ctx.font = SONG(14);
      ctx.fillText(`${sword.dynasty} · ${sword.owner}`, cx, top + 158);

      /* 四维数值 + 小条 */
      const rowY0 = top + 176;
      const rowH = 30;
      const labelW = 44;
      const valueW = 34;
      const barX = x + labelW;
      const barW = colW - labelW - valueW - 8;
      DIMENSIONS.forEach((dim, di) => {
        const v = sword.attributes[dim.key];
        const y = rowY0 + di * rowH;
        ctx.fillStyle = INK_SOFT;
        ctx.font = SONG(15);
        ctx.textAlign = 'left';
        ctx.fillText(dim.label, x, y + 11);

        ctx.fillStyle = 'rgba(45,58,74,0.14)';
        roundRectPath(ctx, barX, y + 3, barW, 10, 5);
        ctx.fill();
        const fg = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        fg.addColorStop(0, '#e2c056');
        fg.addColorStop(1, GOLD_DEEP);
        ctx.fillStyle = fg;
        roundRectPath(ctx, barX, y + 3, Math.max(6, (barW * v) / 100), 10, 5);
        ctx.fill();

        ctx.fillStyle = INK;
        ctx.font = SONG(15, 600);
        ctx.textAlign = 'right';
        ctx.fillText(String(v), x + colW, y + 12);
      });

      /* 综合评分 */
      ctx.textAlign = 'center';
      ctx.fillStyle = INK_FAINT;
      ctx.font = SONG(14);
      ctx.fillText('综 合 评 分', cx, rowY0 + 4 * rowH + 12);
      ctx.fillStyle = rank === 1 ? GOLD_DEEP : INK;
      ctx.font = BRUSH(40);
      ctx.fillText((data.scores[sword.id] ?? 0).toFixed(1), cx, rowY0 + 4 * rowH + 50);
      ctx.fillStyle = INK_SOFT;
      ctx.font = SONG(14);
      ctx.fillText(`胜出维度 ${data.wins[sword.id] ?? 0} / ${DIMENSIONS.length}`, cx, rowY0 + 4 * rowH + 74);
    });
  }

  /* ---------- 页脚 ---------- */
  ctx.strokeStyle = LINE;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, H - 62);
  ctx.lineTo(W - 60, H - 62);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = INK_FAINT;
  ctx.font = SONG(15);
  ctx.textAlign = 'left';
  ctx.fillText(`生成时间：${formatCardTimestamp(data.generatedAt)}`, 60, H - 36);
  ctx.textAlign = 'center';
  ctx.fillText('四维：锋利 · 硬度 · 柔韧 · 工艺', W / 2, H - 36);
  ctx.textAlign = 'right';
  ctx.fillStyle = CINNABAR;
  ctx.font = BRUSH(19);
  ctx.fillText('江湖名剑谱', W - 60, H - 35);
}

/* ------------------------------------------------------------------ */
/* 导出：离屏画布复用同一个 drawCompareCard                              */
/* ------------------------------------------------------------------ */

function createCardCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}

export function renderCompareCardBlob(data: CompareCardData): Promise<Blob | null> {
  const target = createCardCanvas();
  if (!target) return Promise.resolve(null);
  drawCompareCard(target.ctx, data);
  return new Promise((resolve) => {
    try {
      target.canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

export function renderCompareCardDataURL(data: CompareCardData): string | null {
  const target = createCardCanvas();
  if (!target) return null;
  drawCompareCard(target.ctx, data);
  try {
    return target.canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export function triggerDownload(href: string, filename: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
