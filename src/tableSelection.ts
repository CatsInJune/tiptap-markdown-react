import type { Editor } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import {
  CellSelection,
  isInTable,
  rowIsHeader,
  selectedRect,
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

/**
 * 表内右键：若点击落在已有多格选区内则保留选区；
 * 否则把光标落到点击位置（单格操作）。
 */
export function preserveTableSelectionOnContextMenu(
  editor: Editor,
  pos: number,
): void {
  const { selection } = editor.state;
  if (
    selection instanceof CellSelection &&
    isPosInCellSelection(selection, pos)
  ) {
    editor.view.focus();
    return;
  }
  editor.chain().focus().setTextSelection(pos).run();
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
