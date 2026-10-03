import type { Editor } from '@tiptap/core';
import {
  defaultSlashMenuLabels,
  type SlashMenuLabels,
} from '../labels';
import type { SlashMenuItem } from './types';

/**
 * 默认斜杠命令项：全部是「可序列化为 markdown」的块级操作。
 * 图片、附件、AI、二级子菜单、最近使用不在 v1 范围。
 *
 * 图标沿用工具栏下拉菜单的文字字形语言（`{ }` / `√x` / `∑` / `—` / `❝`），
 * 三组（文本 / 列表 / 高级）在弹窗里分节展示。
 */
export function createDefaultSlashMenuItems(
  labels: SlashMenuLabels = defaultSlashMenuLabels,
): SlashMenuItem[] {
  return [
    {
      id: 'normal-text',
      title: labels.normalText,
      group: labels.groupText,
      icon: '¶',
      aliases: ['zhengwen', '正文', 'paragraph', 'text'],
      order: 0,
      apply: (editor, range) => {
        editor.chain().focus().deleteRange(range).setParagraph().run();
      },
    },
    ...([1, 2, 3] as const).map((level): SlashMenuItem => ({
      id: `heading-${level}`,
      title: labels.headingLabel(level),
      group: labels.groupText,
      icon: `H${level}`,
      aliases: [`h${level}`, 'biaoti', '标题', 'heading'],
      order: level,
      apply: (editor, range) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setHeading({ level })
          .run();
      },
    })),
    {
      id: 'bullet-list',
      title: labels.bulletList,
      group: labels.groupList,
      icon: '•',
      aliases: ['wuxu', '无序', '列表', 'bullet', 'ul'],
      order: 4,
      apply: (editor, range) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      id: 'ordered-list',
      title: labels.orderedList,
      group: labels.groupList,
      icon: '1.',
      aliases: ['youxu', '有序', '列表', 'ordered', 'ol'],
      order: 5,
      apply: (editor, range) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      id: 'task-list',
      title: labels.taskList,
      group: labels.groupList,
      icon: '✓',
      aliases: ['renwu', '任务', '待办', 'task', 'todo', 'checklist'],
      order: 6,
      apply: (editor, range) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      id: 'blockquote',
      title: labels.blockquote,
      group: labels.groupAdvanced,
      icon: '❝',
      aliases: ['yinyong', '引用', 'quote', 'blockquote'],
      order: 7,
      apply: (editor, range) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      id: 'code-block',
      title: labels.codeBlock,
      group: labels.groupAdvanced,
      icon: '{ }',
      aliases: ['daima', '代码', 'code', 'fence'],
      order: 8,
      apply: (editor, range) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      id: 'divider',
      title: labels.divider,
      group: labels.groupAdvanced,
      icon: '—',
      aliases: ['fenge', '分割线', '分隔线', 'hr', 'divider'],
      order: 9,
      apply: (editor, range) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
    {
      id: 'table',
      title: labels.table,
      group: labels.groupAdvanced,
      icon: '▦',
      aliases: ['biaoge', '表格', 'table'],
      order: 10,
      apply: (editor, range) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      },
    },
    {
      id: 'inline-math',
      title: labels.inlineMath,
      group: labels.groupAdvanced,
      icon: '√x',
      aliases: ['gongshi', '公式', '行内公式', 'math', 'latex'],
      order: 11,
      apply: (editor, range) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({ type: 'inlineMath', attrs: { latex: 'E=mc^2' } })
          .run();
      },
    },
    {
      id: 'block-math',
      title: labels.blockMath,
      group: labels.groupAdvanced,
      icon: '∑',
      aliases: ['gongshi', '公式', '块级公式', 'mathblock', 'latex'],
      order: 12,
      apply: (editor, range) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({ type: 'blockMath', attrs: { latex: 'E=mc^2' } })
          .run();
      },
    },
  ];
}

/** 按 title / aliases 做小写 includes 过滤；空 query 返回全部。 */
export function filterSlashItems(
  items: SlashMenuItem[],
  query: string,
): SlashMenuItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.aliases?.some((alias) => alias.toLowerCase().includes(q)),
  );
}
