import type { JSONContent } from '@tiptap/core';
import { MarkdownManager } from '@tiptap/markdown';
import { blockIdTopLevelTypes } from '../extensions';
import {
  BLOCK_ID_ATTR,
  createBlockId,
  formatBlockIdLine,
  normalizeBlockId,
} from './id';
import { BLOCK_ID_MARKER_TYPE } from './tokenizer';

const BLOCK_ID_TYPES = new Set(blockIdTopLevelTypes);

/**
 * 带块 ID 序列化的 MarkdownManager。
 *
 * 只做两件事（RFC §7.1）：
 * 1. **序列化**：顶层块（doc 的直接子节点）持有合法 `blockId` attr → 在它前面输出
 *    一行独立 `<!--b:id-->`；没有 attr / 值非法 / 该块序列化为空 → 不输出。
 * 2. **解析**：把标记 tokenizer 产出的占位节点（`BLOCK_ID_MARKER_TYPE`）里的 ID
 *    转给「紧随的下一个顶层块」，占位本身删掉；文档尾孤行自然丢弃、不报错。
 *    注释行在 fence 内不会被 tokenizer 认领（marked 的代码围栏整体消费）；
 *    blockquote / 列表内部冒出的同名注释不是顶层位置，直接丢弃（RFC §7.1）。
 *    随后在 JSON 阶段补齐缺失 ID（顶层真实 ID / 嵌套空串哨兵），使初始文档在进入
 *    schema 前就带身份——UniqueID 的 onCreate 不再产生一次 doc 变更。
 *
 * 为什么用子类而不是在扩展里给每个节点挂 renderMarkdown：官方 Manager 的
 * `renderNodeToMarkdown` 能拿到 parentType，是唯一能精确区分「顶层块」的公开入口；
 * 逐节点扩展还要覆盖 image / chart / codeBlock 等全部块类型，且解析侧仍要做
 * 兄弟节点映射。
 */
export class BlockIdMarkdownManager extends MarkdownManager {
  parse(markdown: string): JSONContent {
    // 先做注释 → ID 映射，再在 JSON 阶段补 ID：块在进入 schema 前就带身份，
    // onCreate 不再需要一次 doc 变更回填（避免打开文档触发 update / TrailingNode）。
    return assignBlockIds(attachBlockIds(super.parse(markdown)));
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

/**
 * 把顶层占位节点的 ID 转给下一个顶层块，并删除占位（RFC §7.1）。
 *
 * - 只在 **doc 直接子节点** 上附着：fence 外的行首独立 ID 才是块边界注释；
 *   blockquote / 列表内部冒出来的同名注释不是顶层位置，直接丢弃；
 * - 4+ 个空行时 @tiptap/markdown 会先插一个隐式空段落；它不算「下一个块」，
 *   ID 继续往后找真正的块（空段自身序列化为空串，本来也承载不了 ID）；
 * - 文档尾孤行 / 只跟着空段 → 丢弃，不报错。
 */
export function attachBlockIds(doc: JSONContent): JSONContent {
  if (!doc || !Array.isArray(doc.content)) return doc;

  const content: JSONContent[] = [];
  let pendingId: string | null = null;

  for (const node of doc.content) {
    if (!node || typeof node !== 'object') {
      content.push(node);
      continue;
    }
    if (node.type === BLOCK_ID_MARKER_TYPE) {
      // 连续多行 ID 时，紧挨块的那一条生效（后出现的覆盖先出现的）。
      pendingId = normalizeBlockId(node.attrs?.[BLOCK_ID_ATTR]) ?? pendingId;
      continue;
    }

    let next = stripNestedMarkers(node);
    if (pendingId && next.type !== 'text' && !isImplicitBlankParagraph(next)) {
      if (!normalizeBlockId(next.attrs?.[BLOCK_ID_ATTR])) {
        next = {
          ...next,
          attrs: { ...(next.attrs ?? {}), [BLOCK_ID_ATTR]: pendingId },
        };
      }
      pendingId = null;
    }
    content.push(next);
  }

  return { ...doc, content };
}

/** 隐式空段落（解析多个空行时的填充块）不是 ID 的附着目标。 */
function isImplicitBlankParagraph(node: JSONContent): boolean {
  return (
    node.type === 'paragraph' &&
    (!Array.isArray(node.content) || node.content.length === 0)
  );
}

/**
 * JSON 阶段补块 ID：顶层块缺 ID → 真实 ID；嵌套块缺 ID → 空串哨兵。
 *
 * 这样初始 markdown 在进入 schema 前就已完成回填，UniqueID 的 onCreate 无事可做，
 * 打开文档不会产生一次 doc 变更（宿主 update 调度 / TrailingNode 都不会被惊动）。
 * 哨兵让 UniqueID 按类型名的后续分配跳过嵌套块——它们的 ID 永远进不了 markdown。
 */
function assignBlockIds(doc: JSONContent): JSONContent {
  if (!Array.isArray(doc.content)) return doc;
  return {
    ...doc,
    content: doc.content.map((node) => {
      if (!node || typeof node !== 'object') return node;
      const withId = ensureBlockId(node, false);
      return ensureNestedIds(withId);
    }),
  };
}

function ensureBlockId(
  node: JSONContent,
  nested: boolean,
): JSONContent {
  if (!BLOCK_ID_TYPES.has(String(node.type))) return node;
  const existing = normalizeBlockId(node.attrs?.[BLOCK_ID_ATTR]);
  if (existing) return node;
  return {
    ...node,
    attrs: {
      ...(node.attrs ?? {}),
      [BLOCK_ID_ATTR]: nested ? '' : createBlockId(),
    },
  };
}

function ensureNestedIds(node: JSONContent): JSONContent {
  if (!Array.isArray(node.content)) return node;
  const content: JSONContent[] = [];
  for (const child of node.content) {
    if (!child || typeof child !== 'object') {
      content.push(child);
      continue;
    }
    content.push(ensureNestedIds(ensureBlockId(child, true)));
  }
  return { ...node, content };
}

/** 删掉嵌套内容里的占位节点：非顶层位置的 ID 注释一律丢弃。 */
function stripNestedMarkers(node: JSONContent): JSONContent {
  if (!Array.isArray(node.content)) return node;
  const content: JSONContent[] = [];
  for (const child of node.content) {
    if (!child || typeof child !== 'object') {
      content.push(child);
      continue;
    }
    if (child.type === BLOCK_ID_MARKER_TYPE) continue;
    content.push(stripNestedMarkers(child));
  }
  return { ...node, content };
}
