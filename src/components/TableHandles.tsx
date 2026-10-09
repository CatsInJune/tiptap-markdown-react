'use client';

import type { Editor } from '@tiptap/core';
import { CellSelection, cellAround, TableMap } from '@tiptap/pm/tables';
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ColumnAfterIcon,
  ColumnBeforeIcon,
  ColumnDeleteIcon,
  EraserIcon,
  RotateCcwIcon,
  RowAfterIcon,
  RowBeforeIcon,
  RowDeleteIcon,
  TableDeleteIcon,
} from '../icons';
import type { ToolbarLabels } from '../labels';
import {
  addColumnsAfter,
  addColumnsBefore,
  appendColumnToTable,
  appendRowToTable,
  addRowsAfter,
  addRowsBefore,
  clearSelectedCellContents,
  deleteSelectedColumns,
  deleteSelectedRows,
  resetSelectedCellStyles,
  getTableSelectionInfo,
  isPosInCellSelection,
} from '../tableSelection';
import styles from '../styles/tableHandles.module.css';

export interface TableHandlesProps {
  /** 编辑器实例。只读态不出手柄。 */
  editor: Editor;
  /** 已合并默认值的工具栏文案（行列菜单项与两个手柄的 aria-label 都取自它）。 */
  labels: ToolbarLabels;
}

/** 悬停到某个单元格时量出来的几何：手柄贴边 + 建 CellSelection 用。 */
interface HoverGeom {
  /** 当前悬停的单元格元素（用来跳过同一格的重复测量）。 */
  cell: HTMLElement;
  rowTop: number;
  rowHeight: number;
  colLeft: number;
  colWidth: number;
  tableLeft: number;
  tableTop: number;
  /** 表格右缘 / 下缘：末尾追加行列的两个 `+` 手柄贴在它们外侧。 */
  tableRight: number;
  tableBottom: number;
  /** 悬停的这格是不是表格的最后一行 / 最后一列——决定要不要出对应的 `+`。 */
  onLastRow: boolean;
  onLastCol: boolean;
}

/**
 * 悬停的这格落在表格的最后一行 / 最后一列吗（按 TableMap 算，colspan 也算得对）。
 * 末尾追加的 `+` 只在贴着那两行/列时才出现，否则鼠标停在表格中间也会冒出两个加号。
 */
function edgeFlags(
  editor: Editor,
  cell: HTMLElement,
): { onLastRow: boolean; onLastCol: boolean } {
  try {
    const $cell = cellAround(editor.state.doc.resolve(editor.view.posAtDOM(cell, 0)));
    if (!$cell) return { onLastRow: false, onLastCol: false };
    // 官方（prosemirror-tables）自己的换算写法：findCell($pos.pos - $pos.start(-1))。
    // 注意别用 $pos.before($pos.depth)——cellAround 给的是「行层」的 ResolvedPos，
    // before(depth) 拿到的是行首的位置，不是这一格的。
    const map = TableMap.get($cell.node(-1));
    const rect = map.findCell($cell.pos - $cell.start(-1));
    return {
      onLastRow: rect.bottom === map.height,
      onLastCol: rect.right === map.width,
    };
  } catch {
    return { onLastRow: false, onLastCol: false };
  }
}

/** 菜单挂在哪个手柄（multi = 右键多格选区）上。 */
interface HandleMenu {
  kind: 'row' | 'col' | 'multi';
  x: number;
  y: number;
}

/** 手柄相对单元格边缘的间距（列手柄在表格上方，行手柄在表格左侧）。 */
const COL_HANDLE_GAP = 22;
const ROW_HANDLE_GAP = 26;
/** 末尾追加行列的 `+` 手柄贴在表格右缘 / 下缘外侧的间距。 */
const EXTEND_GAP = 6;
/** `+` 手柄的粗细（长度由表格尺寸决定）。 */
const EXTEND_THICKNESS = 16;
/**
 * 指针离开单元格后手柄再活一会儿（毫秒）：走向手柄的路上有一段「既非单元格也非手柄」的空隙，
 * 立刻收起就会点不到。见下面悬停追踪那段注释。
 */
const HOVER_KEEP_MS = 160;

/** 量单元格与它所在行 / 表格的视口矩形（手柄是 fixed 定位，直接用视口坐标）。 */
function measureCell(editor: Editor, cell: HTMLElement): HoverGeom | null {
  const table = cell.closest('table');
  const row = cell.closest('tr');
  if (!table || !row) return null;
  // 校验这个 DOM 还对应文档里的位置（视图可能刚重建过）
  try {
    editor.view.posAtDOM(cell, 0);
  } catch {
    return null;
  }
  const cellRect = cell.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const tableRect = table.getBoundingClientRect();
  const edges = edgeFlags(editor, cell);
  return {
    cell,
    ...edges,
    rowTop: rowRect.top,
    rowHeight: rowRect.height,
    colLeft: cellRect.left,
    colWidth: cellRect.width,
    tableLeft: tableRect.left,
    tableTop: tableRect.top,
    tableRight: tableRect.right,
    tableBottom: tableRect.bottom,
  };
}

