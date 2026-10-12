import '@tiptap/markdown';
import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';

/**
 * 块拖拽菜单能「转成」的目标。和斜杠菜单里可序列化的块对齐，不含表格 / 公式 / 图片。
 */
export const TURN_INTO_KINDS = [
  'paragraph',
  'heading-1',
  'heading-2',
  'heading-3',
  'bulletList',
  'orderedList',
  'taskList',
  'blockquote',
  'codeBlock',
] as const;

export type TurnIntoKind = (typeof TURN_INTO_KINDS)[number];

const TURNABLE = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'taskList',
  'listItem',
  'taskItem',
  'blockquote',
  'codeBlock',
]);

/** 列表 / 引用 / 代码块要先拆掉外壳，段落和标题直接改节点类型即可。 */
const LIFT_BEFORE_TURN = new Set([
  'listItem',
  'taskItem',
  'bulletList',
  'orderedList',
  'taskList',
  'blockquote',
  'codeBlock',
]);

export function canTurnBlockInto(node: PMNode | null | undefined): boolean {
  return !!node && TURNABLE.has(node.type.name);
}

/** 菜单里标出「当前就是这种块」。列表项看它的父列表。 */
export function currentTurnIntoKind(
  editor: Editor,
  pos: number,
  node: PMNode,
): TurnIntoKind | null {
  const name = node.type.name;
  if (name === 'paragraph') return 'paragraph';
  if (name === 'heading') {
    const level = Number(node.attrs.level);
    if (level === 1 || level === 2 || level === 3) {
      return `heading-${level}` as TurnIntoKind;
    }
    return null;
  }
  if (name === 'bulletList') return 'bulletList';
  if (name === 'orderedList') return 'orderedList';
  if (name === 'taskList') return 'taskList';
  if (name === 'blockquote') return 'blockquote';
  if (name === 'codeBlock') return 'codeBlock';
  if (name === 'listItem' || name === 'taskItem') {
    const parent = editor.state.doc.resolve(pos).parent.type.name;
    if (parent === 'bulletList') return 'bulletList';
    if (parent === 'orderedList') return 'orderedList';
    if (parent === 'taskList') return 'taskList';
  }
  return null;
}

/** 文本块内部的第一个可放光标的位置；容器则钻到第一个文本块里。 */
function firstTextPos(node: PMNode, pos: number): number | null {
  if (node.isTextblock) return pos + 1;
  let found: number | null = null;
  node.descendants((child, offset) => {
    if (found != null) return false;
    if (child.isTextblock) {
      found = pos + 1 + offset + 1;
      return false;
    }
    return true;
  });
  return found;
}

/**
 * 把 `pos` 上的块转成另一种。光标落进块内再执行，这样列表项 / 引用里的段落
 * 改的是这一块，而不是文档开头。
 */
export function turnBlockInto(
  editor: Editor,
  pos: number,
  kind: TurnIntoKind,
): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!node || !canTurnBlockInto(node)) return false;
  const textPos = firstTextPos(node, pos);
  if (textPos == null) return false;

  const chain = editor.chain().setTextSelection(textPos);
  if (LIFT_BEFORE_TURN.has(node.type.name)) chain.clearNodes();

  if (kind === 'heading-1' || kind === 'heading-2' || kind === 'heading-3') {
    const level = Number(kind.slice(-1)) as 1 | 2 | 3;
    chain.setHeading({ level });
  } else if (kind === 'paragraph') {
    // 列表 / 代码块 / 引用先 clearNodes，它已经把文本块还原成段落。
    // 再 setParagraph 会因为「已经是段落」返回 false，把整条 chain 丢掉。
    if (!LIFT_BEFORE_TURN.has(node.type.name)) chain.setParagraph();
  } else if (kind === 'bulletList') {
    chain.toggleBulletList();
  } else if (kind === 'orderedList') {
    chain.toggleOrderedList();
  } else if (kind === 'taskList') {
    chain.toggleTaskList();
  } else if (kind === 'blockquote') {
    chain.toggleBlockquote();
  } else if (kind === 'codeBlock') {
    chain.setCodeBlock();
  }

  return chain.run();
}

