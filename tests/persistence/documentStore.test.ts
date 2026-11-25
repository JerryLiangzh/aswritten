import { describe, expect, it, vi } from 'vitest'
import { loadDocument, saveDocument, saveDocumentExclusive } from '../../src/persistence/documentStore'

const documentKey = 'aswritten:document:v1'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, String(value))
  }
}

describe('documentStore', () => {
  it('无缓存时返回 null', () => {
    expect(loadDocument(new MemoryStorage())).toBeNull()
  })

  it('使用固定键保存并读取中文和 LaTeX 原文', () => {
    const storage = new MemoryStorage()
    const value = '# 中文标题\n\n$\\frac{a}{b}$ 与 ${\\color{red} x+y}$'

    expect(saveDocument(storage, value, null)).toBe('saved')
    expect(storage.getItem(documentKey)).toBe(value)
    expect(loadDocument(storage)).toBe(value)
  })

  it('读取异常时返回 null 且不覆盖缓存', () => {
    const storage = new MemoryStorage()
    storage.setItem(documentKey, '原缓存')
    const setItem = vi.spyOn(storage, 'setItem')
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    expect(loadDocument(storage)).toBeNull()
    expect(setItem).not.toHaveBeenCalled()
  })

  it('读取异常时通知调用方', () => {
    const storage = new MemoryStorage()
    const error = new Error('storage unavailable')
    const onError = vi.fn()
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw error
    })

    expect(loadDocument(storage, onError)).toBeNull()
    expect(onError).toHaveBeenCalledWith(error)
  })

  it('写入异常时返回 error', () => {
    const storage = new MemoryStorage()
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })

    expect(saveDocument(storage, '# 未保存', null)).toBe('error')
  })

  it('缓存已被其他标签页修改时拒绝覆盖', () => {
    const storage = new MemoryStorage()
    storage.setItem(documentKey, '其他标签页的新内容')

    expect(saveDocument(storage, '当前标签页的旧内容', '原缓存')).toBe('conflict')
    expect(storage.getItem(documentKey)).toBe('其他标签页的新内容')
  })

  it('保存前读取失败时不继续写入', () => {
    const storage = new MemoryStorage()
    storage.setItem(documentKey, '原缓存')
    const setItem = vi.spyOn(storage, 'setItem')
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    expect(saveDocument(storage, '新内容', '原缓存')).toBe('error')
    expect(setItem).not.toHaveBeenCalled()
  })

  it('不支持 Web Locks 时使用租约协议降级保存', async () => {
    const storage = new MemoryStorage()

    expect(await saveDocumentExclusive(storage, undefined, '新内容', null)).toBe('saved')
    expect(storage.getItem(documentKey)).toBe('新内容')
    expect(await saveDocumentExclusive(storage, undefined, '旧页面内容', null)).toBe('conflict')
    expect(storage.getItem(documentKey)).toBe('新内容')
    expect(storage.getItem(`${documentKey}:lease`)).toBeNull()
  })

  it('租约被其他标签页持有时等待其释放后保存', async () => {
    const storage = new MemoryStorage()
    const leaseKey = `${documentKey}:lease`
    storage.setItem(leaseKey, JSON.stringify({ token: 'other-tab', expiresAt: Date.now() + 60 }))
    setTimeout(() => storage.removeItem(leaseKey), 30)

    expect(await saveDocumentExclusive(storage, undefined, '新内容', null)).toBe('saved')
    expect(storage.getItem(documentKey)).toBe('新内容')
  })

  it('其他标签页崩溃后过期租约可被接管', async () => {
    const storage = new MemoryStorage()
    storage.setItem(`${documentKey}:lease`, JSON.stringify({ token: 'crashed-tab', expiresAt: Date.now() - 1 }))

    expect(await saveDocumentExclusive(storage, undefined, '新内容', null)).toBe('saved')
    expect(storage.getItem(documentKey)).toBe('新内容')
  })

  it('写入后租约被抢走时判定冲突而非误报保存', async () => {
    const storage = new MemoryStorage()
    const leaseKey = `${documentKey}:lease`
    const originalSetItem = storage.setItem.bind(storage)
    vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
      originalSetItem(key, value)
      if (key === documentKey) {
        originalSetItem(leaseKey, JSON.stringify({ token: 'rival', expiresAt: Date.now() + 5_000 }))
        originalSetItem(documentKey, '其他标签页的内容')
      }
    })

    expect(await saveDocumentExclusive(storage, undefined, '我的内容', null)).toBe('conflict')
    expect(storage.getItem(documentKey)).toBe('其他标签页的内容')
  })
})
