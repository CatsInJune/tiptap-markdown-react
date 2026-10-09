// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { CellSelection, TableMap } from '@tiptap/pm/tables';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { baseExtensions } from '../extensions';
import { defaultToolbarLabels } from '../labels';
import { TableHandles } from './TableHandles';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const TABLE_MD = `| A | B | C |
| --- | --- | --- |
| 1 | 2 | 3 |
| 4 | 5 | 6 |
`;

function buildEditor(content = TABLE_MD, editable = true): Editor {
  return new Editor({
    extensions: [...baseExtensions, Markdown],
    content,
    contentType: 'markdown',
    editable,
  });
}

/** 文档里第一张表的行数 / 首行列数（比 diff markdown 稳）。 */
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

/** 在第一张表里选中 [top,bottom) × [left,right) 的单元格矩形（与 tableSelection.test.ts 同款算法）。 */
function selectCells(editor: Editor, top: number, left: number, bottom: number, right: number): void {
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
  const $anchor = editor.state.doc.resolve(tableStart + map.positionAt(top, left, table));
  const $head = editor.state.doc.resolve(
    tableStart + map.positionAt(bottom - 1, right - 1, table),
  );
  editor.view.dispatch(
    editor.state.tr.setSelection(new CellSelection($anchor, $head)),
  );
}

/**
 * 表格悬停手柄（Notion 式）—— 取代原来的「表内右键出菜单」。
 *
 * 这里能钉的是行为：谁能悬出手柄、点开是行菜单还是列菜单、菜单里的命令真的改了文档、
 * 只读态不出手柄、以及右键只剩多格选区那条路（手柄表达不了批量场景）。
 * 几何位置（手柄贴在行左缘 / 表格上方）量不了：happy-dom 里 getBoundingClientRect 全是 0，
 * 那部分按项目惯例走真实浏览器（见 project-css-visual-verification）。
 */
