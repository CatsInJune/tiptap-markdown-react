import type {
  JSONContent,
  MarkdownParseHelpers,
  MarkdownRendererHelpers,
  MarkdownToken,
  MarkdownTokenizer,
} from '@tiptap/core';

/**
 * 段落级样式的 markdown 往返（文字对齐 / 缩进 / 行高，挂在段落与标题节点上）。
 *
 * markdown 没有段落级样式语法，带样式的段落序列化为行内 HTML：
 * `<p style="text-align: center; margin-left: 2em; line-height: 1.5">…</p>`
 * （标题同理 `<h2 style="…">…</h2>`）——与图片的 `<img …>` 班车同一套思路：
 * **只有带样式的段落**走 HTML 形式，普通段落保持原生 markdown。
 *
 * 对其它渲染器（GitHub 等）的降级是「样式被 sanitize 剥掉、内容原样显示」——
 * 段落样式是装饰而非内容，这个降级可以接受（图片裁剪那种内容性变化不能这么处理）。
 *
 * 解析侧：自建 block tokenizer 认领**带本库认识样式**的 `<p style>` / `<hN style>`
 * （其余 `style` 或无 style 的标签不抢，留给默认管线）；内容是行内 markdown，
 * 用 `lexer.inlineTokens` 递归解析，bold/link 之类照常还原。server 端没有
 * window.DOMParser，认领后同样可用。
 */

/** 缩进步长（em/级）。与 ParagraphStyles 的 indentStepEm 默认值一致（两处都硬编码 2）。 */
const INDENT_STEP_EM = 2;

const TEXT_ALIGN_VALUES = new Set(['left', 'center', 'right', 'justify']);

function encodeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** 本库认识的 style 键（其余键不算「本库样式」，tokenizer 不抢整段）。 */
const KNOWN_STYLE_KEYS = ['text-align', 'margin-left', 'line-height'] as const;

/**
 * 从节点 attrs 生成 style 字符串（固定顺序，保证序列化幂等）。
 * 无任何样式时返回空串——调用方据此走原生 markdown 形式。
 */
export function paragraphStyleString(attrs: Record<string, unknown>): string {
  const parts: string[] = [];

  const align = typeof attrs.textAlign === 'string' ? attrs.textAlign : null;
  if (align && TEXT_ALIGN_VALUES.has(align)) {
    parts.push(`text-align: ${align}`);
  }

  const indent = Number(attrs.indent);
  if (Number.isFinite(indent) && indent > 0) {
    parts.push(`margin-left: ${indent * INDENT_STEP_EM}em`);
  }

  const lineHeight = Number(attrs.lineHeight);
  if (Number.isFinite(lineHeight) && lineHeight > 0) {
    parts.push(`line-height: ${lineHeight}`);
  }

  return parts.join('; ');
}

/** style 串 → 本库认识的 attrs（不认识 / 非法的键忽略）。 */
export function parseParagraphStyleAttrs(
  style: string,
): Record<string, string | number> {
  const attrs: Record<string, string | number> = {};
  for (const entry of style.split(';')) {
    const index = entry.indexOf(':');
    if (index < 0) continue;
    const key = entry.slice(0, index).trim().toLowerCase();
    const value = entry.slice(index + 1).trim();
    if (!value) continue;

    if (key === 'text-align' && TEXT_ALIGN_VALUES.has(value)) {
      attrs.textAlign = value;
    } else if (key === 'margin-left') {
      const match = /^([\d.]+)em$/.exec(value);
      const em = match ? Number.parseFloat(match[1]) : NaN;
      const level = Number.isFinite(em) && em > 0 ? Math.round(em / INDENT_STEP_EM) : 0;
      if (level > 0) attrs.indent = level;
    } else if (key === 'line-height') {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed) && parsed > 0) attrs.lineHeight = parsed;
    }
  }
  return attrs;
}

/** style 串里有没有本库认识的键（决定 tokenizer 是否认领这段 HTML）。 */
function hasKnownStyle(style: string): boolean {
  const lowered = style.toLowerCase();
  return KNOWN_STYLE_KEYS.some((key) => lowered.includes(`${key}:`));
}

