import { client } from './client'

// 泰勒公式可视化 API
export interface TaylorRequest {
  function: string
  x0: number
  max_order?: number
  domain_range: number[]
}

export interface TaylorCoefficient {
  order: number
  derivative_value: number | null
  factorial: number
  coefficient: number | null
  term_str: string
}

export interface Singularity {
  x: number
  distance: number
  type: string
}

export interface TaylorConvergence {
  radius_of_convergence: number | null
  nearest_singularity: Singularity | null
  singularities: Singularity[]
  summary: string
}

export interface TaylorPolynomialData {
  order: number
  name: string
  expression: string
  formula: string
  x: number[]
  y: (number | null)[]
  color: string
}

export interface RemainderCurveData {
  order: number
  name: string
  x: number[]
  y: (number | null)[]
}

export interface TaylorData {
  function: string
  x0: number
  f_x0: number
  max_order: number
  original_curve: { x: number[]; y: (number | null)[] }
  taylor_polynomials: TaylorPolynomialData[]
  remainder_bound: RemainderCurveData[]
  actual_remainder: RemainderCurveData[]
  coefficients: TaylorCoefficient[]
  convergence: TaylorConvergence
  domain_range: number[]
}

export interface TaylorEvaluateRequest {
  function: string
  x0: number
  x: number
  max_order?: number
}

export interface TaylorApproximation {
  order: number
  value: number
  error: number | null
  remainder_bound: number | null
}

export interface TaylorEvaluateData {
  x: number
  f_x: number | null
  approximations: TaylorApproximation[]
  best_order: number
}

export const taylorApi = {
  async taylor(data: TaylorRequest) {
    const response = await client.post('/calculus/taylor', data)
    return response.data
  },

  async evaluate(data: TaylorEvaluateRequest) {
    const response = await client.post('/calculus/taylor/evaluate', data)
    return response.data
  },
}
