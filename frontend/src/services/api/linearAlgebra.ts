import { client } from './client'

// 矩阵变换 API
export interface MatrixTransformRequest {
  matrix: [number, number, number, number] // [a, b, c, d]
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
    const response = await client.post('/linear-algebra/matrix-transform', data)
    return response.data
  },

  async getPresets() {
    const response = await client.get('/linear-algebra/matrix-presets')
    return response.data
  },
}
