import type { Mark, Node } from '@tiptap/pm/model';
import { Fragment } from '@tiptap/pm/model';
import type { SourceRef } from '../citationUtils';
import { alignSeq, lcsLength, type Aligned } from './diffSequence';
import { getVersionSchema, parseVersionDoc } from './schema';

export type DiffKind = 'insert' | 'delete' | 'format';

const ATOMIC = new Set([
  'codeBlock',
  'table',
  'chart',
  'blockMath',
  'image',
  'horizontalRule',
]);
const LISTS = new Set(['bulletList', 'orderedList', 'taskList']);
const PAIR_THRESHOLD = 0.4;

interface Piece {
  text: string;
  marks: readonly Mark[];
  atom?: Node;
}

interface TaggedPiece extends Piece {
  diff?: DiffKind;
}

interface TextUnit {
  kind: 'text';
  type: string;
  level: number | null;
  node: Node;
  pieces: Piece[];
  plain: string;
}

interface AtomicUnit {
  kind: 'atomic';
  type: string;
  hash: string;
  node: Node;
}

interface ItemUnit {
  kind: 'item';
  type: string;
  node: Node;
  children: BlockUnit[];
  plain: string;
}

interface ListUnit {
  kind: 'list';
  type: string;
  node: Node;
  items: ItemUnit[];
}

interface ContainerUnit {
  kind: 'container';
  type: string;
  node: Node;
  summary: Piece[];
  children: BlockUnit[];
}

type BlockUnit = TextUnit | AtomicUnit | ListUnit | ContainerUnit;

/**
 * 画布是所选版本（selected）。相对比较对象（other）：
 * 只在所选版本里的是插入，只在比较对象里的是删除，文字相同但标记不同的是格式变化。
 */
export function buildVersionDiffDoc(
  selected: string,
  other: string,
  sources?: SourceRef[],
): Node {
  const target = collectBlocks(parseVersionDoc(selected, sources));
  const base = collectBlocks(parseVersionDoc(other, sources));
  const blocks = renderAligned(alignBlocks(stripTrailingEmpty(base), stripTrailingEmpty(target)));
  const schema = getVersionSchema();
  return schema.nodes.doc.create(null, blocks.length ? blocks : [emptyParagraph()]);
}

export function diffAnnotations(
  selected: string,
  other: string,
): { diff: DiffKind; text: string }[] {
  const out: { diff: DiffKind; text: string }[] = [];
  buildVersionDiffDoc(selected, other).descendants((node) => {
    if (node.type.name === 'diffRegion') {
      const diff = node.attrs.diff;
      if (diff === 'insert' || diff === 'delete' || diff === 'format') {
        out.push({ diff, text: node.textContent });
      }
      return false;
    }
    if (!node.isText) return;
    const mark = node.marks.find((item) => DIFF_MARK_NAMES.has(item.type.name));
    if (!mark) return;
    const diff = markName(mark.type.name);
    if (diff) out.push({ diff, text: node.text ?? '' });
  });
  return out;
}

const DIFF_MARK_NAMES = new Set(['diffInsert', 'diffDelete', 'diffFormat']);

function markName(name: string): DiffKind | null {
  if (name === 'diffInsert') return 'insert';
  if (name === 'diffDelete') return 'delete';
  if (name === 'diffFormat') return 'format';
  return null;
}

function collectBlocks(node: Node): BlockUnit[] {
  const units: BlockUnit[] = [];
  node.forEach((child) => {
    const unit = blockFrom(child);
    if (unit) units.push(unit);
  });
  return units;
}

function blockFrom(node: Node): BlockUnit | null {
  const name = node.type.name;
  if (ATOMIC.has(name)) {
    return { kind: 'atomic', type: name, hash: JSON.stringify(node.toJSON()), node };
  }
  if (LISTS.has(name)) return listFrom(node);
  if (name === 'blockquote') {
    return { kind: 'container', type: name, node, summary: [], children: collectBlocks(node) };
  }
  if (name === 'details') return detailsFrom(node);
  if (name === 'paragraph' || name === 'heading') return textFrom(node);
  return { kind: 'atomic', type: name, hash: JSON.stringify(node.toJSON()), node };
}

