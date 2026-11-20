import { test, expect } from '@playwright/test'

test.describe('学习工作台', () => {
  test('搜索、收藏、最近学习与清除记录形成闭环', async ({ page }) => {
    await page.goto('/mathinsight/')

    await page.getByLabel('搜索学习模块').fill('矩阵')
    await expect(page.locator('[data-module-id="matrix"]')).toBeVisible()
    await expect(page.locator('[data-module-id="limit"]')).toHaveCount(0)

    await page.getByRole('button', { name: '收藏：矩阵变换', exact: true }).click()
    await expect(page.getByRole('button', { name: '取消收藏：矩阵变换' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await page.getByRole('button', { name: /只看收藏/ }).click()
    await expect(page.locator('[data-module-id="matrix"]')).toBeVisible()

    await page.locator('[data-module-id="matrix"] .learning-module-link').click()
    await expect(page).toHaveURL(/\/matrix$/)
    await expect(page).toHaveTitle(/矩阵变换/)

    await page.goto('/mathinsight/')
    await expect(page.locator('.continue-primary')).toContainText('矩阵变换')
    await expect(page.locator('.recent-panel')).toContainText('矩阵变换')
    await page.getByRole('button', { name: '清除学习记录' }).click()
    await expect(page.locator('.continue-empty')).toBeVisible()
    await expect(page.locator('.favorite-filter-count')).toHaveText('0')
  })

  test('学科卡支持键盘进入，未知路由和学科有反馈', async ({ page }) => {
    await page.goto('/mathinsight/')
    await page.locator('.subject-card').first().focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/subject\/calculus$/)
    await expect(page.getByRole('heading', { name: '微积分', exact: true })).toBeVisible()

    await page.goto('/mathinsight/not-a-real-route')
    await expect(page.getByRole('heading', { name: '这条学习路径不存在' })).toBeVisible()
    await expect(page).toHaveTitle(/页面未找到/)

    await page.goto('/mathinsight/subject/not-a-subject')
    await expect(page.getByRole('heading', { name: '没有找到这个学科' })).toBeVisible()
    await page.getByRole('link', { name: '返回学习工作台' }).click()
    await expect(page).toHaveURL(/\/mathinsight\/?$/)
  })
})
