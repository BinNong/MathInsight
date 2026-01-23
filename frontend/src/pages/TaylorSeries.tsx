import { useState, useEffect, useCallback, useRef } from 'react'
import Plot from 'react-plotly.js'
import { taylorApi, TaylorRequest, TaylorData } from '../services/api'
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
  const cleaned = expr.trim().replace(/\s+/g, '')
  const validPattern = /^[\d\.\+\-\*\/\(\)\[\]\{\}xyzXYZ\s,\^aAbBcCdDeEgGiIlLnNoOpPrRsStTuU]+$/i
  if (!validPattern.test(cleaned)) return false
  return /[xXyYzZ]/.test(cleaned)
}

// 预设函数
const PRESET_FUNCTIONS = [
  { label: 'sin(x)', value: 'sin(x)', x0: 0 },
  { label: 'cos(x)', value: 'cos(x)', x0: 0 },
  { label: 'e^x', value: 'exp(x)', x0: 0 },
  { label: 'ln(1+x)', value: 'log(1+x)', x0: 0 },
  { label: 'x^2', value: 'x**2', x0: 1 },
  { label: '1/(1-x)', value: '1/(1-x)', x0: 0 }
]

const defaultRequest: TaylorRequest = {
  function: 'sin(x)',
  x0: 0,
  max_order: 5,
  domain_range: [-3, 3]
}

// 扩展绘图范围比例
const EXTEND_RATIO = 0.2

