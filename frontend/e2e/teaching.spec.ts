import { test, expect } from '@playwright/test'

/** L4 教学逻辑：猜想门控、验证徽章、追问建议、题库相似题 */
test.describe('教学逻辑升级', () => {
  test('ε-δ 步骤条需先提交猜想才揭示内容', async ({ page }) => {
    await page.goto('/mathinsight/limit')
    await expect(page.getByText('探索步骤')).toBeVisible()

    const stepper = page.locator('.guess-stepper').first()
    await expect(stepper).toBeVisible()
    // 第一步默认展开，但描述被隐藏，显示猜想输入框
    await expect(stepper.getByText('在你看来，"无限接近"和"等于"有什么不同？')).toBeVisible()
    await expect(stepper.getByText('lim(x→x₀) f(x) = L 表示', { exact: false })).toHaveCount(0)

    const input = stepper.getByRole('textbox').first()
    await input.fill('无限接近但不等于')
    await stepper.getByRole('button', { name: '揭示' }).click()
    await expect(stepper.getByText('lim(x→x₀) f(x) = L 表示', { exact: false })).toBeVisible()
    await expect(stepper.getByText('你的猜想')).toBeVisible()
  })

  test('导数页步骤条同样有猜想门控', async ({ page }) => {
    await page.goto('/mathinsight/derivative')
    const stepper = page.locator('.guess-stepper').first()
    await expect(stepper).toBeVisible()
    await expect(stepper.getByText('如果两点离得越来越近，这条割线会越来越像什么？')).toBeVisible()
    await stepper.getByRole('textbox').first().fill('切线')
    await stepper.getByRole('button', { name: '揭示' }).click()
    await expect(stepper.getByText('在 (x₀, f(x₀)) 附近取一点', { exact: false })).toBeVisible()
  })
})
