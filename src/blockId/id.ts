import { customAlphabet } from 'nanoid';

/**
 * 块 ID 的 markdown 表示（RFC §7.1 / 决策 block-id-anchoring）：
 *
 * ```
 * <!--b:b_7fK2pQx9Lm-->
 * ## 章节标题
 * ```
 *
 * ID 注释是**块边界外**的前置独立行，图表配置注释（`<!-- {...} -->`）是块**内容**
 * 里的注释，两者位置不同、互不冲突。正文渲染 / 导出时剥离，AI 上下文保留。
 */
export const BLOCK_ID_ATTR = 'blockId';

/** ID 只允许字母 / 数字 / 下划线——与解析正则 `[A-Za-z0-9_]+` 同一口径。 */
const BLOCK_ID_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_';
const BLOCK_ID_RANDOM_LENGTH = 10;
const BLOCK_ID_PREFIX = 'b_';

const nanoBlockId = customAlphabet(BLOCK_ID_ALPHABET, BLOCK_ID_RANDOM_LENGTH);

/** 新块 ID：`b_` + nanoid(10)。 */
export function createBlockId(): string {
  return `${BLOCK_ID_PREFIX}${nanoBlockId()}`;
}

const VALID_BLOCK_ID = /^[A-Za-z0-9_]+$/;

/** 合法 ID 原样返回；非字符串 / 含非法字符返回 null。 */
export function normalizeBlockId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return VALID_BLOCK_ID.test(value) ? value : null;
}

/**
 * 行首独立 ID 注释行（RFC：`^<!--b:([A-Za-z0-9_]+)-->\s*$`）。
 * 允许 CommonMark 顶层块最多 3 个前导空格；4 空格起是缩进代码块，不认。
 */
export const BLOCK_ID_LINE_RE = /^ {0,3}<!--b:([A-Za-z0-9_]+)-->[ \t]*$/;

/** 序列化输出的一行（不含换行）。 */
export function formatBlockIdLine(id: string): string {
  return `<!--b:${id}-->`;
}

/** 读一行独立 ID 注释；不是注释行返回 null。 */
export function readBlockIdLine(line: string): string | null {
  const match = BLOCK_ID_LINE_RE.exec(line);
  return match ? match[1] : null;
}

/**
 * 剥掉所有「行首独立 `<!--b:...-->` 行」，其余注释（图表配置等）原样保留。
 *
 * 只认 fence 之外的行：代码块里的伪注释是内容，不能删。fence 用 CommonMark 的
 * ``` / ~~~ 规则跟踪（同一字符、闭合长度不短于开启长度）。缩进 4 格起的行是
 * 缩进代码块，`BLOCK_ID_LINE_RE` 本身就不匹配。
 *
 * 用途：保存侧内容比对基线（RFC §7.2）、正文静态渲染与版本 diff 的输入清洗。
 */
export function stripBlockIdComments(markdown: string): string {
  if (!markdown) return markdown;

  const lines = markdown.split(/\r?\n/);
  const kept: string[] = [];
  let fence: { char: string; length: number } | null = null;

  for (const line of lines) {
    if (fence) {
      kept.push(line);
      const closing = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (
        closing &&
        closing[1][0] === fence.char &&
        closing[1].length >= fence.length
      ) {
        fence = null;
      }
      continue;
    }

    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (opening && !(opening[1][0] === '`' && opening[2].includes('`'))) {
      fence = { char: opening[1][0], length: opening[1].length };
      kept.push(line);
      continue;
    }

    if (BLOCK_ID_LINE_RE.test(line)) continue;
    kept.push(line);
  }

  return kept.join('\n');
}
