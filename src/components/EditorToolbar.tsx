'use client';

import * as Popover from '@radix-ui/react-popover';
import { useEditorState, type Editor } from '@tiptap/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  BoldIcon,
  ChevronDownIcon,
  CodeIcon,
  ColumnAfterIcon,
  ColumnBeforeIcon,
  ColumnDeleteIcon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListChecksIcon,
  ListOrderedIcon,
  ListUnorderedIcon,
  RedoIcon,
  RowAfterIcon,
  RowBeforeIcon,
  RowDeleteIcon,
  StrikethroughIcon,
  UnderlineIcon,
  UndoIcon,
} from '../icons';
import { defaultToolbarLabels, type ToolbarLabels } from '../labels';
import styles from '../styles/toolbar.module.css';
import { ColorPalette } from './ColorPalette';

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
   * 图片上传回调：收到文件，返回可访问的图片 URL。未提供则不显示图片按钮。
   * 抛错会转交 onError。
   */
  onImageUpload?: (file: File) => Promise<string>;
  /** 副作用错误回调（图片上传失败等），供宿主弹自己的提示。 */
  onError?: (err: unknown) => void;
  labels?: Partial<ToolbarLabels>;
  /** 追加到 More 菜单末尾的自定义项。 */
  extraToolbarItems?: ExtraToolbarItem[];
  className?: string;
}

