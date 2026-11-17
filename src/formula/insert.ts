import type { EditorSnapshot, TextChange } from '../editor/types'
import { detectFormulaContext } from './context'
import type { FormulaMode, FormulaStyle } from './types'

function blockLeadingNewline(text: string, from: number): string {
  return from > 0 && !/(?:\r\n|\n)$/.test(text.slice(0, from)) ? '\n' : ''
}

function blockTrailingNewline(text: string, to: number): string {
  return to < text.length && !/^\r?\n/.test(text.slice(to)) ? '\n' : ''
}

function wrapFormula(
  latex: string,
  mode: FormulaMode,
  text: string,
  from: number,
  to: number,
): string {
  if (mode === 'inline') return `$${latex}$`

  const leading = blockLeadingNewline(text, from)
  const trailing = blockTrailingNewline(text, to)
  return `${leading}$$\n${latex}\n$$${trailing}`
}

function formulaPrefixLength(mode: FormulaMode, text: string, from: number): number {
  if (mode === 'inline') return 1
  return blockLeadingNewline(text, from).length + 3
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
    insert: wrapFormula(latex, mode, text, from, to),
    cursor: from + formulaPrefixLength(mode, text, from) + latex.length,
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
    insert: inText ? wrapFormula(scope, mode, text, from, to) : scope,
  }

  if (from === to) {
    const prefixLength = inText ? formulaPrefixLength(mode, text, from) : 0
    change.cursor = from + prefixLength + command.length + 2
  }

  return change
}
