import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TableKit } from '@tiptap/extension-table';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { Color, FontSize, TextStyle } from '@tiptap/extension-text-style';
// AnyExtension 从 @tiptap/react 取（它 re-export 自 core），避免新增 @tiptap/core 直接依赖
import type { AnyExtension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { common, createLowlight } from 'lowlight';

/**
 * 编辑器的「内容 schema 级」扩展集——纯节点/标记定义，不含任何 React NodeView
 * 或键盘交互绑定。三处共用：
 *   1. 编辑器（MarkdownWysiwygEditor）：base + 交互增强版 CodeBlock/Image
 *   2. 只读预览（MarkdownPreview）
 *   3. server 端 markdown→HTML 渲染（renderReportHtml）
 *
 * 分层动机：交互增强依赖 @tiptap/react / 浏览器，会污染 server bundle（RSC）。
 * base 保持纯 schema，server import 它只引入节点定义，无 React 代码。
 *
 * 关键边界：CodeBlock 与 Image「会被编辑器增强」，**不放进 base**——否则编辑器
 * 追加增强版会与 base 的纯版同名冲突（Tiptap 报 "Duplicate extension names"）。
 * 改为：base 不含这两个节点，由调用方按需注入：
 *   - 编辑器注入「增强版」（React 视图 / 删除快捷键）
 *   - server / 预览注入「纯版」（pureCodeBlock / pureImage）
 */

// lowlight 实例：代码块语法高亮。导出供编辑器增强版与 server 纯版共用同一实例。
export const lowlight = createLowlight(common);

/** 纯版代码块（无 React 视图）：server / 预览用，产出带高亮 class 的静态结构。 */
export const pureCodeBlock = CodeBlockLowlight.configure({ lowlight });

/**
 * 纯版块级图片（无删除快捷键）：server / 预览用。
 * inline:false（官方默认）——研报里图片均为大图独占一行，块级图片可直接作为 doc
 * 顶层子节点，避免「inline image 裸挂 doc 顶层」被 generateTocIds 严格校验判非法。
 */
export const pureImage = Image.configure({ inline: false });

/**
 * 三处共用的纯 schema 扩展——**不含 CodeBlock / Image**（见上方边界说明）。
 * 编辑器：`[...baseExtensions, 增强CodeBlock, 增强Image, Markdown]`
 * server/预览：`[...baseExtensions, pureCodeBlock, pureImage, Markdown]`
 */
export const baseExtensions: AnyExtension[] = [
  // 禁用 StarterKit 内置 codeBlock，统一改用带 lowlight 的代码块（由调用方注入）
  StarterKit.configure({ codeBlock: false }),
  TextStyle,
  Color.configure({ types: [TextStyle.name] }),
  // 正文字号：官方 FontSize（v3 起并入 text-style 包），以内联样式挂在 TextStyle
  // 的 <span> 上（如 style="font-size: 16px"），与 Color 同基座，三端共用。
  FontSize.configure({ types: [TextStyle.name] }),
  Highlight.configure({ multicolor: true }),
  Superscript,
  Subscript,
  TableKit.configure({ table: { resizable: true } }),
  TaskList,
  TaskItem.configure({ nested: true }),
];
