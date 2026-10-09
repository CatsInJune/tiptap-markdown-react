import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import {
  cellAround,
  CellSelection,
  isInTable,
  rowIsHeader,
  selectedRect,
  TableMap,
} from '@tiptap/pm/tables';

export interface TableSelectionInfo {
  rowCount: number;
  colCount: number;
  /** 选区跨越多行或多列时为 true（用于带 N 的文案）。 */
  isMultiCell: boolean;
  includesHeaderRow: boolean;
  coversAllRows: boolean;
  coversAllCols: boolean;
}

/** 当前若不在表格内返回 null。 */
export function getTableSelectionInfo(
  state: EditorState,
): TableSelectionInfo | null {
  if (!isInTable(state)) return null;

  const rect = selectedRect(state);
  const rowCount = Math.max(1, rect.bottom - rect.top);
  const colCount = Math.max(1, rect.right - rect.left);

  let includesHeaderRow = false;
  for (let row = rect.top; row < rect.bottom; row++) {
    if (rowIsHeader(rect.map, rect.table, row)) {
      includesHeaderRow = true;
      break;
    }
  }

  return {
    rowCount,
    colCount,
    isMultiCell: rowCount > 1 || colCount > 1,
    includesHeaderRow,
    coversAllRows: rect.top === 0 && rect.bottom === rect.map.height,
    coversAllCols: rect.left === 0 && rect.right === rect.map.width,
  };
}

/** 文档坐标是否落在 CellSelection 覆盖的某个单元格内（含单元格节点本身）。 */
export function isPosInCellSelection(
  selection: CellSelection,
  pos: number,
): boolean {
  let found = false;
  selection.forEachCell((node, cellPos) => {
    if (pos >= cellPos && pos <= cellPos + node.nodeSize) {
      found = true;
    }
  });
  return found;
}


export function addRowsBefore(editor: Editor, count: number): boolean {
  const n = Math.max(1, count);
  for (let i = 0; i < n; i++) {
    if (!editor.commands.addRowBefore()) return false;
  }
  return true;
}

export function addRowsAfter(editor: Editor, count: number): boolean {
  const n = Math.max(1, count);
  for (let i = 0; i < n; i++) {
    if (!editor.commands.addRowAfter()) return false;
  }
  return true;
}

export function addColumnsBefore(editor: Editor, count: number): boolean {
  const n = Math.max(1, count);
  for (let i = 0; i < n; i++) {
    if (!editor.commands.addColumnBefore()) return false;
  }
  return true;
}

export function addColumnsAfter(editor: Editor, count: number): boolean {
  const n = Math.max(1, count);
  for (let i = 0; i < n; i++) {
    if (!editor.commands.addColumnAfter()) return false;
  }
  return true;
}

/** 删行：全表行被选中时改为删整表；含表头时调用方应先禁用。 */
export function deleteSelectedRows(editor: Editor): boolean {
  const info = getTableSelectionInfo(editor.state);
  if (!info) return false;
  if (info.coversAllRows) return editor.commands.deleteTable();
  return editor.commands.deleteRow();
}

/** 删列：选区覆盖全部列且同时覆盖全部行时删整表；仅覆盖全部列时失败（由 UI 禁用）。 */
export function deleteSelectedColumns(editor: Editor): boolean {
  const info = getTableSelectionInfo(editor.state);
  if (!info) return false;
  if (info.coversAllCols) {
    if (info.coversAllRows) return editor.commands.deleteTable();
    return false;
  }
  return editor.commands.deleteColumn();
}

/** 结构属性：改它们等于改变表格形状，合并 / 拆分有专门的命令，重置样式时不碰。 */
const STRUCTURAL_CELL_ATTRS = new Set(['colspan', 'rowspan']);

/**
 * 选区覆盖到的单元格：CellSelection 的全部单元格；若只是个文本光标，就取它所在的那一格。
 * （菜单里永远是 CellSelection；带光标这条是为了让命令单独用也说得通。）
 */
function selectedCellEntries(
  editor: Editor,
): Array<{ pos: number; node: PMNode }> {
  const { selection } = editor.state;
  const entries: Array<{ pos: number; node: PMNode }> = [];

  if (selection instanceof CellSelection) {
    selection.forEachCell((node, pos) => {
      entries.push({ pos, node });
    });
    return entries;
  }

  const $cell = cellAround(selection.$from);
  if (!$cell) return entries;
  const pos = $cell.before($cell.depth);
  const node = editor.state.doc.nodeAt(pos);
  if (node) entries.push({ pos, node });
  return entries;
}

