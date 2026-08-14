/**
 * 编辑会话内的评论锚定控制器（纯函数，供宿主 / 组件 handle 复用）。
 *
 * 职责：
 * - applyCommentAnchorsToEditor：comments 装载时把 segments 映射成 mark 铺入 doc；
 * - focusComment / nextComment：active 状态 + 滚动 + 选区；
 * - collectCommentIds / commentRangesById：供宿主查询。
 */

import type { Editor } from '@tiptap/core';
import {
  COMMENT_ACTIVE_META,
  commentAnchorPluginKey,
} from './commentAnchorPlugin';
import {
  mapCommentAnchors,
  mergeCommentIntervals,
  type CommentRange,
} from './commentMapper';
import type { CommentRef } from './commentTypes';

/** 先清后铺，幂等；无评论时清空全部 mark。 */
export function applyCommentAnchorsToEditor(
  editor: Editor,
  comments: CommentRef[],
): void {
  // 只读态不接评论（库契约：评论锚定 = 编辑会话专属）。
  if (!editor.isEditable) return;
  const intervals =
    comments.length > 0
      ? mergeCommentIntervals(
          mapCommentAnchors(
            editor.state.doc,
            comments.map((c) => ({ commentId: c.commentId, segments: c.segments })),
          ).map((r) => ({ commentId: r.commentId, ranges: r.ranges })),
        )
      : [];
  const chain = editor.chain().clearCommentAnchors();
  if (intervals.length > 0) chain.applyCommentAnchors(intervals);
  chain.run();
}

/** 文档顺序去重的 commentId 列表（gutter / 导航顺序）。 */
export function collectCommentIds(editor: Editor): string[] {
  const ids: string[] = [];
  editor.state.doc.descendants((node) => {
    if (!node.isText) return true;
    for (const m of node.marks) {
      if (m.type.name !== 'commentAnchor') continue;
      for (const id of (m.attrs.commentIds as string[]) ?? []) {
        if (!ids.includes(id)) ids.push(id);
      }
    }
    return true;
  });
  return ids;
}

export function commentRangesById(
  editor: Editor,
  commentId: string,
): CommentRange[] {
  const ranges: CommentRange[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return true;
    for (const m of node.marks) {
      if (m.type.name !== 'commentAnchor') continue;
      const ids = (m.attrs.commentIds as string[]) ?? [];
      if (ids.includes(commentId)) {
        ranges.push({ from: pos, to: pos + node.nodeSize });
      }
    }
    return true;
  });
  return ranges;
}

function setActive(editor: Editor, commentId: string | null): void {
  editor.view.dispatch(
    editor.state.tr.setMeta(COMMENT_ACTIVE_META, commentId),
  );
}

function getActive(editor: Editor): string | null {
  return commentAnchorPluginKey.getState(editor.state)?.activeCommentId ?? null;
}

/**
 * 聚焦某条评论：设置 active（mark/block 高亮）+ 滚动到第一个 mark + 光标落到
 * 区间起点。找不到（outdated）时清空 active 并返回 false。
 */
export function focusComment(editor: Editor, commentId: string): boolean {
  const ranges = commentRangesById(editor, commentId);
  if (ranges.length === 0) {
    setActive(editor, null);
    return false;
  }
  setActive(editor, commentId);
  const markEl = editor.view.dom.querySelector<HTMLElement>(
    `mark.tmr-comment[data-comment-ids~="${CSS.escape(commentId)}"]`,
  );
  markEl?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  editor.chain().setTextSelection(ranges[0].from).run();
  return true;
}

/** 按文档顺序在评论间循环跳转（dir: next / prev）。 */
export function nextComment(
  editor: Editor,
  dir: 'next' | 'prev' = 'next',
): string | null {
  const ids = collectCommentIds(editor);
  if (ids.length === 0) return null;
  const active = getActive(editor);
  const current = active ? ids.indexOf(active) : -1;
  const nextIdx =
    dir === 'next'
      ? (current + 1) % ids.length
      : (current - 1 + ids.length) % ids.length;
  const target = ids[nextIdx];
  focusComment(editor, target);
  return target;
}
