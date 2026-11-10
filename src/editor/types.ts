/**
 * 文件名: types.ts
 * 描述: 定义编辑器适配器及其文本快照、变更接口。
 */
export interface EditorSnapshot {
  text: string
  from: number
  to: number
}

export interface TextChange {
  from: number
  to: number
  insert: string
  cursor?: number
}

export interface EditorAdapter {
  getSnapshot(): EditorSnapshot
  getValue(): string
  setValue(value: string): void
  applyChange(change: TextChange): void
  focus(): void
  onInput(callback: (value: string) => void): void
}
