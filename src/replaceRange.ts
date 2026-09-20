import '@tiptap/markdown';
import type { Editor } from '@tiptap/react';
import { prepareChartMarkdown } from './chart/prepareChartMarkdown';
import { enrichMarkdownCitations, type SourceRef } from './citationUtils';
import { splitTopLevelBlocks, stripToPlainText } from './insertMarkdown';

export interface ReplaceRangeOptions {
  /** 脚注来源：把 `[^n]` enrich 成带 url/title 的 citation-ref（与 `insertMarkdown` 同一套）。 */
  sources?: SourceRef[];
}

/**
 * 用一段 markdown **替换**一个区间。给「后台回填」用——AI 在别处改完，把结果写回编辑器。
 *
 * 与 `insertMarkdown` 的三处刻意差异（都在注释里点明，改的时候别抹平）：
 *
 * 1. **不抢焦点**。`insertMarkdown` 是「用户主动插入」，链式带了 `.focus()`；后台回填时
 *    用户可能正在别处打字，抢焦点等于打断他。所以这里直接调 `insertContentAt`。
 * 2. **按区间替换**，不是往光标处插（`insertContentAt` 收 `{from,to}` 时后者即替换）。
 * 3. **进 undo 历史**。`insertContentAt` 本身是一个 transaction，撤销一步就回去；
 *    与评论锚定的 `addToHistory: false` 相反——正文改动必须能撤。
 *
 * 解析失败（AI 的脏输出过不了 schema：嵌套 bold、块级图进 listItem …）时按块降级，
 * 与 `insertMarkdown` 同一套策略。注意降级路径是**逐块多次 transaction**，撤销要多按几下；
 * 只在整段失败时才走。
 *
 * @returns 是否改动了文档。空 markdown 返回 `false`（不静默删掉用户的内容）。
 */
export function replaceRangeWithMarkdown(
  editor: Editor,
  range: { from: number; to: number },
  markdown: string,
  options: ReplaceRangeOptions = {},
): boolean {
  const prepared = prepareChartMarkdown(
    enrichMarkdownCitations(markdown ?? '', options.sources ?? []),
  );
  if (!prepared.trim()) return false;

  let from = Math.max(0, Math.min(range.from, range.to));
  let to = Math.max(range.from, range.to);
  if (from === to) return false;

  // ① 整段替换：一个 transaction，撤销一步到位
  if (tryInsertMarkdownAt(editor, from, to, prepared)) return true;

  // ② 降级：逐块替换。块插完要往后挪插入点，否则每块都往同一个区间插、只剩最后一块
  for (const block of splitTopLevelBlocks(prepared)) {
    const before = editor.state.doc.content.size;
    const changed =
      tryInsertMarkdownAt(editor, from, to, block) ||
      insertPlainParagraphAt(editor, from, to, stripToPlainText(block));
    if (!changed) continue;
    // 插入内容的 doc 尺寸 = 文档增量 + 被替换掉的宽度
    const inserted = editor.state.doc.content.size - before + (to - from);
    from += inserted;
    to = from;
  }
  return true;
}

/** 注意：不带 `.focus()`——后台回填不能抢用户的焦点。 */
function tryInsertMarkdownAt(
  editor: Editor,
  from: number,
  to: number,
  markdown: string,
): boolean {
  try {
    return editor
      .chain()
      .insertContentAt({ from, to }, markdown, { contentType: 'markdown' })
      .run();
  } catch {
    return false;
  }
}

function insertPlainParagraphAt(
  editor: Editor,
  from: number,
  to: number,
  text: string,
): boolean {
  try {
    return editor
      .chain()
      .insertContentAt(
        { from, to },
        { type: 'paragraph', content: text ? [{ type: 'text', text }] : [] },
      )
      .run();
  } catch {
    return false;
  }
}
