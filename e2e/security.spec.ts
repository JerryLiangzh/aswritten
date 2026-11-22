import { expect, test } from '@playwright/test'

test('错误公式保留原文且不会使页面崩溃', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto('/')
  const source = page.locator('#editor textarea')
  const value = '前文 $\\frac{a}{$ 后文'
  await source.fill(value)
  await expect(source).toHaveValue(value)
  await expect(page.locator('.vditor-preview .vditor-reset')).toContainText('后文')
  expect(pageErrors).toEqual([])
})

test('代码块中的美元符不会触发公式包装', async ({ page }) => {
  await page.goto('/')
  const source = page.locator('#editor textarea.vditor-sv')
  await source.fill('```tex\n$x$\n```')
  await source.evaluate((element: HTMLTextAreaElement) => {
    element.focus()
    element.setSelectionRange(8, 8)
  })
  await page.getByRole('button', { name: '公式助手' }).click()
  await page.locator('[data-formula-id="alpha"]').click()
  await expect(source).toHaveValue('```tex\n$\\alphax$\n```')
})

test('导入的 HTML 和脚本不会在预览中执行', async ({ page }) => {
  await page.goto('/')
  const value = '<img src="x" onerror="window.__xss = 1">\n\n<script>window.__xss = 1</script>'
  page.once('dialog', dialog => dialog.accept())
  await page.locator('#markdown-import-input').setInputFiles({
    name: 'unsafe.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(value),
  })
  await expect(page.locator('#editor textarea')).toHaveValue(value)
  await expect(page.locator('.vditor-preview [onerror], .vditor-preview script')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
})

test('关键同源运行资源没有失败响应', async ({ page }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL
  if (typeof baseURL !== 'string') throw new Error('Playwright baseURL 未配置')
  const appOrigin = new URL(baseURL).origin
  const failures: string[] = []
  page.on('response', response => {
    const url = new URL(response.url())
    if (url.origin === appOrigin && response.status() >= 400) {
      failures.push(`${response.status()} ${response.url()}`)
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: '公式助手' }).click()
  await page.getByRole('tab', { name: '模板' }).click()
  await page.locator('[data-formula-id="fraction"]').click()
  await expect(page.locator('.vditor-preview .katex')).toBeVisible()
  expect(failures).toEqual([])
})

for (const language of ['echarts', 'wavedrom'] as const) {
  test(`${language} 代码块只显示原文且不执行`, async ({ page }) => {
    await page.goto('/')
    const source = page.locator('#editor textarea')
    const value = [
      `\`\`\`${language}`,
      '(() => { window.__xss = 1; return {}; })()',
      '```',
    ].join('\n')

    await source.fill(value)
    await expect(
      page.locator(`.vditor-preview [data-render-disabled="${language}"]`),
    ).toHaveAttribute('data-render-disabled', language)

    expect(
      await page.evaluate(
        () => (window as unknown as { __xss?: number }).__xss,
      ),
    ).toBeUndefined()
  })
}

test('格式化链接中的子元素也使用安全打开逻辑', async ({ page, context }) => {
  await context.route('https://github.com/**/*', route => route.fulfill({ body: 'ok' }))
  await page.goto('/')
  await page.locator('#editor textarea').fill('[**外部链接**](https://github.com/)')

  const popupEvent = page.waitForEvent('popup')
  await page.locator('.vditor-preview a strong').click()
  const popup = await popupEvent

  await popup.waitForLoadState()
  expect(popup.url()).toBe('https://github.com/')
  expect(await popup.evaluate(() => window.opener)).toBeNull()
  await popup.close()
})
