import '@tiptap/markdown';
import type { Editor } from '@tiptap/react';

/** 在光标处插入 markdown 片段（封装 contentType: 'markdown'）。 */
export function insertMarkdown(editor: Editor, markdown: string): void {
  editor.chain().focus().insertContent(markdown, { contentType: 'markdown' }).run();
}
