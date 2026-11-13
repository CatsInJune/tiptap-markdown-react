import { Fragment, type ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  ChevronDownIcon,
  CodeIcon,
  DetailsIcon,
  EraserIcon,
  ExpandIcon,
  ImageIcon,
  IndentDecreaseIcon,
  IndentIncreaseIcon,
  ItalicIcon,
  LineHeightIcon,
  LinkIcon,
  ListChecksIcon,
  ListOrderedIcon,
  ListUnorderedIcon,
  MinimizeIcon,
  PaintbrushIcon,
  HistoryIcon,
  RedoIcon,
  SearchIcon,
  StrikethroughIcon,
  UnderlineIcon,
  UndoIcon,
} from '../icons';
import type { ToolbarLabels } from '../labels';
import { applyNumberingFormat, type NumberingFormat } from '../numberingFormat';
import type { ResolvedToolbarGroup } from '../toolbarLayout';
import type { ExtraToolbarItem } from './EditorToolbar';
import { LinkPopover } from './LinkPopover';
import {
  ColorPopover,
  Divider,
  LINE_HEIGHTS,
  MenuItem,
  MenuPopover,
  NumberingFormatGrid,
  TableInsertItem,
  ToolbarButton,
} from './toolbarChrome';
import styles from '../styles/toolbar.module.css';

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '30px'] as const;

export interface ToolbarBodyModel {
  editor: Editor;
  t: ToolbarLabels;
  groups: ResolvedToolbarGroup[];
  fullscreen: boolean;
  toggleFullscreen: () => void;
  painter: 'off' | 'once' | 'locked';
  titleFocused: boolean;
  scriptActive: 'normal' | 'superscript' | 'subscript';
  canEditFontSize: boolean;
  searchActive: boolean;
  historyActive: boolean;
  importing: boolean;
  importTitle: string;
  importItems: { key: string; label: string; accept: string }[];
  extraToolbarItems?: ExtraToolbarItem[];
  state: {
    canUndo: boolean;
    canRedo: boolean;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
    code: boolean;
    link: boolean;
    bulletList: boolean;
    orderedList: boolean;
    taskList: boolean;
    blockquote: boolean;
    details: boolean;
    headingLevel?: number;
    fontSize?: string;
    textColor?: string;
    highlightColor?: string;
    textAlign: string | null;
    lineHeight: number | null;
    numberingFormat: NumberingFormat | null;
    inTable: boolean;
  };
  onFormatPainterClick: () => void;
  clearFormatting: () => void;
  styleCommand: (
    apply: (commands: ReturnType<Editor['chain']>) => { run: () => boolean },
  ) => void;
  markActive: (active: boolean) => boolean;
  setBlockStyle: (level: number) => void;
  applyFontSize: (size: string) => void;
  applyTextColor: (color: string | null) => void;
  applyHighlight: (color: string | null) => void;
  pickImage: () => void;
  pickImport: (accept: string) => void;
  onSearch?: () => void;
  onHistory?: () => void;
  openInsertMath: (kind: 'inline' | 'block') => void;
  chain: () => ReturnType<Editor['chain']>;
}

export function renderToolbarBody(ctx: ToolbarBodyModel): ReactNode {
  const renderControl = (id: string) => controlNode(id, ctx);
  const renderMore = (ids: string[]) => moreNode(ids, ctx);
  return ctx.groups.map((group, groupIndex) => (
    <Fragment key={groupIndex}>
      {groupIndex > 0 ? <Divider /> : null}
      {group.items.map((item) =>
        item.type === 'more' ? (
          <Fragment key="more">{renderMore(item.ids)}</Fragment>
        ) : (
          <Fragment key={item.id}>{renderControl(item.id)}</Fragment>
        ),
      )}
    </Fragment>
  ));
}

function iconButton(
  id: string,
  title: string,
  icon: ReactNode,
  onClick?: () => void,
  opts?: { active?: boolean; disabled?: boolean },
) {
  return (
    <ToolbarButton
      data-toolbar-item={id}
      title={title}
      active={opts?.active}
      disabled={opts?.disabled}
      onClick={onClick}
    >
      {icon}
    </ToolbarButton>
  );
}

function menuRow(
  label: string,
  icon: ReactNode,
  onSelect: () => void,
  selected?: boolean,
) {
  return (
    <MenuItem label={label} selected={selected} onSelect={onSelect}>
      <span className={styles.styleItem}>
        <span className={styles.styleIcon}>{icon}</span>
        {label}
      </span>
    </MenuItem>
  );
}

