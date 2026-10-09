/**
 * 链接编辑的适配层。
 *
 * 逻辑按官方 UI Components 的 `useLinkPopover` 搬（MIT），外壳自绘。相对原来的
 * `window.prompt` 增量也都在这里：
 *
 *   - 改地址时把范围扩到**整条链接**（`extendMarkRange`），而不是只作用于光标那一段；
 *   - 选区为空时把地址本身当文本插进去（空选区上没有文字可以套 mark）；
 *   - 移除时带上 `preventAutolink` 元数据（与官方同款），免得自动链接插件把它加回来；
 *   - 「在新窗口打开」前过一遍协议白名单，`javascript:` 之类直接拒掉；
 *   - 裸域名补协议。官方面板不补，但 Tiptap 的 `setLink` 是把值**原样**存下来的，而它自己的
 *     自动链接（linkify）会按 `defaultProtocol` 补——两边不一致的结果是：手打 `example.com`
 *     存成相对链接，markdown 导出的就是 `[x](example.com)`。这里按扩展配的 `defaultProtocol`
 *     补齐，让「打字」和「粘贴」落到同一个地址上。
 *
 * 放在这里而不是组件里，是为了能脱离 DOM 直接跑单测（同 replaceRange / insertMarkdown）。
 */

import type { Editor } from '@tiptap/react';

import { isComposingKeyEvent } from './findReplace';

/** 「在新窗口打开」允许的协议（对齐官方 `sanitizeUrl` / Tiptap Link 的默认允准集）。 */
const OPENABLE_PROTOCOLS = new Set([
  'http:',
  'https:',
  'ftp:',
  'ftps:',
  'mailto:',
  'tel:',
  'callto:',
  'sms:',
  'cid:',
  'xmpp:',
]);