function textFrom(node: Node): TextUnit {
  const pieces = piecesFrom(node);
  return {
    kind: 'text',
    type: node.type.name,
    level: node.type.name === 'heading' ? Number(node.attrs.level ?? 1) : null,
    node,
    pieces,
    plain: pieces.map((piece) => piece.text).join(''),
  };
}

function listFrom(node: Node): ListUnit {
  const items: ItemUnit[] = [];
  node.forEach((child) => {
    const children = collectBlocks(child);
    items.push({
      kind: 'item',
      type: child.type.name,
      node: child,
      children,
      plain: child.textContent,
    });
  });
  return { kind: 'list', type: node.type.name, node, items };
}

function detailsFrom(node: Node): ContainerUnit {
  let summary: Piece[] = [];
  let children: BlockUnit[] = [];
  node.forEach((child) => {
    if (child.type.name === 'detailsSummary') summary = piecesFrom(child);
    else if (child.type.name === 'detailsContent') children = collectBlocks(child);
  });
  return { kind: 'container', type: 'details', node, summary, children };
}

function piecesFrom(node: Node): Piece[] {
  const pieces: Piece[] = [];
  node.forEach((child) => {
    if (child.isText) {
      pieces.push(...tokenize(child.text ?? '', child.marks));
      return;
    }
    if (child.isAtom || child.isInline) {
      pieces.push({ text: atomKey(child), marks: child.marks, atom: child });
      return;
    }
    pieces.push(...piecesFrom(child));
  });
  return pieces;
}

/** 西文按词，中文和标点按字，空白单独成词，这样段内插删能落到词上。 */
function tokenize(text: string, marks: readonly Mark[]): Piece[] {
  const pieces: Piece[] = [];
  let ascii = '';
  const flush = () => {
    if (!ascii) return;
    pieces.push({ text: ascii, marks });
    ascii = '';
  };
  for (const ch of text) {
    if (/[A-Za-z0-9]/.test(ch)) {
      ascii += ch;
      continue;
    }
    flush();
    pieces.push({ text: ch, marks });
  }
  flush();
  return pieces;
}

function atomKey(node: Node): string {
  return `\u0000${node.type.name}\u0000${JSON.stringify(node.attrs)}`;
}

function stripTrailingEmpty(units: BlockUnit[]): BlockUnit[] {
  const next = [...units];
  while (next.length > 1 && isEmptyParagraph(next[next.length - 1])) next.pop();
  return next;
}

function isEmptyParagraph(unit: BlockUnit): boolean {
  return unit.kind === 'text' && unit.type === 'paragraph' && unit.plain === '';
}

function alignBlocks(base: BlockUnit[], target: BlockUnit[]): Aligned<BlockUnit>[] {
  return alignSeq(base, target, blockEqual, blockPairable);
}

function blockEqual(a: BlockUnit, b: BlockUnit): boolean {
  if (a.kind !== b.kind || a.type !== b.type) return false;
  if (a.kind === 'text' && b.kind === 'text') return a.level === b.level && a.plain === b.plain;
  if (a.kind === 'atomic' && b.kind === 'atomic') return a.hash === b.hash;
  if (a.kind === 'list' && b.kind === 'list') {
    if (a.items.length !== b.items.length) return false;
    return a.items.every((item, index) => itemEqual(item, b.items[index]));
  }
  if (a.kind === 'container' && b.kind === 'container') {
    if (plainPieces(a.summary) !== plainPieces(b.summary)) return false;
    if (a.children.length !== b.children.length) return false;
    return a.children.every((child, index) => blockEqual(child, b.children[index]));
  }
  return false;
}