export default function TaylorSeries() {
  const [request, setRequest] = useState<TaylorRequest>(defaultRequest)
  const [taylorData, setTaylorData] = useState<TaylorData | null>(null)
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set([0, 1, 2, 3]))
  const [currentOrder, setCurrentOrder] = useState(3)
  const [showRemainder, setShowRemainder] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentRange, setCurrentRange] = useState<[number, number]>([-3, 3])
  const plotRef = useRef<any>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  const fetchTaylorData = useCallback(async (range?: [number, number], isManual = false) => {
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
      Math.max(activeRange[0] - EXTEND_RATIO, -10),
      Math.min(activeRange[1] + EXTEND_RATIO, 10)
    ] as [number, number]

    try {
      const response = await taylorApi.taylor({
        ...request,
        domain_range: extendedRange
      })
      if (response.success) {
        setTaylorData(response.data)
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
    fetchTaylorData(undefined, true)
  }, [])

  // 参数变化时重新获取
  useEffect(() => {
    setLoading(true)
    fetchTaylorData(undefined, true)
  }, [request.function, request.x0, request.max_order])

  // 处理 Plotly 缩放/平移事件（防抖）
  const handleRelayoutCore = useCallback((newXRange: [number, number]) => {
    const currentWidth = currentRange[1] - currentRange[0]
    const newWidth = newXRange[1] - newXRange[0]
    const centerDiff = Math.abs((currentRange[0] + currentRange[1]) / 2 - (newXRange[0] + newXRange[1]) / 2)

    if (newWidth > currentWidth * 1.2 || centerDiff > currentWidth * 0.3) {
      fetchTaylorData(newXRange)
    }
  }, [currentRange, fetchTaylorData])

  const handleRelayout = useCallback(debounce((event: any) => {
    if (!event['xaxis.range[0]'] || !event['xaxis.range[1]']) return
    const newXRange: [number, number] = [
      event['xaxis.range[0]'],
      event['xaxis.range[1]']
    ]
    handleRelayoutCore(newXRange)
  }, 300), [handleRelayoutCore])

  const handleInputChange = (field: keyof TaylorRequest, value: any) => {
    setRequest(prev => ({ ...prev, [field]: value }))
  }

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = PRESET_FUNCTIONS.find(p => p.label === e.target.value)
    if (preset) {
      setRequest(prev => ({
        ...prev,
        function: preset.value,
        x0: preset.x0
      }))
    }
  }

  const toggleOrder = (order: number) => {
    const newSelected = new Set(selectedOrders)
    if (newSelected.has(order)) {
      if (newSelected.size > 1) {
        newSelected.delete(order)
      }
    } else {
      newSelected.add(order)
    }
    setSelectedOrders(newSelected)
  }

  // 构建绘图数据
  const getPlotData = (): any[] => {
    if (!taylorData) return []

    const plots: any[] = []

    // 原函数曲线
    plots.push({
      x: taylorData.original_curve.x,
      y: taylorData.original_curve.y,
      type: 'scatter',
      mode: 'lines',
      name: 'f(x) 原函数',
      line: { color: '#4f46e5', width: 3 }
    })

    // 标记展开点
    plots.push({
      x: [taylorData.x0],
      y: [taylorData.f_x0],
      type: 'scatter',
      mode: 'markers',
      name: `x₀ = ${taylorData.x0}`,
      marker: { color: '#4f46e5', size: 12, symbol: 'circle' }
    })

    // 选中的泰勒多项式
    taylorData.taylor_polynomials.forEach((poly) => {
      if (selectedOrders.has(poly.order)) {
        plots.push({
          x: poly.x,
          y: poly.y,
          type: 'scatter',
          mode: 'lines',
          name: poly.name,
          line: { color: poly.color, width: 2 }
        })
      }
    })

    // 余项边界（如果启用）
    if (showRemainder && selectedOrders.size > 0) {
      const maxSelectedOrder = Math.max(...Array.from(selectedOrders))
      const remainder = taylorData.remainder_bound.find(r => r.order === maxSelectedOrder)
      if (remainder) {
        // 上边界
        plots.push({
          x: remainder.x,
          y: remainder.y,
          type: 'scatter',
          mode: 'lines',
          name: `R${maxSelectedOrder}(x) 界`,
          line: { color: '#ef4444', width: 1, dash: 'dot' }
        })
        // 下边界（对称）
        plots.push({
          x: remainder.x,
          y: remainder.y.map(y => y !== null ? -y : null),
          type: 'scatter',
          mode: 'lines',
          name: `-R${maxSelectedOrder}(x)`,
          line: { color: '#ef4444', width: 1, dash: 'dot' },
          showlegend: false
        })
      }

      // 实际余项曲线（最高选中阶数）
      const actualRemainder = taylorData.actual_remainder.find(r => r.order === maxSelectedOrder)
      if (actualRemainder) {
        plots.push({
          x: actualRemainder.x,
          y: actualRemainder.y,
          type: 'scatter',
          mode: 'lines',
          name: `实际余项 R${maxSelectedOrder}(x)`,
          line: { color: '#f59e0b', width: 2 },
          opacity: 0.8
        })
      }
    }

    return plots
  }

  // 获取当前选中阶数的泰勒公式
  const getCurrentFormula = (): string => {
    if (!taylorData || !selectedOrders.has(currentOrder)) return ''
    const poly = taylorData.taylor_polynomials.find(p => p.order === currentOrder)
    return poly?.formula || ''
  }

  const layout: any = taylorData ? {
    title: {
      text: `泰勒公式: ${request.function} 在 x₀ = ${taylorData.x0}`,
      font: { size: 16 }
    },
    xaxis: {
      title: 'x',
      autorange: true,
      zeroline: true,
      showspikes: false
    },
    yaxis: {
      title: 'y',
      autorange: true,
      zeroline: true,
      showspikes: false
    },
    showlegend: true,
    legend: { x: 0.02, y: 0.98, font: { size: 11 } },
    dragmode: 'pan',
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
          <span>泰勒公式</span>
        </div>
        <h1 className="detail-title">泰勒公式可视化</h1>
      </header>

      <div className="content-card" style={{ margin: '2rem', maxWidth: '1400px' }}>
        <div className="card-header">
          <h2>泰勒公式可视化</h2>
          <p>理解泰勒多项式如何逐步逼近原函数：Tₙ(x) = f(x₀) + f'(x₀)(x-x₀) + f''(x₀)/2!(x-x₀)² + ...</p>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>预设函数</label>
            <select onChange={handlePresetChange} defaultValue="">
              <option value="">选择预设函数...</option>
              {PRESET_FUNCTIONS.map(p => (
                <option key={p.label} value={p.label}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>函数 f(x)</label>
            <input
              type="text"
              value={request.function}
              onChange={(e) => handleInputChange('function', e.target.value)}
              placeholder="例如: sin(x), x**2, exp(x)"
            />
          </div>
          <div className="form-group">
            <label>展开点 x₀</label>
            <input
              type="number"
              step="0.1"
              value={request.x0}
              onChange={(e) => handleInputChange('x0', parseFloat(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>最大阶数</label>
            <input
              type="number"
              min="0"
              max="10"
              value={request.max_order}
              onChange={(e) => handleInputChange('max_order', parseInt(e.target.value))}
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

        {error && <div className="error-message">
          <span style={{ marginRight: '8px' }}>⚠️</span>
          {error}
        </div>}

        {loading && !taylorData && (
          <div className="loading">加载中...</div>
        )}

        {taylorData && (
          <>
            {/* 阶数选择器 */}
            <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <div style={{ marginBottom: '0.75rem', fontWeight: 500 }}>选择显示的泰勒多项式阶数：</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                {taylorData.taylor_polynomials.map((poly) => (
                  <button
                    key={poly.order}
                    className={`btn ${selectedOrders.has(poly.order) ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => toggleOrder(poly.order)}
                    style={{ minWidth: '60px' }}
                  >
                    {poly.name}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>当前展示阶数:</span>
                  <input
                    type="range"
                    min="0"
                    max={taylorData.max_order}
                    value={currentOrder}
                    onChange={(e) => setCurrentOrder(parseInt(e.target.value))}
                    style={{ width: '150px' }}
                  />
                  <span style={{ fontWeight: 500, color: 'var(--primary)' }}>{currentOrder} 阶</span>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showRemainder}
                    onChange={(e) => setShowRemainder(e.target.checked)}
                  />
                  <span>显示余项分析</span>
                </label>
              </div>
            </div>

            {/* 绘图区域 */}
            <div className="visualization-container">
              {isUpdating && (
                <div className="updating-overlay">更新中...</div>
              )}
              <Plot
                ref={plotRef}
                data={getPlotData()}
                layout={{ ...layout, width: 900, height: 550 }}
                config={{ responsive: true, scrollZoom: true }}
                onRelayout={handleRelayout}
              />
            </div>

            {/* 泰勒公式显示 */}
            {getCurrentFormula() && (
              <div className="info-panel" style={{ marginTop: '1rem' }}>
                <h4>T{currentOrder}(x) 泰勒多项式</h4>
                <div style={{
                  padding: '1rem',
                  background: 'var(--bg-primary)',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '1.1rem',
                  textAlign: 'center',
                  overflowX: 'auto'
                }}>
                  T{currentOrder}(x) = {getCurrentFormula()}
                </div>
              </div>
            )}

            {/* 多项式详细信息 */}
            <div className="info-panel" style={{ marginTop: '1rem' }}>
              <h4>泰勒多项式详情</h4>
              {taylorData.taylor_polynomials.map((poly) => (
                <div
                  key={poly.order}
                  className="info-item"
                  style={{
                    padding: '0.75rem',
                    background: selectedOrders.has(poly.order) ? 'var(--bg-secondary)' : 'transparent',
                    borderRadius: '6px',
                    marginBottom: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: poly.color
                      }}
                    />
                    <span style={{ fontWeight: 500, minWidth: '60px' }}>{poly.name}:</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.9rem', flex: 1 }}>
                      {poly.formula}
                    </span>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <h5 style={{ marginBottom: '0.5rem' }}>拉格朗日余项</h5>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Rₙ(x) = f⁽ⁿ⁺¹⁾(ξ) / (n+1)! × (x - x₀)ⁿ⁺¹, 其中 ξ 在 x 和 x₀ 之间
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  观察：当 n 增大时，泰勒多项式在 x₀ 附近对原函数的逼近效果越好。
                  在距离 x₀ 较远处，高阶项仍然是必要的以维持良好的逼近精度。
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
