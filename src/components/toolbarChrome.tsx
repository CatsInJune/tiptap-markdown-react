import * as Popover from '@radix-ui/react-popover';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { ColorPalette } from './ColorPalette';
import type { ToolbarLabels } from '../labels';
import {
  NUMBERING_FORMAT_IDS,
  NUMBERING_FORMAT_LABELS,
  NUMBERING_FORMAT_PREVIEWS,
} from '../numberingFormat';
import type { NumberingFormat } from '../numberingFormat';
import { ChevronDownIcon } from '../icons';
import styles from '../styles/toolbar.module.css';

/**
 * 单个工具栏按钮：激活态高亮，disabled 时灰显。
 *
 * forwardRef + 透传其余属性，是为了让它能当 Radix 的触发器（`<LinkPopover>` 的 `asChild`
 * 要挂 ref，并把 `aria-expanded` / `data-state` 传下来）。
 */
export const ToolbarButton = forwardRef<
  HTMLButtonElement,
  {
    title: string;
    active?: boolean;
    disabled?: boolean;
    busy?: boolean;
    onClick?: () => void;
    children: ReactNode;
  } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title' | 'onClick' | 'children'>
>(function ToolbarButton(
  { title, active, disabled, busy, onClick, children, className, ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      aria-busy={busy}
      disabled={disabled}
      className={`${styles.btn} ${active ? styles.btnActive : ''}${className ? ` ${className}` : ''}`}
      // mousedown + preventDefault 防止点击工具栏时编辑器失焦丢选区
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
});

export function Divider() {
  return <span className={styles.divider} aria-hidden />;
}

/** 行高下拉的档位（对齐语雀 / Notion 的习惯值；不含"默认"）。 */
export const LINE_HEIGHTS = ['1', '1.15', '1.5', '2', '2.5', '3'] as const;

// 关闭当前菜单的回调（由 MenuPopover 注入，MenuItem 选中后调用以收起）。
const MenuCloseCtx = createContext<() => void>(() => {});

/**
 * 菜单气泡：用 Radix Popover 而非 DropdownMenu——后者会强制抢焦点（menu 语义），
 * 打开即让编辑器 blur、丢选区；Popover 可 onOpenAutoFocus preventDefault 保持编辑器焦点。
 * 菜单项为普通 button（onMouseDown preventDefault 不夺焦），行为与原生菜单一致。
 */
export function MenuPopover({
  trigger,
  children,
  contentClassName,
  align = 'start',
}: {
  trigger: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  align?: 'start' | 'center' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={
            contentClassName ? `${styles.menu} ${contentClassName}` : styles.menu
          }
          sideOffset={4}
          align={align}
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

export function MenuItem({
  selected,
  disabled,
  label,
  onSelect,
  children,
}: {
  selected?: boolean;
  disabled?: boolean;
  /** 盖过子节点拼出来的无障碍名称。图标加文字时，读屏只念这一句。 */
  label?: string;
  onSelect: () => void;
  children: ReactNode;
}) {
  const close = useContext(MenuCloseCtx);
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      aria-pressed={selected || undefined}
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

/** 编号格式：单列预览卡片，每张是五行嵌套编号。 */
export function NumberingFormatGrid({
  current,
  onSelect,
}: {
  current: NumberingFormat | null;
  onSelect: (format: NumberingFormat) => void;
}) {
  const close = useContext(MenuCloseCtx);
  return (
    <div className={styles.numberingGrid} role="group" aria-label="Numbering formats">
      {NUMBERING_FORMAT_IDS.map((format) => {
        const active = current === format;
        return (
          <button
            key={format}
            type="button"
            role="menuitem"
            aria-label={NUMBERING_FORMAT_LABELS[format]}
            aria-pressed={active}
            className={`${styles.numberingOption}${active ? ` ${styles.numberingOptionActive}` : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onSelect(format);
              close();
            }}
          >
            <span className={styles.numberingPreview}>
              {NUMBERING_FORMAT_PREVIEWS[format].map((row, index) => (
                <span
                  key={`${format}-${index}`}
                  className={styles.numberingPreviewRow}
                  data-depth={row.depth}
                >
                  <span className={styles.numberingPreviewMarker}>{row.marker}</span>
                  <span className={styles.numberingPreviewLine} />
                </span>
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const TABLE_PICKER_COLS = 10;
const TABLE_PICKER_ROWS = 8;

/**
 * More 菜单里的「插入表格」：二级面板用网格悬停选行列，点击插入。
 * 保持 Popover（不夺编辑器焦点），与 MenuItem 一致。
 */
export function TableInsertItem({
  disabled,
  labels,
  onInsert,
  trigger,
}: {
  disabled?: boolean;
  labels: Pick<ToolbarLabels, 'tableInsert' | 'tableSizeSelected'>;
  onInsert: (rows: number, cols: number) => void;
  /** 主栏上的触发器。不传则用「更多」菜单里的那一行。 */
  trigger?: ReactNode;
}) {
  const closeMenu = useContext(MenuCloseCtx);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState({ cols: 0, rows: 0 });

  const resetHover = useCallback(() => setHover({ cols: 0, rows: 0 }), []);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetHover();
      }}
    >
      <Popover.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            disabled={disabled}
            className={`${styles.menuItem} ${open ? styles.menuItemSelected : ''}`}
            onMouseDown={(e) => e.preventDefault()}
          >
            <span className={styles.styleItem}>
              <span className={styles.styleIcon}>⊞</span>
              {labels.tableInsert}
            </span>
            <ChevronDownIcon size={12} className={styles.tableInsertCaret} />
          </button>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={styles.tableSizePicker}
          side="right"
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div
            className={styles.tableSizeGrid}
            style={{
              gridTemplateColumns: `repeat(${TABLE_PICKER_COLS}, 1fr)`,
            }}
            onMouseLeave={resetHover}
          >
            {Array.from({ length: TABLE_PICKER_ROWS * TABLE_PICKER_COLS }, (_, i) => {
              const col = (i % TABLE_PICKER_COLS) + 1;
              const row = Math.floor(i / TABLE_PICKER_COLS) + 1;
              const active = hover.cols > 0 && col <= hover.cols && row <= hover.rows;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={labels.tableSizeSelected(col, row)}
                  className={`${styles.tableSizeCell} ${active ? styles.tableSizeCellActive : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHover({ cols: col, rows: row })}
                  onClick={() => {
                    onInsert(row, col);
                    setOpen(false);
                    resetHover();
                    closeMenu();
                  }}
                />
              );
            })}
          </div>
          <div className={styles.tableSizeLabel}>
            {hover.cols > 0
              ? labels.tableSizeSelected(hover.cols, hover.rows)
              : labels.tableInsert}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** 颜色气泡：点色块即应用并关闭。 */
export function ColorPopover({
  title,
  glyph,
  bar,
  value,
  onPick,
}: {
  title: string;
  glyph: string;
  bar: string;
  value?: string;
  onPick: (color: string | null) => void;
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
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

