export const documentKey = 'aswritten:document:v1'

const leaseKey = `${documentKey}:lease`
const leaseTtlMs = 5_000
const leaseSettleMs = 25
const leaseAttempts = 5

export type SaveDocumentResult = 'saved' | 'conflict' | 'error'

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

interface Lease {
  token: string
  expiresAt: number
}

function readLease(storage: Storage): Lease | null {
  const raw = storage.getItem(leaseKey)
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw) as Partial<Lease>
    if (typeof parsed.token === 'string' && typeof parsed.expiresAt === 'number') {
      return { token: parsed.token, expiresAt: parsed.expiresAt }
    }
  } catch {
  }
  return null
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function saveDocumentWithLease(
  storage: Storage,
  value: string,
  expectedValue: string | null,
): Promise<SaveDocumentResult> {
  const token = `${Date.now()}:${Math.random().toString(36).slice(2)}`

  for (let attempt = 0; attempt < leaseAttempts; attempt += 1) {
    const held = readLease(storage)
    if (held && held.expiresAt > Date.now()) {
      await delay(leaseSettleMs)
      continue
    }

    storage.setItem(leaseKey, JSON.stringify({ token, expiresAt: Date.now() + leaseTtlMs }))
    await delay(leaseSettleMs)
    const current = readLease(storage)
    if (!current || current.token !== token) {
      await delay(leaseSettleMs)
      continue
    }

    try {
      if (storage.getItem(documentKey) !== expectedValue) {
        return 'conflict'
      }
      storage.setItem(documentKey, value)
      const leaseAfter = readLease(storage)
      if (!leaseAfter || leaseAfter.token !== token) return 'conflict'
      if (storage.getItem(documentKey) !== value) return 'conflict'
      return 'saved'
    } finally {
      const mine = readLease(storage)
      if (mine && mine.token === token) {
        storage.removeItem(leaseKey)
      }
    }
  }
  return 'conflict'
}

export async function saveDocumentExclusive(
  storage: Storage,
  locks: LockManager | undefined,
  value: string,
  expectedValue: string | null,
): Promise<SaveDocumentResult> {
  if (!locks) {
    try {
      return await saveDocumentWithLease(storage, value, expectedValue)
    } catch {
      return 'error'
    }
  }

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
