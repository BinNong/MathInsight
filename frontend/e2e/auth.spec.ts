import { test, expect } from '@playwright/test'

/**
 * 认证链路冒烟测试。
 * 全局已注入登录态（e2e/global-setup.ts），未登录场景需显式清空。
 */
test.describe('未登录访问', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('访问首页自动跳转登录页', async ({ page }) => {
    await page.goto('/mathinsight/')
    await expect(page).toHaveURL(/\/mathinsight\/login/)
    await expect(page.getByText('欢迎回来')).toBeVisible()
  })

  test('访问管理后台自动跳转登录页', async ({ page }) => {
    await page.goto('/mathinsight/admin')
    await expect(page).toHaveURL(/\/mathinsight\/login/)
  })

  test('错误密码被拒绝', async ({ page }) => {
    await page.goto('/mathinsight/login')
    await page.getByPlaceholder('3-32 位字母、数字或中文').fill('demo_user')
    await page.getByPlaceholder('输入你的密码').fill('wrongpassword123')
    await page.getByRole('button', { name: '进入学习工作台 →' }).click()
    await expect(page.getByText('用户名或密码错误')).toBeVisible()
    await expect(page).toHaveURL(/\/mathinsight\/login/)
  })
})

test.describe('已登录', () => {
  test('登录态可访问首页并显示用户徽标', async ({ page }) => {
    await page.goto('/mathinsight/')
    await expect(page).not.toHaveURL(/\/mathinsight\/login/)
    await expect(page.locator('.user-badge')).toBeVisible()
    await expect(page.locator('.user-badge-name')).toContainText(/\S+/)
  })

  test('管理员可见「管理」入口并进入后台', async ({ page }) => {
    await page.goto('/mathinsight/')
    const adminLink = page.locator('a[href="/mathinsight/admin"]')
    await expect(adminLink).toBeVisible()
    await adminLink.click()
    await expect(page).toHaveURL(/\/mathinsight\/admin$/)
    await expect(page.getByText('用户总数')).toBeVisible()
    await expect(page.getByRole('tab', { name: '用户管理' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '邀请码' })).toBeVisible()
  })

  test('修改密码弹窗需验证当前密码', async ({ page }) => {
    await page.goto('/mathinsight/')
    await page.getByRole('button', { name: '改密' }).click()
    await expect(page.getByRole('dialog', { name: '修改密码' })).toBeVisible()
    await expect(page.getByText('当前密码')).toBeVisible()
    await expect(page.getByText('新密码（至少 8 位）')).toBeVisible()
    await expect(page.getByText('确认新密码')).toBeVisible()
  })

  test('退出后跳转登录页', async ({ page }) => {
    await page.goto('/mathinsight/')
    await page.getByRole('button', { name: '退出' }).click()
    await expect(page).toHaveURL(/\/mathinsight\/login/)
  })
})
