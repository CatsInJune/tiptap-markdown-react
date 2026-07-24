'use client';

import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useMemo } from 'react';
import {
  enrichMarkdownCitations,
  type SourceRef,
} from '../citationUtils';
import type { RenderCitation } from '../citationTypes';
import { createCitationRef } from '../createCitationRef';
import { baseExtensions, pureCodeBlock, pureImage } from '../extensions';
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
 * 预览所见即编辑/插入后所得。用纯版 CodeBlock/Image（无 React 视图 / 删除快捷键）。
 *
 * 这是「客户端只读预览」；若需 SEO / 无 JS 静态渲染，请改用 server 入口的
 * renderReportHtml + ReportContent。
 */
export function MarkdownPreview({
  markdown,
  sources,
  renderCitation,
  className,
}: MarkdownPreviewProps) {
  const prepared = useMemo(
    () => enrichMarkdownCitations(markdown, sources ?? []),
    [markdown, sources],
  );

  const extensions = useMemo(
    () => [
      ...baseExtensions,
      pureCodeBlock,
      pureImage,
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
