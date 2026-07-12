'use client';

import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect } from 'react';
import { baseExtensions, pureCodeBlock, pureImage } from '../extensions';
import styles from '../styles/content.module.css';

export interface MarkdownPreviewProps {
  /** 要预览的 markdown 字符串。 */
  markdown: string;
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
export function MarkdownPreview({ markdown, className }: MarkdownPreviewProps) {
  const editor = useEditor({
    extensions: [...baseExtensions, pureCodeBlock, pureImage, Markdown],
    content: markdown,
    contentType: 'markdown',
    editable: false,
    immediatelyRender: false,
    // 关键：内部 ProseMirror DOM 挂与编辑器一字不差的 editorContent class，
    // 所有内容样式都作用在该选择器下，预览才能与编辑/插入后逐像素一致。
    editorProps: {
      attributes: { class: styles.editorContent },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(markdown, { contentType: 'markdown' });
  }, [editor, markdown]);

  return (
    <EditorContent
      editor={editor}
      className={className ?? styles.editorScroll}
    />
  );
}
