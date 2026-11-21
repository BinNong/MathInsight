import { test, expect } from '@playwright/test'

/**
 * 跨设备进度同步冒烟：
 * 两个独立浏览器上下文登录同一账号，A 答题后 B 能看到合并后的掌握度。
 */
const USER = process.env.E2E_USERNAME || 'demo_user'
const PASS = process.env.E2E_PASSWORD || 'Testpass123'

async function login(page: import('@playwright/test').Page, baseURL: string) {
  await page.goto(`${baseURL}/mathinsight/login`)
  await page.getByPlaceholder('3-32 位字母、数字或中文').fill(USER)
  await page.getByPlaceholder('输入你的密码').fill(PASS)
  await page.getByRole('button', { name: '进入学习工作台 →' }).click()
  await page.waitForURL(/\/mathinsight\/?(\?.*)?$/, { timeout: 15000 })
}

test.describe('学习进度云端同步', () => {
  test('掌握度变更上报后可在另一上下文合并看到', async ({ browser, baseURL }) => {
    const root = (baseURL || 'http://127.0.0.1:5173').replace(/\/$/, '')
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const a = await ctxA.newPage()
    const b = await ctxB.newPage()
    try {
      await login(a, root)
      await login(b, root)

      // A：先把本地掌握度清零，再答 2 道极限题（制造唯一状态）
      await a.goto(`${root}/mathinsight/practice?topic=limit-calc`)
      await a.evaluate(() => localStorage.removeItem('mathinsight-calc-mastery'))
      await a.reload()
      await a.getByText('lim(x→0) sin x / x').waitFor({ timeout: 15000 })
      for (let i = 0; i < 2; i++) {
        await a.locator('.practice-option').nth(0).click()
        const next = a.getByRole('button', { name: '下一题' })
        if (await next.isVisible()) await next.click()
      }
      const answeredA = await a.evaluate(() =>
        JSON.parse(localStorage.getItem('mathinsight-calc-mastery') || '{}').state?.topics?.['limit-calc']?.answered ?? 0
      )
      expect(answeredA).toBeGreaterThanOrEqual(1)

      // 等待防抖上报（1.2s）+ 网络
      await a.waitForTimeout(2200)

      // B：重新加载触发 pullAndMerge，然后读掌握度
      await b.goto(`${root}/mathinsight/`)
      await b.waitForTimeout(2000)
      const answeredB = await b.evaluate(() =>
        JSON.parse(localStorage.getItem('mathinsight-calc-mastery') || '{}').state?.topics?.['limit-calc']?.answered ?? 0
      )
      expect(answeredB).toBeGreaterThanOrEqual(1)
    } finally {
      await ctxA.close()
      await ctxB.close()
    }
  })

  test('未登录时访问进度接口返回 401', async ({ browser, baseURL }) => {
    const root = (baseURL || 'http://127.0.0.1:5173').replace(/\/$/, '')
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    try {
      const resp = await ctx.request.get(`${root}/mathinsight/api/auth/progress`)
      expect(resp.status()).toBe(401)
    } finally {
      await ctx.close()
    }
  })
})
