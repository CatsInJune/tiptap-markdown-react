import type { AnyExtension, JSONContent } from '@tiptap/core';
import {
  Markdown,
  assumeContentType,
  type MarkdownExtensionOptions,
} from '@tiptap/markdown';
import { BlockIdMarkdownManager } from './manager';
import { BlockIdMarkdownTokenizer } from './tokenizer';

function createManager(
  options: MarkdownExtensionOptions,
  extensions: AnyExtension[],
): BlockIdMarkdownManager {
  return new BlockIdMarkdownManager({
    indentation: options.indentation,
    marked: options.marked,
    markedOptions: options.markedOptions,
    extensions,
  });
}

/**
 * 官方 `Markdown` 扩展的块 ID 版本：库内统一挂载，宿主零配置。
 *
 * 与官方版逐字同构（初始 markdown 解析、`editor.markdown` / `getMarkdown`
 * 安装、setContent/insertContent 命令全部沿用），唯一差别是 Manager 换成
 * {@link BlockIdMarkdownManager}，并自动注册 ID 注释 tokenizer。
 *
 * 用法与官方一致：
 * ```ts
 * extensions: [...baseExtensions, BlockIdMarkdown.configure({ marked })]
 * ```
 */
export const BlockIdMarkdown = Markdown.extend({
  addExtensions() {
    return [BlockIdMarkdownTokenizer];
  },

  addStorage() {
    return {
      manager: createManager(this.options, []),
    };
  },

  onBeforeCreate() {
    if (this.editor.markdown) {
      console.error(
        '[tiptap][markdown]: There is already a `markdown` property on the editor instance. This might lead to unexpected behavior.',
      );
      return;
    }

    this.storage.manager = createManager(
      this.options,
      this.editor.extensionManager.baseExtensions,
    );
    this.editor.markdown = this.storage.manager;
    this.editor.getMarkdown = () =>
      this.storage.manager.serialize(this.editor.getJSON());

    if (!this.editor.options.contentType) return;
    if (
      assumeContentType(
        this.editor.options.content,
        this.editor.options.contentType,
      ) !== 'markdown'
    ) {
      return;
    }
    if (!this.editor.markdown) {
      throw new Error(
        '[tiptap][markdown]: The `contentType` option is set to "markdown", but the Markdown extension is not added to the editor. Please add the Markdown extension to the editor to use this feature.',
      );
    }
    if (
      this.editor.options.content === undefined ||
      typeof this.editor.options.content !== 'string'
    ) {
      throw new Error(
        '[tiptap][markdown]: The `contentType` option is set to "markdown", but the initial content is not a string. Please provide the initial content as a markdown string.',
      );
    }

    const json = this.editor.markdown.parse(
      this.editor.options.content,
    ) as JSONContent;
    if (json.content?.length) {
      this.editor.options.content = json;
    }
  },
});
