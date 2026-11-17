const markdownExtension = /\.(?:md|markdown)$/i
const defaultMaxBytes = 10 * 1024 * 1024
const downloadUrlRevokeDelayMs = 1000

export async function readMarkdownFile(file: File, maxBytes = defaultMaxBytes): Promise<string> {
  if (!markdownExtension.test(file.name)) {
    throw new Error('仅支持 .md 或 .markdown 文件')
  }
  if (file.size > maxBytes) {
    throw new Error(`文件超过大小限制（${(maxBytes / 1024 / 1024).toFixed(1)} MB），请拆分或精简后导入`)
  }

  const buffer = await file.arrayBuffer()
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    throw new Error('文件不是有效的 UTF-8 编码，请另存为 UTF-8 后重试')
  }
}

export function downloadMarkdown(filename: string, value: string): void {
  const blob = new Blob([value], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename

  try {
    document.body.appendChild(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), downloadUrlRevokeDelayMs)
  }
}
