const markdownExtension = /\.(?:md|markdown)$/i

export async function readMarkdownFile(file: File): Promise<string> {
  if (!markdownExtension.test(file.name)) {
    throw new Error('仅支持 .md 或 .markdown 文件')
  }

  return file.text()
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
    URL.revokeObjectURL(url)
  }
}
