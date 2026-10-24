import { useState, useEffect, useCallback, useRef } from 'react'
import Plot from 'react-plotly.js'
import { calculusApi, DerivativeRequest, SecantRequest } from '../services/api'
import { debounce } from '../utils/timing'
import { isValidFunctionExpression } from '../utils/math'
import { extendDomain } from '../utils/plot'
import PageHeader from '../components/PageHeader'
import ControlPanel from '../components/ControlPanel'
import VisualizationCard from '../components/VisualizationCard'
import TabBar from '../components/TabBar'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import VisualizationWorkspace from '../components/VisualizationWorkspace'
import CollapsibleSection from '../components/CollapsibleSection'

interface DerivativeData {
  function_curve: { x: number[]; y: (number | null)[] }
  tangent_line: {
    x: number[]
    y: number[]
    slope: number
    intercept: number
    equation: string
  }
  normal_line: {
    x: number[]
    y: number[]
    slope: number
    equation: string
  }
  point: { x: number; y: number }
  derivative: { value: number; expression: string }
  analysis: {
    differentiable: boolean
    first_derivative: {
      expression: string
      value: number | null
      sign: 'positive' | 'negative' | 'zero'
    }
    second_derivative: {
      expression: string
      value: number | null
      concavity: 'concave_up' | 'concave_down' | 'linear'
    }
    curvature: number
    critical_point: boolean
    local_extrema: 'local_min' | 'local_max' | null
    monotonicity: string
    slope_triangle: {
      x0: number
      y0: number
      x1: number
      y1: number
      x2: number
      y2: number
    } | null
  }
  critical_points: Array<{ x: number; y: number; type: 'local_min' | 'local_max' | 'stationary' }>
  domain_range: number[]
}

interface SecantData {
  function_curve: { x: number[]; y: (number | null)[] }
  point: { x: number; y: number }
  secants: Array<{
    h: number
    x1: number
    f_x1: number
    slope: number
    x: number[]
    y: number[]
  }>
  tangent: { x: number[]; y: number[]; slope: number }
  steps: Array<{ index: number; h: number; slope: number; error: number; description: string }>
  animation: { total_frames: number; h_values: number[]; target_slope: number }
  domain_range: number[]
}

interface LinearApproxData {
  function_curve: { x: number[]; y: (number | null)[] }
  linear_approximation: {
    x: number[]
    y: number[]
    slope: number
    intercept: number
    equation: string
  }
  error_curve: { x: number[]; y: (number | null)[] }
  error_area: { x: number[]; y: (number | null)[] }
  error_estimate: {
    max_second_derivative: number
    error_bound_formula: string
    error_bound_values: number[]
    x_values: number[]
  }
  point: { x: number; y: number }
  analysis: DerivativeData['analysis']
  domain_range: number[]
}

interface HigherDerivativeData {
  function: string
  x0: number
  curves: Array<{
    order: number
    name: string
    expression: string
    value_at_x0: number
    sign_summary: string
    x: number[]
    y: (number | null)[]
  }>
  domain_range: number[]
}

interface DerivativeExample {
  name: string
  function: string
  x0: number
  description: string
  domain_range: [number, number]
}

const EXAMPLES: DerivativeExample[] = [
  {
    name: '抛物线 x²',
    function: 'x**2',
    x0: 2,
    description: "f'(2) = 4，切线斜率为正",
    domain_range: [-1, 4],
  },
  {
    name: '正弦 sin(x)',
    function: 'sin(x)',
    x0: 0,
    description: "f'(0) = 1，水平切线临界点",
    domain_range: [-3, 3],
  },
  {
    name: '立方 x³ - 3x',
    function: 'x**3 - 3*x',
    x0: 1,
    description: "f'(1) = 0，局部极小值",
    domain_range: [-2, 3],
  },
  {
    name: '指数 e^x',
    function: 'exp(x)',
    x0: 0,
    description: "f'(0) = 1，函数与导数相等",
    domain_range: [-2, 2],
  },
  {
    name: '绝对值 |x|',
    function: 'abs(x)',
    x0: 0,
    description: 'x=0 处不可导，左右切线不同',
    domain_range: [-2, 2],
  },
]

const defaultRequest: DerivativeRequest = {
  function: 'x**2',
  x0: 2,
  domain_range: [-1, 4],
}

const defaultHValues = [1, 0.5, 0.2, 0.1, 0.05, 0.01, 0.005, 0.001]

const TABS = [
  { key: 'tangent', label: '切线与法线' },
  { key: 'secant', label: '割线逼近' },
  { key: 'linear', label: '局部线性近似' },
  { key: 'higher', label: '高阶导数' },
]

const STEPS = [
  {
    title: '割线斜率',
    description: '在 (x₀, f(x₀)) 附近取一点 (x₀+h, f(x₀+h))，连接两点的直线称为割线。',
  },
  {
    title: '让 h → 0',
    description: '当 h 越来越小时，割线逐渐贴近曲线在 x₀ 处的局部形状。',
  },
  {
    title: '得到切线',
    description: '割线的极限位置就是切线，其斜率即为函数在 x₀ 处的瞬时变化率。',
  },
  {
    title: '导数的定义',
    description: "f'(x₀) = lim(h→0) [f(x₀+h) - f(x₀)] / h，表示切线的斜率。",
  },
]

