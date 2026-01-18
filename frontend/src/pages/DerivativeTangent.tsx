import { useState, useEffect, useCallback, useRef } from 'react'
import Plot from 'react-plotly.js'
import { calculusApi, DerivativeRequest, SecantRequest } from '../services/api'

// 防抖函数
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return ((...args: any[]) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }) as T
}

// 验证函数表达式是否基本有效
function isValidFunctionExpression(expr: string): boolean {
  if (!expr || expr.trim().length === 0) return false
  const cleaned = expr.trim().replace(/\s+/g, '')
  // 允许数字、运算符、括号、变量和常用数学函数 (sin, cos, tan, log, ln, exp, sqrt 等)
  // 包含所有需要的字母: a, b, c, d, e, g, i, l, n, o, p, r, s, t, u, x, y, z
  const validPattern = /^[\d\.\+\-\*\/\(\)\[\]\{\}xyzXYZ\s,\^aAbBcCdDeEgGiIlLnNoOpPrRsStTuU]+$/i
  if (!validPattern.test(cleaned)) return false
  // 必须包含变量
  return /[xXyYzZ]/.test(cleaned)
}

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
  point: { x: number; y: number }
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
    x: number[]
    y: (number | null)[]
  }>
  domain_range: number[]
}

const defaultRequest: DerivativeRequest = {
  function: 'x**2',
  x0: 2,
  domain_range: [0, 4]
}

const defaultHValues = [1, 0.5, 0.2, 0.1, 0.05, 0.01, 0.005, 0.001]

// 扩展绘图范围
const EXTEND_RATIO = 0.5

