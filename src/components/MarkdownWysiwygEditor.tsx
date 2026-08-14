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
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  enrichMarkdownCitations,
  type SourceRef,
} from '../citationUtils';
import type { RenderCitation } from '../citationTypes';
import { createCitationRef } from '../createCitationRef';
import { CommentMark } from '../commentAnchor/CommentMark';
import {
  COMMENT_ACTIVE_META,
  COMMENT_CLICK_META,
  COMMENT_GUTTER_META,
  commentAnchorExtension,
} from '../commentAnchor/commentAnchorPlugin';
import {
  applyCommentAnchorsToEditor,
  collectCommentIds,
  focusComment,
  nextComment,
} from '../commentAnchor/commentAnchorController';
import type {
  CommentClickPayload,
  CommentRef,
} from '../commentAnchor/commentTypes';
import { baseExtensions, lowlight } from '../extensions';
import type { CodeBlockLabels } from '../labels';
import { MarkdownFileDrop } from '../markdownFileDrop';
import { MarkdownPaste } from '../markdownPaste';
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
  /** 聚焦评论：设 active + 滚动 + 光标落到区间起点。找不到返回 false。 */
  focusComment: (commentId: string) => boolean;
  /** 按文档顺序跳转评论（next / prev），返回目标 commentId。 */
  nextComment: (dir?: 'next' | 'prev') => string | null;
  /** 当前 doc 内已锚定的去重 commentId 列表（文档顺序）。 */
  getCommentIds: () => string[];
}

