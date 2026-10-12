import type {
  JSONContent,
  MarkdownParseHelpers,
  MarkdownRendererHelpers,
  MarkdownToken,
  MarkdownTokenizer,
} from '@tiptap/core';

/**
 * 折叠块的 markdown 往返。
 *
 * 官方 Details 自带 Pandoc `:::details` 语法，和本库其它「markdown 没有原生写法」
 * 的节点不一致（上标、带样式的段落、带尺寸的图片都走 HTML），而且服务端没有
 * window.DOMParser，不认领 `<details>` 会被转义成字面文本。这里改成 HTML：
 *
 * ```html
 * <details open>
 * <summary>标题</summary>
 *
 * 正文
 *
 * </details>
 * ```
 *
 * `open` 是 HTML 布尔属性：写上表示展开，缺省表示折叠。摘要里的行内 markdown
 * 和正文里的块照常递归解析。
 */

const OPEN_TAG = /^<details(\s[^>]*)?>/i;
const OPEN_ATTR =
  /(?:^|\s)open(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?(?=\s|$)/i;

function tagIsOpen(attr: string | undefined): boolean {
  return attr != null && OPEN_ATTR.test(attr);
}

/** 从开标签之后找到与之配对的 `</details>`，允许嵌套。 */
function findClosingDetails(
  src: string,
  from: number,
): { closeStart: number; rawEnd: number } | null {
  const re = /<\/?details\b[^>]*>/gi;
  re.lastIndex = from;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = re.exec(src))) {
    if (match[0].startsWith('</')) depth -= 1;
    else depth += 1;
    if (depth === 0) {
      return { closeStart: match.index, rawEnd: re.lastIndex };
    }
  }
  return null;
}

function isEmptyParagraph(node: JSONContent): boolean {
  return node.type === 'paragraph' && (!node.content || node.content.length === 0);
}

/** 丢掉正文末尾多余的空段，但至少留一个块（schema 要求 detailsContent 非空）。 */
function trimBlocks(nodes: JSONContent[]): JSONContent[] {
  const next = [...nodes];
  while (next.length > 1 && isEmptyParagraph(next[next.length - 1])) {
    next.pop();
  }
  if (next.length === 0) next.push({ type: 'paragraph' });
  return next;
}

export const detailsMarkdownTokenizer: MarkdownTokenizer = {
  name: 'details',
  level: 'block',
  start(src) {
    if (!OPEN_TAG.test(src)) return -1;
    return src.search(/<details\b/i);
  },
  tokenize(src, _tokens, lexer) {
    const opening = OPEN_TAG.exec(src);
    if (!opening) return undefined;
    const close = findClosingDetails(src, opening[0].length);
    if (!close) return undefined;

    const inner = src.slice(opening[0].length, close.closeStart);
    const summaryMatch = /^\s*<summary>([\s\S]*?)<\/summary>\s*/i.exec(inner);
    const summaryRaw = summaryMatch?.[1] ?? '';
    const bodyRaw = summaryMatch ? inner.slice(summaryMatch[0].length) : inner;
    const body = bodyRaw.trim();

    const token: MarkdownToken = {
      type: 'details',
      raw: src.slice(0, close.rawEnd),
      open: tagIsOpen(opening[1]),
      summaryTokens: lexer.inlineTokens(summaryRaw),
      tokens: body ? lexer.blockTokens(body) : [],
    };
    return token;
  },
};

export function detailsParseMarkdown(
  token: MarkdownToken,
  helpers: MarkdownParseHelpers,
): JSONContent {
  const summary = helpers.parseInline(
    (token.summaryTokens as MarkdownToken[] | undefined) ?? [],
  );
  const blocks = trimBlocks(helpers.parseChildren(token.tokens ?? []));
  return helpers.createNode(
    'details',
    { open: Boolean(token.open) },
    [
      helpers.createNode('detailsSummary', {}, summary),
      helpers.createNode('detailsContent', {}, blocks),
    ],
  );
}

export function detailsRenderMarkdown(
  node: JSONContent,
  helpers: MarkdownRendererHelpers,
): string {
  const children = node.content ?? [];
  const summary = children.find((child) => child.type === 'detailsSummary');
  const body = children.find((child) => child.type === 'detailsContent');
  const summaryText = summary
    ? helpers.renderChildren(summary.content ?? [])
    : '';
  const bodyText = (body ? helpers.renderChildren(body.content ?? [], '\n\n') : '')
    .replace(/\s+$/, '');
  const open = node.attrs?.open ? ' open' : '';
  return `<details${open}>\n<summary>${summaryText}</summary>\n\n${bodyText}\n\n</details>`;
}