function controlNode(id: string, ctx: ToolbarBodyModel): ReactNode {
  const { t, state, editor } = ctx;
  const extra = ctx.extraToolbarItems?.find((item) => item.key === id);
  switch (id) {
    case 'undo':
      return iconButton('undo', t.undo, <UndoIcon />, () => ctx.chain().undo().run(), {
        disabled: !state.canUndo,
      });
    case 'redo':
      return iconButton('redo', t.redo, <RedoIcon />, () => ctx.chain().redo().run(), {
        disabled: !state.canRedo,
      });
    case 'formatPainter':
      return iconButton('formatPainter', t.formatPainter, <PaintbrushIcon />, ctx.onFormatPainterClick, {
        active: ctx.painter !== 'off',
      });
    case 'clearFormatting':
      return iconButton('clearFormatting', t.clearFormatting, <EraserIcon />, ctx.clearFormatting);
    case 'style':
      return styleMenu(ctx);
    case 'fontSize':
      return fontSizeMenu(ctx);
    case 'bold':
      return iconButton('bold', t.bold, <BoldIcon />, () => ctx.styleCommand((c) => c.toggleBold()), {
        active: ctx.markActive(state.bold),
      });
    case 'italic':
      return iconButton('italic', t.italic, <ItalicIcon />, () => ctx.styleCommand((c) => c.toggleItalic()), {
        active: ctx.markActive(state.italic),
      });
    case 'underline':
      return iconButton(
        'underline',
        t.underline,
        <UnderlineIcon />,
        () => ctx.styleCommand((c) => c.toggleUnderline()),
        { active: ctx.markActive(state.underline) },
      );
    case 'strike':
      return iconButton(
        'strike',
        t.strike,
        <StrikethroughIcon />,
        () => ctx.styleCommand((c) => c.toggleStrike()),
        { active: ctx.markActive(state.strike) },
      );
    case 'code':
      return iconButton('code', t.code, <CodeIcon />, () => ctx.styleCommand((c) => c.toggleCode()), {
        active: ctx.markActive(state.code),
      });
    case 'textColor':
      return (
        <ColorPopover
          title={t.textColor}
          glyph="T"
          bar={state.textColor || '#ff3b30'}
          value={state.textColor}
          onPick={ctx.applyTextColor}
        />
      );
    case 'highlight':
      return (
        <ColorPopover
          title={t.highlight}
          glyph="✎"
          bar={state.highlightColor || '#ffd83d'}
          value={state.highlightColor}
          onPick={ctx.applyHighlight}
        />
      );
    case 'script':
      return scriptMenu(ctx);
    case 'link':
      return (
        <LinkPopover
          editor={editor}
          trigger={
            <ToolbarButton data-toolbar-item="link" title={t.link} active={state.link}>
              <LinkIcon />
            </ToolbarButton>
          }
        />
      );
    case 'image':
      return iconButton('image', t.image, <ImageIcon />, ctx.pickImage);
    case 'import':
      return importMenu(ctx);
    case 'blockquote':
      return iconButton(
        'blockquote',
        t.blockquote,
        <span className={styles.txtIcon}>❝</span>,
        () => ctx.styleCommand((c) => c.toggleBlockquote()),
        { active: ctx.markActive(state.blockquote) },
      );
    case 'details':
      return iconButton('details', t.details, <DetailsIcon />, () => {
        const next = ctx.chain();
        if (editor.isActive('details')) next.unsetDetails().run();
        else next.setDetails().run();
      }, { active: state.details });
    case 'align':
      return alignMenu(ctx);
    case 'indent':
      return indentMenu(ctx);
    case 'lineHeight':
      return lineHeightMenu(ctx);
    case 'bulletList':
      return iconButton(
        'bulletList',
        t.bulletList,
        <ListUnorderedIcon />,
        () => ctx.chain().toggleBulletList().run(),
        { active: state.bulletList },
      );
    case 'orderedList':
      return orderedListControl(ctx);
    case 'taskList':
      return iconButton(
        'taskList',
        t.taskList,
        <ListChecksIcon />,
        () => ctx.chain().toggleTaskList().run(),
        { active: state.taskList },
      );
    case 'search':
      return iconButton('search', t.search, <SearchIcon />, () => ctx.onSearch?.(), {
        active: ctx.searchActive,
      });
    case 'history':
      return iconButton('history', t.history, <HistoryIcon />, () => ctx.onHistory?.(), {
        active: ctx.historyActive,
      });
    case 'codeBlock':
      return iconButton('codeBlock', t.codeBlock, <span className={styles.txtIcon}>{'{ }'}</span>, () =>
        ctx.chain().toggleCodeBlock().run(),
      );
    case 'inlineMath':
      return iconButton('inlineMath', t.inlineMath, <span className={styles.txtIcon}>√x</span>, () =>
        ctx.openInsertMath('inline'),
      );
    case 'blockMath':
      return iconButton('blockMath', t.blockMath, <span className={styles.txtIcon}>∑</span>, () =>
        ctx.openInsertMath('block'),
      );
    case 'hr':
      return iconButton('hr', t.hr, <span className={styles.txtIcon}>—</span>, () =>
        ctx.chain().setHorizontalRule().run(),
      );
    case 'table':
      return (
        <TableInsertItem
          disabled={state.inTable}
          labels={t}
          onInsert={(rows, cols) =>
            ctx.chain().insertTable({ rows, cols, withHeaderRow: true }).run()
          }
          trigger={
            <ToolbarButton data-toolbar-item="table" title={t.tableInsert} disabled={state.inTable}>
              <span className={styles.txtIcon}>⊞</span>
            </ToolbarButton>
          }
        />
      );
    case 'fullscreen':
      return iconButton(
        'fullscreen',
        ctx.fullscreen ? t.exitFullscreen : t.fullscreen,
        ctx.fullscreen ? <MinimizeIcon /> : <ExpandIcon />,
        ctx.toggleFullscreen,
        { active: ctx.fullscreen },
      );
    default:
      if (!extra) return null;
      return iconButton(
        extra.key,
        extra.label,
        extra.icon ?? <span className={styles.txtIcon}>•</span>,
        () => extra.onSelect(editor),
        { disabled: extra.disabled },
      );
  }
}

