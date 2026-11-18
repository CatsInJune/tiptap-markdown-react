import { describe, expect, it } from 'vitest';
import {
  createFenceState,
  isFenceClosing,
  matchFenceOpening,
  stepFence,
} from './markdownFences';

function states(markdown: string) {
  const state = createFenceState();
  return markdown.split(/\r?\n/).map((line) => stepFence(state, line));
}

describe('markdownFences', () => {
  it('识别开启 / 闭合，并保持围栏内的行', () => {
    const result = states('```js\na\n```\nb');
    expect(result.map((s) => s.wasInFence)).toEqual([
      false,
      true,
      true,
      false,
    ]);
    expect(result.map((s) => s.isFenceLine)).toEqual([
      true,
      false,
      true,
      false,
    ]);
  });

  it('闭合必须同字符且不短于开启', () => {
    expect(isFenceClosing('````', '`', 3)).toBe(true);
    expect(isFenceClosing('```', '`', 4)).toBe(false);
    expect(isFenceClosing('~~~', '`', 3)).toBe(false);
    expect(isFenceClosing('```js', '`', 3)).toBe(false);
    expect(isFenceClosing('   ```   ', '`', 3)).toBe(true);
  });

  it('缩进 0–3 格可开启，4 格是缩进代码块', () => {
    expect(matchFenceOpening('   ```')).toEqual({ char: '`', length: 3 });
    expect(matchFenceOpening('    ```')).toBeNull();
  });

  it('反引号围栏的 info string 含反引号时不开启', () => {
    expect(matchFenceOpening('```a`b')).toBeNull();
    expect(matchFenceOpening('~~~a`b')).toEqual({ char: '~', length: 3 });
  });

  it('围栏内出现另一种字符不闭合', () => {
    const result = states('```\n~~~\n```');
    expect(result[1].inFence).toBe(true);
    expect(result[2].inFence).toBe(false);
  });
});
