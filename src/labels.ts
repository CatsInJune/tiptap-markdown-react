/**
 * UI 文案（i18n 注入点）。各组件接收 `labels?: Partial<...>`，与内置英文默认合并。
 * 消费方（如中文项目）可传入本地化文案。
 */

export interface ToolbarLabels {
  undo: string;
  redo: string;
  style: string;
  normalText: string;
  /** 传入层级，返回如 "Heading 2"。 */
  headingLabel: (level: number) => string;
  fontSize: string;
  fontSizeDefault: string;
  bold: string;
  italic: string;
  underline: string;
  strike: string;
  code: string;
  textColor: string;
  highlight: string;
  colorNone: string;
  colorTheme: string;
  scriptMenu: string;
  scriptNormal: string;
  superscript: string;
  subscript: string;
  link: string;
  linkPrompt: string;
  image: string;
  imageUploadFailed: string;
  /** Markdown 文件导入失败（与图片上传共用 onError 回调时，便于宿主区分文案）。 */
  importMarkdownFailed: string;
  /** 主栏导入按钮。默认只吃 .md，宿主传 onImportDocument 后可扩展格式。 */
  importDocument: string;
  /** 导入进行中的按钮 title（未区分阶段时的兜底）。 */
  importDocumentBusy: string;
  /** 上传阶段按钮 title，传入 0–100。 */
  importDocumentUploading: (percent: number) => string;
  /** 转换阶段按钮 title，不要百分比。 */
  importDocumentConverting: string;
  /** 导入进行中的取消按钮。 */
  importDocumentCancel: string;
  /** 非 Markdown 文件导入失败（onError 的 source === 'import'）。 */
  importDocumentFailed: string;
  blockquote: string;
  bulletList: string;
  orderedList: string;
  taskList: string;
  more: string;
  codeBlock: string;
  hr: string;
  /** @deprecated 导入入口已移到主栏，改用 `importDocument`。 */
  importMarkdown: string;
  tableInsert: string;
  tableAddColumnBefore: string;
  tableAddColumnAfter: string;
  tableDeleteColumn: string;
  tableAddRowBefore: string;
  tableAddRowAfter: string;
  tableDeleteRow: string;
  inlineMath: string;
  blockMath: string;
  mathPlaceholder: string;
  mathDone: string;
  mathCancel: string;
  mathNewInline: string;
  mathNewBlock: string;
}

export const defaultToolbarLabels: ToolbarLabels = {
  undo: 'Undo',
  redo: 'Redo',
  style: 'Style',
  normalText: 'Normal text',
  headingLabel: (level) => `Heading ${level}`,
  fontSize: 'Font size',
  fontSizeDefault: 'Default',
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strike: 'Strikethrough',
  code: 'Inline code',
  textColor: 'Text color',
  highlight: 'Highlight',
  colorNone: 'None',
  colorTheme: 'THEME',
  scriptMenu: 'Superscript / Subscript',
  scriptNormal: 'Normal',
  superscript: 'Superscript',
  subscript: 'Subscript',
  link: 'Link',
  linkPrompt: 'Enter URL',
  image: 'Image',
  imageUploadFailed: 'Image upload failed',
  importMarkdownFailed: 'Markdown import failed',
  importDocument: 'Import',
  importDocumentBusy: 'Importing…',
  importDocumentUploading: (percent) => `Uploading ${percent}%`,
  importDocumentConverting: 'Converting…',
  importDocumentCancel: 'Cancel',
  importDocumentFailed: 'Import failed',
  blockquote: 'Blockquote',
  bulletList: 'Bullet list',
  orderedList: 'Ordered list',
  taskList: 'Task list',
  more: 'More',
  codeBlock: 'Code block',
  hr: 'Divider',
  importMarkdown: 'Import Markdown',
  tableInsert: 'Insert table',
  tableAddColumnBefore: 'Add column before',
  tableAddColumnAfter: 'Add column after',
  tableDeleteColumn: 'Delete column',
  tableAddRowBefore: 'Add row before',
  tableAddRowAfter: 'Add row after',
  tableDeleteRow: 'Delete row',
  inlineMath: 'Inline equation',
  blockMath: 'Block equation',
  mathPlaceholder: 'E = mc^2',
  mathDone: 'Done',
  mathCancel: 'Cancel',
  mathNewInline: 'New equation',
  mathNewBlock: 'Add a TeX equation',
};

export interface ColorPaletteLabels {
  none: string;
  theme: string;
}

export const defaultColorPaletteLabels: ColorPaletteLabels = {
  none: 'None',
  theme: 'THEME',
};

export interface TocLabels {
  title: string;
  expand: string;
  collapse: string;
}

export const defaultTocLabels: TocLabels = {
  title: 'Contents',
  expand: 'Expand',
  collapse: 'Collapse',
};

export interface CodeBlockLabels {
  autoDetect: string;
  delete: string;
}

export const defaultCodeBlockLabels: CodeBlockLabels = {
  autoDetect: 'Auto-detect',
  delete: 'Delete code block',
};

export interface CommentLabels {
  open: string;
  resolved: string;
  dismissed: string;
  outdated: string;
  ambiguous: string;
  partial: string;
  gutterTitle: string;
}

export const defaultCommentLabels: CommentLabels = {
  open: 'Open',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
  outdated: 'Outdated',
  ambiguous: 'Ambiguous',
  partial: 'Partially matched',
  gutterTitle: 'Comment',
};
