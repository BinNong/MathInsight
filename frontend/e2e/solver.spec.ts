import { test, expect } from '@playwright/test'

const MOCK_SOLVER_RESULT = {
  success: true,
  data: {
    topic: 'derivative',
    difficulty: 3,
    restatement: '求函数 f(x)=x^2 在 x=2 处的导数',
    prerequisites: ['导数定义'],
    steps: [
      {
        index: 1,
        title: '写出导数定义',
        explanation: '根据导数定义，函数在某点的导数是函数增量与自变量增量比值的极限。',
        formula: "f'(x_0)=\\lim_{h\\to 0}\\frac{f(x_0+h)-f(x_0)}{h}",
        insight: '导数的几何意义是切线斜率。',
        common_pitfall: '注意 h 趋近于 0 而不是等于 0。',
      },
      {
        index: 2,
        title: '代入函数并化简',
        explanation: '将 f(x)=x^2 代入导数定义并化简。',
        formula: "f'(2)=\\lim_{h\\to 0}\\frac{(2+h)^2-2^2}{h}=\\lim_{h\\to 0}(4+h)=4",
        insight: '通过代数化简消去分母中的 h。',
      },
    ],
    final_answer: '4',
    follow_up_questions: ['如何求高阶导数？'],
    visualization_suggestions: [
      {
        title: '切线动画',
        description: 'Show the tangent line of y=x^2 at x=2',
      },
    ],
  },
}

test.describe('数学解题助手', () => {
  test('页面加载并显示输入区', async ({ page }) => {
    await page.goto('/mathinsight/solver')

    await expect(page.locator('h1')).toContainText('数学解题助手', { timeout: 15000 })
    await expect(page.locator('textarea')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('button:has-text("开始分析")')).toBeVisible({ timeout: 15000 })
  })

  test('从首页导航到解题助手', async ({ page }) => {
    await page.goto('/mathinsight/')

    const solverLink = page.locator('a[href="/mathinsight/solver"]')
    await expect(solverLink).toContainText('解题助手')
    await solverLink.click()

    await expect(page).toHaveURL(/\/solver$/)
  })

  test('输入题目并展示结构化解答', async ({ page }) => {
    await page.goto('/mathinsight/solver')

    await page.route('/mathinsight/api/solver/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SOLVER_RESULT),
      })
    })

    await page.locator('textarea').fill('求 f(x)=x^2 在 x=2 处的导数')
    await page.locator('button:has-text("开始分析")').click()

    await expect(page.locator('.solver-topic-badge')).toContainText('导数')
    await expect(page.locator('.solver-step-card')).toHaveCount(2)
    await expect(page.locator('.solver-step-title').first()).toContainText('写出导数定义')
  })

  test('解析结果过长时可垂直滚动', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto('/mathinsight/solver')

    const longResult = {
      ...MOCK_SOLVER_RESULT,
      data: {
        ...MOCK_SOLVER_RESULT.data,
        steps: [
          {
            index: 1,
            title: '展开的第一步：确保内容超出可视区域',
            explanation: '这是一个非常长的解释文本，用于确保结果区域能够超出可视区域并出现滚动条。'.repeat(20),
            formula: 'f(x) = x^2',
            insight: '注意极限的定义与代数化简过程。',
          },
          ...Array.from({ length: 8 }).map((_, i) => ({
            index: i + 2,
            title: `折叠步骤 ${i + 2}`,
            explanation: '简短说明。',
            formula: 'f(x) = x^2',
            insight: '提示。',
          })),
        ],
      },
    }

    await page.route('/mathinsight/api/solver/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(longResult),
      })
    })

    await page.locator('textarea').fill('一道步骤非常多的求导题')
    await page.locator('button:has-text("开始分析")').click()

    const resultArea = page.locator('.solver-result')
    await expect(resultArea).toBeVisible()

    const dimensions = await page.evaluate(() => {
      const result = document.querySelector('.solver-result') as HTMLElement
      const body = result?.parentElement
      const viz = body?.parentElement
      const workspace = viz?.parentElement
      return {
        result: {
          scrollHeight: result?.scrollHeight,
          clientHeight: result?.clientHeight,
          offsetHeight: result?.offsetHeight,
          overflowY: result ? window.getComputedStyle(result).overflowY : null,
        },
        body: {
          clientHeight: body?.clientHeight,
          offsetHeight: body?.offsetHeight,
          overflowY: body ? window.getComputedStyle(body).overflowY : null,
        },
        viz: {
          clientHeight: viz?.clientHeight,
          offsetHeight: viz?.offsetHeight,
          height: viz ? window.getComputedStyle(viz).height : null,
          minHeight: viz ? window.getComputedStyle(viz).minHeight : null,
          alignSelf: viz ? window.getComputedStyle(viz).alignSelf : null,
        },
        workspace: {
          clientHeight: workspace?.clientHeight,
          height: workspace ? window.getComputedStyle(workspace).height : null,
          alignItems: workspace ? window.getComputedStyle(workspace).alignItems : null,
        },
      }
    })
    console.log('dimensions:', JSON.stringify(dimensions, null, 2))

    const canScroll = dimensions.result.scrollHeight > dimensions.result.clientHeight
    expect(canScroll).toBe(true)

    expect(dimensions.result.overflowY).toBe('auto')

    await resultArea.evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }))
    const scrollTop = await resultArea.evaluate((el) => el.scrollTop)
    expect(scrollTop).toBeGreaterThan(0)
  })
})
