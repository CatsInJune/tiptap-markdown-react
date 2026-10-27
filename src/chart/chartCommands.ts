import type { Editor } from '@tiptap/react';
import { replaceRangeWithMarkdown } from '../replaceRange';
import type { ChartColumn, ChartConfig, MvpChartType } from './types';

function chartAt(editor: Editor, pos: number) {
  const node = editor.state.doc.nodeAt(pos);
  if (node?.type.name !== 'chart') return null;
  return node;
}

function configsOf(node: { attrs: { config?: unknown } }): ChartConfig[] {
  return Array.isArray(node.attrs.config)
    ? (node.attrs.config as ChartConfig[])
    : [];
}

/** 换图型：只改第一份配置的 chartType，数据不动。换完仍选中这张图。 */
export function setChartType(
  editor: Editor,
  pos: number,
  chartType: MvpChartType,
): boolean {
  const node = chartAt(editor, pos);
  const [first, ...rest] = node ? configsOf(node) : [];
  if (!node || !first) return false;
  const config = [{ ...first, chartType }, ...rest];
  return editor
    .chain()
    .command(({ tr }) => {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, config });
      return true;
    })
    .setNodeSelection(pos)
    .run();
}

function cell(value: unknown): string {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
}

/**
 * 还原成表格：用节点上的 columns / dataSource 写一张 GFM 表，替换图表节点。
 * 不带图表注释，读回来才是表而不是图。
 */
export function chartToTable(editor: Editor, pos: number): boolean {
  const node = chartAt(editor, pos);
  if (!node) return false;
  const columns: ChartColumn[] = Array.isArray(node.attrs.columns)
    ? node.attrs.columns
    : [];
  const data: Array<Record<string, unknown>> = Array.isArray(node.attrs.dataSource)
    ? node.attrs.dataSource
    : [];
  if (!columns.length) return false;
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  const header = columns.map((column) => cell(column.title));
  const table = [
    line(header),
    `| ${header.map(() => '---').join(' | ')} |`,
    ...data.map((row) =>
      line(columns.map((column) => cell(row[column.dataIndex]))),
    ),
  ].join('\n');
  return replaceRangeWithMarkdown(
    editor,
    { from: pos, to: pos + node.nodeSize },
    table,
  );
}