function moreNode(ids: string[], ctx: ToolbarBodyModel): ReactNode {
  const { t } = ctx;
  return (
    <MenuPopover
      trigger={
        <button
          type="button"
          className={styles.styleTrigger}
          title={t.more}
          data-toolbar-item="more"
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className={styles.styleTriggerLabel}>{t.more}</span>
          <ChevronDownIcon size={12} className={styles.styleTriggerCaret} />
        </button>
      }
    >
      {ids.map((id) => (
        <Fragment key={id}>{moreEntry(id, ctx)}</Fragment>
      ))}
    </MenuPopover>
  );
}

function moreEntry(id: string, ctx: ToolbarBodyModel): ReactNode {
  const { t, state, editor } = ctx;
  const extra = ctx.extraToolbarItems?.find((item) => item.key === id);
  switch (id) {
    case 'undo':
      return menuRow(t.undo, <UndoIcon size={14} />, () => ctx.chain().undo().run());
    case 'redo':
      return menuRow(t.redo, <RedoIcon size={14} />, () => ctx.chain().redo().run());
    case 'formatPainter':
      return menuRow(t.formatPainter, <PaintbrushIcon size={14} />, ctx.onFormatPainterClick, ctx.painter !== 'off');
    case 'clearFormatting':
      return menuRow(t.clearFormatting, <EraserIcon size={14} />, ctx.clearFormatting);
    case 'bold':
      return menuRow(t.bold, <BoldIcon size={14} />, () => ctx.styleCommand((c) => c.toggleBold()), ctx.markActive(state.bold));
    case 'italic':
      return menuRow(t.italic, <ItalicIcon size={14} />, () => ctx.styleCommand((c) => c.toggleItalic()), ctx.markActive(state.italic));
    case 'underline':
      return menuRow(t.underline, <UnderlineIcon size={14} />, () => ctx.styleCommand((c) => c.toggleUnderline()), ctx.markActive(state.underline));
    case 'strike':
      return menuRow(t.strike, <StrikethroughIcon size={14} />, () => ctx.styleCommand((c) => c.toggleStrike()), ctx.markActive(state.strike));
    case 'code':
      return menuRow(t.code, <CodeIcon size={14} />, () => ctx.styleCommand((c) => c.toggleCode()), ctx.markActive(state.code));
    case 'link':
      return (
        <LinkPopover
          editor={editor}
          trigger={
            <button type="button" className={styles.menuItem} onMouseDown={(e) => e.preventDefault()}>
              <span className={styles.styleItem}>
                <span className={styles.styleIcon}><LinkIcon size={14} /></span>
                {t.link}
              </span>
            </button>
          }
        />
      );
    case 'image':
      return menuRow(t.image, <ImageIcon size={14} />, ctx.pickImage);
    case 'blockquote':
      return menuRow(t.blockquote, <span>❝</span>, () => ctx.styleCommand((c) => c.toggleBlockquote()), ctx.markActive(state.blockquote));
    case 'details':
      return menuRow(t.details, <DetailsIcon size={14} />, () => {
        const next = ctx.chain();
        if (editor.isActive('details')) next.unsetDetails().run();
        else next.setDetails().run();
      }, state.details);
    case 'bulletList':
      return menuRow(t.bulletList, <ListUnorderedIcon size={14} />, () => ctx.chain().toggleBulletList().run(), state.bulletList);
    case 'taskList':
      return menuRow(t.taskList, <ListChecksIcon size={14} />, () => ctx.chain().toggleTaskList().run(), state.taskList);
    case 'search':
      return menuRow(t.search, <SearchIcon size={14} />, () => ctx.onSearch?.(), ctx.searchActive);
    case 'history':
      return menuRow(t.history, <HistoryIcon size={14} />, () => ctx.onHistory?.(), ctx.historyActive);
    case 'codeBlock':
      return menuRow(t.codeBlock, <span>{'{ }'}</span>, () => ctx.chain().toggleCodeBlock().run());
    case 'inlineMath':
      return menuRow(t.inlineMath, <span>√x</span>, () => ctx.openInsertMath('inline'));
    case 'blockMath':
      return menuRow(t.blockMath, <span>∑</span>, () => ctx.openInsertMath('block'));
    case 'hr':
      return menuRow(t.hr, <span>—</span>, () => ctx.chain().setHorizontalRule().run());
    case 'table':
      return (
        <TableInsertItem
          disabled={state.inTable}
          labels={t}
          onInsert={(rows, cols) =>
            ctx.chain().insertTable({ rows, cols, withHeaderRow: true }).run()
          }
        />
      );
    case 'fullscreen':
      return menuRow(
        ctx.fullscreen ? t.exitFullscreen : t.fullscreen,
        ctx.fullscreen ? <MinimizeIcon size={14} /> : <ExpandIcon size={14} />,
        ctx.toggleFullscreen,
        ctx.fullscreen,
      );
    default:
      if (!extra) return null;
      return (
        <MenuItem disabled={extra.disabled} onSelect={() => extra.onSelect(editor)}>
          <span className={styles.styleItem}>
            <span className={styles.styleIcon}>{extra.icon}</span>
            {extra.label}
          </span>
        </MenuItem>
      );
  }
}

