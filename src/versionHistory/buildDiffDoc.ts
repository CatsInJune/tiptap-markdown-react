import type { Mark, Node } from '@tiptap/pm/model';
import type { SourceRef } from '../citationUtils';
import { alignSeq, diffSeq, type Aligned } from './diffSequence';
import { parseVersionDoc } from './schema';

export type DiffKind = 'insert' | 'delete';

const ATOMIC = new Set([
  'codeBlock',
  'table',
  'chart',
  'blockMath',
  'image',
  'horizontalRule',
]);
const LISTS = new Set(['bulletList', 'orderedList', 'taskList']);
/** 短于这个长度的块，Myers 本身很便宜，不必先判「整段改写」。 */
const REWRITE_MIN = 80;
const REWRITE_SAMPLE = 24;

interface WordSegmenter {
  segment(input: string): Iterable<{ segment: string }>;
}

const SegmenterCtor = (
  Intl as typeof Intl & {
    Segmenter?: new (locales: string, options: { granularity: 'word' }) => WordSegmenter;
  }
).Segmenter;

const segmenter = SegmenterCtor ? new SegmenterCtor('zh-CN', { granularity: 'word' }) : null;

interface Piece {
  text: string;
  marks: readonly Mark[];
  /** 在所属文档里的起点。比较对象一侧的坐标不会拿去画装饰。 */
  from: number;
  to: number;
  atom?: Node;
}

interface Positioned {
  node: Node;
  pos: number;
}

interface TextUnit extends Positioned {
  kind: 'text';
  type: string;
  level: number | null;
  pieces: Piece[];
  plain: string;
}

interface AtomicUnit extends Positioned {
  kind: 'atomic';
  type: string;
  hash: string;
}

interface ItemUnit extends Positioned {
  kind: 'item';
  type: string;
  children: BlockUnit[];
  plain: string;
}

interface ListUnit extends Positioned {
  kind: 'list';
  type: string;
  items: ItemUnit[];
}

interface ContainerUnit extends Positioned {
  kind: 'container';
  type: string;
  summary: Piece[];
  children: BlockUnit[];
}

type BlockUnit = TextUnit | AtomicUnit | ListUnit | ContainerUnit;

/** 画在选中版上的一处差异。delete 的 from === to，是小组件的插入点。 */
export interface VersionDiffMark {
  diff: DiffKind;
  text: string;
  from: number;
  to: number;
  /** 整块增删（段落、代码块、表格、图表），而不是块里的几个词。 */
  block: boolean;
  type: string;
}

/**
 * 选中版相对比较对象的差异。坐标都在 `selected` 这篇文档上。
 * 纯文本已经相同的块不会再做词级比较。
 */
export function diffVersions(selected: Node, other: Node): VersionDiffMark[] {
  const target = collectBlocks(selected, 0);
  const base = collectBlocks(other, 0);
  return renderAligned(alignBlocks(stripTrailingEmpty(base), stripTrailingEmpty(target)), 0);
}

export function diffAnnotations(
  selected: string,
  other: string,
  sources?: SourceRef[],
): { diff: DiffKind; text: string }[] {
  return diffVersions(parseVersionDoc(selected, sources), parseVersionDoc(other, sources)).map(
    (mark) => ({ diff: mark.diff, text: mark.text }),
  );
}

function collectBlocks(node: Node, contentStart: number): BlockUnit[] {
  const units: BlockUnit[] = [];
  node.forEach((child, offset) => {
    const unit = blockFrom(child, contentStart + offset);
    if (unit) units.push(unit);
  });
  return units;
}

function blockFrom(node: Node, pos: number): BlockUnit | null {
  const name = node.type.name;
  if (ATOMIC.has(name)) {
    return { kind: 'atomic', type: name, hash: atomHash(node), node, pos };
  }
  if (LISTS.has(name)) return listFrom(node, pos);
  if (name === 'blockquote') {
    return {
      kind: 'container',
      type: name,
      node,
      pos,
      summary: [],
      children: collectBlocks(node, pos + 1),
    };
  }
  if (name === 'details') return detailsFrom(node, pos);
  if (name === 'paragraph' || name === 'heading') return textFrom(node, pos);
  return { kind: 'atomic', type: name, hash: atomHash(node), node, pos };
}

function textFrom(node: Node, pos: number): TextUnit {
  const pieces = piecesFrom(node, pos);
  return {
    kind: 'text',
    type: node.type.name,
    level: node.type.name === 'heading' ? Number(node.attrs.level ?? 1) : null,
    node,
    pos,
    pieces,
    plain: pieces.map((piece) => piece.text).join(''),
  };
}

