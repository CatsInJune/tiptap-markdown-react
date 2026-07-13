import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import preserveDirectives from 'rollup-preserve-directives';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// 库模式：产出 ESM 双入口（. / server）+ 单一 style.css + .d.ts。
// react / react-dom 走 peer（external）；@tiptap/* / lowlight 在 dependencies 中
// 由 npm 传递安装，构建仍 external 以避免打进 dist、保证单例 schema。
export default defineConfig({
  plugins: [
    react(),
    dts({ entryRoot: 'src', include: ['src'] }),
    preserveDirectives(),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        server: resolve(__dirname, 'src/server.ts'),
      },
      formats: ['es'],
    },
    // 单一 style.css（关闭按入口拆分 CSS）
    cssCodeSplit: false,
    rollupOptions: {
      external: [
        /^react($|\/)/,
        /^react-dom($|\/)/,
        /^@tiptap\//,
        'lowlight',
        /^lowlight\//,
        /^@radix-ui\//,
      ],
      output: {
        // 保留模块结构有助于保留每文件 'use client' 指令与更干净的 tree-shaking
        preserveModules: false,
        assetFileNames: (info) =>
          info.name === 'style.css' ? 'style.css' : '[name][extname]',
      },
    },
    sourcemap: true,
    minify: false,
  },
});
