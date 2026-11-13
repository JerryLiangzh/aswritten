import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('分屏编辑器通过 DEV 适配器桥接源码、选区和预览', async ({ page }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL
  if (typeof baseURL !== 'string') throw new Error('Playwright baseURL 未配置')
  const appOrigin = new URL(baseURL).origin
  const crossOriginRequests: string[] = []
  page.on('request', request => {
    const url = new URL(request.url())
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== appOrigin) {
      crossOriginRequests.push(request.url())
    }
  })

  await page.goto('/')
  await page.waitForFunction(() => window.__editorAdapterForTest !== undefined)
  const source = page.locator('#editor textarea')
  await expect(source).toBeVisible()
  await source.fill('前 $x$ 后')
  await source.evaluate((element: HTMLTextAreaElement) => {
    element.focus()
    element.setSelectionRange(3, 4)
  })
  await expect(page.locator('[data-testid="selection-debug"]')).toHaveText('3:4')

  const snapshot = await page.evaluate(() => {
    const adapter = window.__editorAdapterForTest
    if (!adapter) throw new Error('DEV 编辑器适配器不可用')
    const { from, to } = adapter.getSnapshot()
    adapter.applyChange({ from, to, insert: '\\alpha' })
    adapter.focus()
    return adapter.getSnapshot()
  })

  expect(snapshot).toMatchObject({ from: 9, to: 9 })
  await expect(source).toHaveValue('前 $\\alpha$ 后')
  await expect(source).toBeFocused()
  await expect(page.locator('[data-testid="selection-debug"]')).toHaveText('9:9')
  await expect(page.locator('.vditor-preview .vditor-reset')).toContainText('前')
  await expect(page.locator('.vditor-preview .katex')).toBeVisible()
  expect(crossOriginRequests).toEqual([])
})

test('模板直接插入 Markdown 编辑区并更新 KaTeX 预览', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '公式助手' }).click()
  await page.getByRole('tab', { name: '模板' }).click()
  await page.locator('[data-formula-id="fraction"]').click()
  const source = page.locator('#editor textarea')
  await expect(source).toHaveValue('$\\frac{a}{b}$')
  await expect(page.locator('.vditor-preview .katex .mfrac')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('公式内插入 alpha 不重复美元符', async ({ page }) => {
  await page.goto('/')
  const source = page.locator('#editor textarea')
  await source.fill('$x$')
  await source.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(1, 1))
  await page.getByRole('button', { name: '公式助手' }).click()
  await page.locator('[data-formula-id="alpha"]').click()
  await expect(source).toHaveValue('$\\alphax$')
})

test('连续插入后面板保持打开且焦点回到源码', async ({ page }) => {
  await page.goto('/')
  const source = page.locator('#editor textarea')
  await page.getByRole('button', { name: '公式助手' }).click()
  await page.locator('[data-formula-id="alpha"]').click()
  await page.locator('[data-formula-id="beta"]').click()
  await expect(page.locator('#formula-panel')).toBeVisible()
  await expect(source).toBeFocused()
  await expect(source).toHaveValue('$\\alpha\\beta$')
})

test('独立模式只影响下一次插入', async ({ page }) => {
  await page.goto('/')
  const source = page.locator('#editor textarea')
  await source.fill('$x$\n')
  await source.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(4, 4))
  await page.getByRole('button', { name: '公式助手' }).click()
  await page.getByRole('button', { name: '独立', exact: true }).click()
  await page.locator('[data-formula-id="fraction"]').click()
  await expect(source).toHaveValue('$x$\n$$\n\\frac{a}{b}\n$$')
})

test('窄屏覆盖抽屉可以关闭并恢复源码焦点', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: '公式助手' }).click()
  await expect(page.locator('#formula-panel')).toBeVisible()
  await page.getByRole('button', { name: '关闭公式助手' }).click()
  await expect(page.locator('#formula-panel')).toBeHidden()
  await expect(page.getByRole('button', { name: '公式助手' })).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('#editor textarea')).toBeFocused()
})

test('颜色作为 LaTeX 写入当前选区并更新预览', async ({ page }) => {
  await page.goto('/')
  const source = page.locator('#editor textarea')
  await source.fill('$x+y$')
  await source.evaluate((element: HTMLTextAreaElement) => {
    element.focus()
    element.setSelectionRange(1, 4)
  })
  await page.getByRole('button', { name: '公式助手' }).click()
  await page.getByRole('tab', { name: '样式', exact: true }).click()
  await page.locator('[data-style-kind="color"][data-style-value="red"]').click()
  await expect(source).toHaveValue('${\\color{red} x+y}$')
  await expect(source).toBeFocused()
  const coloredMath = page.locator('.vditor-preview .katex [style*="color"]').first()
  await expect(coloredMath).toBeVisible()
  await expect(coloredMath).toHaveCSS('color', 'rgb(255, 0, 0)')
})

