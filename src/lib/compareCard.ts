/**
 * 名剑对比卡 —— 唯一的 Canvas 2D 绘制函数。
 * 页面实时预览与导出图片都调用 drawCompareCard，不允许各写一套。
 */

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export interface CompareCardSword {
  name: string;
  alias: string;
  dynasty: string;
  dims: { label: string; value: number }[];
  score: number;
  rankLabel: string;
  wins: number;
  isTop: boolean;
  color: string;
}

export interface CompareCardData {
  swords: CompareCardSword[];
  generatedAt: Date;
}

export interface CompareCardFrame {
  /** 入场进度 0~1，导出时传 1 */
  progress?: number;
  /** rAF 时间戳，用于金色脉冲等微动画 */
  time?: number;
}

const INK = '#1a1a1a';
const PAPER = '#f5f0e6';
const CINNABAR = '#c41e3a';
const GOLD = '#d4af37';
const BRUSH_FONT = '"Ma Shan Zheng", "ZCOOL KuaiLe", cursive';
const SONG_FONT = '"Noto Serif SC", SimSun, serif';

/** 确定性伪随机，保证每次绘制的水墨纹理一致 */
function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function formatGeneratedAt(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/** 导出文件名：名剑对比-20260920-153000.png */
export function compareCardFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `名剑对比-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.png`
  );
}