/** 单个工具栏按钮：激活态高亮，disabled 时灰显。 */
function ToolbarButton({
  title,
  active,
  disabled,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      className={`${styles.btn} ${active ? styles.btnActive : ''}`}
      // mousedown + preventDefault 防止点击工具栏时编辑器失焦丢选区
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className={styles.divider} aria-hidden />;
}

// 关闭当前菜单的回调（由 MenuPopover 注入，MenuItem 选中后调用以收起）。
const MenuCloseCtx = createContext<() => void>(() => {});

/**
 * 菜单气泡：用 Radix Popover 而非 DropdownMenu——后者会强制抢焦点（menu 语义），
 * 打开即让编辑器 blur、丢选区；Popover 可 onOpenAutoFocus preventDefault 保持编辑器焦点。
 * 菜单项为普通 button（onMouseDown preventDefault 不夺焦），行为与原 antd 一致。
 */
function MenuPopover({
  trigger,
  children,
}: {
  trigger: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={styles.menu}
          sideOffset={4}
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <MenuCloseCtx.Provider value={close}>
            {children}
          </MenuCloseCtx.Provider>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function MenuItem({
  selected,
  disabled,
  onSelect,
  children,
}: {
  selected?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  const close = useContext(MenuCloseCtx);
  return (
    <button
      type="button"
      disabled={disabled}
      className={`${styles.menuItem} ${selected ? styles.menuItemSelected : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        onSelect();
        close();
      }}
    >
      {children}
    </button>
  );
}

/** 颜色气泡：点色块即应用并关闭。 */
function ColorPopover({
  title,
  glyph,
  bar,
  value,
  onPick,
  paletteLabels,
}: {
  title: string;
  glyph: string;
  bar: string;
  value?: string;
  onPick: (color: string | null) => void;
  paletteLabels: { none: string; theme: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={styles.btn}
          title={title}
          aria-label={title}
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className={styles.colorIcon}>
            <span className={styles.colorIconGlyph}>{glyph}</span>
            <span className={styles.colorIconBar} style={{ background: bar }} />
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={styles.popoverContent}
          sideOffset={4}
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <ColorPalette
            value={value}
            onPick={(c) => {
              onPick(c);
              setOpen(false);
            }}
            labels={paletteLabels}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '30px'] as const;

/**
 * 顶部操作栏（antd-free，Radix Popover 菜单 + 内联 SVG 图标）。位置由父级控制，
 * 这里只渲染按钮 + 反映 editor 激活态。不含业务耦合，扩展项经 extraToolbarItems 注入。
 */
export function EditorToolbar({
  editor,
  onImageUpload,
  onError,
  labels,
  extraToolbarItems,
  className,
}: EditorToolbarProps) {
  const t: ToolbarLabels = { ...defaultToolbarLabels, ...labels };

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
      blockquote: e.isActive('blockquote'),
      textColor: (e.getAttributes('textStyle').color as string) || undefined,
      highlightColor:
        (e.getAttributes('highlight').color as string) || undefined,
      superscript: e.isActive('superscript'),
      subscript: e.isActive('subscript'),
      inTable: e.isActive('table'),
      inTableHeader: e.isActive('tableHeader'),
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chain = () => editor.chain().focus();

  // ── 表格工具条（右键召唤）：右键单元格时在鼠标处弹出，点别处/Esc 隐藏 ──
  const [tableMenu, setTableMenu] = useState<{ x: number; y: number } | null>(
    null,
  );
  const closeTableMenu = useCallback(() => setTableMenu(null), []);

  useEffect(() => {
    const dom = editor.view.dom;
    const onContextMenu = (e: MouseEvent) => {
      const coords = editor.view.posAtCoords({
        left: e.clientX,
        top: e.clientY,
      });
      if (!coords) return;
      const $pos = editor.state.doc.resolve(coords.pos);
      let inTable = false;
      for (let d = $pos.depth; d > 0; d--) {
        if ($pos.node(d).type.name === 'table') {
          inTable = true;
          break;
        }
      }
      if (!inTable) return;
      e.preventDefault();
      editor.chain().focus().setTextSelection(coords.pos).run();
      setTableMenu({ x: e.clientX, y: e.clientY });
    };
    dom.addEventListener('contextmenu', onContextMenu);
    return () => dom.removeEventListener('contextmenu', onContextMenu);
  }, [editor]);

  useEffect(() => {
    if (!tableMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTableMenu();
    };
    document.addEventListener('mousedown', closeTableMenu);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', closeTableMenu);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [tableMenu, closeTableMenu]);

  const runTable = useCallback(
    (fn: () => void) => {
      fn();
      closeTableMenu();
    },
    [closeTableMenu],
  );

  // ── 图片：选图 → onImageUpload → 插入返回的 URL ──
  const handlePickImage = () => fileInputRef.current?.click();
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
      onError?.(err);
    }
  };

  const applyTextColor = (color: string | null) => {
    if (color) chain().setColor(color).run();
    else chain().unsetColor().run();
  };
  const applyHighlight = (color: string | null) => {
    if (color) chain().setHighlight({ color }).run();
    else chain().unsetHighlight().run();
  };

  const toggleLink = () => {
    if (state.link) {
      chain().unsetLink().run();
      return;
    }
    const url = window.prompt(t.linkPrompt);
    if (url) chain().setLink({ href: url }).run();
  };

  const setBlockStyle = (level: number) => {
    if (level === 0) chain().setParagraph().run();
    else
      chain()
        .toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 })
        .run();
  };

  const applyFontSize = (size: string) => {
    if (size) chain().setFontSize(size).run();
    else chain().unsetFontSize().run();
  };
  const canEditFontSize = editorFocused && state.isParagraph;

  const scriptActive = state.superscript
    ? 'superscript'
    : state.subscript
      ? 'subscript'
      : 'normal';

  return (
    <>
      <div
        className={
          className ? `${styles.toolbar} ${className}` : styles.toolbar
        }
      >
        <div className={styles.inner}>
          {/* 撤销 / 重做 */}
          <ToolbarButton
            title={t.undo}
            disabled={!state.canUndo}
            onClick={() => chain().undo().run()}
          >
            <UndoIcon />
          </ToolbarButton>
          <ToolbarButton
            title={t.redo}
            disabled={!state.canRedo}
            onClick={() => chain().redo().run()}
          >
            <RedoIcon />
          </ToolbarButton>

          <Divider />

          {/* 段落样式下拉（正文 / 标题 1~6） */}
          <MenuPopover
            trigger={
              <button
                type="button"
                className={styles.styleTrigger}
                title={t.style}
                onMouseDown={(e) => e.preventDefault()}
              >
                <span className={styles.styleTriggerLabel}>{t.style}</span>
                <ChevronDownIcon size={12} className={styles.styleTriggerCaret} />
              </button>
            }
          >
            <MenuItem
              selected={(state.headingLevel ?? 0) === 0}
              onSelect={() => setBlockStyle(0)}
            >
              <span className={styles.styleItem}>
                <span className={styles.styleIcon}>¶</span>
                {t.normalText}
              </span>
            </MenuItem>
            {HEADING_LEVELS.map((lv) => (
              <MenuItem
                key={lv}
                selected={state.headingLevel === lv}
                onSelect={() => setBlockStyle(lv)}
              >
                <span className={styles.styleItem}>
                  <span className={styles.styleIcon}>{`H${lv}`}</span>
                  {t.headingLabel(lv)}
                </span>
              </MenuItem>
            ))}
          </MenuPopover>

          {/* 正文字号下拉：仅正文可调 */}
          <MenuPopover
            trigger={
              <button
                type="button"
                className={styles.styleTrigger}
                title={t.fontSize}
                aria-label={t.fontSize}
                disabled={!canEditFontSize}
                onMouseDown={(e) => e.preventDefault()}
              >
                <span className={styles.styleTriggerLabel}>
                  {state.fontSize || t.fontSize}
                </span>
                <ChevronDownIcon size={12} className={styles.styleTriggerCaret} />
              </button>
            }
          >
            <MenuItem
              selected={!state.fontSize}
              onSelect={() => applyFontSize('')}
            >
              <span className={styles.styleItem}>
                <span className={styles.styleIcon}>A</span>
                {t.fontSizeDefault}
              </span>
            </MenuItem>
            {FONT_SIZES.map((size) => (
              <MenuItem
                key={size}
                selected={state.fontSize === size}
                onSelect={() => applyFontSize(size)}
              >
                <span className={styles.styleItem}>
                  <span className={styles.styleIcon}>{parseInt(size, 10)}</span>
                  {size}
                </span>
              </MenuItem>
            ))}
          </MenuPopover>

          <Divider />

          {/* 文字格式 */}
          <ToolbarButton
            title={t.bold}
            active={state.bold}
            onClick={() => chain().toggleBold().run()}
          >
            <BoldIcon />
          </ToolbarButton>
          <ToolbarButton
            title={t.italic}
            active={state.italic}
            onClick={() => chain().toggleItalic().run()}
          >
            <ItalicIcon />
          </ToolbarButton>
          <ToolbarButton
            title={t.underline}
            active={state.underline}
            onClick={() => chain().toggleUnderline().run()}
          >
            <UnderlineIcon />
          </ToolbarButton>
          <ToolbarButton
            title={t.strike}
            active={state.strike}
            onClick={() => chain().toggleStrike().run()}
          >
            <StrikethroughIcon />
          </ToolbarButton>
          <ToolbarButton
            title={t.code}
            active={state.code}
            onClick={() => chain().toggleCode().run()}
          >
            <CodeIcon />
          </ToolbarButton>

          {/* 文字颜色 */}
          <ColorPopover
            title={t.textColor}
            glyph="T"
            bar={state.textColor || '#ff3b30'}
            value={state.textColor}
            onPick={applyTextColor}
            paletteLabels={{ none: t.colorNone, theme: t.colorTheme }}
          />
          {/* 文字高亮 */}
          <ColorPopover
            title={t.highlight}
            glyph="✎"
            bar={state.highlightColor || '#ffd83d'}
            value={state.highlightColor}
            onPick={applyHighlight}
            paletteLabels={{ none: t.colorNone, theme: t.colorTheme }}
          />

          {/* 上标 / 下标下拉（A▾） */}
          <MenuPopover
            trigger={
              <button
                type="button"
                className={`${styles.scriptTrigger} ${
                  scriptActive !== 'normal' ? styles.btnActive : ''
                }`}
                title={t.scriptMenu}
                aria-label={t.scriptMenu}
                onMouseDown={(e) => e.preventDefault()}
              >
                <span className={styles.scriptTriggerGlyph}>A</span>
                <ChevronDownIcon size={12} className={styles.styleTriggerCaret} />
              </button>
            }
          >
            <MenuItem
              selected={scriptActive === 'normal'}
              onSelect={() => chain().unsetSuperscript().unsetSubscript().run()}
            >
              <span className={styles.styleItem}>
                <span className={styles.styleIcon}>A</span>
                {t.scriptNormal}
              </span>
            </MenuItem>
            <MenuItem
              selected={scriptActive === 'superscript'}
              onSelect={() => chain().unsetSubscript().toggleSuperscript().run()}
            >
              <span className={styles.styleItem}>
                <span className={`${styles.styleIcon} ${styles.scriptGlyph}`}>
                  x<sup>2</sup>
                </span>
                {t.superscript}
              </span>
            </MenuItem>
            <MenuItem
              selected={scriptActive === 'subscript'}
              onSelect={() => chain().unsetSuperscript().toggleSubscript().run()}
            >
              <span className={styles.styleItem}>
                <span className={`${styles.styleIcon} ${styles.scriptGlyph}`}>
                  x<sub>2</sub>
                </span>
                {t.subscript}
              </span>
            </MenuItem>
          </MenuPopover>

          <Divider />

          {/* 插入媒体 */}
          <ToolbarButton title={t.link} active={state.link} onClick={toggleLink}>
            <LinkIcon />
          </ToolbarButton>
          {onImageUpload ? (
            <>
              <ToolbarButton title={t.image} onClick={handlePickImage}>
                <ImageIcon />
              </ToolbarButton>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleImageChange}
              />
            </>
          ) : null}
          <ToolbarButton
            title={t.blockquote}
            active={state.blockquote}
            onClick={() => chain().toggleBlockquote().run()}
          >
            <span className={styles.txtIcon}>❝</span>
          </ToolbarButton>

          <Divider />

          {/* 列表 */}
          <ToolbarButton
            title={t.bulletList}
            active={state.bulletList}
            onClick={() => chain().toggleBulletList().run()}
          >
            <ListUnorderedIcon />
          </ToolbarButton>
          <ToolbarButton
            title={t.orderedList}
            active={state.orderedList}
            onClick={() => chain().toggleOrderedList().run()}
          >
            <ListOrderedIcon />
          </ToolbarButton>
          <ToolbarButton
            title={t.taskList}
            active={state.taskList}
            onClick={() => chain().toggleTaskList().run()}
          >
            <ListChecksIcon />
          </ToolbarButton>

          <Divider />

          {/* More 下拉（代码块、分割线、表格 + 宿主注入项） */}
          <MenuPopover
            trigger={
              <button
                type="button"
                className={styles.styleTrigger}
                title={t.more}
                onMouseDown={(e) => e.preventDefault()}
              >
                <span className={styles.styleTriggerLabel}>{t.more}</span>
                <ChevronDownIcon size={12} className={styles.styleTriggerCaret} />
              </button>
            }
          >
            <MenuItem onSelect={() => chain().toggleCodeBlock().run()}>
              <span className={styles.styleItem}>
                <span className={styles.styleIcon}>{'{ }'}</span>
                {t.codeBlock}
              </span>
            </MenuItem>
            <MenuItem onSelect={() => chain().setHorizontalRule().run()}>
              <span className={styles.styleItem}>
                <span className={styles.styleIcon}>—</span>
                {t.hr}
              </span>
            </MenuItem>
            <MenuItem
              disabled={state.inTable}
              onSelect={() =>
                chain()
                  .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                  .run()
              }
            >
              <span className={styles.styleItem}>
                <span className={styles.styleIcon}>⊞</span>
                {t.tableInsert}
              </span>
            </MenuItem>
            {extraToolbarItems?.map((item) => (
              <MenuItem
                key={item.key}
                disabled={item.disabled}
                onSelect={() => item.onSelect(editor)}
              >
                <span className={styles.styleItem}>
                  <span className={styles.styleIcon}>{item.icon}</span>
                  {item.label}
                </span>
              </MenuItem>
            ))}
          </MenuPopover>
        </div>
      </div>

      {/* 表格工具条（右键召唤） */}
      {tableMenu &&
        createPortal(
          <div
            className={styles.tableBubble}
            style={{ position: 'fixed', left: tableMenu.x, top: tableMenu.y }}
            onMouseDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <ToolbarButton
              title={t.tableAddColumnBefore}
              onClick={() => runTable(() => chain().addColumnBefore().run())}
            >
              <ColumnBeforeIcon />
            </ToolbarButton>
            <ToolbarButton
              title={t.tableAddColumnAfter}
              onClick={() => runTable(() => chain().addColumnAfter().run())}
            >
              <ColumnAfterIcon />
            </ToolbarButton>
            <ToolbarButton
              title={t.tableDeleteColumn}
              onClick={() => runTable(() => chain().deleteColumn().run())}
            >
              <ColumnDeleteIcon />
            </ToolbarButton>
            <Divider />
            <ToolbarButton
              title={t.tableAddRowBefore}
              disabled={state.inTableHeader}
              onClick={() => runTable(() => chain().addRowBefore().run())}
            >
              <RowBeforeIcon />
            </ToolbarButton>
            <ToolbarButton
              title={t.tableAddRowAfter}
              onClick={() => runTable(() => chain().addRowAfter().run())}
            >
              <RowAfterIcon />
            </ToolbarButton>
            <ToolbarButton
              title={t.tableDeleteRow}
              disabled={state.inTableHeader}
              onClick={() => runTable(() => chain().deleteRow().run())}
            >
              <RowDeleteIcon />
            </ToolbarButton>
          </div>,
          document.body,
        )}
    </>
  );
}
