import { useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  cardFileName,
  drawCompareCard,
  renderCompareCardBlob,
  renderCompareCardDataURL,
  triggerDownload,
  type CompareCardData,
} from '@/lib/compareCard';

interface CompareCardPreviewProps {
  data: CompareCardData;
  onToast: (message: string) => void;
}

/**
 * 实时预览画布：所见即导出。
 * 预览与导出调用同一个 drawCompareCard；画布按设备像素比缩放，
 * DPR 变化（跨屏拖动 / 缩放）时自动重绘；网络字体就绪后重绘。
 */
export default function CompareCardPreview({ data, onToast }: CompareCardPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    const render = () => {
      if (cancelled) return;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.round(CARD_WIDTH * dpr);
      canvas.height = Math.round(CARD_HEIGHT * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawCompareCard(ctx, data);
    };

    render();

    /* 字体尚未就绪：先以回退字体绘制，字体加载完成后重绘 */
    if (typeof document !== 'undefined' && document.fonts) {
      const redraw = () => render();
      Promise.allSettled([
        document.fonts.load('58px "Ma Shan Zheng"'),
        document.fonts.load('42px "Ma Shan Zheng"'),
        document.fonts.load('600 16px "Noto Serif SC"'),
      ]).then(redraw);
      document.fonts.ready.then(redraw).catch(() => undefined);
    }

    /* 设备像素比不一致：监听 DPR 变化并重绘（逐级重注册） */
    let mq: MediaQueryList | null = null;
    const watchDpr = () => {
      mq?.removeEventListener('change', onDprChange);
      mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      mq.addEventListener('change', onDprChange);
    };
    const onDprChange = () => {
      render();
      watchDpr();
    };
    watchDpr();

    return () => {
      cancelled = true;
      mq?.removeEventListener('change', onDprChange);
    };
  }, [data]);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      /* 导出前确保字体就绪，导出与预览共用同一绘制函数 */
      if (typeof document !== 'undefined' && document.fonts?.ready) {
        try {
          await document.fonts.ready;
        } catch {
          /* 字体加载失败时以回退字体导出 */
        }
      }
      const now = new Date();
      const fresh: CompareCardData = { ...data, generatedAt: now };
      const filename = cardFileName(now);

      const blob = await renderCompareCardBlob(fresh);
      if (blob) {
        const url = URL.createObjectURL(blob);
        triggerDownload(url, filename);
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        onToast('对比卡已导出，可张榜于江湖');
        return;
      }
      const dataUrl = renderCompareCardDataURL(fresh);
      if (dataUrl) {
        triggerDownload(dataUrl, filename);
        onToast('对比卡已导出，可张榜于江湖');
        return;
      }
      onToast('当前环境不支持导出图片');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="ink-card p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="font-brush text-2xl text-ink-900">论剑帖 · 实时预览</h3>
          <p className="text-xs text-ink-500 font-song mt-1">
            1200 × 630 水墨对比卡，所见即导出，点击画布或按钮下载
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-5 py-2.5 bg-cinnabar-600 text-ink-100 font-song hover:bg-cinnabar-700 transition-colors disabled:opacity-60 disabled:cursor-wait"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? '挥墨中…' : '下载对比卡'}
        </button>
      </div>

      <button
        onClick={handleExport}
        disabled={exporting}
        className="block w-full cursor-pointer group relative"
        title="点击下载对比卡"
        aria-label="下载对比卡"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-auto block shadow-ink group-hover:shadow-ink-hover transition-shadow"
          style={{ aspectRatio: `${CARD_WIDTH} / ${CARD_HEIGHT}` }}
        />
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-ink-900/20">
          <span className="flex items-center gap-2 px-4 py-2 bg-ink-100/95 font-song text-sm text-ink-800 shadow-ink">
            <Download className="w-4 h-4" /> 点击下载 PNG
          </span>
        </span>
      </button>
    </div>
  );
}
