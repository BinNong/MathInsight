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

// 矩阵变换 API
export interface MatrixTransformRequest {
  matrix: [number, number, number, number]  // [a, b, c, d]
  show_eigenvectors?: boolean
  show_determinant?: boolean
}

// 特征值类型：可以是数字或复数对象
export type EigenValue = number | { re: number; im: number }

export interface MatrixTransformData {
  matrix: { a: number; b: number; c: number; d: number }
  unit_grid: {
    x_horizontal: number[][]
    y_horizontal: number[][]
    x_vertical: number[][]
    y_vertical: number[][]
  }
  transformed_grid: {
    x_horizontal: number[][]
    y_horizontal: number[][]
    x_vertical: number[][]
    y_vertical: number[][]
  }
  unit_circle: { x: number[]; y: number[] }
  determinant: { value: number; interpretation: string } | null
  eigenvalues: EigenValue[]
  eigenvectors?: Array<{ lambda: number; v: number[] }>
}

export const linearAlgebraApi = {
  async matrixTransform(data: MatrixTransformRequest) {
    const response = await axios.post('/api/linear-algebra/matrix-transform', data)
    return response.data
  },

  async getPresets() {
    const response = await axios.get('/api/linear-algebra/matrix-presets')
    return response.data
  }
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
