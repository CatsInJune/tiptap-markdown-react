import { OrderedList } from '@tiptap/extension-list';
import type { Editor, JSONContent, MarkdownToken, MarkdownTokenizer } from '@tiptap/core';
import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';

/**
 * 有序列表的编号格式。id 与下拉预览对齐 Tiptap Numbering Format Dropdown：
 * https://tiptap.dev/docs/ui-components/components/numbering-format-dropdown-menu
 *
 * 格式只记在「这一层编号阶梯」最外层的 orderedList 上（`data-numbering-format`）。
 * 嵌套的 ol 不再单独记格式，屏幕上的 1. / a. / i. 由 CSS 计数器按深度画出来。
 * 官方实现在 `@tiptap-pro/extension-convert-kit`，这里不引 Pro 包，schema 约定与它对齐。
 */
export const NUMBERING_FORMAT_IDS = [
  'decimal',
  'decimal-paren',
  'decimal-nested',
  'upper-alpha',
  'lower-alpha',
  'upper-roman',
  'lower-roman',
  'decimal-zero',
] as const;

export type NumberingFormat = (typeof NUMBERING_FORMAT_IDS)[number];

/** 菜单项的无障碍名，也是官方 `getFormatLabel` 的预览串。 */
export const NUMBERING_FORMAT_LABELS: Record<NumberingFormat, string> = {
  decimal: '1. 2. 3.',
  'decimal-paren': '1) 2) 3)',
  'decimal-nested': '1. 1.1. 1.1.1.',
  'upper-alpha': 'A. B. C.',
  'lower-alpha': 'a. b. c.',
  'upper-roman': 'I. II. III.',
  'lower-roman': 'i. ii. iii.',
  'decimal-zero': '01. 02. 03.',
};

/** 下拉里每张小卡片的五行预览（深度 1–3），与官方 demo 的 marker 一致。 */
export const NUMBERING_FORMAT_PREVIEWS: Record<
  NumberingFormat,
  { depth: 1 | 2 | 3; marker: string }[]
> = {
  decimal: [
    { depth: 1, marker: '1.' },
    { depth: 2, marker: 'a.' },
    { depth: 2, marker: 'b.' },
    { depth: 3, marker: 'i.' },
    { depth: 1, marker: '2.' },
  ],
  'decimal-paren': [
    { depth: 1, marker: '1)' },
    { depth: 2, marker: 'a)' },
    { depth: 2, marker: 'b)' },
    { depth: 3, marker: 'i)' },
    { depth: 1, marker: '2)' },
  ],
  'decimal-nested': [
    { depth: 1, marker: '1.' },
    { depth: 2, marker: '1.1.' },
    { depth: 2, marker: '1.2.' },
    { depth: 3, marker: '1.2.1.' },
    { depth: 1, marker: '2.' },
  ],
  'upper-alpha': [
    { depth: 1, marker: 'A.' },
    { depth: 2, marker: 'a.' },
    { depth: 2, marker: 'b.' },
    { depth: 3, marker: 'i.' },
    { depth: 1, marker: 'B.' },
  ],
  'lower-alpha': [
    { depth: 1, marker: 'a.' },
    { depth: 2, marker: '1.' },
    { depth: 2, marker: '2.' },
    { depth: 3, marker: 'i.' },
    { depth: 1, marker: 'b.' },
  ],
  'upper-roman': [
    { depth: 1, marker: 'I.' },
    { depth: 2, marker: 'A.' },
    { depth: 2, marker: 'B.' },
    { depth: 3, marker: '1.' },
    { depth: 1, marker: 'II.' },
  ],
  'lower-roman': [
    { depth: 1, marker: 'i.' },
    { depth: 2, marker: '1.' },
    { depth: 2, marker: '2.' },
    { depth: 3, marker: 'a.' },
    { depth: 1, marker: 'ii.' },
  ],
  'decimal-zero': [
    { depth: 1, marker: '01.' },
    { depth: 2, marker: 'a.' },
    { depth: 2, marker: 'b.' },
    { depth: 3, marker: 'i.' },
    { depth: 1, marker: '02.' },
  ],
};

type CounterStyle =
  | 'decimal'
  | 'decimal-leading-zero'
  | 'lower-alpha'
  | 'upper-alpha'
  | 'lower-roman'
  | 'upper-roman';

interface NumberingLevel {
  style: CounterStyle;
  /** self：只画本层计数；chain：把祖先计数拼在前面（1.2.1.）。 */
  template: 'self' | 'chain';
  suffix: '.' | ')';
}

