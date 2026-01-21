import { useState, useEffect, useCallback, useRef } from 'react'
import Plot from 'react-plotly.js'
import { calculusApi, EpsilonDeltaRequest } from '../services/api'
import { Link } from 'react-router-dom'

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
  // 移除空格后检查
  const cleaned = expr.trim().replace(/\s+/g, '')
  // 允许数字、运算符、括号、变量和常用数学函数 (sin, cos, tan, log, ln, exp, sqrt 等)
  // 包含所有需要的字母: a, b, c, d, e, g, i, l, n, o, p, r, s, t, u, x, y, z
  const validPattern = /^[\d\.\+\-\*\/\(\)\[\]\{\}xyzXYZ\s,\^aAbBcCdDeEgGiIlLnNoOpPrRsStTuU]+$/i
  if (!validPattern.test(cleaned)) return false
  // 必须包含变量
  return /[xXyYzZ]/.test(cleaned)
}

interface EpsilonDeltaData {
  function_curve: { x: number[]; y: (number | null)[] }
  epsilon_band: {
    x: number[]
    upper_y: number[]
    lower_y: number[]
    fill_y: number[]
    y_upper: number
    y_lower: number
  }
  delta_band: {
    x_left: number
    x_right: number
    x_range: number[]
    y_range: number[]
    fill_x: number[]
  }
  limit_point: {
    x0: number
    L: number
    f_x0: number
  }
  delta_values: {
    delta: number
    epsilon: number
    f_left: number | null
    f_right: number | null
  }
  domain_range: number[]
}

const defaultRequest: EpsilonDeltaRequest = {
  function: 'x**2',
  x0: 2,
  L: 4,
  epsilon: 0.5,
  domain_range: [-1, 5]
}

// 防抖函数用于自动计算极限值
function debounceLimit<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return ((...args: any[]) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }) as T
}

// 扩展绘图范围
const EXTEND_RATIO = 0.5

