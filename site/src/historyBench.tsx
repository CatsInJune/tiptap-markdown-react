/**
 * 历史面板装载基线（仅 history-bench.html 使用，不进站点）。
 *
 * 对齐 VersionDiffView：分块首屏 + idle 续装 + 版本 JSON 缓存；
 * 另量整篇 setContent / parseVersionDoc，方便和 1.12.3 基线对照。
 *
 *   ?chars=160000
 * 由 site/scripts/history-bench.mjs 驱动。
 */
import { Editor } from '@tiptap/core';
import { EditorContent, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import { Markdown } from '@tiptap/markdown';
import { createRoot } from 'react-dom/client';
import { useEffect } from 'react';
import { prepareChartMarkdown } from '../../src/chart/prepareChartMarkdown';
import { createChart } from '../../src/chart/createChart';
import { createCitationRef } from '../../src/createCitationRef';
import { getCjkEmphasisMarked } from '../../src/cjkEmphasis';
import { baseExtensions, pureCodeBlock, pureImage } from '../../src/extensions';
import { loadVersionPreview } from '../../src/versionHistory/loadVersionPreview';
import { parseVersionDoc } from '../../src/versionHistory/schema';
import {
  clearVersionJsonCache,
} from '../../src/versionHistory/versionJsonCache';
import { versionDiffExtension } from '../../src/versionHistory/diffDecorations';
import { CodeBlockView } from '../../src/components/CodeBlockView';
import contentStyles from '../../src/styles/content.module.css';

const params = new URLSearchParams(window.location.search);
const targetChars = Number(params.get('chars') ?? 160000);

const SENTENCE =
  '本季度营收延续上行，核心产品在主要区域的渗透率继续提升，渠道库存保持健康，费用率同比改善，客户留存稳定。';
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

interface BuiltDoc {
  markdown: string;
  chapters: number;
  citations: number;
  tables: number;
  images: number;
  listItems: number;
}

/** 报告形：标题、段落、引用、列表、表格、图片，密度贴近宿主长报告。 */
function generateReport(chars: number): BuiltDoc {
  const out: string[] = ['# 压测文档：公司经营概览'];
  let count = out[0].length;
  let chapter = 0;
  let citations = 0;
  let tables = 0;
  let images = 0;
  let listItems = 0;
  while (count < chars) {
    chapter += 1;
    const heading = `## 第${chapter}章 经营情况与边际变化`;
    out.push(heading);
    count += heading.length;
    for (let i = 0; i < 8 && count < chars; i += 1) {
      let para = SENTENCE + SENTENCE;
      if (i % 2 === 0) {
        citations += 1;
        para += `[^${citations}]`;
      }
      if (i % 3 === 0) para = para.replace('核心产品', '**核心产品**');
      out.push(para);
      count += para.length;
    }
    if (chapter % 2 === 0 && count < chars) {
      out.push('- 渠道库存保持健康\n- 费用率同比改善\n- 客户留存稳定\n- 新签订单增长');
      listItems += 4;
      count += 36;
    }
    if (chapter % 5 === 0 && count < chars) {
      out.push(
        '| 指标 | 本期 | 上期 |\n| --- | --- | --- |\n| 产能利用率 | 86% | 82% |\n| 库存周转 | 45天 | 52天 |\n| 新签订单 | 12.4亿 | 10.1亿 |',
      );
      tables += 1;
      count += 70;
    }
    if (chapter % 12 === 0 && count < chars) {
      images += 1;
      const image = `![图${images}](${PIXEL})`;
      out.push(image);
      count += image.length;
    }
  }
  return {
    markdown: out.join('\n\n'),
    chapters: chapter,
    citations,
    tables,
    images,
    listItems,
  };
}

/** 对照：同样字数的纯段落，没有引用和表格。 */
function generatePlain(chars: number): string {
  const out: string[] = ['# 压测文档：纯段落'];
  let count = out[0].length;
  while (count < chars) {
    out.push(SENTENCE + SENTENCE);
    count += SENTENCE.length * 2;
  }
  return out.join('\n\n');
}

function mutate(markdown: string): string {
  return markdown.replaceAll('费用率同比改善', '费用率同比承压');
}

function ms(start: number): number {
  return Math.round((performance.now() - start) * 10) / 10;
}

const previewCodeBlock = pureCodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
});

