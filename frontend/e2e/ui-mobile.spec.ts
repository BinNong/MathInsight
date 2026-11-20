import { test, expect } from '@playwright/test'
import './world2dTypes'

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  reducedMotion: 'reduce',
})

test.describe('移动端与减少动态效果', () => {
  test('首页无横向溢出且搜索可用', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/mathinsight/')
    await expect(page.getByLabel('搜索学习模块')).toBeVisible()
    const widths = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }))
    expect(widths.document).toBeLessThanOrEqual(widths.viewport)
    await expect(page.locator('.ambient-symbol').first()).toHaveCSS('display', 'none')
    await page.getByLabel('搜索学习模块').fill('概率')
    await expect(page.locator('[data-module-id="probability"]')).toBeVisible()
  })

  test('浮动图表限制在视口内且可关闭', async ({ page }) => {
    await page.goto('/mathinsight/limit')
    await page.getByTitle('弹出为浮动窗口').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(390)
    expect(box!.y + box!.height).toBeLessThanOrEqual(844)
    await page.getByRole('button', { name: '关闭浮动图表并嵌入页面' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.locator('.workspace-visualization-body')).toBeVisible()
  })

  test('2D 小镇提供触控方向与可点击技能', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/mathinsight/world-2d')
    await page.locator('.world-intro-btn').click()
    await expect(page.getByRole('button', { name: '向上移动' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'E 交互' })).toBeVisible()
    await page.waitForFunction(() => window.__world2d?.fillMp, undefined, { timeout: 15000 })

    await page.evaluate(() => window.__world2d.fillMp())
    await page.getByRole('button', { name: '级数风暴，快捷键 U' }).click()
    await expect(page.locator('.world2d-quiz')).toBeVisible()
    expect(errors).toEqual([])
  })
})
