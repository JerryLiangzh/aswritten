import { describe, expect, it, vi } from 'vitest'
import { loadDocument, saveDocument } from '../../src/persistence/documentStore'

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

    expect(saveDocument(storage, value)).toBe(true)
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

  it('写入异常时返回 false', () => {
    const storage = new MemoryStorage()
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })

    expect(saveDocument(storage, '# 未保存')).toBe(false)
  })
})
