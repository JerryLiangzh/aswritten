const documentKey = 'aswritten:document:v1'

export function loadDocument(storage: Storage, onError?: (error: unknown) => void): string | null {
  try {
    return storage.getItem(documentKey)
  } catch (error) {
    onError?.(error)
    return null
  }
}

export function saveDocument(storage: Storage, value: string): boolean {
  try {
    storage.setItem(documentKey, value)
    return true
  } catch {
    return false
  }
}
