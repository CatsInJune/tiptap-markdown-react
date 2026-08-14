'use client';

// 副作用：增强 Editor.insertContent / getMarkdown 的 @tiptap/markdown 类型。
import '@tiptap/markdown';

// ── 编辑器 / 预览 ──
export {
  MarkdownWysiwygEditor,
  type MarkdownWysiwygEditorHandle,
  type MarkdownWysiwygEditorProps,
} from './components/MarkdownWysiwygEditor';
export {
  MarkdownPreview,
  type MarkdownPreviewProps,
} from './components/MarkdownPreview';

// ── 工具栏 / 色板 / 目录 ──
export {
  EditorToolbar,
  type EditorToolbarProps,
  type ExtraToolbarItem,
} from './components/EditorToolbar';
export { ColorPalette, type ColorPaletteProps } from './components/ColorPalette';
export { TocPanel, type TocPanelProps } from './components/TocPanel';
export { CodeBlockView } from './components/CodeBlockView';

// ── 只读静态正文（也在 ./server 导出，供纯客户端场景直接用） ──
export { ReportContent, type ReportContentProps } from './ReportContent';
export {
  CitationInteractive,
  type CitationInteractiveProps,
} from './components/CitationInteractive';
export {
  ReportContentInteractive,
  type ReportContentInteractiveProps,
} from './components/ReportContentInteractive';

// ── 扩展（供组合 extraExtensions 或自建管线） ──
export {
  baseExtensions,
  lowlight,
  pureCodeBlock,
  pureImage,
} from './extensions';
export { CitationRef } from './CitationRef';
export { createCitationRef } from './createCitationRef';
export type {
  RenderCitation,
  RenderCitationContext,
  CitationEnterContext,
  OnCitationEnter,
  OnCitationLeave,
} from './citationTypes';
export {
  findCitationRefElement,
  readCitationAttrs,
} from './citationDom';
export {
  applyCitationSources,
  enrichMarkdownCitations,
  type SourceRef,
} from './citationUtils';
export { MarkdownPaste, looksLikeMarkdown } from './markdownPaste';
export { MarkdownFileDrop } from './markdownFileDrop';

// ── 目录工具 / 类型 ──
export { extractToc, type TocItem } from './toc/extractToc';
export { makeTocGetId } from './toc/tocSlug';
export { scrollToTocHeading } from './toc/scrollToTocHeading';

// ── 文案默认值 / 类型（i18n 注入） ──
export {
  defaultCodeBlockLabels,
  defaultColorPaletteLabels,
  defaultCommentLabels,
  defaultTocLabels,
  defaultToolbarLabels,
  type CodeBlockLabels,
  type ColorPaletteLabels,
  type CommentLabels,
  type TocLabels,
  type ToolbarLabels,
} from './labels';

// ── 评论锚定（编辑态专属） ──
export { CommentMark, type CommentMarkOptions, type CommentInterval } from './commentAnchor/CommentMark';
export {
  mapCommentAnchors,
  mergeCommentIntervals,
  blockTextHash,
  type CommentSegment,
  type CommentAnchorInput,
  type CommentAnchorResult,
  type CommentAnchorStatus,
  type CommentRange,
} from './commentAnchor/commentMapper';
export {
  commentAnchorPlugin,
  commentAnchorExtension,
  commentAnchorPluginKey,
  stripCommentAnchorMarks,
  COMMENT_ACTIVE_META,
  COMMENT_CLICK_META,
  COMMENT_GUTTER_META,
  type CommentAnchorPluginOptions,
  type CommentAnchorPluginState,
  type CommentGutterPayload,
} from './commentAnchor/commentAnchorPlugin';
export {
  applyCommentAnchorsToEditor,
  collectCommentIds,
  commentRangesById,
  focusComment,
  nextComment,
} from './commentAnchor/commentAnchorController';
export { CommentPopover, type CommentPopoverProps } from './commentAnchor/CommentPopover';
export type {
  CommentRef,
  CommentClickPayload,
  RenderComment,
  RenderCommentContext,
} from './commentAnchor/commentTypes';

// ── 其它 ──
export { useIsMobile } from './hooks/useIsMobile';
export * from './icons';

export { insertMarkdown } from './insertMarkdown';

// ── 常用 Tiptap 类型（宿主无需再安装 / import @tiptap/*） ──
export type { Editor } from '@tiptap/react';
export type { JSONContent } from '@tiptap/core';
