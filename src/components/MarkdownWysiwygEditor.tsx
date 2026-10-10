'use client';

import CodeBlockLowlight, {
  type CodeBlockLowlightOptions,
} from '@tiptap/extension-code-block-lowlight';
import FindAndReplace from '@tiptap/extension-find-and-replace';
import Image from '@tiptap/extension-image';
import { TableOfContents } from '@tiptap/extension-table-of-contents';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import {
  EditorContent,
  ReactNodeViewRenderer,
  useEditor,
  type AnyExtension,
  type Editor,
} from '@tiptap/react';
import type {
  NodeViewRendererProps,
  ResizableNodeViewDirection,
} from '@tiptap/core';
import { mergeAttributes } from '@tiptap/core';
import { createPortal } from 'react-dom';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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
import { isComposingKeyEvent } from '../findReplace';
import { FindReplaceBar } from './FindReplaceBar';
import { ImportPlaceholder } from '../importPlaceholder';
import { ImageUploadNode, type ImageUploadConfig } from '../imageUpload';
import {
  imageAlignAttribute,
  imageCaptionAttribute,
  imageFigureParseRule,
  imageMarkdownTokenizer,
  imageNodeHtml,
  imageParseMarkdown,
  imageRenderMarkdown,
  normalizeImageCaption,
} from '../imageMarkdown';
import { setImageAlign } from '../imageAlign';
import type { CodeBlockLabels, FindLabels, ShortcutLabels, SlashMenuLabels } from '../labels';
import { defaultShortcutLabels } from '../labels';
import { SlashMenu } from '../slashMenu/SlashMenuExtension';
import { ShortcutPanel } from '../shortcuts/ShortcutPanel';
import { KeyboardIcon } from '../icons';
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

