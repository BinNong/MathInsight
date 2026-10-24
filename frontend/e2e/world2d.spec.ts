import { test, expect } from '@playwright/test'

/** 2D 数学小镇冒烟测试：页面加载、开场屏、进入后画布渲染、按键移动、截图审阅 */
test.describe('2D World', () => {
  test.setTimeout(60000)

  test('loads intro, renders world, moves player', async ({ page }) => {
    const fatalErrors: string[] = []
    page.on('pageerror', (err) => fatalErrors.push(err.message))

    await page.goto('/mathinsight/world-2d')

    // 开场标题屏
    await expect(page.locator('.world-intro-title')).toHaveText('微积分大陆')

    // 进入世界
    await page.locator('.world-intro-btn').click()
    await expect(page.locator('.world-objective')).toBeVisible()

    // 等待 tilesheet 加载 + 渲染几帧
    await page.waitForTimeout(2500)
    await page.screenshot({ path: 'test-results/world2d-spawn.png' })

    // 向北走，应触发「知识星图」传送门提示或 NPC 提示
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(1500)
    await page.keyboard.up('KeyW')
    await page.screenshot({ path: 'test-results/world2d-walk.png' })

    // 向东走向数灵
    await page.keyboard.down('KeyD')
    await page.waitForTimeout(900)
    await page.keyboard.up('KeyD')
    await page.waitForTimeout(400)
    await page.screenshot({ path: 'test-results/world2d-npc.png' })

    // —— 战斗冒烟：传送到怪物旁，普攻 + 技能 + 技能栏 HUD ——
    const mob = (await page.evaluate(() => (window as any).__world2d.mobPositions()[0])) as { x: number; y: number }
    await page.evaluate(([x, y]) => (window as any).__world2d.teleport(x + 1.5, y), [mob.x, mob.y])
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/world2d-mob.png' })
    await page.keyboard.press('KeyJ')
    await page.waitForTimeout(450)
    await page.screenshot({ path: 'test-results/world2d-slash.png' })
    await page.keyboard.press('KeyK') // 积分冲击波
    await page.waitForTimeout(450)
    await page.keyboard.press('KeyL') // 矩阵牢笼
    await page.waitForTimeout(600)
    await page.screenshot({ path: 'test-results/world2d-skills.png' })
    await expect(page.locator('.world2d-skills')).toBeVisible()
    await expect(page.locator('.world2d-vitals')).toBeVisible()

    // —— 大招答题：拉满灵感 → U → 答题 → 级数风暴 ——
    await page.evaluate(() => (window as any).__world2d.fillMp())
    await page.keyboard.press('KeyU')
    await expect(page.locator('.world2d-quiz')).toBeVisible()
    await page.screenshot({ path: 'test-results/world2d-quiz.png' })
    await page.locator('.world2d-quiz-opt').first().click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/world2d-storm.png' })

    expect(fatalErrors).toEqual([])
  })

  test('enters training hall, completes session, opens codex', async ({ page }) => {
    const fatalErrors: string[] = []
    page.on('pageerror', (err) => fatalErrors.push(err.message))

    await page.goto('/mathinsight/world-2d')
    await page.locator('.world-intro-btn').click()
    await page.waitForTimeout(2200)

    // —— 进入极限酒馆（门口按 E）——
    await page.evaluate(() => (window as any).__world2d.teleport(8.5, 23.6))
    await page.waitForTimeout(300)
    await expect(page.locator('.world-prompt')).toContainText('极限酒馆')
    await page.keyboard.press('KeyE')
    await page.waitForTimeout(600)
    expect(await page.evaluate(() => (window as any).__world2d.scene())).toBe('limit')
    await expect(page.locator('.world-objective')).toContainText('极限酒馆')
    await page.screenshot({ path: 'test-results/world2d-room-limit.png' })

    // —— 与洛必达对话 → 开始修炼 ——
    await page.evaluate(() => (window as any).__world2d.teleport(4.5, 6.2))
    await page.waitForTimeout(300)
    await page.keyboard.press('KeyE')
    await expect(page.locator('.world-dialog')).toBeVisible()
    // 打字机对话：反复点击「继续」直到出现「开始修炼」（每行需先补全再翻页）
    const trainBtn = page.locator('button:has-text("开始修炼")')
    for (let i = 0; i < 10; i++) {
      if (await trainBtn.isVisible()) break
      await page.locator('.world-dialog .world-btn.primary').click()
      await page.waitForTimeout(400)
    }
    await trainBtn.click()
    await expect(page.locator('.world2d-training')).toBeVisible()
    await page.screenshot({ path: 'test-results/world2d-training-menu.png' })

    // —— 选第一个知识点，连答 5 题（每题出解析）——
    await page.locator('.world2d-topic').first().click()
    await expect(page.locator('.world2d-quiz-options')).toBeVisible()
    for (let i = 0; i < 5; i++) {
      await page.locator('.world2d-quiz-opt').first().click()
      await expect(page.locator('.world2d-explain')).toBeVisible()
      if (i === 0) await page.screenshot({ path: 'test-results/world2d-training-explain.png' })
      await page.locator('.world2d-next').click()
    }
    await expect(page.locator('.world2d-result-score')).toBeVisible()
    await page.screenshot({ path: 'test-results/world2d-training-result.png' })

    // —— 错题重练：0/5 后选单出现重练入口，重练同样走完 5 题 ——
    await page.locator('button:has-text("再来一组")').click()
    const retryBtn = page.locator('.world2d-topic.retry')
    await expect(retryBtn).toBeVisible()
    await page.screenshot({ path: 'test-results/world2d-training-retry.png' })
    await retryBtn.click()
    for (let i = 0; i < 5; i++) {
      await page.locator('.world2d-quiz-opt').first().click()
      await expect(page.locator('.world2d-explain')).toBeVisible()
      await page.locator('.world2d-next').click()
    }
    await expect(page.locator('.world2d-result-score')).toBeVisible()
    await page.screenshot({ path: 'test-results/world2d-training-retry-result.png' })
    await page.locator('button:has-text("离开修炼馆")').click()
    await expect(page.locator('.world2d-training')).toHaveCount(0)

    // —— 掌握度已写入 localStorage ——
    const mastery = await page.evaluate(() => window.localStorage.getItem('mathinsight-calc-mastery'))
    expect(mastery).toBeTruthy()
    expect(mastery).toContain('answered')

    // —— 门口返回小镇 ——
    await page.evaluate(() => (window as any).__world2d.teleport(7.5, 9.4))
    await page.waitForTimeout(300)
    await page.keyboard.press('KeyE')
    await page.waitForTimeout(600)
    expect(await page.evaluate(() => (window as any).__world2d.scene())).toBe('outdoor')

    // —— Tab 打开修炼手札 ——
    await page.keyboard.press('Tab')
    await expect(page.locator('.world2d-codex')).toBeVisible()
    await page.screenshot({ path: 'test-results/world2d-codex.png' })
    await page.keyboard.press('Escape')
    await expect(page.locator('.world2d-codex')).toHaveCount(0)

    expect(fatalErrors).toEqual([])
  })

  test('applies persisted max HP/MP mastery bonuses', async ({ page }) => {
    // 预置持久化奖励：生命 +30、灵感 +20
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'mathinsight-calc-mastery',
        JSON.stringify({
          state: { topics: {}, sessions: 0, bestStreak: 0, maxMpBonus: 20, maxHpBonus: 30, mastered: [], adept: [] },
          version: 0,
        })
      )
    })
    await page.goto('/mathinsight/world-2d')
    await page.locator('.world-intro-btn').click()
    await page.waitForTimeout(2200)

    // 灵感条显示提升后的上限
    await expect(page.locator('.world2d-bar-num').nth(1)).toContainText('/120')
    // 生命从 100 缓慢回复到 130
    await expect(page.locator('.world2d-bar-num').first()).toHaveText('130/130', { timeout: 20000 })
    await page.screenshot({ path: 'test-results/world2d-bonus-bars.png' })
  })
})
