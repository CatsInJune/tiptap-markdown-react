import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function stripComments(src: string) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('./reader 入口不拉表格选区', () => {
  it('src/reader.ts 不 import extensions / TableKit', () => {
    const src = stripComments(readFileSync(join(root, 'src/reader.ts'), 'utf8'));
    expect(src).not.toMatch(/from ['"]\.\/extensions['"]/);
    expect(src).not.toMatch(/TableKit/);
    expect(src).not.toMatch(/@tiptap\/extension-table/);
  });

  it('dist/reader.js 不包含 TableKit / CellSelection', () => {
    const dist = join(root, 'dist/reader.js');
    if (!existsSync(dist)) return;
    const js = readFileSync(dist, 'utf8');
    expect(js).not.toMatch(/TableKit/);
    expect(js).not.toMatch(/CellSelection/);
    expect(js).not.toMatch(/extension-table/);
  });
});
