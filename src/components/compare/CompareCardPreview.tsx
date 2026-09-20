import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import {
  CARD_WIDTH,
  CARD_HEIGHT,
  compareCardFileName,
  drawCompareCard,
  type CompareCardData,
} from '@/lib/compareCard';

interface CompareCardPreviewProps {
  /** 卡片数据；变化时入场动画重新开始 */
  data: CompareCardData;
}

/**
 * 实时预览画布：所见即所导出。
 * 预览与导出共用同一个 drawCompareCard；动画帧只通过
 * requestAnimationFrame 写进 ref，不经过组件状态。
 */
export default function CompareCardPreview({ data }: CompareCardPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 动画帧数据（起始时间 / 当前时间）只能由 rAF 写入
  const animRef = useRef({ start: 0, now: 0 });
  const rafRef = useRef(0);
  const [fontsReady, setFontsReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // 字体尚未就绪时先以回退字体绘制，就绪后触发重绘（rAF 循环会自动采用新字体）
  useEffect(() => {
    let cancelled = false;
    if (!('fonts' in document)) {
      setFontsReady(true);
      return;
    }
    Promise.all([
      document.fonts.load('46px "Ma Shan Zheng"'),
      document.fonts.load('600 17px "Noto Serif SC"'),
    ])
      .catch(() => undefined)
      .then(() => document.fonts.ready)
      .then(() => {
        if (!cancelled) setFontsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 数据变化时重置入场动画（直接写 ref，下一帧生效）
  useEffect(() => {
    animRef.current.start = 0;
  }, [data]);

  // 按设备像素比配置画布，DPR 变化（跨屏拖动 / 缩放）时重配
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const applyDpr = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(CARD_WIDTH * dpr);
      canvas.height = Math.round(CARD_HEIGHT * dpr);
    };
    applyDpr();

    const media = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    const onChange = () => applyDpr();
    if (media.addEventListener) {
      media.addEventListener('change', onChange);
    } else {
      media.addListener(onChange);
    }
    window.addEventListener('resize', onChange);
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', onChange);
      } else {
        media.removeListener(onChange);
      }
      window.removeEventListener('resize', onChange);
    };
  }, []);

  // rAF 循环：把帧时间写进 ref 并调用共享绘制函数
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = (t: number) => {
      const anim = animRef.current;
      if (anim.start === 0) anim.start = t;
      anim.now = t;
      const progress = Math.min((anim.now - anim.start) / 1200, 1);

      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawCompareCard(ctx, data, { progress, time: t });

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [data]);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 2600);
  }, []);

  // 导出：与预览共用同一个 drawCompareCard，定格在 progress = 1
  const handleExport = useCallback(() => {
    const offscreen = document.createElement('canvas');
    offscreen.width = CARD_WIDTH;
    offscreen.height = CARD_HEIGHT;
    const ctx = offscreen.getContext('2d');
    if (!ctx) {
      showNotice('当前环境不支持画布导出');
      return;
    }
    const exportData: CompareCardData = { ...data, generatedAt: new Date() };
    drawCompareCard(ctx, exportData, { progress: 1, time: 0 });

    const fileName = compareCardFileName(exportData.generatedAt);
    offscreen.toBlob((blob) => {
      if (!blob) {
        showNotice('导出失败，请重试');
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showNotice('对比卡已导出');
    }, 'image/png');
  }, [data, showNotice]);

  const hint = useMemo(() => {
    if (!fontsReady) return '字体加载中，预览将自动刷新…';
    return null;
  }, [fontsReady]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleExport}
        className="block w-full cursor-pointer group relative"
        title="点击下载对比卡"
        aria-label="下载名剑对比卡"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-auto block shadow-ink group-hover:shadow-ink-hover transition-shadow"
          style={{ aspectRatio: `${CARD_WIDTH} / ${CARD_HEIGHT}` }}
        />
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-ink-900/30">
          <span className="flex items-center gap-2 px-5 py-2.5 bg-ink-100 text-ink-900 font-song shadow-ink">
            <Download className="w-4 h-4" />
            下载对比卡
          </span>
        </span>
      </button>
      <div className="flex items-center justify-between mt-3">
        <p className="font-song text-sm text-ink-500">
          {hint ?? '点击画布即可下载 1200 × 630 水墨对比卡'}
        </p>
        {notice && (
          <p className="font-song text-sm text-cinnabar-600 animate-fade-in-up">{notice}</p>
        )}
      </div>
    </div>
  );
}
