import Code from '@tiptap/extension-code';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import {
  Details,
  DetailsContent,
  DetailsSummary,
} from '@tiptap/extension-details';
import Heading from '@tiptap/extension-heading';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { ListItem } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TableKit } from '@tiptap/extension-table';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import {
  Color,
  FontSize,
  TextStyle,
} from '@tiptap/extension-text-style';
// AnyExtension 从 @tiptap/react 取（它 re-export 自 core），避免新增 @tiptap/core 直接依赖
import type { AnyExtension } from '@tiptap/react';
import { mergeAttributes, type CommandProps } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { common, createLowlight } from 'lowlight';
import type {
  JSONContent,
  MarkdownParseHelpers,
  MarkdownRendererHelpers,
  MarkdownToken,
  MarkdownTokenizer,
} from '@tiptap/core';
import { parseCodeTokenAsChartOrCodeBlock } from './chart/codeBlockChartParse';
import {
  imageAlignAttribute,
  imageCaptionAttribute,
  imageCropAttribute,
  imageFigureParseRule,
  imageMarkdownTokenizer,
  imageNodeHtml,
  imageParseMarkdown,
  imageRenderMarkdown,
} from './imageMarkdown';
import { reportBlockMath, reportInlineMath } from './math';
import {
  headingRenderMarkdown,
  paragraphMarkdownTokenizer,
  paragraphParseMarkdown,
  paragraphRenderMarkdown,
} from './paragraphMarkdown';
import {
  detailsMarkdownTokenizer,
  detailsParseMarkdown,
  detailsRenderMarkdown,
} from './detailsMarkdown';
import { MarkdownEmoji } from './emoji/markdownEmoji';
import { OrderedListWithNumbering } from './numberingFormat';
import { ParagraphStyles } from './paragraphStyles';

/**
 * StarterKit 默认 Code 的 excludes:'_' 禁止与任何其他 mark 共存。
 * CommonMark 允许 `**bold `code` bold**`；markdown 导入时会抛
 * RangeError: Invalid collection of marks for node text: bold,code。
 */
const InlineCode = Code.extend({
  excludes: '',
});

/**
 * 编辑器的「内容 schema 级」扩展集——纯节点/标记定义，不含任何 React NodeView
 * 或键盘交互绑定。三处共用：
 *   1. 编辑器（MarkdownWysiwygEditor）：base + 交互增强版 CodeBlock/Image
 *   2. 只读预览（MarkdownPreview）
 *   3. server 端 markdown→HTML 渲染（renderReportHtml）
 *
 * 分层动机：交互增强依赖 @tiptap/react / 浏览器，会污染 server bundle（RSC）。
 * base 保持纯 schema，server import 它只引入节点定义，无 React 代码。
 *
 * 关键边界：CodeBlock / Image / CitationRef「会被客户端增强」，**不放进 base**——
 * 否则编辑器追加增强版会与 base 的纯版同名冲突（Tiptap 报 "Duplicate extension names"）。
 * 改为：base 不含这三类，由调用方按需注入：
 *   - 编辑器 / 预览注入「增强版」（React NodeView）
 *   - server 注入「纯版」（pureCodeBlock / pureImage / CitationRef）
 */

// lowlight 实例：代码块语法高亮。导出供编辑器增强版与 server 纯版共用同一实例。
export const lowlight = createLowlight(common);

/**
 * 颜色 / 字号的 markdown 往返：markdown 没有原生颜色语法，序列化为行内 HTML
 * `<span style="...">`。否则 getMarkdown() 会把这些 mark 静默剥掉。
 *
 * 只靠 marked 的行内 HTML 不够：开标签和闭标签之间的内容（包括已经认出的
 * `**加粗**`）会被拼回原始 HTML 再走 parseHTML。server 没有 DOMParser 时整段
 * 退化成字面文本，页面上就是
 * `<span style="font-size:24px">**启示……**</span>`。自建 tokenizer 把整段
 * span 认领下来，内层再交给 inline lexer，加粗 / 链接等照常还原。
 *
 * 注意：Color / FontSize 通过 `types: [TextStyle.name]` 把 color / fontSize
 * 属性挂在 **textStyle** mark 的 attrs 上，文档里出现的 mark 类型名是
 * `textStyle`——所以 renderMarkdown 必须扩展在 TextStyle 上，序列化器才能按
 * mark 类型名查到 handler。
 */
