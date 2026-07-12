import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // 包通过 file:.. 以符号链接安装，realpath 会指向仓库根；dedupe 保证 site 只有一份
  // react / react-dom（否则符号链接下双 React 会触发 invalid hook call）。
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
});
