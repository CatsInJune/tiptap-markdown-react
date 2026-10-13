import type { TocItem } from './extractToc';

const HEADING_TAG = /^H([1-6])$/;

export function sameTocItems(a: TocItem[], b: TocItem[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (item, index) =>
      item.id === b[index]?.id &&
      item.level === b[index]?.level &&
      item.text === b[index]?.text,
  );
}

/** 从已渲染的标题上收集目录。只认带 data-toc-id 的 h1–h6。 */
export function readTocItems(root: ParentNode): TocItem[] {
  const nodes = root.querySelectorAll<HTMLElement>('[data-toc-id]');
  const items: TocItem[] = [];
  nodes.forEach((el) => {
    const id = el.getAttribute('data-toc-id');
    const match = HEADING_TAG.exec(el.tagName);
    if (!id || !match) return;
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    items.push({ id, level: Number(match[1]), text });
  });
  return items;
}