// 块级图片：Backspace 二次确认删除（与代码块一致）+ 可缩放（官方 ResizableNodeView）
// + 尺寸保真的 markdown 往返（见 imageMarkdown.ts）。导出供测试与自建管线使用。
export const ImageWithConfirmDelete = Image.extend({
  addAttributes() {
    return {
      ...(Image.config.addAttributes?.call(this) ?? {}),
      align: imageAlignAttribute,
      caption: imageCaptionAttribute,
    };
  },

  parseHTML() {
    // figure 规则要排在 img 前面：带描述（图注）的图整体归 figure
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
      // 图片对齐：键位对齐官方 image-align-button（L 左 / E 中 / R 右），
      // 选中图片或光标紧邻图片时生效。工具函数见 imageAlign.ts。
      'Alt-Shift-l': () => setImageAlign(this.editor, 'left'),
      'Alt-Shift-e': () => setImageAlign(this.editor, 'center'),
      'Alt-Shift-r': () => setImageAlign(this.editor, 'right'),
    };
  },

  addNodeView() {
    // 官方实现：resize 未启用 / SSR（无 document）时返回 null，落到默认 DOM 渲染
    const createView = Image.config.addNodeView?.call(this);
    if (!createView) return null;

    // 本库扩展的缩放上限：官方 `Image` 的 resize 配置只有 min、没有 max 入口，但
    // ResizableNodeView 有公开的 maxSize 字段（applyConstraints 每次拖拽都会读）。
    // maxWidth / maxHeight 由 <MarkdownWysiwygEditor> 展开进 resize 对象传到这里。
    const resizeOptions = this.options.resize as
      | { maxWidth?: number; maxHeight?: number }
      | false
      | undefined;
    const explicitMaxWidth =
      resizeOptions && typeof resizeOptions === 'object'
        ? resizeOptions.maxWidth
        : undefined;
    const explicitMaxHeight =
      resizeOptions && typeof resizeOptions === 'object'
        ? resizeOptions.maxHeight
        : undefined;

    return (props: NodeViewRendererProps) => {
      const nodeView = createView(props);
      if (!nodeView) return nodeView;

      // removeHandles / element / maxSize 是 ResizableNodeView 的成员——官方升级若动
      // 它们，「只读无手柄 / 程序化改尺寸视觉同步 / 缩放上下限」测试会先炸。
      const resizable = nodeView as unknown as {
        element?: HTMLElement;
        maxSize?: { width?: number; height?: number };
        removeHandles?: () => void;
      };

      // 「打开就是只读」的文档：官方只在收到第一个 update 事件后才同步 editable（摘手柄），
      // 等不到事件的手柄会一直露着、还能拖出残影（只读态拖了不提交，样式却改了）。
      // 创建时补摘一次；之后切回编辑态，官方自己的 update 监听会把手柄挂回来。
      if (!props.editor.isEditable) resizable.removeHandles?.();

      // 缩放上限：显式配置优先；没配则跟随内容区宽度（图片拖不出布局）。
      // 注意两点：其一，NodeView 是在 editor.view 构造**过程中**创建的，此刻
      // `editor.view` 还不可访问（tiptap 会抛 "view is not available"）——所以初始
      // 只设显式上限，动态上限推迟到 mousedown；其二，监听挂在容器上、capture 阶段，
      // 先于官方的手柄 mousedown 处理跑，每次拖拽开始前刷新，窗口变化后也能跟上。
      const applyMaxSize = () => {
        resizable.maxSize =
          explicitMaxWidth || explicitMaxHeight
            ? { width: explicitMaxWidth, height: explicitMaxHeight }
            : { width: props.editor.view.dom.clientWidth || undefined };
      };
      if (explicitMaxWidth || explicitMaxHeight) applyMaxSize();

      // 图注（描述）：挂进 wrapper（宽度 = 图片宽）→ text-align:center 就是
      // 「图片底部中间」。wrapper 因此变高，而 left/right 手柄的 top:50% 是相对
      // wrapper 的（会偏到描述上）——把图片的真实高度写进 --tmr-image-h，
      // CSS 那边用 calc 的降级写法取它（见 content.module.css）。
      let syncCaption: ((attrs: Record<string, unknown>) => void) | null = null;
      if (nodeView.dom instanceof HTMLElement && resizable.element) {
        const { element } = resizable;
        const container = nodeView.dom;
        const captionEl = document.createElement('div');
        captionEl.className = 'tmr-image-caption';
        captionEl.dataset.imageCaption = '';
        (element.parentElement ?? container).appendChild(captionEl);

        const syncHandleTop = () => {
          const height = element.offsetHeight;
          if (height > 0) {
            container.style.setProperty('--tmr-image-h', `${height}px`);
          } else {
            // 高度拿不到（图片未加载 / 无布局环境）→ 撤掉变量，CSS 落回 50%
            container.style.removeProperty('--tmr-image-h');
          }
        };
        syncCaption = (attrs) => {
          const caption = normalizeImageCaption(attrs.caption) ?? '';
          captionEl.textContent = caption;
          captionEl.hidden = caption === '';
          syncHandleTop();
        };
        syncCaption(props.node.attrs);
        element.addEventListener('load', syncHandleTop);
        container.addEventListener('mousedown', applyMaxSize, true);
      }

      // 官方 onUpdate 把 width/height 划进「拖拽自己管」的集合直接跳过，于是程序化改
      // 尺寸（resetImageSize 清掉、宿主 updateAttributes）后数据变了、视觉不动。
      // 这里在 update 后把 style 对齐 attrs（图注文案也顺带同步）；拖拽路径不经过
      // update，互不干扰。
      if (resizable.element) {
        const { element } = resizable;
        const originalUpdate = nodeView.update?.bind(nodeView);
        if (originalUpdate) {
          nodeView.update = (...args) => {
            const ok = originalUpdate(...args);
            if (ok) {
              const attrs = (args[0] as { attrs: Record<string, unknown> }).attrs;
              element.style.width = attrs.width ? `${attrs.width}px` : '';
              element.style.height = attrs.height ? `${attrs.height}px` : '';
              syncCaption?.(attrs);
            }
            return ok;
          };
        }
      }

      return nodeView;
    };
  },
});