export default function DerivativeTangent() {
  const [activeMode, setActiveMode] = useState<'tangent' | 'secant' | 'linear' | 'higher'>('tangent')
  const [request, setRequest] = useState<DerivativeRequest>(defaultRequest)
  const [hValues] = useState<number[]>(defaultHValues)
  const [tangentData, setTangentData] = useState<DerivativeData | null>(null)
  const [secantData, setSecantData] = useState<SecantData | null>(null)
  const [linearData, setLinearData] = useState<LinearApproxData | null>(null)
  const [higherData, setHigherData] = useState<HigherDerivativeData | null>(null)
  const [secantIndex, setSecantIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentRange, setCurrentRange] = useState<[number, number]>([0, 4])
  const plotRef = useRef<any>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  // 放大镜功能
  const [magnifierEnabled, setMagnifierEnabled] = useState(false)
  const [magnifierZoom, setMagnifierZoom] = useState(3)

  const fetchTangentData = useCallback(async (range?: [number, number], isManual = false) => {
    // 验证函数表达式
    if (!isValidFunctionExpression(request.function)) {
      if (isManual) {
        setError('请输入有效的函数表达式（包含变量 x）')
      }
      setIsUpdating(false)
      return
    }

    setIsUpdating(true)
    setError(null)
    const activeRange = range || request.domain_range
    const extendedRange = [
      activeRange[0] - EXTEND_RATIO,
      activeRange[1] + EXTEND_RATIO
    ] as [number, number]
    try {
      const response = await calculusApi.derivative({
        ...request,
        domain_range: extendedRange
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
  }, [request])

  const fetchSecantData = useCallback(async (range?: [number, number], isManual = false) => {
    // 验证函数表达式
    if (!isValidFunctionExpression(request.function)) {
      if (isManual) {
        setError('请输入有效的函数表达式（包含变量 x）')
      }
      setIsUpdating(false)
      return
    }

    setIsUpdating(true)
    setError(null)
    const activeRange = range || request.domain_range
    const extendedRange = [
      activeRange[0] - EXTEND_RATIO,
      activeRange[1] + EXTEND_RATIO
    ] as [number, number]
    try {
      const secantRequest: SecantRequest = {
        function: request.function,
        x0: request.x0,
        h_values: hValues,
        domain_range: extendedRange
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
  }, [request, hValues])

  const fetchLinearData = useCallback(async (range?: [number, number], isManual = false) => {
    if (!isValidFunctionExpression(request.function)) {
      if (isManual) setError('请输入有效的函数表达式（包含变量 x）')
      setIsUpdating(false)
      return
    }

    setIsUpdating(true)
    setError(null)
    const activeRange = range || request.domain_range
    const extendedRange = [
      activeRange[0] - EXTEND_RATIO,
      activeRange[1] + EXTEND_RATIO
    ] as [number, number]
    try {
      const response = await calculusApi.linearApproximation({
        function: request.function,
        x0: request.x0,
        domain_range: extendedRange
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
  }, [request])

  const fetchHigherData = useCallback(async (range?: [number, number], isManual = false) => {
    if (!isValidFunctionExpression(request.function)) {
      if (isManual) setError('请输入有效的函数表达式（包含变量 x）')
      setIsUpdating(false)
      return
    }

    setIsUpdating(true)
    setError(null)
    const activeRange = range || request.domain_range
    const extendedRange = [
      activeRange[0] - EXTEND_RATIO,
      activeRange[1] + EXTEND_RATIO
    ] as [number, number]
    try {
      const response = await calculusApi.higherDerivatives({
        function: request.function,
        x0: request.x0,
        order: 3,
        domain_range: extendedRange
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
  }, [request])

  // 初始加载
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
  }, [])

  // 参数变化时立即重新获取
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
  }, [request.function, request.x0, activeMode])

  // 模式切换时重新获取数据
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

  // 处理 Plotly 缩放/平移事件（防抖）
  const handleRelayoutCore = useCallback((newXRange: [number, number], rangeType: 'tangent' | 'secant' | 'linear' | 'higher') => {
    const currentWidth = currentRange[1] - currentRange[0]
    const newWidth = newXRange[1] - newXRange[0]
    const centerDiff = Math.abs((currentRange[0] + currentRange[1]) / 2 - (newXRange[0] + newXRange[1]) / 2)

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
  }, [currentRange, fetchTangentData, fetchSecantData, fetchLinearData, fetchHigherData])

  const handleRelayout = useCallback(debounce((event: any, rangeType: 'tangent' | 'secant' | 'linear' | 'higher') => {
    if (!event['xaxis.range[0]'] || !event['xaxis.range[1]']) return
    const newXRange: [number, number] = [
      event['xaxis.range[0]'],
      event['xaxis.range[1]']
    ]
    handleRelayoutCore(newXRange, rangeType)
  }, 300), [handleRelayoutCore])

  const handleInputChange = (field: keyof DerivativeRequest, value: any) => {
    setRequest(prev => ({ ...prev, [field]: value }))
  }

  const tangentPlotData: any[] = tangentData ? [
    // 主函数曲线
    {
      x: tangentData.function_curve.x,
      y: tangentData.function_curve.y,
      type: 'scatter',
      mode: 'lines',
      name: 'f(x)',
      line: { color: '#4f46e5', width: 2 }
    },
    // 切线
    {
      x: tangentData.tangent_line.x,
      y: tangentData.tangent_line.y,
      type: 'scatter',
      mode: 'lines',
      name: '切线',
      line: { color: '#ef4444', width: 2 }
    },
    // 法线
    {
      x: tangentData.normal_line.x,
      y: tangentData.normal_line.y,
      type: 'scatter',
      mode: 'lines',
      name: '法线',
      line: { color: '#10b981', width: 2, dash: 'dash' }
    },
    // 切点
    {
      x: [tangentData.point.x],
      y: [tangentData.point.y],
      type: 'scatter',
      mode: 'markers',
      name: '切点',
      marker: { color: '#ef4444', size: 12, symbol: 'circle' }
    }
  ] : []

  const secantPlotData: any[] = secantData ? [
    // 主函数曲线
    {
      x: secantData.function_curve.x,
      y: secantData.function_curve.y,
      type: 'scatter',
      mode: 'lines',
      name: 'f(x)',
      line: { color: '#4f46e5', width: 2 }
    },
    // 当前割线
    {
      x: secantData.secants[secantIndex]?.x || [],
      y: secantData.secants[secantIndex]?.y || [],
      type: 'scatter',
      mode: 'lines',
      name: `割线 (h=${secantData.secants[secantIndex]?.h})`,
      line: { color: '#f59e0b', width: 2 }
    },
    // 最终切线（淡显示）
    {
      x: secantData.tangent.x,
      y: secantData.tangent.y,
      type: 'scatter',
      mode: 'lines',
      name: '切线 (h→0)',
      line: { color: '#ef4444', width: 2, dash: 'dot' },
      opacity: 0.6
    },
    // 目标点
    {
      x: [secantData.point.x],
      y: [secantData.point.y],
      type: 'scatter',
      mode: 'markers',
      name: '目标点',
      marker: { color: '#ef4444', size: 12, symbol: 'circle' }
    },
    // 割线的另一个点
    {
      x: [secantData.secants[secantIndex]?.x1],
      y: [secantData.secants[secantIndex]?.f_x1],
      type: 'scatter',
      mode: 'markers',
      name: 'x₀ + h',
      marker: { color: '#f59e0b', size: 10, symbol: 'diamond' }
    }
  ] : []

  // 线性近似绘图数据
  const linearPlotData: any[] = linearData ? [
    // 主函数曲线
    {
      x: linearData.function_curve.x,
      y: linearData.function_curve.y,
      type: 'scatter',
      mode: 'lines',
      name: 'f(x)',
      line: { color: '#4f46e5', width: 2 }
    },
    // 线性近似曲线
    {
      x: linearData.linear_approximation.x,
      y: linearData.linear_approximation.y,
      type: 'scatter',
      mode: 'lines',
      name: '线性近似 L(x)',
      line: { color: '#ef4444', width: 2, dash: 'dash' }
    },
    // 切点
    {
      x: [linearData.point.x],
      y: [linearData.point.y],
      type: 'scatter',
      mode: 'markers',
      name: '切点',
      marker: { color: '#ef4444', size: 12, symbol: 'circle' }
    },
    // 误差区域（填充）
    {
      x: linearData.function_curve.x,
      y: linearData.function_curve.y,
      type: 'scatter',
      mode: 'lines',
      name: 'f(x)',
      fill: 'tozeroy',
      fillcolor: 'rgba(239, 68, 68, 0.1)',
      line: { width: 0 },
      showlegend: false
    }
  ] : []

  // 高阶导数绘图数据
  const higherPlotData: any[] = higherData ? higherData.curves.map((curve, idx) => ({
    x: curve.x,
    y: curve.y,
    type: 'scatter',
    mode: 'lines',
    name: curve.name,
    line: { color: ['#4f46e5', '#ef4444', '#10b981', '#f59e0b'][idx % 4], width: 2 }
  })) : []

  const tangentLayout: any = tangentData ? {
    title: {
      text: `导数与切线: f'(x₀) = ${tangentData.derivative.value.toFixed(4)}`,
      font: { size: 16 }
    },
    xaxis: {
      title: 'x',
      autorange: true,
      zeroline: true,
      showspikes: false
    },
    yaxis: {
      title: 'f(x)',
      autorange: true,
      zeroline: true,
      showspikes: false
    },
    showlegend: true,
    legend: { x: 0.02, y: 0.98 },
    dragmode: 'pan',
    margin: { t: 60, r: 40, b: 60, l: 60 }
  } : {}

  const secantLayout: any = secantData ? {
    title: {
      text: `割线逼近切线: 当前斜率 = ${secantData.secants[secantIndex]?.slope.toFixed(6)}`,
      font: { size: 16 }
    },
    xaxis: {
      title: 'x',
      autorange: true,
      zeroline: true,
      showspikes: false
    },
    yaxis: {
      title: 'f(x)',
      autorange: true,
      zeroline: true,
      showspikes: false
    },
    showlegend: true,
    legend: { x: 0.02, y: 0.98 },
    dragmode: 'pan',
    margin: { t: 60, r: 40, b: 60, l: 60 }
  } : {}

  const linearLayout: any = linearData ? {
    title: {
      text: `局部线性近似: L(x) = ${linearData.linear_approximation.equation}`,
      font: { size: 16 }
    },
    xaxis: {
      title: 'x',
      autorange: true,
      zeroline: true,
      showspikes: false
    },
    yaxis: {
      title: 'f(x)',
      autorange: true,
      zeroline: true,
      showspikes: false
    },
    showlegend: true,
    legend: { x: 0.02, y: 0.98 },
    dragmode: 'pan',
    margin: { t: 60, r: 40, b: 60, l: 60 }
  } : {}

  const higherLayout: any = higherData ? {
    title: {
      text: `高阶导数: f, f', f'', f''' at x₀ = ${higherData.x0}`,
      font: { size: 16 }
    },
    xaxis: {
      title: 'x',
      autorange: true,
      zeroline: true,
      showspikes: false
    },
    yaxis: {
      title: '值',
      autorange: true,
      zeroline: true,
      showspikes: false
    },
    showlegend: true,
    legend: { x: 0.02, y: 0.98 },
    dragmode: 'pan',
    margin: { t: 60, r: 40, b: 60, l: 60 }
  } : {}

  // 获取当前绘图数据和布局
  const getCurrentPlotData = () => {
    switch (activeMode) {
      case 'tangent': return tangentPlotData
      case 'secant': return secantPlotData
      case 'linear': return linearPlotData
      case 'higher': return higherPlotData
      default: return []
    }
  }

  const getCurrentLayout = () => {
    switch (activeMode) {
      case 'tangent': return { ...tangentLayout, width: 900, height: 500 }
      case 'secant': return { ...secantLayout, width: 900, height: 500 }
      case 'linear': return { ...linearLayout, width: 900, height: 500 }
      case 'higher': return { ...higherLayout, width: 900, height: 500 }
      default: return { width: 900, height: 500 }
    }
  }

  return (
    <div className="content-card">
      <div className="card-header">
        <h2>导数与切线可视化</h2>
        <p>理解导数的几何意义：切线斜率 = 割线斜率在 h → 0 时的极限</p>
      </div>

      <div className="nav-tabs" style={{ borderBottom: 'none', marginBottom: '1rem' }}>
        <button
          className={`nav-tab ${activeMode === 'tangent' ? 'active' : ''}`}
          onClick={() => setActiveMode('tangent')}
        >
          切线与法线
        </button>
        <button
          className={`nav-tab ${activeMode === 'secant' ? 'active' : ''}`}
          onClick={() => setActiveMode('secant')}
        >
          割线逼近
        </button>
        <button
          className={`nav-tab ${activeMode === 'linear' ? 'active' : ''}`}
          onClick={() => setActiveMode('linear')}
        >
          局部线性近似
        </button>
        <button
          className={`nav-tab ${activeMode === 'higher' ? 'active' : ''}`}
          onClick={() => setActiveMode('higher')}
        >
          高阶导数
        </button>
      </div>

      <div className="form-row">
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
              } catch {}
            }}
          />
        </div>
      </div>

      {activeMode === 'secant' && (
        <div className="form-group">
          <label>当前 h 值: {secantData?.secants[secantIndex]?.h}</label>
          <input
            type="range"
            min="0"
            max={hValues.length - 1}
            step="1"
            value={secantIndex}
            onChange={(e) => setSecantIndex(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {hValues.map((h, idx) => (
              <button
                key={h}
                className={`btn ${secantIndex === idx ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSecantIndex(idx)}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              >
                h={h}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="error-message">
        <span style={{ marginRight: '8px' }}>⚠️</span>
        {error}
      </div>}

      {loading && !tangentData && !secantData && !linearData && !higherData && (
        <div className="loading">加载中...</div>
      )}

      {(tangentData || secantData || linearData || higherData) && (
        <>
          {/* 放大镜控制 */}
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={magnifierEnabled}
                onChange={(e) => setMagnifierEnabled(e.target.checked)}
              />
              <span>启用放大镜</span>
              {magnifierEnabled && (
                <>
                  <span>放大倍数:</span>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    step="0.5"
                    value={magnifierZoom}
                    onChange={(e) => setMagnifierZoom(parseFloat(e.target.value))}
                    style={{ width: '120px' }}
                  />
                  <span>{magnifierZoom.toFixed(1)}x</span>
                </>
              )}
            </label>
          </div>

          {/* 绘图区域 */}
          <div className="visualization-container">
            {isUpdating && (
              <div className="updating-overlay">更新中...</div>
            )}
            <Plot
              ref={plotRef}
              data={getCurrentPlotData()}
              layout={getCurrentLayout()}
              config={{ responsive: true, scrollZoom: true }}
              onRelayout={(e: any) => handleRelayout(e, activeMode)}
            />
            {/* 放大镜小窗口 */}
            {magnifierEnabled && linearData && activeMode === 'linear' && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '20px',
                  right: '20px',
                  width: '200px',
                  height: '200px',
                  border: '2px solid #ef4444',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: 'white',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
              >
                <Plot
                  data={[
                    // 主函数曲线（放大）
                    {
                      x: linearData.function_curve.x,
                      y: linearData.function_curve.y,
                      type: 'scatter',
                      mode: 'lines',
                      line: { color: '#4f46e5', width: 2 }
                    },
                    // 线性近似曲线（放大）
                    {
                      x: linearData.linear_approximation.x,
                      y: linearData.linear_approximation.y,
                      type: 'scatter',
                      mode: 'lines',
                      line: { color: '#ef4444', width: 2, dash: 'dash' }
                    },
                    // 切点
                    {
                      x: [linearData.point.x],
                      y: [linearData.point.y],
                      type: 'scatter',
                      mode: 'markers',
                      marker: { color: '#ef4444', size: 8, symbol: 'circle' }
                    }
                  ]}
                  layout={{
                    title: { text: `放大 ${magnifierZoom.toFixed(1)}x`, font: { size: 12 } },
                    xaxis: {
                      range: [linearData.point.x - 0.5/magnifierZoom, linearData.point.x + 0.5/magnifierZoom],
                      zeroline: false
                    },
                    yaxis: {
                      range: [linearData.point.y - 1/magnifierZoom, linearData.point.y + 1/magnifierZoom],
                      zeroline: false
                    },
                    margin: { t: 25, r: 10, b: 30, l: 40 },
                    width: 200,
                    height: 200,
                    showlegend: false
                  }}
                  config={{ displayModeBar: false }}
                />
              </div>
            )}
          </div>

          {/* 切线模式信息面板 */}
          {activeMode === 'tangent' && tangentData && (
            <div className="info-panel">
              <h4>导数信息</h4>
              <div className="info-item">
                <span>函数</span>
                <span>f(x) = {request.function}</span>
              </div>
              <div className="info-item">
                <span>求导点</span>
                <span>x₀ = {tangentData.point.x}</span>
              </div>
              <div className="info-item">
                <span>f(x₀)</span>
                <span>{tangentData.point.y.toFixed(4)}</span>
              </div>
              <div className="info-item">
                <span>导数值 f'(x₀)</span>
                <span>{tangentData.derivative.value.toFixed(4)}</span>
              </div>
              <div className="info-item">
                <span>导函数</span>
                <span>f'(x) = {tangentData.derivative.expression}</span>
              </div>
              <div className="info-item">
                <span>切线方程</span>
                <span>{tangentData.tangent_line.equation}</span>
              </div>
              <div className="info-item">
                <span>法线斜率</span>
                <span>{!isFinite(tangentData.normal_line.slope) ? '∞' : tangentData.normal_line.slope.toFixed(4)}</span>
              </div>
            </div>
          )}

          {/* 割线模式信息面板 */}
          {activeMode === 'secant' && secantData && (
            <div className="info-panel">
              <h4>割线逼近过程</h4>
              <div className="info-item">
                <span>当前 h</span>
                <span>{secantData.secants[secantIndex].h}</span>
              </div>
              <div className="info-item">
                <span>割线斜率</span>
                <span>{secantData.secants[secantIndex].slope.toFixed(6)}</span>
              </div>
              <div className="info-item">
                <span>切线斜率（极限）</span>
                <span>{secantData.tangent.slope.toFixed(6)}</span>
              </div>
              <div className="info-item">
                <span>误差</span>
                <span>{Math.abs(secantData.secants[secantIndex].slope - secantData.tangent.slope).toFixed(8)}</span>
              </div>
            </div>
          )}

          {/* 线性近似模式信息面板 */}
          {activeMode === 'linear' && linearData && (
            <div className="info-panel">
              <h4>局部线性近似</h4>
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
                <span>L(x) = {linearData.linear_approximation.equation}</span>
              </div>
              <div className="info-item">
                <span>近似含义</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  当 x 接近 x₀ 时，f(x) ≈ L(x)，误差随 (x-x₀)² 减小
                </span>
              </div>
            </div>
          )}

          {/* 高阶导数模式信息面板 */}
          {activeMode === 'higher' && higherData && (
            <div className="info-panel">
              <h4>高阶导数</h4>
              <div className="info-item">
                <span>函数</span>
                <span>f(x) = {request.function}</span>
              </div>
              <div className="info-item">
                <span>求导点</span>
                <span>x₀ = {higherData.x0}</span>
              </div>
              {higherData.curves.map((curve) => (
                <div className="info-item" key={curve.order}>
                  <span>{curve.name}</span>
                  <span style={{ fontSize: '0.85rem' }}>{curve.expression}</span>
                </div>
              ))}
              <div className="info-item" style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  观察：f' 的极值点对应 f 的拐点，f''=0 处为拐点
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
