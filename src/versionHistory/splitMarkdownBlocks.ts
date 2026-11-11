/**
 * 把 markdown 切成顶层块。围栏、表格、列表、引用、公式和 details 内部的空行
 * 不会被切开。按空行切会把这些结构拆碎。
 */
export function splitTopLevelMarkdown(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: string[] = [];
  let index = 0;
  while (index < lines.length) {
    if (lines[index].trim() === '') {
      index += 1;
      continue;
    }
    const start = index;
    index = endOfBlock(lines, index);
    const text = lines.slice(start, index).join('\n').trim();
    if (text) blocks.push(text);
  }
  return blocks;
}

const FENCE = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const LIST_ITEM = /^( {0,3})([-+*]|\d+[.)])\s+/;
const TABLE_ROW = /^\s*\|/;
const QUOTE = /^ {0,3}>/;
const DETAILS_OPEN = /^ {0,3}<details\b/i;
const FIGURE_OPEN = /^ {0,3}<figure\b/i;
const DIV_OPEN = /^ {0,3}<div\b/i;

function endOfBlock(lines: string[], index: number): number {
  const line = lines[index];
  const fence = FENCE.exec(line);
  if (fence) return endOfFence(lines, index, fence[2][0], fence[2].length);
  if (DETAILS_OPEN.test(line)) return endOfHtml(lines, index, 'details');
  if (FIGURE_OPEN.test(line)) return endOfHtml(lines, index, 'figure');
  if (DIV_OPEN.test(line)) return endOfHtml(lines, index, 'div');
  if (isMathOpen(line)) return endOfMath(lines, index);
  if (TABLE_ROW.test(line)) return endWhile(lines, index, (row) => TABLE_ROW.test(row) || /^\s*\|?\s*:?-{3,}/.test(row));
  if (QUOTE.test(line)) return endOfQuote(lines, index);
  if (LIST_ITEM.test(line)) return endOfList(lines, index);
  return endOfParagraph(lines, index);
}

function endOfFence(lines: string[], index: number, char: string, length: number): number {
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const close = FENCE.exec(lines[cursor]);
    if (close && close[2][0] === char && close[2].length >= length && close[3].trim() === '') {
      return cursor + 1;
    }
  }
  return lines.length;
}

function endOfHtml(lines: string[], index: number, tag: string): number {
  const open = new RegExp(`<${tag}\\b`, 'i');
  const close = new RegExp(`</${tag}>`, 'i');
  let depth = 0;
  for (let cursor = index; cursor < lines.length; cursor += 1) {
    if (open.test(lines[cursor])) depth += 1;
    if (close.test(lines[cursor])) {
      depth -= 1;
      if (depth <= 0) return cursor + 1;
    }
  }
  return lines.length;
}

function isMathOpen(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === '$$' || (trimmed.startsWith('$$') && !trimmed.slice(2).includes('$$'));
}

function endOfMath(lines: string[], index: number): number {
  if (lines[index].trim() !== '$$' && lines[index].includes('$$', 2)) return index + 1;
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    if (lines[cursor].trim() === '$$' || lines[cursor].trimEnd().endsWith('$$')) return cursor + 1;
  }
  return lines.length;
}

function endWhile(lines: string[], index: number, keep: (line: string) => boolean): number {
  let cursor = index;
  while (cursor < lines.length && keep(lines[cursor])) cursor += 1;
  return cursor;
}

function endOfQuote(lines: string[], index: number): number {
  let cursor = index;
  while (cursor < lines.length) {
    if (lines[cursor].trim() === '') {
      const next = nextNonEmpty(lines, cursor + 1);
      if (next < lines.length && QUOTE.test(lines[next])) {
        cursor = next;
        continue;
      }
      break;
    }
    if (!QUOTE.test(lines[cursor]) && !/^\s+/.test(lines[cursor])) break;
    cursor += 1;
  }
  return cursor;
}

function endOfList(lines: string[], index: number): number {
  let cursor = index;
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (line.trim() === '') {
      const next = nextNonEmpty(lines, cursor + 1);
      if (next < lines.length && (LIST_ITEM.test(lines[next]) || /^\s+\S/.test(lines[next]))) {
        cursor = next;
        continue;
      }
      break;
    }
    if (FENCE.test(line)) {
      const fence = FENCE.exec(line)!;
      cursor = endOfFence(lines, cursor, fence[2][0], fence[2].length);
      continue;
    }
    if (LIST_ITEM.test(line) || /^\s+\S/.test(line) || QUOTE.test(line)) {
      cursor += 1;
      continue;
    }
    break;
  }
  return cursor;
}

function endOfParagraph(lines: string[], index: number): number {
  let cursor = index + 1;
  while (cursor < lines.length && lines[cursor].trim() !== '') cursor += 1;
  return cursor;
}

function nextNonEmpty(lines: string[], index: number): number {
  let cursor = index;
  while (cursor < lines.length && lines[cursor].trim() === '') cursor += 1;
  return cursor;
}

/** 首屏至少一块，凑到 budget 个字符为止。其余按 batch 个字符打包。 */
export function chunkMarkdownBlocks(
  blocks: string[],
  budget = 8000,
  batch = 24000,
): { first: string; rest: string[] } {
  if (blocks.length === 0) return { first: '', rest: [] };
  const head: string[] = [];
  let size = 0;
  let index = 0;
  do {
    head.push(blocks[index]);
    size += blocks[index].length;
    index += 1;
  } while (index < blocks.length && size < budget);
  const rest: string[] = [];
  while (index < blocks.length) {
    const group: string[] = [];
    let groupSize = 0;
    do {
      group.push(blocks[index]);
      groupSize += blocks[index].length;
      index += 1;
    } while (index < blocks.length && groupSize < batch);
    rest.push(group.join('\n\n'));
  }
  return { first: head.join('\n\n'), rest };
}
