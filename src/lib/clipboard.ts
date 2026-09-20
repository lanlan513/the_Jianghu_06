/**
 * 复制文本，依次尝试：Clipboard API → execCommand 回退 → 宣告失败。
 * 剪贴板不可用（非安全上下文 / 权限被拒 / 旧浏览器）时返回 'fail'，
 * 由调用方展示手动复制入口。
 */
export async function copyTextToClipboard(
  text: string,
): Promise<'clipboard' | 'fallback' | 'fail'> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return 'clipboard';
    }
  } catch {
    /* 权限被拒等情况，继续尝试回退方案 */
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) return 'fallback';
  } catch {
    /* 回退亦不可用 */
  }

  return 'fail';
}
