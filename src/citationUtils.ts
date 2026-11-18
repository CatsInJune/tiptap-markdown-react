import type { JSONContent } from '@tiptap/core';
import { normalizeLinkUrl } from './urlSafety';

export interface SourceRef {
  /** 与 markdown `[^n]` 中的 n 对齐（字符串，如 `"1"`）。 */
  index: string;
  /**
   * 来源地址。只接受 http(s) / mailto / tel 等白名单协议；`javascript:`、
   * `data:` 等危险地址在 enrich / apply / 渲染时会被丢弃（圆标仍在，只是不可点）。
   */
  url?: string;
  title?: string;
  /** 原文片段等；库本身不渲染 Popover，留给消费方。 */
  excerpt?: string;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 将 markdown 中能匹配到 `sources` 的 `[^n]` 换成带 data-* 的
 * `<span class="citation-ref">`（**不是** `<sup>`，避免被 Superscript 吃掉、
 * 也避免视觉上标）。未匹配的 `[^n]` 原样保留，留给 CitationRef tokenizer。
 *
 * 浏览器端 @tiptap/markdown 可解析内联 HTML；server 端无 DOMParser 时请改用
 * {@link applyCitationSources}（先 parse 再补 attrs）。
 */
export function enrichMarkdownCitations(
  markdown: string,
  sources: SourceRef[],
): string {
  if (!sources.length) return markdown;

  return markdown.replace(/\[\^(\d+)\]/g, (match, num: string) => {
    const source = sources.find((s) => s.index === num);
    if (!source) return match;

    // 脚注 URL 常来自外部数据（脚注定义行、第三方接口）。只允许白名单协议，
    // 避免 javascript: / data: 之类直接落进 href。
    const url = normalizeLinkUrl(source.url);
    const attrs = [`class="citation-ref"`, `data-index="${num}"`];
    if (url) attrs.push(`data-url="${escapeAttr(url)}"`);
    if (source.title) attrs.push(`data-title="${escapeAttr(source.title)}"`);

    if (url) {
      return `<span ${attrs.join(' ')}><a href="${escapeAttr(url)}" title="${escapeAttr(source.title || '')}" target="_blank" rel="noopener">${num}</a></span>`;
    }
    return `<span ${attrs.join(' ')}>${num}</span>`;
  });
}

function patchCitationNode(
  node: JSONContent,
  byIndex: Map<string, SourceRef>,
): JSONContent {
  if (node.type === 'citationRef') {
    const index = String(node.attrs?.index ?? '');
    const source = byIndex.get(index);
    if (!source) return node;
    return {
      ...node,
      attrs: {
        ...node.attrs,
        index,
        // 最终落进节点的 url 一律过白名单（来源或已有 attrs 都可能来自外部数据）。
        url: normalizeLinkUrl(source.url ?? node.attrs?.url),
        title: source.title ?? node.attrs?.title ?? null,
      },
    };
  }

  if (!node.content?.length) return node;
  return {
    ...node,
    content: node.content.map((child) => patchCitationNode(child, byIndex)),
  };
}

/**
 * 在已 parse 的 Tiptap JSON 上，按 `sources` 给 `citationRef` 节点补 url/title。
 * SSR / 无 DOMParser 环境的首选路径。
 */
export function applyCitationSources(
  doc: JSONContent,
  sources: SourceRef[],
): JSONContent {
  if (!sources.length) return doc;
  const byIndex = new Map(sources.map((s) => [s.index, s]));
  return patchCitationNode(doc, byIndex);
}

/** 单条脚注定义行：行首 0–3 空格 + `[^数字]:`。 */
const FOOTNOTE_DEF_RE = /^ {0,3}\[\^(\d+)\]:[ \t]?(.*)$/;

/** 内联链接：`[文本](url)`。URL 支持 `<...>` 包裹（可含空格）或一层配对括号（维基百科式）。 */
const MD_LINK_RE =
  /\[([^\]]*)\]\(\s*(?:<([^<>]*)>|((?:[^()\s]|\([^()]*\))+)(?:[ \t]+"[^"]*")?)\s*\)/;
const MD_LINK_RE_G = new RegExp(MD_LINK_RE.source, 'g');

/** 把定义内容压成纯文本（链接只留文本），供 excerpt 与 title 兜底。 */
function flattenFootnoteContent(content: string): string {
  return content
    .replace(
      MD_LINK_RE_G,
      (_match, text: string, angleUrl: string, plainUrl: string) =>
        text || angleUrl || plainUrl || '',
    )
    .trim();
}

export interface ExtractedFootnotes {
  /** 剥离定义行后的正文（首尾与多余空行已收敛）。 */
  markdown: string;
  /** 解析出的来源列表，同一 label 重复定义取首次。 */
  sources: SourceRef[];
}

/**
 * 把 markdown 中的 GFM 脚注定义行（`[^n]: …`）抽成 {@link SourceRef} 并从正文剥离。
 *
 * 与 {@link enrichMarkdownCitations} / {@link applyCitationSources} 同属脚注一族：
 * 它们消费 `sources` 处理 `[^n]` 标记这一半，本函数生产 `sources`、处理定义行
 * 另一半——不剥离，定义行会以普通段落渲染；不抽取，标记没有 url/title 可补。
 * 典型用法（纯字符串变换，流式每帧重算也便宜）：
 *
 * ```ts
 * const { markdown: body, sources } = extractFootnoteSources(raw);
 * // <MarkdownPreview markdown={body} sources={sources} … />
 * ```
 *
 * 规则与边界：
 * - label 仅支持数字，与 enrich / CitationRef tokenizer 的 `\[\^(\d+)\]` 一致；
 *   非数字定义行不识别、原样留在正文；
 * - 围栏代码块（``` / ~~~，判定与 {@link stabilizeMarkdown} 一致）内的定义行跳过；
 *   缩进代码块不识别（已知限制）；
 * - 续行：紧跟定义的缩进（≥4 空格或 Tab）非空行并入内容，空行结束定义；
 * - 内容中第一个内联链接取作 url、链接文本作 title；excerpt 取纯文本全文；
 *   无链接时 title 取纯文本首行；
 * - 流式半行（如 `[^1]: [原文](htt`）按 best-effort 解析，下一帧自愈。
 */
export function extractFootnoteSources(markdown: string): ExtractedFootnotes {
  if (!markdown || !markdown.includes('[^')) {
    return { markdown, sources: [] };
  }

  const lines = markdown.split('\n');
  const bodyLines: string[] = [];
  const sources: SourceRef[] = [];
  const seen = new Set<string>();
  let removed = false;

  let inFence = false;
  let fenceChar = '`';
  let fenceLen = 3;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    const fence = line.match(/^(`{3,}|~{3,})/);
    if (fence) {
      const char = fence[1][0];
      if (!inFence) {
        inFence = true;
        fenceChar = char;
        fenceLen = fence[1].length;
      } else if (
        char === fenceChar &&
        fence[1].length >= fenceLen &&
        /^[`~]+\s*$/.test(line)
      ) {
        inFence = false;
      }
      bodyLines.push(line);
      continue;
    }
    if (inFence) {
      bodyLines.push(line);
      continue;
    }

    const def = FOOTNOTE_DEF_RE.exec(line);
    if (!def) {
      bodyLines.push(line);
      continue;
    }
    removed = true;

    const parts = [def[2]];
    let j = i + 1;
    while (
      j < lines.length &&
      lines[j].trim() &&
      /^(?: {4,}|\t)/.test(lines[j])
    ) {
      parts.push(lines[j].trim());
      j += 1;
    }
    i = j - 1;

    const index = def[1];
    if (seen.has(index)) continue;
    seen.add(index);

    const content = parts.join('\n');
    const link = MD_LINK_RE.exec(content);
    const source: SourceRef = { index };
    if (link) {
      // 定义行来自 markdown（可能不可信）：不安全协议不落进 url，只保留文字信息。
      const url = normalizeLinkUrl(link[2] ?? link[3]);
      if (url) source.url = url;
      const text = link[1]?.trim();
      if (text) source.title = text;
    }
    const plain = flattenFootnoteContent(content);
    if (plain) {
      source.excerpt = plain;
      if (!source.title) source.title = plain.split('\n')[0];
    }
    sources.push(source);
  }

  if (!removed) {
    return { markdown, sources: [] };
  }

  return {
    markdown: bodyLines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\n+/, '')
      .replace(/\s+$/, ''),
    sources,
  };
}
