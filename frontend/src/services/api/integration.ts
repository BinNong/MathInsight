import { client } from './client'

// 黎曼积分可视化 API
export interface RiemannSumRequest {
  function: string
  a: number // 积分下限
  b: number // 积分上限
  n: number // 分割数
  method: 'left' | 'right' | 'midpoint' | 'random'
  domain_range?: number[] // 绘图域范围（可选）
}

export interface RiemannSumData {
  function: string
  interval: { a: number; b: number }
  n: number
  method: string
  rectangles: {
    x_left: number[]
    x_right: number[]
    x_mid: number[]
    height: number[]
    area: number
  }
  rect_lines: {
    x: number[]
    y: number[]
  }
  approximation: number
  exact_value: number | null
  error: number | null
  function_curve: { x: number[]; y: (number | null)[] }
  domain_range: number[]
}

export interface ConvergenceRequest {
  function: string
  a: number // 积分下限
  b: number // 积分上限
  n_values?: number[] // 要测试的分割数列表
  domain_range?: number[] // 绘图域范围（可选）
}

export interface MethodResult {
  name: string
  errors: { n: number; error: number }[]
}

export interface ConvergenceData {
  function: string
  interval: { a: number; b: number }
  exact_value: number | null
  methods: Record<string, MethodResult>
  n_values: number[]
  function_curve: { x: number[]; y: (number | null)[] }
  domain_range: number[]
}

export const integrationApi = {
  async riemannSum(data: RiemannSumRequest) {
    const response = await client.post('/calculus/integration/riemann-sum', data)
    return response.data
  },

  async convergence(data: ConvergenceRequest) {
    const response = await client.post('/calculus/integration/convergence', data)
    return response.data
  },
}
