/**
 * 评论锚定客户端插件：
 * - 装饰：block 左缘 gutter 气泡（showGutter）、active 评论的 mark/block 高亮；
 * - 交互：点击 mark / gutter 通过 transaction meta 上报（宿主经 editor.on('transaction')
 *   接收，规避扩展创建时闭包 stale 的问题）；
 * - 守卫：粘贴 / 拖拽的 slice 剥离 commentAnchor mark，防止幽灵高亮。
 *
 * 只读态（MarkdownPreview）不注入本插件、不接评论 —— 评论是编辑会话专属。
 */

import {
  Fragment,
  Slice,
  type MarkType,
  type Node as PMNode,
} from '@tiptap/pm/model';
import { Extension } from '@tiptap/core';
import {
  Plugin,
  PluginKey,
  type EditorState,
} from '@tiptap/pm/state';
import {
  Decoration,
  DecorationSet,
  type EditorView,
} from '@tiptap/pm/view';
import type { CommentClickPayload } from './commentTypes';

export const COMMENT_ACTIVE_META = 'tmr:comment:active';
export const COMMENT_CLICK_META = 'tmr:comment:click';
export const COMMENT_GUTTER_META = 'tmr:comment:gutter';

export interface CommentGutterPayload {
  commentIds: string[];
  pos: number;
}

export interface CommentAnchorPluginOptions {
  /** 是否在 block 左缘渲染评论 gutter 气泡，默认 true。 */
  showGutter?: boolean;
  /**
   * 编辑器内点 mark 是否参与交互（默认 true：设 active + 上报 click meta）。
   * 设 false 后点击 mark 完全惰性（不设 active、不上报），适合「只靠侧栏单项
   * 驱动滚动定位」的宿主。
   */
  interactive?: boolean;
}

export interface CommentAnchorPluginState {
  activeCommentId: string | null;
}

export const commentAnchorPluginKey = new PluginKey<CommentAnchorPluginState>(
  'tmrCommentAnchor',
);

/** 从 Slice 中剔除 commentAnchor mark（粘贴/拖拽守卫）。 */
export function stripCommentAnchorMarks(
  slice: Slice,
  markType: MarkType,
): Slice {
  const strip = (fragment: Fragment): Fragment => {
    const children: PMNode[] = [];
    fragment.forEach((child) => {
      if (child.isText && child.marks.some((m) => m.type === markType)) {
        children.push(
          child.mark(child.marks.filter((m) => m.type !== markType)),
        );
      } else if (child.content.size > 0) {
        children.push(child.copy(strip(child.content)));
      } else {
        children.push(child);
      }
    });
    return Fragment.fromArray(children);
  };
  return new Slice(strip(slice.content), slice.openStart, slice.openEnd);
}

function sliceHasCommentMarks(slice: Slice, markType: MarkType): boolean {
  let found = false;
  slice.content.descendants((node) => {
    if (node.isText && node.marks.some((m) => m.type === markType)) {
      found = true;
      return false;
    }
    return true;
  });
  return found;
}

/** 顶层 block 边界。 */
function blockBounds(doc: PMNode): Array<{ start: number; end: number }> {
  const bounds: Array<{ start: number; end: number }> = [];
  doc.forEach((child, offset) => {
    bounds.push({ start: offset, end: offset + child.nodeSize });
  });
  return bounds;
}

/** commentId → 文本区间（从 doc 内 commentAnchor mark 收集）。 */
function collectCommentRanges(
  doc: PMNode,
): Map<string, Array<{ from: number; to: number }>> {
  const byId = new Map<string, Array<{ from: number; to: number }>>();
  doc.descendants((node, pos) => {
    if (!node.isText) return true;
    for (const m of node.marks) {
      if (m.type.name !== 'commentAnchor') continue;
      const ids = (m.attrs.commentIds as string[]) ?? [];
      for (const id of ids) {
        const arr = byId.get(id) ?? [];
        arr.push({ from: pos, to: pos + node.nodeSize });
        byId.set(id, arr);
      }
    }
    return true;
  });
  return byId;
}

function rangesIntersectBlock(
  ranges: Array<{ from: number; to: number }>,
  start: number,
  end: number,
): boolean {
  return ranges.some((r) => r.from < end && r.to > start);
}

