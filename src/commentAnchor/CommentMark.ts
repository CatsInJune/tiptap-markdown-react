import { Mark, mergeAttributes } from '@tiptap/core';

/**
 * 评论锚定 mark —— 仅存在于编辑会话内，导出 markdown 时剥离。
 *
 * - attrs.commentIds：string[]。ProseMirror 同一文本节点不能挂两个同名
 *   mark，重叠评论由 commentMapper 合并成「区间 + commentIds[]」后一次性铺入。
 * - renderMarkdown 返回空串 → getMarkdown() 输出纯文本，评论数据不落库。
 * - 粘贴/拖拽拦截与 gutter / active 装饰见 commentAnchorPlugin（客户端）。
 *   本模块保持纯 schema，server 入口可安全导入。
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentAnchor: {
      /** 按互不相交的区间 + commentIds 数组铺评论 mark（区间由 mergeCommentIntervals 产出）。 */
      applyCommentAnchors: (intervals: CommentInterval[]) => ReturnType;
      /** 清空全文档评论 mark（comments 刷新 / 退出编辑态前调用）。 */
      clearCommentAnchors: () => ReturnType;
    };
  }
}

export interface CommentInterval {
  from: number;
  to: number;
  commentIds: string[];
}

export interface CommentMarkOptions {
  HTMLAttributes: Record<string, unknown>;
}

export const CommentMark = Mark.create<CommentMarkOptions>({
  name: 'commentAnchor',

  // 评论是「引用快照」：光标在区间边界输入不应自动扩展高亮。
  inclusive: false,
  // 与加粗/斜体等格式可共存。
  excludes: '',

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      commentIds: {
        default: [] as string[],
        parseHTML: (element) =>
          (element.getAttribute('data-comment-ids') ?? '')
            .split(' ')
            .filter(Boolean),
        renderHTML: (attributes) => {
          const ids = attributes.commentIds as string[];
          return ids?.length
            ? { 'data-comment-ids': Array.from(new Set(ids)).join(' ') }
            : {};
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'mark[data-comment-ids]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'mark',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'tmr-comment',
      }),
      0,
    ];
  },

  // 关键契约：markdown 输出剥离评论 mark，落库内容永远干净。
  // 注意：@tiptap/markdown 的 registerExtension 以扩展 name 注册 renderMarkdown，
  // 无需（也不支持）markdownName 字段。
  renderMarkdown() {
    return '';
  },

  addCommands() {
    return {
      applyCommentAnchors:
        (intervals) =>
        ({ tr, dispatch }) => {
          const intervals_ = (intervals ?? []).filter(
            (iv) => iv.from < iv.to && iv.commentIds.length > 0,
          );
          if (intervals_.length === 0) return false;
          let next = tr;
          for (const iv of intervals_) {
            next = next.addMark(
              iv.from,
              iv.to,
              this.type.create({ commentIds: iv.commentIds }),
            );
          }
          // 锚定是会话级 UI，不是用户内容：不进 undo 历史，避免 Ctrl+Z 把
          // 高亮全部撤掉。真编辑（改字）仍可正常 undo。
          next.setMeta('addToHistory', false);
          if (dispatch) dispatch(next);
          return true;
        },
      clearCommentAnchors:
        () =>
        ({ tr, dispatch }) => {
          const markType = this.type;
          const ranges: Array<{ from: number; to: number }> = [];
          tr.doc.descendants((node, pos) => {
            if (node.isText && node.marks.some((m) => m.type === markType)) {
              ranges.push({ from: pos, to: pos + node.nodeSize });
            }
            return true;
          });
          // 无 mark 时视为成功（no-op），保证 chain 后续命令继续执行。
          if (ranges.length === 0) return true;
          let next = tr;
          for (const r of ranges) next = next.removeMark(r.from, r.to, markType);
          next.setMeta('addToHistory', false);
          if (dispatch) dispatch(next);
          return true;
        },
    };
  },
});
