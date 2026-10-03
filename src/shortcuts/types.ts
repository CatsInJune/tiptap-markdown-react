import type { ShortcutLabels } from '../labels';

/**
 * 快捷键面板数据模型。keys 里的 'Mod' / 'Alt' 按平台渲染
 * （macOS: Cmd / Opt；其他: Ctrl / Alt）。
 * markdown.terminator 为触发终止键；无 terminator 的包裹型语法
 * （如 **x**）在键入收尾字符时即触发。
 */
export interface ShortcutEntry {
  id: string;
  /** 展示名（已本地化）。 */
  label: string;
  /** 键帽序列；不传表示无默认键位。 */
  keys?: string[];
  /** Markdown 触发写法；不传表示无对应 input rule。 */
  markdown?: {
    /** 触发片段，如 '**x**' 或 '#'。 */
    marker: string;
    /** 终止键（如 Space / Enter）。 */
    terminator?: string;
  };
}

export interface ShortcutGroup {
  id: string;
  title: string;
  entries: ShortcutEntry[];
}

/**
 * 快捷键注册表。**每一条都必须真实**：键位来自所装 Tiptap 扩展的
 * addKeyboardShortcuts 默认值，markdown 触发来自对应 input rule
 * （上标/下标/链接在本库无默认键位与 input rule，故不列）。
 */
export function buildShortcutGroups(labels: ShortcutLabels): ShortcutGroup[] {
  return [
    {
      id: 'format',
      title: labels.formatGroup,
      entries: [
        { id: 'bold', label: labels.bold, keys: ['Mod', 'b'], markdown: { marker: '**x**' } },
        { id: 'italic', label: labels.italic, keys: ['Mod', 'i'], markdown: { marker: '*x*' } },
        { id: 'strike', label: labels.strike, keys: ['Mod', 'Shift', 's'], markdown: { marker: '~~x~~' } },
        { id: 'underline', label: labels.underline, keys: ['Mod', 'u'] },
        { id: 'inline-code', label: labels.inlineCode, keys: ['Mod', 'e'], markdown: { marker: '`x`' } },
        { id: 'highlight', label: labels.highlight, keys: ['Mod', 'Shift', 'h'], markdown: { marker: '==x==' } },
        ...([1, 2, 3, 4, 5, 6] as const).map((level): ShortcutEntry => ({
          id: `heading-${level}`,
          label: labels.headingLabel(level),
          keys: ['Mod', 'Alt', String(level)],
          markdown: { marker: '#'.repeat(level), terminator: 'Space' },
        })),
        { id: 'paragraph', label: labels.paragraph, keys: ['Mod', 'Alt', '0'] },
      ],
    },
    {
      id: 'insert',
      title: labels.insertGroup,
      entries: [
        { id: 'blockquote', label: labels.blockquote, keys: ['Mod', 'Shift', 'b'], markdown: { marker: '>', terminator: 'Space' } },
        { id: 'bullet-list', label: labels.bulletList, keys: ['Mod', 'Shift', '8'], markdown: { marker: '-', terminator: 'Space' } },
        { id: 'ordered-list', label: labels.orderedList, keys: ['Mod', 'Shift', '7'], markdown: { marker: '1.', terminator: 'Space' } },
        { id: 'task-list', label: labels.taskList, markdown: { marker: '[]', terminator: 'Space' } },
        { id: 'code-block', label: labels.codeBlock, markdown: { marker: '```', terminator: 'Space' } },
        { id: 'divider', label: labels.divider, markdown: { marker: '---', terminator: 'Space' } },
      ],
    },
    {
      id: 'edit',
      title: labels.editGroup,
      entries: [
        { id: 'undo', label: labels.undo, keys: ['Mod', 'z'] },
        { id: 'redo', label: labels.redo, keys: ['Mod', 'Shift', 'z'] },
        { id: 'hard-break', label: labels.hardBreak, keys: ['Shift', 'Enter'] },
        { id: 'find-replace', label: labels.findReplace, keys: ['Mod', 'f'] },
      ],
    },
  ];
}