/** 段落的 markdown 序列化：带样式走 `<p style="…">`，否则保持默认（纯内容）。 */
export function paragraphRenderMarkdown(
  node: JSONContent,
  helpers: MarkdownRendererHelpers,
): string {
  // 注意传**子节点数组**而不是节点本身：空段落没有 content 字段，传节点会落进
  // 序列化器的回退分支、把段落自己当子节点再渲染一遍 → 无限递归。
  const children = helpers.renderChildren(node.content ?? []);
  const style = paragraphStyleString(
    (node.attrs ?? {}) as Record<string, unknown>,
  );
  if (!style) return children;
  return `<p style="${encodeAttr(style)}">${children}</p>`;
}

/** 标题的 markdown 序列化：带样式走 `<hN style="…">`，否则保持 `## 前缀`。 */
export function headingRenderMarkdown(
  node: JSONContent,
  helpers: MarkdownRendererHelpers,
): string {
  const children = helpers.renderChildren(node.content ?? []);
  const level = Math.min(
    Math.max(Number((node.attrs as { level?: unknown })?.level) || 1, 1),
    6,
  );
  const style = paragraphStyleString(
    (node.attrs ?? {}) as Record<string, unknown>,
  );
  if (!style) return `${'#'.repeat(level)} ${children}`;
  return `<h${level} style="${encodeAttr(style)}">${children}</h${level}>`;
}

/**
 * 认领**带本库样式**的 `<p style="…">…</p>` / `<hN style="…">…</hN>`（block 级）。
 * 一个扩展只能挂一个 tokenizer，段落与标题两种形态都归它管（同图片的 figure/img）。
 */
export const paragraphMarkdownTokenizer: MarkdownTokenizer = {
  name: 'paragraph',
  level: 'block',
  start(src) {
    const match = /<(?:p|h[1-6])\s+style=/i.exec(src);
    return match ? match.index : -1;
  },
  tokenize(src, _tokens, lexer) {
    const match = /^<(p|h([1-6]))\s+style="([^"]*)"\s*>([\s\S]*?)<\/\1\s*>/i.exec(
      src,
    );
    if (!match) return undefined;
    const [, tag, headingLevel, style, inner] = match;
    if (!hasKnownStyle(style)) return undefined; // 不认识的样式不抢，留给默认管线
    return {
      type: 'paragraph',
      raw: match[0],
      tag,
      hLevel: headingLevel ? Number(headingLevel) : null,
      style,
      // 行内内容交给 marked 的 lexer 解析：bold / link 等照常还原（与 sup/sub 同一手法）
      tokens: lexer.inlineTokens(inner ?? ''),
    };
  },
};

/**
 * 独占一行时会被"提块"的节点类型（本库的块级节点）。
 *
 * `![a](url)` 的 marked token 是段落（内含 image 行内 token），而 prosemirror 的
 * schema 不允许块级 image 待在段落里——内置解析器会把它们提成顶层节点；我们接管
 * 段落解析后要维持这一行为，否则图片会被塞在段落里（后续选中 / 命令都找不到它）。
 * 新增"独占一行的块级节点"时把类型名加进来。
 */
const ROW_BLOCK_TYPES = new Set(['image', 'chart']);

/** token → 段落 / 标题节点（attrs 与内容一起还原）。 */
export function paragraphParseMarkdown(
  token: MarkdownToken,
  helpers: MarkdownParseHelpers,
): JSONContent | JSONContent[] {
  const attrs = parseParagraphStyleAttrs(String(token.style ?? ''));
  const content = helpers.parseInline(token.tokens ?? []);

  // 段内只有块级节点（且段落自身没有样式）：提出去当顶层节点
  const blockOnly =
    content.length > 0 &&
    Object.keys(attrs).length === 0 &&
    content.every((child) => ROW_BLOCK_TYPES.has(String(child.type)));
  if (blockOnly) return content;

  if (token.hLevel) {
    return helpers.createNode('heading', { level: token.hLevel, ...attrs }, content);
  }
  return helpers.createNode('paragraph', attrs, content);
}
