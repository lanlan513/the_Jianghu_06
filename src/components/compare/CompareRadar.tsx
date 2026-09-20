import type { CompareAnalysis, CompareEntry } from '@/lib/compare';
import { DIMENSIONS, ENTRY_COLORS } from '@/lib/compare';

interface CompareRadarProps {
  entries: CompareEntry[];
  analysis: CompareAnalysis;
}

const CX = 260;
const CY = 220;
const RADIUS = 140;

function axisPoint(index: number, ratio: number): [number, number] {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / DIMENSIONS.length;
  return [CX + Math.cos(angle) * RADIUS * ratio, CY + Math.sin(angle) * RADIUS * ratio];
}

function polygonPoints(ratios: number[]): string {
  return ratios.map((r, i) => axisPoint(i, r).join(',')).join(' ');
}

/**
 * 雷达图：描边随 pathLength 生长，最优顶点带金色脉冲。
 */
export default function CompareRadar({ entries, analysis }: CompareRadarProps) {
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 520 440"
        className="w-full max-w-[560px]"
        role="img"
        aria-label="名剑四维雷达图"
      >
        {/* 网格 */}
        {rings.map((r) => (
          <polygon
            key={r}
            points={polygonPoints(DIMENSIONS.map(() => r))}
            fill="none"
            stroke="rgba(26, 26, 26, 0.18)"
            strokeWidth={r === 1 ? 1.6 : 1}
          />
        ))}
        {DIMENSIONS.map((_, i) => {
          const [x, y] = axisPoint(i, 1);
          return (
            <line
              key={i}
              x1={CX}
              y1={CY}
              x2={x}
              y2={y}
              stroke="rgba(26, 26, 26, 0.18)"
              strokeWidth={1}
            />
          );
        })}

        {/* 轴标签 */}
        {DIMENSIONS.map((dim, i) => {
          const [x, y] = axisPoint(i, 1.18);
          return (
            <text
              key={dim.key}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-ink-700 font-song"
              fontSize={16}
            >
              {dim.label}
            </text>
          );
        })}

        {/* 各剑多边形，描边生长 */}
        {entries.map((entry, idx) => {
          const color = ENTRY_COLORS[idx % ENTRY_COLORS.length];
          const points = polygonPoints(
            DIMENSIONS.map((d) => entry.sword.attributes[d.key] / 100),
          );
          return (
            <g key={entry.sword.id}>
              <polygon
                points={points}
                fill={color}
                fillOpacity={0.12}
                stroke={color}
                strokeWidth={2.4}
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={1}
                className="radar-stroke-grow"
                style={{ animationDelay: `${idx * 180}ms` }}
              />
              {DIMENSIONS.map((d, i) => {
                const [x, y] = axisPoint(i, entry.sword.attributes[d.key] / 100);
                return <circle key={d.key} cx={x} cy={y} r={3.2} fill={color} />;
              })}
            </g>
          );
        })}

        {/* 各维度最优顶点：金色脉冲 */}
        {analysis.dimensions.map((dim, i) => {
          if (dim.allTied) return null;
          const bestEntry = entries.find((e) => dim.bestIds.has(e.sword.id));
          if (!bestEntry) return null;
          const [x, y] = axisPoint(i, bestEntry.sword.attributes[dim.key] / 100);
          return (
            <g key={dim.key} className="animate-gold-pulse-svg" style={{ transformOrigin: `${x}px ${y}px` }}>
              <circle cx={x} cy={y} r={9} fill="none" stroke="#d4af37" strokeWidth={2} opacity={0.9} />
              <circle cx={x} cy={y} r={4} fill="#d4af37" />
            </g>
          );
        })}
      </svg>

      {/* 图例 */}
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-2">
        {entries.map((entry, idx) => (
          <span key={entry.sword.id} className="flex items-center gap-2 font-song text-sm text-ink-700">
            <span
              className="inline-block w-4 h-4 rounded-sm"
              style={{ backgroundColor: ENTRY_COLORS[idx % ENTRY_COLORS.length] }}
            />
            {entry.sword.name}
            <span className="text-ink-400">{entry.score.toFixed(1)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
