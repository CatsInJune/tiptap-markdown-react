import type { Editor } from '@tiptap/core';
import { findImagePos } from './imageAlign';
import { normalizeImageCaption } from './imageMarkdown';

/**
 * 按文档位置设置图片描述（图注）——悬停工具条用（鼠标飘过图片时图片未必被
 * 选中，走不了 selection；也不该为此改变选区）。空串 / null 清除描述。
 */
export function setImageCaptionAtPos(
  editor: Editor,
  pos: number,
  caption: string | null,
): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== 'image') return false;
  const next = normalizeImageCaption(caption);
  const current = normalizeImageCaption(node.attrs.caption);
  if (current === next) return true; // 未变化：不写空事务
  editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, 'caption', next));
  return true;
}

/**
 * 设置「当前图片」（选中 / 光标紧邻）的描述。attrs 存 `caption`；markdown 里带描述的
 * 图以 `<figure><img …><figcaption>…</figcaption></figure>` 保真（见 imageMarkdown.ts）。
 * 返回是否找到图片。
 */
export function setImageCaption(editor: Editor, caption: string | null): boolean {
  const pos = findImagePos(editor);
  if (pos == null) return false;
  return setImageCaptionAtPos(editor, pos, caption);
}
