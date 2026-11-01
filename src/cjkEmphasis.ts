import { Marked, marked } from 'marked';

/**
 * CJK 粗体/斜体边界修复（CommonMark flanking 规则）。
 *
 * CommonMark 规定：闭定界符 run 前面紧贴标点/符号、后面紧跟文字时不算合法闭合——
 * `**多出的50元，不是多赚的净利润。**图中` 与 `**产品首周消化约75%**看作` 都解析不出
 * 粗体，编辑器/阅读页只能显示字面星号。中文标点习惯性贴着粗体文字，中文场景高频踩
 * （拉丁文 `**bold.**next` 同型）。
 *
 * 修法走 marked 官方扩展点 `hooks.emStrongMask`：在每次行内定界符扫描前，对掩码串做
 * **长度保持**的替换——把紧贴 `*`/`_` run 前面的标点/符号字符换成同长度的 `x`，让
 * 「标点**文字」在扫描里归类成「文字**文字」（合法闭定界符）。原始 raw 文本按索引
 * 与掩码串对齐切片，所以长度必须不变；`*`/`_` 自身属于 `\p{P}`，必须排除，否则会把
 * 定界符自己掩掉。
 *
 * 为什么不直接改 `Lexer.rules`：静态规则集跨所有 Marked 实例全局共享，且 `breaks`/
 * `pedantic` 集合是构造期快照、事后改不传播。hook 是官方 API，按实例生效，不污染
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

let cached: Marked | undefined;

/**
 * 注入 `Markdown.configure({ marked })` / `new MarkdownManager({ marked })` 的 marked
 * 实例（模块级懒加载复用）。所有解析路径统一用它，CJK 粗体边界才一致。
 */
export function getCjkEmphasisMarked(): typeof marked {
  cached ??= new Marked().use({ hooks: cjkEmphasisHook });
  return cached;
}
