import '@tiptap/markdown';
import type { Editor } from '@tiptap/react';
import {
  enrichMarkdownCitations,
  type SourceRef,
} from './citationUtils';

/**
 * 在光标处插入 markdown 片段（封装 contentType: 'markdown'）。
 * 传入 `sources` 时会先 enrich `[^n]` → 带 url 的 citation-ref，再插入。
 */
export function insertMarkdown(
  editor: Editor,
  markdown: string,
  sources: SourceRef[] = [],
): void {
  const prepared = enrichMarkdownCitations(markdown, sources);
  editor
    .chain()
    .focus()
    .insertContent(prepared, { contentType: 'markdown' })
    .run();
}