function drawPaper(ctx: CanvasRenderingContext2D, progress: number) {
  // 宣纸底色
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  bg.addColorStop(0, '#f8f4ea');
  bg.addColorStop(0.5, PAPER);
  bg.addColorStop(1, '#efe8d8');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // 水墨晕染
  const washes = [
    { x: 180, y: 120, r: 260, a: 0.05 },
    { x: 1020, y: 500, r: 300, a: 0.06 },
    { x: 960, y: 110, r: 200, a: 0.04 },
    { x: 240, y: 540, r: 220, a: 0.045 },
  ];
  washes.forEach((w) => {
    const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.r);
    g.addColorStop(0, `rgba(26, 26, 26, ${w.a * progress})`);
    g.addColorStop(1, 'rgba(26, 26, 26, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(w.x - w.r, w.y - w.r, w.r * 2, w.r * 2);
  });

  // 纸纤维
  ctx.save();
  ctx.globalAlpha = 0.05 * progress;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  for (let i = 0; i < 46; i++) {
    const x = rand(i) * CARD_WIDTH;
    const y = rand(i + 100) * CARD_HEIGHT;
    const len = 24 + rand(i + 200) * 60;
    const angle = rand(i + 300) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFrame(ctx: CanvasRenderingContext2D, progress: number) {
  const m = 26;
  const w = CARD_WIDTH - m * 2;
  const h = CARD_HEIGHT - m * 2;
  const perimeter = (w + h) * 2;

  // 外框随笔触生长
  ctx.save();
  ctx.strokeStyle = 'rgba(26, 26, 26, 0.75)';
  ctx.lineWidth = 3;
  ctx.setLineDash([perimeter]);
  ctx.lineDashOffset = perimeter * (1 - progress);
  ctx.strokeRect(m, m, w, h);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = progress;
  ctx.strokeStyle = 'rgba(26, 26, 26, 0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(m + 7, m + 7, w - 14, h - 14);
  ctx.restore();
}

function drawWatermark(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = INK;
  ctx.font = `46px ${SONG_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(CARD_WIDTH / 2, CARD_HEIGHT / 2);
  ctx.rotate(-Math.PI / 7);
  for (let row = -3; row <= 3; row++) {
    for (let col = -2; col <= 2; col++) {
      ctx.fillText('江湖名剑谱', col * 460, row * 170);
    }
  }
  ctx.restore();
}

function drawSeal(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(-0.06);
  ctx.fillStyle = CINNABAR;
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.strokeStyle = 'rgba(245, 240, 230, 0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(-size / 2 + 4, -size / 2 + 4, size - 8, size - 8);
  ctx.fillStyle = '#f5f0e6';
  ctx.font = `${Math.round(size * 0.34)}px ${BRUSH_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('名剑', 0, -size * 0.17);
  ctx.fillText('对比', 0, size * 0.2);
  ctx.restore();
}

function drawSwordColumn(
  ctx: CanvasRenderingContext2D,
  sword: CompareCardSword,
  area: { x: number; y: number; w: number; h: number },
  colProgress: number,
  time: number,
) {
  const p = easeOutCubic(clamp01(colProgress));
  if (p <= 0) return;

  ctx.save();
  ctx.globalAlpha = p;
  const lift = (1 - p) * 26;
  ctx.translate(0, lift);

  const cx = area.x + area.w / 2;

  // 名次与印
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = sword.isTop ? GOLD : 'rgba(26, 26, 26, 0.55)';
  ctx.font = `22px ${SONG_FONT}`;
  ctx.fillText(sword.rankLabel, cx, area.y + 26);

  // 剑名
  ctx.fillStyle = INK;
  ctx.font = `46px ${BRUSH_FONT}`;
  ctx.fillText(sword.name, cx, area.y + 78);

  // 称号 · 朝代
  ctx.fillStyle = CINNABAR;
  ctx.font = `19px ${SONG_FONT}`;
  ctx.fillText(`${sword.alias} · ${sword.dynasty}`, cx, area.y + 110);

  // 分隔笔触
  ctx.strokeStyle = 'rgba(26, 26, 26, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(area.x + 24, area.y + 128);
  ctx.lineTo(area.x + area.w - 24, area.y + 128);
  ctx.stroke();

  // 四维数值条
  const barAreaX = area.x + 30;
  const barAreaW = area.w - 60;
  const rowH = 44;
  let y = area.y + 158;
  ctx.textBaseline = 'middle';
  for (const dim of sword.dims) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(26, 26, 26, 0.7)';
    ctx.font = `17px ${SONG_FONT}`;
    ctx.fillText(dim.label, barAreaX, y + 8);

    const trackX = barAreaX + 52;
    const trackW = barAreaW - 52 - 40;
    ctx.fillStyle = 'rgba(26, 26, 26, 0.1)';
    ctx.fillRect(trackX, y, trackW, 14);

    ctx.fillStyle = sword.color;
    ctx.fillRect(trackX, y, trackW * (dim.value / 100) * p, 14);

    ctx.textAlign = 'right';
    ctx.fillStyle = INK;
    ctx.font = `600 17px ${SONG_FONT}`;
    ctx.fillText(String(Math.round(dim.value * p)), trackX + trackW + 36, y + 8);
    y += rowH;
  }

  // 综合评分
  const scoreY = y + 74;
  const shown = Math.round(sword.score * p * 10) / 10;
  ctx.textAlign = 'center';
  if (sword.isTop) {
    // 最优值金色脉冲
    const pulse = 0.5 + 0.5 * Math.sin(time / 320);
    ctx.save();
    ctx.shadowColor = `rgba(212, 175, 55, ${0.55 + 0.45 * pulse})`;
    ctx.shadowBlur = 18 + 14 * pulse;
    ctx.fillStyle = GOLD;
    ctx.font = `64px ${BRUSH_FONT}`;
    ctx.fillText(shown.toFixed(1), cx, scoreY);
    ctx.restore();
  } else {
    ctx.fillStyle = INK;
    ctx.font = `64px ${BRUSH_FONT}`;
    ctx.fillText(shown.toFixed(1), cx, scoreY);
  }

  ctx.fillStyle = 'rgba(26, 26, 26, 0.6)';
  ctx.font = `17px ${SONG_FONT}`;
  ctx.fillText(`综合评分 · 胜出 ${sword.wins} 维`, cx, scoreY + 34);

  ctx.restore();
}

export function drawCompareCard(
  ctx: CanvasRenderingContext2D,
  data: CompareCardData,
  frame: CompareCardFrame = {},
): void {
  const progress = clamp01(frame.progress ?? 1);
  const time = frame.time ?? 0;
  const n = data.swords.length;

  ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  drawPaper(ctx, progress);
  drawWatermark(ctx);
  drawFrame(ctx, progress);

  // 标题
  ctx.save();
  ctx.globalAlpha = progress;
  ctx.fillStyle = INK;
  ctx.font = `58px ${BRUSH_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('名剑对比', 64, 108);

  ctx.fillStyle = 'rgba(26, 26, 26, 0.6)';
  ctx.font = `19px ${SONG_FONT}`;
  ctx.fillText('刀剑如梦 · 数据为凭', 66, 142);
  ctx.restore();

  drawSeal(ctx, CARD_WIDTH - 92, 96, 64, progress);

  // 各剑分列
  const top = 168;
  const bottom = 66;
  const marginX = 56;
  const colW = (CARD_WIDTH - marginX * 2) / Math.max(n, 1);
  data.swords.forEach((sword, i) => {
    // 各列错峰入场
    const colProgress = clamp01(progress * (n + 1.5) - i * 0.9);
    drawSwordColumn(
      ctx,
      sword,
      { x: marginX + i * colW, y: top, w: colW, h: CARD_HEIGHT - top - bottom },
      colProgress,
      time,
    );

    // 列间淡墨分隔
    if (i > 0) {
      ctx.save();
      ctx.globalAlpha = 0.14 * progress;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(marginX + i * colW, top + 8);
      ctx.lineTo(marginX + i * colW, CARD_HEIGHT - bottom - 8);
      ctx.stroke();
      ctx.restore();
    }
  });

  // 页脚：生成时间与水印
  ctx.save();
  ctx.globalAlpha = progress;
  ctx.fillStyle = 'rgba(26, 26, 26, 0.55)';
  ctx.font = `16px ${SONG_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`生成时间：${formatGeneratedAt(data.generatedAt)}`, 64, CARD_HEIGHT - 44);
  ctx.textAlign = 'right';
  ctx.fillText('江湖名剑谱 · 论剑台', CARD_WIDTH - 64, CARD_HEIGHT - 44);
  ctx.restore();
}
