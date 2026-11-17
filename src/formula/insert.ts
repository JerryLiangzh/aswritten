import type { EditorSnapshot, TextChange } from '../editor/types'
import { detectFormulaContext } from './context'
import type { FormulaMode, FormulaStyle } from './types'

function wrapFormula(latex: string, mode: FormulaMode): string {
  return mode === 'inline' ? `$${latex}$` : `$$\n${latex}\n$$`
}

function formulaPrefixLength(mode: FormulaMode): number {
  return mode === 'inline' ? 1 : 3
}

function getSelectionContext(text: string, from: number, to: number) {
  const startContext = detectFormulaContext(text, from)
  if (from === to) return startContext

  const endContext = detectFormulaContext(text, to)
  const containsDelimiter = /[$`~]/.test(text.slice(from, to))
  return startContext === endContext && !containsDelimiter ? startContext : 'mixed'
}

function preserveSelection(text: string, from: number, to: number): TextChange {
  return {
    from,
    to,
    insert: text.slice(from, to),
    cursor: from,
  }
}

export function buildFormulaInsertion(
  snapshot: EditorSnapshot,
  latex: string,
  mode: FormulaMode,
): TextChange {
  const { text, from, to } = snapshot
  const context = getSelectionContext(text, from, to)
  if (context === 'mixed') {
    return preserveSelection(text, from, to)
  }
  if (context !== 'text') {
    return { from, to, insert: latex }
  }

  return {
    from,
    to,
    insert: wrapFormula(latex, mode),
    cursor: from + formulaPrefixLength(mode) + latex.length,
  }
}

function styleCommand(style: FormulaStyle): string {
  return style.kind === 'color' ? `\\color{${style.value}}` : `\\${style.value}`
}

export function buildStyleChange(
  snapshot: EditorSnapshot,
  style: FormulaStyle,
  mode: FormulaMode,
): TextChange {
  const { text, from, to } = snapshot
  const context = getSelectionContext(text, from, to)
  if (context === 'mixed') {
    return preserveSelection(text, from, to)
  }
  const command = styleCommand(style)
  const scope = `{${command} ${text.slice(from, to)}}`
  const inText = context === 'text'
  const change: TextChange = {
    from,
    to,
    insert: inText ? wrapFormula(scope, mode) : scope,
  }

  if (from === to) {
    const prefixLength = inText ? formulaPrefixLength(mode) : 0
    change.cursor = from + prefixLength + command.length + 2
  }

  return change
}
