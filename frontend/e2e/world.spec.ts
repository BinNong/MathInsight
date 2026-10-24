import { test, expect } from '@playwright/test'

/** 3D 数学世界冒烟测试：页面加载、开场屏、进入世界后场景渲染且无致命错误 */
test.describe('3D World', () => {
  // 阴影 + 后处理在软件渲染（SwiftShader）下帧率低，加载慢，放宽超时
  test.setTimeout(90000)

  test('loads intro and renders scene without fatal errors', async ({ page }) => {
    const fatalErrors: string[] = []
    page.on('pageerror', (err) => fatalErrors.push(err.message))

    await page.goto('/mathinsight/world')

    // 开场标题屏
    await expect(page.locator('.world-intro-title')).toHaveText('数学宇宙群岛')

    // 进入世界
    await page.locator('.world-intro-btn').click()

    // Canvas 存在且 HUD 出现
    await expect(page.locator('.world-root canvas')).toBeVisible()
    await expect(page.locator('.world-objective')).toBeVisible()

    // 等待场景资源渲染
    await page.waitForTimeout(6000)
    await page.screenshot({ path: 'test-results/world-spawn.png' })

    expect(fatalErrors).toEqual([])
  })
})