/**
 * 清空选中单元格的**内容**，保留单元格本身与它的属性（表头行因此不会被降级）。
 *
 * 单元格必须至少留一个块，所以内容替换成一个空段落。已经空的单元格跳过——不改动、
 * 也不产生多余的撤销步。返回是否真的改了文档。
 */
export function clearSelectedCellContents(editor: Editor): boolean {
  const entries = selectedCellEntries(editor);
  if (!entries.length) return false;
  const paragraph = editor.state.schema.nodes.paragraph;
  if (!paragraph) return false;

  const tr = editor.state.tr;
  // 从后往前改：替换内容会改变 nodeSize，先算好后面的位置才不会位移串味
  for (const { pos, node } of [...entries].sort((a, b) => b.pos - a.pos)) {
    const isEmpty =
      node.childCount === 1 &&
      !!node.firstChild?.isTextblock &&
      node.firstChild.content.size === 0;
    if (isEmpty) continue;
    tr.replaceWith(pos + 1, pos + node.nodeSize - 1, paragraph.createAndFill()!);
  }

  if (!tr.docChanged) return false;
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/**
 * 把选中单元格的**样式属性**复位（列宽、对齐等，按各属性的 schema 默认值）。
 *
 * 不动 `colspan` / `rowspan`：那是结构，复位它们会让表格形状不合法（缺格）。
 * （扩展有 `mergeCells` / `splitCell`，但本库不暴露入口——GFM 没有 colspan，合并导出成
 * `| 1<br>2 |  |` 且回不去，见 README。）
 */
export function resetSelectedCellStyles(editor: Editor): boolean {
  const entries = selectedCellEntries(editor);
  if (!entries.length) return false;

  const tr = editor.state.tr;
  for (const { pos, node } of entries) {
    const attrs = (node.type.spec.attrs ?? {}) as Record<
      string,
      { default?: unknown }
    >;
    const next: Record<string, unknown> = { ...node.attrs };
    let changed = false;
    for (const [key, spec] of Object.entries(attrs)) {
      if (STRUCTURAL_CELL_ATTRS.has(key)) continue;
      const fallback = spec?.default ?? null;
      if (next[key] !== fallback) {
        next[key] = fallback;
        changed = true;
      }
    }
    if (changed) tr.setNodeMarkup(pos, undefined, next);
  }

  if (!tr.docChanged) return false;
  editor.view.dispatch(tr);
  return true;
}

/** 找当前要操作的那张表：优先用光标 / 选区所在的那张（同页多表时才不会改错），否则文档里的第一张。 */
function findTable(editor: Editor): { pos: number; node: PMNode } | null {
  const $from = editor.state.selection.$from;
  for (let d = $from.depth; d > 0; d -= 1) {
    if ($from.node(d).type.name === 'table') {
      return { pos: $from.before(d), node: $from.node(d) };
    }
  }

  let found: { pos: number; node: PMNode } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.type.name === 'table') {
      found = { pos, node };
      return false;
    }
    return true;
  });
  return found;
}

/** 把第 index 行 / 列整体选成 CellSelection（末尾追加这类操作要先「瞄准」）。 */
function selectLineAt(
  editor: Editor,
  table: { pos: number; node: PMNode },
  kind: 'row' | 'col',
  index: number,
): void {
  const map = TableMap.get(table.node);
  const start = table.pos + 1;
  const anchorCell = start + map.positionAt(kind === 'row' ? index : 0, kind === 'col' ? index : 0, table.node);
  const headCell =
    start +
    map.positionAt(
      kind === 'row' ? index : map.height - 1,
      kind === 'col' ? index : map.width - 1,
      table.node,
    );
  editor.view.dispatch(
    editor.state.tr.setSelection(
      new CellSelection(
        editor.state.doc.resolve(anchorCell),
        editor.state.doc.resolve(headCell),
      ),
    ),
  );
}

/**
 * 在表格末尾追加一行（表底那个 `+`）。
 * 先把最后一行选成 CellSelection——扩展的 `addRowAfter` 是按选区办事的。
 */
export function appendRowToTable(editor: Editor): boolean {
  const table = findTable(editor);
  if (!table) return false;
  selectLineAt(editor, table, 'row', TableMap.get(table.node).height - 1);
  return addRowsAfter(editor, 1);
}

/**
 * 在表格末尾追加一列（表格右侧那个 `+`）。
 * 同理先把最后一列选成 CellSelection。
 */
export function appendColumnToTable(editor: Editor): boolean {
  const table = findTable(editor);
  if (!table) return false;
  selectLineAt(editor, table, 'col', TableMap.get(table.node).width - 1);
  return addColumnsAfter(editor, 1);
}
