import { test, expect } from '@playwright/test'

test.describe('数说热点栏目', () => {
  test('列表页展示解读卡片并可按分支筛选', async ({ page }) => {
    await page.goto('/mathinsight/hotspots')
    await expect(page.getByRole('heading', { name: '新闻里藏着数学题' })).toBeVisible()
    // 内容每周会自动增长，不断言精确总数
    await expect(page.locator('.hotspot-card').first()).toBeVisible({ timeout: 15000 })
    const total = await page.locator('.hotspot-card').count()
    expect(total).toBeGreaterThanOrEqual(4)

    await page.getByRole('button', { name: '线性代数' }).click()
    await expect(page.locator('.hotspot-card').first()).toContainText('机器人')
    const laCount = await page.locator('.hotspot-card').count()
    expect(laCount).toBeLessThan(total)

    await page.getByRole('button', { name: '全部' }).click()
    await expect(page.locator('.hotspot-card')).toHaveCount(total)
  })

  test('搜索可定位到具体解读', async ({ page }) => {
    await page.goto('/mathinsight/hotspots')
    await page.getByRole('searchbox', { name: '搜索热点解读' }).fill('举重')
    await expect(page.locator('.hotspot-card')).toHaveCount(1)
    await expect(page.locator('.hotspot-card')).toContainText('举重')
  })

  test('详情页展示公式、推导、交互图与思考题', async ({ page }) => {
    await page.goto('/mathinsight/hotspots/hot-20261117-robot-sync')
    await expect(page.getByRole('heading', { name: /151 台机器人同时起舞/ })).toBeVisible()
    await expect(page.getByText('一步步看明白')).toBeVisible()
    await expect(page.locator('.hotspot-step')).toHaveCount(3)
    await expect(page.locator('.katex')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.js-plotly-plot')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: '看看参考答案' })).toBeVisible()
  })

  test('参考答案可展开，实验入口可点击', async ({ page }) => {
    await page.goto('/mathinsight/hotspots/hot-20261122-nba-empty-carriage')
    await page.getByRole('button', { name: '看看参考答案' }).click()
    await expect(page.getByRole('button', { name: '收起参考答案' })).toBeVisible()
    await expect(page.locator('.hotspot-answer')).toContainText('59%')
    await expect(page.getByRole('link', { name: /打开对应实验/ }).first()).toBeVisible()
  })

  test('有视频的解读显示播放器与字幕轨', async ({ page }) => {
    await page.goto('/mathinsight/hotspots/hot-20261117-robot-sync')
    await expect(page.getByRole('heading', { name: /看一段/ })).toBeVisible({ timeout: 15000 })
    const video = page.locator('.hotspot-video video')
    await expect(video).toBeVisible()
    await expect(page.locator('.hotspot-video source')).toHaveAttribute('src', /hot-robot-sync\.mp4/)
    await expect(page.locator('.hotspot-video track')).toHaveAttribute('src', /\.vtt/)
  })

  test('不存在的解读显示友好错误', async ({ page }) => {
    await page.goto('/mathinsight/hotspots/no-such-article')
    await expect(page.getByRole('alert')).toContainText('未找到')
  })

  test('首页有数说热点入口', async ({ page }) => {
    await page.goto('/mathinsight/')
    await expect(page.getByRole('link', { name: /数说热点/ }).first()).toBeVisible()
  })
})
