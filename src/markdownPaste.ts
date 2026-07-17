// 副作用:增强 Editor.markdown(MarkdownManager)的类型。
import '@tiptap/markdown';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * 启发式判断一段纯文本是否「像 markdown」。
 * 只要命中任一块级/行内特征即认为是——宁可偶尔把带星号的普通文本转掉,
 * 也不漏掉真 markdown(用户可用 Shift+粘贴逃生)。
 */
export function looksLikeMarkdown(text: string): boolean {
  return (
    /^#{1,6}\s/m.test(text) || // 标题
    /\*\*[^*\n]+\*\*/.test(text) || // 加粗
    /(^|[^!])\[[^\]\n]+\]\([^)\n]+\)/.test(text) || // 链接
    /!\[[^\]\n]*\]\([^)\n]+\)/.test(text) || // 图片
    /^[-*+]\s+\S/m.test(text) || // 无序列表
    /^\d+\.\s+\S/m.test(text) || // 有序列表
    /^>\s/m.test(text) || // 引用
    /^```/m.test(text) || // 代码围栏
    /^\|.+\|\s*$/m.test(text) || // 表格行
    /^(-{3,}|\*{3,})\s*$/m.test(text) // 分割线
  );
}

/**
 * 粘贴 markdown 纯文本自动转富文本(官方 @tiptap/markdown 不内置此能力,
 * 实现方式取自官方文档 "Paste Markdown Detection" 配方并调整边界)。
 *
 * 判定只看 text/plain 的内容,不看剪贴板是否带 text/html——很多来源
 * (Xcode/VS Code 等编辑器经 RTF/语法高亮 HTML)复制 markdown 源码时会
 * 附带一份仅是"字面文本+样式"的 HTML,按 HTML 标签判定来源不可枚举。
 * 而真富文本(Word/网页文章)的 text/plain 降级不含 markdown 符号,
 * 启发式天然不命中,仍走默认富文本粘贴。
 *
 * 放行(不转换)的边界:
 *   - Shift+粘贴(粘贴为纯文本)→ 保留逃生通道
 *   - 光标在代码块内 → markdown 源码原样贴入
 *   - looksLikeMarkdown 未命中 → 默认粘贴
 */
export const MarkdownPaste = Extension.create({
  name: 'markdownPaste',

  addProseMirrorPlugins() {
    const { editor } = this;
    return [
      new Plugin({
        key: new PluginKey('markdownPaste'),
        props: {
          handlePaste(view, event) {
            const clipboard = event.clipboardData;
            if (!clipboard) return false;
            const text = clipboard.getData('text/plain');
            if (!text) return false;
            // Shift+粘贴 = 用户显式要纯文本(shiftKey 是 prosemirror-view
            // 内部状态,无公开 API,容错访问;拿不到则照常转换)
            const input = (view as unknown as { input?: { shiftKey?: boolean } })
              .input;
            if (input?.shiftKey) return false;
            // 代码块内粘贴 markdown 源码是常见操作,不转换
            if (view.state.selection.$from.parent.type.spec.code) return false;
            if (!looksLikeMarkdown(text)) return false;
            // markdown manager 仅在注册了 @tiptap/markdown 扩展后存在
            const markdown = editor.markdown;
            if (!markdown) return false;
            try {
              const json = markdown.parse(text);
              editor.commands.insertContent(json);
              return true;
            } catch (err) {
              console.error('markdown paste parse failed:', err);
              return false; // 解析失败回退默认纯文本粘贴
            }
          },
        },
      }),
    ];
  },
});