const FONT_SIZE_VALUE = /^\d+(?:\.\d+)?(?:px|em|rem|%)$/i;
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
const RGB_COLOR =
  /^rgba?\(\s*(?:\d{1,3}\s*,\s*){2}\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/;
const HSL_COLOR =
  /^hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/;
const NAMED_COLOR = /^[a-zA-Z]{1,30}$/;

function isSafeColor(value: string): boolean {
  if (/[<>"'\\{};]/.test(value)) return false;
  return (
    HEX_COLOR.test(value) ||
    RGB_COLOR.test(value) ||
    HSL_COLOR.test(value) ||
    NAMED_COLOR.test(value)
  );
}

/** style 串 → textStyle attrs。没有本库认识的键时返回 null（tokenizer 不认领）。 */
function parseTextStyleAttrs(
  style: string,
): { color?: string; fontSize?: string } | null {
  const attrs: { color?: string; fontSize?: string } = {};
  for (const entry of style.split(';')) {
    const index = entry.indexOf(':');
    if (index < 0) continue;
    const key = entry.slice(0, index).trim().toLowerCase();
    const value = entry.slice(index + 1).trim();
    if (key === 'color' && isSafeColor(value)) attrs.color = value;
    else if (key === 'font-size' && FONT_SIZE_VALUE.test(value)) {
      attrs.fontSize = value;
    }
  }
  if (!attrs.color && !attrs.fontSize) return null;
  return attrs;
}

function readStyleAttribute(attrs: string): string | undefined {
  const match = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(
    attrs,
  );
  if (!match) return undefined;
  return (match[1] ?? match[2] ?? match[3] ?? '').trim();
}

/**
 * 从 src 开头匹配一对带本库样式的 span。按嵌套深度找闭合标签，
 * 避免内层 `<span style>` 被非贪婪正则提前截断。
 */
function matchTextStyleSpan(
  src: string,
): { raw: string; style: string; inner: string } | undefined {
  const open = /^<span\b([^>]*)>/i.exec(src);
  if (!open || /\/\s*$/.test(open[1])) return undefined;
  const style = readStyleAttribute(open[1]);
  if (style == null || !parseTextStyleAttrs(style)) return undefined;

  const tagRe = /<\/?span\b[^>]*>/i;
  let depth = 1;
  let cursor = open[0].length;
  while (cursor < src.length) {
    const found = tagRe.exec(src.slice(cursor));
    if (!found) return undefined;
    const tag = found[0];
    const at = cursor + found.index;
    if (tag.startsWith('</')) {
      depth -= 1;
      if (depth === 0) {
        return {
          raw: src.slice(0, at + tag.length),
          style,
          inner: src.slice(open[0].length, at),
        };
      }
    } else if (!/\/\s*>$/.test(tag)) {
      depth += 1;
    }
    cursor = at + tag.length;
  }
  return undefined;
}

const MarkdownTextStyle = TextStyle.extend({
  renderMarkdown(
    node: { attrs?: Record<string, unknown> },
    helpers: {
      renderChildren: (
        nodes: JSONContent | JSONContent[],
        separator?: string,
      ) => string;
    },
  ) {
    const { color, fontSize } = (node.attrs ?? {}) as {
      color?: string;
      fontSize?: string;
    };
    const styles: string[] = [];
    if (color) styles.push(`color:${color}`);
    if (fontSize) styles.push(`font-size:${fontSize}`);
    if (styles.length === 0) return '';
    // getMarkOpening 用占位符调用 renderChildren()（无需传节点），类型按签名兜底转换。
    const children = (helpers.renderChildren as () => string)();
    return `<span style="${styles.join(';')}">${children}</span>`;
  },

  markdownTokenizer: {
    name: 'textStyle',
    level: 'inline',
    start(src: string) {
      const match = /<span\b[^>]*\bstyle\s*=/i.exec(src);
      return match ? match.index : -1;
    },
    tokenize(src, _tokens, lexer) {
      const matched = matchTextStyleSpan(src);
      if (!matched) return undefined;
      return {
        type: 'textStyle',
        raw: matched.raw,
        style: matched.style,
        tokens: lexer.inlineTokens(matched.inner),
      };
    },
  },

  parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) => {
    const attrs = parseTextStyleAttrs(String(token.style ?? ''));
    const content = helpers.parseInline(token.tokens ?? []);
    if (!attrs) return content;
    return helpers.applyMark('textStyle', content, attrs);
  },
});

/**
 * 彩色高亮的 markdown 往返。官方 `==text==` 不带颜色，getMarkdown() 会把
 * 选中的背景色丢掉；再读回来只剩浏览器默认的 `<mark>`（预览常被 UA 涂成
 * 黑字黄底，服务端渲染则可能让文字颜色透出来，两边不一致）。
 * 有颜色时改写成 `<mark data-color style="background-color">`，并认领整段、
 * 继续解析内层 markdown。没颜色的 `==text==` 保持原样。
 */
function readHighlightColor(attrs: string): string | null {
  const data = /\bdata-color\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
  const fromData = (data?.[1] ?? data?.[2] ?? '').trim();
  if (fromData && isSafeColor(fromData)) return fromData;
  const style = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
  const styleText = style?.[1] ?? style?.[2] ?? '';
  for (const entry of styleText.split(';')) {
    const index = entry.indexOf(':');
    if (index < 0) continue;
    const key = entry.slice(0, index).trim().toLowerCase();
    const value = entry.slice(index + 1).trim();
    if (key === 'background-color' && isSafeColor(value)) return value;
  }
  return null;
}

function matchHighlightMark(
  src: string,
): { raw: string; inner: string; color: string | null } | undefined {
  const open = /^<mark\b([^>]*)>/i.exec(src);
  if (!open || /\/\s*$/.test(open[1])) return undefined;
  if (/data-comment-ids/i.test(open[1]) || /\btmr-comment\b/.test(open[1])) {
    return undefined;
  }
  const color = readHighlightColor(open[1]);
  const tagRe = /<\/?mark\b[^>]*>/i;
  let depth = 1;
  let cursor = open[0].length;
  while (cursor < src.length) {
    const found = tagRe.exec(src.slice(cursor));
    if (!found) return undefined;
    const tag = found[0];
    const at = cursor + found.index;
    if (tag.startsWith('</')) {
      depth -= 1;
      if (depth === 0) {
        return {
          raw: src.slice(0, at + tag.length),
          inner: src.slice(open[0].length, at),
          color,
        };
      }
    } else if (!/\/\s*>$/.test(tag)) {
      depth += 1;
    }
    cursor = at + tag.length;
  }
  return undefined;
}

const MarkdownHighlight = Highlight.extend({
  renderMarkdown(node: JSONContent, helpers: MarkdownRendererHelpers) {
    const children = helpers.renderChildren(node);
    const color =
      typeof node.attrs?.color === 'string' ? node.attrs.color : '';
    if (!color || !isSafeColor(color)) return `==${children}==`;
    const encoded = color
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
    return `<mark data-color="${encoded}" style="background-color:${encoded}">${children}</mark>`;
  },

  markdownTokenizer: {
    name: 'highlight',
    level: 'inline' as const,
    start(src: string) {
      const mark = /<mark\b/i.exec(src);
      const eq = src.indexOf('==');
      const indexes = [mark?.index, eq >= 0 ? eq : undefined].filter(
        (index): index is number => index != null,
      );
      return indexes.length ? Math.min(...indexes) : -1;
    },
    tokenize(src, _tokens, lexer) {
      if (src.startsWith('==')) {
        const match = /^(==)([^=]+)(==)/.exec(src);
        if (!match) return undefined;
        const inner = match[2].trim();
        return {
          type: 'highlight',
          raw: match[0],
          text: inner,
          tokens: lexer.inlineTokens(inner),
        };
      }
      const matched = matchHighlightMark(src);
      if (!matched) return undefined;
      return {
        type: 'highlight',
        raw: matched.raw,
        color: matched.color,
        tokens: lexer.inlineTokens(matched.inner),
      };
    },
  },

  parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) => {
    const content = helpers.parseInline(token.tokens ?? []);
    const color = typeof token.color === 'string' ? token.color : '';
    if (color && isSafeColor(color)) {
      return helpers.applyMark('highlight', content, { color });
    }
    return helpers.applyMark('highlight', content);
  },
});

/**
 * 认领一组行内 HTML 标签对（`<sup>…</sup>` / `<sub>…</sub>`）的 marked 行内
 * tokenizer。官方管线只把「没被扩展认领」的行内 HTML 交给 window.DOMParser，
 * 而 server 端没有 window 会把它转义成字面文本（见 renderReportHtml 的已知边界）；
 * 自己认领后 SSR / Node 同样还原成 mark，且内层 markdown（`<sup>**x**</sup>`）
 * 照常解析。token 名与扩展名一致，序列化器按它查 parseMarkdown——同 CitationRef。
 */
function htmlTagTokenizer(tag: string, tokenType: string): MarkdownTokenizer {
  const opening = new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'i');
  const pair = new RegExp(
    `^<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}\\s*>`,
    'i',
  );
  return {
    name: tokenType,
    level: 'inline',
    start(src) {
      const match = opening.exec(src);
      return match ? match.index : -1;
    },
    tokenize(src, _tokens, lexer) {
      const match = pair.exec(src);
      if (!match) return undefined;
      return {
        type: tokenType,
        raw: match[0],
        tokens: lexer.inlineTokens(match[1]),
      };
    },
  };
}

