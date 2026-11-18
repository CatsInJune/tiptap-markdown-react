/**
 * 链接地址协议白名单——库内所有「把外部数据写进 href」的地方共用。
 *
 * 与官方 Tiptap Link 的默认允准集一致（`linkEditing.ts` 的「在新窗口打开」也用它）。
 * 这里只做**校验**，不改写原值：相对地址（`/docs`、`#sec`、`?q=1`）与无协议的
 * `example.com/x` 按 `http(s)` 解析，仍是安全的链接目标；`javascript:` / `data:` /
 * `vbscript:` 等危险协议一律拒绝。
 *
 * 注意：`new URL()` 会按 WHATWG 规则先去掉输入里的制表符与换行，所以
 * `java\nscript:alert(1)` 也会被正确识别为 `javascript:` 并拒绝。
 */
export const SAFE_LINK_PROTOCOLS = new Set([
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

/** 解析相对地址用的占位 origin；不参与输出，只用于判定协议。 */
const URL_BASE = 'https://tmr.invalid/';

/** 是否是可安全写进 `href` 的地址（空串 / 非字符串 / 危险协议都返回 false）。 */
export function isSafeLinkUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const raw = value.trim();
  if (!raw) return false;
  try {
    return SAFE_LINK_PROTOCOLS.has(new URL(raw, URL_BASE).protocol);
  } catch {
    return false;
  }
}

/** 安全时返回去空白后的原值，不安全时返回 null（给「无 url」语义用）。 */
export function normalizeLinkUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  return isSafeLinkUrl(raw) ? raw : null;
}
