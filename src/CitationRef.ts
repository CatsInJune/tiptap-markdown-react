import { mergeAttributes, Node } from '@tiptap/core';

export interface CitationRefOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citationRef: {
      insertCitationRef: (attrs: {
        index: string;
        url?: string | null;
        title?: string | null;
      }) => ReturnType;
    };
  }
}

/**
 * 脚注/引文引用——inline atom 节点。
 *
 * - 输入：`[^n]`（markdownTokenizer）或 `<span class="citation-ref">`（parseHTML）
 * - 输出 HTML：居中圆形 pill（CSS `.citation-ref`），**不是**上下标
 * - 输出 markdown：`[^n]`
 *
 * Popover /「原文片段」由消费方通过 {@link createCitationRef} 的 `renderCitation`
 * 插槽完成；本节点只负责标记与默认圆标样式。
 */
export const CitationRef = Node.create<CitationRefOptions>({
  name: 'citationRef',

  group: 'inline',

  inline: true,

  atom: true,

  selectable: true,

  // 高于普通链接，确保 `[^1]` 不被拆成残缺 link
  priority: 1000,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      index: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-index'),
        renderHTML: (attributes) => {
          if (!attributes.index) return {};
          return { 'data-index': attributes.index };
        },
      },
      url: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-url'),
        renderHTML: (attributes) => {
          if (!attributes.url) return {};
          return { 'data-url': attributes.url };
        },
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-title'),
        renderHTML: (attributes) => {
          if (!attributes.title) return {};
          return { 'data-title': attributes.title };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span.citation-ref' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const index = String(node.attrs.index ?? '');
    const url = node.attrs.url as string | null;
    const title = (node.attrs.title as string | null) || '';
    const attrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      class: 'citation-ref',
    });

    if (url) {
      return [
        'span',
        attrs,
        [
          'a',
          {
            href: url,
            title,
            target: '_blank',
            rel: 'noopener noreferrer',
          },
          index,
        ],
      ];
    }

    return ['span', attrs, index];
  },

  renderMarkdown(node) {
    return `[^${node?.attrs?.index ?? ''}]`;
  },

  parseMarkdown: (token, helpers) => {
    return helpers.createNode('citationRef', {
      index: String(token.index ?? ''),
      url: token.url ?? null,
      title: token.title ?? null,
    });
  },

  markdownTokenizer: {
    name: 'citationRef',
    level: 'inline' as const,
    start(src: string) {
      const match = /\[\^\d+\]/.exec(src);
      return match?.index ?? -1;
    },
    tokenize(src) {
      const match = /^\[\^(\d+)\]/.exec(src);
      if (!match) return undefined;
      return {
        type: 'citationRef',
        raw: match[0],
        index: match[1],
      };
    },
  },

  addCommands() {
    return {
      insertCitationRef:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              index: attrs.index,
              url: attrs.url ?? null,
              title: attrs.title ?? null,
            },
          }),
    };
  },
});
