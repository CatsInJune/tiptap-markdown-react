// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from './extensions';
import { insertMarkdown } from './insertMarkdown';
import { renderReportHtml } from './renderReportHtml';
import { getCjkEmphasisMarked } from './cjkEmphasis';

/**
 * CJK 粗体/斜体边界（CommonMark flanking）回归组。
 *
 * 复现：docx 导入的「**多出的50元，不是多赚的净利润。**图中…」「他通常把**产品首周消化约75%**看作…」
 * 在编辑器/阅读页显示字面星号——闭定界符前面是标点/符号、后面紧跟文字时，CommonMark 不认它闭合。
 * 手动把引号、括号、书名号等符号和中间的字一起加粗是另一支：`拿**“已经有人付款”**当作`、
 * `拿**（已经有人付款）**当作`，开定界符后面是标点/符号、前面是汉字，CommonMark 不认它开启。
 * 中文标点习惯性贴着粗体文字（拉丁文 `**bold.**next` 同型）。
 *
 * 修复见 cjkEmphasis.ts，测试用与生产一致的 `getCjkEmphasisMarked()`。
 */

// 与生产注入保持一致：编辑器、预览、server 三个 manager 都用 getCjkEmphasisMarked()。
const markdownExtension = Markdown.configure({ marked: getCjkEmphasisMarked() });

function build(markdown = ''): Editor {
  return new Editor({
    extensions: [...baseExtensions, markdownExtension],
    content: markdown,
    contentType: 'markdown',
  });
}

interface TextHit {
  text: string;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  code: boolean;
}

function firstText(editor: Editor, needle: string): TextHit | null {
  let hit: TextHit | null = null;
  editor.state.doc.descendants((node) => {
    if (hit) return false;
    if (node.isText && node.text?.includes(needle)) {
      const names = node.marks.map((m) => m.type.name);
      hit = {
        text: node.text,
        bold: names.includes('bold'),
        italic: names.includes('italic'),
        strike: names.includes('strike'),
        code: names.includes('code'),
      };
      return false;
    }
    return true;
  });
  return hit;
}

function boldSpans(editor: Editor): string[] {
  const out: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.isText && node.marks.some((m) => m.type.name === 'bold') && node.text) {
      out.push(node.text);
    }
    return true;
  });
  return out;
}

/** 非代码文本里还有字面 `*`，即视为粗体没解析出来。 */
function hasLiteralAsterisks(editor: Editor): boolean {
  let bad = false;
  editor.state.doc.descendants((node) => {
    if (
      node.isText &&
      node.text?.includes('*') &&
      !node.marks.some((m) => m.type.name === 'code')
    ) {
      bad = true;
    }
    return true;
  });
  return bad;
}