test('无选区插入字号时建立局部作用域并定位光标', async ({ page }) => {
  await page.goto('/')
  const source = page.locator('#editor textarea')
  await source.evaluate((element: HTMLTextAreaElement) => {
    element.focus()
    element.setSelectionRange(0, 0)
  })
  await page.getByRole('button', { name: '公式助手' }).click()
  await page.getByRole('tab', { name: '样式', exact: true }).click()
  await page.locator('[data-style-kind="size"][data-style-value="Large"]').click()
  await expect(source).toHaveValue('${\\Large }$')
  await expect(source).toBeFocused()
  await expect.poll(() => source.evaluate((element: HTMLTextAreaElement) => ({
    from: element.selectionStart,
    to: element.selectionEnd,
  }))).toEqual({ from: 9, to: 9 })
})

test('使用文档展示语法示例且可独立关闭', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '公式助手' }).click()
  await page.getByRole('button', { name: '使用文档', exact: true }).click()
  const documentPanel = page.locator('#usage-document')
  await expect(documentPanel).toBeVisible()
  await expect(documentPanel).toContainText('行内公式')
  await expect(documentPanel).toContainText('字号与颜色')
  await expect(documentPanel.locator('code').first()).toBeVisible()
  await expect(documentPanel.locator('textarea, input, [contenteditable="true"], .katex')).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: '关闭使用文档' }).click()
  await expect(documentPanel).toBeHidden()
  await expect(page.locator('#formula-panel')).toBeVisible()
})

test('样式入口仅提供限定选项且没有全局公式样式控件', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '公式助手' }).click()
  await page.getByRole('tab', { name: '样式', exact: true }).click()
  const styles = await page.locator('[data-style-kind]').evaluateAll(elements => elements.map(element => ({
    kind: (element as HTMLElement).dataset.styleKind,
    value: (element as HTMLElement).dataset.styleValue,
  })))
  expect(styles).toEqual([
    { kind: 'color', value: 'red' },
    { kind: 'color', value: 'blue' },
    { kind: 'color', value: 'green' },
    { kind: 'size', value: 'small' },
    { kind: 'size', value: 'large' },
    { kind: 'size', value: 'Large' },
    { kind: 'size', value: 'huge' },
    { kind: 'size', value: 'Huge' },
  ])
  await expect(page.getByRole('button', { name: /全局公式|公式缩放|统一变色|仅预览/ })).toHaveCount(0)
  await expect(page.getByRole('slider', { name: /公式/ })).toHaveCount(0)
})

test('刷新后恢复当前 Markdown 文档', async ({ page }) => {
  await page.goto('/')
  const source = page.locator('#editor textarea')
  const value = '# 本地标题\n\n$\\frac{a}{b}$ 与 ${\\color{red} x+y}$'
  await source.fill(value)
  await expect(page.locator('#document-status')).toHaveText('已保存')
  await page.reload()
  await expect(source).toHaveValue(value)
})

test('取消导入不会替换当前文档', async ({ page }) => {
  await page.goto('/')
  const source = page.locator('#editor textarea')
  await source.fill('保留原文')
  page.once('dialog', dialog => dialog.dismiss())
  await page.locator('#markdown-import-input').setInputFiles({
    name: 'replacement.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('不应导入'),
  })
  await expect(source).toHaveValue('保留原文')
})

test('确认导入后更新编辑器并持久化', async ({ page }) => {
  await page.goto('/')
  const source = page.locator('#editor textarea')
  const value = '# 导入文档\n\n$\\alpha$'
  page.once('dialog', dialog => dialog.accept())
  await page.locator('#markdown-import-input').setInputFiles({
    name: 'imported.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(value),
  })
  await expect(source).toHaveValue(value)
  await expect(page.locator('#document-status')).toHaveText('已导入 imported.md')
  await page.reload()
  await expect(source).toHaveValue(value)
})

test('导出文件保留 UTF-8 中文和 LaTeX 样式原文', async ({ page }) => {
  await page.goto('/')
  const value = '# 导出标题\n\n${\\color{red} \\frac{a}{b}}$'
  await page.locator('#editor textarea').fill(value)
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 Markdown' }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe('document.md')
  const path = await download.path()
  if (!path) throw new Error('下载文件路径不可用')
  expect(await readFile(path, 'utf8')).toBe(value)
})

test('本地保存失败时仍可编辑并导出备份', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    }
  })
  await page.goto('/')
  const value = '# 未保存内容\n\n$\\beta$'
  await page.locator('#editor textarea').fill(value)
  await expect(page.locator('#document-status')).toHaveText('本地保存失败，请导出 Markdown 备份')
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 Markdown' }).click()
  const download = await downloadEvent
  const path = await download.path()
  if (!path) throw new Error('下载文件路径不可用')
  expect(await readFile(path, 'utf8')).toBe(value)
})
