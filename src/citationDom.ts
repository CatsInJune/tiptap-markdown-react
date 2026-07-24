/**
 * 从事件目标向上找到 `.citation-ref`（且必须在 root 内）。
 * SSR 阅读页事件委托与单测共用。
 */
export function findCitationRefElement(
  target: EventTarget | null,
  root: ParentNode,
): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest('.citation-ref');
  if (!(el instanceof HTMLElement)) return null;
  if (!root.contains(el)) return null;
  return el;
}

/** 从圆标 DOM 读取 attrs（与 CitationRef renderHTML 的 data-* 对齐）。 */
export function readCitationAttrs(el: HTMLElement): {
  index: string;
  url: string | null;
  title: string | null;
} {
  return {
    index: el.getAttribute('data-index') || el.textContent?.trim() || '',
    url: el.getAttribute('data-url'),
    title: el.getAttribute('data-title'),
  };
}
