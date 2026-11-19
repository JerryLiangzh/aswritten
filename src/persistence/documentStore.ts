export const documentKey = 'aswritten:document:v1'

export type SaveDocumentResult = 'saved' | 'conflict' | 'error'
export type ExclusiveSaveResult = SaveDocumentResult | 'unsupported'

export function loadDocument(storage: Storage, onError?: (error: unknown) => void): string | null {
  try {
    return storage.getItem(documentKey)
  } catch (error) {
    onError?.(error)
    return null
  }
}

export function saveDocument(
  storage: Storage,
  value: string,
  expectedValue: string | null,
): SaveDocumentResult {
  try {
    if (storage.getItem(documentKey) !== expectedValue) {
      return 'conflict'
    }
    storage.setItem(documentKey, value)
    return 'saved'
  } catch {
    return 'error'
  }
}

export async function saveDocumentExclusive(
  storage: Storage,
  locks: LockManager | undefined,
  value: string,
  expectedValue: string | null,
): Promise<ExclusiveSaveResult> {
  if (!locks) return 'unsupported'

  try {
    return await locks.request(
      `${documentKey}:write`,
      { mode: 'exclusive' },
      () => saveDocument(storage, value, expectedValue),
    )
  } catch {
    return 'error'
  }
}
