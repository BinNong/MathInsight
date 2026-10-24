export const TOPIC_ROUTE_MAP: Record<string, { path: string; label: string } | undefined> = {
  limit: { path: '/limit', label: 'ε-δ 极限可视化' },
  derivative: { path: '/derivative', label: '导数与切线可视化' },
  integral: { path: '/integration', label: '黎曼积分可视化' },
  taylor: { path: '/taylor', label: '泰勒级数可视化' },
  multivariate: { path: '/multivariate', label: '多元函数可视化' },
  'vector-field': { path: '/vector-field', label: '向量场与线积分' },
  'line-integral': { path: '/vector-field', label: '向量场与线积分' },
  'surface-integral': { path: '/surface-integral', label: '曲面积分可视化' },
  matrix: { path: '/matrix', label: '矩阵变换可视化' },
  eigenvalue: { path: '/matrix', label: '矩阵变换可视化' },
  'linear-system': { path: '/matrix', label: '矩阵变换可视化' },
  probability: { path: '/probability', label: '大数定律模拟' },
  distribution: { path: '/distributions', label: '常见概率分布' },
  series: { path: '/taylor', label: '泰勒级数可视化' },
}

export function getTopicRoute(topic: string): { path: string; label: string } | undefined {
  return TOPIC_ROUTE_MAP[topic] ?? undefined
}
