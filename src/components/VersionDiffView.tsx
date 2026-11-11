'use client';

import { Markdown } from '@tiptap/markdown';
import { DecorationSet } from '@tiptap/pm/view';
import { EditorContent, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import { useEffect, useMemo, useState } from 'react';
import { createChart } from '../chart/createChart';
import { prepareChartMarkdown } from '../chart/prepareChartMarkdown';
import { createCitationRef } from '../createCitationRef';
import { enrichMarkdownCitations, type SourceRef } from '../citationUtils';
import { stripBlockIdComments } from '../blockId/id';
import { baseExtensions, pureCodeBlock, pureImage } from '../extensions';
import { getCjkEmphasisMarked } from '../cjkEmphasis';
import type { LocaleCode } from '../i18n';
import { usePublishEditorLocale } from '../i18n/store';
import { diffVersions } from '../versionHistory/buildDiffDoc';
import {
  marksToDecorations,
  scheduleVersionDiff,
  versionDiffExtension,
  versionDiffKey,
} from '../versionHistory/diffDecorations';
import { loadVersionPreview } from '../versionHistory/loadVersionPreview';
import { parseVersionDoc } from '../versionHistory/schema';
import { CodeBlockView } from './CodeBlockView';
import { ImagePreviewHost } from './ImageLightbox';
import contentStyles from '../styles/content.module.css';

export function VersionDiffView({
  selected,
  other,
  selectedId,
  sources,
  locale,
}: {
  /** 画布：左侧选中的版本。先原文，差异空闲时再叠上去。 */
  selected: string;
  /**
   * 比较对象。只在它里面的内容画成删除。
   * 对比正文还在加载时传 null，只装选中版、不跑差异。
   */
  other: string | null;
  /** 版本 id，用于按版缓存解析后的 JSON。 */
  selectedId?: string;
  sources?: SourceRef[];
  locale: LocaleCode;
}) {
  const prepared = useMemo(
    () =>
      prepareChartMarkdown(
        enrichMarkdownCitations(stripBlockIdComments(selected), sources ?? []),
      ),
    [selected, sources],
  );

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
      createCitationRef(),
      Markdown.configure({ marked: getCjkEmphasisMarked() }),
      versionDiffExtension,
    ],
    [previewCodeBlock],
  );

  const editor = useEditor(
    {
      extensions,
      // 正文由 loadVersionPreview 分块灌入，避免挂载时整篇 parse 卡住首屏。
      content: '',
      editable: false,
      immediatelyRender: false,
      editorProps: {
        attributes: { class: contentStyles.editorContent },
      },
    },
    [extensions],
  );

  usePublishEditorLocale(editor, locale);

  const [docReady, setDocReady] = useState(false);

  useEffect(() => {
    if (!editor) return;
    setDocReady(false);
    return loadVersionPreview({
      editor,
      markdown: prepared,
      cacheId: selectedId,
      onReady: () => setDocReady(true),
    });
  }, [editor, prepared, selectedId]);

  useEffect(() => {
    if (!editor || !docReady || other == null) return;
    const stop = scheduleVersionDiff(() => {
      if (editor.isDestroyed) return;
      const marks = diffVersions(editor.state.doc, parseVersionDoc(other, sources));
      const decorations = marksToDecorations(editor.state.doc, marks);
      editor.view.dispatch(editor.state.tr.setMeta(versionDiffKey, decorations));
    });
    return () => {
      stop();
      if (editor.isDestroyed) return;
      editor.view.dispatch(editor.state.tr.setMeta(versionDiffKey, DecorationSet.empty));
    };
  }, [editor, docReady, other, sources]);

  return (
    <ImagePreviewHost locale={locale} activate="click">
      <EditorContent editor={editor} />
    </ImagePreviewHost>
  );
}
