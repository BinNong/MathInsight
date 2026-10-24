import { test, expect } from '@playwright/test'

const MOCK_GRAPH = {
  success: true,
  data: {
    subjects: {
      calculus: { name: '微积分', color: '#059669' },
    },
    nodes: [
      {
        id: 'limit-function',
        name: '函数极限',
        subject: 'calculus',
        group: '极限与连续',
        description: '函数在一点或无穷远处的极限。',
        difficulty: 2,
        tags: ['极限', '函数'],
        route: '/limit',
        formula: String.raw`\lim_{x\to x_0} f(x) = A`,
      },
      {
        id: 'derivative-definition',
        name: '导数定义',
        subject: 'calculus',
        group: '微分学',
        description: '导数作为函数变化率与切线斜率。',
        difficulty: 2,
        tags: ['导数', '切线'],
        route: '/derivative',
      },
    ],
    edges: [
      {
        source: 'limit-function',
        target: 'derivative-definition',
        reason: '导数本质是一种特殊极限',
        strength: 3,
      },
    ],
    meta: { concept_count: 2, edge_count: 1 },
  },
}

const MOCK_CONCEPT = {
  success: true,
  data: {
    id: 'derivative-definition',
    name: '导数定义',
    subject: 'calculus',
    group: '微分学',
    description: '导数作为函数变化率与切线斜率。',
    difficulty: 2,
    tags: ['导数', '切线'],
    route: '/derivative',
    formula: String.raw`f'(x_0)=\lim_{h\to 0}\frac{f(x_0+h)-f(x_0)}{h}`,
    prerequisites: [
      {
        id: 'limit-function',
        name: '函数极限',
        subject: 'calculus',
        reason: '导数本质是一种特殊极限',
      },
    ],
    next_concepts: [],
    visualizations: [{ label: '导数与切线', path: '/derivative' }],
  },
}

const MOCK_PATH = {
  success: true,
  data: {
    goal_id: 'derivative-definition',
    goal_name: '导数定义',
    path: [
      { id: 'limit-function', name: '函数极限', subject: 'calculus' },
      { id: 'derivative-definition', name: '导数定义', subject: 'calculus' },
    ],
  },
}

test.describe('知识学习地图', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/mathinsight/api/knowledge-graph', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_GRAPH),
      })
    })
    await page.route('/mathinsight/api/knowledge-graph/concepts/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CONCEPT),
      })
    })
    await page.route('/mathinsight/api/knowledge-graph/path**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PATH),
      })
    })
  })

  test('页面加载并显示标题与图例', async ({ page }) => {
    await page.goto('/mathinsight/knowledge-map')

    await expect(page.locator('h1')).toContainText('高等数学知识图谱', { timeout: 15000 })
    await expect(page.locator('.knowledge-map-legend')).toContainText('微积分')
    await expect(page.locator('.filter-chip')).toHaveCount(5)
  })

  test('从首页导航到知识地图', async ({ page }) => {
    await page.goto('/mathinsight/')

    const mapLink = page.locator('a[href="/mathinsight/knowledge-map"]')
    await expect(mapLink).toContainText('知识学习地图')
    await mapLink.click()

    await expect(page).toHaveURL(/\/knowledge-map$/)
    await expect(page.locator('h1')).toContainText('高等数学知识图谱')
  })

  test('搜索并选中概念', async ({ page }) => {
    await page.goto('/mathinsight/knowledge-map')

    const searchInput = page.locator('.search-box input')
    await searchInput.fill('导数')

    const suggestion = page.locator('.search-suggestions li').first()
    await expect(suggestion).toContainText('导数定义')
    await suggestion.click()

    const sidebar = page.locator('.knowledge-map-sidebar')
    await expect(sidebar).toHaveClass(/open/)
    await expect(page.locator('.sidebar-content h2')).toContainText('导数定义')
    await expect(page.locator('.viz-link')).toContainText('导数与切线')
  })

  test('查看学习路径', async ({ page }) => {
    await page.goto('/mathinsight/knowledge-map')

    await page.locator('.search-box input').fill('导数')
    await page.locator('.search-suggestions li').first().click()

    await page.locator('button:has-text("查看学习路径")').click()

    await expect(page.locator('.learning-path')).toContainText('到「导数定义」的学习路径')
    await expect(page.locator('.learning-path li')).toHaveCount(2)
  })
})
