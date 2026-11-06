'use client';

import { useEditorState, type Editor } from '@tiptap/react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  useToolbarFullscreen,
  type FullscreenTarget,
} from '../fullscreen';
import { getLocaleBundle, type LocaleCode } from '../i18n';
import type { ToolbarLabels } from '../labels';
import { readCurrentNumberingFormat } from '../numberingFormat';
import {
  MD_FILE_RE,
  resolveImportMenuItems,
  type ImportMenuItem,
} from '../importMenu';
import type { SourceRef } from '../citationUtils';
import { hasImageUpload } from '../imageUpload';
import { insertMarkdown } from '../insertMarkdown';
import { subscribeMathClick, type MathKind } from '../math';
import {
  resolveToolbarLayout,
  type ToolbarGroup,
} from '../toolbarLayout';
import styles from '../styles/toolbar.module.css';
import '../styles/fullscreen.css';

export type { FullscreenTarget } from '../fullscreen';

/** 焦点是否在正文顶部的文档标题上。标题不是正文节点，工具栏不能给它套样式。 */
function focusedDocumentTitle(): HTMLTextAreaElement | null {
  const el = document.activeElement;
  if (el instanceof HTMLTextAreaElement && el.hasAttribute('data-document-title')) {
    return el;
  }
  return null;
}

/** 段落级样式读自段落或标题（光标所在处）——对齐 / 缩进 / 行高共用。 */
function readParaAttr<T>(editor: Editor, name: string): T | null {
  return (
    ((editor.getAttributes('paragraph')[name] ??
      editor.getAttributes('heading')[name]) as T | undefined) ?? null
  );
}
import {
  applyCapturedFormat,
  captureFormat,
  clearFormatting,
  type CapturedFormat,
} from '../formatBrush';
import { ImageAlignTools } from './ImageAlignTools';
import { renderToolbarBody } from './toolbarBody';
import { TableHandles } from './TableHandles';
import { MathEditorPopover } from './MathEditorPopover';

/** `onImportDocument` 的成功返回。给字符串等价于 `{ markdown }`。 */
export interface ImportDocumentResult {
  markdown: string;
  sources?: SourceRef[];
}

/** 导入进度。包用来更新光标占位文案并禁用导入按钮。 */
export interface ImportDocumentProgress {
  /** 0–1。通常只有上传阶段可测；转换阶段可省略。 */
  ratio?: number;
  phase: 'upload' | 'convert';
}

export interface ImportDocumentContext {
  /** 用户点取消或组件卸载时 abort，宿主据此中断请求。 */
  signal: AbortSignal;
  onProgress?: (p: ImportDocumentProgress) => void;
}

/** More 菜单里注入的自定义项（宿主用它扩展工具栏，如「导入项目报告」）。 */
export interface ExtraToolbarItem {
  key: string;
  /** 左侧图标插槽（可选，文字或 SVG 皆可）。 */
  icon?: ReactNode;
  label: string;
  disabled?: boolean;
  /** 点击回调，拿到 editor 实例自行操作（如 insertContent）。 */
  onSelect: (editor: Editor) => void;
}

