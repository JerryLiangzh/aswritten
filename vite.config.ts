/**
 * 文件名: vite.config.ts
 * 描述: 配置 Vite 构建及 Vditor 自托管静态资源。
 */
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/vditor/dist/**/*',
          dest: 'vditor/dist',
          rename: { stripBase: 3 },
        },
      ],
    }),
  ],
})
