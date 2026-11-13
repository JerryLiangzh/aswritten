import { describe, expect, it } from 'vitest'
import {
  buildFormulaInsertion,
  buildStyleChange,
} from '../../src/formula/insert'
import type { FormulaStyle } from '../../src/formula/types'

describe('buildFormulaInsertion', () => {
  it('普通文本按行内模式包装，光标位于右美元符前', () => {
    expect(buildFormulaInsertion(
      { text: '正文', from: 2, to: 2 }, '\\alpha', 'inline',
    )).toEqual({ from: 2, to: 2, insert: '$\\alpha$', cursor: 9 })
  })

  it('普通文本按独立模式包装，光标位于内容末尾', () => {
    expect(buildFormulaInsertion(
      { text: '', from: 0, to: 0 }, '\\frac{a}{b}', 'block',
    )).toEqual({
      from: 0,
      to: 0,
      insert: '$$\n\\frac{a}{b}\n$$',
      cursor: 14,
    })
  })

  it('普通文本中的选区由新公式替换', () => {
    expect(buildFormulaInsertion(
      { text: '甲乙', from: 1, to: 2 }, '\\beta', 'inline',
    )).toEqual({ from: 1, to: 2, insert: '$\\beta$', cursor: 7 })
  })

  it('公式内部不重复包装，请求模式不改变已有公式', () => {
    const inline = buildFormulaInsertion(
      { text: '$x$', from: 1, to: 1 }, '\\alpha', 'block',
    )
    expect(inline.insert).toBe('\\alpha')
    expect(inline.from).toBe(1)
    expect(inline.to).toBe(1)
    expect(inline.cursor ?? inline.from + inline.insert.length).toBe(7)

    const block = buildFormulaInsertion(
      { text: '$$\nx\n$$', from: 3, to: 3 }, '\\alpha', 'inline',
    )
    expect(block.insert).toBe('\\alpha')
  })

  it('公式内部替换选区时不补分隔符', () => {
    const change = buildFormulaInsertion(
      { text: '$old$', from: 1, to: 4 }, '\\gamma', 'inline',
    )
    expect(change).toMatchObject({ from: 1, to: 4, insert: '\\gamma' })
  })

  it.each([
    ['`$x$`', 2],
    ['```\n$x$\n```', 5],
    ['~~~\n$x$\n~~~', 5],
  ])('代码上下文 %s 只插入原始 LaTeX', (text, offset) => {
    const change = buildFormulaInsertion(
      { text, from: offset, to: offset }, '\\alpha', 'inline',
    )
    expect(change).toMatchObject({ from: offset, to: offset, insert: '\\alpha' })
  })

  it('unknown 上下文只插入原始 LaTeX', () => {
    expect(buildFormulaInsertion(
      { text: '前文 $x', from: 4, to: 4 }, '\\alpha', 'block',
    ).insert).toBe('\\alpha')
  })

  it('转义美元符不会阻止普通文本包装', () => {
    expect(buildFormulaInsertion(
      { text: '\\$5', from: 3, to: 3 }, 'x', 'inline',
    ).insert).toBe('$x$')
  })

  it('光标计算保持 UTF-16 偏移', () => {
    expect(buildFormulaInsertion(
      { text: '😀', from: 2, to: 2 }, 'x', 'inline',
    )).toEqual({ from: 2, to: 2, insert: '$x$', cursor: 4 })
  })
})

describe('buildStyleChange', () => {
  it('有选区时用颜色和花括号包装', () => {
    expect(buildStyleChange(
      { text: '$x+y$', from: 1, to: 4 },
      { kind: 'color', value: 'red' }, 'inline',
    ).insert).toBe('{\\color{red} x+y}')
  })

  it.each(['red', 'blue', 'green'] as const)('生成 %s 颜色命令', value => {
    expect(buildStyleChange(
      { text: '$x$', from: 1, to: 2 },
      { kind: 'color', value }, 'inline',
    ).insert).toBe(`{\\color{${value}} x}`)
  })

  it.each(['small', 'large', 'Large', 'huge', 'Huge'] as const)('生成 %s 字号命令', value => {
    expect(buildStyleChange(
      { text: '$x$', from: 1, to: 2 },
      { kind: 'size', value }, 'inline',
    ).insert).toBe(`{\\${value} x}`)
  })

  it('普通文本中的样式选区按当前模式补分隔符', () => {
    expect(buildStyleChange(
      { text: 'x+y', from: 0, to: 3 },
      { kind: 'color', value: 'red' }, 'inline',
    ).insert).toBe('${\\color{red} x+y}$')

    expect(buildStyleChange(
      { text: 'x+y', from: 0, to: 3 },
      { kind: 'size', value: 'Large' }, 'block',
    ).insert).toBe('$$\n{\\Large x+y}\n$$')
  })

  it('公式内无选区时插入空作用域，光标在空格后', () => {
    expect(buildStyleChange(
      { text: '$x$', from: 1, to: 1 },
      { kind: 'color', value: 'red' }, 'inline',
    )).toEqual({ from: 1, to: 1, insert: '{\\color{red} }', cursor: 14 })
  })

  it('普通文本无选区时先建立行内公式，再定位到空作用域', () => {
    expect(buildStyleChange(
      { text: '', from: 0, to: 0 },
      { kind: 'color', value: 'red' }, 'inline',
    )).toEqual({ from: 0, to: 0, insert: '${\\color{red} }$', cursor: 14 })
  })

  it('普通文本无选区时支持独立公式和字号', () => {
    expect(buildStyleChange(
      { text: '', from: 0, to: 0 },
      { kind: 'size', value: 'Large' }, 'block',
    )).toEqual({ from: 0, to: 0, insert: '$$\n{\\Large }\n$$', cursor: 11 })
  })

  it('独立公式内不重复添加分隔符', () => {
    const style: FormulaStyle = { kind: 'size', value: 'small' }
    expect(buildStyleChange(
      { text: '$$\nx\n$$', from: 3, to: 3 }, style, 'inline',
    )).toEqual({ from: 3, to: 3, insert: '{\\small }', cursor: 11 })
  })

  it.each([
    ['`$x$`', 2],
    ['前文 $x', 4],
  ])('代码或 unknown 中不自动添加公式分隔符', (text, offset) => {
    const change = buildStyleChange(
      { text, from: offset, to: offset },
      { kind: 'color', value: 'blue' }, 'block',
    )
    expect(change.insert).toBe('{\\color{blue} }')
    expect(change.insert).not.toContain('$$')
  })
})