describe('CJK 粗体边界（emStrongMask）', () => {
  it('真实文档：句号收尾的粗体后紧跟正文（docx 导入原文）', () => {
    const editor = build(
      '**多出的50元，不是多赚的净利润。**图中15元和65元只扣了做货成本；自营的门店、平台、人工、投流等费用还要由品牌支付。',
    );
    expect(boldSpans(editor)).toContain('多出的50元，不是多赚的净利润。');
    expect(hasLiteralAsterisks(editor)).toBe(false);
    editor.destroy();
  });

  it('真实文档：百分号收尾的粗体后紧跟正文', () => {
    const editor = build('他通常把**产品首周消化约75%**看作合格线。');
    expect(firstText(editor, '产品首周消化约75%')?.bold).toBe(true);
    expect(firstText(editor, '他通常把')?.bold).toBe(false);
    expect(firstText(editor, '看作合格线')?.bold).toBe(false);
    editor.destroy();
  });

  it('回归：闭侧是汉字（原本就可用）', () => {
    const editor = build('**好的**图中15元。');
    expect(boldSpans(editor)).toContain('好的');
    expect(hasLiteralAsterisks(editor)).toBe(false);
    editor.destroy();
  });

  it('回归：闭侧标点后跟空格（原本就可用）', () => {
    const editor = build('**好的。** 图中15元。');
    expect(boldSpans(editor)).toContain('好的。');
    editor.destroy();
  });

  it('回归：粗体收在行尾（原本就可用）', () => {
    const editor = build('这是**自营毛利率高，并不保证扣完这些费用后还能赢过经销。**');
    expect(boldSpans(editor)).toContain(
      '自营毛利率高，并不保证扣完这些费用后还能赢过经销。',
    );
    editor.destroy();
  });

  it('回归：括号收尾后跟空格（GFM 表格单元格形态）', () => {
    const editor = build('**品牌毛利（未扣销售费用）** **15**');
    expect(boldSpans(editor)).toContain('品牌毛利（未扣销售费用）');
    expect(boldSpans(editor)).toContain('15');
    editor.destroy();
  });

  it('回归：纯标点粗体收在行尾，掩码不得破坏', () => {
    const editor = build('**。**');
    expect(boldSpans(editor)).toContain('。');
    editor.destroy();
  });

  it('行内代码不误伤', () => {
    const editor = build('前缀 `**not**` 后缀');
    const hit = firstText(editor, 'not');
    expect(hit?.code).toBe(true);
    expect(hit?.bold).toBe(false);
    expect(editor.state.doc.textContent).toContain('**not**');
    editor.destroy();
  });

  it('星号三连：em+strong 叠加不受影响', () => {
    const editor = build('***both***中文');
    const hit = firstText(editor, 'both');
    expect(hit?.bold).toBe(true);
    expect(hit?.italic).toBe(true);
    editor.destroy();
  });

  it('intraword 下划线仍然禁用（CommonMark 保留项）', () => {
    const editor = build('foo_bar_baz');
    expect(firstText(editor, '_bar_')?.italic).toBe(false);
    editor.destroy();
  });

  it('rule-of-three 抽样（CommonMark spec 用例钉行为）', () => {
    // spec: ***foo**bar* → <em><strong>foo</strong>bar</em>
    const e1 = build('***foo**bar*');
    expect(firstText(e1, 'foo')?.bold).toBe(true);
    expect(firstText(e1, 'foo')?.italic).toBe(true);
    expect(firstText(e1, 'bar')?.italic).toBe(true);
    expect(firstText(e1, 'bar')?.bold).toBe(false);
    e1.destroy();
    // spec: *foo**bar*** → <em>foo<strong>bar</strong></em>
    const e2 = build('*foo**bar***');
    expect(firstText(e2, 'foo')?.italic).toBe(true);
    expect(firstText(e2, 'bar')?.bold).toBe(true);
    expect(firstText(e2, 'bar')?.italic).toBe(true);
    e2.destroy();
  });

  it('docx 表格形态：单元格 <br> 多段 + 表后段落粗体', () => {
    const md = [
      '| **通过经销商卖**<br>消费者付款 **100** | **品牌自己卖**<br>品牌直接收到 **100** |',
      '| --- | --- |',
      '',
      '**多出的50元，不是多赚的净利润。**图中15元。',
    ].join('\n');
    const editor = build(md);
    let hasTable = false;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'table') hasTable = true;
      return true;
    });
    expect(hasTable).toBe(true);
    expect(boldSpans(editor)).toContain('通过经销商卖');
    expect(boldSpans(editor)).toContain('100');
    expect(boldSpans(editor)).toContain('多出的50元，不是多赚的净利润。');
    expect(hasLiteralAsterisks(editor)).toBe(false);
    editor.destroy();
  });

  it('roundtrip：getMarkdown 仍输出 **…**', () => {
    const editor = build('前**粗。**后');
    expect(editor.getMarkdown()).toBe('前**粗。**后');
    editor.destroy();
  });

  it('insertMarkdown 路径同样生效', () => {
    const editor = build();
    insertMarkdown(
      editor,
      '**多出的50元，不是多赚的净利润。**图中15元和65元只扣了做货成本。',
      [],
    );
    expect(boldSpans(editor)).toContain('多出的50元，不是多赚的净利润。');
    expect(hasLiteralAsterisks(editor)).toBe(false);
    editor.destroy();
  });

  it('renderReportHtml 路径输出 <strong>', () => {
    const { html } = renderReportHtml(
      '**多出的50元，不是多赚的净利润。**图中15元和65元只扣了做货成本。',
    );
    expect(html).toContain('<strong>多出的50元，不是多赚的净利润。</strong>');
    expect(html).not.toContain('**');
  });

  it('引号连同引号内文字加粗，前后紧贴汉字', () => {
    const editor = build('拿**“已经有人付款”**当作降低交付标准的理由。');
    expect(boldSpans(editor)).toContain('“已经有人付款”');
    expect(firstText(editor, '拿')?.bold).toBe(false);
    expect(firstText(editor, '当作降低交付标准的理由。')?.bold).toBe(false);
    expect(hasLiteralAsterisks(editor)).toBe(false);
    expect(editor.getMarkdown()).toBe('拿**“已经有人付款”**当作降低交付标准的理由。');
    editor.destroy();
  });

  it('英文引号、直角引号同样能开粗体', () => {
    const straight = build('拿**"已经有人付款"**当作');
    expect(boldSpans(straight)).toContain('"已经有人付款"');
    expect(hasLiteralAsterisks(straight)).toBe(false);
    straight.destroy();

    const corner = build('拿**「已经有人付款」**当作');
    expect(boldSpans(corner)).toContain('「已经有人付款」');
    expect(hasLiteralAsterisks(corner)).toBe(false);
    corner.destroy();
  });

  it('引号包住的斜体，前后紧贴汉字', () => {
    const editor = build('拿*“已经有人付款”*当作');
    const hit = firstText(editor, '“已经有人付款”');
    expect(hit?.italic).toBe(true);
    expect(hit?.bold).toBe(false);
    expect(hasLiteralAsterisks(editor)).toBe(false);
    editor.destroy();
  });

  it('renderReportHtml：引号粗体输出 <strong>，不留字面星号', () => {
    const { html } = renderReportHtml('拿**“已经有人付款”**当作降低交付标准的理由。');
    expect(html).toContain('<strong>“已经有人付款”</strong>');
    expect(html).not.toContain('**');
  });

  it('选区前后的标点或符号一起加粗，前后紧贴汉字', () => {
    const samples = [
      '拿**“已经有人付款”**当作',
      '拿**「已经有人付款」**当作',
      '拿**『已经有人付款』**当作',
      '拿**（已经有人付款）**当作',
      '拿**(已经有人付款)**当作',
      '拿**【已经有人付款】**当作',
      '拿**《已经有人付款》**当作',
      '拿**〈已经有人付款〉**当作',
      '拿**[已经有人付款]**当作',
      '拿**{已经有人付款}**当作',
      '拿**‘已经有人付款’**当作',
      '拿**·已经有人付款·**当作',
      '拿**…已经有人付款…**当作',
      '拿**—已经有人付款—**当作',
      '拿**：已经有人付款：**当作',
      '拿**！已经有人付款！**当作',
      '拿**？已经有人付款？**当作',
      '拿**%已经有人付款%**当作',
      '拿**$已经有人付款$**当作',
      '拿**￥已经有人付款￥**当作',
      '拿**+已经有人付款+**当作',
      '拿**/已经有人付款/**当作',
      '拿**#已经有人付款#**当作',
      '拿**&已经有人付款&**当作',
      '拿**※已经有人付款※**当作',
      '拿**★已经有人付款★**当作',
      '拿**《“已经有人付款”》**当作',
      '拿**（已经有人付款**当作',
      '拿**已经有人付款）**当作',
    ];
    for (const md of samples) {
      const editor = build(md);
      const inner = md.slice(md.indexOf('**') + 2, md.lastIndexOf('**'));
      expect(boldSpans(editor), md).toContain(inner);
      expect(firstText(editor, '拿')?.bold, md).toBe(false);
      expect(firstText(editor, '当作')?.bold, md).toBe(false);
      expect(hasLiteralAsterisks(editor), md).toBe(false);
      // 方括号、& 序列化时会转义。转义后再读回来，可见文字和加粗都还在。
      const serialized = editor.getMarkdown();
      const again = build(serialized);
      expect(boldSpans(again).join(''), serialized).toBe(boldSpans(editor).join(''));
      expect(hasLiteralAsterisks(again), serialized).toBe(false);
      editor.destroy();
      again.destroy();
    }
  });

  it('括号包住的斜体，前后紧贴汉字', () => {
    const editor = build('拿*（已经有人付款）*当作');
    const hit = firstText(editor, '（已经有人付款）');
    expect(hit?.italic).toBe(true);
    expect(hit?.bold).toBe(false);
    expect(hasLiteralAsterisks(editor)).toBe(false);
    editor.destroy();
  });

  it('renderReportHtml：括号、书名号、百分号同样输出 <strong>', () => {
    const html = [
      '拿**（已经有人付款）**当作',
      '拿**《已经有人付款》**当作',
      '他通常把**约75%**看作',
    ]
      .map((md) => renderReportHtml(md).html)
      .join('\n');
    expect(html).toContain('<strong>（已经有人付款）</strong>');
    expect(html).toContain('<strong>《已经有人付款》</strong>');
    expect(html).toContain('<strong>约75%</strong>');
    expect(html).not.toContain('**');
  });
});
