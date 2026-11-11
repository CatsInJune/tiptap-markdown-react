import { afterEach, describe, expect, it } from 'vitest';
import {
  clearVersionJsonCache,
  recallVersionJson,
  rememberVersionJson,
  versionCacheKey,
} from './versionJsonCache';

afterEach(() => {
  clearVersionJsonCache();
});

describe('versionJsonCache', () => {
  it('按 key 记住并召回 JSON', () => {
    const key = versionCacheKey('v1', 'hello');
    rememberVersionJson(key, { type: 'doc', content: [{ type: 'paragraph' }] });
    expect(recallVersionJson(key)?.type).toBe('doc');
  });

  it('超过容量丢掉最旧的', () => {
    rememberVersionJson('a:1', { type: 'doc', content: [] });
    rememberVersionJson('b:1', { type: 'doc', content: [] });
    rememberVersionJson('c:1', { type: 'doc', content: [] });
    rememberVersionJson('d:1', { type: 'doc', content: [] });
    expect(recallVersionJson('a:1')).toBeNull();
    expect(recallVersionJson('d:1')?.type).toBe('doc');
  });

  it('没有 id 不建 key', () => {
    expect(versionCacheKey(undefined, 'x')).toBeUndefined();
  });
});