export default function EpsilonDeltaLimit() {
  const [request, setRequest] = useState<EpsilonDeltaRequest>(defaultRequest)
  const [data, setData] = useState<EpsilonDeltaData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentRange, setCurrentRange] = useState<[number, number]>([-1, 5])
  const plotRef = useRef<any>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isComputingLimit, setIsComputingLimit] = useState(false)
  // 标记 L 是否由用户手动修改
  const isManualLRef = useRef(false)

  const fetchData = useCallback(async (range?: [number, number], isManual = false) => {
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
      const response = await calculusApi.epsilonDelta({
        ...request,
        domain_range: extendedRange
      })
      if (response.success) {
        setData(response.data)
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

  // 自动计算极限值 L
  const autoComputeLimit = useCallback(debounceLimit(async () => {
    if (!isValidFunctionExpression(request.function)) return
    if (isManualLRef.current) return // 用户手动修改过 L，不再自动覆盖

    setIsComputingLimit(true)
    try {
      const response = await calculusApi.computeLimit(request.function, request.x0)
      if (response.success) {
        setRequest(prev => ({ ...prev, L: response.data.L }))
      }
    } catch (err) {
      // 计算失败时忽略，不显示错误
    } finally {
      setIsComputingLimit(false)
    }
  }, 500), [request.function, request.x0])

  // 初始加载
  useEffect(() => {
    setLoading(true)
    autoComputeLimit() // 初始时自动计算极限值
  }, [])

  // 当函数或 x0 变化时，自动计算极限值 L
  useEffect(() => {
    autoComputeLimit()
  }, [request.function, request.x0])

  // 参数变化时立即重新获取
  useEffect(() => {
    setLoading(true)
    fetchData(undefined, true)
  }, [request.function, request.x0, request.L, request.epsilon])

  // 处理 Plotly 缩放/平移事件（防抖）
  const handleRelayoutCore = useCallback((newXRange: [number, number]) => {
    const currentWidth = currentRange[1] - currentRange[0]
    const newWidth = newXRange[1] - newXRange[0]
    const centerDiff = Math.abs((currentRange[0] + currentRange[1]) / 2 - (newXRange[0] + newXRange[1]) / 2)

    // 如果视野扩大或中心移动超过当前范围的一半，重新获取数据
    if (newWidth > currentWidth * 1.2 || centerDiff > currentWidth * 0.3) {
      fetchData(newXRange)
    }
  }, [currentRange, fetchData])

  const handleRelayout = useCallback(debounce((event: any) => {
    if (!event['xaxis.range[0]'] || !event['xaxis.range[1]']) return
    const newXRange: [number, number] = [
      event['xaxis.range[0]'],
      event['xaxis.range[1]']
    ]
    handleRelayoutCore(newXRange)
  }, 300), [handleRelayoutCore])

  const handleInputChange = (field: keyof EpsilonDeltaRequest, value: any) => {
    if (field === 'L') {
      isManualLRef.current = true // 用户手动修改 L，标记为手动模式
    }
    setRequest(prev => ({ ...prev, [field]: value }))
  }

  // 重置为自动计算模式
  const resetToAutoCompute = () => {
    isManualLRef.current = false
    autoComputeLimit()
  }

  const plotData: any[] = data ? [
    // 主函数曲线
    {
      x: data.function_curve.x,
      y: data.function_curve.y,
      type: 'scatter',
      mode: 'lines',
      name: 'f(x)',
      line: { color: '#4f46e5', width: 2 }
    },
    // ε 带上限
    {
      x: data.epsilon_band.x,
      y: data.epsilon_band.upper_y,
      type: 'scatter',
      mode: 'lines',
      name: 'L + ε',
      line: { color: '#f59e0b', width: 2, dash: 'dash' },
      hoverinfo: 'y'
    },
    // ε 带下限
    {
      x: data.epsilon_band.x,
      y: data.epsilon_band.lower_y,
      type: 'scatter',
      mode: 'lines',
      name: 'L - ε',
      line: { color: '#f59e0b', width: 2, dash: 'dash' },
      hoverinfo: 'y'
    },
    // 极限点
    {
      x: [data.limit_point.x0],
      y: [data.limit_point.f_x0],
      type: 'scatter',
      mode: 'markers',
      name: '极限点',
      marker: { color: '#ef4444', size: 12, symbol: 'circle' }
    },
    // δ 区间左边界
    {
      x: [data.delta_band.x_left, data.delta_band.x_left],
      y: [Math.min(...(data.function_curve.y.filter(y => y !== null) as number[])) - 1,
          Math.max(...(data.function_curve.y.filter(y => y !== null) as number[])) + 1],
      type: 'scatter',
      mode: 'lines',
      name: 'x₀ - δ',
      line: { color: '#10b981', width: 2 },
      showlegend: false
    },
    // δ 区间右边界
    {
      x: [data.delta_band.x_right, data.delta_band.x_right],
      y: [Math.min(...(data.function_curve.y.filter(y => y !== null) as number[])) - 1,
          Math.max(...(data.function_curve.y.filter(y => y !== null) as number[])) + 1],
      type: 'scatter',
      mode: 'lines',
      name: 'x₀ + δ',
      line: { color: '#10b981', width: 2 },
      showlegend: false
    }
  ] : []

  const layout: any = data ? {
    title: {
      text: `ε-δ 极限可视化: lim(x→${data.limit_point.x0}) f(x) = ${data.limit_point.L}`,
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
    hovermode: 'closest',
    dragmode: 'pan',
    shapes: [
      // ε 带填充
      {
        type: 'rect',
        xref: 'paper',
        yref: 'y',
        x0: 0,
        y0: data.epsilon_band.y_lower,
        x1: 1,
        y1: data.epsilon_band.y_upper,
        fillcolor: 'rgba(245, 158, 11, 0.1)',
        line: { width: 0 }
      },
      // δ 带填充
      {
        type: 'rect',
        xref: 'x',
        yref: 'paper',
        x0: data.delta_band.x_left,
        y0: 0,
        x1: data.delta_band.x_right,
        y1: 1,
        fillcolor: 'rgba(16, 185, 129, 0.1)',
        line: { width: 0 }
      }
    ],
    margin: { t: 60, r: 40, b: 60, l: 60 }
  } : {}

  return (
    <div className="detail-page">
      <header className="detail-header">
        <Link to="/subject/calculus" className="detail-back-button">
          ← 返回微积分
        </Link>
        <div className="breadcrumb">
          <Link to="/">首页</Link>
          <span className="breadcrumb-separator">/</span>
          <Link to="/subject/calculus">微积分</Link>
          <span className="breadcrumb-separator">/</span>
          <span>ε-δ 极限可视化</span>
        </div>
        <h1 className="detail-title">ε-δ 极限可视化</h1>
      </header>

      <div className="content-card" style={{ margin: '2rem', maxWidth: '1400px' }}>
        <div className="card-header">
          <h2>ε-δ 极限定义可视化</h2>
          <p>通过交互式图形理解极限的 ε-δ 定义</p>
        </div>

        <div className="form-row">
        <div className="form-group">
          <label>函数 f(x)</label>
          <input
            type="text"
            value={request.function}
            onChange={(e) => handleInputChange('function', e.target.value)}
            placeholder="例如: x**2, sin(x), x**3 - x"
          />
        </div>
        <div className="form-group">
          <label>极限点 x₀</label>
          <input
            type="number"
            step="0.1"
            value={request.x0}
            onChange={(e) => handleInputChange('x0', parseFloat(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label>
            极限值 L
            {isComputingLimit && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>(计算中...)</span>}
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="number"
              step="0.1"
              value={request.L}
              onChange={(e) => handleInputChange('L', parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
            {isManualLRef.current && (
              <button
                className="btn btn-secondary"
                onClick={resetToAutoCompute}
                title="恢复自动计算"
                style={{ padding: '0.5rem 0.75rem' }}
              >
                自动
              </button>
            )}
          </div>
        </div>
        <div className="form-group">
          <label>ε 值</label>
          <div className="slider-container">
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={request.epsilon}
              onChange={(e) => handleInputChange('epsilon', parseFloat(e.target.value))}
            />
            <span className="slider-value">{request.epsilon}</span>
          </div>
        </div>
      </div>

      {error && <div className="error-message">
        <span style={{ marginRight: '8px' }}>⚠️</span>
        {error}
      </div>}

      {loading && !data && (
        <div className="loading">加载中...</div>
      )}

      {data && (
        <>
          <div className="visualization-container">
            {isUpdating && (
              <div className="updating-overlay">更新中...</div>
            )}
            <Plot
              ref={plotRef}
              data={plotData}
              layout={{ ...layout, width: 900, height: 500 }}
              config={{ responsive: true, scrollZoom: true }}
              onRelayout={handleRelayout}
            />
          </div>

          <div className="info-panel">
            <h4>当前参数</h4>
            <div className="info-item">
              <span>函数</span>
              <span>f(x) = {request.function}</span>
            </div>
            <div className="info-item">
              <span>极限点 x₀</span>
              <span>{request.x0}</span>
            </div>
            <div className="info-item">
              <span>极限值 L</span>
              <span>{request.L}</span>
            </div>
            <div className="info-item">
              <span>ε</span>
              <span>{request.epsilon}</span>
            </div>
            {data && (
              <>
                <div className="info-item">
                  <span>计算得到的 δ</span>
                  <span>{data.delta_values.delta.toFixed(4)}</span>
                </div>
                <div className="info-item">
                  <span>当 |x - x₀| &lt; {data.delta_values.delta.toFixed(4)}</span>
                  <span>有 |f(x) - {request.L}| &lt; {request.epsilon}</span>
                </div>
              </>
            )}
          </div>

          <div className="info-panel" style={{ background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
            <h4>图例说明</h4>
            <p>
              <span style={{ color: '#4f46e5' }}>●</span> 主函数曲线 f(x)<br/>
              <span style={{ color: '#f59e0b' }}>--</span> ε 带：y = L ± ε 范围内的水平带<br/>
              <span style={{ color: '#10b981' }}>|</span> δ 带：x = x₀ ± δ 范围内的垂直带<br/>
              <span style={{ color: '#ef4444' }}>●</span> 极限点 (x₀, f(x₀))
            </p>
          </div>
        </>
      )}
      </div>
    </div>
  )
}