export interface EditorToolbarProps {
  editor: Editor;
  /**
   * 图片直传回调：收到文件，返回可访问的图片 URL。
   * 编辑器注册了 imageUpload 时忽略这条路径，改为插入上传占位块。
   * 按钮是否出现由 `groups` 决定；默认清单里没有 `image`。
   * 抛错会转交 onError(..., 'image')。
   */
  onImageUpload?: (file: File) => Promise<string>;
  /**
   * 副作用错误回调（图片上传 / Markdown 导入失败），供宿主弹自己的提示。
   * `source` 区分来源，避免一律显示「图片上传失败」。
   */
  onError?: (err: unknown, source?: 'image' | 'markdown' | 'import') => void;
  /**
   * 非 Markdown 文件的转换：收到文件，返回可插入的 Markdown。未提供则导入只吃 .md。
   * 包内不校验扩展名——格式白名单由宿主的 `importAccept` 与本回调自己负责。
   * 抛错转交 onError(..., 'import')；`AbortError` 视为用户取消，不报错。
   */
  onImportDocument?: (
    file: File,
    ctx: ImportDocumentContext,
  ) => Promise<ImportDocumentResult | string>;
  /**
   * 追加到导入 input 的 accept（默认已含 `.md,.markdown,text/markdown`）。
   * 例：`.doc,.docx,.csv,.pdf`。未传 `importMenuItems` 且传了 `onImportDocument` 时，
   * 下拉会多一项「Document」。
   */
  importAccept?: string;
  /**
   * 主栏导入下拉的选项。不传则 Markdown；再加 `onImportDocument` + `importAccept`
   * 时多一项 Document。宿主要拆成 Word / PDF 时自己传入。
   */
  importMenuItems?: ImportMenuItem[];
  /** 内置语言，默认英文。 */
  locale?: LocaleCode;
  /**
   * 搜索按钮的点击回调。按钮是否出现由 `groups` 决定（默认清单里没有 `search`）。
   * 清单里有这颗按钮但没传回调时，按钮照样在，点击无反应。
   * 条子归编辑器；`findBar={false}` 时宿主自己摆条子。只读态照样可查，所以不随 `editable` 灰显。
   */
  onSearch?: () => void;
  /** 条子当前是否开着（驱动按钮的 aria-pressed / 高亮）。不传恒为未激活。 */
  searchActive?: boolean;
  /**
   * 工具栏时钟的点击回调。默认清单里没有 `history`，只传回调不会出现按钮。
   * 版本面板自己的悬浮按钮不读这个回调。
   */
  onHistory?: () => void;
  /** 历史面板当前是否开着（驱动按钮的 aria-pressed / 高亮）。不传恒为未激活。 */
  historyActive?: boolean;
  /**
   * 从默认清单里划掉的内置按钮 id。传了 `groups` 时忽略。
   * 不作用于 `extraToolbarItems` 的 key。
   */
  hidden?: readonly string[];
  /**
   * 自定义整栏。每个内层数组是一组，组与组之间一条竖线。
   * `{ more: [...] }` 是一颗「更多」按钮，一栏只能有一颗。
   * 不传则用 `defaultToolbarGroups`。
   */
  groups?: readonly ToolbarGroup[];
  /**
   * 要铺满视口的元素。不传则从工具栏往上找「里面有编辑器」的那一层
   * （工具栏和正文是兄弟时，就是它们的父元素）。工具栏单独挂在侧栏时，
   * 传这一层：`fullscreenTarget={() => frameRef.current}`。
   * 函数或 ref 在点击时再读。返回 null 时退回默认查找。
   */
  fullscreenTarget?: FullscreenTarget;
  /** 全屏开合。Esc、再点一次、关掉按钮、卸载时都会收到 `false`。 */
  onFullscreenChange?: (fullscreen: boolean) => void;
  /**
   * 自定义项。没传 `groups` 时追加到默认「更多」菜单；
   * 传了 `groups` 时，只有写进布局的 key 才会出现。
   */
  extraToolbarItems?: ExtraToolbarItem[];
  className?: string;
}

export type { ImportMenuItem };

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '30px'] as const;

/**
 * 顶部操作栏（零 UI 框架依赖，Radix Popover 菜单 + 内联 SVG 图标）。位置由父级控制，
 * 这里只渲染按钮 + 反映 editor 激活态。不含业务耦合，扩展项经 extraToolbarItems 注入。
 */
