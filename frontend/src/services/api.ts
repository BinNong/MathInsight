import axios from 'axios'

const API_BASE = '/api/calculus'

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

export const calculusApi = {
  // ε-δ 极限可视化
  async epsilonDelta(data: EpsilonDeltaRequest) {
    const response = await axios.post(`${API_BASE}/limit/epsilon-delta`, data)
    return response.data
  },

  // 计算极限值 L = lim(x→x0) f(x)
  async computeLimit(func_str: string, x0: number) {
    const response = await axios.post(`${API_BASE}/limit/compute`, {
      function: func_str,
      x0: x0
    })
    return response.data
  },

  // 导数切线可视化
  async derivative(data: DerivativeRequest) {
    const response = await axios.post(`${API_BASE}/derivative/tangent`, data)
    return response.data
  },

  // 割线逼近切线
  async secantApproximation(data: SecantRequest) {
    const response = await axios.post(`${API_BASE}/derivative/secant-approximation`, data)
    return response.data
  },

  // 健康检查
  async health() {
    const response = await axios.get(`${API_BASE.replace('/calculus', '')}/health`)
    return response.data
  },

  // 高阶导数
  async higherDerivatives(data: HigherDerivativeRequest) {
    const response = await axios.post(`${API_BASE}/derivative/higher`, data)
    return response.data
  },

  // 局部线性近似
  async linearApproximation(data: LinearApproximationRequest) {
    const response = await axios.post(`${API_BASE}/derivative/linear-approximation`, data)
    return response.data
  }
}
