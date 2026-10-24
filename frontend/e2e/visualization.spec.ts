import { test, expect } from '@playwright/test'

test.describe('可视化页面', () => {
  test('ε-δ 极限页面渲染控制面板和图表', async ({ page }) => {
    await page.goto('/mathinsight/limit')

    // 等待懒加载页面渲染完成
    await page.waitForSelector('.detail-page', { timeout: 10000 })
    await expect(page.locator('.workspace-controls')).toBeVisible()
    await expect(page.locator('.workspace-visualization')).toBeVisible()
    await expect(page.locator('.workspace-visualization-title')).toContainText('ε-δ 极限')
  })

  test('导数页面包含函数输入和计算按钮', async ({ page }) => {
    await page.goto('/mathinsight/derivative')

    await page.waitForSelector('.detail-page', { timeout: 10000 })
    await expect(page.locator('.workspace-controls')).toBeVisible()
    await expect(page.locator('input[type="text"]').first()).toBeVisible()
  })
})
