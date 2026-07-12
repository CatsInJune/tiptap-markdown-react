/**
 * 目录锚点 id 生成——阅读页（SSR）与编辑页（editor）共用的**单一真源**，
 * 保证「创作预览的锚点 = 发布后阅读页的锚点」。
 *
 * 用 slug 而非官方默认 UUID：slug 跨 SSR / ISR revalidate 稳定（UUID 每次都变、
 * 分享的 #hash 会失效），且 `#introduction` 比 `#d4590f81-…` 可读、对 SEO 友好。
 *
 * slug 会重名（两个「细节」都 slug 成 `xi-jie`），故用闭包计数器去重：
 * 同名追加 -2 / -3（已实测：details / details-2 / details-3，HTML id 全唯一）。
 */

/** 单个标题文本 → 基础 slug（保留中文，去标点，空白转连字符）。 */
function baseSlug(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      // 保留字母/数字/下划线/中文/连字符，其余剔除
      .replace(/[^\w一-龥-]/g, '')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

/**
 * 造一个带去重的 `getId`。每次生成新实例（闭包各自计数），传给
 * `TableOfContents.configure({ getId })` 或 `generateTocIds` 的扩展配置。
 */
export function makeTocGetId(): (content: string) => string {
  const seen = new Map<string, number>();
  return (content: string) => {
    const base = baseSlug(content);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };
}
