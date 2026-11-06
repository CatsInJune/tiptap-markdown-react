import { Node } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    importPlaceholder: {
      insertImportPlaceholder: (label: string) => ReturnType;
      updateImportPlaceholder: (label: string) => ReturnType;
      removeImportPlaceholder: () => ReturnType;
    };
  }
}

function findPlaceholderPos(doc: {
  descendants: (
    f: (node: { type: { name: string } }, pos: number) => boolean | void,
  ) => void;
}): number | null {
  let found: number | null = null;
  doc.descendants((node, pos) => {
    if (node.type.name === 'importPlaceholder') {
      found = pos;
      return false;
    }
  });
  return found;
}

/** 导入进行中插在光标处的占位块。不进 Markdown，autosave 不会把进度文案落库。 */
export const ImportPlaceholder = Node.create({
  name: 'importPlaceholder',
  group: 'block',
  atom: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      label: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-label') ?? '',
        renderHTML: (attrs) =>
          attrs.label ? { 'data-label': attrs.label } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="import-placeholder"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = String(node.attrs.label ?? '');
    return [
      'div',
      {
        ...HTMLAttributes,
        'data-type': 'import-placeholder',
        class: 'tmr-import-placeholder',
        contenteditable: 'false',
        'aria-live': 'polite',
        'aria-busy': 'true',
      },
      ['span', { class: 'tmr-import-placeholder-spin', 'aria-hidden': 'true' }],
      ['span', { class: 'tmr-import-placeholder-label' }, label],
    ];
  },

  renderMarkdown() {
    return '';
  },

  /**
   * 进度更新只改 label。默认视图会因为 markup 变了拆掉整块 DOM，
   * 转圈动画每次从 0° 重来，看起来像卡住。这里保住 spin 节点，只改文案。
   */
  addNodeView() {
    const name = this.name;
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.setAttribute('data-type', 'import-placeholder');
      dom.className = 'tmr-import-placeholder';
      dom.setAttribute('contenteditable', 'false');
      dom.setAttribute('aria-live', 'polite');
      dom.setAttribute('aria-busy', 'true');

      const spin = document.createElement('span');
      spin.className = 'tmr-import-placeholder-spin';
      spin.setAttribute('aria-hidden', 'true');

      const labelEl = document.createElement('span');
      labelEl.className = 'tmr-import-placeholder-label';
      labelEl.textContent = String(node.attrs.label ?? '');
      dom.append(spin, labelEl);

      return {
        dom,
        update: (updated) => {
          if (updated.type.name !== name) return false;
          const next = String(updated.attrs.label ?? '');
          if (labelEl.textContent !== next) labelEl.textContent = next;
          return true;
        },
        ignoreMutation: () => true,
      };
    };
  },

  addCommands() {
    return {
      insertImportPlaceholder:
        (label) =>
        ({ chain }) =>
          chain()
            .focus()
            .insertContent({
              type: this.name,
              attrs: { label },
            })
            .command(({ tr }) => {
              tr.setMeta('addToHistory', false);
              tr.setMeta('preventUpdate', true);
              return true;
            })
            .run(),
      updateImportPlaceholder:
        (label) =>
        ({ tr, dispatch, state }) => {
          const pos = findPlaceholderPos(state.doc);
          if (pos == null) return false;
          if (dispatch) {
            dispatch(
              tr
                .setNodeMarkup(pos, undefined, { label })
                .setMeta('addToHistory', false)
                .setMeta('preventUpdate', true),
            );
          }
          return true;
        },
      removeImportPlaceholder:
        () =>
        ({ tr, dispatch, state }) => {
          const pos = findPlaceholderPos(state.doc);
          if (pos == null) return false;
          const node = state.doc.nodeAt(pos);
          if (!node) return false;
          if (dispatch) {
            dispatch(
              tr
                .delete(pos, pos + node.nodeSize)
                .setMeta('addToHistory', false)
                .setMeta('preventUpdate', true),
            );
          }
          return true;
        },
    };
  },
});
