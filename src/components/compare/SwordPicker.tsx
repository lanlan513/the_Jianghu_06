import { Check } from 'lucide-react';
import type { Sword } from '../../types';
import { cn } from '@/lib/utils';
import { MAX_SELECT, MIN_SELECT } from '@/lib/compare';

interface SwordPickerProps {
  swords: Sword[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
}

/**
 * 名剑挑选台：从剑匣中挑选 2–4 把名剑同场论剑。
 * 选中状态完全由 URL 推导，本组件不持有任何选择状态。
 */
export default function SwordPicker({ swords, selectedIds, onToggle }: SwordPickerProps) {
  const atMax = selectedIds.length >= MAX_SELECT;

  return (
    <div className="ink-card p-5 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h3 className="font-brush text-2xl text-ink-900">挑选名剑</h3>
        <p className="font-song text-sm text-ink-500">
          已选 <span className={cn('font-bold', selectedIds.length >= MIN_SELECT ? 'text-cinnabar-600' : 'text-gold-600')}>{selectedIds.length}</span> / {MAX_SELECT}
          <span className="ml-2 text-xs text-ink-400">（{MIN_SELECT}–{MAX_SELECT} 把方可开擂）</span>
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {swords.map((sword) => {
          const selected = selectedIds.includes(sword.id);
          const dimmed = !selected && atMax;
          return (
            <button
              key={sword.id}
              onClick={() => onToggle(sword.id)}
              aria-pressed={selected}
              className={cn(
                'relative text-left p-3 border-2 transition-all duration-200 font-song',
                selected
                  ? 'border-cinnabar-600 bg-cinnabar-50 shadow-brush'
                  : 'border-ink-200 bg-ink-50 hover:border-ink-400',
                dimmed && 'opacity-45',
              )}
            >
              {selected && (
                <span className="absolute top-2 right-2 w-5 h-5 bg-cinnabar-600 text-ink-100 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5" />
                </span>
              )}
              <div className="font-brush text-lg text-ink-900 leading-tight">{sword.name}</div>
              <div className="text-xs text-cinnabar-600 mt-0.5">{sword.alias}</div>
              <div className="text-xs text-ink-400 mt-1 truncate">
                {sword.dynasty} · {sword.owner}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