/** 每套格式 3 层一循环，和 Word / 官方 demo 的预览一致。更深的层按 3 取模重复。 */
const NUMBERING_LEVELS: Record<NumberingFormat, NumberingLevel[]> = {
  decimal: [
    { style: 'decimal', template: 'self', suffix: '.' },
    { style: 'lower-alpha', template: 'self', suffix: '.' },
    { style: 'lower-roman', template: 'self', suffix: '.' },
  ],
  'decimal-paren': [
    { style: 'decimal', template: 'self', suffix: ')' },
    { style: 'lower-alpha', template: 'self', suffix: ')' },
    { style: 'lower-roman', template: 'self', suffix: ')' },
  ],
  'decimal-nested': [
    { style: 'decimal', template: 'chain', suffix: '.' },
    { style: 'decimal', template: 'chain', suffix: '.' },
    { style: 'decimal', template: 'chain', suffix: '.' },
  ],
  'upper-alpha': [
    { style: 'upper-alpha', template: 'self', suffix: '.' },
    { style: 'lower-alpha', template: 'self', suffix: '.' },
    { style: 'lower-roman', template: 'self', suffix: '.' },
  ],
  'lower-alpha': [
    { style: 'lower-alpha', template: 'self', suffix: '.' },
    { style: 'decimal', template: 'self', suffix: '.' },
    { style: 'lower-roman', template: 'self', suffix: '.' },
  ],
  'upper-roman': [
    { style: 'upper-roman', template: 'self', suffix: '.' },
    { style: 'upper-alpha', template: 'self', suffix: '.' },
    { style: 'decimal', template: 'self', suffix: '.' },
  ],
  'lower-roman': [
    { style: 'lower-roman', template: 'self', suffix: '.' },
    { style: 'decimal', template: 'self', suffix: '.' },
    { style: 'lower-alpha', template: 'self', suffix: '.' },
  ],
  'decimal-zero': [
    { style: 'decimal-leading-zero', template: 'self', suffix: '.' },
    { style: 'lower-alpha', template: 'self', suffix: '.' },
    { style: 'lower-roman', template: 'self', suffix: '.' },
  ],
};

/** 编辑器里实际画出的嵌套深度（0 起算）。再深的列表继续按 3 层循环。 */
const NUMBERING_DEPTHS = 6;

const OTHER_LISTS = new Set(['bulletList', 'taskList']);

export function isNumberingFormat(value: unknown): value is NumberingFormat {
  return (
    typeof value === 'string' &&
    (NUMBERING_FORMAT_IDS as readonly string[]).includes(value)
  );
}

function counterName(format: NumberingFormat, depth: number): string {
  return `tmr-${format}-${depth}`;
}

function counterFn(format: NumberingFormat, depth: number): string {
  const level = NUMBERING_LEVELS[format][depth % NUMBERING_LEVELS[format].length];
  const name = counterName(format, depth);
  if (!level || level.style === 'decimal') return `counter(${name})`;
  return `counter(${name}, ${level.style})`;
}

/** `li::before` 的 content 值（不含 `content:` 前缀）。 */
export function numberingMarkerContent(
  format: NumberingFormat,
  depth: number,
): string {
  const levels = NUMBERING_LEVELS[format];
  const level = levels[depth % levels.length];
  if (!level) return 'counter(tmr-decimal-0) "."';
  const suffix = level.suffix === ')' ? '")"' : '"."';
  if (level.template === 'chain') {
    const parts: string[] = [];
    for (let i = 0; i <= depth; i += 1) {
      parts.push(counterFn(format, i), suffix);
    }
    return parts.join(' ');
  }
  return `${counterFn(format, depth)} ${suffix}`;
}

function olSelector(format: NumberingFormat, depth: number): string {
  let selector = `ol[data-numbering-format='${format}']`;
  for (let i = 0; i < depth; i += 1) {
    selector += ' > li > ol:not([data-numbering-format])';
  }
  return selector;
}

/**
 * 编号阶梯的正文 CSS。挂在 `.editorContent` 下，压过通用 `ol { list-style: decimal }`。
 * 由测试盯住：改层级定义后要同步 `content.module.css` 里夹在标记注释之间的这段。
 */
export function buildNumberingFormatCss(): string {
  const rules: string[] = [
    `.editorContent :global(ol[data-numbering-format] > li > p),
.editorContent :global(ol[data-numbering-format] ol > li > p) {
  margin-top: 0;
}
/* li 是 grid，嵌套 ol 的 0.7em 外边距不会和上一段塌缩，上下层会叠成约 1.4em。
   清掉后只留段落自己的 0.7em，和普通列表一致。 */
.editorContent :global(ol[data-numbering-format] ol) {
  margin-top: 0;
  margin-bottom: 0;
}`,
  ];

  for (const format of NUMBERING_FORMAT_IDS) {
    for (let depth = 0; depth < NUMBERING_DEPTHS; depth += 1) {
      const ol = olSelector(format, depth);
      const name = counterName(format, depth);
      rules.push(
        `.editorContent :global(${ol}) {
  list-style: none;
  padding-left: 0;
  counter-reset: ${name} 0;
}
.editorContent :global(${ol} > li) {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 0.45em;
  align-items: baseline;
  counter-increment: ${name};
}
.editorContent :global(${ol} > li::marker) {
  content: none;
}
.editorContent :global(${ol} > li::before) {
  content: ${numberingMarkerContent(format, depth)};
  grid-column: 1;
  grid-row: 1;
  white-space: nowrap;
}
.editorContent :global(${ol} > li > *) {
  grid-column: 2;
  min-width: 0;
}`,
      );
    }
  }

  return rules.join('\n\n');
}

