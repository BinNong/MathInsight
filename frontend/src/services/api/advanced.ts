import { client } from './client'

const API_BASE = '/advanced'

export interface ODEDirectionFieldRequest {
  function: string
  x_range: [number, number]
  y_range: [number, number]
  density?: number
  initial_conditions?: Array<{ x: number; y: number }>
}

export interface ODEFieldSegment {
  x: number
  y: number
  dx: number
  dy: number
  slope: number
}

export interface ODEFieldData {
  function: string
  segments: ODEFieldSegment[]
  curves: Array<{
    initial: { x: number; y: number }
    x: number[]
    y: number[]
  }>
  x_range: [number, number]
  y_range: [number, number]
}

export interface EigenRequest {
  matrix: [[number, number], [number, number]]
  vector?: [number, number]
}

export interface EigenData {
  matrix: number[][]
  determinant: number
  trace: number
  characteristic: string
  eigenpairs: Array<{
    eigenvalue_real: number
    eigenvalue_imag: number
    vector: [number, number]
  }>
  vector?: [number, number]
  transformed?: [number, number]
  scaling?: number | null
  is_eigenvector?: boolean
}

export interface HypothesisRequest {
  test_type: 'z' | 't'
  tail: 'two' | 'left' | 'right'
  sample_mean: number
  hypothesized_mean: number
  std: number
  n: number
  alpha: number
}

export interface HypothesisData {
  test_type: string
  sample_mean: number
  hypothesized_mean: number
  statistic: number
  p_value: number
  alpha: number
  tail: string
  reject_null: boolean
  standard_error: number
  confidence_interval: [number, number]
  critical_value: number
  distribution: { x: number[]; y: number[] }
  conclusion: string
}

export const advancedApi = {
  async directionField(data: ODEDirectionFieldRequest) {
    return (await client.post(`${API_BASE}/ode/direction-field`, data)).data
  },
  async eigenvalues(data: EigenRequest) {
    return (await client.post(`${API_BASE}/eigenvalues/analyze`, data)).data
  },
  async hypothesisTest(data: HypothesisRequest) {
    return (await client.post(`${API_BASE}/hypothesis-test`, data)).data
  },
}
