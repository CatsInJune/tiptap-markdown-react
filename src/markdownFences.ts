/**
 * CommonMark 围栏代码块的共享扫描器。
 *
 * 库里有几处都需要「这一行是否在围栏里 / 是否是围栏标记」：块 ID 剥离、
 * 脚注定义抽取、流式半成品补围栏、版本预览分块、粘贴降级分块。它们以前各写
 * 一套正则，缩进与 info string 规则并不一致；统一到这里，避免同一段 markdown
 * 在不同路径里被解释成不同的结构。
 */

export type FenceChar = '`' | '~';

export interface FenceState {
  inFence: boolean;
  char: FenceChar | null;
  /** 开启围栏的长度（闭合不得短于它）。 */
  length: number;
}

export interface FenceStep {
  /** 处理本行之前是否已经在围栏内。 */
  wasInFence: boolean;
  /** 本行本身是开启 / 闭合标记（围栏行不计入内容）。 */
  isFenceLine: boolean;
  /** 处理本行之后是否在围栏内。 */
  inFence: boolean;
}

const OPEN_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const CLOSE_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

/**
 * 本行是否是开启围栏。反引号围栏的 info string 里不能再出现反引号
 * （CommonMark：```` ```a`b ```` 只是普通段落），波浪号没有这个限制。
 */
export function matchFenceOpening(
  line: string,
): { char: FenceChar; length: number } | null {
  const match = OPEN_RE.exec(line);
  if (!match) return null;
  const marker = match[1];
  if (marker[0] === '`' && match[2].includes('`')) return null;
  return { char: marker[0] as FenceChar, length: marker.length };
}

/** 本行是否是闭合围栏：同字符、长度不短于开启、且之后只有空白。 */
export function isFenceClosing(
  line: string,
  char: FenceChar,
  length: number,
): boolean {
  const match = CLOSE_RE.exec(line);
  return !!match && match[1][0] === char && match[1].length >= length;
}

export function createFenceState(): FenceState {
  return { inFence: false, char: null, length: 0 };
}

/** 推进一行，返回这行与围栏的关系。会就地修改 `state`。 */
export function stepFence(state: FenceState, line: string): FenceStep {
  const wasInFence = state.inFence;

  if (!state.inFence) {
    const opening = matchFenceOpening(line);
    if (opening) {
      state.inFence = true;
      state.char = opening.char;
      state.length = opening.length;
      return { wasInFence, isFenceLine: true, inFence: true };
    }
    return { wasInFence, isFenceLine: false, inFence: false };
  }

  if (state.char && isFenceClosing(line, state.char, state.length)) {
    state.inFence = false;
    state.char = null;
    state.length = 0;
    return { wasInFence, isFenceLine: true, inFence: false };
  }

  return { wasInFence, isFenceLine: false, inFence: true };
}