export const NUMBERING_FORMAT_CSS = buildNumberingFormatCss();

const parentTokenizer = (
  OrderedList.config as { markdownTokenizer?: MarkdownTokenizer }
).markdownTokenizer;

const HTML_LIST_RE =
  /^<ol data-numbering-format="([a-z0-9-]+)">\n+([\s\S]*?)\n+<\/ol>(?:\n+|$)/;

/**
 * 带格式的列表序列化成 HTML 外壳，里面仍是普通 markdown 列表。
 * 外壳只负责把 format id 留下来；标记长什么样由 CSS 决定，不写进每一行的 `1.` / `a.`。
 * 认领这段 HTML，避免落到默认 HTML tokenizer（server 端没有 DOMParser，会把标签转义成字面文本）。
 */
const numberingMarkdownTokenizer: MarkdownTokenizer = {
  name: 'orderedList',
  level: 'block',
  start(src) {
    const match = /<ol data-numbering-format="[a-z0-9-]+">/.exec(src);
    return match ? match.index : -1;
  },
  tokenize(src, tokens, lexer) {
    const match = HTML_LIST_RE.exec(src);
    if (match && isNumberingFormat(match[1]) && parentTokenizer) {
      const inner = match[2] ?? '';
      const parsed = parentTokenizer.tokenize(
        inner.endsWith('\n') ? inner : `${inner}\n`,
        tokens,
        lexer,
      );
      if (parsed?.type) {
        return {
          ...parsed,
          numberingFormat: match[1],
          raw: match[0],
        };
      }
    }
    return parentTokenizer?.tokenize(src, tokens, lexer);
  },
};

/**
 * 从光标向外找「本层编号阶梯」最外层的 orderedList。
 * 中途碰到无序 / 任务列表就停——另一种列表会把阶梯切断，里面的 ol 自己是最外层。
 * 返回的是 `$from` 的深度，不在有序列表里则为 null。
 */
export function numberingListDepth($pos: ResolvedPos): number | null {
  let target: number | null = null;
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const name = $pos.node(depth).type.name;
    if (OTHER_LISTS.has(name)) break;
    if (name === 'orderedList') target = depth;
  }
  return target;
}

function hasOrderedListAncestor(doc: ProseMirrorNode, pos: number): boolean {
  const $pos = doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const name = $pos.node(depth).type.name;
    if (OTHER_LISTS.has(name)) return false;
    if (name === 'orderedList') return true;
  }
  return false;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    numberingFormat: {
      /**
       * 把当前编号阶梯最外层列表改成指定格式。不在有序列表里时返回 false。
       * 传 null 清除格式（回到浏览器默认的 1. 2. 3.）。
       */
      setOrderedListNumberingFormat: (
        format: NumberingFormat | null,
      ) => ReturnType;
      /**
       * 不在有序列表里：先开列表再套上格式。
       * 已经在本层阶梯里：与 `toggleOrderedList` 一样把列表关掉。
       */
      toggleOrderedListWithFormat: (format: NumberingFormat) => ReturnType;
    };
  }
}

/** extend 里非 add* 方法的 this 上，类型没带 parent，运行时是有的。 */
function callParent<T>(self: object, ...args: unknown[]): T | undefined {
  const parent = (self as { parent?: (...a: unknown[]) => T }).parent;
  return parent?.(...args);
}

/**
 * StarterKit 的 OrderedList 加上 `numberingFormat`。节点名仍是 orderedList，
 * 所以要在 StarterKit 里关掉内置那份，避免 Duplicate extension names。
 */