/** 浮动条相对其定位上下文的偏移（数字按 px）。内部路径的上下文是编辑器，portal 路径是宿主容器。 */
export interface FindBarOffset {
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  left?: number | string;
}

const DEFAULT_FIND_BAR_OFFSET: FindBarOffset = { top: 4, right: 4 };

function findBarOffsetStyle(offset: FindBarOffset): CSSProperties {
  const px = (v: number | string | undefined) =>
    typeof v === 'number' ? `${v}px` : v;
  return {
    position: 'absolute',
    top: px(offset.top),
    right: px(offset.right),
    bottom: px(offset.bottom),
    left: px(offset.left),
  };
}

/**
 * 这次按键归本编辑器管吗。Cmd/Ctrl+F 与 Esc 共用同一套边界：
 *   - 焦点在本编辑器内 → 管
 *   - 焦点不在任何输入控件里（body）且页面上只有本编辑器 → 也管（单编辑器页面点完工具栏能直接按）
 *   - 其余一律不管：同页多编辑器不会一起抢键，宿主的输入框与其它浮层也不会被夺走按键。
 */
function editorOwnsKeyboard(editor: Editor): boolean {
  const active = document.activeElement;
  const inEditor = !!active && editor.view.dom.contains(active);
  if (inEditor || editor.isFocused) return true;
  const nothingFocused = active === null || active === document.body;
  return nothingFocused && document.querySelectorAll('.ProseMirror').length <= 1;
}

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
  /**
   * 反转自带浮动条：关着就开、开着就关。工具栏那个带 active 态的放大镜接它
   * （`onSearch={() => handle.current?.toggleFind()}`）。findBar={false} 时不生效。
   */
  toggleFind: () => void;
}

