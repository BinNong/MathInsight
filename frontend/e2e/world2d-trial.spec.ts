import { test, expect } from '@playwright/test'
import './world2dTypes'

test.describe('2D 秘境试炼', () => {
  test('开始、清场答题、离开与死亡复活均不崩溃', async ({ page }) => {
    test.setTimeout(60000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/mathinsight/world-2d')
    await page.locator('.world-intro-btn').click()
    await expect(page.locator('.world-objective')).toBeVisible()
    await page.waitForFunction(() => window.__world2d, undefined, { timeout: 15000 })

    await page.evaluate(() => window.__world2d.enterDungeon())
    await expect.poll(() => page.evaluate(() => window.__world2d.scene())).toBe('dungeon')
    await page.evaluate(() => window.__world2d.startTrial())
    await expect
      .poll(() => page.evaluate(() => window.__world2d.trial().wave), { timeout: 10000 })
      .toBe(1)
    await expect.poll(() => page.evaluate(() => window.__world2d.mobPositions().length)).toBeGreaterThan(0)

    await page.evaluate(() => window.__world2d.clearWave())
    await expect(page.locator('.world2d-quiz')).toBeVisible()
    await expect(page.locator('.world2d-quiz-badge')).toContainText('波间顿悟')
    await page.locator('.world2d-quiz-opt').first().click()
    await expect(page.locator('.world2d-quiz')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => window.__world2d.trial().best)).toBe(1)

    await page.evaluate(() => window.__world2d.leaveDungeon())
    await expect.poll(() => page.evaluate(() => window.__world2d.scene())).toBe('outdoor')
    expect(await page.evaluate(() => window.__world2d.trial().active)).toBe(false)

    await page.evaluate(() => window.__world2d.enterDungeon())
    await page.evaluate(() => window.__world2d.startTrial())
    await page.evaluate(() => window.__world2d.killPlayer())
    await expect.poll(() => page.evaluate(() => window.__world2d.trial().active)).toBe(false)
    await expect(page.locator('.world2d-vitals')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.world-objective')).toContainText('本次试炼已结束')
    expect(errors).toEqual([])
  })
})
