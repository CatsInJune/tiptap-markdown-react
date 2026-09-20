import type { Editor } from '@tiptap/react';
import {
  mapCommentAnchors,
  type CommentAnchorStatus,
  type CommentSegment,
} from './commentAnchor/commentMapper';

/**
 * 内容锚点 → 当前文档里的区间。
 *
 * 用途：宿主在提交一次「圈选改写」时记下选区的内容锚点（`prefix` / `exact` / `suffix`，
 * `blockHash` 可选），等 AI 改完、推送回来时再用它把那段区间找回来——**不能用位置**，
 * 因为编辑器在这期间可能整体重建过（保存、切卡、SWR 刷新都会重挂），位置活不过重建。
 *
 * 锚点类型直接复用评论锚定那套（`commentMapper`），匹配走同一条 fallback 链：
 * `blockHash` → 前后文 → `exact` → 前缀降级（前 20 字）。**这条链是会降级的**，所以：
 *
 * > 调用方必须自己比对返回的 `text` 是否仍等于提交时那一段。本函数只回答「在哪」，
 * > 不回答「还算不算同一段」——后者决定了是原地回填还是弹冲突。
 */
export interface AnchorRange {
  /** doc 坐标 */
  from: number;
  to: number;
  /** 区间当前对应的纯文本（块间用 `\n\n` 连接，与选区文本同一口径）。 */
  text: string;
  status: CommentAnchorStatus;
}

/** 探针 id：借 commentMapper 的匹配链路，但我们只要区间，不要评论语义。 */
const PROBE_ID = '__anchor-range-probe__';

export function findRangeByAnchor(
  editor: Editor,
  anchor: CommentSegment | null | undefined,
): AnchorRange | null {
  if (!anchor || !anchor.exact) return null;

  const [result] = mapCommentAnchors(editor.state.doc, [
    { commentId: PROBE_ID, segments: [anchor] },
  ]);
  const range = result?.ranges[0];
  if (!range) return null;

  return {
    from: range.from,
    to: range.to,
    text: editor.state.doc.textBetween(range.from, range.to, '\n\n'),
    status: result.status,
  };
}
