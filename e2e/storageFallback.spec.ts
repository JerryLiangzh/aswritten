import { expect, test } from '@playwright/test'

test('无 Web Locks 时仍自动保存并保留冲突检查', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined })
  })
  await page.goto('/')
  const source = page.locator('#editor textarea')
  const value = '# 无锁降级保存'
  await source.fill(value)
  await expect(page.locator('#document-status')).toHaveText('已保存')
  expect(await page.evaluate(() => localStorage.getItem('aswritten:document:v1'))).toBe(value)
})
