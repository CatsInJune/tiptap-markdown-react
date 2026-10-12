import { describe, expect, it } from 'vitest';
import { countWords } from './characterCount';

describe('countWords', () => {
  it('空串为 0', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n')).toBe(0);
  });

  it('英文按空白切词，连续空白与纯标点不计', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('  hello   world  ')).toBe(2);
    expect(countWords("it's fine")).toBe(2);
    expect(countWords('...')).toBe(0);
    expect(countWords('hello, world!')).toBe(2);
  });

  it('每个汉字算一个词，可与英文混排', () => {
    expect(countWords('你好世界')).toBe(4);
    expect(countWords('你好 world')).toBe(3);
    expect(countWords('你好，世界')).toBe(4);
  });
});
