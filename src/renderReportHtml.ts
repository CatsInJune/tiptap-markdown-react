import {
  generateTocIds,
  TableOfContents,
} from '@tiptap/extension-table-of-contents';
import type { JSONContent } from '@tiptap/core';
import { MarkdownManager } from '@tiptap/markdown';
import { renderToHTMLString } from '@tiptap/static-renderer';
import {
  applyCitationSources,
  type SourceRef,
} from './citationUtils';
import { CitationRef } from './CitationRef';
import { baseExtensions, pureCodeBlock, pureImage } from './extensions';
import { extractToc, type TocItem } from './toc/extractToc';
import { makeTocGetId } from './toc/tocSlug';

/**
 * server 端把 markdown 渲成 HTML 字符串 + 目录（纯函数，无 editor / 无 window）。
 *
 * 走官方管线 `MarkdownManager.parse → generateTocIds → renderToHTMLString`，可在
 * Server Component / ISR 里直接跑，正文 HTML + 锚点 id 进静态产物，兑现 SEO / 首屏。
 *
 * 扩展集与编辑器同源（base + 纯版 CodeBlock/Image）+ TableOfContents。TOC 扩展在 v3
 * 会扩展 Heading schema 使 id 渲染进 HTML；`generateTocIds` 是官方纯函数（无 editor /
 * 无 window，专为「renderToHTMLString 前在 server 注入锚点」设计）。
 * 锚点用 slug + 去重（makeTocGetId），跨 SSR / ISR 稳定、可分享。
 *
 * `[^n]` 由 CitationRef tokenizer 解析；`sources` 经 {@link applyCitationSources}
 * 补 url/title（不依赖 DOMParser，避免 server 内联 HTML 失效）。
 *
 * 已知边界：官方包解析内联 HTML 依赖 window.DOMParser，server 端无 window 会把
 * 内联 HTML（如 <u>）转义为字面文本。
 */
export interface RenderedReport {
  html: string;
  toc: TocItem[];
}

export interface RenderReportHtmlOptions {
  /** 被付费墙锁住的章节标题（TOC 标 locked）。 */
  lockedTitles?: string[];
  /** 脚注来源，按 index 对齐 `[^n]`。 */
  sources?: SourceRef[];
}

// [perf] 模块级复用单个 MarkdownManager。每次 `new MarkdownManager` 会让底层 marked
// 全局累积扩展，parse 逐次变慢。parse 只用 schema、与 TOC 的 getId 无关，可跨调用
// 安全复用；getId 相关的锚点注入放在 generateTocIds 阶段、用每篇新建的 extensions 处理。
const sharedManager = new MarkdownManager({
  extensions: [
    ...baseExtensions,
    pureCodeBlock,
    pureImage,
    CitationRef,
    TableOfContents,
  ],
});

export function renderReportHtml(
  markdown: string,
  lockedTitlesOrOptions: string[] | RenderReportHtmlOptions = [],
): RenderedReport {
  if (!markdown?.trim()) return { html: '', toc: [] };

  const options: RenderReportHtmlOptions = Array.isArray(lockedTitlesOrOptions)
    ? { lockedTitles: lockedTitlesOrOptions }
    : lockedTitlesOrOptions;
  const lockedTitles = options.lockedTitles ?? [];
  const sources = options.sources ?? [];

  const json = applyCitationSources(
    sharedManager.parse(markdown) as JSONContent,
    sources,
  );

  // getId 是有状态去重闭包，每篇必须重置，否则锚点 id 跨调用串号。这份 extensions
  // 只喂 generateTocIds / renderToHTMLString——schema 与 sharedManager 一致（仅 getId
  // 配置不同，不影响 schema），故对 sharedManager.parse 出的 json 兼容。
  const extensions = [
    ...baseExtensions,
    pureCodeBlock,
    pureImage,
    CitationRef,
    TableOfContents.configure({ getId: makeTocGetId() }),
  ];
  try {
    // 给 heading 注入 id / data-toc-id（server 端，renderToHTMLString 前）。
    const jsonWithIds = generateTocIds(json, extensions);
    const html = renderToHTMLString({ extensions, content: jsonWithIds });
    return { html, toc: extractToc(jsonWithIds, lockedTitles) };
  } catch (e) {
    // 某些 markdown 经 parse 产出的 JSON 可能在 heading 内嵌套 block 级子节点，
    // 导致 generateTocIds 的 setNodeMarkup 校验失败。单篇异常不应拖垮整个构建，
    // 降级返回空内容。
    console.error(
      '[renderReportHtml] Tiptap pipeline failed, falling back to empty content:',
      (e as Error).message,
    );
    return { html: '', toc: [] };
  }
}
