import { useState, useEffect, useCallback, useMemo } from 'react'
import Plot from 'react-plotly.js'
import {
  vectorFieldApi,
  VectorFieldData,
  LineIntegralData,
  GreensTheoremData,
  StreamlineData,
  VectorFieldPreset,
  PathPreset,
  ConservativeCheckData,
  PotentialData,
  PotentialContourData,
  PathIndependenceData,
} from '../services/api'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'

// ============ 常量定义 ============

const ARROW_SCALE = 0.5 // 向量场箭头缩放比例
const ARROW_HEAD_SIZE = 0.03 // 箭头头部大小
const PATH_ARROW_SKIP = 20 // 路径箭头间隔点数
const MIN_VECTOR_THRESHOLD = 0.001 // 最小向量阈值

// ============ 类型定义 ============

type VectorFieldMode = 'field' | 'line_integral' | 'greens_theorem' | 'flux' | 'conservative'
type PathType = 'circle' | 'ellipse' | 'line_segment' | 'parabola' | 'square'
type RegionType = 'circle' | 'rectangle'

interface VectorFieldState {
  // 向量场参数
  P: string
  Q: string
  xRange: [number, number]
  yRange: [number, number]
  resolution: number

  // 可视化选项
  showStreamlines: boolean
  showContour: boolean // 保守场模式：显示等值线

  // 积分模式
  mode: VectorFieldMode

  // 路径参数
  pathType: PathType

  // 格林公式参数
  regionType: RegionType
  regionRadius: number
  regionXMin: number
  regionXMax: number
  regionYMin: number
  regionYMax: number

  // 流线参数
  streamlineStartPoints: string
  streamlineTimeSpan: number

  // 路径无关性参数
  startPoint: [number, number]
  endPoint: [number, number]
  showPathIndependence: boolean
}

// ============ 默认状态 ============

const DEFAULT_STATE: VectorFieldState = {
  P: '-y',
  Q: 'x',
  xRange: [-3, 3],
  yRange: [-3, 3],
  resolution: 20,
  showStreamlines: false,
  showContour: true,
  mode: 'field',
  pathType: 'circle',
  regionType: 'circle',
  regionRadius: 1,
  regionXMin: -1,
  regionXMax: 1,
  regionYMin: -1,
  regionYMax: 1,
  streamlineStartPoints: '[[1,0],[0,1],[-1,0],[0,-1]]',
  streamlineTimeSpan: 3,
  startPoint: [0, 0],
  endPoint: [1, 1],
  showPathIndependence: false,
}

// Plotly trace 类型
type PlotlyTrace = {
  type: 'scatter'
  mode: 'lines'
  x: (number | null)[]
  y: (number | null)[]
  line?: { color?: string; width?: number }
  fill?: string
  fillcolor?: string
  name?: string
  hovertemplate?: string
  hoverinfo?: string
}

// ============ 预设默认值（API 数据未加载时的回退）==========

const DEFAULT_VECTOR_FIELD_PRESETS: VectorFieldPreset[] = [
  { id: 'rotational', name: '旋转场', description: 'F = (-y, x)', P: '-y', Q: 'x' },
  { id: 'conservative', name: '保守场', description: 'F = (2x, 2y)', P: '2*x', Q: '2*y' },
  { id: 'radial', name: '辐射场', description: 'F = (x, y)', P: 'x', Q: 'y' },
  { id: 'shear', name: '剪切场', description: 'F = (y, 0)', P: 'y', Q: '0' },
  { id: 'saddle', name: '鞍点场', description: 'F = (x, -y)', P: 'x', Q: '-y' },
  {
    id: 'vortex',
    name: '涡旋场',
    description: 'F = (-y/(x²+y²), x/(x²+y²))',
    P: '-y/(x**2 + y**2 + 0.1)',
    Q: 'x/(x**2 + y**2 + 0.1)',
  },
]

const DEFAULT_PATH_PRESETS: PathPreset[] = [
  {
    id: 'circle',
    name: '单位圆',
    description: 'x=cos(t), y=sin(t)',
    parametric: { x: 'cos(t)', y: 'sin(t)', t_range: [0, 2 * Math.PI] },
    is_closed: true,
  },
  {
    id: 'ellipse',
    name: '椭圆',
    description: 'x=2cos(t), y=sin(t)',
    parametric: { x: '2*cos(t)', y: 'sin(t)', t_range: [0, 2 * Math.PI] },
    is_closed: true,
  },
  {
    id: 'line_segment',
    name: '直线段',
    description: '从(-1,-1)到(1,1)',
    parametric: { x: 't', y: 't', t_range: [-1, 1] },
    is_closed: false,
  },
  {
    id: 'parabola',
    name: '抛物线',
    description: 'y=x²',
    parametric: { x: 't', y: 't**2', t_range: [-1, 1] },
    is_closed: false,
  },
  {
    id: 'square',
    name: '正方形',
    description: '边长为2的正方形',
    parametric: { segments: [] },
    is_closed: true,
  },
]

// ============ 主组件 ============

