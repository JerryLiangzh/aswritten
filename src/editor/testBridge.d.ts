import type { EditorAdapter } from './types'

declare global {
  interface Window {
    __editorAdapterForTest?: EditorAdapter
  }
}

export {}
