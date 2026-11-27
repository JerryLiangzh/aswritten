import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import vditorAssets from './scripts/vditor-assets.json' with { type: 'json' }

const vditorDist = 'node_modules/vditor/dist'
const vditorSources = [
  ...vditorAssets.files,
  ...vditorAssets.directories.map(directory => `${directory}/**/*`),
].map(file => `${vditorDist}/${file}`)

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: vditorSources,
          dest: 'vditor/dist',
          rename: { stripBase: 3 },
        },
      ],
    }),
  ],
})