function blockPairable(a: BlockUnit, b: BlockUnit): boolean {
  if (a.kind !== b.kind || a.type !== b.type) return false;
  if (a.kind === 'atomic') return false;
  if (a.kind === 'text' && b.kind === 'text') {
    return a.level === b.level && pieceSimilarity(a.pieces, b.pieces) >= PAIR_THRESHOLD;
  }
  return true;
}

function itemEqual(a: ItemUnit, b: ItemUnit): boolean {
  if (a.type !== b.type || a.plain !== b.plain) return false;
  if (a.children.length !== b.children.length) return false;
  return a.children.every((child, index) => blockEqual(child, b.children[index]));
}

function itemPairable(a: ItemUnit, b: ItemUnit): boolean {
  if (a.type !== b.type) return false;
  return pieceSimilarity(tokenize(a.plain, []), tokenize(b.plain, [])) >= PAIR_THRESHOLD;
}

function pieceSimilarity(a: Piece[], b: Piece[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return lcsLength(a.map((piece) => piece.text), b.map((piece) => piece.text)) / max;
}

function plainPieces(pieces: Piece[]): string {
  return pieces.map((piece) => piece.text).join('');
}

function renderAligned(aligned: Aligned<BlockUnit>[]): Node[] {
  return aligned.map((item) => {
    if (item.op === 'insert') return renderWhole(item.target, 'insert');
    if (item.op === 'delete') return renderWhole(item.base, 'delete');
    return renderPair(item.base, item.target);
  });
}

function renderWhole(unit: BlockUnit, diff: 'insert' | 'delete'): Node {
  if (unit.kind === 'text') return renderText(unit, null, diff);
  if (unit.kind === 'atomic') return wrap(unit.node, diff);
  if (unit.kind === 'list') return wrap(unit.node, diff);
  return wrap(unit.node, diff);
}

function renderPair(base: BlockUnit, target: BlockUnit): Node {
  if (base.kind === 'text' && target.kind === 'text') return renderText(target, base);
  if (base.kind === 'list' && target.kind === 'list') return renderList(target, base);
  if (base.kind === 'container' && target.kind === 'container') return renderContainer(target, base);
  return target.node;
}

function renderText(target: TextUnit, base: TextUnit | null, whole?: 'insert' | 'delete'): Node {
  const tagged: TaggedPiece[] = !base || whole
    ? target.pieces.map((piece) => ({ ...piece, diff: whole }))
    : wordDiff(base.pieces, target.pieces);
  const content = piecesToNodes(tagged);
  return getVersionSchema().nodes[target.type].create(target.node.attrs, content);
}

/** 只标文字的增删。加粗、颜色、对齐这类标记变化不单独高亮。 */
function wordDiff(base: Piece[], target: Piece[]): TaggedPiece[] {
  const ops = alignSeq(base, target, (a, b) => a.text === b.text, () => false);
  const out: TaggedPiece[] = [];
  for (const op of ops) {
    if (op.op === 'insert') {
      out.push({ ...op.target, diff: 'insert' });
      continue;
    }
    if (op.op === 'delete') {
      out.push({ ...op.base, diff: 'delete' });
      continue;
    }
    out.push({ ...op.target });
  }
  return out;
}

function renderList(target: ListUnit, base: ListUnit): Node {
  const aligned = alignSeq(base.items, target.items, itemEqual, itemPairable);
  const items = aligned.map((item) => {
    if (item.op === 'insert') return renderItem(item.target, null, 'insert');
    if (item.op === 'delete') return renderItem(item.base, null, 'delete');
    return renderItem(item.target, item.base);
  });
  return getVersionSchema().nodes[target.type].create(target.node.attrs, fit(target.type, items));
}

function renderItem(target: ItemUnit, base: ItemUnit | null, whole?: 'insert' | 'delete'): Node {
  const children = !base || whole
    ? target.children.map((child) => renderWhole(child, whole ?? 'insert'))
    : renderAligned(alignBlocks(base.children, target.children));
  return getVersionSchema().nodes[target.type].create(
    target.node.attrs,
    fit(target.type, children),
  );
}

function renderContainer(target: ContainerUnit, base: ContainerUnit): Node {
  const schema = getVersionSchema();
  if (target.type === 'details') {
    const summary = renderSummary(wordDiff(base.summary, target.summary));
    const inner = renderAligned(alignBlocks(base.children, target.children));
    const content = schema.nodes.detailsContent.create(null, fit('detailsContent', inner));
    return schema.nodes.details.create(target.node.attrs, [summary, content]);
  }
  const inner = renderAligned(alignBlocks(base.children, target.children));
  return schema.nodes.blockquote.create(target.node.attrs, fit('blockquote', inner));
}

function renderSummary(pieces: TaggedPiece[]): Node {
  const textOnly = pieces.map((piece) => {
    if (!piece.atom) return piece;
    return { ...piece, atom: undefined, text: piece.atom.textContent || piece.atom.type.name };
  });
  return getVersionSchema().nodes.detailsSummary.create(null, piecesToNodes(textOnly));
}

function wrap(node: Node, diff: 'insert' | 'delete'): Node {
  return getVersionSchema().nodes.diffRegion.create({ diff }, node);
}

function piecesToNodes(pieces: TaggedPiece[]): Node[] {
  const schema = getVersionSchema();
  const nodes: Node[] = [];
  for (const piece of pieces) {
    const marks = withDiff(piece.marks, piece.diff);
    if (piece.atom) {
      const diffMark = piece.diff ? schema.marks[diffMarkName(piece.diff)] : null;
      if (diffMark && piece.atom.type.allowsMarkType(diffMark)) {
        nodes.push(piece.atom.mark(marks));
      } else if (piece.diff) {
        pushText(nodes, piece.atom.textContent || piece.atom.type.name, marks);
      } else {
        nodes.push(piece.atom);
      }
      continue;
    }
    pushText(nodes, piece.text, marks);
  }
  return nodes;
}

function pushText(nodes: Node[], text: string, marks: readonly Mark[]): void {
  if (!text) return;
  const schema = getVersionSchema();
  const last = nodes[nodes.length - 1];
  if (last?.isText && marksKey(last.marks) === marksKey(marks)) {
    nodes[nodes.length - 1] = schema.text((last.text ?? '') + text, marks);
    return;
  }
  nodes.push(schema.text(text, marks));
}

function withDiff(marks: readonly Mark[], diff?: DiffKind): readonly Mark[] {
  const kept = marks.filter((mark) => !DIFF_MARK_NAMES.has(mark.type.name));
  if (!diff) return kept;
  const type = getVersionSchema().marks[diffMarkName(diff)];
  return type ? [...kept, type.create()] : kept;
}

function diffMarkName(diff: DiffKind): string {
  if (diff === 'insert') return 'diffInsert';
  if (diff === 'delete') return 'diffDelete';
  return 'diffFormat';
}

function marksKey(marks: readonly Mark[]): string {
  return [...marks]
    .map((mark) => `${mark.type.name}:${JSON.stringify(mark.attrs)}`)
    .sort()
    .join('|');
}

function fit(typeName: string, nodes: Node[]): Node[] {
  const type = getVersionSchema().nodes[typeName];
  const content = nodes.length ? nodes : [emptyParagraph()];
  if (!type) return content;
  if (type.contentMatch.matchFragment(Fragment.from(content))) return content;
  const withParagraph = [emptyParagraph(), ...content];
  if (type.contentMatch.matchFragment(Fragment.from(withParagraph))) return withParagraph;
  return content;
}

function emptyParagraph(): Node {
  return getVersionSchema().nodes.paragraph.create();
}
