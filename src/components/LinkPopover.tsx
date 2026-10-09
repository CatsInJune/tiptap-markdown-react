'use client';

import * as Popover from '@radix-ui/react-popover';
import type { Editor } from '@tiptap/react';
import {
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { CheckIcon, ExternalLinkIcon, TrashIcon } from '../icons';
import { defaultLinkPopoverLabels, type LinkPopoverLabels } from '../labels';
import {
  applyLink,
  canSetLink,
  isApplyKey,
  normalizeLinkHref,
  openLinkUrl,
  readLinkHref,
  removeLink,
} from '../linkEditing';
import styles from '../styles/linkPopover.module.css';

export interface LinkPopoverProps {
  /** 编辑器实例。 */
  editor: Editor;
  /**
   * 触发器：传宿主自己的按钮元素。Radix 的 `asChild` 要接管它的点击 / ref / aria——
   * 传函数组件时得先 `forwardRef`（本库的 `<EditorToolbar>` 就是这么接的）。
   */
  trigger: ReactNode;
  labels?: Partial<LinkPopoverLabels>;
  /** 挂到浮层根节点上的 class / 内联样式（定位与层级归宿主，Radix 只管浮层方向）。 */
  className?: string;
  style?: CSSProperties;
}

/**
 * 链接编辑浮层：输入地址 + 应用 / 在新窗口打开 / 移除。
 *
 * 逻辑全在 `linkEditing.ts`（从官方 UI Components 的 `useLinkPopover` 搬的），这里只负责输入、
 * 按钮与状态。取代表驱动器的 `window.prompt`：能**编辑已有链接**（打开即预填当前地址，
 * 而旧实现是「在链接里点一下就删除」）、能打开、能移除，且 `window.prompt` 在 Electron /
 * 部分 WebView 里根本不可用。
 *
 * 地址被编辑器拒掉时（Tiptap 的 `isAllowedUri`）浮层不关，输入框转成危险色并带上 title，
 * 让用户改——静默什么都不发生是最难查的。
 */
export function LinkPopover({
  editor,
  trigger,
  labels,
  className,
  style,
}: LinkPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          align="start"
          // 关闭后不要把焦点夺回触发器：应用后该留在编辑器里（applyLink 里已经 focus 过）
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <LinkPanel
            editor={editor}
            labels={labels}
            className={className}
            style={style}
            onClose={() => setOpen(false)}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function LinkPanel({
  editor,
  labels,
  className,
  style,
  onClose,
}: {
  editor: Editor;
  labels?: Partial<LinkPopoverLabels>;
  className?: string;
  style?: CSSProperties;
  onClose: () => void;
}) {
  const t: LinkPopoverLabels = { ...defaultLinkPopoverLabels, ...labels };
  // Radix 关闭时会卸载内容，所以这里的初值就是「每次打开读一次当前地址」——光标在链接里
  // 打开时预填它的 href，便于改地址而不是先删再加。
  const [url, setUrl] = useState(() => readLinkHref(editor));
  const [invalid, setInvalid] = useState(false);

  const canEdit = canSetLink(editor);
  const hasUrl = url.trim().length > 0;
  const keepFocus = (e: ReactMouseEvent) => e.preventDefault();

  const apply = () => {
    if (!applyLink(editor, url)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onClose();
  };

  const openInNewWindow = () => {
    // 先补协议再交给白名单：裸域名不该按「相对本页」打开
    openLinkUrl(normalizeLinkHref(editor, url), window.location.href);
  };

  const remove = () => {
    removeLink(editor);
    onClose();
  };

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    // 输入法组合中的回车是「提交候选词」，放行（isApplyKey 里判）
    if (!isApplyKey(e)) return;
    e.preventDefault();
    apply();
  };

  return (
    <div
      className={className ? `${styles.panel} ${className}` : styles.panel}
      style={style}
      data-link-popover=""
      role="dialog"
      aria-label={t.field}
    >
      <span className={`${styles.field}${invalid ? ` ${styles.fieldInvalid}` : ''}`}>
        <input
          className={styles.input}
          data-link-field=""
          data-link-invalid={invalid ? '' : undefined}
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setInvalid(false);
          }}
          onKeyDown={onInputKeyDown}
          placeholder={t.field}
          aria-label={t.field}
          aria-invalid={invalid || undefined}
          title={invalid ? t.invalid : undefined}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </span>

      <button
        type="button"
        className={`${styles.btn} ${styles.apply}`}
        data-link-action="apply"
        title={t.apply}
        aria-label={t.apply}
        disabled={!canEdit || !hasUrl}
        onMouseDown={keepFocus}
        onClick={apply}
      >
        <CheckIcon size={16} />
      </button>

      <span className={styles.divider} aria-hidden="true" />

      <button
        type="button"
        className={styles.btn}
        data-link-action="open"
        title={t.open}
        aria-label={t.open}
        disabled={!hasUrl}
        onMouseDown={keepFocus}
        onClick={openInNewWindow}
      >
        <ExternalLinkIcon size={16} />
      </button>
      <button
        type="button"
        className={styles.btn}
        data-link-action="remove"
        title={t.remove}
        aria-label={t.remove}
        disabled={!canEdit}
        onMouseDown={keepFocus}
        onClick={remove}
      >
        <TrashIcon size={16} />
      </button>
    </div>
  );
}