function HistoryBench() {
  const editor = useEditor({
    extensions: [
      ...baseExtensions,
      previewCodeBlock,
      pureImage,
      createChart(),
      createCitationRef(),
      Markdown.configure({ marked: getCjkEmphasisMarked() }),
      versionDiffExtension,
    ],
    content: '准备',
    contentType: 'markdown',
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: contentStyles.editorContent } },
  });

  useEffect(() => {
    if (!editor) return;
    const prepared = (markdown: string) => prepareChartMarkdown(markdown);

    const snapshot = () => ({
      text: editor.state.doc.textContent.length,
      dom: editor.view.dom.querySelectorAll('*').length,
    });

    /** 整篇一次性 setContent（1.12.3 基线路径）。 */
    const loadWhole = (markdown: string) => {
      const start = performance.now();
      editor.commands.setContent(prepared(markdown), { contentType: 'markdown' });
      return { ms: ms(start), ...snapshot() };
    };

    /** 分块首屏 + idle 续装，对齐 VersionDiffView。 */
    const loadChunked = (markdown: string, cacheId: string) =>
      new Promise<{ firstMs: number; readyMs: number; text: number; dom: number }>((resolve) => {
        const start = performance.now();
        let firstMs = 0;
        loadVersionPreview({
          editor,
          markdown: prepared(markdown),
          cacheId,
          onReady: () => {
            resolve({ firstMs, readyMs: ms(start), ...snapshot() });
          },
        });
        firstMs = ms(start);
      });

    const parseOther = (markdown: string) => {
      const start = performance.now();
      const doc = parseVersionDoc(markdown);
      return { ms: ms(start), text: doc.textContent.length };
    };

    const api = {
      async measure() {
        const report = generateReport(targetChars);
        const plain = generatePlain(targetChars);
        const reportOther = mutate(report.markdown);

        editor.commands.setContent('热身', { contentType: 'markdown' });
        clearVersionJsonCache();

        const plainWhole = loadWhole(plain);
        clearVersionJsonCache();
        const plainChunked = await loadChunked(plain, 'plain-a');
        const plainCached = await loadChunked(plain, 'plain-a');
        const plainParse = parseOther(mutate(plain));

        // 宿主页面上，历史面板打开时正文编辑器已经装着同一篇长文。
        const hostMount = document.createElement('div');
        document.body.appendChild(hostMount);
        const hostEditor = new Editor({
          element: hostMount,
          extensions: [
            ...baseExtensions,
            pureCodeBlock,
            pureImage,
            createChart(),
            createCitationRef(),
            Markdown.configure({ marked: getCjkEmphasisMarked() }),
          ],
          content: prepared(report.markdown),
          contentType: 'markdown',
          editable: false,
        });

        clearVersionJsonCache();
        const reportWhole = loadWhole(report.markdown);
        clearVersionJsonCache();
        const reportChunked = await loadChunked(report.markdown, 'report-a');
        const reportCached = await loadChunked(report.markdown, 'report-a');
        const reportParse = parseOther(reportOther);
        const reportSwitchWhole = loadWhole(reportOther);
        clearVersionJsonCache();
        const reportSwitchChunked = await loadChunked(reportOther, 'report-b');

        hostEditor.destroy();
        hostMount.remove();
        clearVersionJsonCache();

        return {
          targetChars,
          plain: {
            chars: plain.length,
            whole: plainWhole,
            chunked: plainChunked,
            cached: plainCached,
            parseOther: plainParse,
          },
          report: {
            chars: report.markdown.length,
            chapters: report.chapters,
            citations: report.citations,
            tables: report.tables,
            images: report.images,
            listItems: report.listItems,
            whole: reportWhole,
            chunked: reportChunked,
            cached: reportCached,
            parseOther: reportParse,
            switchWhole: reportSwitchWhole,
            switchChunked: reportSwitchChunked,
          },
        };
      },
    };
    (window as unknown as { __historyBench: typeof api & { ready: boolean } }).__historyBench = {
      ...api,
      ready: true,
    };
  }, [editor]);

  return <EditorContent editor={editor} />;
}

createRoot(document.getElementById('root')!).render(<HistoryBench />);
