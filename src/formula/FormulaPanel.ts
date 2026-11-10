import type { EditorAdapter } from '../editor/types'
import { formulaItems, formulaStyles } from './catalog'
import { buildFormulaInsertion, buildStyleChange } from './insert'
import type { FormulaItem, FormulaMode, FormulaStyle } from './types'

type PanelGroup = FormulaItem['group'] | 'style'

const groupTabs: Array<{ id: PanelGroup; label: string }> = [
  { id: 'common', label: '常用' },
  { id: 'greek', label: '希腊字母' },
  { id: 'operator', label: '运算符' },
  { id: 'template', label: '模板' },
  { id: 'style', label: '样式' },
]

const featuredIds = new Set(['alpha', 'beta', 'fraction'])
const styleLabels: Record<FormulaStyle['value'], string> = {
  red: '红色',
  blue: '蓝色',
  green: '绿色',
  small: 'small',
  large: 'large',
  Large: 'Large',
  huge: 'huge',
  Huge: 'Huge',
}

export function mountFormulaPanel(
  container: HTMLElement,
  adapter: EditorAdapter,
): { destroy(): void } {
  let activeGroup: PanelGroup = 'common'
  let mode: FormulaMode = 'inline'
  const tabButtons = new Map<PanelGroup, HTMLButtonElement>()
  const modeButtons = new Map<FormulaMode, HTMLButtonElement>()

  const header = document.createElement('div')
  header.className = 'formula-panel__header'
  const title = document.createElement('h2')
  title.id = 'formula-panel-title'
  title.textContent = '公式助手'
  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'formula-panel__close'
  closeButton.dataset.formulaPanelClose = ''
  closeButton.setAttribute('aria-label', '关闭公式助手')
  closeButton.textContent = '×'
  header.append(title, closeButton)

  const modeGroup = document.createElement('div')
  modeGroup.className = 'formula-panel__modes'
  modeGroup.setAttribute('role', 'group')
  modeGroup.setAttribute('aria-label', '公式模式')
  for (const item of [{ id: 'inline', label: '行内' }, { id: 'block', label: '独立' }] as const) {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.formulaMode = item.id
    button.textContent = item.label
    modeButtons.set(item.id, button)
    modeGroup.append(button)
  }

  const tabList = document.createElement('div')
  tabList.className = 'formula-panel__tabs'
  tabList.setAttribute('role', 'tablist')
  tabList.setAttribute('aria-label', '公式分类')
  for (const tab of groupTabs) {
    const button = document.createElement('button')
    button.type = 'button'
    button.id = `formula-tab-${tab.id}`
    button.dataset.formulaGroup = tab.id
    button.setAttribute('role', 'tab')
    button.setAttribute('aria-controls', 'formula-panel-items')
    button.textContent = tab.label
    tabButtons.set(tab.id, button)
    tabList.append(button)
  }

  const itemsPanel = document.createElement('div')
  itemsPanel.id = 'formula-panel-items'
  itemsPanel.className = 'formula-panel__items'
  itemsPanel.setAttribute('role', 'tabpanel')

  const updateModeButtons = () => {
    for (const [buttonMode, button] of modeButtons) {
      button.setAttribute('aria-pressed', String(buttonMode === mode))
    }
  }

  const renderGroup = () => {
    for (const [group, button] of tabButtons) {
      button.setAttribute('aria-selected', String(group === activeGroup))
    }
    itemsPanel.setAttribute('aria-labelledby', `formula-tab-${activeGroup}`)

    if (activeGroup === 'style') {
      const buttons = formulaStyles.map(style => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'formula-item formula-style'
        button.dataset.styleKind = style.kind
        button.dataset.styleValue = style.value
        button.title = style.kind === 'color' ? `\\color{${style.value}}` : `\\${style.value}`
        button.textContent = styleLabels[style.value]
        return button
      })
      itemsPanel.replaceChildren(...buttons)
      return
    }

    const items = formulaItems.filter(item => (
      item.group === activeGroup || (activeGroup === 'common' && featuredIds.has(item.id))
    ))
    const buttons = items.map(item => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'formula-item'
      button.dataset.formulaId = item.id
      button.title = item.latex
      button.textContent = item.label
      return button
    })
    itemsPanel.replaceChildren(...buttons)
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (event.target instanceof Element && event.target.closest('button')) {
      event.preventDefault()
    }
  }

  const handleClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return
    const button = event.target.closest<HTMLButtonElement>('button')
    if (!button || !container.contains(button)) return

    if (button.hasAttribute('data-formula-panel-close')) {
      container.hidden = true
      container.dispatchEvent(new CustomEvent('formula-panel-close', { bubbles: true }))
      adapter.focus()
      return
    }

    const group = button.dataset.formulaGroup as PanelGroup | undefined
    if (group && groupTabs.some(tab => tab.id === group)) {
      activeGroup = group
      renderGroup()
      return
    }

    const requestedMode = button.dataset.formulaMode
    if (requestedMode === 'inline' || requestedMode === 'block') {
      mode = requestedMode
      updateModeButtons()
      adapter.focus()
      return
    }

    const style = formulaStyles.find(candidate => (
      candidate.kind === button.dataset.styleKind && candidate.value === button.dataset.styleValue
    ))
    if (style) {
      const snapshot = adapter.getSnapshot()
      const change = buildStyleChange(snapshot, style, mode)
      adapter.applyChange(change)
      adapter.focus()
      return
    }

    const item = formulaItems.find(candidate => candidate.id === button.dataset.formulaId)
    if (!item) return
    const change = buildFormulaInsertion(adapter.getSnapshot(), item.latex, mode)
    adapter.applyChange(change)
    adapter.focus()
  }

  container.classList.add('formula-panel')
  container.hidden = true
  container.setAttribute('aria-labelledby', title.id)
  container.replaceChildren(header, modeGroup, tabList, itemsPanel)
  container.addEventListener('pointerdown', handlePointerDown)
  container.addEventListener('click', handleClick)
  updateModeButtons()
  renderGroup()

  return {
    destroy() {
      container.removeEventListener('pointerdown', handlePointerDown)
      container.removeEventListener('click', handleClick)
      container.replaceChildren()
    },
  }
}
