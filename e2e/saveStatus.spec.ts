import { expect, test } from '@playwright/test'

test('保存期间继续编辑不会显示导入已全部保存', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    const status = document.getElementById('document-status')!
    const messages = [status.textContent ?? '']
    new MutationObserver(() => messages.push(status.textContent ?? '')).observe(
      status,
      { childList: true, subtree: true, characterData: true },
    )
    Object.assign(window, { __statusMessages: messages })
    await new Promise<void>(resolve => {
      void navigator.locks.request('aswritten:document:v1:write', async () => {
        resolve()
        await new Promise(release => setTimeout(release, 700))
      })
    })
  })

  page.once('dialog', dialog => dialog.accept())
  await page.locator('#markdown-import-input').setInputFiles({
    name: 'racing.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# 导入快照'),
  })
  const source = page.locator('#editor textarea')
  await expect(source).toHaveValue('# 导入快照')
  await source.fill('# 导入后继续编辑')
  await expect(page.locator('#document-status')).toHaveText('已保存')

  const messages = await page.evaluate(() => (
    window as unknown as { __statusMessages: string[] }
  ).__statusMessages)
  expect(messages).toContain('有尚未保存的修改')
  expect(messages).not.toContain('已导入并保存 racing.md')
})
