import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 工程约束的自动化守卫。conventions.md 里的硬约束靠人记容易漂：
 * 这里用测试把「禁用词 / Tiptap 精确版本 / 裸导入必须声明 / 单一 npm 锁」钉住。
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const selfPath = fileURLToPath(import.meta.url);

const SCAN_DIRS = ['src', 'scripts', 'site/src', '.github'];
const SCAN_EXT = /\.(?:ts|tsx|mjs|css|json|ya?ml)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (SCAN_EXT.test(entry)) out.push(full);
  }
  return out;
}

const pkg = JSON.parse(
  readFileSync(join(root, 'package.json'), 'utf8'),
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

describe('工程约束守卫', () => {
  it('源码不出现禁用词（UI 框架 / agentic-ui）', () => {
    // 拆开拼接，测试文件自身不产生字面命中。
    const forbidden = [
      ['agentic', '-ui'].join(''),
      ['Ant', ' ', 'Design'].join(''),
      ['ant', 'd'].join(''),
      ['getPopup', 'Container'].join(''),
    ];
    const hits: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(join(root, dir))) {
        if (file === selfPath) continue;
        const text = readFileSync(file, 'utf8');
        for (const word of forbidden) {
          const pattern =
            word === 'antd' ? /\bantd\b/i : new RegExp(escapeRegExp(word), 'i');
          if (pattern.test(text)) {
            hits.push(`${relative(root, file)}: ${word}`);
          }
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('@tiptap/* 依赖精确锁版本（不带 ^ / ~ / 范围）', () => {
    const all = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    };
    const bad = Object.entries(all).filter(
      ([name, version]) =>
        name.startsWith('@tiptap/') && !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version),
    );
    expect(bad).toEqual([]);
  });

  it('源码里的裸导入都在 package.json 中声明', () => {
    const declared = new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
    ]);
    const violations: string[] = [];
    const importRe = /(?:from\s+|import\s+)['"]([^'"]+)['"]/g;

    for (const file of walk(join(root, 'src'))) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(importRe)) {
        const spec = match[1];
        if (
          spec.startsWith('.') ||
          spec.startsWith('/') ||
          spec.startsWith('node:') ||
          // 正则 / 字符串里的转义片段（如 publicTypes.test.ts 中的断言源码）
          spec.includes('\\')
        ) {
          continue;
        }
        const name = spec.startsWith('@')
          ? spec.split('/').slice(0, 2).join('/')
          : spec.split('/')[0];
        if (!declared.has(name)) {
          violations.push(`${relative(root, file)} -> ${name}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('只保留 npm 锁文件，不提交 pnpm-lock', () => {
    expect(existsSync(join(root, 'pnpm-lock.yaml'))).toBe(false);
    expect(existsSync(join(root, 'site/pnpm-lock.yaml'))).toBe(false);
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