/**
 * 上标 / 下标的 markdown 往返：markdown 无原生语法，序列化为行内 HTML
 * `<sup>` / `<sub>`（GFM 同样支持这两个标签）。
 *
 * 不加这层，getMarkdown() 会把这两个 mark 静默丢掉——@tiptap/markdown 对
 * 没有 renderMarkdown 的 mark 直接返回空串。renderMarkdown 同时被序列化器
 * 用作 mark 的开闭语法（getMarkOpening / getMarkClosing 用占位符切分），
 * 与 MarkdownTextStyle 的 span 是同一套机制。
 */
const MarkdownSuperscript = Superscript.extend({
  renderMarkdown(node: JSONContent, helpers: MarkdownRendererHelpers) {
    return `<sup>${helpers.renderChildren(node)}</sup>`;
  },
  markdownTokenizer: htmlTagTokenizer('sup', 'superscript'),
  parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) =>
    helpers.applyMark('superscript', helpers.parseInline(token.tokens ?? [])),
});

const MarkdownSubscript = Subscript.extend({
  renderMarkdown(node: JSONContent, helpers: MarkdownRendererHelpers) {
    return `<sub>${helpers.renderChildren(node)}</sub>`;
  },
  markdownTokenizer: htmlTagTokenizer('sub', 'subscript'),
  parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) =>
    helpers.applyMark('subscript', helpers.parseInline(token.tokens ?? [])),
});

