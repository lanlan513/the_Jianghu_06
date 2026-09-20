import { useRef } from 'react';
import type { Sword } from '../../types';
import { DIMENSIONS, SWORD_INKS, type CompareStats } from '@/lib/compare';
import { useRafAnimation } from '@/hooks/useRafAnimation';

interface CompareRadarProps {
  swords: Sword[];
  stats: CompareStats;
  /** 变化时重播生长动画 */
  animKey: string;
}

const CX = 230;
const CY = 180;
const R = 128;

function axisAngle(i: number): number {
  return -Math.PI / 2 + (i * Math.PI * 2) / DIMENSIONS.length;
}

function axisPoint(i: number, value: number): [number, number] {
  const a = axisAngle(i);
  const r = (value / 100) * R;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function polygonPath(values: number[]): string {
  const pts = values.map((v, i) => axisPoint(i, v));
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ') + ' Z';
}

/**
 * 雷达图：描边自顶点生长（rAF → ref 写 dashoffset），
 * 各维度最优顶点带金色脉冲光晕。
 */
export default function CompareRadar({ swords, stats, animKey }: CompareRadarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRefs = useRef<Array<SVGPathElement | null>>([]);
  const lengthsRef = useRef<number[]>([]);

  /* 描边生长 + 填充淡入 + 顶点圆点浮现，全程只写 ref */
  useRafAnimation(
    900,
    (p) => {
      pathRefs.current.forEach((path, i) => {
        if (!path) return;
        if (!lengthsRef.current[i]) {
          lengthsRef.current[i] = path.getTotalLength();
        }
        const len = lengthsRef.current[i];
        path.style.strokeDasharray = `${len}`;
        path.style.strokeDashoffset = `${len * (1 - p)}`;
        path.style.fillOpacity = `${0.14 * p}`;
      });
      containerRef.current
        ?.querySelectorAll<SVGElement>('[data-radar-dot]')
        .forEach((el) => {
          el.style.opacity = `${p}`;
        });
    },
    [animKey],
  );

  const labelAnchor = (i: number): 'middle' | 'start' | 'end' => {
    if (i === 1) return 'start';
    if (i === 3) return 'end';
    return 'middle';
  };

  return (
    <div ref={containerRef} className="ink-card p-6">
      <svg viewBox="0 0 460 360" className="w-full max-w-[560px] mx-auto" role="img" aria-label="四维雷达图">
        {/* 网格 */}
        {[25, 50, 75, 100].map((f) => (
          <path
            key={f}
            d={polygonPath([f, f, f, f])}
            fill="none"
            stroke="#2d3a4a"
            strokeOpacity={f === 100 ? 0.35 : 0.15}
            strokeWidth={1}
          />
        ))}
        {/* 轴线 */}
        {DIMENSIONS.map((dim, i) => {
          const [x, y] = axisPoint(i, 100);
          return (
            <line
              key={dim.key}
              x1={CX}
              y1={CY}
              x2={x}
              y2={y}
              stroke="#2d3a4a"
              strokeOpacity={0.2}
              strokeWidth={1}
            />
          );
        })}

        {/* 轴标签 + 该维最优值 */}
        {DIMENSIONS.map((dim, i) => {
          const [x, y] = axisPoint(i, 100);
          const a = axisAngle(i);
          const lx = x + Math.cos(a) * 30;
          const ly = y + Math.sin(a) * 30;
          const ds = stats.dimStats[dim.key];
          return (
            <g key={dim.key}>
              <text
                x={lx}
                y={ly}
                textAnchor={labelAnchor(i)}
                dominantBaseline="middle"
                className="fill-ink-700 font-song"
                fontSize={15}
              >
                {dim.label}
              </text>
              <text
                x={lx}
                y={ly + 16}
                textAnchor={labelAnchor(i)}
                dominantBaseline="middle"
                className="fill-gold-600 font-song"
                fontSize={11}
              >
                {ds.allTied ? '并列' : `最优 ${ds.max}`}
              </text>
            </g>
          );
        })}

        {/* 名剑多边形 */}
        {swords.map((s, i) => {
          const values = DIMENSIONS.map((d) => s.attributes[d.key]);
          const color = SWORD_INKS[i % SWORD_INKS.length];
          return (
            <path
              key={s.id}
              ref={(el) => {
                pathRefs.current[i] = el;
              }}
              d={polygonPath(values)}
              fill={color}
              fillOpacity={0}
              stroke={color}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
          );
        })}

        {/* 顶点圆点 */}
        {swords.map((s, i) => {
          const color = SWORD_INKS[i % SWORD_INKS.length];
          return DIMENSIONS.map((d, di) => {
            const [x, y] = axisPoint(di, s.attributes[d.key]);
            return (
              <circle
                key={`${s.id}-${d.key}`}
                data-radar-dot
                cx={x}
                cy={y}
                r={3.5}
                fill={color}
                opacity={0}
              />
            );
          });
        })}

        {/* 各维最优：金色脉冲光晕 */}
        {DIMENSIONS.map((d, di) => {
          const ds = stats.dimStats[d.key];
          if (ds.allTied) return null;
          return swords
            .filter((s) => ds.bestIds.has(s.id))
            .map((s) => {
              const [x, y] = axisPoint(di, s.attributes[d.key]);
              return (
                <g key={`${d.key}-${s.id}`} data-radar-dot opacity={0}>
                  <circle
                    className="gold-pulse"
                    cx={x}
                    cy={y}
                    r={7}
                    fill="none"
                    stroke="#d4af37"
                    strokeWidth={2}
                  />
                  <circle cx={x} cy={y} r={2.5} fill="#d4af37" />
                </g>
              );
            });
        })}
      </svg>

      {/* 图例 */}
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4">
        {swords.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 font-song text-sm">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: SWORD_INKS[i % SWORD_INKS.length] }}
            />
            <span className="text-ink-800">{s.name}</span>
            <span className="text-ink-400 text-xs">
              综合 {stats.scores[s.id].toFixed(1)} · 胜 {stats.wins[s.id]} 维
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
