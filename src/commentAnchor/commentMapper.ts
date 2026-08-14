import type { Node } from '@tiptap/pm/model';
import type { CommentInterval } from './CommentMark';

/**
 * SPIKE 原型：把评论的 ref_content segments 映射到 ProseMirror doc 上的文本区间。
 *
 * 与旧 DOM textContent 匹配的区别：
 * - 工作在文档模型上（无表格 wrapper 空白 / text node 碎片问题）；
 * - 按顶层 block 作用域搜索，避免跨 block 误命中；
 * - fallback 链与既有 anchorCommentsInDom 一致：hash → context → exact → prefix → outdated。
 */

export interface CommentSegment {
  /** block 文本哈希（可选快路径；哈希算法见 blockTextHash，需与捕获端一致）。 */
  blockHash?: string;
  prefix?: string;
  exact: string;
  suffix?: string;
}

export interface CommentAnchorInput {
  commentId: string;
  segments: CommentSegment[];
}

export type CommentAnchorStatus = 'matched' | 'ambiguous' | 'partial' | 'outdated';

export interface CommentRange {
  from: number;
  to: number;
}

export interface CommentAnchorResult {
  commentId: string;
  ranges: CommentRange[];
  status: CommentAnchorStatus;
}

interface TextSlice {
  pos: number;
  text: string;
}

interface TextIndex {
  slices: TextSlice[];
  offsets: number[];
  fullText: string;
}

const PREFIX_FALLBACK_LEN = 20;

/** 收集 [start, end) 内所有 text 节点 + 位置，拼成可搜索的 flat text。 */
function collectText(doc: Node, start = 0, end = doc.content.size): TextIndex {
  const slices: TextSlice[] = [];
  const offsets: number[] = [];
  let cursor = 0;
  doc.nodesBetween(start, end, (node, pos) => {
    if (node.isText && node.text) {
      slices.push({ pos, text: node.text });
      offsets.push(cursor);
      cursor += node.text.length;
    }
    return true;
  });
  offsets.push(cursor);
  return {
    slices,
    offsets,
    fullText: slices.map((s) => s.text).join(''),
  };
}

function findAll(fullText: string, needle: string): number[] {
  if (!needle) return [];
  const hits: number[] = [];
  let from = 0;
  while (from <= fullText.length - needle.length) {
    const idx = fullText.indexOf(needle, from);
    if (idx < 0) break;
    hits.push(idx);
    from = idx + needle.length;
  }
  return hits;
}

/** 把 fullText 上的 [start, start+len) 映射回 doc 绝对位置。 */
function rangeAt(index: TextIndex, start: number, len: number): CommentRange | null {
  if (len <= 0) return null;
  let startIdx = -1;
  let endIdx = -1;
  for (let i = 0; i < index.slices.length; i++) {
    if (index.offsets[i] <= start && start < index.offsets[i + 1]) startIdx = i;
    const end = start + len;
    if (index.offsets[i] < end && end <= index.offsets[i + 1]) endIdx = i;
    if (startIdx >= 0 && endIdx >= 0) break;
  }
  if (startIdx < 0 || endIdx < 0) return null;
  return {
    from: index.slices[startIdx].pos + (start - index.offsets[startIdx]),
    to: index.slices[endIdx].pos + (start + len - index.offsets[endIdx]),
  };
}

/** 顶层 block 边界（doc 直接子节点）。 */
function blockBounds(doc: Node): Array<{ start: number; end: number }> {
  const bounds: Array<{ start: number; end: number }> = [];
  doc.forEach((child, offset) => {
    bounds.push({ start: offset, end: offset + child.nodeSize });
  });
  return bounds;
}

/** djb2 哈希（捕获端与消费端必须用同一个实现；invret 接入时对齐）。 */
export function blockTextHash(text: string): string {
  const normalized = text.replace(/\s+/g, '');
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 33) ^ normalized.charCodeAt(i);
  }
  return String(hash >>> 0);
}

function blockText(doc: Node, bound: { start: number; end: number }): string {
  return collectText(doc, bound.start, bound.end).fullText;
}

/** 在若干 block 内找 needle，返回命中区间；命中 >1 处标记 ambiguous。 */
function matchInBlocks(
  doc: Node,
  bounds: Array<{ start: number; end: number }>,
  needle: string,
  markLen: number,
  markOffset: number,
): { ranges: CommentRange[]; ambiguous: boolean } {
  const ranges: CommentRange[] = [];
  let hits = 0;
  for (const bound of bounds) {
    const index = collectText(doc, bound.start, bound.end);
    for (const start of findAll(index.fullText, needle)) {
      const range = rangeAt(index, start + markOffset, markLen);
      if (range) {
        ranges.push(range);
        hits += 1;
      }
    }
  }
  return { ranges, ambiguous: hits > 1 };
}

