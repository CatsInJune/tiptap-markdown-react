'use client';

import CodeBlockLowlight, {
  type CodeBlockLowlightOptions,
} from '@tiptap/extension-code-block-lowlight';
import FindAndReplace from '@tiptap/extension-find-and-replace';
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
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
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
import { FindReplaceBar } from './FindReplaceBar';
import { ImportPlaceholder } from '../importPlaceholder';
import type { CodeBlockLabels, FindLabels } from '../labels';
import { MarkdownFileDrop } from '../markdownFileDrop';
import {
  pendingAnchorExtension,
  setPendingAnchors,
  type PendingAnchor,
} from '../pendingAnchor';
import { selectionKind, type SelectionKind } from '../selectionKind';
import { MarkdownPaste } from '../markdownPaste';
import { parseCodeTokenAsChartOrCodeBlock } from '../chart/codeBlockChartParse';
import { createChart } from '../chart/createChart';
import { prepareChartMarkdown } from '../chart/prepareChartMarkdown';
import '../styles/chart.css';
import '../styles/pending.css';
import '../styles/find.css';
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
  // Built-in `code` tokens often win over chart's custom fence tokenizer;
  // upgrade ```tmr-chart here so the mid-column card editor renders ChartView.
  parseMarkdown: (token, helpers) =>
    parseCodeTokenAsChartOrCodeBlock(token, helpers, 'codeBlock'),
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
  /** 打开编辑器自带的查找浮动条（宿主自己绑快捷键/按钮时用）。findBar={false} 时不生效。 */
  openFind: () => void;
  /** 收起自带浮动条，清空高亮并把焦点还给编辑器。findBar={false} 时不生效。 */
  closeFind: () => void;
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
  /**
   * 「这段正在被 AI 改写」的高亮：宿主在提交请求时给上、回填或冲突时传空数组清空。
   * 走 decoration，**不进 markdown、不进 undo 历史**，能盖住表格与图表这类块级节点。
   */
  pendingAnchors?: PendingAnchor[];
  /** 点击待改写高亮区域时回调，给出锚点 id（宿主可用来跳回/取消）。 */
  onAnchorClick?: (id: string) => void;
  /**
   * 选区变化。宿主用它做「选中即出现引用」——塌缩成光标也会报（`empty: true`），
   * 好让引用跟着消失；`kind` 区分普通文字 / 表格单元格 / 整节点（图表）。
   */
  onSelectionChange?: (selection: {
    from: number;
    to: number;
    empty: boolean;
    kind: SelectionKind;
  }) => void;
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
  /**
   * 编辑器内点评论 mark 是否可交互（设 active / 上报 click），默认 true。
   * 只靠侧栏单项驱动滚动定位时传 false。
   */
  commentInteractive?: boolean;
  /**
   * 启用查找替换（默认 true）：注册官方 `@tiptap/extension-find-and-replace`
   * （自带命令 `setSearchTerm / replace / replaceAll / goToNextResult …` 与
   * `editor.storage.findAndReplace`）。传 false 则连扩展一起不注册——此时命令与 storage 都不存在，
   * 宿主的自绘面板也无从驱动。
   */
  findReplace?: boolean;
  /**
   * 是否由编辑器渲染浮动条（默认跟随 {@link findReplace}）。传 false = **定位交给宿主**：
   * 扩展照旧注册，但编辑器不出条子，宿主自己在任意位置渲染 `<FindReplaceBar editor={…} />`
   * （与工具栏同一套分工——组件归库，摆位归宿主）。此时 {@link findShortcut} 与
   * `handle.openFind/closeFind` 一并失效，因为内部没有条子可开。
   */
  findBar?: boolean;
  /**
   * 焦点在编辑器内时接管 Cmd/Ctrl+F 打开**编辑器自带的**浮动条（默认 true；`findBar={false}`
   * 时不接管，免得抢了键却不弹东西）。传 false 则只保留 `handle.openFind()`——例如宿主想
   * 保留浏览器原生查找，或自己摆入口。焦点不在编辑器内时不接管，同页多编辑器不会互相抢。
   */
  findShortcut?: boolean;
  /** 查找替换浮动条的本地化文案。 */
  findLabels?: Partial<FindLabels>;
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
    commentInteractive = true,
    pendingAnchors,
    onAnchorClick,
    onSelectionChange,
    findReplace = true,
    findBar = findReplace,
    findShortcut = true,
    findLabels,
  },
  ref,
) {
  const preparedInitial = prepareChartMarkdown(
    enrichMarkdownCitations(initialMarkdown, sources ?? []),
  );

  const [findOpen, setFindOpen] = useState(false);
  const findInputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [
      ...baseExtensions,
      CodeBlock.configure({ lowlight, codeBlockLabels }),
      ImageWithConfirmDelete.configure({ inline: false }),
      ImportPlaceholder,
      createChart({ editable: false }),
      createCitationRef({ renderCitation }),
      CommentMark,
      commentAnchorExtension({
        showGutter: showCommentGutter,
        interactive: commentInteractive,
      }),
      Markdown,
      pendingAnchorExtension,
      // 官方查找替换：只出命令 / storage / 装饰，UI 自绘（见 FindReplaceBar）。
      // - injectCSS 关掉：它默认会往页面插一个 <style>，绕开宿主的 --tmr-* 主题与 style.css，
      //   命中样式改由 src/styles/find.css 承担。
      // - searchDebounceMs 关掉：官方防抖走 setTimeout，抛错会落在异步回调里兜不住；
      //   防抖改由浮动条自己做（见 findReplace.ts）。
      ...(findReplace
        ? [FindAndReplace.configure({ injectCSS: false, searchDebounceMs: 0 })]
        : []),
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

  const closeFind = useCallback(() => {
    setFindOpen(false);
    // 焦点归还：Tiptap 的 focus 命令内部就是 requestAnimationFrame 延后执行的
    // （`delayedFocus`），正好落在 React 卸载浮动条之后——否则被卸载的输入框会把焦点丢给 body。
    editor?.commands.focus();
  }, [editor]);

  // Cmd/Ctrl+F → 打开查找条。接管条件必须收得比「焦点在编辑器内」松、比「谁都能接管」紧：
  //   - 焦点在本编辑器内：接管 ✓
  //   - 焦点不在任何输入控件里（body）且页面上只有本编辑器：接管 ✓（单编辑器页面点完工具栏按钮能直接按）
  //   - 其余情况一律不接管：同页多编辑器时不会一起弹条（文档站就是这样），宿主的其它输入框
  //     也不会被夺走原生查找。多编辑器页面上宿主可自己调 handle.openFind()。
  // 只有容器里真有那条浮动条（findBar）时才绑：否则会白抢浏览器原生查找，却什么都不弹。
  useEffect(() => {
    if (!editor || !findReplace || !findBar || !findShortcut) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
        return;
      }
      if (event.key !== 'f' && event.key !== 'F') return;
      const active = document.activeElement;
      const inEditor = !!active && editor.view.dom.contains(active);
      const nothingFocused = active === null || active === document.body;
      const soleEditor = document.querySelectorAll('.ProseMirror').length <= 1;
      if (!inEditor && !editor.isFocused && !(nothingFocused && soleEditor)) {
        return;
      }
      event.preventDefault();
      setFindOpen(true);
      // 已打开时再按一次：聚焦并全选当前查询（首次打开由浮动条的 autoFocus 负责）
      requestAnimationFrame(() => findInputRef.current?.select());
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [editor, findReplace, findBar, findShortcut]);

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

  // 待改写高亮：会话级装饰，不进 markdown / 不进 undo（宿主推入，回填或冲突时清空）。
  useEffect(() => {
    if (!editor) return;
    setPendingAnchors(editor, pendingAnchors ?? []);
  }, [editor, pendingAnchors]);

  // 点击待改写高亮 → 上报锚点 id。走 DOM 监听而不是插件 meta：这里只要「点了哪一段」。
  const onAnchorClickRef = useRef(onAnchorClick);
  useEffect(() => {
    onAnchorClickRef.current = onAnchorClick;
  }, [onAnchorClick]);
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const id = target?.closest?.('[data-pending-id]')?.getAttribute('data-pending-id');
      if (id) onAnchorClickRef.current?.(id);
    };
    dom.addEventListener('click', onClick);
    return () => dom.removeEventListener('click', onClick);
  }, [editor]);

  // 选区变化：宿主据此做「选中即出现引用 / 引用跟着选区走」。
  const onSelectionChangeRef = useRef(onSelectionChange);
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);
  useEffect(() => {
    if (!editor) return;
    const onSelectionUpdate = () => {
      const { from, to, empty } = editor.state.selection;
      onSelectionChangeRef.current?.({
        from,
        to,
        empty,
        kind: selectionKind(editor.state.selection),
      });
    };
    editor.on('selectionUpdate', onSelectionUpdate);
    return () => {
      editor.off('selectionUpdate', onSelectionUpdate);
    };
  }, [editor]);

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
      openFind: () => setFindOpen(true),
      closeFind,
    }),
    [editor, closeFind],
  );

  return (
    <div className={styles.editorHost}>
      {/* 粘性锚点排在正文之前：浮动条跟着最近的滚动容器走，正文滚动时不会被卷上去 */}
      {editor && findBar && findOpen ? (
        <div className={styles.findBarAnchor}>
          <FindReplaceBar
            editor={editor}
            labels={findLabels}
            onClose={closeFind}
            inputRef={findInputRef}
            className={styles.findBar}
          />
        </div>
      ) : null}
      <EditorContent
        editor={editor}
        className={
          className ? `${styles.editorScroll} ${className}` : styles.editorScroll
        }
      />
    </div>
  );
});