export default function DerivativeTangent() {
  const [activeMode, setActiveMode] = useState<'tangent' | 'secant' | 'linear' | 'higher'>(
    'tangent'
  )
  const [request, setRequest] = useState<DerivativeRequest>(defaultRequest)
  const [hValues] = useState<number[]>(defaultHValues)
  const [tangentData, setTangentData] = useState<DerivativeData | null>(null)
  const [secantData, setSecantData] = useState<SecantData | null>(null)
  const [linearData, setLinearData] = useState<LinearApproxData | null>(null)
  const [higherData, setHigherData] = useState<HigherDerivativeData | null>(null)
  const [secantIndex, setSecantIndex] = useState(0)
  const [isSecantPlaying, setIsSecantPlaying] = useState(false)
  const [secantSpeed, setSecantSpeed] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentRange, setCurrentRange] = useState<[number, number]>([-1, 4])
  const [activeStep, setActiveStep] = useState(0)
  const [magnifierEnabled, setMagnifierEnabled] = useState(false)
  const [magnifierZoom, setMagnifierZoom] = useState(4)
  const [isUpdating, setIsUpdating] = useState(false)
  const [visibleHigherCurves, setVisibleHigherCurves] = useState<Set<number>>(new Set([0, 1, 2]))
  const secantTimerRef = useRef<NodeJS.Timeout | null>(null)
  const secantIndexRef = useRef<number>(0)
  const plotRef = useRef<any>(null)

  const fetchTangentData = useCallback(
    async (range?: [number, number], isManual = false) => {
      if (!isValidFunctionExpression(request.function)) {
        if (isManual) setError('请输入有效的函数表达式（包含变量 x）')
        setIsUpdating(false)
        return
      }

      setIsUpdating(true)
      setError(null)
      const activeRange = range || request.domain_range
      const extendedRange = extendDomain(activeRange as [number, number])
      try {
        const response = await calculusApi.derivative({
          ...request,
          domain_range: extendedRange,
        })
        if (response.success) {
          setTangentData(response.data)
          setCurrentRange(activeRange as [number, number])
        } else {
          if (isManual) setError(response.error || '函数表达式无效，请检查语法')
        }
      } catch (err: any) {
        if (isManual) setError('无法解析函数表达式，请检查输入')
      } finally {
        setLoading(false)
        setIsUpdating(false)
      }
    },
    [request]
  )

  const fetchSecantData = useCallback(
    async (range?: [number, number], isManual = false) => {
      if (!isValidFunctionExpression(request.function)) {
        if (isManual) setError('请输入有效的函数表达式（包含变量 x）')
        setIsUpdating(false)
        return
      }

      setIsUpdating(true)
      setError(null)
      const activeRange = range || request.domain_range
      const extendedRange = extendDomain(activeRange as [number, number])
      try {
        const secantRequest: SecantRequest = {
          function: request.function,
          x0: request.x0,
          h_values: hValues,
          domain_range: extendedRange,
        }
        const response = await calculusApi.secantApproximation(secantRequest)
        if (response.success) {
          setSecantData(response.data)
          setSecantIndex(0)
          setCurrentRange(activeRange as [number, number])
        } else {
          if (isManual) setError(response.error || '函数表达式无效，请检查语法')
        }
      } catch (err: any) {
        if (isManual) setError('无法解析函数表达式，请检查输入')
      } finally {
        setLoading(false)
        setIsUpdating(false)
      }
    },
    [request, hValues]
  )

  const fetchLinearData = useCallback(
    async (range?: [number, number], isManual = false) => {
      if (!isValidFunctionExpression(request.function)) {
        if (isManual) setError('请输入有效的函数表达式（包含变量 x）')
        setIsUpdating(false)
        return
      }

      setIsUpdating(true)
      setError(null)
      const activeRange = range || request.domain_range
      const extendedRange = extendDomain(activeRange as [number, number])
      try {
        const response = await calculusApi.linearApproximation({
          function: request.function,
          x0: request.x0,
          domain_range: extendedRange,
        })
        if (response.success) {
          setLinearData(response.data)
          setCurrentRange(activeRange as [number, number])
        } else {
          if (isManual) setError(response.error || '函数表达式无效，请检查语法')
        }
      } catch (err: any) {
        if (isManual) setError('无法解析函数表达式，请检查输入')
      } finally {
        setLoading(false)
        setIsUpdating(false)
      }
    },
    [request]
  )

  const fetchHigherData = useCallback(
    async (range?: [number, number], isManual = false) => {
      if (!isValidFunctionExpression(request.function)) {
        if (isManual) setError('请输入有效的函数表达式（包含变量 x）')
        setIsUpdating(false)
        return
      }

      setIsUpdating(true)
      setError(null)
      const activeRange = range || request.domain_range
      const extendedRange = extendDomain(activeRange as [number, number])
      try {
        const response = await calculusApi.higherDerivatives({
          function: request.function,
          x0: request.x0,
          order: 3,
          domain_range: extendedRange,
        })
        if (response.success) {
          setHigherData(response.data)
          setCurrentRange(activeRange as [number, number])
        } else {
          if (isManual) setError(response.error || '函数表达式无效，请检查语法')
        }
      } catch (err: any) {
        if (isManual) setError('无法解析函数表达式，请检查输入')
      } finally {
        setLoading(false)
        setIsUpdating(false)
      }
    },
    [request]
  )

  useEffect(() => {
    setLoading(true)
    fetchTangentData(undefined, true)
    fetchSecantData(undefined, true)
    fetchLinearData(undefined, true)
    fetchHigherData(undefined, true)
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchTangentData(undefined, true)
    fetchSecantData(undefined, true)
    fetchLinearData(undefined, true)
    fetchHigherData(undefined, true)
  }, [request.function, request.x0])

  useEffect(() => {
    setLoading(true)
    switch (activeMode) {
      case 'tangent':
        fetchTangentData(undefined, true)
        break
      case 'secant':
        fetchSecantData(undefined, true)
        break
      case 'linear':
        fetchLinearData(undefined, true)
        break
      case 'higher':
        fetchHigherData(undefined, true)
        break
    }
  }, [activeMode])

  // 割线动画播放
  useEffect(() => {
    if (!isSecantPlaying || !secantData) return
    if (secantIndexRef.current >= secantData.secants.length - 1) {
      setIsSecantPlaying(false)
      return
    }

    const interval = Math.max(80, 400 / secantSpeed)
    secantTimerRef.current = setInterval(() => {
      const current = secantIndexRef.current
      if (current >= (secantData?.secants.length || 1) - 1) {
        setIsSecantPlaying(false)
        return
      }
      setSecantIndex(current + 1)
    }, interval)

    return () => {
      if (secantTimerRef.current) clearInterval(secantTimerRef.current)
    }
  }, [isSecantPlaying, secantData, secantSpeed])

  // 数据切换时重置割线动画
  useEffect(() => {
    setSecantIndex(0)
    secantIndexRef.current = 0
    setIsSecantPlaying(false)
  }, [secantData])

  // 同步 secantIndexRef 与状态
  useEffect(() => {
    secantIndexRef.current = secantIndex
  }, [secantIndex])

  const handleRelayoutCore = useCallback(
    (newXRange: [number, number], rangeType: 'tangent' | 'secant' | 'linear' | 'higher') => {
      const currentWidth = currentRange[1] - currentRange[0]
      const newWidth = newXRange[1] - newXRange[0]
      const centerDiff = Math.abs(
        (currentRange[0] + currentRange[1]) / 2 - (newXRange[0] + newXRange[1]) / 2
      )

      if (newWidth > currentWidth * 1.2 || centerDiff > currentWidth * 0.3) {
        switch (rangeType) {
          case 'tangent':
            fetchTangentData(newXRange)
            break
          case 'secant':
            fetchSecantData(newXRange)
            break
          case 'linear':
            fetchLinearData(newXRange)
            break
          case 'higher':
            fetchHigherData(newXRange)
            break
        }
      }
    },
    [currentRange, fetchTangentData, fetchSecantData, fetchLinearData, fetchHigherData]
  )

  const handleRelayout = useCallback(
    debounce((event: any, rangeType: 'tangent' | 'secant' | 'linear' | 'higher') => {
      if (!event['xaxis.range[0]'] || !event['xaxis.range[1]']) return
      const newXRange: [number, number] = [event['xaxis.range[0]'], event['xaxis.range[1]']]
      handleRelayoutCore(newXRange, rangeType)
    }, 300),
    [handleRelayoutCore]
  )

  const handleInputChange = (field: keyof DerivativeRequest, value: any) => {
    setRequest((prev) => ({ ...prev, [field]: value }))
  }

  const applyExample = (example: DerivativeExample) => {
    setRequest({
      function: example.function,
      x0: example.x0,
      domain_range: example.domain_range,
    })
  }

  const toggleSecantPlay = () => {
    if (!secantData) return
    if (secantIndexRef.current >= secantData.secants.length - 1) {
      setSecantIndex(0)
      secantIndexRef.current = 0
    }
    setIsSecantPlaying((prev) => !prev)
  }

  const resetSecantAnimation = () => {
    setIsSecantPlaying(false)
    setSecantIndex(0)
    secantIndexRef.current = 0
  }

  const toggleHigherCurve = (order: number) => {
    setVisibleHigherCurves((prev) => {
      const next = new Set(prev)
      if (next.has(order)) {
        next.delete(order)
      } else {
        next.add(order)
      }
      return next
    })
  }

  // 切线模式：绘制函数、切线、法线、切点、斜率三角形、临界点
  const tangentPlotData: any[] = tangentData
    ? [
        {
          x: tangentData.function_curve.x,
          y: tangentData.function_curve.y,
          type: 'scatter',
          mode: 'lines',
          name: 'f(x)',
          line: { color: '#4f46e5', width: 2.5 },
          hovertemplate: 'f(%{x:.3f}) = %{y:.3f}<extra></extra>',
        },
        {
          x: tangentData.tangent_line.x,
          y: tangentData.tangent_line.y,
          type: 'scatter',
          mode: 'lines',
          name: '切线',
          line: { color: '#ef4444', width: 2.5 },
          hoverinfo: 'name',
        },
        {
          x: tangentData.normal_line.x,
          y: tangentData.normal_line.y,
          type: 'scatter',
          mode: 'lines',
          name: '法线',
          line: { color: '#10b981', width: 2, dash: 'dash' },
          hoverinfo: 'name',
        },
        // 斜率三角形
        ...(tangentData.analysis.slope_triangle
          ? [
              {
                x: [
                  tangentData.analysis.slope_triangle.x0,
                  tangentData.analysis.slope_triangle.x1,
                  tangentData.analysis.slope_triangle.x2,
                  tangentData.analysis.slope_triangle.x0,
                ],
                y: [
                  tangentData.analysis.slope_triangle.y0,
                  tangentData.analysis.slope_triangle.y1,
                  tangentData.analysis.slope_triangle.y2,
                  tangentData.analysis.slope_triangle.y0,
                ],
                type: 'scatter',
                mode: 'lines',
                name: '斜率三角形',
                line: { color: '#f59e0b', width: 1.5 },
                fill: 'toself',
                fillcolor: 'rgba(245, 158, 11, 0.12)',
                hoverinfo: 'name',
              },
            ]
          : []),
        // 临界点
        ...(tangentData.critical_points.length > 0
          ? [
              {
                x: tangentData.critical_points.map((p) => p.x),
                y: tangentData.critical_points.map((p) => p.y),
                type: 'scatter',
                mode: 'markers',
                name: '临界点',
                marker: {
                  color: tangentData.critical_points.map((p) =>
                    p.type === 'local_min'
                      ? '#10b981'
                      : p.type === 'local_max'
                        ? '#ef4444'
                        : '#f59e0b'
                  ),
                  size: 10,
                  symbol: 'diamond',
                },
                hovertemplate: '%{text}<br>x=%{x:.3f}, y=%{y:.3f}<extra></extra>',
                text: tangentData.critical_points.map((p) =>
                  p.type === 'local_min' ? '局部极小' : p.type === 'local_max' ? '局部极大' : '驻点'
                ),
              },
            ]
          : []),
        {
          x: [tangentData.point.x],
          y: [tangentData.point.y],
          type: 'scatter',
          mode: 'markers',
          name: '切点',
          marker: {
            color: '#ef4444',
            size: 14,
            symbol: 'circle',
            line: { color: '#ffffff', width: 2 },
          },
          hovertemplate: '切点 (%{x:.3f}, %{y:.3f})<extra></extra>',
        },
      ]
    : []

  // 割线模式
  const secantPlotData: any[] = secantData
    ? [
        {
          x: secantData.function_curve.x,
          y: secantData.function_curve.y,
          type: 'scatter',
          mode: 'lines',
          name: 'f(x)',
          line: { color: '#4f46e5', width: 2.5 },
          hoverinfo: 'name',
        },
        {
          x: secantData.secants[secantIndex]?.x || [],
          y: secantData.secants[secantIndex]?.y || [],
          type: 'scatter',
          mode: 'lines',
          name: `割线 (h=${secantData.secants[secantIndex]?.h})`,
          line: { color: '#f59e0b', width: 2.5 },
          hoverinfo: 'name',
        },
        {
          x: secantData.tangent.x,
          y: secantData.tangent.y,
          type: 'scatter',
          mode: 'lines',
          name: '切线 (h→0)',
          line: { color: '#ef4444', width: 2.5, dash: 'dot' },
          opacity: 0.8,
          hoverinfo: 'name',
        },
        {
          x: [secantData.point.x],
          y: [secantData.point.y],
          type: 'scatter',
          mode: 'markers',
          name: '目标点',
          marker: {
            color: '#ef4444',
            size: 14,
            symbol: 'circle',
            line: { color: '#ffffff', width: 2 },
          },
          hoverinfo: 'name',
        },
        {
          x: [secantData.secants[secantIndex]?.x1],
          y: [secantData.secants[secantIndex]?.f_x1],
          type: 'scatter',
          mode: 'markers',
          name: 'x₀ + h',
          marker: {
            color: '#f59e0b',
            size: 11,
            symbol: 'diamond',
            line: { color: '#ffffff', width: 2 },
          },
          hoverinfo: 'name',
        },
      ]
    : []

  // 线性近似模式
  const linearPlotData: any[] = linearData
    ? [
        {
          x: linearData.function_curve.x,
          y: linearData.function_curve.y,
          type: 'scatter',
          mode: 'lines',
          name: 'f(x)',
          line: { color: '#4f46e5', width: 2.5 },
          hoverinfo: 'name',
        },
        {
          x: linearData.linear_approximation.x,
          y: linearData.linear_approximation.y,
          type: 'scatter',
          mode: 'lines',
          name: '线性近似 L(x)',
          line: { color: '#ef4444', width: 2.5, dash: 'dash' },
          hoverinfo: 'name',
        },
        // 误差区域
        ...(linearData.error_area.x.length > 0
          ? [
              {
                x: linearData.error_area.x,
                y: linearData.error_area.y,
                type: 'scatter',
                mode: 'lines',
                name: '误差 f(x)-L(x)',
                fill: 'tozeroy',
                fillcolor: 'rgba(16, 185, 129, 0.12)',
                line: { color: '#10b981', width: 1 },
                hoverinfo: 'name',
              },
            ]
          : []),
        {
          x: [linearData.point.x],
          y: [linearData.point.y],
          type: 'scatter',
          mode: 'markers',
          name: '切点',
          marker: {
            color: '#ef4444',
            size: 14,
            symbol: 'circle',
            line: { color: '#ffffff', width: 2 },
          },
          hoverinfo: 'name',
        },
      ]
    : []

  // 高阶导数模式
  const higherPlotData: any[] = higherData
    ? higherData.curves
        .filter((curve) => visibleHigherCurves.has(curve.order))
        .map((curve) => ({
          x: curve.x,
          y: curve.y,
          type: 'scatter',
          mode: 'lines',
          name: curve.name,
          line: {
            color: ['#4f46e5', '#ef4444', '#10b981', '#f59e0b'][curve.order % 4],
            width: curve.order === 0 ? 2.5 : 2,
          },
          hoverinfo: 'name',
        }))
    : []

  const baseLayout = {
    xaxis: { title: 'x', autorange: true, zeroline: true, showspikes: false },
    yaxis: { title: 'f(x)', autorange: true, zeroline: true, showspikes: false },
    showlegend: true,
    legend: { x: 0.02, y: 0.98 },
    dragmode: 'pan',
    margin: { t: 55, r: 20, b: 55, l: 60 },
    autosize: true,
  }

  const tangentLayout: any = tangentData
    ? {
        ...baseLayout,
        title: {
          text: `导数与切线：f'(x₀) = ${tangentData.derivative.value.toFixed(4)}，${tangentData.analysis.monotonicity}`,
          font: { size: 15 },
        },
      }
    : {}

  const secantLayout: any = secantData
    ? {
        ...baseLayout,
        title: {
          text: `割线逼近切线：当前斜率 = ${secantData.secants[secantIndex]?.slope.toFixed(6)}`,
          font: { size: 15 },
        },
      }
    : {}

  const linearLayout: any = linearData
    ? {
        ...baseLayout,
        title: {
          text: `局部线性近似：L(x) = ${linearData.linear_approximation.equation}`,
          font: { size: 15 },
        },
      }
    : {}

  const higherLayout: any = higherData
    ? {
        ...baseLayout,
        yaxis: { ...baseLayout.yaxis, title: '值' },
        title: { text: `高阶导数 at x₀ = ${higherData.x0}`, font: { size: 15 } },
      }
    : {}

  const getCurrentPlotData = () => {
    switch (activeMode) {
      case 'tangent':
        return tangentPlotData
      case 'secant':
        return secantPlotData
      case 'linear':
        return linearPlotData
      case 'higher':
        return higherPlotData
      default:
        return []
    }
  }

  const getCurrentLayout = () => {
    switch (activeMode) {
      case 'tangent':
        return tangentLayout
      case 'secant':
        return secantLayout
      case 'linear':
        return linearLayout
      case 'higher':
        return higherLayout
      default:
        return {}
    }
  }

  const getMagnifierData = () => {
    if (!linearData && !tangentData) return []
    const data = activeMode === 'linear' ? linearData : tangentData
    if (!data) return []
    const x0 = data.point.x
    const y0 = data.point.y
    const plotData: any[] = [
      {
        x: data.function_curve.x,
        y: data.function_curve.y,
        type: 'scatter',
        mode: 'lines',
        line: { color: '#4f46e5', width: 2 },
      },
    ]
    if (activeMode === 'linear') {
      plotData.push({
        x: linearData!.linear_approximation.x,
        y: linearData!.linear_approximation.y,
        type: 'scatter',
        mode: 'lines',
        line: { color: '#ef4444', width: 2, dash: 'dash' },
      })
    } else {
      plotData.push({
        x: tangentData!.tangent_line.x,
        y: tangentData!.tangent_line.y,
        type: 'scatter',
        mode: 'lines',
        line: { color: '#ef4444', width: 2 },
      })
    }
    plotData.push({
      x: [x0],
      y: [y0],
      type: 'scatter',
      mode: 'markers',
      marker: { color: '#ef4444', size: 8, symbol: 'circle' },
    })
    return plotData
  }

  const hasData = tangentData || secantData || linearData || higherData

  const renderDefinitionBox = () => (
    <div className="derivative-definition-box">
      <div className="derivative-definition-title">导数的定义</div>
      <p>函数 f 在 x₀ 处的导数定义为切线的斜率：</p>
      <div className="derivative-definition-formula">f'(x₀) = lim(h→0) [f(x₀+h) - f(x₀)] / h</div>
      <p className="derivative-definition-hint">
        几何意义：当割线的两个交点无限靠近时，其极限位置就是切线，导数即为切线斜率。
      </p>
    </div>
  )

  const renderStepper = () => (
    <div className="derivative-stepper">
      {STEPS.map((step, index) => (
        <div
          key={index}
          className={`derivative-step ${index === activeStep ? 'active' : ''} ${index < activeStep ? 'completed' : ''}`}
          onClick={() => setActiveStep(index)}
        >
          <div className="derivative-step-number">{index + 1}</div>
          <div className="derivative-step-content">
            <div className="derivative-step-title">{step.title}</div>
            <div className="derivative-step-desc">{step.description}</div>
          </div>
        </div>
      ))}
    </div>
  )

  const renderTangentAnalysis = () => {
    if (!tangentData) return null
    const { analysis, derivative, point, tangent_line, normal_line } = tangentData
    const badgeVariant = analysis.differentiable
      ? analysis.critical_point
        ? 'warning'
        : 'success'
      : 'error'
    const badgeText = analysis.differentiable
      ? analysis.critical_point
        ? '临界点'
        : '可导'
      : '不可导'

    return (
      <>
        <CollapsibleSection
          title="导数分析"
          variant={badgeVariant}
          rightAction={
            <span className={`derivative-status-badge ${badgeVariant}`}>{badgeText}</span>
          }
        >
          <div className="info-grid">
            <div className="info-item">
              <span>函数</span>
              <span>f(x) = {request.function}</span>
            </div>
            <div className="info-item">
              <span>求导点</span>
              <span>x₀ = {point.x}</span>
            </div>
            <div className="info-item">
              <span>f(x₀)</span>
              <span>{point.y.toFixed(4)}</span>
            </div>
            <div className="info-item">
              <span>f'(x₀)</span>
              <span>{derivative.value.toFixed(4)}</span>
            </div>
            <div className="info-item">
              <span>导函数</span>
              <span>f'(x) = {derivative.expression}</span>
            </div>
            <div className="info-item">
              <span>切线方程</span>
              <span>{tangent_line.equation}</span>
            </div>
            <div className="info-item">
              <span>法线斜率</span>
              <span>
                {!isFinite(normal_line.slope) ? '∞（垂直）' : normal_line.slope.toFixed(4)}
              </span>
            </div>
            <div className="info-item">
              <span>曲率 κ</span>
              <span>{analysis.curvature.toFixed(4)}</span>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="函数形态">
          <div className="info-grid">
            <div className="info-item">
              <span>单调性</span>
              <span>{analysis.monotonicity}</span>
            </div>
            <div className="info-item">
              <span>凹凸性</span>
              <span>
                {analysis.second_derivative.concavity === 'concave_up'
                  ? "凹向上（f'' > 0）"
                  : analysis.second_derivative.concavity === 'concave_down'
                    ? "凹向下（f'' < 0）"
                    : '接近线性'}
              </span>
            </div>
            <div className="info-item">
              <span>二阶导数</span>
              <span>f''(x) = {analysis.second_derivative.expression}</span>
            </div>
            <div className="info-item">
              <span>f''(x₀)</span>
              <span>
                {analysis.second_derivative.value !== null
                  ? analysis.second_derivative.value.toFixed(4)
                  : '无定义'}
              </span>
            </div>
            <div className="info-item">
              <span>临界点</span>
              <span>{analysis.critical_point ? '是' : '否'}</span>
            </div>
            <div className="info-item">
              <span>局部极值</span>
              <span>
                {analysis.local_extrema === 'local_min'
                  ? '局部极小值'
                  : analysis.local_extrema === 'local_max'
                    ? '局部极大值'
                    : '无'}
              </span>
            </div>
          </div>
        </CollapsibleSection>

        {tangentData.critical_points.length > 0 && (
          <CollapsibleSection title="可视域内临界点">
            <div className="derivative-critical-list">
              {tangentData.critical_points.map((p, idx) => (
                <div key={idx} className={`derivative-critical-item ${p.type}`}>
                  <span className="derivative-critical-type">
                    {p.type === 'local_min'
                      ? '局部极小'
                      : p.type === 'local_max'
                        ? '局部极大'
                        : '驻点'}
                  </span>
                  <span className="derivative-critical-coord">
                    ({p.x.toFixed(3)}, {p.y.toFixed(3)})
                  </span>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </>
    )
  }

  const renderSecantAnalysis = () => {
    if (!secantData) return null
    const current = secantData.secants[secantIndex]
    return (
      <CollapsibleSection title="割线逼近过程">
        <div className="info-grid">
          <div className="info-item">
            <span>当前 h</span>
            <span>{current.h}</span>
          </div>
          <div className="info-item">
            <span>割线斜率</span>
            <span>{current.slope.toFixed(6)}</span>
          </div>
          <div className="info-item">
            <span>切线斜率（极限）</span>
            <span>{secantData.tangent.slope.toFixed(6)}</span>
          </div>
          <div className="info-item">
            <span>误差</span>
            <span>{Math.abs(current.slope - secantData.tangent.slope).toExponential(3)}</span>
          </div>
        </div>
        <div className="derivative-step-desc" style={{ marginTop: 'var(--space-3)' }}>
          {secantData.steps[secantIndex]?.description}
        </div>
      </CollapsibleSection>
    )
  }

  const renderLinearAnalysis = () => {
    if (!linearData) return null
    return (
      <>
        <CollapsibleSection title="局部线性近似">
          <div className="info-grid">
            <div className="info-item">
              <span>函数</span>
              <span>f(x) = {request.function}</span>
            </div>
            <div className="info-item">
              <span>求导点</span>
              <span>x₀ = {linearData.point.x}</span>
            </div>
            <div className="info-item">
              <span>f(x₀)</span>
              <span>{linearData.point.y.toFixed(4)}</span>
            </div>
            <div className="info-item">
              <span>线性近似</span>
              <span>{linearData.linear_approximation.equation}</span>
            </div>
            <div className="info-item">
              <span>误差上界</span>
              <span>{linearData.error_estimate.error_bound_formula}</span>
            </div>
            <div className="info-item">
              <span>最大 |f''(x)|</span>
              <span>{linearData.error_estimate.max_second_derivative.toFixed(4)}</span>
            </div>
          </div>
        </CollapsibleSection>
        <CollapsibleSection title="图例说明" variant="success">
          <p>
            <span style={{ color: '#4f46e5' }}>—</span> 原函数 f(x)
            <br />
            <span style={{ color: '#ef4444' }}>- -</span> 线性近似 L(x)
            <br />
            <span style={{ color: '#10b981' }}>▉</span> 误差区域 f(x) - L(x)
            <br />当 x 越接近 x₀，线性近似的误差以 (x-x₀)² 的速度减小。
          </p>
        </CollapsibleSection>
      </>
    )
  }

  const renderHigherAnalysis = () => {
    if (!higherData) return null
    return (
      <>
        <CollapsibleSection title="各阶导数在 x₀ 处的值">
          <div className="derivative-higher-grid">
            {higherData.curves.map((curve) => (
              <div
                key={curve.order}
                className={`derivative-higher-card ${visibleHigherCurves.has(curve.order) ? 'active' : ''}`}
                onClick={() => toggleHigherCurve(curve.order)}
              >
                <div className="derivative-higher-name">{curve.name}</div>
                <div className="derivative-higher-value">{curve.value_at_x0.toFixed(4)}</div>
                <div className="derivative-higher-sign">{curve.sign_summary}</div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
        <CollapsibleSection title="提示">
          <p>
            点击上方卡片可显示/隐藏对应阶数的曲线。f' 的零点对应 f 的极值点；f'' 的符号决定 f
            的凹凸性。
          </p>
        </CollapsibleSection>
      </>
    )
  }

  const getMagnifierLayout = () => {
    if (!linearData && !tangentData) return {}
    const data = activeMode === 'linear' ? linearData : tangentData
    if (!data) return {}
    const x0 = data.point.x
    const y0 = data.point.y
    const dx = 0.6 / magnifierZoom
    const dy = 1.2 / magnifierZoom
    return {
      title: { text: `局部放大 ${magnifierZoom.toFixed(1)}x`, font: { size: 12 } },
      xaxis: { range: [x0 - dx, x0 + dx], zeroline: false, showgrid: true },
      yaxis: { range: [y0 - dy, y0 + dy], zeroline: false, showgrid: true },
      margin: { t: 25, r: 10, b: 30, l: 40 },
      width: 200,
      height: 200,
      showlegend: false,
    }
  }

  return (
    <div className="detail-page">
      <PageHeader
        backTo="/subject/calculus"
        backLabel="返回微积分"
        breadcrumbs={[
          { label: '首页', path: '/' },
          { label: '微积分', path: '/subject/calculus' },
          { label: '导数与切线' },
        ]}
        title="导数与切线"
      />

      <VisualizationWorkspace
        visualizationTitle={
          activeMode === 'tangent'
            ? '导数与切线可视化'
            : activeMode === 'secant'
              ? '割线逼近切线'
              : activeMode === 'linear'
                ? '局部线性近似'
                : '高阶导数'
        }
        controls={
          <ControlPanel title="参数设置" subtitle="调整函数、求导点与探索模式">
            <div className="form-section">
              <div className="form-group">
                <label>函数 f(x)</label>
                <input
                  type="text"
                  value={request.function}
                  onChange={(e) => handleInputChange('function', e.target.value)}
                  placeholder="例如: x**2, sin(x), x**3 - 3*x"
                />
              </div>
              <div className="form-group">
                <label>求导点 x₀</label>
                <input
                  type="number"
                  step="0.1"
                  value={request.x0}
                  onChange={(e) => handleInputChange('x0', parseFloat(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>绘图范围</label>
                <input
                  type="text"
                  value={`[${request.domain_range[0]}, ${request.domain_range[1]}]`}
                  onChange={(e) => {
                    try {
                      const range = JSON.parse(e.target.value)
                      if (Array.isArray(range) && range.length === 2) {
                        handleInputChange('domain_range', range)
                      }
                    } catch {
                      // 忽略非法区间输入
                    }
                  }}
                />
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">预设示例</div>
              <div className="derivative-example-chips">
                {EXAMPLES.map((example) => (
                  <button
                    key={example.name}
                    className={`derivative-example-chip ${request.function === example.function && request.x0 === example.x0 ? 'active' : ''}`}
                    onClick={() => applyExample(example)}
                    title={example.description}
                  >
                    <span className="derivative-example-name">{example.name}</span>
                    <span className="derivative-example-desc">{example.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-section">
              <label
                className="form-label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={magnifierEnabled}
                  onChange={(e) => setMagnifierEnabled(e.target.checked)}
                />
                启用局部放大镜
              </label>
              {magnifierEnabled && (
                <div className="slider-container" style={{ marginTop: 'var(--space-2)' }}>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    step="0.5"
                    value={magnifierZoom}
                    onChange={(e) => setMagnifierZoom(parseFloat(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span className="slider-value">{magnifierZoom.toFixed(1)}x</span>
                </div>
              )}
            </div>
          </ControlPanel>
        }
        visualization={
          <>
            {error && <ErrorState message={error} />}
            {loading && !hasData && <LoadingState text="正在计算可视化数据..." />}
            {hasData && (
              <>
                <div className="derivative-tabs-wrapper">
                  <TabBar tabs={TABS} active={activeMode} onChange={setActiveMode} />
                </div>

                <VisualizationCard
                  title={
                    activeMode === 'tangent'
                      ? '导数与切线可视化'
                      : activeMode === 'secant'
                        ? '割线逼近切线'
                        : activeMode === 'linear'
                          ? '局部线性近似'
                          : '高阶导数'
                  }
                  subtitle={
                    activeMode === 'secant'
                      ? '播放动画观察割线如何收敛到切线'
                      : '拖动图表可平移，滚轮可缩放'
                  }
                  loading={isUpdating}
                  rightAction={
                    activeMode === 'secant' && secantData ? (
                      <div className="derivative-animation-controls">
                        <button
                          className={`btn btn-primary btn-sm ${isSecantPlaying ? 'btn-active' : ''}`}
                          onClick={toggleSecantPlay}
                        >
                          {isSecantPlaying ? '暂停' : '播放'}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={resetSecantAnimation}>
                          重置
                        </button>
                        <div className="derivative-speed-control">
                          <label>速度</label>
                          <input
                            type="range"
                            min="0.5"
                            max="3"
                            step="0.5"
                            value={secantSpeed}
                            onChange={(e) => setSecantSpeed(parseFloat(e.target.value))}
                          />
                        </div>
                      </div>
                    ) : undefined
                  }
                >
                  <div style={{ position: 'absolute', inset: 0, padding: 'var(--space-2)' }}>
                    <Plot
                      ref={plotRef}
                      data={getCurrentPlotData()}
                      layout={getCurrentLayout()}
                      config={{ responsive: true, scrollZoom: true }}
                      onRelayout={(e: any) => handleRelayout(e, activeMode)}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>

                  {magnifierEnabled && (
                    <div className="derivative-magnifier">
                      <Plot
                        data={getMagnifierData()}
                        layout={getMagnifierLayout()}
                        config={{ displayModeBar: false }}
                      />
                    </div>
                  )}
                </VisualizationCard>

                {activeMode === 'secant' && secantData && (
                  <div
                    className="form-section"
                    style={{
                      background: 'var(--surface)',
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <label className="form-label">
                      当前 h 值: {secantData.secants[secantIndex]?.h}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max={secantData.secants.length - 1}
                      step="1"
                      value={secantIndex}
                      onChange={(e) => {
                        setIsSecantPlaying(false)
                        setSecantIndex(parseInt(e.target.value))
                      }}
                    />
                    <div className="preset-group" style={{ marginTop: 'var(--space-3)' }}>
                      {secantData.secants.map((sec, idx) => (
                        <button
                          key={idx}
                          className={`preset-chip ${secantIndex === idx ? 'active' : ''}`}
                          onClick={() => {
                            setIsSecantPlaying(false)
                            setSecantIndex(idx)
                          }}
                        >
                          h={sec.h}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {!hasData && !loading && (
              <div className="empty-state">
                <div className="empty-state-icon">📐</div>
                <p>输入函数并选择模式，开始探索导数与切线</p>
              </div>
            )}
          </>
        }
        infoPanels={
          hasData ? (
            <>
              <CollapsibleSection title="导数的定义" defaultExpanded={true}>
                {renderDefinitionBox()}
              </CollapsibleSection>

              <CollapsibleSection title="探索步骤" defaultExpanded={true}>
                {renderStepper()}
              </CollapsibleSection>

              {activeMode === 'tangent' && renderTangentAnalysis()}
              {activeMode === 'secant' && renderSecantAnalysis()}
              {activeMode === 'linear' && renderLinearAnalysis()}
              {activeMode === 'higher' && renderHigherAnalysis()}
            </>
          ) : null
        }
      />
    </div>
  )
}
