import '@tiptap/markdown';
import type { Editor } from '@tiptap/react';
import { prepareChartMarkdown } from './chart/prepareChartMarkdown';
import {
  enrichMarkdownCitations,
  type SourceRef,
} from './citationUtils';

/**
 * 在光标处插入 markdown 片段（封装 contentType: 'markdown'）。
 * 传入 `sources` 时会先 enrich `[^n]` → 带 url 的 citation-ref，再插入。
 *
 * 整段过不了 schema（嵌套 bold、块级图进 listItem 等）时按块重试，
 * 单块仍挂则剥标记当段落。某一处脏输出不至于整次插入失败。
 */
export function insertMarkdown(
  editor: Editor,
  markdown: string,
  sources: SourceRef[] = [],
): void {
  const prepared = prepareChartMarkdown(
    enrichMarkdownCitations(markdown, sources),
  );
  if (!prepared) return;
  if (tryInsertMarkdown(editor, prepared)) return;
  for (const block of splitTopLevelBlocks(prepared)) {
    if (tryInsertMarkdown(editor, block)) continue;
    insertPlainParagraph(editor, stripToPlainText(block));
  }
}

function tryInsertMarkdown(editor: Editor, markdown: string): boolean {
  try {
    return editor
      .chain()
      .focus()
      .insertContent(markdown, { contentType: 'markdown' })
      .run();
  } catch {
    return false;
  }
}

function insertPlainParagraph(editor: Editor, text: string): void {
  if (!text) return;
  editor
    .chain()
    .focus()
    .insertContent({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    })
    .run();
}

/** 围栏代码整块留下，其余按空行切。 */
export function splitTopLevelBlocks(markdown: string): string[] {
  const out: string[] = [];
  for (const [i, part] of markdown.split(/(```[\s\S]*?```)/).entries()) {
    if (!part) continue;
    if (i % 2 === 1) {
      out.push(part);
      continue;
    }
    for (const block of part.split(/\n{2,}/)) {
      if (block.trim()) out.push(block);
    }
  }
  return out;
}

export function stripToPlainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[ \t]*[-*+]\s+/gm, '')
    .replace(/^[ \t]*\d+\.\s+/gm, '')
    .replace(/[*_~`]+/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
