import 'vditor/dist/index.css'
import './styles.css'
import { usageSections } from './docs/usage'
import { createVditorAdapter } from './editor/vditorAdapter'
import { downloadMarkdown, readMarkdownFile } from './files/markdownFile'
import { mountFormulaPanel } from './formula/FormulaPanel'
import { documentKey, loadDocument, saveDocument, saveDocumentExclusive } from './persistence/documentStore'

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`页面节点不存在：${id}`)
  return element as T
}

function appendInlineText(element: HTMLElement, text: string) {
  for (const part of text.split(/(`[^`]+`)/g)) {
    if (!part) continue
    if (part.startsWith('`') && part.endsWith('`')) {
      const code = document.createElement('code')
      code.textContent = part.slice(1, -1)
      element.append(code)
    } else {
      element.append(document.createTextNode(part))
    }
  }
}

function renderUsageMarkdown(markdown: string): DocumentFragment {
  const fragment = document.createDocumentFragment()
  const blocks = markdown.trim().split(/(~~~[\s\S]*?~~~)/g)

  for (const block of blocks) {
    if (!block.trim()) continue
    if (block.startsWith('~~~')) {
      const firstLineEnd = block.indexOf('\n')
      const closingFence = block.lastIndexOf('~~~')
      const pre = document.createElement('pre')
      const code = document.createElement('code')
      code.textContent = firstLineEnd === -1 ? '' : block.slice(firstLineEnd + 1, closingFence).replace(/\n$/, '')
      pre.append(code)
      fragment.append(pre)
      continue
    }

    let paragraph: string[] = []
    let list: HTMLUListElement | null = null
    const flushParagraph = () => {
      if (paragraph.length === 0) return
      const element = document.createElement('p')
      appendInlineText(element, paragraph.join(' '))
      fragment.append(element)
      paragraph = []
    }

    for (const line of block.split('\n')) {
      const text = line.trim()
      if (!text) {
        flushParagraph()
        list = null
        continue
      }
      if (text.startsWith('- ')) {
        flushParagraph()
        if (!list) {
          list = document.createElement('ul')
          fragment.append(list)
        }
        const item = document.createElement('li')
        appendInlineText(item, text.slice(2))
        list.append(item)
        continue
      }
      list = null
      paragraph.push(text)
    }
    flushParagraph()
  }

  return fragment
}

const appShell = requiredElement('app-shell')
const editorContainer = requiredElement('editor')
const panel = requiredElement('formula-panel')
const panelToggle = requiredElement<HTMLButtonElement>('formula-panel-toggle')
const usageDocument = requiredElement('usage-document')
const usageDocumentToggle = requiredElement<HTMLButtonElement>('usage-document-toggle')
const selectionDebug = requiredElement('selection-debug')
const documentStatus = requiredElement('document-status')
const importButton = requiredElement<HTMLButtonElement>('markdown-import')
const exportButton = requiredElement<HTMLButtonElement>('markdown-export')
const importInput = requiredElement<HTMLInputElement>('markdown-import-input')

const setDocumentStatus = (message: string, isError = false) => {
  documentStatus.textContent = message
  documentStatus.dataset.status = isError ? 'error' : 'normal'
}

function mountUsageDocument() {
  const usageHeader = document.createElement('div')
  usageHeader.className = 'usage-document__header'
  const usageTitle = document.createElement('h2')
  usageTitle.id = 'usage-document-title'
  usageTitle.textContent = '使用文档'
  const usageClose = document.createElement('button')
  usageClose.type = 'button'
  usageClose.className = 'usage-document__close'
  usageClose.setAttribute('aria-label', '关闭使用文档')
  usageClose.textContent = '×'
  usageHeader.append(usageTitle, usageClose)
  const usageContent = document.createElement('div')
  usageContent.className = 'usage-document__content'
  for (const section of usageSections) {
    const article = document.createElement('section')
    article.id = `usage-${section.id}`
    article.className = 'usage-document__section'
    const title = document.createElement('h3')
    title.textContent = section.title
    article.append(title, renderUsageMarkdown(section.markdown))
    usageContent.append(article)
  }
  usageDocument.setAttribute('aria-labelledby', usageTitle.id)
  usageDocument.replaceChildren(usageHeader, usageContent)

  const setUsageDocumentOpen = (open: boolean) => {
      usageDocument.hidden = !open
      usageDocumentToggle.setAttribute('aria-expanded', String(open))
    }

    usageDocumentToggle.addEventListener('click', () => {
      setUsageDocumentOpen(usageDocument.hidden !== false)
    })

    usageClose.addEventListener('click', () => {
      setUsageDocumentOpen(false)
      usageDocumentToggle.focus()
    })
}

async function bootstrap() {
const adapter = await createVditorAdapter(editorContainer, () => {
  setDocumentStatus('编辑器初始化时间较长，仍在等待；如持续无响应请刷新重试', true)
})
setDocumentStatus('编辑器已就绪')

importButton.disabled = false
exportButton.disabled = false
panelToggle.disabled = false

let storage: Storage | null = null
try {
  storage = window.localStorage
} catch {
  setDocumentStatus('本地保存不可用，请导出 Markdown 备份', true)
}

let saveTimer: number | undefined
let lastPersistedDocument: string | null = null
let hasUnsavedChanges = false
let hasSaveConflict = false
let importOperationId = 0
let editVersion = 0
let cacheReadFailed = false
let saveQueue: Promise<boolean> = Promise.resolve(true)

const persistDocument = (): Promise<boolean> => {
  const save = async (): Promise<boolean> => {
  if (!hasUnsavedChanges) return true
  if (hasSaveConflict) return false
  if (cacheReadFailed) {
    setDocumentStatus('缓存读取失败，已暂停自动保存；请导出备份或刷新重试', true)
    return false
  }
  if (!storage) {
    setDocumentStatus('本地保存失败，请导出 Markdown 备份', true)
    return false
  }

  const targetStorage = storage
  const value = adapter.getValue()
  const result = await saveDocumentExclusive(
    targetStorage,
    navigator.locks,
    value,
    lastPersistedDocument,
  )
  if (result === 'conflict') {
    hasSaveConflict = true
    setDocumentStatus('其他标签页已修改文档，当前内容未覆盖缓存，请导出备份后刷新', true)
    return false
  }
  if (result === 'unsupported') {
    setDocumentStatus('当前浏览器不支持安全的多标签保存，请导出 Markdown 备份', true)
    return false
  }
  if (result === 'error') {
    setDocumentStatus('本地保存失败，请导出 Markdown 备份', true)
    return false
  }

  lastPersistedDocument = value
  hasUnsavedChanges = adapter.getValue() !== value
  setDocumentStatus(hasUnsavedChanges ? '有尚未保存的修改' : '已保存')
  return true
  }

  saveQueue = saveQueue.then(save, save)
  return saveQueue
}

if (storage) {
  const cachedDocument = loadDocument(storage, () => {
    cacheReadFailed = true
    setDocumentStatus('缓存读取失败，已暂停自动保存；请导出备份或刷新重试', true)
  })
  if (cachedDocument !== null) {
    adapter.setValue(cachedDocument)
    lastPersistedDocument = cachedDocument
    setDocumentStatus('已恢复本地文档')
  }
}

adapter.onInput(() => {
  hasUnsavedChanges = true
  editVersion += 1
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void persistDocument(), 300)
})

window.addEventListener('storage', event => {
  if (event.key !== documentKey) return
  window.clearTimeout(saveTimer)
  editVersion += 1

  if (hasUnsavedChanges) {
    hasSaveConflict = true
    setDocumentStatus('其他标签页已修改文档，当前内容未覆盖缓存，请导出备份后刷新', true)
    return
  }

  adapter.setValue(event.newValue ?? '')
  window.clearTimeout(saveTimer)
  lastPersistedDocument = event.newValue
  cacheReadFailed = false
  hasUnsavedChanges = false
  hasSaveConflict = false
  setDocumentStatus('已同步其他标签页的修改')
})

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    void persistDocument()
  }
})
window.addEventListener('beforeunload', () => {
  if (!storage || !hasUnsavedChanges || hasSaveConflict || cacheReadFailed) return
  const value = adapter.getValue()
  if (saveDocument(storage, value, lastPersistedDocument) === 'saved') {
    lastPersistedDocument = value
    hasUnsavedChanges = false
    setDocumentStatus('已保存')
  }
})

importButton.addEventListener('click', () => {
  importInput.value = ''
  importInput.click()
})

exportButton.addEventListener('click', () => {
  downloadMarkdown('document.md', adapter.getValue())
  setDocumentStatus('已导出 Markdown')
})

importInput.addEventListener('change', async () => {
  const file = importInput.files?.[0]
  if (!file) return
  const operationId = ++importOperationId
  if (!window.confirm('导入将替换当前文档，是否继续？')) {
    importInput.value = ''
    importButton.disabled = false
    return
  }

  const startingEditVersion = editVersion
  importButton.disabled = true

  try {
    const value = await readMarkdownFile(file)
    if (operationId !== importOperationId) return
    if (editVersion !== startingEditVersion) {
      throw new Error('导入期间文档已修改，已取消导入并保留当前内容')
    }

    adapter.setValue(value)
    adapter.focus()
    window.clearTimeout(saveTimer)
    hasUnsavedChanges = true
    const saved = await persistDocument()
    if (saved) {
      setDocumentStatus(`已导入并保存 ${file.name}`)
    }
  } catch (error) {
    if (operationId !== importOperationId) return
    const message = error instanceof Error ? error.message : 'Markdown 导入失败'
    setDocumentStatus(message, true)
  } finally {
    if (operationId === importOperationId) {
      importInput.value = ''
      importButton.disabled = false
    }
  }
})

if (import.meta.env.DEV) {
  window.__editorAdapterForTest = adapter
}

mountFormulaPanel(panel, adapter)



const setPanelOpen = (open: boolean) => {
  panel.hidden = !open
  panelToggle.setAttribute('aria-expanded', String(open))
}

panelToggle.addEventListener('click', () => {
  setPanelOpen(panel.hidden !== false)
})

panel.addEventListener('formula-panel-close', () => {
  setPanelOpen(false)
})

const updateSelectionDebug = () => {
  const { from, to } = adapter.getSnapshot()
  selectionDebug.textContent = `${from}:${to}`
}

appShell.addEventListener('input', updateSelectionDebug)
appShell.addEventListener('keyup', updateSelectionDebug)
appShell.addEventListener('click', updateSelectionDebug)
appShell.addEventListener('select', updateSelectionDebug, true)
updateSelectionDebug()
}

mountUsageDocument()
void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : '未知错误'
  setDocumentStatus(`编辑器初始化失败：${message}`, true)
})
