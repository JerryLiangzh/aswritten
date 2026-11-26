import { expect, test } from '@playwright/test'

test('无 Web Locks 时停止自动保存且不写入缓存', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined })
  })
  await page.goto('/')
  const source = page.locator('#editor textarea')
  await source.fill('# 无锁时禁止自动保存')
  await expect(page.locator('#document-status')).toHaveText('本地保存失败，请导出 Markdown 备份')
  expect(await page.evaluate(() => localStorage.getItem('aswritten:document:v1'))).toBeNull()
})
