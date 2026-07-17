// 副作用:增强 Editor.markdown(MarkdownManager)的类型。
import '@tiptap/markdown';
import { Extension, type Editor } from '@tiptap/core';
import { FileHandlePlugin } from '@tiptap/extension-file-handler';
import { PluginKey } from '@tiptap/pm/state';

/** .md / .markdown 扩展名(不区分大小写)。 */
const MD_FILE_RE = /\.(md|markdown)$/i;

/**
 * .md 的 MIME 类型在各平台不稳定(text/markdown / text/x-markdown / 空串),
 * 而 FileHandlePlugin 的 allowedMimeTypes 是严格 `includes(file.type)` 匹配
 * (源码确认,不支持扩展名)。故列表包含空串兜住「系统未注册 MIME」的 .md,
 * 真正的判定在回调里按文件名做。副作用:拖入其它空 MIME 文件会被吞成 no-op
 * ——好过浏览器默认导航打开该文件。
 */
const MD_MIME_TYPES = ['text/markdown', 'text/x-markdown', ''];

/** 读 .md 文件文本 → markdown.parse → 插入(drop 时插到落点,paste 时插到光标)。 */
async function insertMarkdownFiles(
  editor: Editor,
  files: File[],
  pos?: number,
): Promise<void> {
  const mdFiles = files.filter((f) => MD_FILE_RE.test(f.name));
  if (mdFiles.length === 0) return;
  // markdown manager 仅在注册了 @tiptap/markdown 扩展后存在
  const markdown = editor.markdown;
  if (!markdown) return;
  const texts = await Promise.all(mdFiles.map((f) => f.text()));
  const json = markdown.parse(texts.join('\n\n'));
  if (pos != null) {
    editor.chain().focus().insertContentAt(pos, json).run();
  } else {
    editor.chain().focus().insertContent(json).run();
  }
}

/**
 * 把 .md / .markdown 文件拖拽或粘贴进编辑器,解析后插入内容。
 * 复用官方 @tiptap/extension-file-handler 的底层 FileHandlePlugin,但注册在
 * 自有 PluginKey 下——宿主仍可通过 extraExtensions 注入自己的 FileHandler
 * (如图片上传)而不撞 key。
 */
export const MarkdownFileDrop = Extension.create({
  name: 'markdownFileDrop',

  addProseMirrorPlugins() {
    const { editor } = this;
    return [
      FileHandlePlugin({
        key: new PluginKey('markdownFileDrop'),
        editor,
        allowedMimeTypes: MD_MIME_TYPES,
        onDrop: (ed, files, pos) => {
          insertMarkdownFiles(ed, files, pos).catch((err) => {
            console.error('markdown file drop failed:', err);
          });
        },
        onPaste: (ed, files) => {
          insertMarkdownFiles(ed, files).catch((err) => {
            console.error('markdown file paste failed:', err);
          });
        },
      }),
    ];
  },
});
