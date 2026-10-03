import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import {
  defaultSlashMenuLabels,
  type SlashMenuLabels,
} from '../labels';
import styles from '../styles/slashMenu.module.css';
import { createDefaultSlashMenuItems, filterSlashItems } from './items';
import { SlashMenuPopup, type SlashMenuPopupHandle } from './SlashMenuPopup';
import type { SlashMenuItem } from './types';

export interface SlashMenuOptions {
  /** 追加的宿主自定义命令项（排在默认项之后）。 */
  items?: SlashMenuItem[];
  /** 弹窗文案，与默认英文文案合并。 */
  labels?: Partial<SlashMenuLabels>;
}

/** 输入法组合态下的按键交给 IME 自己处理（上游 suggestion 不查 composing）。 */
function isComposing(event: KeyboardEvent, view: { composing: boolean }): boolean {
  return view.composing || event.isComposing || event.keyCode === 229;
}

/**
 * 斜杠菜单：键入 `/` 唤起块级插入弹窗。
 *
 * - 触发规则：行首或空白后（`allowedPrefixes`，空白含全角 U+3000）；
 *   正文里「和/或」这类合法斜杠不会触发。
 * - 代码块内不触发；表格单元格内触发（见 allow）。
 * - 定位/滚动跟随/点外关闭全走官方 `props.mount`（floating-ui），
 *   弹层挂 document.body（逃出宿主 overflow 裁剪），`--tmr-*` 主题
 *   变量从编辑器解析后复制到弹层宿主。
 * - 只读态由 suggestion 状态机自身拦截（isEditable 短路）。
 */
export const SlashMenu = Extension.create<SlashMenuOptions>({
  name: 'slashMenu',

  addOptions() {
    return { items: undefined, labels: undefined };
  },

  addProseMirrorPlugins() {
    const { items: extraItems, labels } = this.options;
    const allItems = [
      ...createDefaultSlashMenuItems({ ...defaultSlashMenuLabels, ...labels }),
      ...(extraItems ?? []),
    ];

    let renderer: ReactRenderer<SlashMenuPopupHandle> | null = null;
    let unmountPopup: (() => void) | null = null;

    return [
      Suggestion<SlashMenuItem>({
        editor: this.editor,
        pluginKey: new PluginKey('tmrSlashMenu'),
        char: '/',
        // 行首（节点内起始，空 prefix 天然放行）或空白后触发
        allowedPrefixes: [' ', '\t', '\u3000'],
        allowSpaces: false,
        decorationClass: 'tmr-slash-suggestion',
        decorationEmptyClass: 'tmr-slash-suggestion-empty',
        items: ({ query }) => filterSlashItems(allItems, query),
        command: ({ editor, range, props: item }) => {
          item.apply(editor, range);
        },
        allow: ({ editor }) => editor.isEditable && !editor.isActive('codeBlock'),
        render: () => ({
          onStart: (props: SuggestionProps<SlashMenuItem>) => {
            renderer = new ReactRenderer(
              SlashMenuPopup,
              {
                editor: props.editor,
                props: {
                  items: props.items,
                  query: props.query,
                  menuLabel:
                    this.options.labels?.menuLabel ?? defaultSlashMenuLabels.menuLabel,
                  command: props.command,
                },
                className: styles.popupHost,
              },
            );
            // 挂到 body（suggestion 默认容器）：弹层要能浮出编辑器，宿主在
            // 编辑器外层套 overflow:hidden（圆角窗口/滚动容器）时不会被裁。
            // 主题变量随行：编辑器子树上的 --tmr-* 解析值复制到弹层宿主，
            // 宿主把变量定义在任意深度的子树里也能保持配色一致。
            const pmStyle = getComputedStyle(props.editor.view.dom);
            for (const name of [
              '--tmr-text',
              '--tmr-accent',
              '--tmr-toolbar-border',
              '--tmr-toolbar-muted',
            ]) {
              const value = pmStyle.getPropertyValue(name);
              if (value) renderer.element.style.setProperty(name, value);
            }
            unmountPopup = props.mount(renderer.element);
          },
          onUpdate: (props: SuggestionProps<SlashMenuItem>) => {
            renderer?.updateProps({
              items: props.items,
              query: props.query,
              command: props.command,
            });
          },
          onKeyDown: (props: SuggestionKeyDownProps) => {
            if (!renderer || isComposing(props.event, props.view)) return false;
            return renderer.ref?.onKeyDown(props.event) ?? false;
          },
          onExit: () => {
            unmountPopup?.();
            unmountPopup = null;
            renderer?.destroy();
            renderer = null;
          },
        }),
      }),
    ];
  },
});
