import { chromium, type FullConfig } from '@playwright/test'

/**
 * E2E 全局登录态准备。
 *
 * 站点启用全站鉴权后，所有页面都必须登录才能访问。这里用真实 UI 登录一次，
 * 将 cookie + localStorage 保存为 storageState，供所有 spec 复用。
 *
 * 测试账号可通过环境变量覆盖；默认指向本地开发库的 demo_user。
 * 前提：本地后端已启动且该账号存在（见 README「账号与首个管理员」）。
 */
async function globalSetup(config: FullConfig) {
  const project = config.projects[0]
  const baseURL = (project.use?.baseURL as string) || 'http://localhost:5173'
  const username = process.env.E2E_USERNAME || 'demo_user'
  const password = process.env.E2E_PASSWORD || 'Testpass123'

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.goto(`${baseURL}/mathinsight/login`)
    await page.getByPlaceholder('3-32 位字母、数字或中文').fill(username)
    await page.getByPlaceholder('输入你的密码').fill(password)
    await page.getByRole('button', { name: '进入学习工作台 →' }).click()
    await page.waitForURL(/\/mathinsight\/?(\?.*)?$/, { timeout: 15000 })

    // 确认真的登录成功，而不是停留在登录页
    if (page.url().includes('/login')) {
      throw new Error(`E2E 登录失败：请确认测试账号 ${username} 存在且密码正确`)
    }

    await context.storageState({ path: 'e2e/.auth-state.json' })
    console.log(`E2E 登录态已保存（账号：${username}）`)
  } finally {
    await browser.close()
  }
}

export default globalSetup