function listFrom(node: Node, pos: number): ListUnit {
  const items: ItemUnit[] = [];
  node.forEach((child, offset) => {
    const childPos = pos + 1 + offset;
    items.push({
      kind: 'item',
      type: child.type.name,
      node: child,
      pos: childPos,
      children: collectBlocks(child, childPos + 1),
      plain: child.textContent,
    });
  });
  return { kind: 'list', type: node.type.name, node, pos, items };
}

function detailsFrom(node: Node, pos: number): ContainerUnit {
  let summary: Piece[] = [];
  let children: BlockUnit[] = [];
  node.forEach((child, offset) => {
    const childPos = pos + 1 + offset;
    if (child.type.name === 'detailsSummary') summary = piecesFrom(child, childPos);
    else if (child.type.name === 'detailsContent') children = collectBlocks(child, childPos + 1);
  });
  return { kind: 'container', type: 'details', node, pos, summary, children };
}

function piecesFrom(node: Node, pos: number): Piece[] {
  if (node.isText) return tokenize(node.text ?? '', node.marks, pos);
  const pieces: Piece[] = [];
  const origin = pos + 1;
  node.forEach((child, offset) => {
    const childPos = origin + offset;
    if (child.isText) {
      pieces.push(...tokenize(child.text ?? '', child.marks, childPos));
      return;
    }
    if (child.isAtom || child.isInline) {
      pieces.push({
        text: atomKey(child),
        marks: child.marks,
        atom: child,
        from: childPos,
        to: childPos + child.nodeSize,
      });
      return;
    }
    pieces.push(...piecesFrom(child, childPos));
  });
  return pieces;
}

/** 西文和中文都按词。词边界来自 Intl.Segmenter，不再把每个汉字拆成一格。 */
function tokenize(text: string, marks: readonly Mark[], pos: number): Piece[] {
  if (!text) return [];
  const pieces: Piece[] = [];
  if (!segmenter) {
    pieces.push({ text, marks, from: pos, to: pos + text.length });
    return pieces;
  }
  let local = 0;
  for (const part of segmenter.segment(text)) {
    const segment = part.segment;
    if (!segment) continue;
    const from = pos + local;
    local += segment.length;
    pieces.push({ text: segment, marks, from, to: pos + local });
  }
  return pieces;
}

function atomKey(node: Node): string {
  return `\u0000${atomHash(node)}`;
}

function atomHash(node: Node): string {
  const attrs = node.attrs ?? {};
  const bits = [node.type.name, node.textContent];
  for (const key of ['src', 'language', 'index', 'alt']) {
    const value = attrs[key];
    if (value != null && value !== '') bits.push(String(value));
  }
  return bits.join('\u0001');
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
    return a.level === b.level && !rewritten(a.plain, b.plain);
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
  return !rewritten(a.plain, b.plain);
}

/** 长度和首尾抽样都不像同一段时，整块替换，不再跑词级 Myers。 */
function rewritten(a: string, b: string): boolean {
  const max = Math.max(a.length, b.length);
  if (max < REWRITE_MIN) return false;
  const min = Math.min(a.length, b.length);
  if (min === 0 || min / max < 0.35) return true;
  const head = a.slice(0, REWRITE_SAMPLE) === b.slice(0, REWRITE_SAMPLE);
  const tail = a.slice(-REWRITE_SAMPLE) === b.slice(-REWRITE_SAMPLE);
  if (head || tail) return false;
  const mid = Math.floor(max / 2);
  const sample = REWRITE_SAMPLE / 2;
  return a.slice(mid - sample, mid + sample) !== b.slice(mid - sample, mid + sample);
}

function plainPieces(pieces: Piece[]): string {
  return pieces.map((piece) => piece.text).join('');
}

function renderAligned(aligned: Aligned<BlockUnit>[], fallback: number): VersionDiffMark[] {
  const out: VersionDiffMark[] = [];
  let cursor = fallback;
  for (const item of aligned) {
    if (item.op === 'insert') {
      out.push(...insertMarks(item.target));
      cursor = after(item.target);
      continue;
    }
    if (item.op === 'delete') {
      out.push(blockMark(item.base, 'delete', cursor));
      continue;
    }
    if (item.op === 'same') {
      cursor = after(item.target);
      continue;
    }
    out.push(...renderPair(item.base, item.target));
    cursor = after(item.target);
  }
  return out;
}

