// @vitest-environment happy-dom
import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { BlockIdMarkdown } from './BlockIdMarkdown';
import {
  BLOCK_ID_LINE_RE,
  createBlockId,
  formatBlockIdLine,
  normalizeBlockId,
  readBlockIdLine,
  stripBlockIdComments,
} from './id';
import {
  baseExtensions,
  blockIdBackfill,
  blockIdExtension,
  pureChart,
  pureCodeBlock,
  pureImage,
} from '../extensions';
import { prepareChartMarkdown } from '../chart/prepareChartMarkdown';

function createEditor(markdown: string) {
  return new Editor({
    extensions: [
      ...baseExtensions,
      blockIdExtension,
      blockIdBackfill,
      pureCodeBlock,
      pureImage,
      pureChart,
      BlockIdMarkdown,
    ],
    content: markdown,
    contentType: 'markdown',
  });
}

const BLOCK_ID = /^b_[A-Za-z0-9_]{10}$/;

describe('blockId：ID 生成与注释行', () => {
  it('b_ + nanoid(10)，只含 [A-Za-z0-9_]', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const id = createBlockId();
      expect(id).toMatch(BLOCK_ID);
      seen.add(id);
    }
    expect(seen.size).toBe(50);
  });

  it('normalizeBlockId 只收合法值', () => {
    expect(normalizeBlockId('b_abc_123')).toBe('b_abc_123');
    expect(normalizeBlockId('bad-id')).toBeNull();
    expect(normalizeBlockId('bad id')).toBeNull();
    expect(normalizeBlockId(42)).toBeNull();
    expect(normalizeBlockId(null)).toBeNull();
  });

  it('行格式与读取', () => {
    expect(formatBlockIdLine('b_x')).toBe('<!--b:b_x-->');
    expect(readBlockIdLine('<!--b:b_x-->')).toBe('b_x');
    expect(readBlockIdLine('  <!--b:b_x-->  ')).toBe('b_x');
    expect(readBlockIdLine('<!--b:bad-id-->')).toBeNull();
    expect(readBlockIdLine('<!-- {"chartType":"line"} -->')).toBeNull();
    expect(BLOCK_ID_LINE_RE.test('    <!--b:b_x-->')).toBe(false);
  });

  it('stripBlockIdComments 只剥顶层独立行，fence 内保留', () => {
    const md = [
      '<!--b:b_one-->',
      '## 标题',
      '',
      '<!--b:b_two-->',
      '正文',
      '',
      '```md',
      '<!--b:b_fake-->',
      '```',
      '',
      '<!-- {"chartType":"line"} -->',
      '',
      '| a | b |',
      '| --- | --- |',
      '| 1 | 2 |',
    ].join('\n');
    const out = stripBlockIdComments(md);
    expect(out).not.toContain('<!--b:b_one-->');
    expect(out).not.toContain('<!--b:b_two-->');
    expect(out).toContain('<!--b:b_fake-->');
    expect(out).toContain('<!-- {"chartType":"line"} -->');
    expect(out).toContain('## 标题');
    // 行内（非行首独立）的同名注释不是块 ID，原样保留 —— 与解析侧的口径一致
    expect(stripBlockIdComments('x<!--b:b_inline-->\n\n正文')).toContain(
      'x<!--b:b_inline-->',
    );
  });
});

