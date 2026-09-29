'use client';

import { Markdown } from '@tiptap/markdown';
import { EditorContent, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import { useEffect, useMemo } from 'react';
import { createChart } from '../chart/createChart';
import { prepareChartMarkdown } from '../chart/prepareChartMarkdown';
import {
  enrichMarkdownCitations,
  type SourceRef,
} from '../citationUtils';
import type { RenderCitation } from '../citationTypes';
import { createCitationRef } from '../createCitationRef';
import { baseExtensions, pureCodeBlock, pureImage } from '../extensions';
import { CodeBlockView } from './CodeBlockView';
import '../styles/chart.css';
import styles from '../styles/content.module.css';

export interface MarkdownPreviewProps {
  /** 要预览的 markdown 字符串。 */
  markdown: string;
  /**
   * 脚注来源列表：按 `index` 与正文 `[^n]` 对齐，写入节点的 url/title。
   * 业务数据与 Popover 仍由消费方通过 {@link renderCitation} 完成。
   */
  sources?: SourceRef[];
  /**
   * 脚注圆标 NodeView 插槽。用 Popover 等包住 `defaultDom`；
   * 用 `index` / `attrs` 查消费方自己的数据源。
   */
  renderCitation?: RenderCitation;
  className?: string;
}

/**
 * 轻量只读 markdown 预览（Tiptap + 官方 @tiptap/markdown，editable:false）。
 * 与 MarkdownWysiwygEditor 共用同一套 base 扩展与正文样式类，渲染同源——
 * 预览所见即编辑/插入后所得。用纯版 CodeBlock/Image（无 React 视图 / 删除快捷键）；
 * 图表用只读 NodeView（可渲染，不可编辑弹层）。
 *
 * 这是「客户端只读预览」；若需 SEO / 无 JS 静态渲染，请改用 server 入口的
 * renderReportHtml + ReportContent / ReportContentWithCharts。
 */
export function MarkdownPreview({
  markdown,
  sources,
  renderCitation,
  className,
}: MarkdownPreviewProps) {
  const prepared = useMemo(
    () =>
      prepareChartMarkdown(
        enrichMarkdownCitations(markdown, sources ?? []),
      ),
    [markdown, sources],
  );

  // 预览代码块挂只读 NodeView（语言标签 + 复制 + 展开收起 + 行号槽）。
  // 仅客户端入口挂；server 入口（renderReportHtml）保持纯版，静态 HTML 零 React 依赖。
  const previewCodeBlock = useMemo(
    () =>
      pureCodeBlock.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockView);
        },
      }),
    [],
  );

  const extensions = useMemo(
    () => [
      ...baseExtensions,
      previewCodeBlock,
      pureImage,
      createChart({ editable: false }),
      createCitationRef({ renderCitation }),
      Markdown,
    ],
    [renderCitation],
  );

  const editor = useEditor(
    {
      extensions,
      content: prepared,
      contentType: 'markdown',
      editable: false,
      immediatelyRender: false,
      editorProps: {
        attributes: { class: styles.editorContent },
      },
    },
    [extensions],
  );

  // @tiptap/markdown 的空行保真会把源码空行重建成显式空段落，内容以块级节点
  // 结尾时会被补一个尾随空段（只读预览里是多余的空白）。这里在每次内容更新后
  // 剥离末尾空段；只在末段确为空段落时 dispatch，事务不会形成循环。
  useEffect(() => {
    if (!editor) return;
    const strip = () => {
      const { doc, tr } = editor.state;
      const last = doc.lastChild;
      if (
        doc.childCount > 1 &&
        last?.type.name === 'paragraph' &&
        last.content.size === 0
      ) {
        editor.view.dispatch(
          tr.delete(doc.content.size - last.nodeSize, doc.content.size),
        );
      }
    };
    strip();
    editor.on('update', strip);
    return () => {
      editor.off('update', strip);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(prepared, { contentType: 'markdown' });
  }, [editor, prepared]);

  return (
    <EditorContent
      editor={editor}
      className={className ?? styles.editorScroll}
    />
  );
}
