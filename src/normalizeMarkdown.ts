import { MarkdownManager } from '@tiptap/markdown';
import { CitationRef } from './CitationRef';
import { prepareChartMarkdown } from './chart/prepareChartMarkdown';
import { baseExtensions, pureChart, pureCodeBlock, pureImage } from './extensions';

/**
 * 把一段正文规范成「编辑器读进来再吐出去」的那种写法。
 *
 * **为什么需要它**：编辑器加载 markdown 时要先解析成文档结构，而 markdown 里有些东西是
 * 排版装饰、解析时就丢了（表格列宽的空格、注释 JSON 里的空格、数值尾零 …）。所以
 * 「存库正文」和「编辑器序列化结果」常常**逐字不同**——这与用户改没改无关，加载那一刻就
 * 发生了。而后端改卡走的是「在正文里逐字找到这段再替换」，两边写法不一致就会搜不到。
 * 宿主在要动正文之前（例如圈选改写提交前）先用本函数比对/对齐一次即可。
 *
 * **已知会被规范化的结构**（都是排版层面，内容语义不变）：
 *
 * | 结构 | 存库可能是 | 规范化后 |
 * |------|-----------|---------|
 * | GFM 表格 | `\| 收入 \| 100 \|` | 按列内容宽度重排对齐（多/少空格） |
 * | 图表注释 JSON | `<!-- {"chartType": "column"} -->` | `<!-- {"chartType":"column"} -->`（去空格，键序按解析结果） |
 * | **图表区**的数值 | `132.0` | `132`（图表把表解析成 payload，数值走 number 再写回） |
 * | 纯空白的正文 | `"   \n  "` | `""` |
 *
 * 注意第三行**只作用于图表区**：普通 GFM 表格走 marked 的表格解析，单元格是文本，
 * `1,234.50` 这种写法会原样保留（有测试钉住）。
 *
 * 反过来，这些**不该**被改动，同样有测试钉住：标题/段落/加粗斜体/列表/引用、代码块、
 * 公式、图片、脚注 `[^n]`、图表仍是「注释 + 表」的作者形态（不会变成 ```tmr-chart 围栏）。
 *
 * 注意它**不使用** `enrichMarkdownCitations`：脚注的 `[^n]` 由 CitationRef 自带的
 * tokenizer 解析，url/title 只存在于节点属性里、不进 markdown，所以规范化不需要 sources。
 */
export function normalizeMarkdown(markdown: string): string {
  if (!markdown) return markdown;
  const manager = getManager();
  return manager.serialize(manager.parse(prepareChartMarkdown(markdown)));
}

// [perf] 与 renderReportHtml 同样的理由：每次 new MarkdownManager 都会让底层 marked 全局
// 累积 tokenizer，parse 逐次变慢。这里只做「解析 → 序列化」，无状态，模块级复用即可。
let sharedManager: MarkdownManager | null = null;

function getManager(): MarkdownManager {
  sharedManager ??= new MarkdownManager({
    extensions: [...baseExtensions, pureCodeBlock, pureImage, pureChart, CitationRef],
  });
  return sharedManager;
}