/** 已经有协议了（`https:` / `mailto:` …），或者是个站内相对地址（`/x`、`#x`、`?x`）。 */
const HAS_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
const SITE_RELATIVE_RE = /^[/#?]/;
/**
 * 主机:端口 形态（`localhost:3000`、`127.0.0.1:8080`、`[::1]:3000`）。它们**看着像协议**
 * （`localhost:` 也满足 `HAS_SCHEME_RE`），但显然是主机，要按主机补协议——否则会被当成
 * 未知协议，Tiptap 的 `isAllowedUri` 也会直接拒掉。
 */
const HOST_PORT_RE = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[[0-9a-f:]+\]):\d+($|[/#?])/i;
/** 第一段里带点的裸域名（`example.com/path`）。 */
const BARE_HOST_RE = /^[^/?#]*\.[^/?#]*/;

/** 链接可编辑吗：只读态、或当前选区不允许套 link mark（例如整块选中）时为 false。 */
export function canSetLink(editor: Editor | null | undefined): boolean {
  if (!editor || editor.isEditable === false) return false;
  try {
    return editor.can().setMark('link');
  } catch {
    return false;
  }
}

/** 光标 / 选区是否落在链接里。 */
export function isLinkActive(editor: Editor | null | undefined): boolean {
  if (!editor) return false;
  return editor.isActive('link');
}

/** 读当前链接的 href（不在链接里时是空串）。 */
export function readLinkHref(editor: Editor | null | undefined): string {
  if (!editor) return '';
  const { href } = editor.getAttributes('link');
  return typeof href === 'string' ? href : '';
}

/** 扩展上配的默认协议（`StarterKit` 里是 `http`），读不到就按 http 算。 */
function defaultProtocol(editor: Editor): string {
  const link = editor.extensionManager?.extensions.find(
    (extension) => extension.name === 'link',
  );
  const configured = (link?.options as { defaultProtocol?: string } | undefined)
    ?.defaultProtocol;
  return configured || 'http';
}

/**
 * 把用户输入整理成要存进 href 的值。
 *
 * 原样保留：空、站内相对地址（`/docs`、`#sec`、`?q=1`）、已带协议的（`https:`、`mailto:`）。
 * 补协议：裸域名（`example.com`、`example.com/a`）与主机:端口（`localhost:3000`）——补的是
 * 扩展配置的 `defaultProtocol`，与 Tiptap 自动链接同一套，避免手打和粘贴落到不同地址。
 */
export function normalizeLinkHref(editor: Editor, raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  if (SITE_RELATIVE_RE.test(value)) return value;
  if (HOST_PORT_RE.test(value)) return `${defaultProtocol(editor)}://${value}`;
  if (HAS_SCHEME_RE.test(value)) return value;
  if (!BARE_HOST_RE.test(value)) return value;
  return `${defaultProtocol(editor)}://${value}`;
}

/**
 * 应用链接：把地址套到**整条**链接（或选区）上；选区为空且原本不在链接里时，把地址当文本插进去。
 * 返回扩展是否接受了这个地址——`setLink` 会走 Tiptap 的 `isAllowedUri`。
 *
 * 两处与官方那版不同，都是单测逼出来的：
 *   1. 先 `can().setLink()` 干跑一遍。官方把 `insertContent` 挂在失败的 `setLink` 后面直接
 *      `run()`，结果是地址被拒时正文仍被改（链接文字被换成那个地址）。
 *   2. 「当文本插入」的判据是「选区为空**且光标不在已有链接里**」。官方只看选区是否为空，
 *      于是「光标在链接里、改一个地址」会把整条链接的文字替换成地址——而这正是这个浮层的主用途。
 */
export function applyLink(editor: Editor | null | undefined, raw: string): boolean {
  if (!editor) return false;
  const href = normalizeLinkHref(editor, raw);
  if (!href) return false;
  if (!editor.can().setLink({ href })) return false;

  const isEmpty = editor.state.selection.empty;
  const insideLink = isLinkActive(editor);
  const chain = editor
    .chain()
    .focus()
    .extendMarkRange('link')
    .setLink({ href });

  if (isEmpty && !insideLink) chain.insertContent({ type: 'text', text: href });

  return chain.run();
}

/** 移除链接：范围同样扩到整条，并挡住自动链接立刻加回来。 */
export function removeLink(editor: Editor | null | undefined): boolean {
  if (!editor) return false;
  return editor
    .chain()
    .focus()
    .extendMarkRange('link')
    .unsetLink()
    .setMeta('preventAutolink', true)
    .run();
}

/**
 * 把待打开的地址解析成绝对地址；解析不了、或协议不在白名单里时返回 `'#'` 表示「别打开」。
 *
 * 与官方 `sanitizeUrl(inputUrl, baseUrl)` 同语义：先按 base 解析成绝对地址（相对地址因此也
 * 能用），再查协议白名单。调用方拿到 `'#'` 就不开新窗口。
 */
export function sanitizeLinkUrl(input: string, baseUrl: string): string {
  try {
    const url = new URL(input, baseUrl);
    if (OPENABLE_PROTOCOLS.has(url.protocol)) return url.href;
  } catch {
    // 解析失败 = 非法地址
  }
  return '#';
}

/**
 * 打开地址（新窗口 + `noopener,noreferrer`）。空输入或非法地址都不开窗——调用方在此之前
 * 已经用 `sanitizeLinkUrl` 判过一次，这里再判一次是为了让这个入口单独用也安全。
 */
export function openLinkUrl(input: string, baseUrl: string): boolean {
  if (!input.trim()) return false;
  const safe = sanitizeLinkUrl(input, baseUrl);
  if (safe === '#') return false;
  window.open(safe, '_blank', 'noopener,noreferrer');
  return true;
}

/** 输入框的回车是否该当作「应用」（输入法组合中的回车是提交候选词，放行）。 */
export function isApplyKey(event: {
  key: string;
  nativeEvent: Pick<KeyboardEvent, 'isComposing' | 'keyCode'>;
}): boolean {
  if (event.key !== 'Enter') return false;
  return !isComposingKeyEvent(event.nativeEvent);
}
