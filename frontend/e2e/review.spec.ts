import { test, expect } from '@playwright/test'

/**
 * 跨学科题库 + 错题复习闭环冒烟。
 */
test.describe('题库扩充与间隔复习', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/progress', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null }) })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) })
      }
    })
    await page.goto('/mathinsight/')
    await page.evaluate(() => {
      localStorage.removeItem('mathinsight-calc-mastery')
      localStorage.removeItem('mathinsight-review')
    })
    await page.reload()
  })

  test('线代与概率主题可选且有题', async ({ page }) => {
    await page.goto('/mathinsight/practice')
    await expect(page.getByText('113 道结构化题目')).toBeVisible()
    await expect(page.getByRole('tab', { name: /矩阵与行列式/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /假设检验/ })).toBeVisible()

    await page.getByRole('tab', { name: /特征值/ }).click()
    await expect(page.locator('.practice-q-text')).toContainText('Av = 2v')
    const count = await page.locator('.practice-q-link').count()
    expect(count).toBe(8)
  })

  test('未作答的新题不会进入复习队列', async ({ page }) => {
    await page.goto('/mathinsight/practice?mode=review')
    await expect(page.getByText('太棒了，当前没有需要复习的题目！')).toBeVisible()
    await expect(page.locator('.practice-mode-badge')).toHaveCount(0)
  })

  test('答错后进入复习队列，答对后安排下次复习', async ({ page }) => {
    await page.goto('/mathinsight/practice?topic=limit-calc')
    // lc-2 正确答案是「1」(index 2)，先答错选 index 0
    await page.locator('.practice-q-link').filter({ hasText: 'lc-2' }).click()
    await page.locator('.practice-option').nth(0).click()
    await expect(page.getByText('回答有误')).toBeVisible()

    // 复习模式应包含这道错题
    await page.getByRole('tab', { name: /错题复习/ }).click()
    await expect(page.getByText(/以下是你的错题与到期复习题/)).toBeVisible()
    await expect(page.locator('.practice-q-link').filter({ hasText: 'lc-2' })).toBeVisible()

    // 在复习队列里定位 lc-2 并答对（lc-2 正确答案是 index 2）
    await page.locator('.practice-q-link').filter({ hasText: 'lc-2' }).click()
    await expect(page.locator('.practice-q-id')).toHaveText('lc-2')
    await page.locator('.practice-option').nth(2).click()
    await expect(page.getByText('回答正确')).toBeVisible()
    const review = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('mathinsight-review') || '{}')
    )
    expect(review.state?.entries?.['lc-2']?.correct).toBeGreaterThanOrEqual(1)
    await expect(page.locator('.practice-next-due')).toContainText('下次复习')
  })
})
