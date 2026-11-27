import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(await readFile(
  new URL('./vditor-assets.json', import.meta.url),
  'utf8',
))
const sourceRoot = path.join(projectRoot, 'node_modules/vditor/dist')
const outputRoot = path.join(projectRoot, 'dist/vditor/dist')

async function walk(root, directory = '') {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const relative = directory ? `${directory}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files.push(...await walk(root, relative))
    } else if (entry.isFile()) {
      files.push(relative)
    }
  }
  return files
}

const expected = new Set(manifest.files)
for (const directory of manifest.directories) {
  for (const file of await walk(sourceRoot, directory)) {
    expected.add(file)
  }
}

const actual = await walk(outputRoot)
const actualSet = new Set(actual)
const missing = [...expected].filter(file => !actualSet.has(file)).sort()
const unexpected = actual.filter(file => !expected.has(file)).sort()
const sizes = await Promise.all(actual.map(async file => {
  const metadata = await stat(path.join(outputRoot, file))
  return metadata.size
}))
const totalBytes = sizes.reduce((total, size) => total + size, 0)
const failures = []

if (missing.length > 0) failures.push(`缺少文件：\n${missing.join('\n')}`)
if (unexpected.length > 0) failures.push(`越界文件：\n${unexpected.join('\n')}`)
if (actual.length > manifest.maxFiles) {
  failures.push(`Vditor 资源 ${actual.length} 个文件，超过预算 ${manifest.maxFiles}`)
}
if (totalBytes > manifest.maxBytes) {
  failures.push(`Vditor 资源 ${totalBytes} 字节，超过预算 ${manifest.maxBytes} 字节`)
}
if (failures.length > 0) throw new Error(failures.join('\n\n'))

console.log(`Vditor 资源检查通过：${actual.length} 个文件，${totalBytes} 字节`)
