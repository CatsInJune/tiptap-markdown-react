import { describe, expect, it } from 'vitest';
import * as server from './server';

/**
 * `./server` 是 RSC / 无 DOM 环境的入口：除了渲染，还负责把纯工具交给
 * Server Component，避免宿主为了用它们去 import 带 'use client' 的主入口。
 */
describe('server entry', () => {
  it('导出渲染函数与纯工具', () => {
    expect(typeof server.renderReportHtml).toBe('function');
    expect(typeof server.splitIntoChapters).toBe('function');
    expect(typeof server.serializeChapterMarkdown).toBe('function');
    expect(typeof server.alignChapters).toBe('function');
    expect(typeof server.normalizeMarkdown).toBe('function');
    expect(typeof server.stripBlockIdComments).toBe('function');
    expect(typeof server.extractFootnoteSources).toBe('function');
    expect(typeof server.normalizeImageCrop).toBe('function');
  });

  it('纯工具在 Node 环境可直接工作', () => {
    expect(server.normalizeMarkdown('**加粗**')).toBe('**加粗**');
    expect(server.stripBlockIdComments('<!--b:b_1-->\n正文')).toBe('正文');
    expect(
      server.extractFootnoteSources('正文[^1]\n\n[^1]: [来源](https://e.com)')
        .sources[0].url,
    ).toBe('https://e.com');
  });
});
