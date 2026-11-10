import type { EditorSnapshot, TextChange } from '../editor/types'
import { detectFormulaContext } from './context'
import type { FormulaMode, FormulaStyle } from './types'

function wrapFormula(latex: string, mode: FormulaMode): string {
  return mode === 'inline' ? `$${latex}$` : `$$\n${latex}\n$$`
}

function formulaPrefixLength(mode: FormulaMode): number {
  return mode === 'inline' ? 1 : 3
}

export function buildFormulaInsertion(
  snapshot: EditorSnapshot,
  latex: string,
  mode: FormulaMode,
): TextChange {
  const { text, from, to } = snapshot
  if (detectFormulaContext(text, from) !== 'text') {
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
  const command = styleCommand(style)
  const scope = `{${command} ${text.slice(from, to)}}`
  const inText = detectFormulaContext(text, from) === 'text'
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
