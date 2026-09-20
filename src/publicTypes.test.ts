import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 公开类型面的守卫。
 *
 * 具体守的是一个已经踩过的坑：`src/index.ts` 顶部那个 `import '@tiptap/markdown'` 只让
 * **库自身**编译时带上 `Editor.getMarkdown` / `insertContent` 的 module augmentation，
 * `vite-plugin-dts` 不会把它写进 `dist/index.d.ts`——宿主那边就报「Editor 上不存在
 * getMarkdown」。必须再从**类型上**导出一次该模块，TS 才会加载它的声明、augmentation 才生效。
 */
describe('公开类型面', () => {
  it("src/index.ts 从类型上再导出 @tiptap/markdown（宿主靠它拿到 Editor.getMarkdown）", () => {
    const src = readFileSync(join(root, 'src/index.ts'), 'utf8');
    expect(src).toMatch(/export type \{[^}]*\} from '@tiptap\/markdown'/);
  });

  it('dist/index.d.ts 里也带着这一行', () => {
    const dist = join(root, 'dist/index.d.ts');
    if (!existsSync(dist)) return; // 未构建时跳过（与 reader.entry.test.ts 同一处理）
    expect(readFileSync(dist, 'utf8')).toContain("from '@tiptap/markdown'");
  });
});
