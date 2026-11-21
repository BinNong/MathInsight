import { test, expect } from '@playwright/test'

/**
 * L5 接线冒烟：题库 → 掌握度 → 首页诊断 / 知识图谱着色。
 * 全局已注入登录态；每项测试使用独立浏览器上下文，掌握度从空开始。
 */
test.describe('题库练习与学生模型', () => {
  test.beforeEach(async ({ page }) => {
    // 隔离云端同步：这些测试断言绝对计数，需阻止登录后拉取历史掌握度
    await page.route('**/api/auth/progress', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null }) })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) })
      }
    })
    // 清空 2D 小镇掌握度，保证每项测试从零开始
    await page.goto('/mathinsight/')
    await page.evaluate(() => localStorage.removeItem('mathinsight-calc-mastery'))
    await page.reload()
  })

  test('练习页按主题展示题目，答题后写入掌握度并显示解析', async ({ page }) => {
    await page.goto('/mathinsight/practice?topic=limit-calc')
    await expect(page.getByRole('heading', { name: '极限计算' })).toBeVisible()
    await expect(page.getByText('lim(x→0) sin x / x')).toBeVisible()

    // 第一题正确答案是「1」（第 2 个选项）；先故意选错
    await page.locator('.practice-option').nth(0).click()
    await expect(page.getByText('回答有误')).toBeVisible()
    await expect(page.locator('.practice-feedback p')).not.toBeEmpty()

    const mastery = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('mathinsight-calc-mastery') || '{}')
    )
    expect(mastery.state?.topics?.['limit-calc']?.answered).toBe(1)
    expect(mastery.state?.topics?.['limit-calc']?.wrong).toContain('lc-1')
  })

  test('答对后该题从错题库移除', async ({ page }) => {
    await page.goto('/mathinsight/practice?topic=limit-calc')
    // 先答错 lc-1
    await page.locator('.practice-option').nth(0).click()
    await expect(page.getByText('回答有误')).toBeVisible()
    // 在题目列表里跳回 lc-1，答对（正确答案是第 2 个选项）
    await page.locator('.practice-q-link').filter({ hasText: 'lc-1' }).click()
    await page.locator('.practice-option').nth(1).click()
    await expect(page.getByText('回答正确')).toBeVisible()

    const mastery = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('mathinsight-calc-mastery') || '{}')
    )
    expect(mastery.state?.topics?.['limit-calc']?.correct).toBe(1)
    expect(mastery.state?.topics?.['limit-calc']?.wrong).not.toContain('lc-1')
  })

  test('掌握度数据驱动首页薄弱知识点诊断', async ({ page }) => {
    await page.goto('/mathinsight/practice?topic=limit-calc')
    // 连续答 3 题，全部答错，制造薄弱点
    for (let i = 0; i < 3; i += 1) {
      await page.locator('.practice-option').nth(0).click()
      const next = page.getByRole('button', { name: '下一题' })
      if (await next.isVisible()) await next.click()
    }

    await page.goto('/mathinsight/')
    const diagnostic = page.locator('.diagnostic-section')
    await expect(diagnostic).toBeVisible()
    await expect(diagnostic.getByText('极限计算')).toBeVisible()
    await expect(diagnostic.getByRole('link', { name: '题库练习' })).toBeVisible()
  })

  test('知识图谱支持按掌握度着色，概念详情含题库练习入口', async ({ page }) => {
    await page.goto('/mathinsight/practice?topic=limit-calc')
    await page.locator('.practice-option').nth(0).click()
    await expect(page.getByText('回答有误')).toBeVisible()

    await page.goto('/mathinsight/knowledge-map')
    const toggle = page.getByLabel('按掌握度着色')
    await expect(toggle).toBeVisible()
    await toggle.check()
    await expect(toggle).toBeChecked()
    await expect(page.getByText('初窥')).toBeVisible()
  })
})
