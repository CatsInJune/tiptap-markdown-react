// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { CellSelection, TableMap } from '@tiptap/pm/tables';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';
import {
  addColumnsBefore,
  addRowsAfter,
  deleteSelectedColumns,
  deleteSelectedRows,
  getTableSelectionInfo,
  isPosInCellSelection,
  preserveTableSelectionOnContextMenu,
} from './tableSelection';

const TABLE_MD = `| A | B | C |
| --- | --- | --- |
| 1 | 2 | 3 |
| 4 | 5 | 6 |
| 7 | 8 | 9 |
`;

function build(content = TABLE_MD): Editor {
  return new Editor({
    extensions: [...baseExtensions, Markdown],
    content,
    contentType: 'markdown',
  });
}

/** 在第一张表里选中 [top,bottom) × [left,right) 的单元格矩形。 */
function selectCells(
  editor: Editor,
  top: number,
  left: number,
  bottom: number,
  right: number,
): void {
  let tablePos = -1;
  editor.state.doc.descendants((node, pos) => {
    if (tablePos < 0 && node.type.name === 'table') {
      tablePos = pos;
      return false;
    }
  });
  expect(tablePos).toBeGreaterThanOrEqual(0);

  const table = editor.state.doc.nodeAt(tablePos)!;
  const tableStart = tablePos + 1;
  const map = TableMap.get(table);
  const anchorOffset = map.positionAt(top, left, table);
  const headOffset = map.positionAt(bottom - 1, right - 1, table);
  const $anchor = editor.state.doc.resolve(tableStart + anchorOffset);
  const $head = editor.state.doc.resolve(tableStart + headOffset);

  const tr = editor.state.tr.setSelection(new CellSelection($anchor, $head));
  editor.view.dispatch(tr);
}

describe('getTableSelectionInfo', () => {
  it('单格光标：1×1，无 multi', () => {
    const editor = build();
    // 表头第一格内
    let cellPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (cellPos < 0 && node.type.name === 'tableHeader') {
        cellPos = pos;
        return false;
      }
    });
    editor.commands.setTextSelection(cellPos + 2);
    const info = getTableSelectionInfo(editor.state);
    expect(info).toMatchObject({
      rowCount: 1,
      colCount: 1,
      isMultiCell: false,
      includesHeaderRow: true,
      coversAllRows: false,
      coversAllCols: false,
    });
    editor.destroy();
  });

  it('多格选区报告行/列跨度', () => {
    const editor = build();
    // 表体两行 × 一列（跳过表头）
    selectCells(editor, 1, 0, 3, 1);
    const info = getTableSelectionInfo(editor.state);
    expect(info).toMatchObject({
      rowCount: 2,
      colCount: 1,
      isMultiCell: true,
      includesHeaderRow: false,
      coversAllRows: false,
      coversAllCols: false,
    });
    editor.destroy();
  });

  it('含表头的选区标记 includesHeaderRow', () => {
    const editor = build();
    selectCells(editor, 0, 0, 2, 1);
    expect(getTableSelectionInfo(editor.state)?.includesHeaderRow).toBe(true);
    editor.destroy();
  });
});

describe('preserveTableSelectionOnContextMenu', () => {
  it('右键落在多格选区内时保留 CellSelection', () => {
    const editor = build();
    selectCells(editor, 1, 0, 3, 2);
    const before = editor.state.selection;
    expect(before).toBeInstanceOf(CellSelection);

    let innerPos = -1;
    (before as CellSelection).forEachCell((_node, pos) => {
      if (innerPos < 0) innerPos = pos + 1;
    });
    preserveTableSelectionOnContextMenu(editor, innerPos);
    expect(editor.state.selection).toBeInstanceOf(CellSelection);
    expect(getTableSelectionInfo(editor.state)?.rowCount).toBe(2);
    editor.destroy();
  });

  it('右键落在选区外时折叠为文本选区', () => {
    const editor = build();
    selectCells(editor, 1, 0, 2, 1);
    // 点到未选中的另一格的段落内
    let otherPos = -1;
    let seen = 0;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'tableCell') {
        seen += 1;
        if (seen === 3) {
          otherPos = pos + 2; // 进入 cell > paragraph
          return false;
        }
      }
    });
    preserveTableSelectionOnContextMenu(editor, otherPos);
    expect(editor.state.selection).not.toBeInstanceOf(CellSelection);
    editor.destroy();
  });
});

describe('isPosInCellSelection', () => {
  it('识别选区内坐标', () => {
    const editor = build();
    selectCells(editor, 1, 0, 2, 2);
    const sel = editor.state.selection as CellSelection;
    let inside = -1;
    sel.forEachCell((_n, pos) => {
      if (inside < 0) inside = pos + 1;
    });
    expect(isPosInCellSelection(sel, inside)).toBe(true);
    expect(isPosInCellSelection(sel, 0)).toBe(false);
    editor.destroy();
  });
});

describe('结构操作', () => {
  it('addRowsAfter 按选区行数插入', () => {
    const editor = build();
    selectCells(editor, 1, 0, 3, 1);
    expect(addRowsAfter(editor, 2)).toBe(true);
    let height = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'table') {
        height = node.childCount;
        return false;
      }
    });
    // 原 4 行（1 表头 + 3 表体）+ 2
    expect(height).toBe(6);
    editor.destroy();
  });

  it('addColumnsBefore 按选区列数插入', () => {
    const editor = build();
    selectCells(editor, 1, 0, 2, 2);
    expect(addColumnsBefore(editor, 2)).toBe(true);
    let width = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'tableRow') {
        width = node.childCount;
        return false;
      }
    });
    expect(width).toBe(5);
    editor.destroy();
  });

  it('deleteSelectedRows 删除选区覆盖的多行', () => {
    const editor = build();
    selectCells(editor, 1, 0, 3, 1);
    expect(deleteSelectedRows(editor)).toBe(true);
    let height = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'table') {
        height = node.childCount;
        return false;
      }
    });
    expect(height).toBe(2); // 表头 + 剩 1 表体行
    editor.destroy();
  });

  it('覆盖全部行时 deleteSelectedRows 删整表', () => {
    const editor = build();
    selectCells(editor, 0, 0, 4, 3);
    expect(deleteSelectedRows(editor)).toBe(true);
    let hasTable = false;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'table') hasTable = true;
    });
    expect(hasTable).toBe(false);
    editor.destroy();
  });

  it('仅覆盖全部列时 deleteSelectedColumns 失败', () => {
    const editor = build();
    selectCells(editor, 1, 0, 2, 3);
    expect(deleteSelectedColumns(editor)).toBe(false);
    editor.destroy();
  });
});
