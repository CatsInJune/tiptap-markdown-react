import type { Editor } from '@tiptap/core';
import type {
  MarkdownParseHelpers,
  MarkdownToken,
  MarkdownTokenizer,
} from '@tiptap/core';
import { Emoji, emojiToShortcode, emojis, shortcodeToEmoji } from '@tiptap/extension-emoji';
import emojiRegex from 'emoji-regex';
import type { Mark } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Transaction } from '@tiptap/pm/state';
import { ReplaceStep } from '@tiptap/pm/transform';

/**
 * 短码 → 节点 attrs.name（规范名，不是用户键入的别名）。
 * 官方列表在模块加载时建一次；自定义表情不在这条解析路径上。
 */
const shortcodeName = new Map<string, string>();
for (const item of emojis) {
  if (!shortcodeName.has(item.name)) shortcodeName.set(item.name, item.name);
  for (const code of item.shortcodes) {
    if (!shortcodeName.has(code)) shortcodeName.set(code, item.name);
  }
}

const shortcodeAtStart = /^:([a-zA-Z0-9_+-]+):/;

function findKnownShortcode(src: string): number {
  const scan = /:([a-zA-Z0-9_+-]+):/g;
  let match: RegExpExecArray | null;
  while ((match = scan.exec(src))) {
    if (shortcodeName.has(match[1])) return match.index;
  }
  return -1;
}

/**
 * 官方扩展会把任意文本里的 Unicode 表情收成节点，包括行内 `code`。
 * 这里在它的事务之后把「替换前带 code mark」的那几处换回原文字。
 * 代码块由官方自己跳过（父节点 spec.code）。
 */
function keepCodeMarkedEmoji(tr: Transaction): Transaction | null {
  if (!tr.steps.length) return null;

  const reverts: { pos: number; text: string; marks: readonly Mark[] }[] = [];
  tr.steps.forEach((step, index) => {
    if (!(step instanceof ReplaceStep)) return;
    const inserted = step.slice.content.firstChild;
    if (!inserted || inserted.type.name !== 'emoji') return;
    const before = tr.docs[index];
    if (!before) return;
    const $from = before.resolve(step.from);
    const direct = before.nodeAt(step.from);
    const marks = direct?.isText ? direct.marks : $from.marks();
    if (!marks.some((mark) => mark.type.spec.code)) return;
    const text = before.textBetween(step.from, step.to);
    if (!text) return;
    let pos = step.from;
    for (let next = index + 1; next < tr.steps.length; next += 1) {
      pos = tr.steps[next].getMap().map(pos, -1);
    }
    reverts.push({ pos, text, marks });
  });

  if (reverts.length === 0) return tr;

  reverts.sort((a, b) => b.pos - a.pos);
  const schema = tr.doc.type.schema;
  for (const rev of reverts) {
    const node = tr.doc.nodeAt(rev.pos);
    if (!node || node.type.name !== 'emoji') continue;
    tr.replaceWith(
      rev.pos,
      rev.pos + node.nodeSize,
      schema.text(rev.text, rev.marks),
    );
  }
  return tr;
}

/** 把已载入文档里的 Unicode 表情收成节点。代码块和行内 code 保持原文。 */
function replaceLoadedUnicodeEmoji(editor: Editor) {
  const emojiType = editor.schema.nodes.emoji;
  if (!emojiType) return;
  const list = editor.storage.emoji?.emojis ?? emojis;
  const { doc } = editor.state;
  const pattern = emojiRegex();
  const hits: { from: number; to: number; name: string }[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    if (node.marks.some((mark) => mark.type.spec.code)) return;
    if (doc.resolve(pos).parent.type.spec.code) return;
    for (const match of node.text.matchAll(pattern)) {
      if (match.index === undefined) continue;
      const name = emojiToShortcode(match[0], list);
      if (!name) continue;
      hits.push({
        from: pos + match.index,
        to: pos + match.index + match[0].length,
        name,
      });
    }
  });
  if (hits.length === 0) return;
  const tr = editor.state.tr;
  hits.sort((a, b) => b.from - a.from);
  for (const hit of hits) {
    tr.replaceWith(hit.from, hit.to, emojiType.create({ name: hit.name }));
  }
  tr.setMeta('addToHistory', false);
  editor.view.dispatch(tr);
}

const emojiMarkdownTokenizer: MarkdownTokenizer = {
  name: 'emoji',
  level: 'inline',
  start(src) {
    return findKnownShortcode(src);
  },
  tokenize(src) {
    const match = shortcodeAtStart.exec(src);
    if (!match) return undefined;
    const name = shortcodeName.get(match[1]);
    if (!name || !shortcodeToEmoji(name, emojis)) return undefined;
    return {
      type: 'emoji',
      raw: match[0],
      name,
    };
  },
};

/**
 * 官方 Emoji 节点 + `:shortcode:` 的 markdown 往返。
 *
 * 官方只有 renderMarkdown（输出 `:name:`），没有 tokenizer，读回会变成普通文本。
 * 建议列表的 React 弹层不在这里：server / 预览共用这份 schema，弹层由编辑器
 * configure 贴上去。
 */
export const MarkdownEmoji = Emoji.extend({
  markdownTokenizer: emojiMarkdownTokenizer,

  parseMarkdown(token: MarkdownToken, helpers: MarkdownParseHelpers) {
    const typed = typeof token.name === 'string' ? token.name : '';
    const name = shortcodeName.get(typed);
    if (!name) return helpers.createTextNode(token.raw ?? '');
    return helpers.createNode('emoji', { name });
  },

  /**
   * 初始文档不经过 appendTransaction。mount 在视图建好后同步发出，
   * 这时把正文里的 Unicode 表情收成节点（代码块和行内 code 除外）。
   * 不进撤销历史。之后的键入 / 粘贴仍走官方插件。
   */
  onBeforeCreate() {
    this.editor.on('mount', () => {
      replaceLoadedUnicodeEmoji(this.editor);
    });
  },

  addProseMirrorPlugins() {
    const plugins = this.parent?.() ?? [];
    return plugins.map((plugin) => {
      const specKey = plugin.spec.key;
      const keyName =
        specKey && typeof specKey === 'object' && 'key' in specKey
          ? String(specKey.key)
          : '';
      const append = plugin.spec.appendTransaction;
      if (keyName !== 'emoji$' || typeof append !== 'function') return plugin;
      return new Plugin({
        key: new PluginKey('markdownEmoji'),
        props: plugin.props,
        appendTransaction(transactions, oldState, newState) {
          const produced = append.call(plugin, transactions, oldState, newState);
          if (!produced) return null;
          return keepCodeMarkedEmoji(produced);
        },
      });
    });
  },
});
