// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { CellSelection, TableMap } from '@tiptap/pm/tables';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';
import {
  addColumnsBefore,
  addRowsAfter,
  appendColumnToTable,
  appendRowToTable,
  clearSelectedCellContents,
  deleteSelectedColumns,
  deleteSelectedRows,
  getTableSelectionInfo,
  isPosInCellSelection,
  resetSelectedCellStyles,
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

/** 第一张表里第 row 行（0 = 表头行）的单元格文本。 */
function rowTexts(editor: Editor, row: number): string[] {
  let out: string[] = [];
  let index = -1;
  editor.state.doc.descendants((node) => {
    if (node.type.name !== 'table') return true;
    if (index >= 0) return false;
    node.forEach((tableRow, _offset, i) => {
      if (i !== row) return;
      index = i;
      tableRow.forEach((cell) => {
        out.push(cell.textContent);
      });
    });
    return false;
  });
  return out;
}

/** 第一张表里某个单元格的属性（按行列取）。 */
function cellAttrs(editor: Editor, row: number, col: number): Record<string, unknown> {
  let out: Record<string, unknown> = {};
  editor.state.doc.descendants((node) => {
    if (node.type.name !== 'table') return true;
    let r = -1;
    node.forEach((tableRow) => {
      r += 1;
      if (r !== row) return;
      let c = -1;
      tableRow.forEach((cell) => {
        c += 1;
        if (c === col) out = cell.attrs;
      });
    });
    return false;
  });
  return out;
}

/** 第一张表的行数与首行列数。 */
function tableShape(editor: Editor): { rows: number; cells: number } {
  let rows = 0;
  let cells = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'table') {
      node.forEach((row) => {
        rows += 1;
        if (rows === 1) cells = row.childCount;
      });
      return false;
    }
    return true;
  });
  return { rows, cells };
}

function tableRowCount(editor: Editor): number {
  let rows = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'table') {
      rows = node.childCount;
      return false;
    }
    return true;
  });
  return rows;
}

describe('清空单元格内容', () => {
  it('清掉选中行的文字，保留行与单元格（表头行不降级）', () => {
    const editor = build();
    selectCells(editor, 2, 0, 3, 3); // 第 3 行（数据行）

    expect(clearSelectedCellContents(editor)).toBe(true);
    expect(rowTexts(editor, 2)).toEqual(['', '', '']);
    // 其它行与行数不变；表头仍是 th
    expect(rowTexts(editor, 1)).toEqual(['1', '2', '3']);
    expect(tableRowCount(editor)).toBe(4);
    let headerStillHeader = false;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'tableHeader') headerStillHeader = true;
      return true;
    });
    expect(headerStillHeader).toBe(true);
    editor.destroy();
  });

  it('已经是空的：不动文档（不产生多余的撤销步）', () => {
    const editor = build('| A | B |\n| --- | --- |\n|  |  |');
    selectCells(editor, 1, 0, 2, 2);
    expect(clearSelectedCellContents(editor)).toBe(false);
    editor.destroy();
  });

  it('光标在表格外：返回 false', () => {
    const editor = build('表格外面\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n');
    editor.commands.setTextSelection(2);
    expect(clearSelectedCellContents(editor)).toBe(false);
    editor.destroy();
  });

  it('单个光标也认：清掉光标所在那一格', () => {
    const editor = build();
    let inside = -1;
    editor.state.doc.descendants((node, pos) => {
      if (inside < 0 && node.type.name === 'tableCell') {
        inside = pos + 2; // 单元格 → 段落 → 光标
        return false;
      }
      return true;
    });
    editor.commands.setTextSelection(inside);
    clearSelectedCellContents(editor);
    expect(rowTexts(editor, 1)[0]).toBe('');
    editor.destroy();
  });
});

describe('重置单元格样式', () => {
  /** 直接写 NodeMarkup 布置属性：Tiptap 的 setCellAttribute 在 CellSelection 下不落值。 */
  function setFirstCellAttrs(
    editor: Editor,
    attrs: Record<string, unknown>,
    kind: 'tableHeader' | 'tableCell' = 'tableHeader',
  ): void {
    let cellPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (cellPos < 0 && node.type.name === kind) {
        cellPos = pos;
        return false;
      }
      return true;
    });
    const node = editor.state.doc.nodeAt(cellPos)!;
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(cellPos, undefined, { ...node.attrs, ...attrs }),
    );
  }

  it('整列重置：对齐与列宽都清掉', () => {
    const editor = build();
    setFirstCellAttrs(editor, { colwidth: [160], align: 'center' });
    expect(cellAttrs(editor, 0, 0)).toMatchObject({ colwidth: [160], align: 'center' });

    selectCells(editor, 0, 0, 4, 1); // 第 0 列（全部行）
    expect(resetSelectedCellStyles(editor)).toBe(true);
    expect(cellAttrs(editor, 0, 0)).toMatchObject({ colwidth: null, align: null });
    editor.destroy();
  });

  it('整行重置：列宽是列级属性、清不掉（列宽插件按同列最宽补回），对齐能清', () => {
    const editor = build();
    setFirstCellAttrs(editor, { colwidth: [160], align: 'center' });

    selectCells(editor, 0, 0, 1, 3); // 只选第 0 行
    resetSelectedCellStyles(editor);
    expect(cellAttrs(editor, 0, 0)).toMatchObject({ colwidth: [160], align: null });
    editor.destroy();
  });

  it('合并结构不动：colspan / rowspan 保持（那是合并 / 拆分的事）', () => {
    const editor = build();
    selectCells(editor, 1, 0, 2, 2);
    editor.commands.mergeCells();
    // 有样式可清才会走事务（这里要装在数据行的被合并格上，不是表头）
    setFirstCellAttrs(editor, { align: 'center' }, 'tableCell');

    selectCells(editor, 1, 0, 2, 1); // 选中被合并的那一格
    expect(resetSelectedCellStyles(editor)).toBe(true);
    expect(cellAttrs(editor, 1, 0).colspan).toBe(2);
    expect(cellAttrs(editor, 1, 0).align).toBeNull();
    editor.destroy();
  });

  it('本来就没样式：返回 false', () => {
    const editor = build();
    selectCells(editor, 1, 0, 1, 1);
    expect(resetSelectedCellStyles(editor)).toBe(false);
    editor.destroy();
  });
});

describe('末尾追加行列（表格右 / 下缘的 `+`）', () => {
  it('追加行：行数 +1，列数不变', () => {
    const editor = build();
    const before = tableShape(editor);
    expect(appendRowToTable(editor)).toBe(true);
    expect(tableShape(editor)).toEqual({ rows: before.rows + 1, cells: before.cells });
    editor.destroy();
  });

  it('追加列：列数 +1，行数不变', () => {
    const editor = build();
    const before = tableShape(editor);
    expect(appendColumnToTable(editor)).toBe(true);
    expect(tableShape(editor)).toEqual({ rows: before.rows, cells: before.cells + 1 });
    editor.destroy();
  });

  it('光标在表格外：对文档里的第一张表动手', () => {
    const editor = build('表格外面\n\n' + '| A | B |\n| --- | --- |\n| 1 | 2 |' + '\n');
    editor.commands.setTextSelection(2);
    expect(appendRowToTable(editor)).toBe(true);
    expect(tableShape(editor).rows).toBe(3);
    editor.destroy();
  });
});
