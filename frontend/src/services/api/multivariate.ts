import { client } from './client'

// 多元函数可视化 API
export interface SurfaceRequest {
  function: string
  x_range: number[]
  y_range: number[]
  resolution?: number
}

export interface ContourRequest {
  function: string
  x_range: number[]
  y_range: number[]
  levels?: number
  resolution?: number
}

export interface GradientRequest {
  function: string
  x_range: number[]
  y_range: number[]
  resolution?: number
}

export interface PartialDerivRequest {
  function: string
  x0: number
  y0: number
}

export interface GradientDescentRequest {
  function: string
  start_x: number
  start_y: number
  learning_rate?: number
  steps?: number
}

export interface ComputeSurfaceRequest {
  function: string
  x_range: number[]
  y_range: number[]
  point_x: number
  point_y: number
  resolution?: number
  contour_levels?: number
  show_gradient?: boolean
  show_tangent_plane?: boolean
}

export interface SurfaceData {
  surface: {
    x: number[][]
    y: number[][]
    z: (number | null)[][]
  }
}

export interface ContourData {
  contour: {
    x: number[][]
    y: number[][]
    z: (number | null)[][]
    levels: number[]
  }
}

export interface GradientData {
  gradient: {
    x: number[][]
    y: number[][]
    u: number[][]
    v: number[][]
    magnitude: number[][]
  }
  partial_derivatives: {
    df_dx: string
    df_dy: string
  }
}

export interface PartialDerivativesData {
  point: {
    x: number
    y: number
    z: number
  }
  partial_derivatives: {
    df_dx: number
    df_dy: number
    df_dx_expr: string
    df_dy_expr: string
  }
  tangent_plane: {
    x: number[][]
    y: number[][]
    z: (number | null)[][]
    equation: string
  }
  gradient: {
    x: number[]
    y: number[]
    z: number[]
    magnitude: number
  }
  gradient_2d: {
    x: number[]
    y: number[]
  }
}

export interface ComputeSurfaceData {
  success: boolean
  surface: {
    x: number[][]
    y: number[][]
    z: (number | null)[][]
  }
  contour: {
    x: number[][]
    y: number[][]
    z: (number | null)[][]
    levels: number[]
  }
  gradient: {
    x: number[][]
    y: number[][]
    u: number[][]
    v: number[][]
    magnitude: number[][]
  } | null
  partial_derivatives: {
    df_dx: number
    df_dy: number
    df_dx_expr: string
    df_dy_expr: string
  } | null
  tangent_plane: {
    x: number[][]
    y: number[][]
    z: (number | null)[][]
    equation: string
  } | null
  point: {
    x: number
    y: number
    z: number
  }
  gradient_2d: {
    x: number[]
    y: number[]
  } | null
  function: string
  x_range: number[]
  y_range: number[]
}

export interface Preset {
  name: string
  function: string
  description: string
}

export const multivariateApi = {
  // 3D 曲面数据
  async surface(data: SurfaceRequest) {
    const response = await client.post('/multivariate/surface', data)
    return response.data
  },

  // 等高线数据
  async contour(data: ContourRequest) {
    const response = await client.post('/multivariate/contour', data)
    return response.data
  },

  // 梯度场数据
  async gradient(data: GradientRequest) {
    const response = await client.post('/multivariate/gradient', data)
    return response.data
  },

  // 偏导数和切平面
  async partialDerivatives(data: PartialDerivRequest) {
    const response = await client.post('/multivariate/partial-derivatives', data)
    return response.data
  },

  // 最速下降路径
  async gradientDescent(data: GradientDescentRequest) {
    const response = await client.post('/multivariate/gradient-descent', data)
    return response.data
  },

  // 综合计算所有数据
  async compute(data: ComputeSurfaceRequest) {
    const response = await client.post('/multivariate/compute', data)
    return response.data
  },

  // 获取预设函数
  async getPresets() {
    const response = await client.get('/multivariate/presets')
    return response.data
  },
}
