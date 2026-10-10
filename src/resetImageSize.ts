import type { Editor } from '@tiptap/core';
import { findImagePos } from './imageAlign';

/**
 * 清掉「当前图片」的尺寸（width / height attrs），让它回到标准 `![alt](url)` 语法
 * （对齐若仍在，则回落到 `<img … data-align="…">` 形式）。
 *
 * 拖拽缩放只有入口没有出口：拖过尺寸的图在 markdown 里是 `<img …>`，想在保存形态上
 * 反悔（比如拖歪了、想恢复原图全尺寸）时——undo 之外没有别的路。这个工具补上出口：
 * 宿主可以接自己的按钮 / 菜单（库内暂不渲染 UI）。
 *
 * @returns 是否找到并重置了图片。没找到图（光标不在图旁）时返回 false。
 */
export function resetImageSize(editor: Editor): boolean {
  const pos = findImagePos(editor);
  if (pos == null) return false;
  return editor
    .chain()
    .focus()
    .setNodeSelection(pos)
    .updateAttributes('image', { width: null, height: null })
    .run();
}
