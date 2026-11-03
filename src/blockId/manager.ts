import type { JSONContent } from '@tiptap/core';
import { MarkdownManager } from '@tiptap/markdown';
import { BLOCK_ID_ATTR, formatBlockIdLine, normalizeBlockId } from './id';
import { BLOCK_ID_MARKER_TYPE } from './tokenizer';

/**
 * 带块 ID 序列化的 MarkdownManager。
 *
 * 只做两件事（RFC §7.1）：
 * 1. **序列化**：顶层块（doc 的直接子节点）持有合法 `blockId` attr → 在它前面输出
 *    一行独立 `<!--b:id-->`；没有 attr / 值非法 / 该块序列化为空 → 不输出。
 * 2. **解析**：把标记 tokenizer 产出的占位节点（`BLOCK_ID_MARKER_TYPE`）里的 ID
 *    转给「紧随的下一个顶层块」，占位本身删掉；文档尾孤行自然丢弃、不报错。
 *    注释行在 fence 内不会被 tokenizer 认领（marked 的代码围栏整体消费），
 *    blockquote / 列表里出现的 ID 会附到该容器内的下一个块（顶层序列化不输出，
 *    随容器结构往返时丢弃）。
 *
 * 为什么用子类而不是在扩展里给每个节点挂 renderMarkdown：官方 Manager 的
 * `renderNodeToMarkdown` 能拿到 parentType，是唯一能精确区分「顶层块」的公开入口；
 * 逐节点扩展还要覆盖 image / chart / codeBlock 等全部块类型，且解析侧仍要做
 * 兄弟节点映射。
 */
export class BlockIdMarkdownManager extends MarkdownManager {
  parse(markdown: string): JSONContent {
    return attachBlockIds(super.parse(markdown));
  }

  renderNodeToMarkdown(
    node: JSONContent,
    parentNode?: JSONContent,
    index = 0,
    level = 0,
    meta: Record<string, any> = {},
  ): string {
    const markdown = super.renderNodeToMarkdown(
      node,
      parentNode,
      index,
      level,
      meta,
    );
    if (
      !markdown ||
      parentNode?.type !== 'doc' ||
      !node ||
      node.type === 'text'
    ) {
      return markdown;
    }
    const id = normalizeBlockId(node.attrs?.[BLOCK_ID_ATTR]);
    if (!id) return markdown;
    return `${formatBlockIdLine(id)}\n${markdown}`;
  }
}

/** 递归把占位节点的 ID 转给下一个兄弟块，并删除占位。 */
export function attachBlockIds(doc: JSONContent): JSONContent {
  if (!doc || !Array.isArray(doc.content)) return doc;
  return { ...doc, content: attachBlockIdsIn(doc.content) };
}

function attachBlockIdsIn(nodes: JSONContent[]): JSONContent[] {
  const out: JSONContent[] = [];
  let pendingId: string | null = null;

  for (const node of nodes) {
    if (!node || typeof node !== 'object') {
      out.push(node);
      continue;
    }
    if (node.type === BLOCK_ID_MARKER_TYPE) {
      // 连续多行 ID 时，紧挨块的那一条生效（后出现的覆盖先出现的）。
      pendingId = normalizeBlockId(node.attrs?.[BLOCK_ID_ATTR]) ?? pendingId;
      continue;
    }

    let next = node;
    if (pendingId && next.type !== 'text') {
      if (!normalizeBlockId(next.attrs?.[BLOCK_ID_ATTR])) {
        next = {
          ...next,
          attrs: { ...(next.attrs ?? {}), [BLOCK_ID_ATTR]: pendingId },
        };
      }
      pendingId = null;
    }

    if (Array.isArray(next.content)) {
      next = { ...next, content: attachBlockIdsIn(next.content) };
    }
    out.push(next);
  }

  return out;
}