describe('TableHandles', () => {
  let host: HTMLDivElement;
  let root: Root;
  let editor: Editor;

  const mount = async (ed: Editor) => {
    editor = ed;
    // `new Editor({...})` 没传 element 时视图 DOM 是游离的，事件冒泡不到 document；
    // 真实宿主里它在文档里，所以测试也要挂上去（否则 mousemove 追不到）
    document.body.appendChild(editor.view.dom);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(<TableHandles editor={editor} labels={defaultToolbarLabels} />);
    });
    return host;
  };

  const cell = (row: number, col: number) =>
    editor.view.dom.querySelectorAll('tr')[row].children[col] as HTMLElement;
  const rowHandle = () =>
    document.querySelector<HTMLButtonElement>('[data-table-handle="row"]');
  const colHandle = () =>
    document.querySelector<HTMLButtonElement>('[data-table-handle="col"]');
  const menu = () => document.querySelector('[data-table-menu]');
  const menuLabels = () =>
    Array.from(document.querySelectorAll('[data-table-menu] button')).map((b) =>
      b.textContent?.trim(),
    );
  const clickMenuItem = async (label: string) => {
    const button = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-table-menu] button'),
    ).find((b) => b.textContent?.includes(label));
    expect(button, `菜单里应有「${label}」`).toBeTruthy();
    await act(async () => {
      button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };

  const hover = async (el: Element | null) => {
    await act(async () => {
      el?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    });
  };

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    editor.destroy();
  });

  it('悬停单元格出两个手柄；移到表格外就收起', async () => {
    vi.useFakeTimers();
    await mount(buildEditor());
    expect(rowHandle()).toBeNull();

    await hover(cell(1, 1));
    expect(rowHandle()).not.toBeNull();
    expect(colHandle()).not.toBeNull();
    expect(rowHandle()?.getAttribute('aria-label')).toBe(
      defaultToolbarLabels.tableRowMenu,
    );

    // 同格重复移动不该重复测量（顺带验证不会抛）
    await hover(cell(1, 1));
    expect(rowHandle()).not.toBeNull();

    // 移到表格外（编辑器本体 / 表外的段落）：过一小段宽限后收起。
    // 注意别拿 querySelector('p') 当「表格外」——单元格里就有段落。
    await hover(editor.view.dom);
    expect(rowHandle()).not.toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(rowHandle()).toBeNull();
    expect(colHandle()).toBeNull();
  });

  it('从单元格挪到手柄的路上经过空隙时，手柄不能提前消失（点不到的那个 bug）', async () => {
    vi.useFakeTimers();
    await mount(buildEditor());
    await hover(cell(1, 1));
    expect(rowHandle()).not.toBeNull();

    // 空隙一：手柄与表格之间那段（既不是单元格也不是手柄）
    await hover(editor.view.dom);
    expect(rowHandle()).not.toBeNull();

    // 指针追上手柄本身：不该再收起
    await hover(rowHandle());
    expect(rowHandle()).not.toBeNull();

    // 再离开、并等过宽限：这次才该没了
    await hover(editor.view.dom);
    expect(rowHandle()).not.toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(rowHandle()).toBeNull();
  });

  it('行手柄：先整行选中（CellSelection），菜单只给行操作', async () => {
    await mount(buildEditor());
    await hover(cell(2, 1));

    await act(async () => {
      rowHandle()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(editor.state.selection).toBeInstanceOf(CellSelection);
    expect(menu()).not.toBeNull();
    const labels = menuLabels();
    expect(labels).toContain(defaultToolbarLabels.tableAddRowAfter);
    expect(labels).toContain(defaultToolbarLabels.tableDeleteRow);
    expect(labels).not.toContain(defaultToolbarLabels.tableAddColumnAfter);
    expect(labels).toContain(defaultToolbarLabels.tableDeleteTable);
    // 手柄让位给菜单（改由选中高亮指示目标）
    expect(rowHandle()).toBeNull();
  });

  it('行手柄 → 下方插入行：真的多一行，菜单关闭', async () => {
    await mount(buildEditor());
    const before = tableShape(editor);
    await hover(cell(2, 1));
    await act(async () => {
      rowHandle()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await clickMenuItem(defaultToolbarLabels.tableAddRowAfter);

    expect(tableShape(editor).rows).toBe(before.rows + 1);
    expect(tableShape(editor).cells).toBe(before.cells);
    expect(menu()).toBeNull();
  });

  it('列手柄：菜单只给列操作，右侧插入列生效', async () => {
    await mount(buildEditor());
    await hover(cell(1, 0));
    await act(async () => {
      colHandle()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const labels = menuLabels();
    expect(labels).toContain(defaultToolbarLabels.tableAddColumnAfter);
    expect(labels).not.toContain(defaultToolbarLabels.tableAddRowAfter);

    const before = tableShape(editor);
    await clickMenuItem(defaultToolbarLabels.tableAddColumnAfter);
    expect(tableShape(editor).cells).toBe(before.cells + 1);
    expect(tableShape(editor).rows).toBe(before.rows);
  });

  it('表头行的「删除行 / 上方插入行」禁用', async () => {
    await mount(buildEditor());
    await hover(cell(0, 0));
    await act(async () => {
      rowHandle()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const disabledLabels = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-table-menu] button'),
    )
      .filter((b) => b.disabled)
      .map((b) => b.textContent?.trim());
    expect(disabledLabels).toContain(defaultToolbarLabels.tableDeleteRow);
    expect(disabledLabels).toContain(defaultToolbarLabels.tableAddRowBefore);
  });

  it('菜单里有「清空内容 / 重置单元格样式」，点清空会清掉该行文字', async () => {
    await mount(buildEditor());
    await hover(cell(2, 1));
    await act(async () => {
      rowHandle()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const labels = menuLabels();
    expect(labels).toContain(defaultToolbarLabels.tableClearContent);
    expect(labels).toContain(defaultToolbarLabels.tableResetCellStyles);

    const before = tableShape(editor);
    await clickMenuItem(defaultToolbarLabels.tableClearContent);

    // 行数与列数不变，但那一行的文字没了
    expect(tableShape(editor)).toEqual(before);
    const thirdRow = editor.view.dom.querySelectorAll('tr')[2];
    expect(thirdRow.textContent?.trim()).toBe('');
    expect(menu()).toBeNull();
  });

  it('两个 `+` 只跟着位置出：最后一行出加行、最后一列出加列', async () => {
    await mount(buildEditor()); // 表头 + 2 行 × 3 列

    const extendCol = () => document.querySelector('[data-table-extend="col"]');
    const extendRow = () => document.querySelector('[data-table-extend="row"]');

    // 表格中间那格：两个 `+` 都不出（只有行 / 列手柄）
    await hover(cell(1, 1));
    expect(extendRow()).toBeNull();
    expect(extendCol()).toBeNull();
    expect(rowHandle()).not.toBeNull();

    // 最后一行（不是最后一列）：只出加行
    await hover(cell(2, 1));
    expect(extendRow()).not.toBeNull();
    expect(extendCol()).toBeNull();

    // 最后一列（不是最后一行）：只出加列
    await hover(cell(1, 2));
    expect(extendCol()).not.toBeNull();
    expect(extendRow()).toBeNull();

    // 右下角那格：两个都出
    await hover(cell(2, 2));
    expect(extendRow()).not.toBeNull();
    expect(extendCol()).not.toBeNull();
    expect(extendCol()?.getAttribute('aria-label')).toBe(
      defaultToolbarLabels.tableAppendColumn,
    );
    expect(extendRow()?.getAttribute('aria-label')).toBe(
      defaultToolbarLabels.tableAppendRow,
    );
  });

  it('点 `+` 追加一列 / 一行，追加后手柄跟着重新贴', async () => {
    await mount(buildEditor());
    await hover(cell(2, 2)); // 右下角：两个 `+` 都在
    const before = tableShape(editor);

    await act(async () => {
      document
        .querySelector('[data-table-extend="row"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(tableShape(editor)).toEqual({ rows: before.rows + 1, cells: before.cells });

    await act(async () => {
      document
        .querySelector('[data-table-extend="col"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(tableShape(editor)).toEqual({
      rows: before.rows + 1,
      cells: before.cells + 1,
    });
    // 追加后重新量过：原来悬停的那格已经不是最后一行 / 列，两个 `+` 随之收起
    // （触发条件跟位置走，这一点在增删之后也必须重算）
    expect(document.querySelector('[data-table-extend="row"]')).toBeNull();
    expect(document.querySelector('[data-table-extend="col"]')).toBeNull();

    // 挪到新的右下角：两个 `+` 又回来
    await hover(cell(3, 3));
    expect(document.querySelector('[data-table-extend="row"]')).not.toBeNull();
    expect(document.querySelector('[data-table-extend="col"]')).not.toBeNull();
  });

  it('只读态不出手柄', async () => {
    await mount(buildEditor(TABLE_MD, false));
    await hover(cell(1, 1));
    expect(rowHandle()).toBeNull();
    expect(colHandle()).toBeNull();
  });

  it('右键只服务多格选区：没有多格选区时不出菜单', async () => {
    await mount(buildEditor());
    await act(async () => {
      cell(1, 1).dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
      );
    });
    expect(menu()).toBeNull();

    // 多格选区的那条路依赖 posAtCoords 的几何（happy-dom 里量不到），走真实浏览器验
    await act(async () => {
      selectCells(editor, 1, 0, 3, 2);
    });
    expect(editor.state.selection).toBeInstanceOf(CellSelection);
  });
});
