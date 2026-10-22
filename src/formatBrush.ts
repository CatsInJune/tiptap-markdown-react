import type { Editor } from '@tiptap/core';
import type { Mark, Node as PMNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';

/**
 * 格式刷 / 清除格式。
 *
 * Tiptap 没有格式刷扩展（免费核心和 Pro 都没有）。
 * 清除格式的官方命令是 `unsetAllMarks` + `clearNodes`，这里不用它们：
 * - `unsetAllMarks` 在空选区直接返回，并且会卸掉 link（评论 mark 已标 clearable: false）
 * - `clearNodes` 会把列表、引用、代码块 lift 成段落
 * 排版只动下面这组 mark，外加标题 / 对齐 / 缩进 / 行高。
 */
const FORMAT_MARKS = new Set([
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'highlight',
  'textStyle',
  'superscript',
  'subscript',
]);

export interface CapturedMark {
  type: string;
  attrs: Record<string, unknown>;
}

export interface CapturedBlockFormat {
  type: 'paragraph' | 'heading';
  level: number | null;
  textAlign: string | null;
  indent: number | null;
  lineHeight: number | null;
}

export interface CapturedFormat {
  marks: CapturedMark[];
  /**
   * 光标，或选区盖住锚点所在整段时才有。
   * 只框住半段文字时为 null：刷的时候只动行内 mark。
   */
  block: CapturedBlockFormat | null;
}

const PLAIN_BLOCK: CapturedBlockFormat = {
  type: 'paragraph',
  level: null,
  textAlign: null,
  indent: null,
  lineHeight: null,
};

function isFormatMark(name: string): boolean {
  return FORMAT_MARKS.has(name);
}

function isStyleBlock(node: PMNode): boolean {
  return node.type.name === 'paragraph' || node.type.name === 'heading';
}

function readBlock(node: PMNode): CapturedBlockFormat {
  const indent = Number(node.attrs.indent);
  const lineHeight = Number(node.attrs.lineHeight);
  return {
    type: node.type.name === 'heading' ? 'heading' : 'paragraph',
    level: node.type.name === 'heading' ? Number(node.attrs.level) || 1 : null,
    textAlign:
      typeof node.attrs.textAlign === 'string' && node.attrs.textAlign
        ? node.attrs.textAlign
        : null,
    indent: Number.isFinite(indent) && indent > 0 ? indent : null,
    lineHeight: Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : null,
  };
}

function sameMarkSet(a: readonly Mark[], b: readonly Mark[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((mark) => b.some((other) => mark.eq(other)));
}

/** 选区起点所在的文本块。代码块不参与格式刷。 */
function anchorTextblock(
  doc: PMNode,
  from: number,
  to: number,
): { node: PMNode; pos: number } | null {
  const $from = doc.resolve(from);
  if ($from.parent.isTextblock && !$from.parent.type.spec.code) {
    return { node: $from.parent, pos: $from.before() };
  }
  if (from === to) return null;
  let found: { node: PMNode; pos: number } | null = null;
  doc.nodesBetween(from, to, (node, pos) => {
    if (found) return false;
    if (node.isTextblock && !node.type.spec.code) {
      found = { node, pos };
      return false;
    }
  });
  return found;
}

function blockIsCovered(node: PMNode, pos: number, from: number, to: number): boolean {
  const contentFrom = pos + 1;
  const contentTo = pos + node.nodeSize - 1;
  return from <= contentFrom && to >= contentTo;
}

function sourceMarks(doc: PMNode, from: number, to: number, stored: readonly Mark[] | null): readonly Mark[] {
  if (from === to) {
    if (stored) return stored;
    return doc.resolve(from).marks();
  }
  const $from = doc.resolve(from);
  if ($from.nodeAfter?.isText) return $from.nodeAfter.marks;
  return $from.marks();
}

/** 从当前选区取样。代码块 / 非文本选区返回 null。 */
export function captureFormat(editor: Editor): CapturedFormat | null {
  if (!editor.isEditable) return null;
  const { selection, storedMarks, doc } = editor.state;
  const anchor = anchorTextblock(doc, selection.from, selection.to);
  if (!anchor) return null;

  const marks = sourceMarks(doc, selection.from, selection.to, storedMarks)
    .filter((mark) => isFormatMark(mark.type.name))
    .map((mark) => ({ type: mark.type.name, attrs: { ...mark.attrs } }));

  const block =
    isStyleBlock(anchor.node) &&
    (selection.empty || blockIsCovered(anchor.node, anchor.pos, selection.from, selection.to))
      ? readBlock(anchor.node)
      : null;

  return { marks, block };
}

function canPaint(doc: PMNode, from: number, to: number): boolean {
  return anchorTextblock(doc, from, to) != null;
}

function removeFormatMarks(tr: Transaction, from: number, to: number): void {
  if (from >= to) return;
  for (const name of FORMAT_MARKS) {
    const type = tr.doc.type.schema.marks[name];
    if (type) tr.removeMark(from, to, type);
  }
}

function addFormatMarks(tr: Transaction, from: number, to: number, marks: CapturedMark[]): void {
  if (from >= to) return;
  for (const mark of marks) {
    const type = tr.doc.type.schema.marks[mark.type];
    if (!type || !isFormatMark(mark.type)) continue;
    tr.addMark(from, to, type.create(mark.attrs));
  }
}

/**
 * 下一次输入会带上的 mark。事务还没写 storedMarks 时，用状态里的
 * （光标在纯文本上按过加粗、字还没打出来），否则退回光标位置的 mark。
 */
function marksForNextInput(
  tr: Transaction,
  stateStored: readonly Mark[] | null,
): readonly Mark[] {
  if (tr.storedMarksSet) return tr.storedMarks ?? [];
  if (stateStored) return stateStored;
  return tr.selection.$from.marks();
}

function setFormatStoredMarks(
  tr: Transaction,
  marks: CapturedMark[],
  stateStored: readonly Mark[] | null,
): void {
  const current = marksForNextInput(tr, stateStored);
  const kept = current.filter((mark) => !isFormatMark(mark.type.name));
  const next = [
    ...kept,
    ...marks.flatMap((mark) => {
      const type = tr.doc.type.schema.marks[mark.type];
      return type && isFormatMark(mark.type) ? [type.create(mark.attrs)] : [];
    }),
  ];
  if (sameMarkSet(current, next)) return;
  tr.setStoredMarks(next);
}

function stripFormatStoredMarks(tr: Transaction, stateStored: readonly Mark[] | null): void {
  const current = marksForNextInput(tr, stateStored);
  const next = current.filter((mark) => !isFormatMark(mark.type.name));
  if (sameMarkSet(current, next)) return;
  tr.setStoredMarks(next);
}

function applyBlockAt(tr: Transaction, pos: number, block: CapturedBlockFormat): void {
  const node = tr.doc.nodeAt(pos);
  if (!node || !isStyleBlock(node)) return;
  const $pos = tr.doc.resolve(pos);
  let typeName = node.type.name;
  if (block.type === 'heading') {
    const heading = tr.doc.type.schema.nodes.heading;
    if (
      heading &&
      $pos.parent.canReplaceWith($pos.index(), $pos.index() + 1, heading)
    ) {
      typeName = 'heading';
    }
  } else if (node.type.name === 'heading') {
    const paragraph = tr.doc.type.schema.nodes.paragraph;
    if (
      paragraph &&
      $pos.parent.canReplaceWith($pos.index(), $pos.index() + 1, paragraph)
    ) {
      typeName = 'paragraph';
    }
  }
  const type = tr.doc.type.schema.nodes[typeName];
  if (!type) return;

  const indent = Number(node.attrs.indent);
  const lineHeight = Number(node.attrs.lineHeight);
  const sameType = node.type === type;
  const sameLevel = typeName !== 'heading' || Number(node.attrs.level) === (block.level ?? 1);
  const sameAlign = (node.attrs.textAlign || null) === block.textAlign;
  const sameIndent = (Number.isFinite(indent) && indent > 0 ? indent : null) === block.indent;
  const sameLine =
    (Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : null) === block.lineHeight;
  if (sameType && sameLevel && sameAlign && sameIndent && sameLine) return;

  const attrs: Record<string, unknown> = { ...node.attrs };
  if (typeName === 'heading') attrs.level = block.level ?? 1;
  else delete attrs.level;
  if (type.spec.attrs?.textAlign) attrs.textAlign = block.textAlign;
  if (type.spec.attrs?.indent) attrs.indent = block.indent;
  if (type.spec.attrs?.lineHeight) attrs.lineHeight = block.lineHeight;
  tr.setNodeMarkup(pos, type, attrs);
}

function coveredStyleBlockPositions(doc: PMNode, from: number, to: number): number[] {
  const positions: number[] = [];
  doc.nodesBetween(from, to, (node, pos) => {
    if (!isStyleBlock(node)) return;
    if (blockIsCovered(node, pos, from, to)) positions.push(pos);
  });
  return positions;
}

function mutateFormatting(
  tr: Transaction,
  mode: 'clear' | 'paint',
  format: CapturedFormat | null,
  stateStored: readonly Mark[] | null,
): boolean {
  const docBefore = tr.doc;
  const ranges = tr.selection.ranges.map((range) => ({
    from: range.$from.pos,
    to: range.$to.pos,
  }));
  const caretOnly = ranges.every((range) => range.from === range.to);

  if (caretOnly) {
    for (const range of ranges) {
      const $pos = tr.doc.resolve(range.from);
      const parent = $pos.parent;
      if (!parent.isTextblock || parent.type.spec.code) continue;
      if (mode === 'clear') {
        removeFormatMarks(tr, $pos.start(), $pos.end());
        if (isStyleBlock(parent)) applyBlockAt(tr, $pos.before(), PLAIN_BLOCK);
      } else if (format?.block && isStyleBlock(parent)) {
        applyBlockAt(tr, $pos.before(), format.block);
      }
    }
    if (mode === 'clear') stripFormatStoredMarks(tr, stateStored);
    else if (format) setFormatStoredMarks(tr, format.marks, stateStored);
  } else {
    for (const range of ranges) {
      // 格式刷是替换，不是叠加：先卸掉旧的排版 mark，再铺取样。
      removeFormatMarks(tr, range.from, range.to);
      if (mode === 'paint' && format) addFormatMarks(tr, range.from, range.to, format.marks);
    }
    const positions = new Set<number>();
    for (const range of ranges) {
      for (const pos of coveredStyleBlockPositions(tr.doc, range.from, range.to)) {
        positions.add(pos);
      }
    }
    const ordered = [...positions].sort((a, b) => b - a);
    for (const pos of ordered) {
      if (mode === 'clear') applyBlockAt(tr, pos, PLAIN_BLOCK);
      else if (format?.block) applyBlockAt(tr, pos, format.block);
    }
    if (mode === 'clear') stripFormatStoredMarks(tr, stateStored);
    else if (format) setFormatStoredMarks(tr, format.marks, stateStored);
  }

  const docChanged = !tr.doc.eq(docBefore);
  const storedChanged =
    tr.storedMarksSet && !sameMarkSet(tr.storedMarks ?? [], stateStored ?? []);
  return docChanged || storedChanged;
}

function runFormatCommand(editor: Editor, mutate: (tr: Transaction) => boolean): boolean {
  return editor.chain().focus().command(({ tr }) => mutate(tr)).run();
}

/**
 * 光标态要记住「下一笔」的 mark。文档末尾被刷成标题时，StarterKit 的
 * TrailingNode 会再插一个空段落，那一步会把事务上的 storedMarks 清掉。
 * 等整段 apply 结束再补一次，且不进撤销栈，避免多按一次撤销才回到正文。
 */
function pinCursorMarks(editor: Editor, desired: readonly Mark[]): void {
  if (!editor.state.selection.empty) return;
  const current = editor.state.storedMarks ?? editor.state.selection.$from.marks();
  if (sameMarkSet(current, desired)) return;
  editor.view.dispatch(
    editor.state.tr.setStoredMarks(desired).setMeta('addToHistory', false),
  );
}

function storedMarksFor(
  editor: Editor,
  captured: CapturedMark[] | null,
): Mark[] {
  const current = editor.state.storedMarks ?? editor.state.selection.$from.marks();
  const kept = current.filter((mark) => !isFormatMark(mark.type.name));
  if (!captured) return kept;
  return [
    ...kept,
    ...captured.flatMap((mark) => {
      const type = editor.schema.marks[mark.type];
      return type && isFormatMark(mark.type) ? [type.create(mark.attrs)] : [];
    }),
  ];
}

/**
 * 清除选区排版。
 * 空选区作用在光标所在整段；非空选区只清框住的行内 mark，
 * 整段都被选中时才把标题降成正文并清掉对齐 / 缩进 / 行高。
 */
export function clearFormatting(editor: Editor): boolean {
  if (!editor.isEditable) return false;
  const { selection, doc } = editor.state;
  if (!canPaint(doc, selection.from, selection.to)) return false;
  const stateStored = editor.state.storedMarks;
  const ok = runFormatCommand(editor, (tr) =>
    mutateFormatting(tr, 'clear', null, stateStored),
  );
  if (editor.state.selection.empty) pinCursorMarks(editor, storedMarksFor(editor, null));
  return ok;
}

/**
 * 把取样套到当前选区。
 * 返回 false 表示落点不能刷（代码块等），调用方应保持格式刷武装。
 * 落点合法但样式没变化时仍返回 true，单次模式可以收起。
 */
export function applyCapturedFormat(editor: Editor, format: CapturedFormat): boolean {
  if (!editor.isEditable) return false;
  const { selection, doc } = editor.state;
  if (!canPaint(doc, selection.from, selection.to)) return false;
  const stateStored = editor.state.storedMarks;
  runFormatCommand(editor, (tr) =>
    mutateFormatting(tr, 'paint', format, stateStored),
  );
  if (editor.state.selection.empty) {
    pinCursorMarks(editor, storedMarksFor(editor, format.marks));
  }
  return true;
}
