/** @vitest-environment happy-dom */
import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { describe, expect, it } from 'vitest';
import { DEMO_MD, DEMO_SOURCES } from '../site/src/site-data';
import { prepareChartMarkdown } from './chart/prepareChartMarkdown';
import { CitationRef } from './CitationRef';
import { baseExtensions, pureChart, pureCodeBlock, pureImage } from './extensions';
import { renderReportHtml } from './renderReportHtml';

/**
 * 首页预置稿要覆盖工具栏写得进 Markdown 的操作，
 * 并且客户端编辑器解析结果和服务端 HTML 含同一批内容。
 */
function build(content: string): Editor {
  return new Editor({
    extensions: [
      ...baseExtensions,
      pureCodeBlock,
      pureImage,
      pureChart,
      CitationRef,
      Markdown,
    ],
    content: prepareChartMarkdown(content),
    contentType: 'markdown',
  });
}

const MARKERS = [
  '加粗',
  '斜体',
  '下划线',
  '删除线',
  '行内代码',
  '链接',
  '启示一：IP的价值不在产品，而在意义',
  '主题色文字',
  '高亮',
  '24.4B',
  '二级标题',
  '六级标题',
  '这一段居中',
  '这一段右对齐',
  '两端对齐',
  '缩进一级',
  '行高是 2',
  '嵌套的无序项',
  '嵌套的有序项',
  '未完成的待办',
  '已完成的待办',
  '字母编号甲',
  '这是一段引用',
  '展开的折叠块',
  '收起的折叠块',
  'Hello, ',
];

describe('首页预置稿：预览与服务端渲染内容一致', () => {
  it('编辑器能读入全部操作，导出后再读入不丢', () => {
    const editor = build(DEMO_MD);
    for (const marker of MARKERS) {
      expect(editor.getText(), marker).toContain(marker);
    }
    expect(editor.getHTML()).toContain('data-numbering-format="upper-alpha"');
    expect(editor.getHTML()).toContain('font-size: 24px');
    expect(editor.getHTML()).toContain('<strong>');
    expect(editor.getHTML()).toContain('季度营收');
    expect(editor.getHTML()).toContain('居中的图片，带描述');
    const again = build(editor.getMarkdown());
    for (const marker of MARKERS) {
      expect(again.getText(), marker).toContain(marker);
    }
    expect(again.getHTML()).toContain('季度营收');
    expect(again.getHTML()).toContain('居中的图片，带描述');
    editor.destroy();
    again.destroy();
  });

  it('服务端 HTML 含同一批正文，加粗字号不是字面星号', () => {
    const { html, ok } = renderReportHtml(DEMO_MD, {
      sources: DEMO_SOURCES,
      includeToc: false,
    });
    expect(ok).toBe(true);
    for (const marker of MARKERS) {
      expect(html, marker).toContain(marker);
    }
    expect(html).toContain('data-numbering-format="upper-alpha"');
    expect(html).toContain('font-size: 24px');
    expect(html).toContain(
      '<span style="font-size: 24px"><strong>启示一：IP的价值不在产品，而在意义</strong></span>',
    );
    expect(html).not.toContain('**启示一');
    expect(html).toContain('data-index="1"');
    expect(html).toContain('tmr-chart');
    expect(html).toContain('季度营收');
    expect(html).toContain('data-align="center"');
    expect(html).toContain('居中的图片，带描述');
  });
});
