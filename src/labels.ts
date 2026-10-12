/**
 * UI 文案类型与英文默认。语言包在 `src/i18n`：宿主传 `locale`，不传单条文案。
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
  /** 段落对齐下拉：触发器 title / aria-label。 */
  align: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  alignJustify: string;
  /** 缩进下拉：触发器 + 增加 / 减少两项。 */
  indent: string;
  indentIncrease: string;
  indentDecrease: string;
  /** 行高下拉：触发器 + 「默认」项（其余按数字直显）。 */
  lineHeight: string;
  lineHeightDefault: string;
  /**
   * 链接浮层输入框的占位与无障碍名（原 `window.prompt` 的提示语，现在落到输入框上）。
   */
  linkPrompt: string;
  /** 链接浮层「应用」按钮的 title / aria-label。 */
  linkApply: string;
  /** 链接浮层「在新窗口打开」按钮的 title / aria-label。 */
  linkOpen: string;
  /** 链接浮层「移除链接」按钮的 title / aria-label。 */
  linkRemove: string;
  /** 链接浮层：地址被编辑器拒绝时的提示（落在输入框 title 上）。 */
  linkInvalid: string;
  image: string;
  imageUploadFailed: string;
  /** 图片对齐工具条（悬停图片时浮现）的 aria-label。 */
  imageAlign: string;
  /** 左对齐按钮的 title / aria-label。 */
  imageAlignLeft: string;
  /** 居中对齐按钮的 title / aria-label。 */
  imageAlignCenter: string;
  /** 右对齐按钮的 title / aria-label。 */
  imageAlignRight: string;
  /** 图片描述（图注）按钮的 title / aria-label。 */
  imageCaption: string;
  /** 描述输入框的占位与无障碍名。 */
  imageCaptionPlaceholder: string;
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
  /** 折叠块（官方 Details）。工具栏按钮 title / aria-label。 */
  details: string;
  bulletList: string;
  orderedList: string;
  /** 有序列表旁的编号格式下拉：触发器 title / aria-label。 */
  numberingFormat: string;
  taskList: string;
  more: string;
  /**
   * 工具栏的搜索入口（放大镜按钮，落在 More 之后）：title 与 aria-label。
   * 只在宿主传了 `onSearch` 时才渲染——它只是入口，条子本身归编辑器
   * （`<MarkdownWysiwygEditor>`），点击后由宿主调 `handle.openFind()`。
   */
  search: string;
  codeBlock: string;
  hr: string;
  /** 导入下拉里的 Markdown 项。 */
  importMarkdown: string;
  tableInsert: string;
  /** 行手柄的 title / aria-label（鼠标悬停单元格时出现在行的左缘）。 */
  tableRowMenu: string;
  /** 列手柄的 title / aria-label（悬停时出现在表格上方、对齐该列）。 */
  tableColumnMenu: string;
  /** 表格菜单：清空选中行 / 列 / 单元格矩形里的内容（保留单元格与表头）。 */
  tableClearContent: string;
  /** 表格菜单：把选中单元格的样式属性复位（列宽、对齐等；不动合并结构）。 */
  tableResetCellStyles: string;
  /** 表格底边 `+` 手柄（末尾追加一行）的 title / aria-label。 */
  tableAppendRow: string;
  /** 表格右边 `+` 手柄（末尾追加一列）的 title / aria-label。 */
  tableAppendColumn: string;
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

/** 斜杠菜单（键入 / 唤起的块级插入弹窗）文案。 */
export interface SlashMenuLabels {
  /** 弹窗 aria-label。 */
  menuLabel: string;
  /** 分组标题：文本块。 */
  groupText: string;
  /** 分组标题：列表。 */
  groupList: string;
  /** 分组标题：结构 / 高级块。 */
  groupAdvanced: string;
  normalText: string;
  headingLabel: (level: number) => string;
  bulletList: string;
  orderedList: string;
  taskList: string;
  blockquote: string;
  details: string;
  codeBlock: string;
  divider: string;
  table: string;
  inlineMath: string;
  blockMath: string;
}