/**
 * 纯版代码块（无 React 视图）：server / 预览用。
 * 顺带把 ```tmr-chart 围栏升级为 chart 节点（内置 code tokenizer 抢先时）。
 */
export const pureCodeBlock = CodeBlockLowlight.extend({
  parseMarkdown: (token, helpers) =>
    parseCodeTokenAsChartOrCodeBlock(token, helpers, 'codeBlock'),
}).configure({ lowlight });

/**
 * 纯版块级图片（无删除快捷键）：server / 预览用。
 * inline:false（官方默认）——研报里图片均为大图独占一行，块级图片可直接作为 doc
 * 顶层子节点，避免「inline image 裸挂 doc 顶层」被 generateTocIds 严格校验判非法。
 *
 * markdown 往返接 imageMarkdown：带尺寸 / 对齐 / 描述（图注）的图序列化为
 * `<img …>` / `<figure>…</figure>`、解析时自建 tokenizer 认领——官方解析内联 HTML
 * 依赖 window.DOMParser，server 端没有 window，不认领会把它转义成字面文本
 * （见 imageMarkdown.ts 头注）。
 */
export const pureImage = Image.extend({
  addAttributes() {
    return {
      ...(Image.config.addAttributes?.call(this) ?? {}),
      align: imageAlignAttribute,
      caption: imageCaptionAttribute,
      crop: imageCropAttribute,
    };
  },
  parseHTML() {
    // figure 规则要排在 img 前面：带描述的图整体归 figure
    return [
      imageFigureParseRule(),
      {
        tag: this.options.allowBase64
          ? 'img[src]'
          : 'img[src]:not([src^="data:"])',
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return imageNodeHtml({
      attrs: node.attrs,
      htmlAttributes: mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
    });
  },
  renderMarkdown: imageRenderMarkdown,
  parseMarkdown: imageParseMarkdown,
  markdownTokenizer: imageMarkdownTokenizer,
}).configure({ inline: false });

export { pureChart, reportChart } from './chart/ChartExtension';

/**
 * 段落 / 标题的 markdown 版本：带段落级样式（对齐 / 缩进 / 行高）时序列化为
 * `<p style="…">` / `<hN style="…">`，无样式保持原生形式（见 paragraphMarkdown.ts）。
 * StarterKit 里这两个节点要关掉，改用下面这份（同 CodeBlock / Image 的分层做法）。
 */
export const MarkdownParagraph = Paragraph.extend({
  renderMarkdown: paragraphRenderMarkdown,
  markdownTokenizer: paragraphMarkdownTokenizer,
  parseMarkdown: paragraphParseMarkdown,
});

/**
 * 字号和加粗都属于正文修饰。标题自己有字号和字重，这两样留在文字上会盖住标题，
 * 看起来就像没变成标题。设标题前把当前文本块里的字号和加粗清掉，颜色等其它 mark 保留。
 */
function clearFontSizeInTextblocks({ state, tr }: CommandProps) {
  const markType = state.schema.marks.textStyle;
  const boldType = state.schema.marks.bold;
  const ranges: { from: number; to: number; attrs: Record<string, unknown> }[] = [];
  const { from, to } = state.selection;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return;
    const start = pos + 1;
    const end = pos + node.nodeSize - 1;
    if (boldType) tr.removeMark(start, end, boldType);
    if (!markType) return false;
    node.descendants((child, childPos) => {
      if (!child.isText) return;
      const mark = child.marks.find((item) => item.type === markType);
      if (!mark?.attrs.fontSize) return;
      const childStart = pos + 1 + childPos;
      ranges.push({
        from: childStart,
        to: childStart + child.nodeSize,
        attrs: { ...mark.attrs, fontSize: null },
      });
    });
    return false;
  });
  for (const range of ranges) {
    if (!markType) continue;
    tr.removeMark(range.from, range.to, markType);
    const keep = Object.values(range.attrs).some(
      (value) => value != null && value !== '',
    );
    if (keep) tr.addMark(range.from, range.to, markType.create(range.attrs));
  }
}

