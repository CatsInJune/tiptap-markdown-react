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
