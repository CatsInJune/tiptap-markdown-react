import type {
  JSONContent,
  MarkdownParseHelpers,
  MarkdownToken,
} from '@tiptap/core';
import { Extension } from '@tiptap/core';
import { BLOCK_ID_ATTR, normalizeBlockId } from './id';

/**
 * 解析期的块 ID 占位节点类型。它只存在于 `MarkdownManager.parse` 返回 JSON 的
 * 中间态：`BlockIdMarkdownManager` 会把 ID 转移给下一个顶层块并删掉占位，
 * 永远不会进入 ProseMirror schema / 文档。
 */
export const BLOCK_ID_MARKER_TYPE = 'tmrBlockIdMarker';

/** 自定义标记 token 名（与扩展的 `markdownTokenName` 保持一致）。 */
const BLOCK_ID_TOKEN = 'tmrBlockId';

/**
 * 认领「行首独立 `<!--b:id-->` 行」的 marked block tokenizer。
 *
 * 只吃掉这一行、不预读后面的块：解析映射由 manager 里一次线性后处理完成，
 * 避免每遇到一个 ID 就把剩余全文重新 lex 一遍（大文档下是平方级）。
 */
export const BlockIdMarkdownTokenizer = Extension.create({
  name: 'blockIdMarkdown',

  markdownTokenName: BLOCK_ID_TOKEN,

  markdownTokenizer: {
    name: BLOCK_ID_TOKEN,
    level: 'block',
    /**
     * 必须显式提供：Tiptap 对没有 start 的 tokenizer 会生成一个「新建 Lexer 试跑」
     * 的兜底 start，而 marked 的 Tokenizer 实例在多个 Lexer 间共享，新建 Lexer
     * 会把 tokenizer.lexer 指到新实例上，之后正文段落的 inline 队列就填错了。
     *
     * marked 传入的是 `src.slice(1)`（当前块的第二个字符起），所以这里**只能**认
     * 「前面确有换行」的匹配：不能用 `^`，否则 `x<!--b:...-->` 这种行内注释会被
     * 误判成行首独立行（RFC §7.1 要求顶层行首）。
     */
    start(src: string) {
      const match = /\n {0,3}<!--b:[A-Za-z0-9_]+-->[ \t]*(?:\r?\n|$)/.exec(
        src,
      );
      return match ? match.index + 1 : -1;
    },
    tokenize(src: string) {
      const match = /^ {0,3}<!--b:([A-Za-z0-9_]+)-->[ \t]*(?:\r?\n|$)/.exec(
        src,
      );
      if (!match) return undefined;
      return {
        type: BLOCK_ID_TOKEN,
        raw: match[0],
        id: match[1],
      };
    },
  },

  parseMarkdown: (token: MarkdownToken, _helpers: MarkdownParseHelpers) => {
    const id = normalizeBlockId(token.id);
    if (!id) return [];
    return {
      type: BLOCK_ID_MARKER_TYPE,
      attrs: { [BLOCK_ID_ATTR]: id },
    } satisfies JSONContent;
  },
});