export const OrderedListWithNumbering = OrderedList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      numberingFormat: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute('data-numbering-format');
          return isNumberingFormat(value) ? value : null;
        },
        renderHTML: (attributes: { numberingFormat?: unknown }) => {
          if (!isNumberingFormat(attributes.numberingFormat)) return {};
          return { 'data-numbering-format': attributes.numberingFormat };
        },
      },
    };
  },

  renderHTML(props: {
    node: ProseMirrorNode;
    HTMLAttributes: Record<string, unknown>;
  }) {
    const rendered = callParent<[string, Record<string, string>, number]>(
      this,
      props,
    );
    if (!rendered) return ['ol', props.HTMLAttributes, 0];
    const format = props.node.attrs.numberingFormat;
    const start = Number(props.node.attrs.start);
    // 样式表把计数器从 0 重置（下一号是 1）。列表本身 start≠1 时用行内样式盖住第 0 层。
    if (isNumberingFormat(format) && Number.isFinite(start) && start > 1) {
      const reset = `counter-reset: ${counterName(format, 0)} ${start - 1}`;
      const attrs = rendered[1];
      attrs.style = attrs.style ? `${attrs.style}; ${reset}` : reset;
    }
    return rendered;
  },

  renderMarkdown(
    node: JSONContent,
    helpers: { renderChildren: (nodes: JSONContent | JSONContent[], separator?: string) => string },
    ctx?: unknown,
  ) {
    const body =
      callParent<string>(this, node, helpers, ctx) ??
      helpers.renderChildren(node.content ?? [], '\n');
    const format = (node.attrs as { numberingFormat?: unknown } | undefined)
      ?.numberingFormat;
    if (!isNumberingFormat(format)) return body;
    const inner = body.replace(/^\n+/, '').replace(/\s+$/, '');
    return `<ol data-numbering-format="${format}">\n\n${inner}\n\n</ol>\n`;
  },

  parseMarkdown(
    token: MarkdownToken,
    helpers: { parseChildren: (tokens: MarkdownToken[]) => JSONContent[] },
  ) {
    const parsed = callParent<JSONContent | JSONContent[] | null>(
      this,
      token,
      helpers,
    );
    if (!isNumberingFormat(token.numberingFormat) || !parsed || Array.isArray(parsed)) {
      return parsed ?? [];
    }
    if (parsed.type !== 'orderedList') return parsed;
    return {
      ...parsed,
      attrs: { ...parsed.attrs, numberingFormat: token.numberingFormat },
    };
  },

  markdownTokenizer: numberingMarkdownTokenizer,

  addCommands() {
    return {
      ...this.parent?.(),
      setOrderedListNumberingFormat:
        (format: NumberingFormat | null) =>
        ({ state, tr, dispatch }) => {
          if (format != null && !isNumberingFormat(format)) return false;
          const depth = numberingListDepth(state.selection.$from);
          if (depth == null) return false;
          const node = state.selection.$from.node(depth);
          if (node.attrs.numberingFormat === format) return true;
          if (dispatch) {
            tr.setNodeMarkup(state.selection.$from.before(depth), undefined, {
              ...node.attrs,
              numberingFormat: format,
            });
            dispatch(tr);
          }
          return true;
        },
      toggleOrderedListWithFormat:
        (format: NumberingFormat) =>
        ({ state, chain, commands }) => {
          if (!isNumberingFormat(format)) return false;
          if (numberingListDepth(state.selection.$from) != null) {
            return commands.toggleOrderedList();
          }
          return chain()
            .toggleOrderedList()
            .command(({ tr, state: next }) => {
              const depth = numberingListDepth(next.selection.$from);
              if (depth == null) return false;
              const node = next.selection.$from.node(depth);
              tr.setNodeMarkup(next.selection.$from.before(depth), undefined, {
                ...node.attrs,
                numberingFormat: format,
              });
              return true;
            })
            .run();
        },
    };
  },

  addProseMirrorPlugins() {
    const parent = this.parent?.() ?? [];
    return [
      ...parent,
      new Plugin({
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const fixes: { pos: number; attrs: Record<string, unknown> }[] = [];
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'orderedList') return;
            if (!isNumberingFormat(node.attrs.numberingFormat)) return;
            if (!hasOrderedListAncestor(newState.doc, pos)) return;
            fixes.push({
              pos,
              attrs: { ...node.attrs, numberingFormat: null },
            });
          });
          if (fixes.length === 0) return null;
          const tr = newState.tr;
          for (const fix of fixes) tr.setNodeMarkup(fix.pos, undefined, fix.attrs);
          return tr;
        },
      }),
    ];
  },
});

/** 光标所在编号阶梯的格式；不在有序列表里，或列表没设格式时为 null。 */
export function readCurrentNumberingFormat(editor: {
  state: { selection: { $from: ResolvedPos } };
}): NumberingFormat | null {
  const depth = numberingListDepth(editor.state.selection.$from);
  if (depth == null) return null;
  const value = editor.state.selection.$from.node(depth).attrs.numberingFormat;
  return isNumberingFormat(value) ? value : null;
}

/**
 * 工具栏「选一个编号格式」：已经在有序列表里就改最外层，否则新开一个带该格式的列表。
 */
export function applyNumberingFormat(
  editor: Editor,
  format: NumberingFormat,
): boolean {
  const chain = editor.chain().focus();
  if (editor.can().setOrderedListNumberingFormat(null)) {
    return chain.setOrderedListNumberingFormat(format).run();
  }
  return chain.toggleOrderedListWithFormat(format).run();
}