export interface ChartLabels {
  /** Tab label when config has no title. */
  tabLabel: (chartType: string, index: number) => string;
  done: string;
  cancel: string;
  configLabel: string;
  tableLabel: string;
  /** Modal dialog title. */
  editTitle: string;
}

export const defaultChartLabels: ChartLabels = {
  tabLabel: (chartType, index) => `${chartType} ${index + 1}`,
  done: 'Done',
  cancel: 'Cancel',
  configLabel: 'Chart config (JSON)',
  tableLabel: 'Data table (Markdown)',
  editTitle: 'Edit chart',
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
  align: 'Alignment',
  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
  alignJustify: 'Justify',
  indent: 'Indent',
  indentIncrease: 'Increase indent',
  indentDecrease: 'Decrease indent',
  lineHeight: 'Line height',
  lineHeightDefault: 'Default',
  linkPrompt: 'Enter URL',
  linkApply: 'Apply link',
  linkOpen: 'Open in new window',
  linkRemove: 'Remove link',
  linkInvalid: 'The editor rejected this address',
  image: 'Image',
  imageUploadFailed: 'Image upload failed',
  imageAlign: 'Image alignment',
  imageAlignLeft: 'Align left',
  imageAlignCenter: 'Align center',
  imageAlignRight: 'Align right',
  imageCaption: 'Caption',
  imageCaptionPlaceholder: 'Add a caption…',
  importMarkdownFailed: 'Markdown import failed',
  importDocument: 'Import',
  importDocumentHint: 'Import a file',
  importDocumentOther: 'Document',
  importDocumentBusy: 'Importing…',
  importDocumentUploading: (percent) => `Uploading ${percent}%`,
  importDocumentConverting: 'Converting…',
  importDocumentFailed: 'Import failed',
  blockquote: 'Blockquote',
  details: 'Toggle',
  bulletList: 'Bullet list',
  orderedList: 'Ordered list',
  numberingFormat: 'Numbering format',
  taskList: 'Task list',
  more: 'More',
  search: 'Find & replace',
  codeBlock: 'Code block',
  hr: 'Divider',
  importMarkdown: 'Markdown',
  tableInsert: 'Insert table',
  tableRowMenu: 'Row actions',
  tableColumnMenu: 'Column actions',
  tableClearContent: 'Clear content',
  tableResetCellStyles: 'Reset cell styles',
  tableAppendRow: 'Add row',
  tableAppendColumn: 'Add column',
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

/**
 * 块拖拽手柄和它的菜单。悬停块时出现在左侧，拖动重排，点击出菜单。
 */
export interface BlockDragLabels {
  /** 拖拽手柄的 title / aria-label。 */
  dragHandle: string;
  /** 菜单 aria-label。 */
  menuLabel: string;
  /** 「转成」分组标题。 */
  turnInto: string;
  paragraph: string;
  headingLabel: (level: number) => string;
  bulletList: string;
  orderedList: string;
  taskList: string;
  blockquote: string;
  codeBlock: string;
  copy: string;
  duplicate: string;
  resetFormatting: string;
  downloadImage: string;
  delete: string;
}

export const defaultBlockDragLabels: BlockDragLabels = {
  dragHandle: 'Drag to move',
  menuLabel: 'Block actions',
  turnInto: 'Turn into',
  paragraph: 'Normal text',
  headingLabel: (level) => `Heading ${level}`,
  bulletList: 'Bullet list',
  orderedList: 'Ordered list',
  taskList: 'Task list',
  blockquote: 'Blockquote',
  codeBlock: 'Code block',
  copy: 'Copy',
  duplicate: 'Duplicate',
  resetFormatting: 'Reset formatting',
  downloadImage: 'Download image',
  delete: 'Delete',
};

export const defaultSlashMenuLabels: SlashMenuLabels = {
  menuLabel: 'Insert block',
  groupText: 'Text',
  groupList: 'Lists',
  groupAdvanced: 'Advanced',
  normalText: 'Normal text',
  headingLabel: (level) => `Heading ${level}`,
  bulletList: 'Bullet list',
  orderedList: 'Ordered list',
  taskList: 'Task list',
  blockquote: 'Blockquote',
  details: 'Toggle',
  codeBlock: 'Code block',
  divider: 'Divider',
  table: 'Table',
  inlineMath: 'Inline equation',
  blockMath: 'Block equation',
};

/** 快捷键抽屉面板（键位 + Markdown 触发写法对照）文案。 */
export interface ShortcutLabels {
  /** 抽屉标题。 */
  panelTitle: string;
  /** 关闭按钮 aria / title。 */
  close: string;
  /** 三列表头：格式 / 快捷键 / Markdown。 */
  colFormat: string;
  colShortcut: string;
  colMarkdown: string;
  /** 分组标题。 */
  formatGroup: string;
  insertGroup: string;
  editGroup: string;
  bold: string;
  italic: string;
  strike: string;
  underline: string;
  inlineCode: string;
  highlight: string;
  headingLabel: (level: number) => string;
  paragraph: string;
  blockquote: string;
  bulletList: string;
  orderedList: string;
  taskList: string;
  codeBlock: string;
  divider: string;
  undo: string;
  redo: string;
  hardBreak: string;
  findReplace: string;
  /** 段落对齐四条（官方 TextAlign 的默认键位）。 */
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  alignJustify: string;
  /** 图片上传占位块（Mod+Shift+I）。 */
  imageUpload: string;
  /** 智能标点：直引号收成弯引号。 */
  smartQuote: string;
  /** 智能标点：`...` 收成省略号。 */
  ellipsis: string;
  /** 智能标点：`--` 收成破折号。 */
  emDash: string;
  /** 表情：`:smile:` 这类短码。 */
  emoji: string;
}

export const defaultShortcutLabels: ShortcutLabels = {
  panelTitle: 'Shortcuts',
  close: 'Close',
  colFormat: 'Format',
  colShortcut: 'Shortcut',
  colMarkdown: 'Markdown',
  formatGroup: 'Formatting',
  insertGroup: 'Insert',
  editGroup: 'Editing',
  bold: 'Bold',
  italic: 'Italic',
  strike: 'Strikethrough',
  underline: 'Underline',
  inlineCode: 'Inline code',
  highlight: 'Highlight',
  headingLabel: (level) => `Heading ${level}`,
  paragraph: 'Normal text',
  blockquote: 'Blockquote',
  bulletList: 'Bullet list',
  orderedList: 'Ordered list',
  taskList: 'Task list',
  codeBlock: 'Code block',
  divider: 'Divider',
  undo: 'Undo',
  redo: 'Redo',
  hardBreak: 'Hard break',
  findReplace: 'Find & replace',
  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
  alignJustify: 'Justify',
  imageUpload: 'Upload image',
  smartQuote: 'Smart quotes',
  ellipsis: 'Ellipsis',
  emDash: 'Em dash',
  emoji: 'Emoji',
};

/** 全文统计（官方 CharacterCount）文案。 */
export interface CharacterCountLabels {
  /** 统计条的无障碍名。 */
  label: string;
  /** 字符数，如 "128 characters"。 */
  characters: (count: number) => string;
  /** 词数，如 "24 words"。 */
  words: (count: number) => string;
}

export const defaultCharacterCountLabels: CharacterCountLabels = {
  label: 'Document statistics',
  characters: (count) =>
    `${count} ${count === 1 ? 'character' : 'characters'}`,
  words: (count) => `${count} ${count === 1 ? 'word' : 'words'}`,
};

/** 表情建议列表（键入 `:` 唤起）文案。 */
export interface EmojiSuggestionLabels {
  /** 弹窗 aria-label。 */
  menuLabel: string;
}

export const defaultEmojiSuggestionLabels: EmojiSuggestionLabels = {
  menuLabel: 'Emoji',
};

/** 链接编辑浮层（`<LinkPopover>`）文案。 */
export interface LinkPopoverLabels {
  /** 输入框占位与无障碍名，也是浮层的 aria-label。 */
  field: string;
  apply: string;
  open: string;
  remove: string;
  /** 地址被编辑器拒绝时的提示（落在输入框 title 上）。 */
  invalid: string;
}

export const defaultLinkPopoverLabels: LinkPopoverLabels = {
  field: 'Enter URL',
  apply: 'Apply link',
  open: 'Open in new window',
  remove: 'Remove link',
  invalid: 'The editor rejected this address',
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
  /** 只读态：复制代码内容。 */
  copy: string;
  /** 只读态：展开超出限高的代码块。 */
  expand: string;
  /** 只读态：收起已展开的代码块。 */
  collapse: string;
  /** 语言选择器的 aria-label。 */
  language: string;
}

export const defaultCodeBlockLabels: CodeBlockLabels = {
  autoDetect: 'Auto-detect',
  delete: 'Delete code block',
  copy: 'Copy code',
  expand: 'Expand code',
  collapse: 'Collapse code',
  language: 'Code language',
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

export interface FindLabels {
  /** 查找输入框的占位与无障碍名，也用作浮动条的 aria-label。 */
  find: string;
  /** 替换输入框的占位与无障碍名。 */
  replace: string;
  next: string;
  previous: string;
  replaceOne: string;
  replaceAll: string;
  close: string;
  caseSensitive: string;
  wholeWord: string;
  useRegex: string;
  /** 计数文案。无结果时 current 传 0；有结果但还没定位到某一条（currentIndex 为 null）时也是 0。 */
  counter: (current: number, total: number) => string;
  /** 正则模式下模式非法（RE2 不支持 lookaround / backreference 等，见官方扩展）。 */
  invalidRegex: string;
  /** 只读态提示：可查不可换。 */
  readOnly: string;
}

export const defaultFindLabels: FindLabels = {
  find: 'Find',
  replace: 'Replace with',
  next: 'Next match',
  previous: 'Previous match',
  replaceOne: 'Replace',
  replaceAll: 'Replace all',
  close: 'Close',
  caseSensitive: 'Match case',
  wholeWord: 'Whole word',
  useRegex: 'Use regular expression',
  counter: (current, total) => `${current} / ${total}`,
  invalidRegex: 'Invalid pattern',
  readOnly: 'Read-only',
};

/** 图片上传占位块（`<MarkdownWysiwygEditor imageUpload={{…}}>`）文案。 */
export interface ImageUploadLabels {
  /** 空态主文案前半（下划线强调，对齐官方的 "Click to upload"），如 `Click to upload`。 */
  dropzoneClick: string;
  /** 空态主文案后半，如 ` or drag and drop`（中文可写成「，或拖拽到此处」）。 */
  dropzoneRest: string;
  /** 空态副文案：数量与单文件体积上限；`maxSizeMb` 为 null 表示未设上限。 */
  dropzoneLimits: (limit: number, maxSizeMb: number | null) => string;
  /** 多文件排队时的标题，参数为文件数。 */
  uploadingCount: (count: number) => string;
  /** 清空全部排队文件的按钮。 */
  clearAll: string;
  /** 单个文件行的移除按钮（title / aria-label）。 */
  remove: string;
  /** 文件行上传失败时的状态文字（替掉体积位置）。 */
  failed: string;
  /** 上传成功后写入图片 alt / title 的兜底（文件名去扩展名后为空时）。 */
  fallbackAlt: string;
}

export const defaultImageUploadLabels: ImageUploadLabels = {
  dropzoneClick: 'Click to upload',
  dropzoneRest: ' or drag and drop',
  dropzoneLimits: (limit, maxSizeMb) => {
    const count = `Maximum ${limit} file${limit === 1 ? '' : 's'}`;
    return maxSizeMb == null ? `${count}.` : `${count}, ${maxSizeMb}MB each.`;
  },
  uploadingCount: (count) => `Uploading ${count} files`,
  clearAll: 'Clear all',
  remove: 'Remove',
  failed: 'Upload failed',
  fallbackAlt: 'image',
};
