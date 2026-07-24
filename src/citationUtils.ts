import type { JSONContent } from '@tiptap/core';

export interface SourceRef {
  /** 与 markdown `[^n]` 中的 n 对齐（字符串，如 `"1"`）。 */
  index: string;
  url?: string;
  title?: string;
  /** 原文片段等；库本身不渲染 Popover，留给消费方。 */
  excerpt?: string;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 将 markdown 中能匹配到 `sources` 的 `[^n]` 换成带 data-* 的
 * `<span class="citation-ref">`（**不是** `<sup>`，避免被 Superscript 吃掉、
 * 也避免视觉上标）。未匹配的 `[^n]` 原样保留，留给 CitationRef tokenizer。
 *
 * 浏览器端 @tiptap/markdown 可解析内联 HTML；server 端无 DOMParser 时请改用
 * {@link applyCitationSources}（先 parse 再补 attrs）。
 */
export function enrichMarkdownCitations(
  markdown: string,
  sources: SourceRef[],
): string {
  if (!sources.length) return markdown;

  return markdown.replace(/\[\^(\d+)\]/g, (match, num: string) => {
    const source = sources.find((s) => s.index === num);
    if (!source) return match;

    const attrs = [`class="citation-ref"`, `data-index="${num}"`];
    if (source.url) attrs.push(`data-url="${escapeAttr(source.url)}"`);
    if (source.title) attrs.push(`data-title="${escapeAttr(source.title)}"`);

    if (source.url) {
      return `<span ${attrs.join(' ')}><a href="${escapeAttr(source.url)}" title="${escapeAttr(source.title || '')}" target="_blank" rel="noopener">${num}</a></span>`;
    }
    return `<span ${attrs.join(' ')}>${num}</span>`;
  });
}

function patchCitationNode(
  node: JSONContent,
  byIndex: Map<string, SourceRef>,
): JSONContent {
  if (node.type === 'citationRef') {
    const index = String(node.attrs?.index ?? '');
    const source = byIndex.get(index);
    if (!source) return node;
    return {
      ...node,
      attrs: {
        ...node.attrs,
        index,
        url: source.url ?? node.attrs?.url ?? null,
        title: source.title ?? node.attrs?.title ?? null,
      },
    };
  }

  if (!node.content?.length) return node;
  return {
    ...node,
    content: node.content.map((child) => patchCitationNode(child, byIndex)),
  };
}

/**
 * 在已 parse 的 Tiptap JSON 上，按 `sources` 给 `citationRef` 节点补 url/title。
 * SSR / 无 DOMParser 环境的首选路径。
 */
export function applyCitationSources(
  doc: JSONContent,
  sources: SourceRef[],
): JSONContent {
  if (!sources.length) return doc;
  const byIndex = new Map(sources.map((s) => [s.index, s]));
  return patchCitationNode(doc, byIndex);
}
