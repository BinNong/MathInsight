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

// 大数定律模拟 API
export interface LLNSimulateRequest {
  experiment_type: 'coin' | 'dice'
  p?: number           // 硬币正面概率（仅 coin）
  min_val?: number     // 最小值（仅 dice）
  max_val?: number     // 最大值（仅 dice）
  sample_size: number
  seed?: number
}

export interface LLNResultData {
  experiment_type: string
  expected_value: number
  total_samples: number
  cumulative_means: number[]
  samples: number[]
  final_mean: number
}

export const probabilityApi = {
  async simulateLLN(data: LLNSimulateRequest) {
    const response = await axios.post('/api/probability/lln/simulate', data)
    return response.data
  },

  async getPresets() {
    const response = await axios.get('/api/probability/lln/presets')
    return response.data
  }
}

// 泰勒公式可视化 API
export interface TaylorRequest {
  function: string
  x0: number
  max_order?: number
  domain_range: number[]
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
  domain_range: number[]
}

export const taylorApi = {
  async taylor(data: TaylorRequest) {
    const response = await axios.post('/api/calculus/taylor', data)
    return response.data
  }
}

// 黎曼积分可视化 API
export interface RiemannSumRequest {
  function: string
  a: number           // 积分下限
  b: number           // 积分上限
  n: number           // 分割数
  method: 'left' | 'right' | 'midpoint' | 'random'
  domain_range?: number[]  // 绘图域范围（可选）
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
  a: number           // 积分下限
  b: number           // 积分上限
  n_values?: number[] // 要测试的分割数列表
  domain_range?: number[]  // 绘图域范围（可选）
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
    const response = await axios.post('/api/calculus/integration/riemann-sum', data)
    return response.data
  },

  async convergence(data: ConvergenceRequest) {
    const response = await axios.post('/api/calculus/integration/convergence', data)
    return response.data
  }
}

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
    const response = await axios.post('/api/multivariate/surface', data)
    return response.data
  },

  // 等高线数据
  async contour(data: ContourRequest) {
    const response = await axios.post('/api/multivariate/contour', data)
    return response.data
  },

  // 梯度场数据
  async gradient(data: GradientRequest) {
    const response = await axios.post('/api/multivariate/gradient', data)
    return response.data
  },

  // 偏导数和切平面
  async partialDerivatives(data: PartialDerivRequest) {
    const response = await axios.post('/api/multivariate/partial-derivatives', data)
    return response.data
  },

  // 最速下降路径
  async gradientDescent(data: GradientDescentRequest) {
    const response = await axios.post('/api/multivariate/gradient-descent', data)
    return response.data
  },

  // 综合计算所有数据
  async compute(data: ComputeSurfaceRequest) {
    const response = await axios.post('/api/multivariate/compute', data)
    return response.data
  },

  // 获取预设函数
  async getPresets() {
    const response = await axios.get('/api/multivariate/presets')
    return response.data
  }
}

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

export const vectorFieldApi = {
  // 向量场可视化
  async vectorField(data: VectorFieldRequest) {
    const response = await axios.post('/api/vector-field/field', data)
    return response.data
  },

  // 流线计算
  async streamline(data: StreamlineRequest) {
    const response = await axios.post('/api/vector-field/streamline', data)
    return response.data
  },

  // 线积分计算
  async lineIntegral(data: LineIntegralRequest) {
    const response = await axios.post('/api/vector-field/line-integral', data)
    return response.data
  },

  // 格林公式验证
  async greensTheorem(data: GreensTheoremRequest) {
    const response = await axios.post('/api/vector-field/greens-theorem', data)
    return response.data
  },

  // 通量计算
  async flux(data: LineIntegralRequest) {
    const response = await axios.post('/api/vector-field/flux', data)
    return response.data
  },

  // 旋度和散度计算
  async curlDivergence(data: CurlDivergenceRequest) {
    const response = await axios.post('/api/vector-field/curl-divergence', data)
    return response.data
  },

  // 获取预设
  async getPresets(): Promise<{ success: boolean; data?: VectorFieldPresetsData; error?: string }> {
    const response = await axios.get('/api/vector-field/presets')
    return response.data
  },

  // 保守场判定
  async checkConservative(data: ConservativeCheckRequest): Promise<ConservativeCheckData> {
    const response = await axios.post('/api/vector-field/conservative', data)
    return response.data
  },

  // 势函数计算
  async findPotential(data: PotentialRequest): Promise<PotentialData> {
    const response = await axios.post('/api/vector-field/potential', data)
    return response.data
  },

  // 势函数等值线
  async potentialContour(data: PotentialContourRequest): Promise<PotentialContourData> {
    const response = await axios.post('/api/vector-field/potential-contour', data)
    return response.data
  },

  // 路径无关性验证
  async verifyPathIndependence(data: PathIndependenceRequest): Promise<PathIndependenceData> {
    const response = await axios.post('/api/vector-field/path-independence', data)
    return response.data
  }
}
