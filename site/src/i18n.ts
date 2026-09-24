import type {
  CodeBlockLabels,
  ColorPaletteLabels,
  FindLabels,
  TocLabels,
  ToolbarLabels,
} from 'tiptap-markdown-react';

/**
 * 库的国际化方案就是「按组件注入 labels」：每个组件收 `Partial<XLabels>`，与内置英文默认合并
 * （`{ ...defaultXLabels, ...labels }`）。没有全局 locale，也没有 Provider——所以多语言在
 * 宿主侧就是「准备几份这种对象，按当前语言挑一份传下去」。
 *
 * 这里只覆盖演示用得到的键，其余自动落回英文默认。
 */
export type LocaleCode = 'zh' | 'en';

export interface LocaleBundle {
  toolbar: Partial<ToolbarLabels>;
  find: Partial<FindLabels>;
  codeBlock: Partial<CodeBlockLabels>;
  toc: Partial<TocLabels>;
  palette: Partial<ColorPaletteLabels>;
}

const zh: LocaleBundle = {
  toolbar: {
    undo: '撤销',
    redo: '重做',
    style: '样式',
    normalText: '正文',
    headingLabel: (level) => `标题 ${level}`,
    fontSize: '字号',
    fontSizeDefault: '默认',
    bold: '加粗',
    italic: '斜体',
    underline: '下划线',
    strike: '删除线',
    code: '行内代码',
    textColor: '文字颜色',
    highlight: '高亮',
    link: '链接',
    linkPrompt: '输入链接地址',
    image: '图片',
    importDocument: '导入',
    blockquote: '引用',
    bulletList: '无序列表',
    orderedList: '有序列表',
    taskList: '任务列表',
    more: '更多',
    codeBlock: '代码块',
    hr: '分隔线',
    tableInsert: '插入表格',
    tableSizeSelected: (cols, rows) => `${cols} × ${rows}`,
    inlineMath: '行内公式',
    blockMath: '块级公式',
    mathDone: '完成',
    mathCancel: '取消',
    mathPlaceholder: 'E = mc^2',
    mathNewInline: '新建公式',
    mathNewBlock: '插入 TeX 公式',
  },
  find: {
    find: '查找',
    replace: '替换为',
    next: '下一处',
    previous: '上一处',
    replaceOne: '替换',
    replaceAll: '全部替换',
    close: '关闭',
    caseSensitive: '区分大小写',
    wholeWord: '全词匹配',
    useRegex: '正则表达式',
    counter: (current, total) => `${current} / ${total}`,
    invalidRegex: '正则无效',
    readOnly: '只读',
  },
  codeBlock: {
    autoDetect: '自动识别',
    delete: '删除代码块',
  },
  toc: { title: '目录', expand: '展开', collapse: '收起' },
  palette: { none: '无', theme: '主题色' },
};

/** English 只给空对象：全部走库内置默认，正好演示 `Partial` 的语义。 */
const en: LocaleBundle = {
  toolbar: {},
  find: {},
  codeBlock: {},
  toc: {},
  palette: {},
};

export const LOCALES: Record<LocaleCode, LocaleBundle> = { zh, en };
