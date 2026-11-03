import type { Node as PMNode } from '@tiptap/pm/model';

/**
 * 按 H2 切章（RFC §7.3）：从第二个 H2 起每个 H2 开新章；首个 H2 与它前面的
 * 内容一起归第一章；无 H2 整篇一章。
 *
 * **不变量**：`chapters.flat()` 严格等于输入（无损分区、顺序不变）。
 * 壳章（H2 紧邻 H2）保留、不合并——H2 就是章的边界。
 */
export function splitIntoChapters(blocks: PMNode[]): PMNode[][] {
  const chapters: PMNode[][] = [];
  let current: PMNode[] = [];
  let seenH2 = false;
  for (const block of blocks) {
    const isH2 = block.type.name === 'heading' && block.attrs.level === 2;
    if (isH2 && seenH2) {
      chapters.push(current);
      current = [];
    }
    if (isH2) seenH2 = true;
    current.push(block);
  }
  if (current.length) chapters.push(current);
  return chapters.length ? chapters : [[]];
}
