import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { closeHistory } from '@tiptap/pm/history';
import { normalizeMarkdown } from '../normalizeMarkdown';

/** 恢复可选项。宿主或面板知道版本所属章的首块 ID 时直接给，省一次解析。 */
export interface RestoreVersionOptions {
  /**
   * 版本所属章节的首块 ID。缺省时从版本 markdown 的第一条独立
   * `<!--b:...-->` 行推断（章内容以块 ID 注释开头）。
   */
  leadBlockId?: string | null;
}

/** 恢复落点：整篇替换（旧快照，无块 ID）/ 章范围替换 / 光标处插入（章已删）。 */
export type RestoreVersionResult =
  | { mode: 'replace-document' }
  | { mode: 'replace-chapter'; leadBlockId: string }
  | { mode: 'insert-at-cursor'; leadBlockId: string };

/**
 * 把一版 markdown 写回编辑器，单独占一步撤销。
 * `closeHistory` 把这一步和刚才的输入切开，撤销一次回到恢复前，而不是更早。
 *
 * 恢复语义（RFC §7.5 / 12.1）：
 * - 版本自带章首块 ID：在当前文档里定位该章范围（首块到下一个 H2 之前）→ 范围替换；
 * - 章已不在文档中（ID 找不到）→ 把版本内容插入当前光标处，返回 `insert-at-cursor`
 *   让面板提示用户；
 * - 旧快照没有块 ID → 保持旧语义，整篇替换。
 */
export function restoreVersionMarkdown(
  editor: Editor,
  markdown: string,
  options: RestoreVersionOptions = {},
): RestoreVersionResult {
  const leadBlockId = options.leadBlockId ?? readLeadBlockId(markdown);
  if (!leadBlockId) {
    replaceDocument(editor, markdown);
    return { mode: 'replace-document' };
  }
  const range = findChapterRange(editor.state.doc, leadBlockId);
  if (!range) {
    editor
      .chain()
      .command(({ tr }) => {
        closeHistory(tr);
        return true;
      })
      .insertContent(markdown, { contentType: 'markdown' })
      .run();
    return { mode: 'insert-at-cursor', leadBlockId };
  }
  editor
    .chain()
    .command(({ tr }) => {
      closeHistory(tr);
      return true;
    })
    .insertContentAt(range, markdown, { contentType: 'markdown' })
    .run();
  return { mode: 'replace-chapter', leadBlockId };
}

/**
 * 两边都按编辑器读入再吐出的写法比较。表格对齐空格不算不同。
 * 编辑器尾部那个空段会多吐一个换行，存库的正文通常没有它，这里剥掉文末换行再比。
 */
export function isSameVersionMarkdown(current: string, markdown: string): boolean {
  return comparable(current) === comparable(markdown);
}

/**
 * 从版本内容里读「章首块」的块 ID：只认第一个非空行上的独立 `<!--b:...-->` 注释。
 *
 * 只扫首行而不是全文，避免把章中间某个块的 ID 当成章首（否则范围替换会从章中间
 * 开始，误删前半章）。首个非空行如果是代码围栏或其他内容，直接返回 null——
 * 这也天然排除了 fence 内的伪注释（§7.1「fence / 注释外」解析规则）。
 */
export function readLeadBlockId(markdown: string): string | null {
  const lines = markdown.split(/\r?\n/);
  const firstNonEmpty = lines.find((line) => line.trim() !== '');
  if (firstNonEmpty === undefined) return null;
  const match = /^[ \t]*<!--b:([A-Za-z0-9_]+)-->[ \t]*$/.exec(firstNonEmpty);
  return match ? match[1] : null;
}

interface ChapterRange {
  from: number;
  to: number;
}

/**
 * 在顶层块里按块 ID 找章范围：从该块开始，到下一个 H2 之前（不含 H2），
 * 没有下一个 H2 则到文档尾。找不到该块返回 null。
 */
function findChapterRange(doc: PMNode, leadBlockId: string): ChapterRange | null {
  let offset = 0;
  let from = -1;
  for (let index = 0; index < doc.childCount; index += 1) {
    const node = doc.child(index);
    if (from < 0) {
      if (node.attrs.blockId === leadBlockId) from = offset;
    } else if (isLevelTwoHeading(node)) {
      return { from, to: offset };
    }
    offset += node.nodeSize;
  }
  return from < 0 ? null : { from, to: doc.content.size };
}

function isLevelTwoHeading(node: PMNode): boolean {
  return node.type.name === 'heading' && node.attrs.level === 2;
}

function replaceDocument(editor: Editor, markdown: string): void {
  editor
    .chain()
    .command(({ tr }) => {
      closeHistory(tr);
      return true;
    })
    .setContent(markdown, { contentType: 'markdown' })
    .run();
}

function comparable(markdown: string): string {
  return normalizeMarkdown(markdown).replace(/\n+$/, '');
}
