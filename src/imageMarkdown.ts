import type {
  JSONContent,
  MarkdownParseHelpers,
  MarkdownToken,
  MarkdownTokenizer,
} from '@tiptap/core';
// renderHTML 期望的是 prosemirror 的 DOMOutputSpec（支持多子节点数组），
// 不是 tiptap 那个单链递归的 DOMOutputSpecArray
import type { DOMOutputSpec } from '@tiptap/pm/model';

/**
 * 图片节点的 markdown 往返（客户端 / 预览 / server 三端共用）。
 *
 * 尺寸（拖拽缩放的产物，整数像素）、对齐（`data-align`）与描述（图注）在 markdown 里
 * 都没有原生语法，HTML 是唯一能带上它们的 CommonMark 合法形式：
 * `<img src="…" alt="…" width="300" data-align="center">`，
 * 带描述时再包一层 `<figure><img …><figcaption>…</figcaption></figure>`（HTML 标准语义，
 * GitHub 同样认）。因此：
 *
 * - 序列化：**只有带尺寸 / 对齐 / 描述的图**输出 HTML 形式；没动过的图保持标准
 *   `![alt](src "title")`，markdown 不为没用过的功能付可读性代价。
 * - 解析：自建 block 级 tokenizer 认领 `<img …>` 与 `<figure>…</figure>`（一个扩展
 *   只能挂一个 tokenizer）。不认领的话，客户端靠 `window.DOMParser` 隐式还原、
 *   server 端没有 window 会把它转义成字面文本（与 sup/sub 当初踩的是同一条边界）。
 *
 * 对齐的属性名用 `data-align`（attrs 里叫 `align`）：与官方 image-align-button
 * 约定的属性名一致，宿主已有的 `img[data-align]` 样式可以直接吃。
 */

/** 图片尺寸（整数像素）；无尺寸为 null。 */
export interface ImageSizeAttrs {
  width?: number | null;
  height?: number | null;
}

/** 图片对齐（HTML 属性 `data-align`，与官方 image-align-button 同名）。 */
export type ImageAlign = 'left' | 'center' | 'right';

const IMAGE_ALIGN_VALUES = new Set<string>(['left', 'center', 'right']);

/** 归一化对齐值：只认 left / center / right，其余（含空、任意脏值）为 null。 */
export function normalizeImageAlign(value: unknown): ImageAlign | null {
  return typeof value === 'string' && IMAGE_ALIGN_VALUES.has(value)
    ? (value as ImageAlign)
    : null;
}

/**
 * `align` 属性的共享配置（编辑器增强版与 pureImage 都挂它）：attrs 名语义化、
 * HTML 渲染成 `data-align`。两份扩展都必须挂——attrs 只声明在扩展上，
 * markdown 解析出的 `align` 才有地方落。
 */
export const imageAlignAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) =>
    normalizeImageAlign(element.getAttribute('data-align')),
  renderHTML: (attributes: Record<string, unknown>) => {
    const align = normalizeImageAlign(attributes.align);
    return align ? { 'data-align': align } : {};
  },
};

/**
 * `caption`（图注）属性的共享配置：不进 img 标签（是节点级 renderHTML 包的
 * `<figure>/<figcaption>` 结构），解析侧从 figure 里读。
 */
export const imageCaptionAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) => {
    // 匹配到 img 时从它所在的 figure 里取（figure 规则通常已用 getAttrs 给全，
    // 这里是 HTML 粘贴的兜底）
    const figure = element.closest('figure');
    return normalizeImageCaption(
      figure?.querySelector('figcaption')?.textContent ?? null,
    );
  },
  renderHTML: () => ({}),
};

/**
 * 节点级 HTML 渲染：有描述时输出 `<figure><img …><figcaption>…</figcaption></figure>`
 * （HTML 标准语义），否则维持官方单 `<img>` 结构。两份扩展共用。
 */
export function imageNodeHtml(output: {
  attrs: Record<string, unknown>;
  htmlAttributes: Record<string, unknown>;
}): DOMOutputSpec {
  const caption = normalizeImageCaption(output.attrs.caption);
  if (!caption) return ['img', output.htmlAttributes];
  // 多子节点直接展开跟在元素后面（嵌套数组会被 prosemirror 的 renderSpec 判为非法）
  return [
    'figure',
    { class: 'tmr-image-figure' },
    ['img', output.htmlAttributes],
    ['figcaption', { class: 'tmr-image-caption' }, caption],
  ];
}

/**
 * `<figure><img …><figcaption>…</figcaption></figure>` 的 parse 规则（两份扩展共用，
 * 要排在 `img[src]` 规则之前）。读子 img 的全部属性 + figcaption 的纯文本描述。
 */
export function imageFigureParseRule(): {
  tag: string;
  getAttrs: (element: HTMLElement) => Record<string, unknown> | false;
} {
  return {
    tag: 'figure',
    getAttrs: (element: HTMLElement) => {
      const img = element.querySelector('img');
      if (!img) return false;
      const caption = element.querySelector('figcaption');
      return {
        src: img.getAttribute('src'),
        alt: img.getAttribute('alt'),
        title: img.getAttribute('title'),
        width: toPixel(img.getAttribute('width')),
        height: toPixel(img.getAttribute('height')),
        align: normalizeImageAlign(img.getAttribute('data-align')),
        caption: normalizeImageCaption(caption?.textContent ?? null),
      };
    },
  };
}

