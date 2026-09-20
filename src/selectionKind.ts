import type { Selection } from '@tiptap/pm/state';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';

/**
 * 选区类型——给宿主判断「用户选的是什么」用。
 *
 * - `text`：普通文字选区（含 AllSelection）
 * - `cell`：表格里的单元格选区（`CellSelection`，拖过表格时就是它）
 * - `node`：整节点选区（`NodeSelection`）。图表 / 图片 / 代码块这类 `atom` 节点只能这样被选中
 *   ——它们在编辑器里渲染成图或块，用户没法用拖选文字的方式选中
 */
export type SelectionKind = 'text' | 'cell' | 'node';

export function selectionKind(selection: Selection): SelectionKind {
  if (selection instanceof CellSelection) return 'cell';
  if (selection instanceof NodeSelection) return 'node';
  if (selection instanceof TextSelection) return 'text';
  return 'text';
}
