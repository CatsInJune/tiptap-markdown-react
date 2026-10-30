'use client';

import { EditorContent, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import { useEffect, useMemo } from 'react';
import { createChart } from '../chart/createChart';
import { createCitationRef } from '../createCitationRef';
import { baseExtensions, pureCodeBlock, pureImage } from '../extensions';
import type { LocaleCode } from '../i18n';
import { usePublishEditorLocale } from '../i18n/store';
import type { SourceRef } from '../citationUtils';
import { buildVersionDiffDoc } from '../versionHistory/buildDiffDoc';
import {
  DiffDelete,
  DiffFormat,
  DiffInsert,
  DiffRegion,
} from '../versionHistory/schema';
import { CodeBlockView } from './CodeBlockView';
import { ImagePreviewHost } from './ImageLightbox';
import contentStyles from '../styles/content.module.css';

export function VersionDiffView({
  selected,
  other,
  sources,
  locale,
}: {
  /** 画布：左侧选中的版本。 */
  selected: string;
  /** 比较对象。只在它里面的内容画成删除。 */
  other: string;
  sources?: SourceRef[];
  locale: LocaleCode;
}) {
  const json = useMemo(
    () => buildVersionDiffDoc(selected, other, sources).toJSON(),
    [selected, other, sources],
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
      DiffInsert,
      DiffDelete,
      DiffFormat,
      DiffRegion,
    ],
    [previewCodeBlock],
  );

  const editor = useEditor(
    {
      extensions,
      content: json,
      editable: false,
      immediatelyRender: false,
      editorProps: {
        attributes: { class: contentStyles.editorContent },
      },
    },
    [extensions],
  );

  usePublishEditorLocale(editor, locale);

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(json);
  }, [editor, json]);

  return (
    <ImagePreviewHost locale={locale} activate="click">
      <EditorContent editor={editor} />
    </ImagePreviewHost>
  );
}
