import type { ReactNode } from 'react';
import type { CommentSegment } from './commentMapper';

/** 宿主评论（已解码为 segments；ref_content 解码由宿主完成）。 */
export interface CommentRef {
  commentId: string;
  /** 评论作者类型：agent / user（宿主用于配色等）。 */
  author?: 'agent' | 'user';
  /** 决议状态：open / resolved / dismissed。 */
  state?: 'open' | 'resolved' | 'dismissed';
  /** 与正文对齐的锚定片段（编辑器装载时映射为 mark 区间）。 */
  segments: CommentSegment[];
  /** 评论正文（宿主展示用，库不消费）。 */
  body?: string;
  user?: { name?: string; avatar?: string };
}

/** CommentPopover 内容插槽上下文。 */
export interface RenderCommentContext {
  comment: CommentRef;
  /** 锚定的评论 id（多条重叠时取第一条）。 */
  commentId: string;
}

export type RenderComment = (ctx: RenderCommentContext) => ReactNode;

/** 编辑器内点击评论 mark / gutter 时上报给宿主的载荷。 */
export interface CommentClickPayload {
  commentIds: string[];
  /** mark 元素（gutter 点击为 null）。 */
  anchorEl: HTMLElement | null;
  /** 点击位置的 doc 坐标。 */
  pos: number;
}
