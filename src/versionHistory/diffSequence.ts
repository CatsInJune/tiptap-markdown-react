export type SeqOp<T> =
  | { type: 'equal'; a: T; b: T }
  | { type: 'delete'; a: T }
  | { type: 'insert'; b: T };

export type Aligned<T> =
  | { op: 'same'; base: T; target: T }
  | { op: 'change'; base: T; target: T }
  | { op: 'insert'; target: T }
  | { op: 'delete'; base: T };

const MAX_CELLS = 1_000_000;

/**
 * 经典 LCS。文档块和段落里的词都不长；格子数过大时放弃对齐，整段当成替换，
 * 避免一份超长段落把面板卡死。
 */
export function diffSeq<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): SeqOp<T>[] {
  const n = a.length;
  const m = b.length;
  if (n * m > MAX_CELLS) {
    return [
      ...a.map((item) => ({ type: 'delete' as const, a: item })),
      ...b.map((item) => ({ type: 'insert' as const, b: item })),
    ];
  }
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: SeqOp<T>[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) {
      out.push({ type: 'equal', a: a[i], b: b[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'delete', a: a[i] });
      i++;
    } else {
      out.push({ type: 'insert', b: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: 'delete', a: a[i++] });
  while (j < m) out.push({ type: 'insert', b: b[j++] });
  return out;
}

export function lcsLength(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  if (a.length * b.length > MAX_CELLS) return 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  let curr = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1]);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
    curr.fill(0);
  }
  return prev[b.length];
}

/**
 * 先按严格相等做 LCS，再把中间成片的删和增按 pairable 配成「同一块的内部对比」。
 * 配的时候保持两边的先后，避免把后面的段落拉去跟前面的配。
 */
export function alignSeq<T>(
  base: T[],
  target: T[],
  eq: (a: T, b: T) => boolean,
  pairable: (a: T, b: T) => boolean,
): Aligned<T>[] {
  const ops = diffSeq(base, target, eq);
  const result: Aligned<T>[] = [];
  let index = 0;
  while (index < ops.length) {
    const op = ops[index];
    if (op.type === 'equal') {
      result.push({ op: 'same', base: op.a, target: op.b });
      index++;
      continue;
    }
    const deleted: T[] = [];
    const inserted: T[] = [];
    while (index < ops.length && ops[index].type !== 'equal') {
      const next = ops[index];
      if (next.type === 'delete') deleted.push(next.a);
      else if (next.type === 'insert') inserted.push(next.b);
      index++;
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
      i++;
      j++;
      continue;
    }
    const laterInsert = inserted.slice(j + 1).some((item) => pairable(deleted[i], item));
    const laterDelete = deleted.slice(i + 1).some((item) => pairable(item, inserted[j]));
    if (laterInsert && !laterDelete) {
      out.push({ op: 'insert', target: inserted[j] });
      j++;
      continue;
    }
    out.push({ op: 'delete', base: deleted[i] });
    i++;
  }
  while (i < deleted.length) out.push({ op: 'delete', base: deleted[i++] });
  while (j < inserted.length) out.push({ op: 'insert', target: inserted[j++] });
  return out;
}
