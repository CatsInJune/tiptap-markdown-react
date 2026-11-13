import { BlockMath, InlineMath } from '@tiptap/extension-mathematics';
import katex from 'katex';

const KATEX_OPTIONS = { throwOnError: false as const };

export type MathKind = 'inline' | 'block';

/**
 * 官方 NodeView 只在配置了 `onClick` 时才挂自己的 click 处理器（并 preventDefault /
 * stopPropagation）。点击编辑由编辑器层的 `<MathEditingLayer>` 接管；这里保留空回调，
 * 只为维持原来的点击行为，不再向工具栏派发事件。
 */
const KEEP_NODE_VIEW_CLICK = () => {};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** KaTeX HTML 片段（SSR / 预览弹层）。失败时回退为转义原文。 */
export function renderMathHtml(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex ?? '', {
      ...KATEX_OPTIONS,
      displayMode,
    });
  } catch {
    return escapeHtml(latex ?? '');
  }
}

/** 把公式画进已有节点（编辑态原地预览，避免再叠一份 overlay）。 */
export function renderMathInto(
  el: HTMLElement,
  latex: string,
  displayMode: boolean,
): void {
  try {
    katex.render(latex ?? '', el, { ...KATEX_OPTIONS, displayMode });
  } catch {
    el.textContent = latex ?? '';
  }
}

export function renderMathElementHtml(
  latex: string,
  displayMode: boolean,
): string {
  const inner = renderMathHtml(latex, displayMode);
  const attr = escapeHtml(latex ?? '');
  if (displayMode) {
    return `<div data-type="block-math" data-latex="${attr}" class="tiptap-mathematics-render">${inner}</div>`;
  }
  return `<span data-type="inline-math" data-latex="${attr}" class="tiptap-mathematics-render">${inner}</span>`;
}

/**
 * 行内公式：markdown 为 `$$latex$$`（单行、无换行）。
 * 关掉官方 `$…$` tokenizer 与 `$$` input rule——手打 `$` / `$$` 当字。
 */
export const reportInlineMath = InlineMath.extend({
  addInputRules() {
    return [];
  },

  renderMarkdown(node: { attrs?: { latex?: string } }) {
    return `$$${node.attrs?.latex || ''}$$`;
  },

  markdownTokenizer: {
    name: 'inlineMath',
    level: 'inline' as const,
    start(src: string) {
      return src.indexOf('$$');
    },
    tokenize(src: string) {
      const match = /^\$\$([^$\n]+?)\$\$/.exec(src);
      if (!match) return undefined;
      return {
        type: 'inlineMath',
        raw: match[0],
        latex: match[1].trim(),
      };
    },
  },
}).configure({
  katexOptions: { ...KATEX_OPTIONS, displayMode: false },
  onClick: KEEP_NODE_VIEW_CLICK,
});

/**
 * 块级公式：markdown 为带换行的 `$$\nlatex\n$$`。
 * 单行 `$$…$$` 不在这里匹配，交给行内。无 input rule。
 */
export const reportBlockMath = BlockMath.extend({
  addInputRules() {
    return [];
  },

  renderMarkdown(node: { attrs?: { latex?: string } }) {
    const latex = node.attrs?.latex || '';
    return `$$\n${latex}\n$$`;
  },

  markdownTokenizer: {
    name: 'blockMath',
    level: 'block' as const,
    start(src: string) {
      const match = /\$\$\r?\n/.exec(src);
      return match ? match.index : -1;
    },
    tokenize(src: string) {
      const match = /^\$\$\r?\n([\s\S]+?)\r?\n\$\$(?:\r?\n|$)/.exec(src);
      if (!match) return undefined;
      return {
        type: 'blockMath',
        raw: match[0],
        latex: match[1].trim(),
      };
    },
  },
}).configure({
  katexOptions: { ...KATEX_OPTIONS, displayMode: true },
  onClick: KEEP_NODE_VIEW_CLICK,
});