function gutterDom(
  commentIds: string[],
  view: EditorView,
  blockPos: number,
): HTMLElement {
  const el = document.createElement('span');
  el.className = 'tmr-comment-gutter';
  el.setAttribute('data-comment-ids', commentIds.join(' '));
  el.textContent = String(commentIds.length);
  el.title = `${commentIds.length}`;
  // 不抢编辑器焦点/选区
  el.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  el.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    view.dispatch(
      view.state.tr
        .setMeta(COMMENT_ACTIVE_META, commentIds[0] ?? null)
        .setMeta(COMMENT_GUTTER_META, {
          commentIds,
          pos: blockPos,
        } satisfies CommentGutterPayload),
    );
  });
  return el;
}

export function commentAnchorPlugin(
  options: CommentAnchorPluginOptions = {},
): Plugin<CommentAnchorPluginState> {
  const showGutter = options.showGutter !== false;
  const interactive = options.interactive !== false;

  return new Plugin<CommentAnchorPluginState>({
    key: commentAnchorPluginKey,
    state: {
      init: () => ({ activeCommentId: null }),
      apply: (tr, value) => {
        const active = tr.getMeta(COMMENT_ACTIVE_META);
        return active !== undefined
          ? { activeCommentId: active as string | null }
          : value;
      },
    },
    props: {
      decorations(state: EditorState) {
        const byId = collectCommentRanges(state.doc);
        if (byId.size === 0) return DecorationSet.empty;

        const decos: Decoration[] = [];
        const bounds = blockBounds(state.doc);

        if (showGutter) {
          for (const b of bounds) {
            const idsInBlock: string[] = [];
            for (const [id, ranges] of byId) {
              if (rangesIntersectBlock(ranges, b.start, b.end)) {
                idsInBlock.push(id);
              }
            }
            if (idsInBlock.length > 0) {
              decos.push(
                Decoration.widget(
                  b.start,
                  (view) => gutterDom(idsInBlock, view, b.start),
                  { side: -1, key: `tmr-gutter:${b.start}` },
                ),
              );
            }
          }
        }

        const activeId =
          commentAnchorPluginKey.getState(state)?.activeCommentId ?? null;
        if (activeId) {
          const ranges = byId.get(activeId) ?? [];
          for (const r of ranges) {
            decos.push(
              Decoration.inline(r.from, r.to, { class: 'tmr-comment-active' }),
            );
          }
          for (const b of bounds) {
            if (rangesIntersectBlock(ranges, b.start, b.end)) {
              decos.push(
                Decoration.node(b.start, b.end, {
                  class: 'tmr-comment-block-active',
                }),
              );
            }
          }
        }

        return DecorationSet.create(state.doc, decos);
      },

      handleClick(view: EditorView, pos: number, event: MouseEvent) {
        // 惰性模式：编辑器内点击 mark 不产生任何交互（侧栏单项驱动）。
        if (!interactive) return false;
        const target = event.target as Element | null;
        const el = target?.closest?.(
          'mark.tmr-comment[data-comment-ids]',
        ) as HTMLElement | null;
        if (!el) return false;
        const commentIds = (el.getAttribute('data-comment-ids') ?? '')
          .split(' ')
          .filter(Boolean);
        if (commentIds.length === 0) return false;
        view.dispatch(
          view.state.tr
            .setMeta(COMMENT_ACTIVE_META, commentIds[0] ?? null)
            .setMeta(COMMENT_CLICK_META, {
              commentIds,
              anchorEl: el,
              pos,
            } satisfies CommentClickPayload),
        );
        return true;
      },

      // 粘贴 / 拖拽 / 编辑器内拖动的 slice 统一走这里：剥离评论 mark，
      // 防止复制粘贴产生幽灵高亮。正文内容不变，只是丢掉会话级元数据。
      transformPasted(slice: Slice, view: EditorView) {
        const markType = view.state.schema.marks.commentAnchor;
        if (!markType || !sliceHasCommentMarks(slice, markType)) return slice;
        return stripCommentAnchorMarks(slice, markType);
      },
    },
  });
}

/**
 * Tiptap Extension 包装：把评论锚定 Plugin 挂进 useEditor / Editor 的 extensions。
 * 只读态（MarkdownPreview）不要注入本扩展 —— 评论是编辑会话专属。
 */
export function commentAnchorExtension(
  options: CommentAnchorPluginOptions = {},
) {
  return Extension.create({
    name: 'tmrCommentAnchor',
    addProseMirrorPlugins() {
      return [commentAnchorPlugin(options)];
    },
  });
}
