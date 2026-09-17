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
  /** 主栏导入下拉触发器上的短文案（对齐 style / fontSize）。 */
  importDocument: string;
  /** 导入触发器 title / aria-label。 */
  importDocumentHint: string;
  /** 未传 importMenuItems、但传了 onImportDocument + importAccept 时的第二项。 */
  importDocumentOther: string;
  /** 导入进行中的按钮 title。 */
  importDocumentBusy: string;
  /** 光标占位：上传阶段，传入 0–100。 */
  importDocumentUploading: (percent: number) => string;
  /** 光标占位：转换阶段，不要百分比。 */
  importDocumentConverting: string;
  /** 非 Markdown 文件导入失败（onError 的 source === 'import'）。 */
  importDocumentFailed: string;
  blockquote: string;
  bulletList: string;
  orderedList: string;
  taskList: string;
  more: string;
  codeBlock: string;
  hr: string;
  /** 导入下拉里的 Markdown 项。 */
  importMarkdown: string;
  tableInsert: string;
  /** 网格选择器底部尺寸文案，如 "3 × 4"。参数顺序：列、行。 */
  tableSizeSelected: (cols: number, rows: number) => string;
  tableAddColumnBefore: string;
  tableAddColumnAfter: string;
  tableDeleteColumn: string;
  tableAddRowBefore: string;
  tableAddRowAfter: string;
  tableDeleteRow: string;
  /** 多格选区：在左侧插入 N 列。 */
  tableAddColumnBeforeN: (n: number) => string;
  /** 多格选区：在右侧插入 N 列。 */
  tableAddColumnAfterN: (n: number) => string;
  /** 多格选区：删除 N 列。 */
  tableDeleteColumnN: (n: number) => string;
  /** 多格选区：在上方插入 N 行。 */
  tableAddRowBeforeN: (n: number) => string;
  /** 多格选区：在下方插入 N 行。 */
  tableAddRowAfterN: (n: number) => string;
  /** 多格选区：删除 N 行。 */
  tableDeleteRowN: (n: number) => string;
  tableDeleteTable: string;
  inlineMath: string;
  blockMath: string;
  mathPlaceholder: string;
  mathDone: string;
  mathCancel: string;
  mathNewInline: string;
  mathNewBlock: string;
}

export interface ChartLabels {
  /** Tab label when config has no title. */
  tabLabel: (chartType: string, index: number) => string;
  done: string;
  cancel: string;
  configLabel: string;
  tableLabel: string;
}

export const defaultChartLabels: ChartLabels = {
  tabLabel: (chartType, index) => `${chartType} ${index + 1}`,
  done: 'Done',
  cancel: 'Cancel',
  configLabel: 'Chart config (JSON)',
  tableLabel: 'Data table (Markdown)',
};

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
  importDocumentHint: 'Import a file',
  importDocumentOther: 'Document',
  importDocumentBusy: 'Importing…',
  importDocumentUploading: (percent) => `Uploading ${percent}%`,
  importDocumentConverting: 'Converting…',
  importDocumentFailed: 'Import failed',
  blockquote: 'Blockquote',
  bulletList: 'Bullet list',
  orderedList: 'Ordered list',
  taskList: 'Task list',
  more: 'More',
  codeBlock: 'Code block',
  hr: 'Divider',
  importMarkdown: 'Markdown',
  tableInsert: 'Insert table',
  tableSizeSelected: (cols, rows) => `${cols} × ${rows}`,
  tableAddColumnBefore: 'Add column before',
  tableAddColumnAfter: 'Add column after',
  tableDeleteColumn: 'Delete column',
  tableAddRowBefore: 'Add row before',
  tableAddRowAfter: 'Add row after',
  tableDeleteRow: 'Delete row',
  tableAddColumnBeforeN: (n) => `Add ${n} columns before`,
  tableAddColumnAfterN: (n) => `Add ${n} columns after`,
  tableDeleteColumnN: (n) => `Delete ${n} columns`,
  tableAddRowBeforeN: (n) => `Add ${n} rows before`,
  tableAddRowAfterN: (n) => `Add ${n} rows after`,
  tableDeleteRowN: (n) => `Delete ${n} rows`,
  tableDeleteTable: 'Delete table',
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