function renderPair(base: BlockUnit, target: BlockUnit): VersionDiffMark[] {
  if (base.kind === 'text' && target.kind === 'text') return renderText(target, base);
  if (base.kind === 'list' && target.kind === 'list') return renderList(target, base);
  if (base.kind === 'container' && target.kind === 'container') return renderContainer(target, base);
  return [];
}

function renderText(target: TextUnit, base: TextUnit | null): VersionDiffMark[] {
  if (!base || base.plain === target.plain) return [];
  const words = wordDiff(base.pieces, target.pieces, target.pos + target.node.nodeSize - 1);
  if (words) return words;
  return [blockMark(base, 'delete', target.pos), ...insertMarks(target)];
}

function wordMaxD(n: number, m: number): number {
  return Math.max(32, Math.ceil(Math.max(n, m) * 0.5));
}

function wordDiff(base: Piece[], target: Piece[], endPos: number): VersionDiffMark[] | null {
  const ops = diffSeq(base, target, (a, b) => a.text === b.text, wordMaxD(base.length, target.length));
  if (!ops) return null;
  const out: VersionDiffMark[] = [];
  let cursor = target[0]?.from ?? endPos;
  let deleted = '';
  let deleteAt = cursor;
  const flush = () => {
    if (!deleted) return;
    out.push({
      diff: 'delete',
      text: deleted,
      from: deleteAt,
      to: deleteAt,
      block: false,
      type: 'text',
    });
    deleted = '';
  };
  for (const op of ops) {
    if (op.type === 'delete') {
      if (!deleted) deleteAt = cursor;
      deleted += op.a.text;
      continue;
    }
    flush();
    if (op.type === 'insert') {
      if (op.b.text.trim()) {
        out.push({
          diff: 'insert',
          text: op.b.text,
          from: op.b.from,
          to: op.b.to,
          block: false,
          type: 'text',
        });
      }
      cursor = op.b.to;
      continue;
    }
    cursor = op.b.to;
  }
  flush();
  return out;
}

function renderList(target: ListUnit, base: ListUnit): VersionDiffMark[] {
  const aligned = alignSeq(base.items, target.items, itemEqual, itemPairable);
  const out: VersionDiffMark[] = [];
  let cursor = target.pos + 1;
  for (const item of aligned) {
    if (item.op === 'insert') {
      out.push(...insertMarks(item.target));
      cursor = after(item.target);
      continue;
    }
    if (item.op === 'delete') {
      out.push(blockMark(item.base, 'delete', cursor));
      continue;
    }
    if (item.op === 'same') {
      cursor = after(item.target);
      continue;
    }
    out.push(...renderAligned(alignBlocks(item.base.children, item.target.children), item.target.pos + 1));
    cursor = after(item.target);
  }
  return out;
}

function renderContainer(target: ContainerUnit, base: ContainerUnit): VersionDiffMark[] {
  const out: VersionDiffMark[] = [];
  if (target.type === 'details') {
    const summary = wordDiff(base.summary, target.summary, target.pos + 1);
    if (summary) out.push(...summary);
  }
  out.push(...renderAligned(alignBlocks(base.children, target.children), target.pos + 1));
  return out;
}

/** 文字块只高亮字，避免把整行列表项涂成通栏。代码块、表格、图表仍整块标。 */
function insertMarks(unit: BlockUnit | ItemUnit): VersionDiffMark[] {
  if (unit.kind === 'text') {
    const first = unit.pieces[0];
    const last = unit.pieces[unit.pieces.length - 1];
    if (!first || !last) return [];
    return [{
      diff: 'insert',
      text: unit.node.textContent,
      from: first.from,
      to: last.to,
      block: false,
      type: unit.type,
    }];
  }
  if (unit.kind === 'list') return unit.items.flatMap((item) => insertMarks(item));
  if (unit.kind === 'item' || unit.kind === 'container') {
    return unit.children.flatMap((child) => insertMarks(child));
  }
  return [blockMark(unit, 'insert')];
}

function blockMark(unit: Positioned & { type: string; plain?: string }, diff: DiffKind, at?: number): VersionDiffMark {
  const text = unit.node.textContent;
  if (diff === 'delete') {
    const pos = at ?? unit.pos;
    return { diff, text, from: pos, to: pos, block: true, type: unit.type };
  }
  return {
    diff,
    text,
    from: unit.pos,
    to: unit.pos + unit.node.nodeSize,
    block: true,
    type: unit.type,
  };
}

function after(unit: Positioned): number {
  return unit.pos + unit.node.nodeSize;
}