function styleMenu(ctx: ToolbarBodyModel) {
  const { t, state } = ctx;
  return (
    <MenuPopover
      trigger={
        <button
          type="button"
          data-toolbar-item="style"
          className={`${styles.styleTrigger} ${styles.styleTriggerStable}`}
          title={ctx.titleFocused || !state.headingLevel ? t.normalText : t.headingLabel(state.headingLevel)}
          aria-label={t.style}
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className={`${styles.styleTriggerLabel} ${styles.styleTriggerLabelStable}`}>
            <span className={styles.styleTriggerSizer} aria-hidden="true">
              <span>{t.normalText}</span>
              {HEADING_LEVELS.map((lv) => (
                <span key={lv}>{`H${lv}`}</span>
              ))}
            </span>
            <span className={styles.styleTriggerValue}>
              {ctx.titleFocused || !state.headingLevel ? t.normalText : `H${state.headingLevel}`}
            </span>
          </span>
          <ChevronDownIcon size={12} className={styles.styleTriggerCaret} />
        </button>
      }
    >
      <MenuItem selected={!ctx.titleFocused && (state.headingLevel ?? 0) === 0} onSelect={() => ctx.setBlockStyle(0)}>
        <span className={styles.styleItem}>
          <span className={styles.styleIcon}>¶</span>
          {t.normalText}
        </span>
      </MenuItem>
      {HEADING_LEVELS.map((lv) => (
        <MenuItem key={lv} selected={!ctx.titleFocused && state.headingLevel === lv} onSelect={() => ctx.setBlockStyle(lv)}>
          <span className={styles.styleItem}>
            <span className={styles.styleIcon}>{`H${lv}`}</span>
            {t.headingLabel(lv)}
          </span>
        </MenuItem>
      ))}
    </MenuPopover>
  );
}