/** 单个 segment → doc 区间（fallback 链）。 */
function matchSegment(doc: Node, seg: CommentSegment): {
  ranges: CommentRange[];
  ambiguous: boolean;
} {
  const bounds = blockBounds(doc);

  // S1: blockHash 快路径
  if (seg.blockHash) {
    const ranges: CommentRange[] = [];
    let hits = 0;
    for (const bound of bounds) {
      if (blockTextHash(blockText(doc, bound)) !== seg.blockHash) continue;
      const index = collectText(doc, bound.start, bound.end);
      for (const start of findAll(index.fullText, seg.exact)) {
        const range = rangeAt(index, start, seg.exact.length);
        if (range) {
          ranges.push(range);
          hits += 1;
        }
      }
    }
    if (ranges.length > 0) return { ranges, ambiguous: hits > 1 };
  }

  // S2: 上下文（prefix+exact+suffix）定位
  if (seg.prefix || seg.suffix) {
    const composite = (seg.prefix ?? '') + seg.exact + (seg.suffix ?? '');
    const found = matchInBlocks(
      doc,
      bounds,
      composite,
      seg.exact.length,
      seg.prefix?.length ?? 0,
    );
    if (found.ranges.length > 0) return found;
  }

  // S3: block 内 exact
  const exact = matchInBlocks(doc, bounds, seg.exact, seg.exact.length, 0);
  if (exact.ranges.length > 0) return exact;

  // S4: 前缀降级（前 20 字）
  const prefix = seg.exact.slice(0, PREFIX_FALLBACK_LEN);
  if (prefix.length >= 4 && prefix !== seg.exact) {
    const fallback = matchInBlocks(doc, bounds, prefix, prefix.length, 0);
    if (fallback.ranges.length > 0) return fallback;
  }

  return { ranges: [], ambiguous: false };
}

/** 主入口：评论列表 → 每条的 doc 区间 + 状态。 */
export function mapCommentAnchors(
  doc: Node,
  comments: CommentAnchorInput[],
): CommentAnchorResult[] {
  return comments.map((c) => {
    let matchedSegments = 0;
    let ambiguousSegments = 0;
    const ranges: CommentRange[] = [];
    for (const seg of c.segments) {
      const { ranges: segRanges, ambiguous } = matchSegment(doc, seg);
      if (segRanges.length > 0) {
        matchedSegments += 1;
        if (ambiguous) ambiguousSegments += 1;
        ranges.push(...segRanges);
      }
    }
    const status: CommentAnchorStatus =
      matchedSegments === 0
        ? 'outdated'
        : ambiguousSegments > 0
          ? 'ambiguous'
          : matchedSegments < c.segments.length
            ? 'partial'
            : 'matched';
    return { commentId: c.commentId, ranges, status };
  });
}

/** 把每条评论的区间合并成互不相交的 CommentInterval（重叠区间合并 commentIds）。 */
export function mergeCommentIntervals(
  entries: Array<{ commentId: string; ranges: CommentRange[] }>,
): CommentInterval[] {
  interface Event {
    pos: number;
    delta: 1 | -1;
    id: string;
  }
  const events: Event[] = [];
  for (const e of entries) {
    // 先按评论合并相邻/接触区间（同一评论的多段 [0,2)+[2,4) 应视为连续覆盖），
    // 否则 sweep 会在接缝处错误地先关后开，产出多余分段。
    const sorted = e.ranges
      .filter((r) => r.from < r.to)
      .sort((a, b) => a.from - b.from || a.to - b.to);
    const merged: CommentRange[] = [];
    for (const r of sorted) {
      const last = merged[merged.length - 1];
      if (last && r.from <= last.to) {
        if (r.to > last.to) last.to = r.to;
      } else {
        merged.push({ from: r.from, to: r.to });
      }
    }
    for (const r of merged) {
      events.push({ pos: r.from, delta: 1, id: e.commentId });
      events.push({ pos: r.to, delta: -1, id: e.commentId });
    }
  }
  if (events.length === 0) return [];
  events.sort((a, b) => a.pos - b.pos || a.delta - b.delta);

  const intervals: CommentInterval[] = [];
  const active = new Set<string>();
  let prevPos = events[0].pos;
  for (const ev of events) {
    if (ev.pos > prevPos && active.size > 0) {
      intervals.push({
        from: prevPos,
        to: ev.pos,
        commentIds: Array.from(active),
      });
    }
    if (ev.delta === 1) active.add(ev.id);
    else active.delete(ev.id);
    prevPos = ev.pos;
  }
  return intervals;
}
