/**
 * 最小 Tiptap JSON 节点结构（只取本模块用到的字段）。
 * 不从 `@tiptap/core` 引 `JSONContent`——core 是嵌套依赖、非直接依赖，
 * 直接 import 类型解析不到（与仓库既有做法一致，见 extensions.ts）。
 */
interface TocDocNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown> | null;
  content?: TocDocNode[];
}

/** 目录项。 */
export interface TocItem {
  /** 锚点 id（= heading 的 data-toc-id / id，由 generateTocIds 注入）。 */
  id: string;
  /** 标题层级（1-6）。 */
  level: number;
  /** 标题纯文本。 */
  text: string;
  /** 付费墙锁住的章节（置灰不可点）。 */
  locked?: boolean;
}

/** 目录纳入的最大层级（h1-h6，全层级入目录）。 */
const MAX_LEVEL = 6;

/** 取 heading 节点的纯文本（拼接其 text 子节点）。 */
function headingText(node: TocDocNode): string {
  if (!node.content) return '';
  return node.content
    .map((c) => (c.type === 'text' ? c.text ?? '' : ''))
    .join('')
    .trim();
}

/**
 * 从已注入锚点 id 的 Tiptap JSON doc 提取 h1-h6 目录。
 *
 * 必须在 `generateTocIds` 之后调用（heading 的 attrs 里才有 `data-toc-id`）。
 * `lockedTitles`：被截断（锁住）章节标题，命中则标 `locked`——
 * 目录列全部章节，锁住项置灰不可点（付费墙钩子）。用 Set 便于去重命中。
 */
export function extractToc(
  doc: TocDocNode,
  lockedTitles: string[] = [],
): TocItem[] {
  const locked = new Set(lockedTitles.map((t) => t.trim()));
  const items: TocItem[] = [];

  const walk = (node: TocDocNode) => {
    const level = node.attrs?.level;
    if (
      node.type === 'heading' &&
      typeof level === 'number' &&
      level <= MAX_LEVEL
    ) {
      const text = headingText(node);
      const id = (node.attrs?.['data-toc-id'] ?? node.attrs?.id) as
        | string
        | undefined;
      // 有文本 + 有锚点 id 才入目录（空标题 / 未注入 id 的跳过）。
      if (text && id) {
        items.push({
          id,
          level,
          text,
          locked: locked.has(text) || undefined,
        });
      }
    }
    node.content?.forEach(walk);
  };

  walk(doc);
  return items;
}
