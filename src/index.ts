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

// ── 扩展（供组合 extraExtensions 或自建管线） ──
export {
  baseExtensions,
  lowlight,
  pureCodeBlock,
  pureImage,
} from './extensions';

// ── 目录工具 / 类型 ──
export { extractToc, type TocItem } from './toc/extractToc';
export { makeTocGetId } from './toc/tocSlug';

// ── 文案默认值 / 类型（i18n 注入） ──
export {
  defaultCodeBlockLabels,
  defaultColorPaletteLabels,
  defaultTocLabels,
  defaultToolbarLabels,
  type CodeBlockLabels,
  type ColorPaletteLabels,
  type TocLabels,
  type ToolbarLabels,
} from './labels';

// ── 其它 ──
export { useIsMobile } from './hooks/useIsMobile';
export * from './icons';

// ── 常用 Tiptap 类型（宿主无需再安装 / import @tiptap/*） ──
export type { Editor } from '@tiptap/react';
export type { JSONContent } from '@tiptap/core';