describe('blockId：markdown 序列化 / 解析（RFC §7.1）', () => {
  it('含 ID 文档：解析到 attr，序列化原样位置输出', () => {
    const md = [
      '<!--b:b_one-->',
      '## 标题',
      '',
      '<!--b:b_two-->',
      '正文',
    ].join('\n');
    const editor = createEditor(md);
    const json = editor.getJSON();
    expect(json.content?.[0]?.attrs?.blockId).toBe('b_one');
    expect(json.content?.[1]?.attrs?.blockId).toBe('b_two');
    expect(editor.getMarkdown()).toBe(md);
    editor.destroy();
  });

  it('getMarkdown → setContent → getMarkdown，ID 保持且位置不变', () => {
    const md = [
      '<!--b:b_one-->',
      '## 标题',
      '',
      '<!--b:b_two-->',
      '正文',
    ].join('\n');
    const editor = createEditor('');
    editor.commands.setContent(md, { contentType: 'markdown' });
    const once = editor.getMarkdown();
    editor.commands.setContent(once, { contentType: 'markdown' });
    const twice = editor.getMarkdown();
    expect(once).toBe(md);
    expect(twice).toBe(md);
    editor.destroy();
  });

  it('无 ID 文档：进入文档即带 ID，首次序列化带 ID', async () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [
        ...baseExtensions,
        blockIdExtension,
        blockIdBackfill,
        pureCodeBlock,
        pureImage,
        pureChart,
        BlockIdMarkdown,
      ],
      content: ['## 标题', '', '正文'].join('\n'),
      contentType: 'markdown',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const json = editor.getJSON();
    const ids = (json.content ?? []).map((node) => node.attrs?.blockId);
    expect(ids).toHaveLength(2);
    ids.forEach((id) => expect(id).toMatch(BLOCK_ID));

    const markdown = editor.getMarkdown();
    expect(markdown).toContain(`<!--b:${ids[0]}-->`);
    expect(markdown).toContain(`<!--b:${ids[1]}-->`);
    expect(markdown.indexOf(`<!--b:${ids[0]}-->`)).toBeLessThan(
      markdown.indexOf('## 标题'),
    );
    editor.destroy();
  });

  it('fence 内的伪注释不解析、不当孤儿丢失', () => {
    const md = [
      '<!--b:b_real-->',
      '正文',
      '',
      '```md',
      '<!--b:b_fake-->',
      '```',
    ].join('\n');
    const editor = createEditor(md);
    const content = editor.getJSON().content ?? [];
    expect(content[0]?.attrs?.blockId).toBe('b_real');
    expect((content[0]?.content as any[] | undefined)?.[0]?.text).toBe('正文');
    // 代码块前没有 ID 行，解析阶段自动补一个；伪注释原样留在 fence 里
    expect(content[1]?.type).toBe('codeBlock');
    expect(content[1]?.attrs?.blockId).toMatch(BLOCK_ID);
    expect(editor.getMarkdown()).toContain('<!--b:b_fake-->');
    editor.destroy();
  });

  it('行内 `x<!--b:...-->` 不是行首独立行：不附 ID、不丢正文', () => {
    const editor = createEditor('x<!--b:b_inline-->\n\n正文');
    const content = editor.getJSON().content ?? [];
    expect((content[0]?.content as any[] | undefined)?.[0]?.text).toBe('x');
    expect(content[1]?.type).toBe('paragraph');
    // 正文段落会拿到解析阶段自动补的 ID，但**不能**是行内注释里的 b_inline
    expect(content[1]?.attrs?.blockId).toMatch(BLOCK_ID);
    expect(content[1]?.attrs?.blockId).not.toBe('b_inline');
    expect(editor.getMarkdown()).not.toContain('<!--b:b_inline-->');
    expect(editor.getMarkdown()).toContain('正文');
    editor.destroy();
  });

  it('ID 行后多个空行：ID 仍附到真实块（隐式空段不吃 ID）', () => {
    for (const newlines of ['\n\n\n\n\n', '\n\n\n\n\n\n', '\n\n\n\n\n\n\n']) {
      const editor = createEditor(`<!--b:b_x-->${newlines}## 标题`);
      const content = editor.getJSON().content ?? [];
      const heading = content.find((node) => node.type === 'heading');
      expect(heading?.attrs?.blockId).toBe('b_x');
      expect(editor.getMarkdown()).toContain('<!--b:b_x-->\n## 标题');
      editor.destroy();
    }
  });

  it('块尾孤行丢弃，不报错也不影响前文', () => {
    const editor = createEditor('正文\n\n<!--b:b_orphan-->');
    const content = editor.getJSON().content ?? [];
    expect(content).toHaveLength(1);
    // 段落拿解析阶段补的 ID，孤儿注释本身被丢弃
    expect(content[0]?.attrs?.blockId).toMatch(BLOCK_ID);
    const markdown = editor.getMarkdown();
    expect(markdown).not.toContain('b_orphan');
    expect(markdown).toContain('正文');
    editor.destroy();
  });

  it('连续 ID 行：紧挨块的那条生效', () => {
    const editor = createEditor('<!--b:b_outer-->\n<!--b:b_inner-->\n正文');
    expect(editor.getJSON().content?.[0]?.attrs?.blockId).toBe('b_inner');
    expect(editor.getMarkdown()).toBe('<!--b:b_inner-->\n正文');
    editor.destroy();
  });

  it('列表 / 表格等顶层块同样带 ID，round-trip 稳定', () => {
    const md = [
      '<!--b:b_list-->',
      '- 一',
      '- 二',
      '',
      '<!--b:b_table-->',
      '| a | b |',
      '| --- | --- |',
      '| 1 | 2 |',
    ].join('\n');
    const editor = createEditor(md);
    const once = editor.getMarkdown();
    expect(once).toContain('<!--b:b_list-->\n- 一');
    // 表格的官方 renderMarkdown 自带前导换行，ID 行与表格之间会隔一个空行
    expect(once).toMatch(/<!--b:b_table-->\n\n?\| a/);

    editor.commands.setContent(once, { contentType: 'markdown' });
    const content = editor.getJSON().content ?? [];
    expect(content[0]?.attrs?.blockId).toBe('b_list');
    expect(content[1]?.attrs?.blockId).toBe('b_table');
    const twice = editor.getMarkdown();
    expect(twice).toContain('<!--b:b_list-->');
    expect(twice).toContain('<!--b:b_table-->');
    expect(twice.match(/<!--b:b_table-->/g)).toHaveLength(1);
    editor.destroy();
  });

  it('代码块 / 图片 / 图表前的 ID 也往返（编辑器内容块类型）', () => {
    const code = createEditor('<!--b:b_code-->\n```md\nx = 1\n```');
    const codeContent = code.getJSON().content ?? [];
    expect(codeContent[0]?.type).toBe('codeBlock');
    expect(codeContent[0]?.attrs?.blockId).toBe('b_code');
    expect(code.getMarkdown()).toContain('<!--b:b_code-->');
    code.commands.setContent(code.getMarkdown(), { contentType: 'markdown' });
    expect(code.getJSON().content?.[0]?.attrs?.blockId).toBe('b_code');
    code.destroy();

    const image = createEditor(
      '<!--b:b_img-->\n![图](https://example.com/a.png)',
    );
    const imageContent = image.getJSON().content ?? [];
    expect(imageContent[0]?.type).toBe('image');
    expect(imageContent[0]?.attrs?.blockId).toBe('b_img');
    expect(image.getMarkdown()).toContain('<!--b:b_img-->');
    image.commands.setContent(image.getMarkdown(), { contentType: 'markdown' });
    expect(image.getJSON().content?.[0]?.attrs?.blockId).toBe('b_img');
    image.destroy();

    const chartMarkdown = [
      '<!-- {"chartType":"column","x":"项目","y":"金额"} -->',
      '',
      '| 项目 | 金额 |',
      '| --- | --- |',
      '| 收入 | 100 |',
    ].join('\n');
    const chart = createEditor(
      `<!--b:b_chart-->\n${prepareChartMarkdown(chartMarkdown)}`,
    );
    const chartContent = chart.getJSON().content ?? [];
    expect(chartContent[0]?.type).toBe('chart');
    expect(chartContent[0]?.attrs?.blockId).toBe('b_chart');
    expect(chart.getMarkdown()).toContain('<!--b:b_chart-->');
    chart.destroy();
  });

  it('图表配置注释是内容注释，与 ID 行共存', () => {
    const chart = [
      '<!-- {"chartType":"column","x":"项目","y":"金额"} -->',
      '',
      '| 项目 | 金额 |',
      '| --- | --- |',
      '| 收入 | 100 |',
    ].join('\n');
    const md = `<!--b:b_head-->\n## 图表\n\n${prepareChartMarkdown(chart)}`;
    const editor = createEditor(md);
    const content = editor.getJSON().content ?? [];
    expect(content[0]?.type).toBe('heading');
    expect(content[0]?.attrs?.blockId).toBe('b_head');
    expect(content[1]?.type).toBe('chart');
    const out = editor.getMarkdown();
    expect(out).toContain('<!--b:b_head-->');
    expect(out).toContain('<!-- {"chartType":"column"');
    expect(out).not.toContain('```tmr-chart');
    editor.destroy();
  });
});
