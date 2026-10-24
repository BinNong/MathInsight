import { client } from './client'

// ============ 向量场与线积分 API ============

export interface VectorFieldRequest {
  P: string
  Q: string
  x_range: number[]
  y_range: number[]
  resolution?: number
}

export interface VectorFieldData {
  vector_field: {
    x: number[][]
    y: number[][]
    u: number[][]
    v: number[][]
    u_norm: number[][]
    v_norm: number[][]
    magnitude: number[][]
  }
  curl: {
    values: number[][]
    expression: string
  }
  divergence: {
    values: number[][]
    expression: string
  }
  field_expressions: {
    P: string
    Q: string
  }
}

export interface StreamlineRequest {
  P: string
  Q: string
  start_points: number[][]
  t_span: number[]
  direction?: 'forward' | 'backward' | 'both'
}

export interface StreamlineData {
  streamlines: Array<{
    start_point: { x: number; y: number }
    x: number[]
    y: number[]
  }>
}

export interface LineIntegralRequest {
  P: string
  Q: string
  path: {
    type: 'parametric' | 'segments'
    x?: string
    y?: string
    t_range?: number[]
    segments?: Array<{
      x: string | any
      y: string | any
      t_range: number[]
    }>
  }
  num_points?: number
}

export interface LineIntegralData {
  integral_value: number
  flux_value: number
  path: {
    x: number[]
    y: number[]
  }
  field_data?: {
    u_field: number[]
    v_field: number[]
    u_tangent: number[]
    v_tangent: number[]
    tangent_projection: number[]
    u_normal: number[]
    v_normal: number[]
    normal_projection: number[]
  }
}

export interface GreensTheoremRequest {
  P: string
  Q: string
  region_type: 'circle' | 'rectangle'
  region_params?: {
    radius?: number
    x_min?: number
    x_max?: number
    y_min?: number
    y_max?: number
  }
}

export interface GreensTheoremData {
  greens_theorem: {
    left_side: {
      value: number
      expression: string
    }
    right_side: {
      value: number
      integrand: string
      expression: string
    }
    difference: number
    relative_error: number
    is_verified: boolean
  }
  boundary: {
    x: number[]
    y: number[]
  }
  region: {
    type: string
    params: any
  }
}

export interface CurlDivergenceRequest {
  P: string
  Q: string
  x: number
  y: number
}

export interface VectorFieldPreset {
  id: string
  name: string
  description: string
  P: string
  Q: string
  potential?: string | null
}

export interface PathPreset {
  id: string
  name: string
  description: string
  parametric: any
  is_closed: boolean
}

export interface VectorFieldPresetsData {
  vector_fields: VectorFieldPreset[]
  paths: PathPreset[]
}

// ============ 保守场相关接口 ============

export interface ConservativeCheckRequest {
  P: string
  Q: string
}

export interface ConservativeCheckData {
  success: boolean
  is_conservative: boolean
  curl_expression: string
  curl_value: number
  curl_at_points: number[]
  message: string
  error?: string
}

export interface PotentialRequest {
  P: string
  Q: string
}

export interface PotentialData {
  success: boolean
  is_conservative: boolean
  potential_function: string | null
  grad_x: string
  grad_y: string
  matches_field: boolean
  message: string
  error?: string
  curl_expression?: string
}

export interface PotentialContourRequest {
  P: string
  Q: string
  x_range: number[]
  y_range: number[]
  resolution?: number
}

export interface PotentialContourData {
  success: boolean
  potential_function: string
  x: number[][]
  y: number[][]
  z: number[][]
  levels: number[]
  z_range: number[]
  error?: string
}

export interface PathIndependenceRequest {
  P: string
  Q: string
  start_point: [number, number]
  end_point: [number, number]
  num_points?: number
}

export interface PathIndependenceData {
  success: boolean
  is_conservative: boolean
  start_point: { x: number; y: number }
  end_point: { x: number; y: number }
  integrals: Array<{
    path_name: string
    path_type: string
    value: number
  }>
  differences: Array<{
    pair: string
    difference: number
  }>
  relative_errors: Array<{
    path: string
    error: number
  }>
  path_points: Record<string, { x: number[]; y: number[] }>
  is_independent: boolean
  message: string
  curl_expression?: string
  curl_value?: number
  error?: string
}

