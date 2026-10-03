import type { Editor, Range } from '@tiptap/core';
import { prepareChartMarkdown } from '../chart/prepareChartMarkdown';
import { insertMarkdown } from '../insertMarkdown';

/**
 * 斜杠命令项插入 markdown 的共享原语：同一条 chain 内先删触发词再插内容，
 * 撤销是一步。整段过不了 schema 时降级为「按块重试 + 剥标记当段落」
 * （复用 insertMarkdown 的降级路径）——那条路径里删除已单独成事务，
 * 撤销会是多步，但注册表项是受控 markdown，正常不会走到。
 */
export function insertSlashMarkdown(
  editor: Editor,
  range: Range,
  markdown: string,
): void {
  const prepared = prepareChartMarkdown(markdown);
  if (!prepared) return;
  try {
    const ok = editor
      .chain()
      .focus()
      .deleteRange(range)
      .insertContent(prepared, { contentType: 'markdown' })
      .run();
    if (ok) return;
  } catch {
    // 整段过不了 schema：走降级
  }
  editor.chain().focus().deleteRange(range).run();
  insertMarkdown(editor, prepared);
}
