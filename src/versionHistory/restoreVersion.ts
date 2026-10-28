import type { Editor } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { normalizeMarkdown } from '../normalizeMarkdown';

/**
 * 把一版 markdown 写回编辑器，单独占一步撤销。
 * `closeHistory` 把这一步和刚才的输入切开，撤销一次回到恢复前，而不是更早。
 */
export function restoreVersionMarkdown(editor: Editor, markdown: string): void {
  editor
    .chain()
    .command(({ tr }) => {
      closeHistory(tr);
      return true;
    })
    .setContent(markdown, { contentType: 'markdown' })
    .run();
}

/**
 * 两边都按编辑器读入再吐出的写法比较。表格对齐空格不算不同。
 * 编辑器尾部那个空段会多吐一个换行，存库的正文通常没有它，这里剥掉文末换行再比。
 */
export function isSameVersionMarkdown(current: string, markdown: string): boolean {
  return comparable(current) === comparable(markdown);
}

function comparable(markdown: string): string {
  return normalizeMarkdown(markdown).replace(/\n+$/, '');
}
