export type FormulaMode = 'inline' | 'block'
export type FormulaContext = FormulaMode | 'text' | 'code' | 'unknown'

export interface FormulaItem {
  id: string
  label: string
  latex: string
  group: 'common' | 'greek' | 'operator' | 'template'
}

export interface FormulaStyle {
  kind: 'color' | 'size'
  value: 'red' | 'blue' | 'green' | 'small' | 'large' | 'Large' | 'huge' | 'Huge'
}
