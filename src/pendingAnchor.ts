import { Extension } from '@tiptap/core';
import { skipTrailingNodeMeta } from '@tiptap/extensions';
import type { Node } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Editor } from '@tiptap/react';

/**
 * 「这段正在被 AI 改写」的高亮。
 *
 * 用 **decoration** 而不是 mark：两者都不会漏进 markdown，都能盖住表格，但 decoration
 * 不需要往 schema 里加标记、也不参与 undo 历史，而且**原子节点（图表 / 图片）也能盖**
 * ——mark 只作用于行内内容，盖不住 `atom: true` 的块级节点。
 *
 * 状态由宿主通过 `pendingAnchors` 推入（提交圈选改写时给上，回填或冲突时清空）。
 * 文档被编辑时装饰会跟着映射（在原文中间插字，高亮跟着变长；在前面插，整体后移）。
 */
export interface PendingAnchor {
  /** 宿主自己的标识（例如一次圈选请求的 request_id）。 */
  id: string;
  /** doc 坐标区间；通常是与选区相交的顶层块的首尾（见 getMarkdownForRange）。 */
  ranges: Array<{ from: number; to: number }>;
}

export interface PendingAnchorState {
  decorations: DecorationSet;
}

/** 用 transaction meta 推入锚点：`tr.setMeta(PENDING_ANCHOR_META, anchors)`。 */
export const PENDING_ANCHOR_META = 'tmr:pendingAnchor';

export const pendingAnchorPluginKey = new PluginKey<PendingAnchorState>(
  'tmrPendingAnchor',
);

/** 装饰上的 class；点击命中时宿主用 `[data-pending-id]` 取回 id。 */
export const PENDING_ANCHOR_CLASS = 'tmr-pending-anchor';

export const pendingAnchorExtension = Extension.create({
  name: 'pendingAnchor',

  addProseMirrorPlugins() {
    return [
      new Plugin<PendingAnchorState>({
        key: pendingAnchorPluginKey,
        state: {
          init: () => ({ decorations: DecorationSet.empty }),
          apply(tr, value) {
            const next = tr.getMeta(PENDING_ANCHOR_META) as
              | PendingAnchor[]
              | undefined;
            if (next) return { decorations: buildDecorations(tr.doc, next) };
            if (tr.docChanged) {
              return { decorations: value.decorations.map(tr.mapping, tr.doc) };
            }
            return value;
          },
        },
        props: {
          decorations(state: EditorState) {
            return pendingAnchorPluginKey.getState(state)?.decorations ?? null;
          },
        },
      }),
    ];
  },
});

/** 更新待改写高亮（传空数组即清空）。不进 undo 历史。 */
export function setPendingAnchors(editor: Editor, anchors: PendingAnchor[]): void {
  editor.view.dispatch(
    editor.state.tr
      .setMeta(PENDING_ANCHOR_META, anchors)
      // Tiptap 的 TrailingNode（StarterKit 自带）会在「第一个 transaction」时给文档末尾补一个
      // 空段落——只要文末是图表 / 表格 / 代码块这类节点。那是它本来的行为，但**不该由一次
      // 「加个高亮」触发**：那等于用户什么都没干、正文却多了个空段落（落库就变成结尾的 \n\n）。
      // 用官方 meta 跳过本次。
      .setMeta(skipTrailingNodeMeta, true)
      .setMeta('addToHistory', false),
  );
}

function buildDecorations(doc: Node, anchors: PendingAnchor[]): DecorationSet {
  const bounds: Array<{ from: number; to: number }> = [];
  doc.forEach((child, offset) => {
    bounds.push({ from: offset, to: offset + child.nodeSize });
  });

  const decorations: Decoration[] = [];
  for (const anchor of anchors) {
    for (const range of anchor.ranges) {
      const from = Math.max(0, Math.min(range.from, range.to));
      const to = Math.min(doc.content.size, Math.max(range.from, range.to));
      if (from >= to) continue;

      for (const bound of bounds) {
        if (bound.to <= from || bound.from >= to) continue;
        const attrs = {
          class: PENDING_ANCHOR_CLASS,
          'data-pending-id': anchor.id,
        };
        if (from <= bound.from && to >= bound.to) {
          // 整块：用 node 装饰，表格 / 图表这类块级节点才盖得住
          decorations.push(Decoration.node(bound.from, bound.to, attrs));
        } else {
          // 块内的一部分（未扩块的选区）：行内高亮
          decorations.push(
            Decoration.inline(Math.max(from, bound.from), Math.min(to, bound.to), attrs),
          );
        }
      }
    }
  }

  return decorations.length ? DecorationSet.create(doc, decorations) : DecorationSet.empty;
}