function fontSizeMenu(ctx: ToolbarBodyModel) {
  const { t, state } = ctx;
  return (
    <MenuPopover
      trigger={
        <button
          type="button"
          data-toolbar-item="fontSize"
          className={`${styles.styleTrigger} ${styles.styleTriggerStable}`}
          title={state.fontSize || t.fontSize}
          aria-label={t.fontSize}
          disabled={!ctx.canEditFontSize}
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className={`${styles.styleTriggerLabel} ${styles.styleTriggerLabelStable}`}>
            <span className={styles.styleTriggerSizer} aria-hidden="true">
              <span>{t.fontSize}</span>
              {FONT_SIZES.map((size) => (
                <span key={size}>{size}</span>
              ))}
            </span>
            <span className={styles.styleTriggerValue}>{state.fontSize || t.fontSize}</span>
          </span>
          <ChevronDownIcon size={12} className={styles.styleTriggerCaret} />
        </button>
      }
    >
      <MenuItem selected={!state.fontSize} onSelect={() => ctx.applyFontSize('')}>
        <span className={styles.styleItem}>
          <span className={styles.styleIcon}>A</span>
          {t.fontSizeDefault}
        </span>
      </MenuItem>
      {FONT_SIZES.map((size) => (
        <MenuItem key={size} selected={state.fontSize === size} onSelect={() => ctx.applyFontSize(size)}>
          <span className={styles.styleItem}>
            <span className={styles.styleIcon}>{parseInt(size, 10)}</span>
            {size}
          </span>
        </MenuItem>
      ))}
    </MenuPopover>
  );
}