// ============ 3D向量场相关接口 ============

export interface VectorField3DRequest {
  P: string // x分量表达式
  Q: string // y分量表达式
  R: string // z分量表达式
  x_range: number[]
  y_range: number[]
  z_range: number[]
  resolution?: number
}

export interface VectorField3DData {
  success: boolean
  error?: string
  vector_field?: {
    x: number[] // 扁平化数据用于cone图
    y: number[]
    z: number[]
    u: number[] // P(x,y,z)
    v: number[] // Q(x,y,z)
    w: number[] // R(x,y,z)
    u_norm: number[]
    v_norm: number[]
    w_norm: number[]
    magnitude: number[]
    grid_x: number[][][]
    grid_y: number[][][]
    grid_z: number[][][]
    grid_u: number[][][]
    grid_v: number[][][]
    grid_w: number[][][]
    grid_magnitude: number[][][]
  }
  curl: {
    expression: { x: string; y: string; z: string }
    value: { x: number; y: number; z: number }
    values_x: number[][][]
    values_y: number[][][]
    values_z: number[][][]
  }
  divergence: {
    expression: string
    value: number
    values: number[][][]
  }
  field_expressions: { P: string; Q: string; R: string }
  x_range: number[]
  y_range: number[]
  z_range: number[]
}

export interface Streamline3DRequest {
  P: string
  Q: string
  R: string
  start_points: number[][]
  t_span: number[]
  direction?: 'forward' | 'backward' | 'both'
}

export interface Streamline3DData {
  success: boolean
  error?: string
  streamlines?: Array<{
    start_point: { x: number; y: number; z: number }
    x: number[]
    y: number[]
    z: number[]
    direction: string
  }>
  field: { P: string; Q: string; R: string }
}

export interface CurlDivergence3DRequest {
  P: string
  Q: string
  R: string
  x?: number
  y?: number
  z?: number
}

export interface CurlDivergence3DData {
  success: boolean
  curl: {
    expression: { x: string; y: string; z: string }
    value: { x: number; y: number; z: number }
  }
  divergence: {
    expression: string
    value: number
  }
  point: { x: number; y: number; z: number }
}

export interface VectorField3DPreset {
  id: string
  name: string
  description: string
  P: string
  Q: string
  R: string
}

// ============ 曲面积分相关接口 ============

export type SurfaceType = 'sphere' | 'cylinder' | 'paraboloid' | 'cone' | 'plane'

export interface SurfacePreset {
  id: string
  name: string
  description: string
  parametric: {
    x: string
    y: string
    z: string
    u_range: number[]
    v_range: number[]
    params: Record<string, number>
  }
}

export interface SurfaceIntegralRequest {
  P: string
  Q: string
  R: string
  surface_type: SurfaceType
  surface_params?: Record<string, number>
  orientation?: 'outward' | 'inward'
  resolution?: number
}

export interface SurfaceIntegralData {
  success: boolean
  error?: string
  surface_integral: number
  surface: {
    type: SurfaceType
    name: string
    x: number[][]
    y: number[][]
    z: number[][]
  }
  normal: {
    x: number[][]
    y: number[][]
    z: number[][]
    magnitude: number[][]
  }
  field_on_surface?: {
    P: number[][]
    Q: number[][]
    R: number[][]
  }
  flux_density: number[][]
  orientation: string
  field: { P: string; Q: string; R: string }
}

// ============ 高斯定理相关接口 ============

export type SolidType = 'sphere' | 'cube' | 'cylinder'

export interface GaussSolidPreset {
  id: string
  name: string
  description: string
  type: SolidType
  params: Record<string, number>
}

export interface GaussTheoremRequest {
  P: string
  Q: string
  R: string
  solid_type: SolidType
  solid_params?: Record<string, number>
  resolution?: number
}

