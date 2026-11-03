import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';

/**
 * 把一章的顶层块序列化为 markdown（含块 ID 注释，RFC §8.1）。
 *
 * 宿主保存管线按 H2 切章后，用本函数得到每章要上报的整章正文；空章返回空串。
 * 序列化仍走编辑器挂载的 BlockIdMarkdown manager，宿主不碰 markdown 结构。
 */
export function serializeChapterMarkdown(
  editor: Editor,
  blocks: PMNode[],
): string {
  if (!blocks.length) return '';
  const manager = editor.markdown;
  if (!manager) return '';
  return manager.serialize({
    type: 'doc',
    content: blocks.map((block) => block.toJSON()),
  });
}
