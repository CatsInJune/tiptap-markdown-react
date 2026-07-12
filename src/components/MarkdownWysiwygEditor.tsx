'use client';

import CodeBlockLowlight, {
  type CodeBlockLowlightOptions,
} from '@tiptap/extension-code-block-lowlight';
import Image from '@tiptap/extension-image';
import { TableOfContents } from '@tiptap/extension-table-of-contents';
import { Markdown } from '@tiptap/markdown';
import {
  EditorContent,
  ReactNodeViewRenderer,
  useEditor,
  type AnyExtension,
  type Editor,
} from '@tiptap/react';
import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { baseExtensions, lowlight } from '../extensions';
import type { CodeBlockLabels } from '../labels';
import styles from '../styles/content.module.css';
import type { TocItem } from '../toc/extractToc';
import { makeTocGetId } from '../toc/tocSlug';
import { CodeBlockView } from './CodeBlockView';

// 带语言选择器的代码块（自定义 React NodeView）。base 不含代码块，此增强版由编辑器注入。
// addOptions 追加 codeBlockLabels，供 CodeBlockView 读取以本地化文案。
type CodeBlockOptions = CodeBlockLowlightOptions & {
  codeBlockLabels?: Partial<CodeBlockLabels>;
};

const CodeBlock = CodeBlockLowlight.extend<CodeBlockOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      codeBlockLabels: undefined,
    } as CodeBlockOptions;
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { state } = this.editor;
        const { selection } = state;
        const { empty, $anchor } = selection;

        // 1) 光标在「非空代码块」内容最前面：拦截，防止拆块漏文字（空块放行可删）
        if (
          empty &&
          $anchor.parent.type.name === this.name &&
          $anchor.parentOffset === 0 &&
          $anchor.parent.content.size > 0
        ) {
          return true;
        }

        // 2) 光标在「代码块后方块」的开头：先选中整个代码块（二次确认），不直接删
        if (empty && $anchor.parentOffset === 0) {
          const before = $anchor.before($anchor.depth);
          const prevNode = state.doc.resolve(before).nodeBefore;
          if (prevNode?.type.name === this.name) {
            const codeBlockPos = before - prevNode.nodeSize;
            this.editor.chain().setNodeSelection(codeBlockPos).run();
            return true;
          }
        }

        return false;
      },
    };
  },
});

// 块级图片：Backspace 二次确认删除（与代码块一致）。
const ImageWithConfirmDelete = Image.extend({
  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { state } = this.editor;
        const { selection } = state;
        const { empty, $anchor } = selection;
        if (empty) {
          const nodeBefore = $anchor.nodeBefore;
          if (nodeBefore?.type.name === this.name) {
            const imagePos = $anchor.pos - nodeBefore.nodeSize;
            this.editor.chain().setNodeSelection(imagePos).run();
            return true;
          }
        }
        return false;
      },
    };
  },
});

export interface MarkdownWysiwygEditorHandle {
  /** 取当前正文的 markdown 字符串。 */
  getMarkdown: () => string;
  /** 取当前正文的 HTML 字符串。 */
  getHTML: () => string;
  /** 取当前正文的 Tiptap JSON。 */
  getJSON: () => Record<string, unknown>;
  /** 底层 Tiptap Editor 实例（可能为 null，未就绪时）。 */
  getEditor: () => Editor | null;
}

export interface MarkdownWysiwygEditorProps {
  /** 初始 markdown 内容。 */
  initialMarkdown?: string;
  placeholder?: string;
  /** editor 实例就绪 / 销毁时回调，供外部工具栏使用。 */
  onEditorReady?: (editor: Editor | null) => void;
  /** 目录变化回调（正文标题增删改时），供侧边目录实时展示。 */
  onTocChange?: (items: TocItem[]) => void;
  /** 追加的 Tiptap 扩展（在内置扩展之后注册）。 */
  extraExtensions?: AnyExtension[];
  /** 代码块 NodeView 的本地化文案。 */
  codeBlockLabels?: Partial<CodeBlockLabels>;
  /** 附加到滚动容器的 class。 */
  className?: string;
}

/**
 * 所见即所得 Markdown 编辑器（基于 Tiptap v3 + 官方 @tiptap/markdown）。
 * 内容进出均为 markdown 字符串。工具栏由外部渲染——通过 onEditorReady 拿到 editor 实例。
 */
export const MarkdownWysiwygEditor = forwardRef<
  MarkdownWysiwygEditorHandle,
  MarkdownWysiwygEditorProps
>(function MarkdownWysiwygEditor(
  {
    initialMarkdown = '',
    placeholder,
    onEditorReady,
    onTocChange,
    extraExtensions,
    codeBlockLabels,
    className,
  },
  ref,
) {
  const editor = useEditor({
    extensions: [
      ...baseExtensions,
      CodeBlock.configure({ lowlight, codeBlockLabels }),
      ImageWithConfirmDelete.configure({ inline: false }),
      Markdown,
      TableOfContents.configure({
        getId: makeTocGetId(),
        onUpdate: (anchors) => {
          onTocChange?.(
            anchors
              .filter((a) => a.level <= 6)
              .map((a) => ({ id: a.id, level: a.level, text: a.textContent })),
          );
        },
      }),
      ...(extraExtensions ?? []),
    ],
    content: initialMarkdown,
    contentType: 'markdown',
    // Next.js SSR：服务端不立即渲染，避免 hydration 不一致
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: styles.editorContent,
        'data-placeholder': placeholder ?? '',
      },
    },
  });

  useEffect(() => {
    onEditorReady?.(editor);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  useImperativeHandle(
    ref,
    () => ({
      getMarkdown: () => editor?.getMarkdown?.() ?? '',
      getHTML: () => editor?.getHTML?.() ?? '',
      getJSON: () => (editor?.getJSON?.() as Record<string, unknown>) ?? {},
      getEditor: () => editor ?? null,
    }),
    [editor],
  );

  return (
    <EditorContent
      editor={editor}
      className={
        className ? `${styles.editorScroll} ${className}` : styles.editorScroll
      }
    />
  );
});