/** 在块后面插入一份拷贝（列表项插成同级下一项）。 */
export function duplicateBlock(editor: Editor, pos: number): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return false;
  return editor.chain().insertContentAt(pos + node.nodeSize, node.toJSON()).run();
}

/**
 * 删掉这一块。文档里只剩这一块时换成空段落（schema 不允许空 doc）。
 * 列表里只剩这一项时连列表一起删，避免留下空的 ul/ol。
 */
export function deleteBlock(editor: Editor, pos: number): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return false;

  let from = pos;
  let to = pos + node.nodeSize;
  const $pos = editor.state.doc.resolve(pos);
  const parent = $pos.parent;
  if (
    (node.type.name === 'listItem' || node.type.name === 'taskItem') &&
    parent.childCount === 1
  ) {
    from = pos - $pos.parentOffset - 1;
    const list = editor.state.doc.nodeAt(from);
    if (list) to = from + list.nodeSize;
  }

  if (from <= 0 && to >= editor.state.doc.content.size) {
    return editor
      .chain()
      .insertContentAt(
        { from: 0, to: editor.state.doc.content.size },
        { type: 'paragraph' },
      )
      .run();
  }

  return editor.chain().deleteRange({ from, to }).run();
}

/** 这一块的 markdown。复制进剪贴板前先拿到字符串，失败时调用方可以自己兜底。 */
export function blockMarkdown(editor: Editor, pos: number): string | null {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return null;
  const serialized = editor.markdown?.serialize(node.toJSON());
  if (typeof serialized === 'string') return serialized;
  return node.textContent;
}

export function canResetBlockFormatting(node: PMNode | null | undefined): boolean {
  if (!node || node.isAtom) return false;
  if (node.type.name === 'image' || node.type.name === 'horizontalRule') {
    return false;
  }
  if (node.isTextblock) return true;
  let found = false;
  node.descendants((child) => {
    if (child.isTextblock) {
      found = true;
      return false;
    }
    return true;
  });
  return found;
}

function withoutBlockStyles(node: PMNode): Record<string, unknown> {
  const next: Record<string, unknown> = { ...node.attrs };
  if ('textAlign' in next) next.textAlign = null;
  if ('indent' in next) next.indent = null;
  if ('lineHeight' in next) next.lineHeight = null;
  return next;
}

/** 清掉块内的行内 mark，以及段落 / 标题上的对齐、缩进、行高。 */
export function resetBlockFormatting(editor: Editor, pos: number): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!node || !canResetBlockFormatting(node)) return false;

  const from = pos + 1;
  const to = pos + node.nodeSize - 1;
  let tr = editor.state.tr;
  if (to > from) {
    for (const mark of Object.values(editor.schema.marks)) {
      tr = tr.removeMark(from, to, mark);
    }
  }

  const markup: { pos: number; attrs: Record<string, unknown> }[] = [];
  if (node.isTextblock) {
    markup.push({ pos, attrs: withoutBlockStyles(node) });
  }
  node.descendants((child, offset) => {
    if (!child.isTextblock) return;
    markup.push({
      pos: pos + 1 + offset,
      attrs: withoutBlockStyles(child),
    });
  });
  for (const item of markup) {
    tr = tr.setNodeMarkup(item.pos, undefined, item.attrs);
  }

  if (!tr.docChanged) return false;
  editor.view.dispatch(tr);
  return true;
}

export function isImageBlock(node: PMNode | null | undefined): boolean {
  return (
    node?.type.name === 'image' &&
    typeof node.attrs.src === 'string' &&
    node.attrs.src.length > 0
  );
}

/** 下载图片节点。跨域地址浏览器会忽略 download，退化为打开链接。 */
export function downloadImageBlock(node: PMNode): void {
  if (!isImageBlock(node)) return;
  const src = node.attrs.src as string;
  const alt = typeof node.attrs.alt === 'string' ? node.attrs.alt.trim() : '';
  const fromUrl = src.split('/').pop()?.split('?')[0] ?? '';
  const a = document.createElement('a');
  a.href = src;
  a.download = alt || fromUrl || 'image';
  a.rel = 'noopener';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

