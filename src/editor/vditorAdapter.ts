/**
 * 文件名: vditorAdapter.ts
 * 描述: 使用 Vditor 公开接口和标准 textarea 选区实现编辑器适配器。
 */
import Vditor from 'vditor'
import type { EditorAdapter, EditorSnapshot, TextChange } from './types'

class VditorEditorAdapter implements EditorAdapter {
  constructor(
    private readonly vditor: Vditor,
    private readonly source: HTMLTextAreaElement,
  ) {}

  getSnapshot(): EditorSnapshot {
    return {
      text: this.source.value,
      from: this.source.selectionStart,
      to: this.source.selectionEnd,
    }
  }

  getValue(): string {
    return this.source.value
  }

  setValue(value: string): void {
    this.vditor.setValue(value)
  }

  applyChange(change: TextChange): void {
    this.source.setRangeText(change.insert, change.from, change.to, 'end')
    const cursor = change.cursor ?? change.from + change.insert.length
    this.source.setSelectionRange(cursor, cursor)
    this.source.dispatchEvent(new Event('input', { bubbles: true }))
    this.vditor.renderPreview()
  }

  focus(): void {
    this.source.focus()
  }

  onInput(callback: (value: string) => void): void {
    this.source.addEventListener('input', () => {
      callback(this.getValue())
    })
  }
}

export function createVditorAdapter(container: HTMLElement): Promise<EditorAdapter> {
  return new Promise((resolve, reject) => {
    const vditor = new Vditor(container, {
      cdn: '/vditor',
      mode: 'sv',
      cache: { enable: false },
      preview: {
        mode: 'both',
        markdown: { sanitize: true, inlineMath: true },
        math: { engine: 'KaTeX' },
      },
      after: () => {
        const source = container.querySelector<HTMLTextAreaElement>('textarea')
        if (!source) {
          reject(new Error('Vditor SV 源码输入区不可用'))
          return
        }
        resolve(new VditorEditorAdapter(vditor, source))
      },
    })
  })
}
