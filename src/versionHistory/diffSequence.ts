export type SeqOp<T> =
  | { type: 'equal'; a: T; b: T }
  | { type: 'delete'; a: T }
  | { type: 'insert'; b: T };

export type Aligned<T> =
  | { op: 'same'; base: T; target: T }
  | { op: 'change'; base: T; target: T }
  | { op: 'insert'; target: T }
  | { op: 'delete'; base: T };

/**
 * Myers 最短编辑脚本（E. Myers, 1986）。时间与编辑距离 D 成正比。
 * 两段几乎相同时接近线性；D 超过 `maxD` 时放弃，调用方整段替换，
 * 避免一篇被改写的长段退回二次型。
 */
export function diffSeq<T>(
  a: T[],
  b: T[],
  eq: (x: T, y: T) => boolean,
  maxD = a.length + b.length,
): SeqOp<T>[] | null {
  const n = a.length;
  const m = b.length;
  if (n === 0 && m === 0) return [];
  if (maxD < 0) return null;
  if (n === 0) return b.map((item) => ({ type: 'insert' as const, b: item }));
  if (m === 0) return a.map((item) => ({ type: 'delete' as const, a: item }));

  const bound = Math.min(maxD, n + m);
  const offset = n + m;
  const size = 2 * offset + 1;
  const v = new Int32Array(size);
  v.fill(-1);
  v[offset + 1] = 0;
  const trace: Int32Array[] = [];

  for (let d = 0; d <= bound; d += 1) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      const index = offset + k;
      const x =
        k === -d || (k !== d && v[index - 1] < v[index + 1])
          ? v[index + 1]
          : v[index - 1] + 1;
      let xx = x;
      let y = xx - k;
      while (xx < n && y < m && eq(a[xx], b[y])) {
        xx += 1;
        y += 1;
      }
      v[index] = xx;
      if (xx >= n && y >= m) return backtrack(trace, a, b, d, offset);
    }
  }
  return null;
}

function backtrack<T>(
  trace: Int32Array[],
  a: T[],
  b: T[],
  d: number,
  offset: number,
): SeqOp<T>[] {
  const out: SeqOp<T>[] = [];
  let x = a.length;
  let y = b.length;
  for (let depth = d; depth >= 0; depth -= 1) {
    const v = trace[depth];
    const k = x - y;
    const index = offset + k;
    const prevK =
      k === -depth || (k !== depth && v[index - 1] < v[index + 1]) ? k + 1 : k - 1;
    const prevX = v[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      out.push({ type: 'equal', a: a[x - 1], b: b[y - 1] });
      x -= 1;
      y -= 1;
    }
    if (depth === 0) break;
    if (x === prevX) {
      out.push({ type: 'insert', b: b[y - 1] });
      y -= 1;
    } else {
      out.push({ type: 'delete', a: a[x - 1] });
      x -= 1;
    }
  }
  out.reverse();
  return out;
}

/**
 * 先按严格相等做 Myers，再把中间成片的删和增按 pairable 配成「同一块的内部对比」。
 * 配的时候保持两边的先后，避免把后面的段落拉去跟前面的配。
 * 编辑距离过大时整段当成替换。
 */
export function alignSeq<T>(
  base: T[],
  target: T[],
  eq: (a: T, b: T) => boolean,
  pairable: (a: T, b: T) => boolean,
  maxD?: number,
): Aligned<T>[] {
  const ops = diffSeq(base, target, eq, maxD);
  if (!ops) {
    return [
      ...base.map((item) => ({ op: 'delete' as const, base: item })),
      ...target.map((item) => ({ op: 'insert' as const, target: item })),
    ];
  }
  const result: Aligned<T>[] = [];
  let index = 0;
  while (index < ops.length) {
    const op = ops[index];
    if (op.type === 'equal') {
      result.push({ op: 'same', base: op.a, target: op.b });
      index += 1;
      continue;
    }
    const deleted: T[] = [];
    const inserted: T[] = [];
    while (index < ops.length && ops[index].type !== 'equal') {
      const next = ops[index];
      if (next.type === 'delete') deleted.push(next.a);
      else if (next.type === 'insert') inserted.push(next.b);
      index += 1;
    }
    result.push(...pairHunk(deleted, inserted, pairable));
  }
  return result;
}

function pairHunk<T>(
  deleted: T[],
  inserted: T[],
  pairable: (a: T, b: T) => boolean,
): Aligned<T>[] {
  const out: Aligned<T>[] = [];
  let i = 0;
  let j = 0;
  while (i < deleted.length && j < inserted.length) {
    if (pairable(deleted[i], inserted[j])) {
      out.push({ op: 'change', base: deleted[i], target: inserted[j] });
      i += 1;
      j += 1;
      continue;
    }
    const laterInsert = inserted.slice(j + 1).some((item) => pairable(deleted[i], item));
    const laterDelete = deleted.slice(i + 1).some((item) => pairable(item, inserted[j]));
    if (laterInsert && !laterDelete) {
      out.push({ op: 'insert', target: inserted[j] });
      j += 1;
      continue;
    }
    out.push({ op: 'delete', base: deleted[i] });
    i += 1;
  }
  while (i < deleted.length) out.push({ op: 'delete', base: deleted[i++] });
  while (j < inserted.length) out.push({ op: 'insert', target: inserted[j++] });
  return out;
}
