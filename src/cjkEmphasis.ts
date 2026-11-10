import { Marked, Tokenizer, marked, type Tokens } from 'marked';

/**
 * CJK 粗体/斜体边界修复（CommonMark flanking 规则）。
 *
 * 两处都会让编辑器/预览打出字面星号，中文标点贴着强调文字时高频踩：
 *
 * 1. 闭定界符前面是标点、后面紧跟文字：`**多出的50元，不是多赚的净利润。**图中`、
 *    `**产品首周消化约75%**看作`（拉丁文 `**bold.**next` 同型）。
 * 2. 开定界符后面是标点或符号、前面是文字：`拿**“已经有人付款”**当作`、
 *    `拿**（已经有人付款）**当作`、`拿**《已经有人付款》**当作`。手动把引号、括号、
 *    书名号这类符号和中间的字一起加粗，序列化就是这种形状。
 *
 * 闭侧走 marked 官方 `hooks.emStrongMask`：定界扫描前把紧贴 `*`/`_` run **前面**
 * 的标点/符号换成同长度的 `x`，「标点**文字」在扫描里归类成「文字**文字」。raw 文本
 * 按索引与掩码串对齐切片，长度必须不变；`*`/`_` 自身属于 `\p{P}`，必须排除。
 *
 * 开侧这个 hook 够不着。marked 的左定界符判定读的是原文和前一个真实字符，不读掩码串：
 * `*`/`_` 后面是标点、前面是汉字时直接拒绝开强调。这里在官方 `emStrong` 之前把
 * 「前一字符不是标点」的这一支改成当作标点再交给官方实现，raw 文本仍然不动。
 *
 * 为什么不直接改 `Lexer.rules`：静态规则集跨所有 Marked 实例全局共享，且 `breaks`/
 * `pedantic` 集合是构造期快照、事后改不传播。hook 和 tokenizer 都按实例生效，不污染
 * 消费者默认共享的 marked 全局单例。
 */
export const cjkEmphasisHook = {
  emStrongMask(src: string): string {
    return src.replace(
      /((?![*_])[\p{P}\p{S}])(?=[*_])/gu,
      (m) => 'x'.repeat(m.length),
    );
  },
};

function emStrong(
  this: Tokenizer,
  src: string,
  maskedSrc: string,
  prevChar = '',
): Tokens.Em | Tokens.Strong | undefined {
  const rules = this.rules.inline;
  const opener = rules.emStrongLDelim.exec(src);
  // 第 1/3 组：定界符后面紧跟标点。前一字符又是文字时，官方实现不开强调。
  if (
    opener &&
    (opener[1] || opener[3]) &&
    prevChar &&
    !rules.punctuation.test(prevChar)
  ) {
    return Tokenizer.prototype.emStrong.call(this, src, maskedSrc, '.');
  }
  return Tokenizer.prototype.emStrong.call(this, src, maskedSrc, prevChar);
}

let cached: Marked | undefined;

/**
 * 注入 `Markdown.configure({ marked })` / `new MarkdownManager({ marked })` 的 marked
 * 实例（模块级懒加载复用）。所有解析路径统一用它，CJK 粗体边界才一致。
 */
export function getCjkEmphasisMarked(): typeof marked {
  cached ??= new Marked().use({
    hooks: cjkEmphasisHook,
    tokenizer: { emStrong },
  });
  return cached;
}
