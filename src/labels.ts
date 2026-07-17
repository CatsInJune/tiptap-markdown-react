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
  blockquote: string;
  bulletList: string;
  orderedList: string;
  taskList: string;
  more: string;
  codeBlock: string;
  hr: string;
  importMarkdown: string;
  tableInsert: string;
  tableAddColumnBefore: string;
  tableAddColumnAfter: string;
  tableDeleteColumn: string;
  tableAddRowBefore: string;
  tableAddRowAfter: string;
  tableDeleteRow: string;
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
