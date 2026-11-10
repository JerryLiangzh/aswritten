import type { FormulaContext, FormulaMode } from './types'

interface Fence {
  marker: '`' | '~'
  length: number
}

function readRun(text: string, start: number, character: string): number {
  let end = start
  while (text[end] === character) end += 1
  return end - start
}

function readFence(text: string, start: number): Fence | null {
  if (start > 0 && text[start - 1] !== '\n') return null

  let markerStart = start
  while (markerStart < start + 3 && text[markerStart] === ' ') markerStart += 1

  const character = text[markerStart]
  if (character !== '`' && character !== '~') return null

  const length = readRun(text, markerStart, character)
  return length >= 3 ? { marker: character, length } : null
}

function isFenceClosing(line: string, fence: Fence): boolean {
  let markerStart = 0
  while (markerStart < 3 && line[markerStart] === ' ') markerStart += 1
  if (line[markerStart] !== fence.marker) return false

  const length = readRun(line, markerStart, fence.marker)
  if (length < fence.length) return false

  const rest = line.slice(markerStart + length)
  return /^[ \t]*$/.test(rest)
}

function findFenceEnd(text: string, contentStart: number, fence: Fence): number {
  let lineStart = contentStart

  while (lineStart < text.length) {
    const newline = text.indexOf('\n', lineStart)
    const lineEnd = newline === -1 ? text.length : newline
    const contentEnd = lineEnd > lineStart && text[lineEnd - 1] === '\r'
      ? lineEnd - 1
      : lineEnd

    if (isFenceClosing(text.slice(lineStart, contentEnd), fence)) {
      return newline === -1 ? lineEnd : lineEnd + 1
    }
    if (newline === -1) break
    lineStart = lineEnd + 1
  }

  return -1
}

function findInlineCodeEnd(text: string, start: number, openingLength: number): number {
  let index = start

  while (index < text.length) {
    if (text[index] !== '`') {
      index += 1
      continue
    }

    const length = readRun(text, index, '`')
    if (length === openingLength) return index + length
    index += length
  }

  return -1
}

function findFormulaEnd(text: string, start: number, mode: FormulaMode): number {
  const delimiterLength = mode === 'block' ? 2 : 1
  let index = start

  while (index < text.length) {
    if (text[index] === '\\' && index + 1 < text.length) {
      index += 2
      continue
    }
    if (text[index] !== '$') {
      index += 1
      continue
    }

    const length = readRun(text, index, '$')
    if (length === delimiterLength) return index
    index += length
  }

  return -1
}

/** 使用与 textarea 一致的 UTF-16 索引判断光标所在上下文。 */
export function detectFormulaContext(text: string, offset: number): FormulaContext {
  if (!Number.isInteger(offset) || offset < 0 || offset > text.length) return 'unknown'

  let index = 0
  while (index < text.length) {
    const fence = readFence(text, index)
    if (fence) {
      const newline = text.indexOf('\n', index)
      const contentStart = newline === -1 ? text.length : newline + 1
      const end = findFenceEnd(text, contentStart, fence)
      if (end === -1) return offset > index ? 'code' : 'text'
      if (offset > index && offset < end) return 'code'
      index = end
      continue
    }

    if (text[index] === '\\' && index + 1 < text.length) {
      index += 2
      continue
    }

    if (text[index] === '`') {
      const openingLength = readRun(text, index, '`')
      const end = findInlineCodeEnd(text, index + openingLength, openingLength)
      if (end === -1) return offset > index ? 'unknown' : 'text'
      if (offset > index && offset < end) return 'code'
      index = end
      continue
    }

    if (text[index] === '$') {
      const mode: FormulaMode = text[index + 1] === '$' ? 'block' : 'inline'
      const delimiterLength = mode === 'block' ? 2 : 1
      const contentStart = index + delimiterLength
      const closeStart = findFormulaEnd(text, contentStart, mode)
      if (closeStart === -1) return offset > index ? 'unknown' : 'text'

      const closeEnd = closeStart + delimiterLength
      if (offset > index && offset < contentStart) return 'unknown'
      if (offset >= contentStart && offset <= closeStart) return mode
      if (offset > closeStart && offset < closeEnd) return 'unknown'
      index = closeEnd
      continue
    }

    index += 1
  }

  return 'text'
}
