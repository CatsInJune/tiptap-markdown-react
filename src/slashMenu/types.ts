import type { Editor, Range } from '@tiptap/core';
import type { ReactNode } from 'react';

/**
 * 斜杠菜单命令项。默认注册表见 `createDefaultSlashMenuItems`；
 * 宿主可在 `SlashMenu.configure({ items })` 追加自定义项。
 *
 * `apply` 必须把「删掉触发词（range）」与实际插入放进**同一条** `editor.chain()`
 * ——链内所有命令合并为一次事务，撤销才是一步。插入 markdown 片段可用
 * `insertSlashMarkdown`（同链 + 失败按块降级）。
 */
export interface SlashMenuItem {
  /** 稳定 id（React key / 测试用）。 */
  id: string;
  /** 展示标题（已按 labels 本地化）。 */
  title: string;
  /**
   * 分组名（已本地化的展示文案，如「文本」「列表」）。弹窗把**相邻同名**项
   * 分进同一节并渲染节标题；不传则不归属任何节。默认项用
   * `labels.groupText / groupList / groupAdvanced` 填充。
   */
  group?: string;
  /** 弹窗左侧图标（库默认集为内联 SVG）。 */
  icon?: ReactNode;
  /**
   * 过滤别名：拼音全拼 / 中文关键词 / 英文词，`includes` 小写匹配。
   * 不做拼音首字母缩写。
   */
  aliases?: string[];
  /** 排序权重，越小越靠前；默认按注册顺序。 */
  order?: number;
  /** 选中执行。同一条 chain 内先 `deleteRange(range)` 再插入。 */
  apply: (editor: Editor, range: Range) => void;
}
