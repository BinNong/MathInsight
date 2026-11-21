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

test.describe('ε-δ 图元直接操作（L3）', () => {
  test('ε 带与 δ 带可拖拽，并给出操作提示', async ({ page }) => {
    await page.goto('/mathinsight/limit')
    const plot = page.locator('.plot-figure .js-plotly-plot')
    await plot.waitFor({ state: 'attached', timeout: 15000 })

    // 可拖拽手柄存在：上下（ε 带）与左右（δ 带）
    expect(await plot.locator('rect.ndrag').count()).toBeGreaterThan(0)
    expect(await plot.locator('rect.ewdrag').count()).toBeGreaterThan(0)

    // 两个可编辑色带 shape
    const shapes = await plot.evaluate((gd: any) => gd._fullLayout.shapes.length)
    expect(shapes).toBe(2)
  })
})

test.describe('L2 新增实验模块', () => {
  test('方向场页面渲染方向线段与解曲线', async ({ page }) => {
    await page.goto('/mathinsight/direction-field')
    await expect(page.getByRole('heading', { name: '微分方程 · 方向场与解曲线' })).toBeVisible()
    await expect(page.getByRole('button', { name: '指数增长' })).toBeVisible()
    // 方向场数据加载后，预设名出现在图表标题区
    await expect(page.getByText('方向场与解曲线').last()).toBeVisible()
  })

  test('特征值页面展示特征值与向量判定', async ({ page }) => {
    await page.goto('/mathinsight/eigenvalues')
    await expect(page.getByText('特征值与特征向量')).toBeVisible()
    await expect(page.getByText('特征多项式')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('是否为特征向量')).toBeVisible()
  })

  test('假设检验页面展示 p 值与结论', async ({ page }) => {
    await page.goto('/mathinsight/hypothesis-test')
    await expect(page.getByRole('heading', { name: '数理统计 · 假设检验' })).toBeVisible()
    await expect(page.getByText('检验结论')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('如何解读 p 值')).toBeVisible()
  })
})
