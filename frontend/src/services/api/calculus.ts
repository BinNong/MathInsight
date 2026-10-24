import { client } from './client'

const API_BASE = '/calculus'

export interface EpsilonDeltaRequest {
  function: string
  x0: number
  L: number
  epsilon: number
  domain_range: number[]
}

export interface DerivativeRequest {
  function: string
  x0: number
  domain_range: number[]
}

export interface SecantRequest {
  function: string
  x0: number
  h_values: number[]
  domain_range: number[]
}

export interface HigherDerivativeRequest {
  function: string
  x0: number
  order?: number
  domain_range: number[]
}

export interface LinearApproximationRequest {
  function: string
  x0: number
  domain_range: number[]
}

export interface DerivativeAnalysis {
  differentiable: boolean
  first_derivative: {
    expression: string
    value: number | null
    sign: 'positive' | 'negative' | 'zero'
  }
  second_derivative: {
    expression: string
    value: number | null
    concavity: 'concave_up' | 'concave_down' | 'linear'
  }
  curvature: number
  critical_point: boolean
  local_extrema: 'local_min' | 'local_max' | null
  monotonicity: string
  slope_triangle: {
    x0: number
    y0: number
    x1: number
    y1: number
    x2: number
    y2: number
  } | null
}

export interface CriticalPoint {
  x: number
  y: number
  type: 'local_min' | 'local_max' | 'stationary'
}

export interface SecantStep {
  index: number
  h: number
  slope: number
  error: number
  description: string
}

export const calculusApi = {
  // ε-δ 极限可视化
  async epsilonDelta(data: EpsilonDeltaRequest) {
    const response = await client.post(`${API_BASE}/limit/epsilon-delta`, data)
    return response.data
  },

  // 计算极限值 L = lim(x→x0) f(x)
  async computeLimit(func_str: string, x0: number) {
    const response = await client.post(`${API_BASE}/limit/compute`, {
      function: func_str,
      x0: x0,
    })
    return response.data
  },

  // 导数切线可视化
  async derivative(data: DerivativeRequest) {
    const response = await client.post(`${API_BASE}/derivative/tangent`, data)
    return response.data
  },

  // 割线逼近切线
  async secantApproximation(data: SecantRequest) {
    const response = await client.post(`${API_BASE}/derivative/secant-approximation`, data)
    return response.data
  },

  // 健康检查
  async health() {
    const response = await client.get(`${API_BASE.replace('/calculus', '')}/health`)
    return response.data
  },

  // 高阶导数
  async higherDerivatives(data: HigherDerivativeRequest) {
    const response = await client.post(`${API_BASE}/derivative/higher`, data)
    return response.data
  },

  // 局部线性近似
  async linearApproximation(data: LinearApproximationRequest) {
    const response = await client.post(`${API_BASE}/derivative/linear-approximation`, data)
    return response.data
  },
}
