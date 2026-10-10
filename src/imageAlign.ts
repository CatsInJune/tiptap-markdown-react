import type { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { normalizeImageAlign, type ImageAlign } from './imageMarkdown';

/**
 * 找「当前图片」的位置：节点选区落在图上，或光标紧邻图前 / 图后。
 * 对齐与重置尺寸（resetImageSize）共用这套判据。
 */
export function findImagePos(editor: Editor): number | null {
  const { selection } = editor.state;
  if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
    return selection.from;
  }
  const { $from } = selection;
  if ($from.nodeAfter?.type.name === 'image') return $from.pos;
  if ($from.nodeBefore?.type.name === 'image') {
    return $from.pos - $from.nodeBefore.nodeSize;
  }
  return null;
}

function readAlign(editor: Editor, pos: number): ImageAlign | null {
  return normalizeImageAlign(editor.state.doc.nodeAt(pos)?.attrs.align);
}

/** 当前图片是否已对齐到指定方向（宿主画按钮态用；没选中图时为 false）。 */
export function isImageAlignActive(editor: Editor, align: ImageAlign): boolean {
  const pos = findImagePos(editor);
  return pos != null && readAlign(editor, pos) === align;
}

/**
 * 把「当前图片」（选中 / 光标紧邻）对齐到 left / center / right。
 * attrs 存 `align`、渲染成 `data-align`；markdown 里以
 * `<img … data-align="…">` 保真（见 imageMarkdown.ts）。返回是否找到图片。
 * 已是对齐值时不写事务（不污染 undo 历史）。
 */
export function setImageAlign(editor: Editor, align: ImageAlign): boolean {
  const pos = findImagePos(editor);
  if (pos == null) return false;
  if (readAlign(editor, pos) === align) return true;
  return editor
    .chain()
    .focus()
    .setNodeSelection(pos)
    .updateAttributes('image', { align })
    .run();
}

/**
 * 按文档位置对齐（悬停工具条用：hover 时记下位置，attrs 读写都走 pos）。
 * 不改变选区——点一下对齐按钮不该先「选中」图片。
 *
 * 注意别改成长期持有 img 元素的引用：**attrs 更新时 prosemirror 会替换裸渲染的
 * img 元素**（旧引用脱离文档、读不到新属性，后续 posAtDOM 也会抛），所以位置比元素可靠。
 */
export function setImageAlignAtPos(
  editor: Editor,
  pos: number,
  align: ImageAlign,
): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== 'image') return false;
  if (normalizeImageAlign(node.attrs.align) === align) return true;
  editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, 'align', align));
  return true;
}

/**
 * 按 DOM 元素对齐（宿主自定义 UI 用：拿到的是当前挂着的元素）。转成位置后走
 * {@link setImageAlignAtPos}。
 */
export function setImageAlignAt(
  editor: Editor,
  imageElement: HTMLElement,
  align: ImageAlign,
): boolean {
  try {
    const pos = editor.view.posAtDOM(imageElement, 0);
    const node = editor.state.doc.nodeAt(pos);
    if (!node || node.type.name !== 'image') return false;
    return setImageAlignAtPos(editor, pos, align);
  } catch {
    return false;
  }
}