/** 把整行 / 整列选成 CellSelection：菜单里的命令都按选区办事，选中即「瞄准」。 */
function selectRowOrColumn(
  editor: Editor,
  cell: HTMLElement,
  kind: 'row' | 'col',
): boolean {
  let pos: number;
  try {
    pos = editor.view.posAtDOM(cell, 0);
  } catch {
    return false;
  }
  const $cell = cellAround(editor.state.doc.resolve(pos));
  if (!$cell) return false;
  const selection =
    kind === 'row'
      ? CellSelection.rowSelection($cell)
      : CellSelection.colSelection($cell);
  editor.view.dispatch(editor.state.tr.setSelection(selection));
  return true;
}

interface MenuItemSpec {
  key: string;
  label: string;
  icon: ReactNode;
  /** 分组：组变了就插一条分隔线（列操作 / 行操作 / 单元格操作 / 删除表格）。 */
  group: 'col' | 'row' | 'cells';
  disabled?: boolean;
  run: () => void;
}

/** 按手柄种类组装菜单项：行手柄只管行、列手柄只管列，右键多格选区两样都给。 */
function menuItemsFor(
  editor: Editor,
  labels: ToolbarLabels,
  kind: HandleMenu['kind'],
): MenuItemSpec[] {
  const info = getTableSelectionInfo(editor.state);
  const rowN = info?.rowCount ?? 1;
  const colN = info?.colCount ?? 1;
  // 「几行几列」的文案**只**给多格选区用：点行手柄时选区是「整行 × 全部列」，
  // 按 isMultiCell 判会得到「插入 1 行」这种拗口文案（而且列数会被算进去）。
  const multi = kind === 'multi';
  const items: MenuItemSpec[] = [];

  if (kind === 'col' || kind === 'multi') {
    items.push(
      {
        key: 'col-before',
        group: 'col',
        label: multi ? labels.tableAddColumnBeforeN(colN) : labels.tableAddColumnBefore,
        icon: <ColumnBeforeIcon />,
        run: () => addColumnsBefore(editor, colN),
      },
      {
        key: 'col-after',
        group: 'col',
        label: multi ? labels.tableAddColumnAfterN(colN) : labels.tableAddColumnAfter,
        icon: <ColumnAfterIcon />,
        run: () => addColumnsAfter(editor, colN),
      },
      {
        key: 'col-delete',
        group: 'col',
        label: multi ? labels.tableDeleteColumnN(colN) : labels.tableDeleteColumn,
        icon: <ColumnDeleteIcon />,
        // 只选了全部列、却没选全部行：删列会把表格删没，禁掉
        disabled: !!info?.coversAllCols && !info?.coversAllRows,
        run: () => deleteSelectedColumns(editor),
      },
    );
  }

  if (kind === 'row' || kind === 'multi') {
    items.push(
      {
        key: 'row-before',
        group: 'row',
        label: multi ? labels.tableAddRowBeforeN(rowN) : labels.tableAddRowBefore,
        icon: <RowBeforeIcon />,
        // 上方是表头行时插行没意义
        disabled: !!info?.includesHeaderRow,
        run: () => addRowsBefore(editor, rowN),
      },
      {
        key: 'row-after',
        group: 'row',
        label: multi ? labels.tableAddRowAfterN(rowN) : labels.tableAddRowAfter,
        icon: <RowAfterIcon />,
        run: () => addRowsAfter(editor, rowN),
      },
      {
        key: 'row-delete',
        group: 'row',
        label: multi ? labels.tableDeleteRowN(rowN) : labels.tableDeleteRow,
        icon: <RowDeleteIcon />,
        disabled: !!info?.includesHeaderRow,
        run: () => deleteSelectedRows(editor),
      },
    );
  }

  // 单元格级操作：清空内容、重置样式。两者都不改变表格形状，所以行 / 列 / 多格选区都给。
  items.push(
    {
      key: 'cells-clear',
      group: 'cells',
      label: labels.tableClearContent,
      icon: <EraserIcon />,
      run: () => clearSelectedCellContents(editor),
    },
    {
      key: 'cells-reset',
      group: 'cells',
      label: labels.tableResetCellStyles,
      icon: <RotateCcwIcon />,
      run: () => resetSelectedCellStyles(editor),
    },
  );

  return items;
}