function scriptMenu(ctx: ToolbarBodyModel) {
  const { t } = ctx;
  return (
    <MenuPopover
      trigger={
        <button
          type="button"
          data-toolbar-item="script"
          className={`${styles.scriptTrigger} ${ctx.scriptActive !== 'normal' ? styles.btnActive : ''}`}
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
        selected={ctx.scriptActive === 'normal'}
        onSelect={() => ctx.styleCommand((c) => c.unsetSuperscript().unsetSubscript())}
      >
        <span className={styles.styleItem}>
          <span className={styles.styleIcon}>A</span>
          {t.scriptNormal}
        </span>
      </MenuItem>
      <MenuItem
        selected={ctx.scriptActive === 'superscript'}
        onSelect={() => ctx.styleCommand((c) => c.unsetSubscript().toggleSuperscript())}
      >
        <span className={styles.styleItem}>
          <span className={`${styles.styleIcon} ${styles.scriptGlyph}`}>
            x<sup>2</sup>
          </span>
          {t.superscript}
        </span>
      </MenuItem>
      <MenuItem
        selected={ctx.scriptActive === 'subscript'}
        onSelect={() => ctx.styleCommand((c) => c.unsetSuperscript().toggleSubscript())}
      >
        <span className={styles.styleItem}>
          <span className={`${styles.styleIcon} ${styles.scriptGlyph}`}>
            x<sub>2</sub>
          </span>
          {t.subscript}
        </span>
      </MenuItem>
    </MenuPopover>
  );
}

function importMenu(ctx: ToolbarBodyModel) {
  const { t } = ctx;
  return (
    <MenuPopover
      trigger={
        <button
          type="button"
          data-toolbar-item="import"
          className={styles.styleTrigger}
          title={ctx.importTitle}
          aria-label={ctx.importTitle}
          aria-busy={ctx.importing}
          disabled={ctx.importing}
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className={styles.styleTriggerLabel}>{t.importDocument}</span>
          <ChevronDownIcon size={12} className={styles.styleTriggerCaret} />
        </button>
      }
    >
      {ctx.importItems.map((item) => (
        <MenuItem key={item.key} onSelect={() => ctx.pickImport(item.accept)}>
          {item.label}
        </MenuItem>
      ))}
    </MenuPopover>
  );
}

function alignMenu(ctx: ToolbarBodyModel) {
  const { t, state } = ctx;
  const options = [
    { value: 'left', label: t.alignLeft, Icon: AlignLeftIcon },
    { value: 'center', label: t.alignCenter, Icon: AlignCenterIcon },
    { value: 'right', label: t.alignRight, Icon: AlignRightIcon },
    { value: 'justify', label: t.alignJustify, Icon: AlignJustifyIcon },
  ] as const;
  return (
    <MenuPopover
      trigger={
        <button
          type="button"
          data-toolbar-item="align"
          className={`${styles.styleTrigger} ${styles.iconTrigger}`}
          title={t.align}
          aria-label={t.align}
          onMouseDown={(e) => e.preventDefault()}
        >
          {state.textAlign === 'center' ? (
            <AlignCenterIcon />
          ) : state.textAlign === 'right' ? (
            <AlignRightIcon />
          ) : state.textAlign === 'justify' ? (
            <AlignJustifyIcon />
          ) : (
            <AlignLeftIcon />
          )}
          <ChevronDownIcon size={12} className={styles.styleTriggerCaret} />
        </button>
      }
    >
      {options.map(({ value, label, Icon }) => (
        <MenuItem
          key={value}
          selected={state.textAlign === value}
          onSelect={() => ctx.styleCommand((c) => c.setTextAlign(value))}
        >
          <span className={styles.styleItem}>
            <span className={styles.styleIcon}>
              <Icon size={14} />
            </span>
            {label}
          </span>
        </MenuItem>
      ))}
    </MenuPopover>
  );
}

function indentMenu(ctx: ToolbarBodyModel) {
  const { t } = ctx;
  return (
    <MenuPopover
      trigger={
        <button
          type="button"
          data-toolbar-item="indent"
          className={`${styles.styleTrigger} ${styles.iconTrigger}`}
          title={t.indent}
          aria-label={t.indent}
          onMouseDown={(e) => e.preventDefault()}
        >
          <IndentIncreaseIcon />
          <ChevronDownIcon size={12} className={styles.styleTriggerCaret} />
        </button>
      }
    >
      <MenuItem onSelect={() => ctx.styleCommand((c) => c.increaseIndent())}>
        <span className={styles.styleItem}>
          <span className={styles.styleIcon}>
            <IndentIncreaseIcon size={14} />
          </span>
          {t.indentIncrease}
        </span>
      </MenuItem>
      <MenuItem onSelect={() => ctx.styleCommand((c) => c.decreaseIndent())}>
        <span className={styles.styleItem}>
          <span className={styles.styleIcon}>
            <IndentDecreaseIcon size={14} />
          </span>
          {t.indentDecrease}
        </span>
      </MenuItem>
    </MenuPopover>
  );
}

function lineHeightMenu(ctx: ToolbarBodyModel) {
  const { t, state } = ctx;
  return (
    <MenuPopover
      trigger={
        <button
          type="button"
          data-toolbar-item="lineHeight"
          className={`${styles.styleTrigger} ${styles.iconTrigger}`}
          title={t.lineHeight}
          aria-label={t.lineHeight}
          onMouseDown={(e) => e.preventDefault()}
        >
          <LineHeightIcon />
          <ChevronDownIcon size={12} className={styles.styleTriggerCaret} />
        </button>
      }
    >
      <MenuItem selected={!state.lineHeight} onSelect={() => ctx.styleCommand((c) => c.setLineHeight(null))}>
        <span className={styles.styleItem}>
          <span className={styles.styleIcon}>—</span>
          {t.lineHeightDefault}
        </span>
      </MenuItem>
      {LINE_HEIGHTS.map((value) => (
        <MenuItem
          key={value}
          selected={state.lineHeight === Number(value)}
          onSelect={() => ctx.styleCommand((c) => c.setLineHeight(Number(value)))}
        >
          <span className={styles.styleItem}>
            <span className={styles.styleIcon}>≡</span>
            {value}
          </span>
        </MenuItem>
      ))}
    </MenuPopover>
  );
}

function orderedListControl(ctx: ToolbarBodyModel) {
  const { t, state, editor } = ctx;
  return (
    <span
      data-toolbar-item="orderedList"
      className={`${styles.listSplit}${state.orderedList ? ` ${styles.listSplitActive}` : ''}`}
    >
      <ToolbarButton
        title={t.orderedList}
        active={state.orderedList}
        onClick={() => ctx.chain().toggleOrderedList().run()}
      >
        <ListOrderedIcon />
      </ToolbarButton>
      <MenuPopover
        align="end"
        contentClassName={styles.numberingMenu}
        trigger={
          <button
            type="button"
            className={`${styles.numberingCaret}${state.numberingFormat ? ` ${styles.numberingCaretActive}` : ''}`}
            title={t.numberingFormat}
            aria-label={t.numberingFormat}
            onMouseDown={(e) => e.preventDefault()}
          >
            <ChevronDownIcon size={12} />
          </button>
        }
      >
        <NumberingFormatGrid
          current={state.numberingFormat}
          onSelect={(format) => applyNumberingFormat(editor, format)}
        />
      </MenuPopover>
    </span>
  );
}