export function EditorToolbar({
  editor,
  onImageUpload,
  onError,
  onImportDocument,
  importAccept,
  importMenuItems,
  locale = 'en',
  onSearch,
  searchActive = false,
  onHistory,
  historyActive = false,
  hidden,
  groups,
  fullscreenTarget,
  onFullscreenChange,
  extraToolbarItems,
  className,
}: EditorToolbarProps) {
  const t: ToolbarLabels = getLocaleBundle(locale).toolbar;
  const extraKeyList = JSON.stringify(extraToolbarItems?.map((item) => item.key) ?? []);
  const layout = useMemo(
    () =>
      resolveToolbarLayout({
        groups,
        hidden,
        extraKeys: extraToolbarItems?.map((item) => item.key),
      }),
    [groups, hidden, extraKeyList, extraToolbarItems],
  );
  const warningKey = layout.warnings.join('\n');
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !warningKey) return;
    for (const line of warningKey.split('\n')) {
      console.warn(`[EditorToolbar] ${line}`);
    }
  }, [warningKey]);
  const toolbarRootRef = useRef<HTMLDivElement>(null);
  const { fullscreen, toggleFullscreen } = useToolbarFullscreen({
    enabled: layout.hasFullscreen,
    target: fullscreenTarget,
    toolbarRootRef,
    editor,
    onChange: onFullscreenChange,
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      taskList: e.isActive('taskList'),
      headingLevel: ([1, 2, 3, 4, 5, 6] as const).find((lv) =>
        e.isActive('heading', { level: lv }),
      ),
      fontSize: (e.getAttributes('textStyle').fontSize as string) || undefined,
      isParagraph: e.isActive('paragraph'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      numberingFormat: readCurrentNumberingFormat(e),
      blockquote: e.isActive('blockquote'),
      details: e.isActive('details'),
      textColor: (e.getAttributes('textStyle').color as string) || undefined,
      highlightColor:
        (e.getAttributes('highlight').color as string) || undefined,
      superscript: e.isActive('superscript'),
      subscript: e.isActive('subscript'),
      textAlign: readParaAttr<string>(e, 'textAlign'),
      indent: readParaAttr<number>(e, 'indent'),
      lineHeight: readParaAttr<number>(e, 'lineHeight'),
      inTable: e.isActive('table'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  // 编辑器是否聚焦：仅正文聚焦时才允许调字号。Popover 菜单开/关已阻止抢焦点，
  // 故打开下拉不会误触 blur。
  const [editorFocused, setEditorFocused] = useState(() => editor.isFocused);
  useEffect(() => {
    const onFocus = () => setEditorFocused(true);
    const onBlur = () => setEditorFocused(false);
    editor.on('focus', onFocus);
    editor.on('blur', onBlur);
    return () => {
      editor.off('focus', onFocus);
      editor.off('blur', onBlur);
    };
  }, [editor]);

  // 焦点进过大标题后一直算「正在编辑标题」，直到点回正文。
  // 工具栏按钮会 preventDefault，焦点可能短暂离开标题，但不能因此把 H 套到标题下面那一段。
  const titleEditingRef = useRef(false);
  const [titleFocused, setTitleFocused] = useState(false);
  const setTitleEditing = useCallback((editing: boolean) => {
    titleEditingRef.current = editing;
    setTitleFocused(editing);
  }, []);
  useEffect(() => {
    const sync = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.hasAttribute('data-document-title')) {
        setTitleEditing(true);
        return;
      }
      if (target.closest('.ProseMirror')) setTitleEditing(false);
    };
    const onEditorFocus = () => setTitleEditing(false);
    document.addEventListener('focusin', sync);
    editor.on('focus', onEditorFocus);
    return () => {
      document.removeEventListener('focusin', sync);
      editor.off('focus', onEditorFocus);
    };
  }, [editor, setTitleEditing]);
  const editingTitle = () => titleEditingRef.current || focusedDocumentTitle() !== null;

  // 格式刷：官方没有这个扩展。单击取样一次，双击锁定，Esc 取消。
  // 取样后下一次在正文里松开鼠标才套用，避免点按钮本身的 mouseup 被当成落点。
  const [painter, setPainter] = useState<'off' | 'once' | 'locked'>('off');
  const [paintSample, setPaintSample] = useState<CapturedFormat | null>(null);
  const painterClickAt = useRef(0);
  const painterEditor = useRef(editor);
  const disarmPainter = () => {
    painterClickAt.current = 0;
    setPainter('off');
    setPaintSample(null);
  };
  useEffect(() => {
    if (painterEditor.current === editor) return;
    painterEditor.current = editor;
    disarmPainter();
  }, [editor]);
  useEffect(() => {
    if (editor.isDestroyed) return;
    const dom = editor.view.dom;
    dom.classList.toggle('tmr-format-painter', painter !== 'off');
    return () => {
      if (!editor.isDestroyed) dom.classList.remove('tmr-format-painter');
    };
  }, [editor, painter]);
  useEffect(() => {
    if (painter === 'off' || !paintSample || editor.isDestroyed) return;
    const dom = editor.view.dom;
    const apply = () => {
      const handled = applyCapturedFormat(editor, paintSample);
      if (handled && painter === 'once') disarmPainter();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      disarmPainter();
    };
    dom.addEventListener('mouseup', apply);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      dom.removeEventListener('mouseup', apply);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [editor, painter, paintSample]);
  const onFormatPainterClick = () => {
    if (editingTitle() && painter === 'off') return;
    const now = Date.now();
    const quick = now - painterClickAt.current < 300;
    painterClickAt.current = now;
    if (painter !== 'off') {
      if (quick && painter === 'once') {
        setPainter('locked');
        return;
      }
      disarmPainter();
      return;
    }
    const captured = captureFormat(editor);
    if (!captured) return;
    setPaintSample(captured);
    setPainter(quick ? 'locked' : 'once');
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chain = () => editor.chain().focus();
  // 正在编辑文档标题时，工具栏样式不落到标题上，也不改标题下面的正文。
  const styleCommand = (
    apply: (commands: ReturnType<Editor['chain']>) => { run: () => boolean },
  ) => {
    if (editingTitle()) return;
    apply(editor.chain().focus()).run();
  };
  const markActive = (active: boolean) => (titleFocused ? false : active);

  // ── 表格工具条（右键召唤）：右键单元格时在鼠标处弹出，点别处/Esc 隐藏 ──
  // ── 图片：编辑器注册了 imageUpload 扩展就插上传占位块（块内拖拽/点选 → 进度 → 换图，
  //    配置见 <MarkdownWysiwygEditor imageUpload>）；否则退回旧的直传路径 ──
  const imageUploadEnabled = hasImageUpload(editor);
  const handlePickImage = () => {
    if (imageUploadEnabled) {
      chain().setImageUploadNode().run();
      return;
    }
    if (onImageUpload) fileInputRef.current?.click();
  };
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onImageUpload) return;
    try {
      const url = await onImageUpload(file);
      if (!url) throw new Error('empty url');
      chain().setImage({ src: url }).run();
    } catch (err) {
      console.error('image upload failed:', err);
      onError?.(err, 'image');
    }
  };

  // ── 导入：.md 包内读文本插入；其余原样交给宿主 onImportDocument ──
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState<ImportDocumentProgress | null>(
    null,
  );
  const importAbortRef = useRef<AbortController | null>(null);

  // 卸载（如切路由）中断在飞的导入，避免请求泄漏与卸载后 setState
  useEffect(() => () => importAbortRef.current?.abort(), []);

  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (MD_FILE_RE.test(file.name)) {
      try {
        insertMarkdown(editor, await file.text());
      } catch (err) {
        console.error('markdown import failed:', err);
        onError?.(err, 'markdown');
      }
      return;
    }

    if (!onImportDocument) {
      onError?.(new Error(`unsupported file: ${file.name}`), 'import');
      return;
    }

    const ctrl = new AbortController();
    importAbortRef.current = ctrl;
    setImporting({ phase: 'upload', ratio: 0 });
    const labelOf = (p: ImportDocumentProgress) =>
      p.phase === 'convert'
        ? t.importDocumentConverting
        : t.importDocumentUploading(Math.round((p.ratio ?? 0) * 100));
    editor.commands.insertImportPlaceholder(labelOf({ phase: 'upload', ratio: 0 }));
    try {
      const raw = await onImportDocument(file, {
        signal: ctrl.signal,
        onProgress: (p) => {
          if (ctrl.signal.aborted) return;
          setImporting(p);
          editor.commands.updateImportPlaceholder(labelOf(p));
        },
      });
      editor.commands.removeImportPlaceholder();
      const md = typeof raw === 'string' ? raw : raw.markdown;
      const sources = typeof raw === 'string' ? [] : raw.sources ?? [];
      insertMarkdown(editor, md, sources);
    } catch (err) {
      editor.commands.removeImportPlaceholder();
      // 卸载 abort 不算错误
      if (!ctrl.signal.aborted) {
        console.error('document import failed:', err);
        onError?.(err, 'import');
      }
    } finally {
      if (importAbortRef.current === ctrl) importAbortRef.current = null;
      setImporting(null);
    }
  };

  const importItems = resolveImportMenuItems({
    labels: t,
    onImportDocument,
    importAccept,
    importMenuItems,
  });

  const pickImport = (accept: string) => {
    const input = importInputRef.current;
    if (!input) return;
    input.accept = accept;
    input.value = '';
    input.click();
  };

  // 进度写在光标占位上；按钮只区分空闲 / 忙碌。
  const importTitle = importing ? t.importDocumentBusy : t.importDocumentHint;

  const applyTextColor = (color: string | null) => {
    styleCommand((commands) =>
      color ? commands.setColor(color) : commands.unsetColor(),
    );
  };
  const applyHighlight = (color: string | null) => {
    styleCommand((commands) =>
      color ? commands.setHighlight({ color }) : commands.unsetHighlight(),
    );
  };

  const setBlockStyle = (level: number) => {
    if (editingTitle()) return;
    if (level === 0) chain().setParagraph().run();
    else chain().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
  };

  const applyFontSize = (size: string) => {
    styleCommand((commands) =>
      size ? commands.setFontSize(size) : commands.unsetFontSize(),
    );
  };
  const canEditFontSize = editorFocused && state.isParagraph;

  const [mathEdit, setMathEdit] = useState<{
    kind: MathKind;
    mode: 'insert' | 'edit';
    pos?: number;
    latex: string;
    isNew?: boolean;
  } | null>(null);

  useEffect(() => subscribeMathClick((payload) => {
    setMathEdit({
      kind: payload.kind,
      mode: 'edit',
      pos: payload.pos,
      latex: payload.latex,
    });
  }), []);

  const openInsertMath = (kind: MathKind) => {
    const { from, to } = editor.state.selection;
    const selected =
      from === to ? '' : editor.state.doc.textBetween(from, to, ' ');
    const type = kind === 'inline' ? 'inlineMath' : 'blockMath';
    const searchFrom = from;
    chain().insertContent({ type, attrs: { latex: selected } }).run();
    let pos: number | null = null;
    editor.state.doc.nodesBetween(
      searchFrom,
      editor.state.doc.content.size,
      (node, nodePos) => {
        if (pos != null) return false;
        if (
          node.type.name === type &&
          String(node.attrs.latex ?? '') === selected
        ) {
          pos = nodePos;
          return false;
        }
      },
    );
    if (pos == null) {
      setMathEdit({ kind, mode: 'insert', latex: selected, isNew: true });
      return;
    }
    setMathEdit({
      kind,
      mode: 'edit',
      pos,
      latex: selected,
      isNew: true,
    });
  };

  const applyMath = (latex: string) => {
    if (!mathEdit) return;
    const { kind, mode, pos } = mathEdit;
    setMathEdit(null);
    if (mode === 'edit' && pos != null) {
      if (kind === 'inline') {
        chain().updateInlineMath({ latex, pos }).run();
      } else {
        chain().updateBlockMath({ latex, pos }).run();
      }
      return;
    }
    if (kind === 'inline') {
      chain().insertContent({ type: 'inlineMath', attrs: { latex } }).run();
    } else {
      chain().insertContent({ type: 'blockMath', attrs: { latex } }).run();
    }
  };

  const cancelMath = () => {
    if (!mathEdit) return;
    const { isNew, pos } = mathEdit;
    if (isNew && pos != null) {
      const node = editor.state.doc.nodeAt(pos);
      if (
        node &&
        (node.type.name === 'inlineMath' || node.type.name === 'blockMath')
      ) {
        editor
          .chain()
          .focus()
          .deleteRange({ from: pos, to: pos + node.nodeSize })
          .run();
      }
    }
    setMathEdit(null);
  };

  const scriptActive = titleFocused
    ? 'normal'
    : state.superscript
    ? 'superscript'
    : state.subscript
      ? 'subscript'
      : 'normal';

  return (
    <>
      <div
        ref={toolbarRootRef}
        data-tmr-toolbar=""
        className={
          className ? `${styles.toolbar} ${className}` : styles.toolbar
        }
      >
        <div className={styles.inner}>
          {renderToolbarBody({
            editor,
            locale,
            t,
            groups: layout.groups,
            fullscreen,
            toggleFullscreen,
            painter,
            titleFocused,
            scriptActive,
            canEditFontSize,
            searchActive,
            historyActive,
            importing: !!importing,
            importTitle,
            importItems,
            extraToolbarItems,
            state,
            onFormatPainterClick,
            clearFormatting: () => {
              if (editingTitle()) return;
              clearFormatting(editor);
            },
            styleCommand,
            markActive,
            setBlockStyle,
            applyFontSize,
            applyTextColor,
            applyHighlight,
            pickImage: handlePickImage,
            pickImport,
            onSearch,
            onHistory,
            openInsertMath,
            chain,
          })}
        </div>
      </div>

      {layout.hasImage && !imageUploadEnabled && onImageUpload ? (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleImageChange}
        />
      ) : null}
      {layout.hasImport ? (
        <input
          ref={importInputRef}
          type="file"
          hidden
          onChange={handleImportChange}
        />
      ) : null}

      {mathEdit ? (
        <MathEditorPopover
          editor={editor}
          kind={mathEdit.kind}
          mode={mathEdit.mode}
          pos={mathEdit.pos}
          latex={mathEdit.latex}
          isNew={mathEdit.isNew}
          newLabel={
            mathEdit.kind === 'inline' ? t.mathNewInline : t.mathNewBlock
          }
          placeholder={t.mathPlaceholder}
          doneLabel={t.mathDone}
          onConfirm={applyMath}
          onCancel={cancelMath}
        />
      ) : null}

      {/* 表格悬停手柄（行左缘 ⋮ / 表格上方 ⋯）+ 它的操作菜单；
          原来那套「表内右键出菜单」只剩多格选区的批量增删，由这个组件自己接管 */}
      <TableHandles editor={editor} labels={t} />
      {/* 图片对齐工具条（悬停图片时浮出；与表格手柄同一套就地交互） */}
      <ImageAlignTools editor={editor} labels={t} />
    </>
  );
}