/**
 * 表格的悬停手柄（Notion 式）：鼠标落在单元格上时，行左缘出一条竖胶囊（⋮）、表格上方出一条
 * 横胶囊（⋯），点开就是该行 / 该列的操作菜单。
 *
 * 这是原来「表内右键出菜单」的替代——右键只保留**多格选区**的批量增删（手柄只覆盖单行单列，
 * 那个场景手柄表达不了）。命令全部复用 `tableSelection.ts`，与工具栏的「插入表格」共用一套。
 *
 * 手柄是 fixed 定位、渲染在 body 的 portal 里：它要贴着单元格边缘，而工具栏并不在编辑器 DOM
 * 内。滚动 / 缩放时重新量一遍悬停的那颗单元格，让手柄跟着走。
 */
export function TableHandles({ editor, labels }: TableHandlesProps) {
  const [hover, setHover] = useState<HoverGeom | null>(null);
  const [menu, setMenu] = useState<HandleMenu | null>(null);

  const hoverRef = useRef<HoverGeom | null>(null);
  const menuRef = useRef<HandleMenu | null>(null);
  menuRef.current = menu;

  const clearHover = useCallback(() => {
    if (!hoverRef.current) return;
    hoverRef.current = null;
    setHover(null);
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  /** 重新量一遍悬停的那颗单元格（滚动 / 缩放 / 追加行列后手柄要跟着走）。 */
  const remeasureHover = useCallback(() => {
    const cell = hoverRef.current?.cell;
    if (!cell) return;
    const next = cell.isConnected ? measureCell(editor, cell) : null;
    hoverRef.current = next;
    setHover(next);
  }, [editor]);
  /** 离开后的收起定时器（悬停意图，见下面的注释）。 */
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPendingClear = useCallback(() => {
    if (clearTimerRef.current === null) return;
    clearTimeout(clearTimerRef.current);
    clearTimerRef.current = null;
  }, []);

  // 悬停追踪挂在 document 上。
  //
  // 关键点：**离开单元格 ≠ 离开**。指针从单元格走向手柄时，中间必然经过一小段既不是单元格、
  // 也不在手柄上的地方（手柄贴在表格外侧，本身只有 28px 高，斜着移动更是会绕过它），
  // 那一刻若立刻收起，手柄就在你点到之前消失了。所以这里用「悬停意图」：不在单元格 / 手柄上时
  // 只挂一个 ~160ms 的收起定时器，指针在这段时间内碰到手柄或单元格就取消。
  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!editor.isEditable || menuRef.current) return;
      const target = event.target as HTMLElement | null;

      // 指针已经到手柄上：留着，并取消待收起
      if (target?.closest?.('[data-table-handle], [data-table-extend]')) {
        cancelPendingClear();
        return;
      }

      const cell =
        target && editor.view.dom.contains(target)
          ? (target.closest('td, th') as HTMLElement | null)
          : null;

      if (!cell) {
        // 既不在单元格也不在手柄上：宽限一段再收（指针可能正走向手柄）
        if (hoverRef.current && clearTimerRef.current === null) {
          clearTimerRef.current = setTimeout(() => {
            clearTimerRef.current = null;
            clearHover();
          }, HOVER_KEEP_MS);
        }
        return;
      }

      cancelPendingClear();
      if (hoverRef.current?.cell === cell) return;
      const next = measureCell(editor, cell);
      hoverRef.current = next;
      setHover(next);
    };
    const onBlurWindow = () => {
      cancelPendingClear();
      clearHover();
    };
    // 滚动 / 缩放后手柄的 fixed 坐标会失真：重新量那颗单元格让手柄跟着走，而不是直接收起
    // （窗口一动手柄就没了很烦）。单元格已经不在文档里了才收起。
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onBlurWindow);
    window.addEventListener('scroll', remeasureHover, true);
    window.addEventListener('resize', remeasureHover);
    return () => {
      cancelPendingClear();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onBlurWindow);
      window.removeEventListener('scroll', remeasureHover, true);
      window.removeEventListener('resize', remeasureHover);
    };
  }, [editor, clearHover, cancelPendingClear, remeasureHover]);

  // 右键：只服务多格选区（单行 / 单列交给手柄）
  useEffect(() => {
    const dom = editor.view.dom;
    const onContextMenu = (event: MouseEvent) => {
      const info = getTableSelectionInfo(editor.state);
      const { selection } = editor.state;
      if (!info?.isMultiCell || !(selection instanceof CellSelection)) return;
      const coords = editor.view.posAtCoords({
        left: event.clientX,
        top: event.clientY,
      });
      if (!coords || !isPosInCellSelection(selection, coords.pos)) return;
      event.preventDefault();
      hoverRef.current = null;
      setHover(null);
      setMenu({ kind: 'multi', x: event.clientX, y: event.clientY });
    };
    dom.addEventListener('contextmenu', onContextMenu);
    return () => dom.removeEventListener('contextmenu', onContextMenu);
  }, [editor]);

  // 菜单开着时：点外面 / Esc 收起（菜内点击不关，交给菜单项自己收）
  useEffect(() => {
    if (!menu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    const onDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('[data-table-menu]')) return;
      closeMenu();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown);
    };
  }, [menu, closeMenu]);

  if (typeof document === 'undefined') return null;

  const openHandleMenu = (kind: 'row' | 'col') => {
    if (!hover) return;
    if (!selectRowOrColumn(editor, hover.cell, kind)) return;
    setHover(null);
    hoverRef.current = null;
    setMenu(
      kind === 'row'
        ? { kind, x: hover.tableLeft + 6, y: hover.rowTop }
        : { kind, x: hover.colLeft, y: hover.tableTop + 6 },
    );
  };

  const items = menu ? menuItemsFor(editor, labels, menu.kind) : [];
  const showHandles = !!hover && !menu && editor.isEditable;

  return createPortal(
    <>
      {showHandles && hover ? (
        <>
          <button
            type="button"
            data-table-handle="row"
            className={`${styles.handle} ${styles.handleRow}`}
            style={{
              left: hover.tableLeft - ROW_HANDLE_GAP,
              // 长度跟着行高走（原来固定 28px 居中，行高时就显得太短）
              top: hover.rowTop,
              height: hover.rowHeight,
            }}
            title={labels.tableRowMenu}
            aria-label={labels.tableRowMenu}
            // 保住编辑器选区：点手柄不该先把光标丢掉
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => openHandleMenu('row')}
          >
            <span aria-hidden>⋮</span>
          </button>
          <button
            type="button"
            data-table-handle="col"
            className={`${styles.handle} ${styles.handleCol}`}
            style={{
              // 长度跟着列宽走，两端与单元格对齐
              left: hover.colLeft,
              top: hover.tableTop - COL_HANDLE_GAP,
              width: hover.colWidth,
            }}
            title={labels.tableColumnMenu}
            aria-label={labels.tableColumnMenu}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => openHandleMenu('col')}
          >
            <span aria-hidden>⋯</span>
          </button>

          {/* 末尾追加：只有悬停贴着最后一列 / 最后一行时才出现对应的一条 `+`
              （鼠标停在表格中间不该冒加号）。长度跟着表格尺寸走，点完重新量一次。 */}
          {hover.onLastCol ? (
          <button
            type="button"
            data-table-extend="col"
            className={styles.extend}
            style={{
              left: hover.tableRight + EXTEND_GAP,
              top: hover.tableTop,
              width: EXTEND_THICKNESS,
              height: Math.max(EXTEND_THICKNESS, hover.tableBottom - hover.tableTop),
            }}
            title={labels.tableAppendColumn}
            aria-label={labels.tableAppendColumn}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              appendColumnToTable(editor);
              remeasureHover();
            }}
          >
            <span aria-hidden>+</span>
          </button>
          ) : null}
          {hover.onLastRow ? (
          <button
            type="button"
            data-table-extend="row"
            className={styles.extend}
            style={{
              left: hover.tableLeft,
              top: hover.tableBottom + EXTEND_GAP,
              width: Math.max(EXTEND_THICKNESS, hover.tableRight - hover.tableLeft),
              height: EXTEND_THICKNESS,
            }}
            title={labels.tableAppendRow}
            aria-label={labels.tableAppendRow}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              appendRowToTable(editor);
              remeasureHover();
            }}
          >
            <span aria-hidden>+</span>
          </button>
          ) : null}
        </>
      ) : null}

      {menu ? (
        <div
          className={styles.tableBubble}
          data-table-menu=""
          style={{ left: menu.x, top: menu.y }}
          role="menu"
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {items.map((item, index) => (
            <Fragment key={item.key}>
              {index > 0 && item.group !== items[index - 1].group ? (
                <span className={styles.tableMenuDivider} aria-hidden />
              ) : null}
              <button
                type="button"
                role="menuitem"
                className={styles.tableMenuItem}
                disabled={item.disabled}
                onClick={() => {
                  item.run();
                  closeMenu();
                }}
              >
                <span className={styles.tableMenuItemIcon} aria-hidden>
                  {item.icon}
                </span>
                <span className={styles.tableMenuItemLabel}>{item.label}</span>
              </button>
            </Fragment>
          ))}
          <span className={styles.tableMenuDivider} aria-hidden />
          <button
            type="button"
            role="menuitem"
            className={styles.tableMenuItem}
            onClick={() => {
              editor.commands.deleteTable();
              closeMenu();
            }}
          >
            <span className={styles.tableMenuItemIcon} aria-hidden>
              <TableDeleteIcon />
            </span>
            <span className={styles.tableMenuItemLabel}>
              {labels.tableDeleteTable}
            </span>
          </button>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
