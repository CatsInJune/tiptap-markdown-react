import { BlockMath, InlineMath } from '@tiptap/extension-mathematics';
import type { Node as PMNode } from '@tiptap/pm/model';
import katex from 'katex';

const KATEX_OPTIONS = { throwOnError: false as const };

export type MathKind = 'inline' | 'block';

export interface MathClickPayload {
  kind: MathKind;
  pos: number;
  latex: string;
}

type MathClickListener = (payload: MathClickPayload) => void;

let mathClickListener: MathClickListener | null = null;

/** 编辑器工具栏注册点击公式回调；未注册时点击无操作（预览 / SSR）。 */
export function subscribeMathClick(listener: MathClickListener): () => void {
  mathClickListener = listener;
  return () => {
    if (mathClickListener === listener) mathClickListener = null;
  };
}

function emitClick(kind: MathKind, node: PMNode, pos: number) {
  mathClickListener?.({
    kind,
    pos,
    latex: String(node.attrs.latex ?? ''),
  });
}

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
  onClick: (node, pos) => emitClick('inline', node, pos),
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
  onClick: (node, pos) => emitClick('block', node, pos),
});
