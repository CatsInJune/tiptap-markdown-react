import type { Editor } from '@tiptap/core';
import { useCallback, useEffect, useLayoutEffect, useSyncExternalStore } from 'react';
import { getLocaleBundle } from './index';
import type { LocaleBundle, LocaleCode } from './types';

const serverBundle = getLocaleBundle('en');

interface LocaleEntry {
  locale: LocaleCode;
  bundle: LocaleBundle;
  listeners: Set<() => void>;
  /** 渲染期只改快照，绘制前再通知 NodeView。 */
  pendingNotify: boolean;
}

const stores = new WeakMap<Editor, LocaleEntry>();

function ensure(editor: Editor): LocaleEntry {
  let entry = stores.get(editor);
  if (!entry) {
    entry = {
      locale: 'en',
      bundle: serverBundle,
      listeners: new Set(),
      pendingNotify: false,
    };
    stores.set(editor, entry);
  }
  return entry;
}

/** 写入当前语言。同值不重复通知。可在渲染期间调用。 */
export function setEditorLocale(editor: Editor, locale: LocaleCode): void {
  const entry = ensure(editor);
  if (entry.locale === locale) return;
  entry.locale = locale;
  entry.bundle = getLocaleBundle(locale);
  entry.pendingNotify = true;
}

/** 把渲染期写入的语言变化发给已挂载的 NodeView。 */
export function flushEditorLocale(editor: Editor): void {
  const entry = stores.get(editor);
  if (!entry?.pendingNotify) return;
  entry.pendingNotify = false;
  entry.listeners.forEach((listener) => listener());
}

export function getEditorLocale(editor: Editor): LocaleCode {
  return stores.get(editor)?.locale ?? 'en';
}

export function getEditorBundle(editor: Editor): LocaleBundle {
  return stores.get(editor)?.bundle ?? serverBundle;
}

export function subscribeEditorLocale(
  editor: Editor,
  listener: () => void,
): () => void {
  const entry = ensure(editor);
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
  };
}

const useIsoLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * 编辑器 / 预览在渲染时写入语言，绘制前通知独立 React 根上的 NodeView。
 * `immediatelyRender: false` 时视图在 effect 之后才创建，首帧就能读到正确语言。
 */
export function usePublishEditorLocale(
  editor: Editor | null,
  locale: LocaleCode,
): void {
  if (editor) setEditorLocale(editor, locale);
  useIsoLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return;
    flushEditorLocale(editor);
  }, [editor, locale]);
}

/** NodeView 订阅所属编辑器的文案。快照引用稳定，语言不变时不重渲染。 */
export function useEditorBundle(editor: Editor): LocaleBundle {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeEditorLocale(editor, onStoreChange),
    [editor],
  );
  const getSnapshot = useCallback(() => getEditorBundle(editor), [editor]);
  return useSyncExternalStore(subscribe, getSnapshot, () => serverBundle);
}
