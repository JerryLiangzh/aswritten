import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadMarkdown, readMarkdownFile } from '../../src/files/markdownFile'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readMarkdownFile', () => {
  it.each(['md', 'markdown'])('按 UTF-8 读取 .%s 文件并保留中文和 LaTeX 原文', async extension => {
    const value = '# 中文标题\n\n$\\frac{a}{b}$ 与 ${\\color{red} x+y}$'
    const file = new File([value], `note.${extension}`, { type: 'text/markdown' })

    await expect(readMarkdownFile(file)).resolves.toBe(value)
  })

  it('拒绝 txt 文件', async () => {
    const file = new File(['plain text'], 'note.txt', { type: 'text/plain' })

    await expect(readMarkdownFile(file)).rejects.toThrow('仅支持 .md 或 .markdown 文件')
  })
})

describe('downloadMarkdown', () => {
  it('导出 UTF-8 Markdown 并清理临时元素和 URL', async () => {
    const value = '# 导出\n\n$\\frac{a}{b}$ 与 ${\\color{blue} x}$'
    const click = vi.fn()
    const remove = vi.fn()
    const anchor = { href: '', download: '', click, remove }
    const appendChild = vi.fn()
    const createElement = vi.fn(() => anchor)
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:markdown-test')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('document', {
      body: { appendChild },
      createElement,
    })
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    downloadMarkdown('笔记.md', value)

    expect(createElement).toHaveBeenCalledWith('a')
    expect(appendChild).toHaveBeenCalledWith(anchor)
    expect(anchor.download).toBe('笔记.md')
    expect(anchor.href).toBe('blob:markdown-test')
    expect(click).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:markdown-test')
    const blob = createObjectURL.mock.calls[0][0]
    expect(blob.type).toBe('text/markdown;charset=utf-8')
    await expect(blob.text()).resolves.toBe(value)
  })
})
