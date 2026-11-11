import type { JSONContent } from '@tiptap/core';

const MAX_VERSIONS = 3;
const cache = new Map<string, JSONContent>();

/** 快照按 id 不可变。最近打开的几版留着 JSON，再点不再解析 Markdown。 */
export function recallVersionJson(key: string | undefined): JSONContent | null {
  if (!key) return null;
  const hit = cache.get(key);
  if (!hit) return null;
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

export function rememberVersionJson(key: string | undefined, json: JSONContent): void {
  if (!key) return;
  if (cache.has(key)) cache.delete(key);
  cache.set(key, json);
  while (cache.size > MAX_VERSIONS) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function versionCacheKey(id: string | undefined, markdown: string): string | undefined {
  if (!id) return undefined;
  return `${id}:${markdown.length}`;
}

/** 测试用：清空版本 JSON 缓存。 */
export function clearVersionJsonCache(): void {
  cache.clear();
}