export interface GaussTheoremData {
  success: boolean
  error?: string
  gauss_theorem: {
    surface_integral: {
      value: number
      expression: string
    }
    volume_integral: {
      value: number
      expression: string
    }
    divergence_expression: string
    difference: number
    relative_error: number
    is_verified: boolean
    formula: string
  }
  solid: {
    type: SolidType
    name: string
    params: Record<string, number>
    x: any
    y: any
    z: any
  }
  field: { P: string; Q: string; R: string }
}

export const vectorFieldApi = {
  // 向量场可视化
  async vectorField(data: VectorFieldRequest) {
    const response = await client.post('/vector-field/field', data)
    return response.data
  },

  // 流线计算
  async streamline(data: StreamlineRequest) {
    const response = await client.post('/vector-field/streamline', data)
    return response.data
  },

  // 线积分计算
  async lineIntegral(data: LineIntegralRequest) {
    const response = await client.post('/vector-field/line-integral', data)
    return response.data
  },

  // 格林公式验证
  async greensTheorem(data: GreensTheoremRequest) {
    const response = await client.post('/vector-field/greens-theorem', data)
    return response.data
  },

  // 通量计算
  async flux(data: LineIntegralRequest) {
    const response = await client.post('/vector-field/flux', data)
    return response.data
  },

  // 旋度和散度计算
  async curlDivergence(data: CurlDivergenceRequest) {
    const response = await client.post('/vector-field/curl-divergence', data)
    return response.data
  },

  // 获取预设
  async getPresets(): Promise<{ success: boolean; data?: VectorFieldPresetsData; error?: string }> {
    const response = await client.get('/vector-field/presets')
    return response.data
  },

  // 保守场判定
  async checkConservative(data: ConservativeCheckRequest): Promise<ConservativeCheckData> {
    const response = await client.post('/vector-field/conservative', data)
    return response.data
  },

  // 势函数计算
  async findPotential(data: PotentialRequest): Promise<PotentialData> {
    const response = await client.post('/vector-field/potential', data)
    return response.data
  },

  // 势函数等值线
  async potentialContour(data: PotentialContourRequest): Promise<PotentialContourData> {
    const response = await client.post('/vector-field/potential-contour', data)
    return response.data
  },

  // 路径无关性验证
  async verifyPathIndependence(data: PathIndependenceRequest): Promise<PathIndependenceData> {
    const response = await client.post('/vector-field/path-independence', data)
    return response.data
  },

  // ============ 3D向量场 API ============

  // 3D向量场可视化
  async vectorField3d(data: VectorField3DRequest): Promise<VectorField3DData> {
    const response = await client.post('/vector-field/field-3d', data)
    return response.data
  },

  // 3D流线计算
  async streamline3d(data: Streamline3DRequest): Promise<Streamline3DData> {
    const response = await client.post('/vector-field/streamline-3d', data)
    return response.data
  },

  // 3D旋度和散度计算
  async curlDivergence3d(data: CurlDivergence3DRequest): Promise<CurlDivergence3DData> {
    const response = await client.post('/vector-field/curl-divergence-3d', data)
    return response.data
  },

  // 获取3D预设向量场
  async getPresets3d(): Promise<{ success: boolean; vector_fields: VectorField3DPreset[] }> {
    const response = await client.get('/vector-field/presets-3d')
    return response.data
  },

  // ============ 曲面积分 API ============

  // 计算曲面积分
  async surfaceIntegral(data: SurfaceIntegralRequest): Promise<SurfaceIntegralData> {
    const response = await client.post('/vector-field/surface-integral', data)
    return response.data
  },

  // 获取预设曲面
  async getSurfacePresets(): Promise<{ success: boolean; surfaces: SurfacePreset[] }> {
    const response = await client.get('/vector-field/surface-presets')
    return response.data
  },

  // ============ 高斯定理 API ============

  // 验证高斯定理
  async gaussTheorem(data: GaussTheoremRequest): Promise<GaussTheoremData> {
    const response = await client.post('/vector-field/gauss-theorem', data)
    return response.data
  },

  // 获取高斯定理预设立体
  async getGaussPresets(): Promise<{ success: boolean; solids: GaussSolidPreset[] }> {
    const response = await client.get('/vector-field/gauss-presets')
    return response.data
  },
}