export default function VectorFieldLineIntegrals() {
  const [state, setState] = useState<VectorFieldState>(DEFAULT_STATE)
  const [vectorFieldData, setVectorFieldData] = useState<VectorFieldData | null>(null)
  const [lineIntegralData, setLineIntegralData] = useState<LineIntegralData | null>(null)
  const [greensData, setGreensData] = useState<GreensTheoremData | null>(null)
  const [streamlines, setStreamlines] = useState<StreamlineData | null>(null)
  const [conservativeData, setConservativeData] = useState<ConservativeCheckData | null>(null)
  const [potentialData, setPotentialData] = useState<PotentialData | null>(null)
  const [potentialContour, setPotentialContour] = useState<PotentialContourData | null>(null)
  const [pathIndependenceData, setPathIndependenceData] = useState<PathIndependenceData | null>(
    null
  )
  const [presets, setPresets] = useState<{
    vector_fields: VectorFieldPreset[]
    paths: PathPreset[]
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 获取预设
  useEffect(() => {
    const fetchPresets = async () => {
      const response = await vectorFieldApi.getPresets()
      if (response.success && response.data) {
        setPresets(response.data)
      }
    }
    fetchPresets()
  }, [])

  // 预设数据（使用 API 数据，失败时使用默认值）
  const vectorFieldPresets = useMemo((): VectorFieldPreset[] => {
    return presets?.vector_fields || DEFAULT_VECTOR_FIELD_PRESETS
  }, [presets])

  const pathPresets = useMemo((): PathPreset[] => {
    return presets?.paths || DEFAULT_PATH_PRESETS
  }, [presets])

  // 获取向量场数据
  const fetchVectorField = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await vectorFieldApi.vectorField({
        P: state.P,
        Q: state.Q,
        x_range: state.xRange,
        y_range: state.yRange,
        resolution: state.resolution,
      })

      if (response.success) {
        setVectorFieldData(response)
      } else {
        setVectorFieldData(null)
        setError(response.error || '计算失败')
      }
    } catch (err) {
      setError('无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }, [state.P, state.Q, state.xRange, state.yRange, state.resolution])

  // 获取线积分数据
  const fetchLineIntegral = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const pathConfig = buildPathConfig()
      const response = await vectorFieldApi.lineIntegral({
        P: state.P,
        Q: state.Q,
        path: pathConfig,
        num_points: 200,
      })

      if (response.success) {
        setLineIntegralData(response)
      } else {
        setError(response.error || '计算失败')
      }
    } catch (err) {
      setError('无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }, [state.P, state.Q, state.pathType, state.xRange, state.yRange])

  // 获取格林公式验证数据
  const fetchGreensTheorem = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const regionParams =
        state.regionType === 'circle'
          ? { radius: state.regionRadius }
          : {
              x_min: state.regionXMin,
              x_max: state.regionXMax,
              y_min: state.regionYMin,
              y_max: state.regionYMax,
            }

      const response = await vectorFieldApi.greensTheorem({
        P: state.P,
        Q: state.Q,
        region_type: state.regionType,
        region_params: regionParams,
      })

      if (response.success) {
        setGreensData(response)
      } else {
        setError(response.error || '计算失败')
      }
    } catch (err) {
      setError('无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }, [
    state.P,
    state.Q,
    state.regionType,
    state.regionRadius,
    state.regionXMin,
    state.regionXMax,
    state.regionYMin,
    state.regionYMax,
  ])

  // 获取流线数据
  const fetchStreamlines = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const startPoints = JSON.parse(state.streamlineStartPoints)
      const response = await vectorFieldApi.streamline({
        P: state.P,
        Q: state.Q,
        start_points: startPoints,
        t_span: [-state.streamlineTimeSpan, state.streamlineTimeSpan],
        direction: 'both',
      })

      if (response.success) {
        setStreamlines(response)
      } else {
        setError(response.error || '计算失败')
      }
    } catch (err) {
      setError('无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }, [state.P, state.Q, state.streamlineStartPoints, state.streamlineTimeSpan])

  // 获取保守场判定数据
  const fetchConservativeCheck = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await vectorFieldApi.checkConservative({
        P: state.P,
        Q: state.Q,
      })

      if (response.success) {
        setConservativeData(response)
      } else {
        setError(response.error || '计算失败')
      }
    } catch (err) {
      setError('无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }, [state.P, state.Q])

  // 获取势函数数据
  const fetchPotential = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await vectorFieldApi.findPotential({
        P: state.P,
        Q: state.Q,
      })

      if (response.success) {
        setPotentialData(response)
      } else {
        setError(response.error || '计算失败')
      }
    } catch (err) {
      setError('无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }, [state.P, state.Q])

  // 获取势函数等值线数据
  const fetchPotentialContour = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await vectorFieldApi.potentialContour({
        P: state.P,
        Q: state.Q,
        x_range: state.xRange,
        y_range: state.yRange,
        resolution: 50,
      })

      if (response.success) {
        setPotentialContour(response)
      } else {
        setPotentialContour(null)
      }
    } catch (err) {
      setPotentialContour(null)
    } finally {
      setLoading(false)
    }
  }, [state.P, state.Q, state.xRange, state.yRange])

  // 获取路径无关性验证数据
  const fetchPathIndependence = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await vectorFieldApi.verifyPathIndependence({
        P: state.P,
        Q: state.Q,
        start_point: state.startPoint,
        end_point: state.endPoint,
        num_points: 200,
      })

      if (response.success) {
        setPathIndependenceData(response)
      } else {
        setPathIndependenceData(null)
      }
    } catch (err) {
      setPathIndependenceData(null)
    } finally {
      setLoading(false)
    }
  }, [state.P, state.Q, state.startPoint, state.endPoint])

  // 构建路径配置
  const buildPathConfig = () => {
    const preset = pathPresets.find((p) => p.id === state.pathType)

    if (state.pathType === 'square') {
      // 正方形路径（多段）
      const r = 1
      return {
        type: 'segments' as const,
        segments: [
          { x: 't', y: `${-r}`, t_range: [-r, r] },
          { x: `${r}`, y: 't', t_range: [-r, r] },
          { x: 't', y: `${r}`, t_range: [r, -r] },
          { x: `${-r}`, y: 't', t_range: [r, -r] },
        ],
      }
    }

    if (preset && preset.parametric.x) {
      return {
        type: 'parametric' as const,
        x: preset.parametric.x,
        y: preset.parametric.y,
        t_range: preset.parametric.t_range,
      }
    }

    // 默认单位圆
    return {
      type: 'parametric' as const,
      x: 'cos(t)',
      y: 'sin(t)',
      t_range: [0, 2 * Math.PI],
    }
  }

  // 根据模式获取数据
  useEffect(() => {
    switch (state.mode) {
      case 'field':
        fetchVectorField()
        if (state.showStreamlines) {
          fetchStreamlines()
        } else {
          setStreamlines(null)
        }
        break
      case 'line_integral':
        fetchVectorField()
        fetchLineIntegral()
        break
      case 'greens_theorem':
        fetchGreensTheorem()
        // 格林公式也需要向量场数据用于显示
        fetchVectorField()
        break
      case 'flux':
        fetchVectorField()
        fetchLineIntegral()
        break
      case 'conservative':
        fetchVectorField()
        fetchConservativeCheck()
        fetchPotential()
        if (state.showContour) {
          fetchPotentialContour()
        } else {
          setPotentialContour(null)
        }
        if (state.showPathIndependence) {
          fetchPathIndependence()
        } else {
          setPathIndependenceData(null)
        }
        break
    }
  }, [
    state.mode,
    state.showStreamlines,
    state.showContour,
    state.P,
    state.Q,
    state.showPathIndependence,
    state.startPoint,
    state.endPoint,
  ])

  const handleStateChange = <K extends keyof VectorFieldState>(
    key: K,
    value: VectorFieldState[K]
  ) => {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  const applyPreset = (preset: VectorFieldPreset) => {
    setState((prev) => ({ ...prev, P: preset.P, Q: preset.Q }))
  }

  const formatNumber = (n: number): string => {
    if (Math.abs(n) < 0.001 && n !== 0) return n.toExponential(2)
    return n.toFixed(4)
  }

  // ============ 构建 Plotly 数据 ============

  // 构建向量场箭头（使用 useMemo 缓存）
  const buildVectorFieldData = useMemo((): PlotlyTrace[] => {
    if (!vectorFieldData || !vectorFieldData.vector_field) {
      return []
    }

    const plots: PlotlyTrace[] = []
    const { x, y, u, v, u_norm, v_norm } = vectorFieldData.vector_field

    // 防御性处理：如果 u_norm/v_norm 无效，使用 u/v
    const uData = Array.isArray(u_norm) ? u_norm : Array.isArray(u) ? u : []
    const vData = Array.isArray(v_norm) ? v_norm : Array.isArray(v) ? v : []

    // 构建箭头数据
    const lineX: (number | null)[] = []
    const lineY: (number | null)[] = []

    // 防御性检查：确保数组有效
    if (!Array.isArray(x) || !Array.isArray(uData) || !Array.isArray(vData)) {
      return plots
    }

    for (let i = 0; i < x.length; i++) {
      if (!Array.isArray(x[i]) || !Array.isArray(uData[i]) || !Array.isArray(vData[i])) {
        continue
      }
      const rowY = Array.isArray(y) && Array.isArray(y[i]) ? y[i] : null
      for (let j = 0; j < x[i].length; j++) {
        const px = x[i]?.[j]
        const py = rowY?.[j]
        const pu = uData[i]?.[j]
        const pv = vData[i]?.[j]

        // 防御性处理：检查是否为有效数字
        if (
          typeof px !== 'number' ||
          typeof py !== 'number' ||
          typeof pu !== 'number' ||
          typeof pv !== 'number' ||
          isNaN(px) ||
          isNaN(py) ||
          isNaN(pu) ||
          isNaN(pv)
        ) {
          continue
        }

        if (Math.abs(pu) > MIN_VECTOR_THRESHOLD || Math.abs(pv) > MIN_VECTOR_THRESHOLD) {
          const endX = px + pu * ARROW_SCALE
          const endY = py + pv * ARROW_SCALE

          // 主线段
          lineX.push(px, endX, null)
          lineY.push(py, endY, null)

          // 箭头头部
          const angle = Math.atan2(pv, pu)
          const headAngle1 = angle + Math.PI * 0.85
          const headAngle2 = angle - Math.PI * 0.85

          lineX.push(endX, endX + ARROW_HEAD_SIZE * Math.cos(headAngle1), null)
          lineY.push(endY, endY + ARROW_HEAD_SIZE * Math.sin(headAngle1), null)
          lineX.push(endX, endX + ARROW_HEAD_SIZE * Math.cos(headAngle2), null)
          lineY.push(endY, endY + ARROW_HEAD_SIZE * Math.sin(headAngle2), null)
        }
      }
    }

    plots.push({
      type: 'scatter',
      mode: 'lines',
      x: lineX,
      y: lineY,
      line: { color: '#059669', width: 1.5 },
      name: 'F(x, y)',
      hoverinfo: 'skip',
    })

    return plots
  }, [vectorFieldData])

  // 构建流线数据（使用 useMemo 缓存）
  const buildStreamlineData = useMemo((): PlotlyTrace[] => {
    if (!streamlines) return []

    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

    return streamlines.streamlines.map((streamline, idx) => {
      // 防御性处理：清理 NaN 值
      const cleanX = streamline.x.filter((v: number) => typeof v === 'number' && !isNaN(v))
      const cleanY = streamline.y.filter((v: number) => typeof v === 'number' && !isNaN(v))

      // 确保 x 和 y 长度一致
      const minLen = Math.min(cleanX.length, cleanY.length)

      return {
        type: 'scatter' as const,
        mode: 'lines' as const,
        x: cleanX.slice(0, minLen),
        y: cleanY.slice(0, minLen),
        line: { color: colors[idx % colors.length], width: 2 },
        name: `流线 ${idx + 1}`,
        hovertemplate: `起点: (${streamline.start_point.x}, ${streamline.start_point.y})<extra></extra>`,
      }
    })
  }, [streamlines])

  // 构建路径数据（使用 useMemo 缓存）
  const buildPathData = useMemo((): PlotlyTrace[] => {
    if (!lineIntegralData) return []

    const plots: PlotlyTrace[] = []

    // 防御性处理：清理路径数据中的 NaN 值
    const pathX = lineIntegralData.path.x.filter((v: number) => typeof v === 'number' && !isNaN(v))
    const pathY = lineIntegralData.path.y.filter((v: number) => typeof v === 'number' && !isNaN(v))

    // 确保 x 和 y 长度一致
    const minLen = Math.min(pathX.length, pathY.length)

    // 路径
    plots.push({
      type: 'scatter',
      mode: 'lines',
      x: pathX.slice(0, minLen),
      y: pathY.slice(0, minLen),
      line: { color: '#ef4444', width: 3 },
      name: '路径 C',
      fill: 'toself',
    })

    // 向量场沿路径的箭头
    if (lineIntegralData.field_data) {
      const { u_field, v_field } = lineIntegralData.field_data

      // 使用之前清理后的路径数据
      const arrowSkip = Math.max(1, Math.floor(pathX.length / PATH_ARROW_SKIP))
      const arrowX: (number | null)[] = []
      const arrowY: (number | null)[] = []

      for (let i = 0; i < pathX.length; i += arrowSkip) {
        const px = pathX[i]
        const py = pathY[i]
        const pu = u_field[i]
        const pv = v_field[i]

        // 防御性处理：检查是否为有效数字
        if (
          typeof px !== 'number' ||
          typeof py !== 'number' ||
          typeof pu !== 'number' ||
          typeof pv !== 'number' ||
          isNaN(px) ||
          isNaN(py) ||
          isNaN(pu) ||
          isNaN(pv)
        ) {
          continue
        }

        const mag = Math.sqrt(pu * pu + pv * pv)
        if (mag > MIN_VECTOR_THRESHOLD && isFinite(mag)) {
          const scale = 0.3
          const endX = px + (pu / mag) * scale
          const endY = py + (pv / mag) * scale

          arrowX.push(px, endX, null)
          arrowY.push(py, endY, null)
        }
      }

      plots.push({
        type: 'scatter',
        mode: 'lines',
        x: arrowX,
        y: arrowY,
        line: { color: '#f59e0b', width: 2 },
        name: 'F 沿路径',
        hoverinfo: 'skip',
      })
    }

    return plots
  }, [lineIntegralData])

  // 构建格林公式验证数据（使用 useMemo 缓存）
  const buildGreensTheoremData = useMemo((): PlotlyTrace[] => {
    const plots: PlotlyTrace[] = []

    // 向量场
    if (vectorFieldData) {
      plots.push(...buildVectorFieldData)
    }

    // 区域边界
    if (greensData) {
      plots.push({
        type: 'scatter',
        mode: 'lines',
        x: greensData.boundary.x,
        y: greensData.boundary.y,
        line: { color: '#ef4444', width: 3 },
        name: '边界 C',
        fill: 'toself',
        fillcolor: 'rgba(239, 68, 68, 0.1)',
      })
    }

    return plots
  }, [vectorFieldData, greensData, buildVectorFieldData])

  // 构建势函数等值线数据（使用 useMemo 缓存）
  const buildContourData = useMemo((): any[] => {
    if (!potentialContour || !potentialContour.success) return []

    const plots: any[] = []

    // 防御性处理：确保 z 数据是有效的 2D 数组
    const zData = potentialContour.z
    if (!Array.isArray(zData) || zData.length === 0 || !Array.isArray(zData[0])) {
      return plots
    }

    // 从后端返回的网格数据中提取 x 和 y 坐标
    // 后端使用 np.meshgrid 返回的 X 和 Y 是 2D 数组
    // X[i][j] = x_vals[j], Y[i][j] = y_vals[i]
    const numRows = zData.length
    const numCols = zData[0].length

    // 提取 x 坐标（取第一行的所有列）
    const xCoords: number[] = []
    if (Array.isArray(potentialContour.x) && potentialContour.x.length > 0) {
      if (Array.isArray(potentialContour.x[0])) {
        // x 是 2D 网格数据，取第一行
        const firstRow = potentialContour.x[0]
        for (let i = 0; i < firstRow.length; i++) {
          const val = firstRow[i]
          if (typeof val === 'number' && !isNaN(val)) {
            xCoords.push(val)
          }
        }
      } else {
        // x 是 1D 数据
        const x1d = potentialContour.x as unknown as number[]
        for (let i = 0; i < x1d.length; i++) {
          const val = x1d[i]
          if (typeof val === 'number' && !isNaN(val)) {
            xCoords.push(val)
          }
        }
      }
    }

    // 提取 y 坐标（取第一列的所有行）
    const yCoords: number[] = []
    if (Array.isArray(potentialContour.y) && potentialContour.y.length > 0) {
      if (Array.isArray(potentialContour.y[0])) {
        // y 是 2D 网格数据，取第一列
        for (let i = 0; i < potentialContour.y.length; i++) {
          const val = potentialContour.y[i]?.[0]
          if (typeof val === 'number' && !isNaN(val)) {
            yCoords.push(val)
          }
        }
      } else {
        // y 是 1D 数据
        const y1d = potentialContour.y as unknown as number[]
        for (let i = 0; i < y1d.length; i++) {
          const val = y1d[i]
          if (typeof val === 'number' && !isNaN(val)) {
            yCoords.push(val)
          }
        }
      }
    }

    // 确保 xCoords 和 yCoords 的长度与 zData 维度匹配
    // 如果提取失败，使用默认值生成坐标
    const effectiveX =
      xCoords.length === numCols ? xCoords : Array.from({ length: numCols }, (_, i) => i)
    const effectiveY =
      yCoords.length === numRows ? yCoords : Array.from({ length: numRows }, (_, i) => i)

    // 清理 zData 中的 NaN 值
    const cleanZ = zData.map((row: number[]) =>
      row.map((v: number) => (typeof v === 'number' && !isNaN(v) ? v : 0))
    )

    // 等值线数据
    plots.push({
      type: 'contour',
      x: effectiveX,
      y: effectiveY,
      z: cleanZ,
      contours: {
        coloring: 'lines',
        showlabels: true,
        labelfont: { size: 10, color: '#666' },
      },
      line: { color: '#8b5cf6', width: 1 },
      name: '势函数等值线',
      hoverinfo: 'z',
    })

    return plots
  }, [potentialContour])

  // 构建路径无关性图表数据（使用 useMemo 缓存）
  const buildPathIndependenceData = useMemo((): any[] => {
    if (!pathIndependenceData || !pathIndependenceData.success) {
      return []
    }

    const plots: any[] = []

    // 不同路径的颜色
    const pathColors = {
      straight: '#10b981', // 绿色 - 直线路径
      broken: '#f59e0b', // 橙色 - 折线路径
      parabola: '#8b5cf6', // 紫色 - 抛物线路径
    }

    // 绘制各路径
    if (pathIndependenceData.path_points) {
      for (const [pathType, points] of Object.entries(pathIndependenceData.path_points)) {
        if (points && (points.x as number[]).length > 0) {
          // 清理 NaN 值
          const cleanX: number[] = []
          const cleanY: number[] = []
          for (
            let i = 0;
            i < Math.min((points.x as number[]).length, (points.y as number[]).length);
            i++
          ) {
            const xVal = points.x[i]
            const yVal = points.y[i]
            if (
              typeof xVal === 'number' &&
              typeof yVal === 'number' &&
              !isNaN(xVal) &&
              !isNaN(yVal)
            ) {
              cleanX.push(xVal)
              cleanY.push(yVal)
            }
          }

          const pathName =
            pathIndependenceData.integrals.find((i) => i.path_type === pathType)?.path_name ||
            pathType
          plots.push({
            type: 'scatter',
            mode: 'lines',
            x: cleanX,
            y: cleanY,
            line: { color: pathColors[pathType as keyof typeof pathColors] || '#666', width: 2 },
            name: pathName,
            hovertemplate: `${pathName}<extra></extra>`,
          })
        }
      }
    }

    // 绘制起点和终点标记
    if (pathIndependenceData.start_point) {
      plots.push({
        type: 'scatter',
        mode: 'markers',
        x: [pathIndependenceData.start_point.x],
        y: [pathIndependenceData.start_point.y],
        marker: { color: '#10b981', size: 12, symbol: 'circle' },
        name: '起点',
        hovertemplate: `起点: (${pathIndependenceData.start_point.x.toFixed(2)}, ${pathIndependenceData.start_point.y.toFixed(2)})<extra></extra>`,
      })
    }

    if (pathIndependenceData.end_point) {
      plots.push({
        type: 'scatter',
        mode: 'markers',
        x: [pathIndependenceData.end_point.x],
        y: [pathIndependenceData.end_point.y],
        marker: { color: '#ef4444', size: 12, symbol: 'x' },
        name: '终点',
        hovertemplate: `终点: (${pathIndependenceData.end_point.x.toFixed(2)}, ${pathIndependenceData.end_point.y.toFixed(2)})<extra></extra>`,
      })
    }

    return plots
  }, [pathIndependenceData])

  // 构建保守场模式图表数据（使用 useMemo 缓存）
  const buildConservativeData = useMemo((): any[] => {
    const plots: any[] = []

    // 向量场
    if (vectorFieldData && buildVectorFieldData.length > 0) {
      plots.push(...buildVectorFieldData)
    }

    // 等值线
    if (state.showContour && potentialContour?.success) {
      plots.push(...buildContourData)
    }

    // 路径无关性路径
    if (state.showPathIndependence && pathIndependenceData?.success) {
      plots.push(...buildPathIndependenceData)
    }

    return plots
  }, [
    vectorFieldData,
    buildVectorFieldData,
    state.showContour,
    buildContourData,
    state.showPathIndependence,
    buildPathIndependenceData,
  ])

  // 构建图表数据（使用 useMemo 缓存）
  const buildPlotData = useMemo((): any[] => {
    switch (state.mode) {
      case 'field': {
        const fieldPlots = [...buildVectorFieldData]
        if (state.showStreamlines) {
          fieldPlots.push(...buildStreamlineData)
        }
        return fieldPlots
      }
      case 'line_integral':
        return [...buildVectorFieldData, ...buildPathData]
      case 'greens_theorem':
        return [...buildGreensTheoremData]
      case 'flux':
        return [...buildVectorFieldData, ...buildPathData]
      case 'conservative':
        return [...buildConservativeData]
      default:
        return buildVectorFieldData
    }
  }, [
    state.mode,
    state.showStreamlines,
    buildVectorFieldData,
    buildStreamlineData,
    buildPathData,
    buildGreensTheoremData,
    buildConservativeData,
  ])

  // 图表布局（使用 useMemo 缓存）
  const layout = useMemo(
    (): any => ({
      title: {
        text: `F(x,y) = (${state.P}, ${state.Q})`,
        font: { size: 14 },
      },
      xaxis: {
        title: 'x',
        range: state.xRange,
        scaleanchor: 'y',
        scaleratio: 1,
      },
      yaxis: {
        title: 'y',
        range: state.yRange,
      },
      hovermode: 'closest',
      margin: { t: 50, r: 50, b: 50, l: 50 },
      showlegend: true,
      legend: { x: 1.02, y: 1 },
    }),
    [state.P, state.Q, state.xRange, state.yRange]
  )

  return (
    <div className="detail-page">
      <PageHeader
        backTo="/subject/calculus"
        backLabel="返回微积分"
        breadcrumbs={[
          { label: '首页', path: '/' },
          { label: '微积分', path: '/subject/calculus' },
          { label: '向量场与线积分' },
        ]}
        title="向量场与线积分/面积分"
      />

      <div className="content-card" style={{ margin: '2rem auto', maxWidth: '1600px' }}>
        <div className="card-header">
          <h2>向量场与线积分可视化</h2>
          <p>探索向量场、流线、线积分、格林公式等概念</p>
        </div>

        {/* 模式选择标签 */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            className={`btn ${state.mode === 'field' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleStateChange('mode', 'field')}
          >
            向量场
          </button>
          <button
            className={`btn ${state.mode === 'line_integral' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleStateChange('mode', 'line_integral')}
          >
            线积分
          </button>
          <button
            className={`btn ${state.mode === 'greens_theorem' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleStateChange('mode', 'greens_theorem')}
          >
            格林公式
          </button>
          <button
            className={`btn ${state.mode === 'flux' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleStateChange('mode', 'flux')}
          >
            通量
          </button>
          <button
            className={`btn ${state.mode === 'conservative' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleStateChange('mode', 'conservative')}
          >
            保守场
          </button>
        </div>

        {/* 控制面板 */}
        <div
          style={{
            background: 'var(--background)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
            }}
          >
            {/* 向量场输入 */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>P(x, y) =</label>
              <input
                type="text"
                value={state.P}
                onChange={(e) => handleStateChange('P', e.target.value)}
                placeholder="例如: -y"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Q(x, y) =</label>
              <input
                type="text"
                value={state.Q}
                onChange={(e) => handleStateChange('Q', e.target.value)}
                placeholder="例如: x"
              />
            </div>

            {/* 范围 */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>x 范围</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  step="0.5"
                  value={state.xRange[0]}
                  onChange={(e) =>
                    handleStateChange('xRange', [parseFloat(e.target.value) || -3, state.xRange[1]])
                  }
                />
                <span style={{ alignSelf: 'center' }}>~</span>
                <input
                  type="number"
                  step="0.5"
                  value={state.xRange[1]}
                  onChange={(e) =>
                    handleStateChange('xRange', [state.xRange[0], parseFloat(e.target.value) || 3])
                  }
                />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>y 范围</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  step="0.5"
                  value={state.yRange[0]}
                  onChange={(e) =>
                    handleStateChange('yRange', [parseFloat(e.target.value) || -3, state.yRange[1]])
                  }
                />
                <span style={{ alignSelf: 'center' }}>~</span>
                <input
                  type="number"
                  step="0.5"
                  value={state.yRange[1]}
                  onChange={(e) =>
                    handleStateChange('yRange', [state.yRange[0], parseFloat(e.target.value) || 3])
                  }
                />
              </div>
            </div>
          </div>

          {/* 预设向量场 */}
          <div style={{ marginTop: '1rem' }}>
            <label
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.5rem',
                display: 'block',
              }}
            >
              预设向量场
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {vectorFieldPresets.map((preset) => (
                <button
                  key={preset.id}
                  className="btn btn-secondary"
                  onClick={() => applyPreset(preset)}
                  style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                  title={preset.description}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* 根据模式显示额外控制 */}
          {(state.mode === 'line_integral' || state.mode === 'flux') && (
            <div style={{ marginTop: '1rem' }}>
              <label
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.5rem',
                  display: 'block',
                }}
              >
                积分路径
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {pathPresets.map((preset) => (
                  <button
                    key={preset.id}
                    className={`btn ${state.pathType === preset.id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleStateChange('pathType', preset.id as PathType)}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {state.mode === 'greens_theorem' && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>区域类型</label>
                <select
                  value={state.regionType}
                  onChange={(e) => handleStateChange('regionType', e.target.value as RegionType)}
                >
                  <option value="circle">圆形</option>
                  <option value="rectangle">矩形</option>
                </select>
              </div>
              {state.regionType === 'circle' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>半径</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={state.regionRadius}
                    onChange={(e) =>
                      handleStateChange('regionRadius', parseFloat(e.target.value) || 1)
                    }
                  />
                </div>
              )}
            </div>
          )}

          {/* 流线选项 */}
          {state.mode === 'field' && (
            <div
              style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}
            >
              <label
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={state.showStreamlines}
                  onChange={(e) => handleStateChange('showStreamlines', e.target.checked)}
                />
                显示流线
              </label>
            </div>
          )}

          {/* 保守场选项 */}
          {state.mode === 'conservative' && (
            <div
              style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}
            >
              <label
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={state.showContour}
                  onChange={(e) => handleStateChange('showContour', e.target.checked)}
                />
                显示势函数等值线
              </label>
              <label
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={state.showPathIndependence}
                  onChange={(e) => handleStateChange('showPathIndependence', e.target.checked)}
                />
                路径无关性验证
              </label>
            </div>
          )}

          {/* 路径无关性参数 */}
          {state.mode === 'conservative' && state.showPathIndependence && (
            <div
              style={{
                marginTop: '1rem',
                padding: '1rem',
                background: 'var(--background)',
                borderRadius: '8px',
              }}
            >
              <h5 style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>路径端点设置</h5>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    起点 (x, y)
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="number"
                      value={state.startPoint[0]}
                      onChange={(e) =>
                        handleStateChange('startPoint', [
                          parseFloat(e.target.value) || 0,
                          state.startPoint[1],
                        ])
                      }
                      style={{
                        width: '80px',
                        padding: '0.5rem',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                      }}
                      step="0.1"
                    />
                    <input
                      type="number"
                      value={state.startPoint[1]}
                      onChange={(e) =>
                        handleStateChange('startPoint', [
                          state.startPoint[0],
                          parseFloat(e.target.value) || 0,
                        ])
                      }
                      style={{
                        width: '80px',
                        padding: '0.5rem',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                      }}
                      step="0.1"
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    终点 (x, y)
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="number"
                      value={state.endPoint[0]}
                      onChange={(e) =>
                        handleStateChange('endPoint', [
                          parseFloat(e.target.value) || 0,
                          state.endPoint[1],
                        ])
                      }
                      style={{
                        width: '80px',
                        padding: '0.5rem',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                      }}
                      step="0.1"
                    />
                    <input
                      type="number"
                      value={state.endPoint[1]}
                      onChange={(e) =>
                        handleStateChange('endPoint', [
                          state.endPoint[0],
                          parseFloat(e.target.value) || 0,
                        ])
                      }
                      style={{
                        width: '80px',
                        padding: '0.5rem',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                      }}
                      step="0.1"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 错误信息 */}
        {error && (
          <div style={{ marginBottom: '1rem' }}>
            <ErrorState message={error} />
          </div>
        )}

        {/* 可视化区域 */}
        {loading && !vectorFieldData && !greensData && (
          <LoadingState text="正在计算向量场数据..." />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
          {/* Plotly 图表 */}
          <div style={{ background: '#fff', borderRadius: '8px', padding: '0.5rem' }}>
            <Plot
              data={buildPlotData as any}
              layout={layout}
              config={{ responsive: true, scrollZoom: true, displayModeBar: true }}
              style={{ width: '100%', height: '600px' }}
            />
          </div>

          {/* 信息面板 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* 旋度和散度信息 */}
            {vectorFieldData && (
              <div className="info-panel">
                <h4>向量场性质</h4>
                <div className="info-item">
                  <span>旋度 curl(F)</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {vectorFieldData.curl.expression}
                  </span>
                </div>
                <div className="info-item">
                  <span>散度 div(F)</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {vectorFieldData.divergence.expression}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: '0.875rem',
                    marginTop: '0.5rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  curl(F) = ∂Q/∂x - ∂P/∂y
                  <br />
                  div(F) = ∂P/∂x + ∂Q/∂y
                </p>
              </div>
            )}

            {/* 线积分结果 */}
            {lineIntegralData && (state.mode === 'line_integral' || state.mode === 'flux') && (
              <>
                <div
                  className="info-panel"
                  style={{
                    background: 'rgba(16, 185, 129, 0.05)',
                    borderColor: 'rgba(16, 185, 129, 0.2)',
                  }}
                >
                  <h4>线积分结果</h4>
                  <div className="info-item">
                    <span>∫_C F·dr</span>
                    <span>{formatNumber(lineIntegralData.integral_value)}</span>
                  </div>
                  <p
                    style={{
                      fontSize: '0.875rem',
                      marginTop: '0.5rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    ∫_C P dx + Q dy = {formatNumber(lineIntegralData.integral_value)}
                  </p>
                </div>

                <div
                  className="info-panel"
                  style={{
                    background: 'rgba(139, 92, 246, 0.05)',
                    borderColor: 'rgba(139, 92, 246, 0.2)',
                  }}
                >
                  <h4>通量计算结果</h4>
                  <div className="info-item">
                    <span>∫_C F·n ds</span>
                    <span>{formatNumber(lineIntegralData.flux_value)}</span>
                  </div>
                  <p
                    style={{
                      fontSize: '0.875rem',
                      marginTop: '0.5rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    穿过曲线的通量 = {formatNumber(lineIntegralData.flux_value)}
                  </p>
                </div>
              </>
            )}

            {/* 格林公式验证结果 */}
            {greensData && state.mode === 'greens_theorem' && (
              <div
                className="info-panel"
                style={{
                  background: greensData.greens_theorem.is_verified
                    ? 'rgba(16, 185, 129, 0.05)'
                    : 'rgba(239, 68, 68, 0.05)',
                  borderColor: greensData.greens_theorem.is_verified
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(239, 68, 68, 0.2)',
                }}
              >
                <h4>格林公式验证</h4>
                <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  ∮_C P dx + Q dy = ∬_D (∂Q/∂x - ∂P/∂y) dA
                </div>
                <div className="info-item">
                  <span>左边（线积分）</span>
                  <span>{formatNumber(greensData.greens_theorem.left_side.value)}</span>
                </div>
                <div className="info-item">
                  <span>右边（面积分）</span>
                  <span>{formatNumber(greensData.greens_theorem.right_side.value)}</span>
                </div>
                <div className="info-item">
                  <span>差异</span>
                  <span>{formatNumber(greensData.greens_theorem.difference)}</span>
                </div>
                <div className="info-item">
                  <span>相对误差</span>
                  <span>{(greensData.greens_theorem.relative_error * 100).toFixed(2)}%</span>
                </div>
                <p
                  style={{
                    fontSize: '0.875rem',
                    marginTop: '0.5rem',
                    fontWeight: 'bold',
                    color: greensData.greens_theorem.is_verified ? '#10b981' : '#ef4444',
                  }}
                >
                  {greensData.greens_theorem.is_verified
                    ? '✓ 格林公式验证通过'
                    : '✗ 验证失败（可能由于数值误差）'}
                </p>
              </div>
            )}

            {/* 保守场分析结果 */}
            {conservativeData && state.mode === 'conservative' && (
              <div
                className="info-panel"
                style={{
                  background: conservativeData.is_conservative
                    ? 'rgba(16, 185, 129, 0.05)'
                    : 'rgba(239, 68, 68, 0.05)',
                  borderColor: conservativeData.is_conservative
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(239, 68, 68, 0.2)',
                }}
              >
                <h4>保守场判定</h4>
                <div className="info-item">
                  <span>旋度 curl(F)</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {conservativeData.curl_expression}
                  </span>
                </div>
                <div className="info-item">
                  <span>旋度值</span>
                  <span>{conservativeData.curl_value.toFixed(4)}</span>
                </div>
                <p
                  style={{
                    fontSize: '0.875rem',
                    marginTop: '0.5rem',
                    fontWeight: 'bold',
                    color: conservativeData.is_conservative ? '#10b981' : '#ef4444',
                  }}
                >
                  {conservativeData.is_conservative ? '✓ 该向量场是保守场' : '✗ 该向量场不是保守场'}
                </p>
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginTop: '0.25rem',
                  }}
                >
                  {conservativeData.is_conservative
                    ? '沿任意闭合路径积分为零'
                    : '旋度不为零，存在环流'}
                </p>
              </div>
            )}

            {/* 势函数结果 */}
            {potentialData && state.mode === 'conservative' && (
              <div
                className="info-panel"
                style={{
                  background: potentialData.is_conservative
                    ? 'rgba(139, 92, 246, 0.05)'
                    : undefined,
                  borderColor: potentialData.is_conservative
                    ? 'rgba(139, 92, 246, 0.2)'
                    : undefined,
                }}
              >
                <h4>势函数</h4>
                {potentialData.is_conservative ? (
                  <>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.9rem',
                          display: 'block',
                          padding: '0.5rem',
                          background: 'var(--background)',
                          borderRadius: '4px',
                        }}
                      >
                        f(x, y) = {potentialData.potential_function}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <div>∂f/∂x = {potentialData.grad_x}</div>
                      <div>∂f/∂y = {potentialData.grad_y}</div>
                    </div>
                    <p
                      style={{
                        fontSize: '0.875rem',
                        marginTop: '0.5rem',
                        color: potentialData.matches_field ? '#10b981' : '#f59e0b',
                      }}
                    >
                      {potentialData.matches_field ? '✓ 验证通过：∇f = F' : '⚠ 部分验证通过'}
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {potentialData.error || '该向量场不是保守场，不存在势函数'}
                  </p>
                )}
              </div>
            )}

            {/* 路径无关性验证结果 */}
            {pathIndependenceData &&
              state.mode === 'conservative' &&
              state.showPathIndependence && (
                <div
                  className="info-panel"
                  style={{
                    background: pathIndependenceData.is_independent
                      ? 'rgba(16, 185, 129, 0.05)'
                      : pathIndependenceData.is_conservative
                        ? 'rgba(245, 158, 11, 0.05)'
                        : 'rgba(239, 68, 68, 0.05)',
                    borderColor: pathIndependenceData.is_independent
                      ? 'rgba(16, 185, 129, 0.2)'
                      : pathIndependenceData.is_conservative
                        ? 'rgba(245, 158, 11, 0.2)'
                        : 'rgba(239, 68, 68, 0.2)',
                  }}
                >
                  <h4>路径无关性验证</h4>
                  <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    <div>
                      起点: ({pathIndependenceData.start_point.x.toFixed(2)},{' '}
                      {pathIndependenceData.start_point.y.toFixed(2)})
                    </div>
                    <div>
                      终点: ({pathIndependenceData.end_point.x.toFixed(2)},{' '}
                      {pathIndependenceData.end_point.y.toFixed(2)})
                    </div>
                  </div>
                  {pathIndependenceData.integrals.map((integral, idx) => (
                    <div key={idx} className="info-item" style={{ marginBottom: '0.25rem' }}>
                      <span>{integral.path_name}</span>
                      <span>{formatNumber(integral.value)}</span>
                    </div>
                  ))}
                  <div
                    style={{
                      marginTop: '0.5rem',
                      borderTop: '1px solid var(--border)',
                      paddingTop: '0.5rem',
                    }}
                  >
                    {pathIndependenceData.differences.map((diff, idx) => (
                      <div
                        key={idx}
                        style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                      >
                        {diff.pair}: Δ = {formatNumber(diff.difference)}
                      </div>
                    ))}
                  </div>
                  <p
                    style={{
                      fontSize: '0.875rem',
                      marginTop: '0.5rem',
                      fontWeight: 'bold',
                      color: pathIndependenceData.is_independent
                        ? '#10b981'
                        : pathIndependenceData.is_conservative
                          ? '#f59e0b'
                          : '#ef4444',
                    }}
                  >
                    {pathIndependenceData.is_independent
                      ? '✓ 路径无关性验证成功：各路径积分值相等'
                      : pathIndependenceData.is_conservative
                        ? '⚠ 保守场假设下各路径积分应相等'
                        : '✗ 该向量场不是保守场'}
                  </p>
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      marginTop: '0.25rem',
                    }}
                  >
                    {pathIndependenceData.message}
                  </p>
                </div>
              )}

            {/* 图例说明 */}
            <div className="info-panel">
              <h4>图例说明</h4>
              <div style={{ fontSize: '0.875rem' }}>
                <p>
                  <span style={{ color: '#059669' }}>—</span> 向量场 F(x, y)
                  <br />
                  <span style={{ color: '#ef4444' }}>—</span> 积分路径 C<br />
                  <span style={{ color: '#f59e0b' }}>—</span> F 沿路径的向量
                </p>
              </div>
            </div>

            {/* 数学公式说明 */}
            <div className="info-panel">
              <h4>数学公式</h4>
              <div style={{ fontSize: '0.875rem', fontFamily: 'monospace' }}>
                <p>
                  <strong>线积分：</strong> ∫_C F·dr
                </p>
                <p>
                  <strong>通量：</strong> ∫_C F·n ds
                </p>
                <p>
                  <strong>格林公式：</strong>
                  <br />
                  ∮_C P dx + Q dy = ∬_D (∂Q/∂x - ∂P/∂y) dA
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