/** 图片缩放的透传选项（官方 `@tiptap/extension-image` 的 resize 配置）。 */
export interface ImageResizeOptions {
  /**
   * 手柄方向，默认左右两条竖条（对齐官方 image-upload-node demo 的形态）。
   * 例：`['top-right', 'bottom-right']` 只留右侧两角；八个方向全给则四角 + 四边。
   */
  directions?: ResizableNodeViewDirection[];
  /** 最小宽（px），默认 80。 */
  minWidth?: number;
  /** 最小高（px），默认 80。 */
  minHeight?: number;
  /**
   * 最大宽（px）。**默认跟随编辑器内容区宽度**（拖不出布局，窗口变化时在下次拖拽前刷新
   * 上限）；显式传值则以此为准。官方 `Image` 的 resize 没有 max 入口，由本库注入
   * `ResizableNodeView.maxSize`（该字段官方是公开的，拖拽约束每次都会读）。
   */
  maxWidth?: number;
  /** 最大高（px）。默认不单独限制（等比缩放时高度随宽度走）。 */
  maxHeight?: number;
  /**
   * 是否始终锁定宽高比，默认 true（本库默认）。等比下"编辑态精确尺寸"与只读渲染的
   * 按比例自适应（CSS `height: auto`）数学等价；显式关掉后，非等比拖出的图在只读
   * 渲染里会按原图比例回弹——markdown 里存的仍是精确值。
   */
  alwaysPreserveAspectRatio?: boolean;
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
   * 把自带的浮动条挂到宿主的容器里（popup container 模式）：给元素或返回元素的函数
   * 即可，开合状态与 Cmd/Ctrl+F 仍归库——只换挂载点。适合条子被 `overflow: hidden` 祖先裁掉、
   * 或想让它落在自己的头部 / 侧栏里。挂进去后**定位由宿主负责**（库不再加绝对定位），
   * 且容器若在主题子树之外，记得把 `--tmr-*` 变量也带到那里。
   * 返回 null / 不传时回落到编辑器内自带的浮动条。
   */
  findBarContainer?: HTMLElement | null | (() => HTMLElement | null);
  /**
   * 浮动条相对其定位上下文的偏移，默认 `{ top: 4, right: 4 }`（右上角）。数字按 px，也收 CSS 字符串。
   * 内部路径的上下文是编辑器（粘在滚动容器顶部的那层锚点），`findBarContainer` 路径的上下文是那个容器
   * ——那条路径下库会保证容器是定位上下文（computed position 为 static 时补 `position: relative`）。
   */
  findBarOffset?: FindBarOffset;
  /**
   * 焦点在编辑器内时接管 Cmd/Ctrl+F 打开**编辑器自带的**浮动条（默认 true；`findBar={false}`
   * 时不接管，免得抢了键却不弹东西）。传 false 则只保留 `handle.openFind()`——例如宿主想
   * 保留浏览器原生查找，或自己摆入口。焦点不在编辑器内时不接管，同页多编辑器不会互相抢。
   */
  findShortcut?: boolean;
  /** 查找替换浮动条的本地化文案。 */
  findLabels?: Partial<FindLabels>;
  /**
   * 浮动条开合状态变化的通知（条子开着时 `handle.openFind()`、Esc / × 关掉都会触发）。
   * 典型用法是驱动别处的入口按钮：`<EditorToolbar onSearch={open} searchActive={isOpen} />`。
   * 只在真正变化时回调，挂载时不会先报一次 `false`；报的是「条子真的在屏幕上」——
   * `findBar={false}`（宿主自己摆条子）时恒为 `false`，不会因为 `openFind()` 空转就亮起入口。
   */
  onFindOpenChange?: (open: boolean) => void;
  /**
   * 启用快捷键抽屉：编辑器右下角出现键盘悬浮按钮，点开为
   * 「格式 / 快捷键 / Markdown」三列对照抽屉（默认 true，只读态隐藏）。
   */
  shortcutPanel?: boolean;
  /** 快捷键抽屉的本地化文案。 */
  shortcutLabels?: Partial<ShortcutLabels>;
  /**
   * 把快捷键悬浮键挂到宿主的容器里（与 `findBarContainer` 同一套）：
   * 给元素或返回元素的函数即可，开合状态与抽屉归库——只换按钮落点。
   * 挂进去后**定位由宿主负责**（库不再给按钮加粘性定位与右下角外边距），
   * 适合把按钮叠在宿主自己的浮层控件旁边（如「回到顶部」按钮上方）。
   * 返回 null / 不传时回落到编辑器内容右下的粘性按钮。
   */
  shortcutFabContainer?: HTMLElement | null | (() => HTMLElement | null);
  /**
   * 启用斜杠菜单：键入 `/`（行首或空白后）唤起块级插入弹窗（默认 true）。
   * 代码块内不触发，表格单元格内触发；只读态不激活。
   * 追加自定义命令项请传 `extraExtensions` 注册 `SlashMenu.configure({ items })`。
   */
  slashMenu?: boolean;
  /** 斜杠菜单的本地化文案。 */
  slashMenuLabels?: Partial<SlashMenuLabels>;
  /**
   * 图片上传（对齐官方 ImageUploadNode 的交互）：配置后工具栏的图片按钮变成
   * 「插入上传块」——文档里出现拖拽 / 点击的占位块，上传进度就地显示，全部成功后就地
   * 替换为图片。`upload` 是唯一必填项（网络 I/O 归宿主），签名 `(file, onProgress,
   * signal) => Promise<url>`；收 `signal` 后宿主应在移除 / 清空 / 占位块被删时中断请求。
   *
   * 挂在这里而不是工具栏的 `onImageUpload`：按钮的行为由「编辑器里有没有注册
   * imageUpload 扩展」决定，两处都传会以本配置为准。未配置时工具栏走旧的直传路径
   * （点按钮直接开文件框 → 上传 → 插图片）。仅初始化时生效。
   */
  imageUpload?: ImageUploadConfig;
  /**
   * 图片缩放（默认开）：拖手柄改尺寸，松手把整数像素写进节点 attrs；markdown 里带尺寸的
   * 图以 `<img src alt width height>` 保真（没拖过的图保持标准 `![alt](url)`，见
   * imageMarkdown.ts）。传 `false` 关闭；传对象透传官方 resize 配置。仅初始化时生效。
   */
  imageResize?: boolean | ImageResizeOptions;
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
    findBarContainer,
    findBarOffset = DEFAULT_FIND_BAR_OFFSET,
  findShortcut = true,
  findLabels,
  onFindOpenChange,
  slashMenu = true,
  slashMenuLabels,
  shortcutPanel = true,
  shortcutLabels,
  shortcutFabContainer,
  imageUpload,
  imageResize = true,
  },
  ref,
) {
  const preparedInitial = prepareChartMarkdown(
    enrichMarkdownCitations(initialMarkdown, sources ?? []),
  );

  const [findOpen, setFindOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const findInputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [
      ...baseExtensions,
      CodeBlock.configure({ lowlight, codeBlockLabels }),
      ImageWithConfirmDelete.configure({
        inline: false,
        // 图片缩放（默认开、默认等比、默认左右两条手柄）：false 关掉；对象透传官方配置
        // ——等比与手柄方向都有本库默认，显式传值可覆盖。
        resize:
          imageResize === false
            ? false
            : {
                enabled: true,
                alwaysPreserveAspectRatio: true,
                directions: ['left', 'right'] as ResizableNodeViewDirection[],
                // 默认下限。上限默认跟随内容区宽度（maxWidth/maxHeight 由 addNodeView
                // 包装读取并注入 maxSize，见 ImageWithConfirmDelete）。
                minWidth: 80,
                minHeight: 80,
                ...(typeof imageResize === 'object' ? imageResize : null),
              },
      }),
      // 图片上传占位块：空态拖拽 / 点选 → 进度就地 → 成功原地换成 image。
      // 不配置 imageUpload 就不注册（工具栏退回旧的直传路径）。
      ...(imageUpload ? [ImageUploadNode.configure(imageUpload)] : []),
      ImportPlaceholder,
      // 空文档占位符：官方 Placeholder 把 data-placeholder 属性与
      // is-empty / is-editor-empty 类打在**空文本块节点**上——CSS
      // （styles/content.module.css）正是在节点上 attr(data-placeholder)
      // 取值。早先只把属性挂在根 div 上，选择器永远匹配不到，占位符从没显示过。
      // showOnlyWhenEditable 默认 true，只读态自动不显示。
      ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
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
      // 斜杠菜单（键入 / 唤起）：默认开，只读态由 suggestion 状态机自身短路
      ...(slashMenu ? [SlashMenu.configure({ labels: slashMenuLabels })] : []),
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

  /**
   * 打开查找条。带着「再按一次」的语义：已经开着时聚焦并全选当前查询（首次打开由条子自己的
   * autoFocus 负责，此时查询多半是空串，`select()` 是空操作）。
   */
  const openFind = useCallback(() => {
    setFindOpen(true);
    requestAnimationFrame(() => findInputRef.current?.select());
  }, []);

  const closeFind = useCallback(() => {
    setFindOpen(false);
    // 焦点归还：Tiptap 的 focus 命令内部就是 requestAnimationFrame 延后执行的
    // （`delayedFocus`），正好落在 React 卸载浮动条之后——否则被卸载的输入框会把焦点丢给 body。
    editor?.commands.focus();
  }, [editor]);

  /**
   * 反转查找条：关着就开、开着就关。工具栏那个放大镜接的是它——带 active 态的按钮点一下得能灭。
   * `openFind()` 保持「已开着时重聚焦并全选查询」的语义，和 Cmd/Ctrl+F（同一个手势）一致。
   */
  const toggleFind = useCallback(() => {
    if (findOpen) closeFind();
    else openFind();
  }, [findOpen, closeFind, openFind]);

  // 开合状态上报宿主（回调走 ref 防 stale）。报的是「条子真的在屏幕上」——`findBar={false}`
  // 时宿主自己摆条子，`findOpen` 翻起来也不该点亮别处的入口。只在真正变化时回调，
  // 挂载时不先报一次 false。
  const findBarOpen = findOpen && findBar && findReplace;
  const onFindOpenChangeRef = useRef(onFindOpenChange);
  onFindOpenChangeRef.current = onFindOpenChange;
  // 初值取 `false`（`findOpen` 的初值）：挂载那次比较相等，不会回调一次「本来就是 false」。
  const notifiedFindOpenRef = useRef(false);
  useEffect(() => {
    if (notifiedFindOpenRef.current === findBarOpen) return;
    notifiedFindOpenRef.current = findBarOpen;
    onFindOpenChangeRef.current?.(findBarOpen);
  }, [findBarOpen]);

  // 条子随本实例一起消失时（换 key、换文档、切路由），宿主的入口不该继续亮着——新实例的
  // `notifiedFindOpenRef` 初值是 false、`findBarOpen` 也是 false，两者相等就不会回调，于是
  // 上一实例报过的那个 `true` 没人撤销。所以卸载时补发一次。StrictMode 的模拟卸载不会误报
  // （那时条子并没开着，值就是 false）。
  const findBarOpenRef = useRef(findBarOpen);
  findBarOpenRef.current = findBarOpen;
  useEffect(
    () => () => {
      if (findBarOpenRef.current) onFindOpenChangeRef.current?.(false);
    },
    [],
  );

  // Cmd/Ctrl+F → 打开查找条。接管边界见 editorOwnsKeyboard()。
  // 只有容器里真有那条浮动条（findBar）时才绑：否则会白抢浏览器原生查找，却什么都不弹。
  useEffect(() => {
    if (!editor || !findReplace || !findBar || !findShortcut) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
        return;
      }
      if (event.key !== 'f' && event.key !== 'F') return;
      if (!editorOwnsKeyboard(editor)) return;
      event.preventDefault();
      openFind();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [editor, findReplace, findBar, findShortcut, openFind]);

  // Esc → 关掉查找条。条子自己那份 onKeyDown 只在焦点位于条子内时才收得到，用户点回正文继续
  // 编辑后想收条子就只能去点 ×；这里按同一套边界（editorOwnsKeyboard）补上「焦点在正文 /
  // 页面只有本编辑器且焦点在 body」的情况。消费掉这次 Esc（preventDefault + stopPropagation），
  // 免得宿主的浮动层跟着一起关；输入法组合中的 Esc 是「取消候选词」，放行。
  //
  // 注意**不要**用 `event.defaultPrevented` 判断「内层已经处理过、让给它」：实测在真实编辑器里
  // Escape 一定已被 preventDefault——prosemirror-view 的 keydown 一旦有 handleKeyDown 返回 true
  // 就 preventDefault（`node_modules/prosemirror-view/src/input.ts:136`），斜杠菜单等就在这条路上。
  // 那样写这条分支永远不会走。边界交给 editorOwnsKeyboard：焦点在别的浮层 / 宿主的输入框里时
  // 它本来就是 false，不会去抢。
  useEffect(() => {
    if (!editor || !findBarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isComposingKeyEvent(event)) return;
      if (!editorOwnsKeyboard(editor)) return;
      event.preventDefault();
      event.stopPropagation();
      closeFind();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [editor, findBarOpen, closeFind]);

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
      openFind: () => openFind(),
      closeFind,
      toggleFind: () => toggleFind(),
    }),
    [editor, closeFind, openFind, toggleFind],
  );

  // 宿主指定了容器就把条子 portal 进去；解析不到则回落到编辑器内的粘性锚点。
  const findBarTarget =
    typeof findBarContainer === 'function'
      ? findBarContainer()
      : (findBarContainer ?? null);

  // 条子是绝对定位的：容器得先是定位上下文。宿主容器是 static 时补一个 relative——
  // 不补的话条子会以「最近的定位祖先」为基准（可能是页面），位置会莫名其妙。
  useEffect(() => {
    if (!findBarTarget) return;
    if (getComputedStyle(findBarTarget).position === 'static') {
      findBarTarget.style.position = 'relative';
    }
  }, [findBarTarget]);

  const findBarNode =
    editor && findBar && findOpen ? (
      <FindReplaceBar
        editor={editor}
        labels={findLabels}
        onClose={closeFind}
        inputRef={findInputRef}
        className={styles.findBar}
        style={findBarOffsetStyle(findBarOffset)}
      />
    ) : null;

  const shortcutT: ShortcutLabels = useMemo(
    () => ({ ...defaultShortcutLabels, ...shortcutLabels }),
    [shortcutLabels],
  );

  // 宿主指定了容器就把悬浮键 portal 进去（定位归宿主），解析不到回落编辑器内粘性按钮。
  // 用 layout effect（同步于提交后、绘制前）解析：函数形式读 ref 时首渲染拿到的是
  // null，等 DOM 提交后 ref 才就绪——这里在绘制前再解析一次，避免闪一帧编辑器内按钮；
  // setState 同值会 bail out，不会死循环。
  const [shortcutFabTarget, setShortcutFabTarget] = useState<HTMLElement | null>(
    null,
  );
  const useIsoLayoutEffect =
    typeof window === 'undefined' ? useEffect : useLayoutEffect;
  useIsoLayoutEffect(() => {
    const target =
      typeof shortcutFabContainer === 'function'
        ? shortcutFabContainer()
        : (shortcutFabContainer ?? null);
    setShortcutFabTarget((prev) => (prev === target ? prev : target));
  });

  const shortcutFabNode =
    shortcutPanel && editable ? (
      <button
        type="button"
        className={
          shortcutFabTarget
            ? `${styles.shortcutFab} ${styles.shortcutFabHosted}`
            : styles.shortcutFab
        }
        title={shortcutT.panelTitle}
        aria-label={shortcutT.panelTitle}
        aria-expanded={shortcutsOpen}
        onClick={() => setShortcutsOpen((v) => !v)}
      >
        <KeyboardIcon size={18} />
      </button>
    ) : null;

  return (
    <div className={styles.editorHost}>
      {/* 粘性锚点排在正文之前：浮动条跟着最近的滚动容器走，正文滚动时不会被卷上去 */}
      {findBarNode && !findBarTarget ? (
        <div className={styles.findBarAnchor}>{findBarNode}</div>
      ) : null}
      {findBarNode && findBarTarget
        ? createPortal(findBarNode, findBarTarget)
        : null}
      <EditorContent
        editor={editor}
        className={
          className ? `${styles.editorScroll} ${className}` : styles.editorScroll
        }
      />
      {/* 快捷键抽屉入口：默认 sticky-bottom 悬浮在可视区右下；
          宿主给了 shortcutFabContainer 就 portal 进去，定位归宿主。只读态隐藏 */}
      {shortcutFabNode && shortcutFabTarget
        ? createPortal(shortcutFabNode, shortcutFabTarget)
        : shortcutFabNode}
      {shortcutPanel && editable ? (
        <ShortcutPanel
          open={shortcutsOpen}
          onClose={() => setShortcutsOpen(false)}
          labels={shortcutLabels}
        />
      ) : null}
    </div>
  );
});