export const MarkdownHeading = Heading.extend({
  renderMarkdown: headingRenderMarkdown,

  addCommands() {
    const parent = this.parent?.();
    return {
      ...parent,
      setHeading:
        (attributes) =>
        (props) => {
          if (!this.options.levels.includes(attributes.level)) return false;
          clearFontSizeInTextblocks(props);
          return parent?.setHeading?.(attributes)?.(props) ?? false;
        },
      toggleHeading:
        (attributes) =>
        (props) => {
          if (!this.options.levels.includes(attributes.level)) return false;
          if (!props.editor.isActive(this.name, attributes)) {
            clearFontSizeInTextblocks(props);
          }
          return parent?.toggleHeading?.(attributes)?.(props) ?? false;
        },
    };
  },
});

/**
 * 列表项第一个块必须是段落（schema：`paragraph block*`）。官方 parseMarkdown 遇到
 * `- ## 标题`、列表项里的 setext 标题（`- 文字\n  ---`，包括流式输出到一半的 `- 文字\n  -`）
 * 时，会把 heading 放在第一个块——markdown 解析不校验 schema，产出的就是一份非法文档；
 * TableOfContents 给标题补 id 走 setNodeMarkup，重建外层 listItem 时才抛
 * `TransformError: Invalid content for node listItem`，整页白屏。这里把首个 heading
 * 降成同内容段落（其余块与 heading 上的对齐/缩进等 attrs 保留）。
 *
 * 官方兜底分支（首块既不是 paragraph 也不是 text）同样会把 inline token 原样塞进来，
 * `- ## 标题\n  正文` 的正文就是裸 text 节点。一并包成段落，否则文档仍不合法。
 *
 * 首块是引用 / 表格 / 代码块时（`- > 引用`、`- |表格|`、`- ```js`）同样违反 schema。
 * 这类内容是合法 markdown，不能像标题那样降级——试过补空前导段落，序列化时引用和
 * 表格会被挤出列表项、代码块内容直接丢失，数据直接坏掉。所以把 schema 放到 `block+`：
 * 首块允许这些块级内容，解析和序列化原样往返。标题仍然降级（见上），不放宽。
 */
const listItemParseMarkdown = ListItem.config.parseMarkdown!;

