import Vditor from 'vditor'
import type { EditorAdapter, EditorSnapshot, TextChange } from './types'

const initTimeoutMs = 20000
const disabledPreviewLanguages = [
  'echarts', 'mermaid', 'plantuml', 'wavedrom',
  'abc', 'flowchart', 'graphviz', 'mindmap', 'markmap', 'smiles',
] as const

function disableUnsafePreviewRenderers(html: string): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html')

  for (const language of disabledPreviewLanguages) {
    const className = `language-${language}`
    for (const element of parsed.querySelectorAll(`.${className}`)) {
      element.classList.remove(className)
      element.classList.add('language-plaintext')
      element.setAttribute('data-render-disabled', language)
    }
  }
  return parsed.body.innerHTML
}

function openSafeLink(anchor: HTMLAnchorElement): void {
  const href = anchor.getAttribute('href')
  if (!href) return

  if (href.startsWith('#')) {
    document.getElementById(href.slice(1))?.scrollIntoView()
    return
  }

  let url: URL
  try {
    url = new URL(href, window.location.href)
  } catch {
    return
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return
  }

  window.open(url.href, '_blank', 'noopener,noreferrer')
}

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

export function createVditorAdapter(
  container: HTMLElement,
  onSlowInitialization?: () => void,
): Promise<EditorAdapter> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = window.setTimeout(() => {
      onSlowInitialization?.()
    }, initTimeoutMs)

    const succeed = (adapter: EditorAdapter) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      resolve(adapter)
    }
    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      reject(error instanceof Error ? error : new Error('Vditor 初始化失败'))
    }

    container.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return
      const anchor = event.target.closest<HTMLAnchorElement>(
        '.vditor-preview a[href]',
      )
      if (!anchor) return

      event.preventDefault()
      event.stopImmediatePropagation()
      openSafeLink(anchor)
    }, true)

    try {
      const vditor = new Vditor(container, {
        cdn: '/vditor',
        mode: 'sv',
        toolbar: [
          'emoji', 'headings', 'bold', 'italic', 'strike', 'link', '|',
          'list', 'ordered-list', 'check', 'outdent', 'indent', '|',
          'quote', 'line', 'code', 'inline-code', 'insert-before', 'insert-after', '|',
          'upload', 'record', 'table', '|', 'undo', 'redo', '|',
          'fullscreen', 'edit-mode',
          {
            name: 'more',
            toolbar: [
              'both', 'code-theme', 'content-theme', 'outline',
              'preview', 'info', 'help',
            ],
          },
        ],
        cache: { enable: false },
        preview: {
          mode: 'both',
          markdown: { sanitize: true, inlineMath: true },
          math: { engine: 'KaTeX' },
          render: { media: { enable: false } },
          transform: disableUnsafePreviewRenderers,
        },
        link: { isOpen: false },
        after: () => {
          const source = container.querySelector<HTMLTextAreaElement>('textarea')
          if (!source) {
            fail(new Error('Vditor SV 源码输入区不可用'))
            return
          }
          succeed(new VditorEditorAdapter(vditor, source))
        },
      })
    } catch (error) {
      fail(error)
    }
  })
}
