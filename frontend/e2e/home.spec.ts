import { test, expect } from '@playwright/test'

test.describe('首页', () => {
  test('显示标题和学科入口', async ({ page }) => {
    await page.goto('/mathinsight/')

    await expect(page.locator('.home-title')).toContainText('MathInsight')
    await expect(page.locator('.home-subtitle')).toContainText('高等数学智能教学助手')
  })

  test('点击微积分卡片进入学科页', async ({ page }) => {
    await page.goto('/mathinsight/')

    const calculusCard = page.locator('.subject-card').first()
    await expect(calculusCard).toContainText('微积分')
    await calculusCard.click()

    await expect(page).toHaveURL(/\/subject\/calculus$/)
    await expect(page.locator('.subject-page-title, h1')).toContainText('微积分')
  })

  test('导航到 Manim 动画生成器', async ({ page }) => {
    await page.goto('/mathinsight/')

    const manimLink = page.locator('a[href="/mathinsight/manim"]')
    await expect(manimLink).toContainText('Manim')
    await manimLink.click()

    await expect(page).toHaveURL(/\/manim$/)
  })
})