export const MarkdownListItem = ListItem.extend({
  // `block+` 而非点名具体类型：baseExtensions 不含 codeBlock 时点名的节点类型
  // 会让 schema 构建直接失败，而 `block` 是 ProseMirror 的组名，随注册内容伸缩。
  content: 'block+',

  parseMarkdown: (token, helpers) => {
    const parsed = listItemParseMarkdown(token, helpers);
    if (Array.isArray(parsed) || !('type' in parsed)) return parsed;
    const raw = parsed.content;
    if (!raw?.length) return parsed;

    let changed = false;
    const content = raw.map((item) => {
      // 块级 token 解析出的节点都有 type；text 是明显的 inline 泄漏
      if (item.type !== 'text') return item;
      changed = true;
      return { type: 'paragraph', content: [item] };
    });

    const [first, ...rest] = content;
    if (first.type !== 'heading') return changed ? { ...parsed, content } : parsed;

    // heading 的内容是 inline，段落可直接接管；level 属于标题层级，不能留在段落上
    const { level: _level, ...attrs } = first.attrs ?? {};
    return {
      ...parsed,
      content: [
        { type: 'paragraph', attrs, content: first.content ?? [] },
        ...rest,
      ],
    };
  },
});

/**
 * 官方 Details（MIT）：摘要 + 可折叠正文。三个节点必须一起注册。
 * `persist` 把展开状态写进文档；默认展开，这样新建的块能直接接着写，
 * 阅读页的原生 `<details open>` 也不会把正文藏起来。
 * markdown 不用官方的 `:::details`，改走 HTML（见 detailsMarkdown.ts）。
 */
const DetailsBlock = Details.extend({
  addAttributes() {
    const inherited = this.parent?.() ?? {};
    if (!('open' in inherited) || inherited.open == null) return inherited;
    return {
      ...inherited,
      open: { ...inherited.open, default: true },
    };
  },
  markdownTokenizer: detailsMarkdownTokenizer,
  parseMarkdown: detailsParseMarkdown,
  renderMarkdown: detailsRenderMarkdown,
}).configure({ persist: true });

/**
 * 三处共用的纯 schema 扩展——**不含 CodeBlock / Image / CitationRef / Chart**（见上方边界说明）。
 * 编辑器：`[...baseExtensions, 增强CodeBlock, 增强Image, createCitationRef(), createChart(), Markdown]`
 * server/预览：`[...baseExtensions, pureCodeBlock, pureImage, CitationRef, pureChart, …]`
 */
export const baseExtensions: AnyExtension[] = [
  // 禁用 StarterKit 内置 codeBlock / code（改用 lowlight 代码块 + 可共存的 InlineCode）
  // 与 paragraph / heading（改用带 markdown 样式往返的版本，见上）
  StarterKit.configure({
    codeBlock: false,
    code: false,
    paragraph: false,
    heading: false,
    // 有序列表改用带编号格式的版本。同名不能注册两份。
    orderedList: false,
    // 列表项改用把首个标题降成段落的版本（见 MarkdownListItem）。同名不能注册两份。
    listItem: false,
    // 块拖拽的落点指示。颜色用主题变量（拖拽光标插在编辑器里，能读到 --tmr-accent）。
    dropcursor: { color: 'var(--tmr-accent, #ff6719)', width: 2 },
  }),
  MarkdownParagraph,
  MarkdownHeading,
  MarkdownListItem,
  OrderedListWithNumbering,
  // 段落级样式：文字对齐用官方扩展（免费）；缩进 / 行高自研（官方无此扩展）。
  // 三者都往节点 style 上写片段，tiptap 的 mergeAttributes 对 style 做拼接合并。
  TextAlign.configure({ types: [MarkdownParagraph.name, MarkdownHeading.name] }),
  ParagraphStyles.configure({
    types: [MarkdownParagraph.name, MarkdownHeading.name],
  }),
  InlineCode,
  MarkdownTextStyle,
  Color.configure({ types: [TextStyle.name] }),
  // 正文字号：官方 FontSize（v3 起并入 text-style 包），以内联样式挂在 TextStyle
  // 的 <span> 上（如 style="font-size: 16px"），与 Color 同基座，三端共用。
  FontSize.configure({ types: [TextStyle.name] }),
  MarkdownHighlight.configure({ multicolor: true }),
  MarkdownSuperscript,
  MarkdownSubscript,
  TableKit.configure({
    table: {
      resizable: true,
      // SSR/renderHTML 默认不包 wrapper；阅读页无 NodeView 时宽表会被挤扁。
      // 与编辑器 TableView 的 `.tableWrapper` 对齐，静态 HTML 也可 overflow-x。
      renderWrapper: true,
    },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  DetailsBlock,
  DetailsSummary,
  DetailsContent,
  reportInlineMath,
  reportBlockMath,
  // 表情节点：`:shortcode:` 往返。建议列表是编辑器上的 configure，不进这份 schema。
  MarkdownEmoji,
];
