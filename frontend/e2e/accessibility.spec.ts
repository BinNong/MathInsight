import { test, expect } from '@playwright/test'

test.describe('可访问交互', () => {
  test('Tabs 支持方向键，折叠内容退出可见与焦点树', async ({ page }) => {
    await page.goto('/mathinsight/probability')
    const tablist = page.getByRole('tablist').first()
    await expect(tablist).toBeVisible()
    const selected = tablist.getByRole('tab', { selected: true })
    await selected.focus()
    await page.keyboard.press('ArrowRight')
    await expect(tablist.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true')

    const toggle = page.locator('.collapsible-header').first()
    await toggle.click()
    const contentId = await toggle.getAttribute('aria-controls')
    expect(contentId).toBeTruthy()
    await expect(page.locator(`[id="${contentId}"]`)).toBeHidden()
    await toggle.click()
    await expect(page.locator(`[id="${contentId}"]`)).toBeVisible()
  })

  test('范围输入支持提交、非法提示与 Escape 还原', async ({ page }) => {
    await page.goto('/mathinsight/derivative')
    const input = page.getByLabel('绘图范围')
    await input.fill('[1, 4]')
    await input.press('Enter')
    await expect(input).toHaveValue('[1, 4]')

    await input.fill('[4, 1]')
    await input.press('Enter')
    await expect(page.locator('.range-input-error')).toContainText('左端小于右端')
    await input.press('Escape')
    await expect(input).toHaveValue('[1, 4]')
    await expect(page.locator('.range-input-error')).toHaveCount(0)
  })
})