export interface MarkdownWysiwygEditorProps {
  /** 初始 markdown 内容。 */
  initialMarkdown?: string;
  /**
   * 是否可编辑，默认 true。false = 只读渲染，与编辑态同源同路径：
   * 同一套扩展 / NodeView / 样式，交互件（代码块语言选择、删除等）自动收起。
   * 只读态不应用评论锚定（comments 被忽略），与 MarkdownPreview 语义一致。
   */
  editable?: boolean;
  /**
   * 初始脚注来源：按 index 对齐 `[^n]`，写入 citationRef 的 url/title。
   * 仅影响初始 content；后续插入请用 `insertMarkdown(editor, md, sources)`。
   */
  sources?: SourceRef[];
  /**
   * 脚注圆标 NodeView 插槽。消费方用 Popover 包住 `defaultDom`，
   * 用 `index` 查自己的数据源。仅初始化时生效。
   */
  renderCitation?: RenderCitation;
  placeholder?: string;
  /** editor 实例就绪 / 销毁时回调，供外部工具栏使用。 */
  onEditorReady?: (editor: Editor | null) => void;
  /** 目录变化回调（正文标题增删改时），供侧边目录实时展示。 */
  onTocChange?: (items: TocItem[]) => void;
  /**
   * 粘贴纯文本时启发式检测 markdown 并自动转富文本(Shift+粘贴保持纯文本)。
   * 默认 true。仅初始化时生效。
   */
  markdownPaste?: boolean;
  /**
   * 支持把 .md / .markdown 文件拖拽或粘贴进编辑器,解析后插入到落点/光标处。
   * 默认 true。仅初始化时生效。
   */
  markdownFileDrop?: boolean;
  /** 追加的 Tiptap 扩展（在内置扩展之后注册）。 */
  extraExtensions?: AnyExtension[];
  /** 代码块 NodeView 的本地化文案。 */
  codeBlockLabels?: Partial<CodeBlockLabels>;
  /** 附加到滚动容器的 class。 */
  className?: string;
  /**
   * 编辑态评论锚定：评论列表（含已解码 segments）。装载时映射为 commentAnchor
   * mark 并高亮；markdown 导出自动剥离，只读态（MarkdownPreview）不渲染评论。
   * 注意：数组引用变化会触发重新铺 mark，宿主应 memo 该数组。
   */
  comments?: CommentRef[];
  /** 受控 active 评论 id（sidebar 联动）。null = 无 active。 */
  activeCommentId?: string | null;
  /** 编辑器内点击 mark / gutter 时回调。 */
  onCommentClick?: (payload: CommentClickPayload) => void;
  /** active 变化回调（点击 mark / gutter / nextComment 时）。 */
  onActiveCommentChange?: (commentId: string | null) => void;
  /** 是否在 block 左缘渲染评论 gutter 气泡，默认 true。 */
  showCommentGutter?: boolean;
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
    editable = true,
    sources,
    renderCitation,
    placeholder,
    onEditorReady,
    onTocChange,
    markdownPaste = true,
    markdownFileDrop = true,
    extraExtensions,
    codeBlockLabels,
    className,
    comments,
    activeCommentId,
    onCommentClick,
    onActiveCommentChange,
    showCommentGutter = true,
  },
  ref,
) {
  const preparedInitial = enrichMarkdownCitations(
    initialMarkdown,
    sources ?? [],
  );

  const editor = useEditor({
    extensions: [
      ...baseExtensions,
      CodeBlock.configure({ lowlight, codeBlockLabels }),
      ImageWithConfirmDelete.configure({ inline: false }),
      createCitationRef({ renderCitation }),
      CommentMark,
      commentAnchorExtension({ showGutter: showCommentGutter }),
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
      ...(markdownPaste ? [MarkdownPaste] : []),
      ...(markdownFileDrop ? [MarkdownFileDrop] : []),
      ...(extraExtensions ?? []),
    ],
    content: preparedInitial,
    contentType: 'markdown',
    editable,
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

  // 运行时切换编辑/只读（同一实例，NodeView 交互件随 editor.isEditable 收起）。
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  // 评论列表 → 铺 mark。用 commentId 签名做防抖：宿主每次渲染传新数组引用时
  // 不会反复清/铺（清空再重铺会丢掉 mark 随编辑移动后的位置）。
  const commentsSignatureRef = useRef<string>('');
  useEffect(() => {
    // 只读态不接评论（与库的「评论锚定 = 编辑会话专属」契约一致）。
    if (!editor || !editable) return;
    const signature = (comments ?? [])
      .map((c) => `${c.commentId}:${c.segments.length}`)
      .join('|');
    if (signature === commentsSignatureRef.current) return;
    commentsSignatureRef.current = signature;
    applyCommentAnchorsToEditor(editor, comments ?? []);
  }, [editor, editable, comments]);

  // active 同步到插件（mark/block 高亮装饰）；滚动定位走 handle.focusComment。
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(
      editor.state.tr.setMeta(
        COMMENT_ACTIVE_META,
        activeCommentId ?? null,
      ),
    );
  }, [editor, activeCommentId]);

  // mark / gutter 点击 → 通过 transaction meta 上报宿主（回调走 ref 防 stale）。
  const onCommentClickRef = useRef(onCommentClick);
  const onActiveCommentChangeRef = useRef(onActiveCommentChange);
  onCommentClickRef.current = onCommentClick;
  onActiveCommentChangeRef.current = onActiveCommentChange;
  useEffect(() => {
    if (!editor) return;
    const onTransaction = ({
      transaction,
    }: {
      transaction: { getMeta: (key: string) => unknown };
    }) => {
      const click = transaction.getMeta(COMMENT_CLICK_META) as
        | CommentClickPayload
        | undefined;
      if (click) {
        onCommentClickRef.current?.(click);
        onActiveCommentChangeRef.current?.(click.commentIds[0] ?? null);
      }
      const gutter = transaction.getMeta(COMMENT_GUTTER_META) as
        | { commentIds: string[]; pos: number }
        | undefined;
      if (gutter) {
        onCommentClickRef.current?.({
          commentIds: gutter.commentIds,
          anchorEl: null,
          pos: gutter.pos,
        });
        onActiveCommentChangeRef.current?.(gutter.commentIds[0] ?? null);
      }
    };
    editor.on('transaction', onTransaction);
    return () => {
      editor.off('transaction', onTransaction);
    };
  }, [editor]);

  useImperativeHandle(
    ref,
    () => ({
      getMarkdown: () => editor?.getMarkdown?.() ?? '',
      getHTML: () => editor?.getHTML?.() ?? '',
      getJSON: () => (editor?.getJSON?.() as Record<string, unknown>) ?? {},
      getEditor: () => editor ?? null,
      focusComment: (commentId: string) =>
        editor ? focusComment(editor, commentId) : false,
      nextComment: (dir?: 'next' | 'prev') =>
        editor ? nextComment(editor, dir ?? 'next') : null,
      getCommentIds: () => (editor ? collectCommentIds(editor) : []),
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
