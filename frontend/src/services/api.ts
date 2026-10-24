/**
 * API 服务统一入口（兼容旧导入）
 *
 * 新的模块文件已拆分至 `./api/` 目录下：
 *   - ./api/client.ts     axios 实例
 *   - ./api/calculus.ts   微积分相关
 *   - ./api/linearAlgebra.ts  线性代数
 *   - ./api/probability.ts    概率论
 *   - ./api/taylor.ts         泰勒展开
 *   - ./api/integration.ts    黎曼积分与数值积分
 *   - ./api/multivariate.ts   多元函数
 *   - ./api/vectorField.ts    向量场与线积分
 *   - ./api/manim.ts          Manim 动画
 *
 * 本文件继续重新导出所有内容，避免一次性修改所有页面导入。
 */

export { client, API_PREFIX } from './api/client'

export type {
  EpsilonDeltaRequest,
  DerivativeRequest,
  SecantRequest,
  HigherDerivativeRequest,
  LinearApproximationRequest,
} from './api/calculus'
export { calculusApi } from './api/calculus'

export type { MatrixTransformRequest, EigenValue, MatrixTransformData } from './api/linearAlgebra'
export { linearAlgebraApi } from './api/linearAlgebra'

export type {
  LLNSimulateRequest,
  LLNResultData,
  DistributionType,
  CLTSimulateRequest,
  CLTResultData,
  DistributionSimulateRequest,
  DistributionResultData,
  DistributionPreset,
  DistributionParamConfig,
  DistributionPresetsData,
} from './api/probability'
export { probabilityApi } from './api/probability'

export type {
  TaylorRequest,
  TaylorCoefficient,
  Singularity,
  TaylorConvergence,
  TaylorPolynomialData,
  RemainderCurveData,
  TaylorData,
  TaylorEvaluateRequest,
  TaylorApproximation,
  TaylorEvaluateData,
} from './api/taylor'
export { taylorApi } from './api/taylor'

export type {
  RiemannSumRequest,
  RiemannSumData,
  ConvergenceRequest,
  MethodResult,
  ConvergenceData,
} from './api/integration'
export { integrationApi } from './api/integration'

export type {
  SurfaceRequest,
  ContourRequest,
  GradientRequest,
  PartialDerivRequest,
  GradientDescentRequest,
  ComputeSurfaceRequest,
  SurfaceData,
  ContourData,
  GradientData,
  PartialDerivativesData,
  ComputeSurfaceData,
  Preset,
} from './api/multivariate'
export { multivariateApi } from './api/multivariate'

export type {
  VectorFieldRequest,
  VectorFieldData,
  StreamlineRequest,
  StreamlineData,
  LineIntegralRequest,
  LineIntegralData,
  GreensTheoremRequest,
  GreensTheoremData,
  CurlDivergenceRequest,
  VectorFieldPreset,
  PathPreset,
  VectorFieldPresetsData,
  ConservativeCheckRequest,
  ConservativeCheckData,
  PotentialRequest,
  PotentialData,
  PotentialContourRequest,
  PotentialContourData,
  PathIndependenceRequest,
  PathIndependenceData,
  VectorField3DRequest,
  VectorField3DData,
  Streamline3DRequest,
  Streamline3DData,
  CurlDivergence3DRequest,
  CurlDivergence3DData,
  VectorField3DPreset,
  SurfaceType,
  SurfacePreset,
  SurfaceIntegralRequest,
  SurfaceIntegralData,
  SolidType,
  GaussSolidPreset,
  GaussTheoremRequest,
  GaussTheoremData,
} from './api/vectorField'
export { vectorFieldApi } from './api/vectorField'

export type { GenerateAnimationRequest, GenerateAnimationResponse } from './api/manim'
export { manimApi } from './api/manim'

export type {
  SolverSubject,
  SolverStep,
  VisualizationSuggestion,
  SolverResult,
  AnalyzeProblemRequest,
  HintRequest,
  HintResponse,
  SimilarProblem,
  SimilarRequest,
  SimilarResponse,
} from './api/solver'
export { solverApi } from './api/solver'
