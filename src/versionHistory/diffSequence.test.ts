import { describe, expect, it } from 'vitest';
import { diffSeq } from './diffSequence';

const text = (a: string, b: string) => a === b;

describe('Myers diffSeq', () => {
  it('相同序列没有增删', () => {
    const ops = diffSeq(['甲', '乙'], ['甲', '乙'], text);
    expect(ops?.every((op) => op.type === 'equal')).toBe(true);
  });

  it('只标出中间多出来的词', () => {
    const ops = diffSeq(['hello', 'brave', 'world'], ['hello', 'world'], text);
    expect(ops).toEqual([
      { type: 'equal', a: 'hello', b: 'hello' },
      { type: 'delete', a: 'brave' },
      { type: 'equal', a: 'world', b: 'world' },
    ]);
  });

  it('编辑距离超过上限时放弃', () => {
    expect(diffSeq(['a', 'b', 'c', 'd'], ['w', 'x', 'y', 'z'], text, 1)).toBeNull();
  });
});
