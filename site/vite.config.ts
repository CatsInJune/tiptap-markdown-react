import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 站点上展示的是库的版本号，从根 package.json 读，避免每次发版都要手改。
const libVersion = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
).version;

export default defineConfig({
  // GitHub Pages 在子路径下托管（/tiptap-markdown-react/），Vercel 等在根路径；
  // 构建时用 SITE_BASE 覆盖，缺省保持 '/' 不影响既有部署。
  base: process.env.SITE_BASE ?? '/',
  plugins: [react()],
  define: {
    __LIB_VERSION__: JSON.stringify(libVersion),
  },
  // 包通过 file:.. 以符号链接安装，realpath 会指向仓库根；dedupe 保证 site 只有一份
  // react / react-dom（否则符号链接下双 React 会触发 invalid hook call）。
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
});
