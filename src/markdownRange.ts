import '@tiptap/markdown';
import type { JSONContent } from '@tiptap/core';
import type { Editor } from '@tiptap/react';

/**
 * 取区间对应的 markdown，并给出它在 `editor.getMarkdown()` 输出里的精确偏移。
 *
 * 为什么需要它：后端改卡走的是「在正文里逐字找到这段，替换」（`replace_in_text` +
 * `count=1`），所以发过去的那段必须是**存库正文的逐字子串**；调用方还要知道它在整篇里
 * 的偏移，才能从存库正文取前后文（`ref`）并界定「这次改了哪一段」。官方 OSS 只有整篇
 * `Editor.getMarkdown()`；官方 Pro 的 `getMarkdownRange` 只返回字符串、不给偏移，也不做
 * 块扩展。
 *
 * **默认扩块**（`expandToBlocks: true`）：把区间扩展到与它相交的顶层块的首尾。一是序列化
 * 稳定（半句话里跨着加粗，片段序列化会在断口插入多余的 `**`），二是**只有块对齐时偏移才是
 * 算出来的，而不是猜出来的**。
 *
 * 偏移怎么来的：把 doc 的顶层块逐个序列化、用 `\n\n` 拼起来，等于整篇序列化（有测试钉住
 * 这条不变量），于是「前 i 块拼接的长度」就是第 i 块的起点偏移。这条不变量若在某篇文档上
 * 不成立，退回按内容在整篇里定位；定位不到或出现多处就返回 `null`——宁可让调用方知道
 * 拿不到偏移，也不要给一个错的。
 */
export interface MarkdownRange {
  /** 区间对应的 markdown 片段（扩块后）。 */
  markdown: string;
  /** 片段在 `editor.getMarkdown()` 输出里的起始偏移。 */
  from: number;
  /** 结束偏移（不含）。恒有 `to - from === markdown.length`。 */
  to: number;
}

export interface GetMarkdownForRangeOptions {
  /**
   * 是否把区间扩展到与它相交的顶层块（段落 / 表格 / 列表 / 图表 …）的首尾。
   * 默认 `true`：调用方要「存库正文的逐字子串 + 精确偏移」时应该保持默认。
   * 设 `false` 按原区间取，此时偏移依赖内容定位，可能返回 `null`。
   */
  expandToBlocks?: boolean;
}

/** 顶层块之间的分隔符——与 MarkdownManager 的 doc 级拼接一致。 */
const BLOCK_SEPARATOR = '\n\n';

interface TopLevelBlock {
  json: JSONContent;
  /** doc 坐标 */
  from: number;
  to: number;
}

function topLevelBlocks(editor: Editor): TopLevelBlock[] {
  const blocks: TopLevelBlock[] = [];
  editor.state.doc.forEach((node, offset) => {
    blocks.push({
      json: node.toJSON() as JSONContent,
      from: offset,
      to: offset + node.nodeSize,
    });
  });
  return blocks;
}

export function getMarkdownForRange(
  editor: Editor,
  from: number,
  to: number,
  options: GetMarkdownForRangeOptions = {},
): MarkdownRange | null {
  const manager = editor.markdown;
  if (!manager) return null;

  const size = editor.state.doc.content.size;
  let start = Math.max(0, Math.min(from, to));
  let end = Math.min(size, Math.max(from, to));
  if (start >= end) return null;

  const blocks = topLevelBlocks(editor);
  if (blocks.length === 0) return null;

  const expand = options.expandToBlocks !== false;

  // 与 [start, end) 相交的顶层块：第一个末端越过 start 的、到最后一个起点早于 end 的。
  // 单元格内、列表项内的选区都会扩到它们所属的顶层块（表格 / 列表整体）。
  let first = 0;
  let last = blocks.length - 1;
  if (expand) {
    first = blocks.findIndex((b) => b.to > start);
    if (first < 0) return null;
    for (let i = blocks.length - 1; i >= first; i -= 1) {
      if (blocks[i].from < end) {
        last = i;
        break;
      }
    }
    start = blocks[first].from;
    end = blocks[last].to;
  }

  const parts = blocks.map((b) => manager.serialize({ type: 'doc', content: [b.json] }));
  const full = editor.getMarkdown();

  if (expand && parts.join(BLOCK_SEPARATOR) === full) {
    const markdown = parts.slice(first, last + 1).join(BLOCK_SEPARATOR);
    // 空段落拼出来是空串：语义上等于「这段没内容」，交给调用方去判空不如这里就返回 null
    if (!markdown) return null;
    const at =
      first === 0
        ? 0
        : parts.slice(0, first).join(BLOCK_SEPARATOR).length + BLOCK_SEPARATOR.length;
    return { markdown, from: at, to: at + markdown.length };
  }

  // 非块对齐，或整篇拼接与 getMarkdown() 不一致：只能按内容定位，且必须唯一
  const markdown = manager.serialize(
    editor.state.doc.cut(start, end).toJSON() as JSONContent,
  );
  if (!markdown) return null;
  const at = full.indexOf(markdown);
  if (at < 0 || full.indexOf(markdown, at + 1) >= 0) return null;
  return { markdown, from: at, to: at + markdown.length };
}
