import { expect, test } from '@playwright/test'

test('未保存修改离页时提示且不直接写入缓存', async ({ page }) => {
  await page.goto('/')
  const result = await page.locator('#editor textarea').evaluate((source: HTMLTextAreaElement) => {
    source.value = '尚未保存'
    source.dispatchEvent(new Event('input', { bubbles: true }))
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return {
      prevented: event.defaultPrevented,
      stored: localStorage.getItem('aswritten:document:v1'),
      status: document.getElementById('document-status')?.textContent,
    }
  })
  expect(result).toEqual({
    prevented: true,
    stored: null,
    status: '有尚未保存的修改',
  })
})
