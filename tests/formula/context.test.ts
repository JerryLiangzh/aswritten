import { describe, expect, it } from 'vitest'
import { detectFormulaContext } from '../../src/formula/context'

describe('detectFormulaContext', () => {
  it.each([
    ['普通 $x + y$ 文本', 5, 'inline'],
    ['$$\nx + y\n$$', 3, 'block'],
    ['普通文本', 2, 'text'],
    ['`$x$`', 3, 'code'],
    ['```\n$x$\n```', 6, 'code'],
    ['价格 \\$5', 6, 'text'],
  ])('识别 %s', (text, offset, expected) => {
    expect(detectFormulaContext(text, offset as number)).toBe(expected)
  })

  it('识别行内公式内容末尾和公式外的边界', () => {
    expect(detectFormulaContext('$x$', 0)).toBe('text')
    expect(detectFormulaContext('$x$', 1)).toBe('inline')
    expect(detectFormulaContext('$x$', 2)).toBe('inline')
    expect(detectFormulaContext('$x$', 3)).toBe('text')
  })

  it('识别独立公式边界，分隔符内部不作公式内容', () => {
    expect(detectFormulaContext('$$x$$', 1)).toBe('unknown')
    expect(detectFormulaContext('$$x$$', 2)).toBe('block')
    expect(detectFormulaContext('$$x$$', 3)).toBe('block')
    expect(detectFormulaContext('$$x$$', 4)).toBe('unknown')
    expect(detectFormulaContext('$$x$$', 5)).toBe('text')
  })

  it('识别同一文档中的多个公式和普通文本', () => {
    const text = '$a$ 与 $$b$$'
    expect(detectFormulaContext(text, 1)).toBe('inline')
    expect(detectFormulaContext(text, 4)).toBe('text')
    expect(detectFormulaContext(text, 8)).toBe('block')
  })

  it('跳过转义美元符，并按连续反斜杠奇偶性判断', () => {
    expect(detectFormulaContext('成本 \\$5 与 \\$6', 10)).toBe('text')
    expect(detectFormulaContext('\\\\$x$', 3)).toBe('inline')
  })

  it('识别不同长度的反引号代码', () => {
    expect(detectFormulaContext('``$x$``', 3)).toBe('code')
    expect(detectFormulaContext('前 `$x$` 后 $y$', 11)).toBe('inline')
  })

  it('识别波浪线、语言信息和未闭合 fenced code', () => {
    expect(detectFormulaContext('~~~tex\n$x$\n~~~', 7)).toBe('code')
    expect(detectFormulaContext('```math\n$x$\n```', 8)).toBe('code')
    expect(detectFormulaContext('```\n$x$', 5)).toBe('code')
  })

  it('fenced code 结束后继续识别公式', () => {
    expect(detectFormulaContext('```\n$x$\n```\n$y$', 13)).toBe('inline')
  })

  it('闭合 fenced code 位于文档末尾时，之后是普通文本', () => {
    const text = '```\n$x$\n```'
    expect(detectFormulaContext(text, text.length)).toBe('text')
  })

  it('未闭合公式和反引号分隔符返回 unknown', () => {
    expect(detectFormulaContext('前文 $x', 4)).toBe('unknown')
    expect(detectFormulaContext('$$x', 2)).toBe('unknown')
    expect(detectFormulaContext('`$x$', 2)).toBe('unknown')
  })

  it('不会用双美元符的一半闭合另一种公式', () => {
    expect(detectFormulaContext('$x$$', 1)).toBe('unknown')
    expect(detectFormulaContext('$$x$', 2)).toBe('unknown')
  })

  it('未闭合分隔符之前的普通文本不受影响', () => {
    expect(detectFormulaContext('前文 $x', 2)).toBe('text')
  })

  it('直接使用 UTF-16 偏移', () => {
    const text = '😀 $x$'
    expect(text).toHaveLength(6)
    expect(detectFormulaContext(text, 4)).toBe('inline')
    expect(detectFormulaContext(text, 6)).toBe('text')
  })

  it('空文档、越界和非整数偏移安全返回', () => {
    expect(detectFormulaContext('', 0)).toBe('text')
    expect(detectFormulaContext('$x$', -1)).toBe('unknown')
    expect(detectFormulaContext('$x$', 4)).toBe('unknown')
    expect(detectFormulaContext('$x$', 1.5)).toBe('unknown')
  })
})