/** 从 HTML 属性串里取一个属性值；双引号 / 单引号 / 无引号都认。 */
function attrValue(attrs: string, name: string): string | null {
  const pattern = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`,
    'i',
  );
  const match = pattern.exec(attrs);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? null;
}

/** 常见实体还原（`&amp;` / `&quot;` 等），与序列化侧的转义对称。 */
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m);
}

/** 属性值最小转义（`&` 与 `"` 必须转，其余顺手，保证与 decodeEntities 对称）。 */
function encodeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** 文本节点最小转义（属性无关的 `"` 不用转）。 */
function encodeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** 图片描述（图注）归一化：去掉首尾空白，空串归 null。 */
export function normalizeImageCaption(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text === '' ? null : text;
}

/** HTML 宽高只认纯数字（`50%` / `auto` 这类留给 CSS，不当作像素尺寸）。 */
function toPixel(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/**
 * 图片的 markdown 序列化：带尺寸 / 对齐 / 描述的输出 HTML 形式，否则标准语法。
 * 描述（图注）用 `<figure>` + `<figcaption>` 包裹（HTML 标准语义，GitHub 同样认）；
 * 覆盖 @tiptap/extension-image 的内置实现（它只输出 src/alt/title，其余都会丢）。
 */
export function imageRenderMarkdown(node: {
  attrs?: Record<string, unknown>;
}): string {
  const attrs = node.attrs ?? {};
  const src = typeof attrs.src === 'string' ? attrs.src : '';
  const alt = typeof attrs.alt === 'string' ? attrs.alt : '';
  const title = typeof attrs.title === 'string' ? attrs.title : '';
  const width = toPixel(attrs.width == null ? null : String(attrs.width));
  const height = toPixel(attrs.height == null ? null : String(attrs.height));
  const align = normalizeImageAlign(attrs.align);
  const caption = normalizeImageCaption(attrs.caption);

  if (width == null && height == null && !align && !caption) {
    return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
  }

  const parts = [`src="${encodeAttr(src)}"`];
  if (alt) parts.push(`alt="${encodeAttr(alt)}"`);
  if (title) parts.push(`title="${encodeAttr(title)}"`);
  if (width != null) parts.push(`width="${width}"`);
  if (height != null) parts.push(`height="${height}"`);
  if (align) parts.push(`data-align="${align}"`);
  const imgTag = `<img ${parts.join(' ')}>`;

  if (!caption) return imgTag;
  return `<figure>\n${imgTag}\n<figcaption>${encodeText(caption)}</figcaption>\n</figure>`;
}

/** 从 `<img …>` 的属性串里抽一个 token 需要的一切（figure / 裸 img 两种形态共用）。 */
function imageTokenFromImgTag(
  raw: string,
  attrsString: string,
  caption: string | null = null,
): MarkdownToken | undefined {
  const srcValue = attrValue(attrsString, 'src');
  if (!srcValue) return undefined;
  const alt = attrValue(attrsString, 'alt');
  const title = attrValue(attrsString, 'title');
  return {
    type: 'image',
    raw,
    src: decodeEntities(srcValue),
    alt: alt == null ? null : decodeEntities(alt),
    title: title == null ? null : decodeEntities(title),
    width: toPixel(attrValue(attrsString, 'width')),
    height: toPixel(attrValue(attrsString, 'height')),
    align: normalizeImageAlign(attrValue(attrsString, 'data-align')),
    caption,
  };
}

/**
 * 认领独占一行的 `<img …>` 与 `<figure>…</figure>`（block 级 tokenizer，一个扩展
 * 只能挂一个 tokenizer，所以两种形态都归它管）。属性在 tokenize 里就抽好，
 * `parseMarkdown` 只做搬运——与 CitationRef 的 tokenizer 同一套写法。
 */
export const imageMarkdownTokenizer: MarkdownTokenizer = {
  name: 'image',
  level: 'block',
  start(src) {
    const figure = /<figure[\s>]/i.exec(src);
    const img = /<img[\s>]/i.exec(src);
    const indexes = [figure?.index, img?.index].filter(
      (index): index is number => index != null,
    );
    return indexes.length ? Math.min(...indexes) : -1;
  },
  tokenize(src) {
    // 带描述的形式（本库写出的：figure > img + figcaption）
    const figure = /^<figure\s*>([\s\S]*?)<\/figure\s*>/i.exec(src);
    if (figure) {
      const inner = figure[1] ?? '';
      const img = /<img\s+([^>]*?)\s*\/?>/.exec(inner);
      if (!img) return undefined;
      const cap = /<figcaption[^>]*>([\s\S]*?)<\/figcaption\s*>/i.exec(inner);
      // 外部 markdown 的 figcaption 可能带内部标签：只取纯文本
      const caption = cap
        ? normalizeImageCaption(
            decodeEntities((cap[1] ?? '').replace(/<[^>]*>/g, '')),
          )
        : null;
      return imageTokenFromImgTag(figure[0], img[1] ?? '', caption);
    }
    // 裸 `<img …>` 形态
    const match = /^<img\s+([^>]*?)\s*\/?>/.exec(src);
    if (!match) return undefined;
    return imageTokenFromImgTag(match[0], match[1] ?? '');
  },
};

/** 把上面认领的 token 还原成 image 节点（含尺寸、对齐与描述）。 */
export function imageParseMarkdown(
  token: MarkdownToken,
  helpers: MarkdownParseHelpers,
): JSONContent {
  // 两种 token 形态：标准 `![alt](src "title")` 走 marked 的 image token
  // （字段是 href / text / title），本库 tokenizer 认领的 `<img …>` / `<figure>` 用 src / alt。
  const src = typeof token.src === 'string' ? token.src : token.href ?? null;
  const alt = typeof token.alt === 'string' ? token.alt : token.text ?? null;
  return helpers.createNode('image', {
    src,
    alt,
    title: token.title ?? null,
    width: token.width ?? null,
    height: token.height ?? null,
    align: token.align ?? null,
    caption: normalizeImageCaption(token.caption),
  });
}
