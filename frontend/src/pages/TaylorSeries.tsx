import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Plot from 'react-plotly.js'
import type { Data, Layout } from 'plotly.js'
import { taylorApi, TaylorRequest, TaylorData, TaylorEvaluateData } from '../services/api/taylor'
import { debounce } from '../utils/timing'
import { isValidFunctionExpression } from '../utils/math'
import { extendDomain } from '../utils/plot'
import PageHeader from '../components/PageHeader'
import ControlPanel from '../components/ControlPanel'
import VisualizationCard from '../components/VisualizationCard'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import VisualizationWorkspace from '../components/VisualizationWorkspace'
import CollapsibleSection from '../components/CollapsibleSection'

interface Preset {
  label: string
  value: string
  x0: number
  domain: [number, number]
  description: string
  maxOrder: number
}

const PRESETS: Preset[] = [
  {
    label: 'sin(x)',
    value: 'sin(x)',
    x0: 0,
    domain: [-6, 6],
    description: '奇函数，仅在奇次幂出现项',
    maxOrder: 7,
  },
  {
    label: 'cos(x)',
    value: 'cos(x)',
    x0: 0,
    domain: [-6, 6],
    description: '偶函数，仅在偶次幂出现项',
    maxOrder: 8,
  },
  {
    label: 'eˣ',
    value: 'exp(x)',
    x0: 0,
    domain: [-3, 3],
    description: '所有阶导数在 0 处均为 1',
    maxOrder: 6,
  },
  {
    label: 'ln(1+x)',
    value: 'log(1+x)',
    x0: 0,
    domain: [-0.9, 2],
    description: '在 x = -1 有分支点，收敛半径为 1',
    maxOrder: 6,
  },
  {
    label: '1/(1-x)',
    value: '1/(1-x)',
    x0: 0,
    domain: [-2, 2],
    description: '几何级数，在 x = 1 有极点',
    maxOrder: 8,
  },
  {
    label: 'x² 在 x=1',
    value: 'x**2',
    x0: 1,
    domain: [-1, 3],
    description: '二次多项式，2 阶泰勒展开即精确',
    maxOrder: 4,
  },
]

const TAYLOR_EXTEND_RATIO = 0.2
const ANIMATION_SPEEDS = [
  { label: '慢', value: 800 },
  { label: '中', value: 400 },
  { label: '快', value: 150 },
]

export default function TaylorSeries() {
  const [request, setRequest] = useState<TaylorRequest>({
    function: 'sin(x)',
    x0: 0,
    max_order: 5,
    domain_range: [-6, 6],
  })
  const [taylorData, setTaylorData] = useState<TaylorData | null>(null)
  const [evalData, setEvalData] = useState<TaylorEvaluateData | null>(null)
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set([0, 1, 2, 3]))
  const [currentOrder, setCurrentOrder] = useState(3)
  const [showRemainder, setShowRemainder] = useState(false)
  const [showTermContributions, setShowTermContributions] = useState(false)
  const [evalPoint, setEvalPoint] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentRange, setCurrentRange] = useState<[number, number]>([-6, 6])
  const [isUpdating, setIsUpdating] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [animationOrder, setAnimationOrder] = useState(0)
  const [animationSpeed, setAnimationSpeed] = useState(400)
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const plotRef = useRef<any>(null)

  const displayOrders = useMemo(() => {
    if (isAnimating) {
      return new Set(Array.from({ length: animationOrder + 1 }, (_, i) => i))
    }
    return selectedOrders
  }, [isAnimating, animationOrder, selectedOrders])

  const fetchTaylorData = useCallback(
    async (range?: [number, number], isManual = false) => {
      if (!isValidFunctionExpression(request.function)) {
        if (isManual) setError('请输入有效的函数表达式（包含变量 x）')
        setIsUpdating(false)
        return
      }

      setIsUpdating(true)
      setError(null)
      const activeRange = range || request.domain_range
      const extendedRange = extendDomain(
        activeRange as [number, number],
        TAYLOR_EXTEND_RATIO,
        [-10, 10]
      )

      try {
        const response = await taylorApi.taylor({
          ...request,
          domain_range: extendedRange,
        })
        if (response.success) {
          setTaylorData(response.data)
          setCurrentRange(activeRange as [number, number])
          // 默认评估点：展开点右侧约 1/4 处
          const defaultEval = request.x0 + (activeRange[1] - activeRange[0]) * 0.25
          setEvalPoint((prev) => prev ?? defaultEval)
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

  const fetchEvalData = useCallback(
    async (x: number) => {
      if (!taylorData || !isValidFunctionExpression(request.function)) return
      try {
        const response = await taylorApi.evaluate({
          function: request.function,
          x0: request.x0,
          x,
          max_order: request.max_order,
        })
        if (response.success) {
          setEvalData(response.data)
        }
      } catch (err: any) {
        // 单点评估失败不阻塞主流程
      }
    },
    [taylorData, request.function, request.x0, request.max_order]
  )

  useEffect(() => {
    setLoading(true)
    fetchTaylorData(undefined, true)
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchTaylorData(undefined, true)
  }, [request.function, request.x0, request.max_order])

  useEffect(() => {
    if (evalPoint !== null) {
      fetchEvalData(evalPoint)
    }
  }, [evalPoint, fetchEvalData])

  const handleRelayoutCore = useCallback(
    (newXRange: [number, number]) => {
      const currentWidth = currentRange[1] - currentRange[0]
      const newWidth = newXRange[1] - newXRange[0]
      const centerDiff = Math.abs(
        (currentRange[0] + currentRange[1]) / 2 - (newXRange[0] + newXRange[1]) / 2
      )

      if (newWidth > currentWidth * 1.2 || centerDiff > currentWidth * 0.3) {
        fetchTaylorData(newXRange)
      }
    },
    [currentRange, fetchTaylorData]
  )

  const handleRelayout = useCallback(
    debounce((event: any) => {
      if (!event['xaxis.range[0]'] || !event['xaxis.range[1]']) return
      const newXRange: [number, number] = [event['xaxis.range[0]'], event['xaxis.range[1]']]
      handleRelayoutCore(newXRange)
    }, 300),
    [handleRelayoutCore]
  )

  const handleInputChange = (field: keyof TaylorRequest, value: any) => {
    setRequest((prev) => ({ ...prev, [field]: value }))
  }

  const handlePresetClick = (preset: Preset) => {
    setRequest({
      function: preset.value,
      x0: preset.x0,
      max_order: preset.maxOrder,
      domain_range: preset.domain,
    })
    setSelectedOrders(new Set([0, 1, 2, Math.min(3, preset.maxOrder)]))
    setCurrentOrder(Math.min(3, preset.maxOrder))
    setAnimationOrder(0)
    stopAnimation()
  }

  const toggleOrder = (order: number) => {
    const newSelected = new Set(selectedOrders)
    if (newSelected.has(order)) {
      if (newSelected.size > 1) newSelected.delete(order)
    } else {
      newSelected.add(order)
    }
    setSelectedOrders(newSelected)
  }

  // 动画控制
  const startAnimation = () => {
    if (!taylorData) return
    setIsAnimating(true)
    setAnimationOrder(0)
    if (animationRef.current) clearInterval(animationRef.current)
    animationRef.current = setInterval(() => {
      setAnimationOrder((prev) => {
        const next = prev + 1
        if (next >= taylorData.max_order) {
          stopAnimation()
          return taylorData.max_order
        }
        return next
      })
    }, animationSpeed)
  }

  const stopAnimation = () => {
    if (animationRef.current) {
      clearInterval(animationRef.current)
      animationRef.current = null
    }
    setIsAnimating(false)
    if (taylorData) {
      setAnimationOrder(taylorData.max_order)
    }
  }

  useEffect(() => {
    return () => {
      if (animationRef.current) clearInterval(animationRef.current)
    }
  }, [])

  useEffect(() => {
    stopAnimation()
  }, [request.function, request.x0, request.max_order])

  // 绘图数据
  const plotData = useMemo<Data[]>(() => {
    if (!taylorData) return []

    const plots: Data[] = []

    plots.push({
      x: taylorData.original_curve.x,
      y: taylorData.original_curve.y,
      type: 'scatter',
      mode: 'lines',
      name: 'f(x) 原函数',
      line: { color: '#4f46e5', width: 3 },
    })

    plots.push({
      x: [taylorData.x0],
      y: [taylorData.f_x0],
      type: 'scatter',
      mode: 'markers',
      name: `x₀ = ${taylorData.x0}`,
      marker: { color: '#4f46e5', size: 12, symbol: 'circle' },
    })

    taylorData.taylor_polynomials.forEach((poly) => {
      if (displayOrders.has(poly.order)) {
        plots.push({
          x: poly.x,
          y: poly.y,
          type: 'scatter',
          mode: 'lines',
          name: poly.name,
          line: { color: poly.color, width: 2 },
        })
      }
    })

    if (showTermContributions && !isAnimating) {
      taylorData.coefficients.forEach((coeff, idx) => {
        if (coeff.coefficient === null || Math.abs(coeff.coefficient) < 1e-12) return
        const color = taylorData.taylor_polynomials[idx]?.color || '#999'
        const termY = taylorData.original_curve.x.map(
          (x) => coeff.coefficient! * (x - taylorData.x0) ** idx
        )
        plots.push({
          x: taylorData.original_curve.x,
          y: termY,
          type: 'scatter',
          mode: 'lines',
          name: `项 ${idx}: ${coeff.term_str}`,
          line: { color, width: 1, dash: 'dot' },
          opacity: 0.6,
        })
      })
    }

    if (showRemainder && displayOrders.size > 0) {
      const maxSelectedOrder = Math.max(...Array.from(displayOrders))
      const remainder = taylorData.remainder_bound.find((r) => r.order === maxSelectedOrder)
      if (remainder) {
        plots.push({
          x: remainder.x,
          y: remainder.y,
          type: 'scatter',
          mode: 'lines',
          name: `|R${maxSelectedOrder}(x)| 上界`,
          line: { color: '#ef4444', width: 1, dash: 'dot' },
        })
      }

      const actualRemainder = taylorData.actual_remainder.find((r) => r.order === maxSelectedOrder)
      if (actualRemainder) {
        plots.push({
          x: actualRemainder.x,
          y: actualRemainder.y.map((y) => (y !== null ? Math.abs(y) : null)),
          type: 'scatter',
          mode: 'lines',
          name: `实际 |R${maxSelectedOrder}(x)|`,
          line: { color: '#f59e0b', width: 2 },
          opacity: 0.8,
        })
      }
    }

    if (evalPoint !== null && evalData != null && evalData.f_x != null) {
      plots.push({
        x: [evalPoint],
        y: [evalData.f_x],
        type: 'scatter',
        mode: 'markers',
        name: `评估点 x = ${evalPoint.toFixed(2)}`,
        marker: { color: '#dc2626', size: 12, symbol: 'diamond' },
      })

      const maxOrder = Math.max(...Array.from(displayOrders))
      const approx = evalData.approximations.find((a) => a.order === maxOrder)
      if (approx) {
        plots.push({
          x: [evalPoint, evalPoint],
          y: [approx.value, evalData.f_x],
          type: 'scatter',
          mode: 'lines',
          name: '近似误差',
          line: { color: '#dc2626', width: 2, dash: 'dash' },
          opacity: 0.6,
        })
      }
    }

    return plots
  }, [
    taylorData,
    displayOrders,
    showRemainder,
    showTermContributions,
    evalPoint,
    evalData,
    currentRange,
    isAnimating,
  ])

  const layout: Partial<Layout> = useMemo(() => {
    if (!taylorData) return {}

    const shapes: any[] = []

    // 收敛半径边界
    if (taylorData.convergence.radius_of_convergence !== null) {
      shapes.push(
        {
          type: 'line',
          x0: taylorData.x0 - taylorData.convergence.radius_of_convergence,
          x1: taylorData.x0 - taylorData.convergence.radius_of_convergence,
          y0: 0,
          y1: 1,
          yref: 'paper',
          line: { color: 'rgba(239, 68, 68, 0.4)', width: 2, dash: 'dash' },
        },
        {
          type: 'line',
          x0: taylorData.x0 + taylorData.convergence.radius_of_convergence,
          x1: taylorData.x0 + taylorData.convergence.radius_of_convergence,
          y0: 0,
          y1: 1,
          yref: 'paper',
          line: { color: 'rgba(239, 68, 68, 0.4)', width: 2, dash: 'dash' },
        }
      )
    }

    // 奇点标记
    taylorData.convergence.singularities.forEach((s) => {
      if (s.x >= currentRange[0] && s.x <= currentRange[1]) {
        shapes.push({
          type: 'line',
          x0: s.x,
          x1: s.x,
          y0: 0,
          y1: 1,
          yref: 'paper',
          line: { color: 'rgba(0, 0, 0, 0.5)', width: 1, dash: 'dot' },
        })
      }
    })

    return {
      title: {
        text: `泰勒展开: ${request.function} 在 x₀ = ${taylorData.x0}`,
        font: { size: 15 },
      },
      xaxis: {
        title: { text: 'x' },
        autorange: true,
        zeroline: true,
        showspikes: false,
      },
      yaxis: {
        title: { text: 'y' },
        autorange: true,
        zeroline: true,
        showspikes: false,
      },
      showlegend: true,
      legend: { x: 0.02, y: 0.98, font: { size: 11 } },
      dragmode: 'pan',
      margin: { t: 50, r: 20, b: 50, l: 60 },
      autosize: true,
      shapes,
    }
  }, [taylorData, request.function, currentRange])

  const getCurrentFormula = (): string => {
    if (!taylorData || !displayOrders.has(currentOrder)) return ''
    const poly = taylorData.taylor_polynomials.find((p) => p.order === currentOrder)
    return poly?.formula || ''
  }

  const handleEvalPointChange = (value: number) => {
    const [min, max] = currentRange
    const clamped = Math.max(min, Math.min(max, value))
    setEvalPoint(clamped)
  }

  return (
    <div className="detail-page">
      <PageHeader
        backTo="/subject/calculus"
        backLabel="返回微积分"
        breadcrumbs={[
          { label: '首页', path: '/' },
          { label: '微积分', path: '/subject/calculus' },
          { label: '泰勒公式' },
        ]}
        title="泰勒公式可视化"
      />

      <VisualizationWorkspace
        visualizationTitle="泰勒多项式逼近"
        controls={
          <>
            {error && <ErrorState message={error} />}
            <ControlPanel title="参数设置" subtitle="选择函数、展开点与阶数">
              <div className="form-section">
                <label className="form-label">预设函数</label>
                <div className="preset-group">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      className={`preset-chip ${request.function === preset.value && request.x0 === preset.x0 ? 'active' : ''}`}
                      onClick={() => handlePresetClick(preset)}
                      title={preset.description}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
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

              <div className="form-row">
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

              <div className="form-section">
                <label className="form-label">动画演示</label>
                <div className="form-row">
                  <button
                    className="btn btn-primary"
                    onClick={isAnimating ? stopAnimation : startAnimation}
                    disabled={!taylorData}
                    style={{
                      flex: 1,
                      background: isAnimating ? 'var(--warning)' : undefined,
                    }}
                  >
                    {isAnimating ? '停止' : '构建多项式'}
                  </button>
                  <select
                    value={animationSpeed}
                    onChange={(e) => setAnimationSpeed(parseInt(e.target.value))}
                    disabled={isAnimating}
                    style={{ flex: 1 }}
                  >
                    {ANIMATION_SPEEDS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="form-helper" style={{ marginTop: 'var(--space-2)' }}>
                  按阶数逐步展示 T₀, T₁, T₂ … 的构建过程
                </p>
              </div>

              <div className="form-section">
                <label className="form-label">单点评估</label>
                <div className="slider-container">
                  <span>x</span>
                  <input
                    type="range"
                    min={currentRange[0]}
                    max={currentRange[1]}
                    step={(currentRange[1] - currentRange[0]) / 200}
                    value={evalPoint ?? request.x0}
                    onChange={(e) => handleEvalPointChange(parseFloat(e.target.value))}
                  />
                  <span className="slider-value">{evalPoint?.toFixed(2) ?? request.x0}</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={evalPoint ?? ''}
                  onChange={(e) => handleEvalPointChange(parseFloat(e.target.value))}
                  style={{ marginTop: 'var(--space-2)', width: '100%' }}
                />
              </div>
            </ControlPanel>
          </>
        }
        visualization={
          <>
            {loading && !taylorData && <LoadingState text="正在计算泰勒展开..." />}
            {taylorData && (
              <VisualizationCard
                title="泰勒多项式逼近"
                subtitle="多项式阶数越高，在展开点附近的逼近效果越好"
                loading={isUpdating}
              >
                <div style={{ position: 'absolute', inset: 0, padding: 'var(--space-2)' }}>
                  <Plot
                    ref={plotRef}
                    data={plotData}
                    layout={layout}
                    config={{ responsive: true, scrollZoom: true }}
                    onRelayout={handleRelayout}
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              </VisualizationCard>
            )}
            {!taylorData && !loading && (
              <div className="empty-state">
                <div className="empty-state-icon">📈</div>
                <p>输入函数并调整参数，开始探索泰勒展开</p>
              </div>
            )}
          </>
        }
        infoPanels={
          taylorData ? (
            <>
              <CollapsibleSection
                title="阶数选择"
                defaultExpanded={true}
                rightAction={
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        setSelectedOrders(
                          new Set(taylorData.taylor_polynomials.map((p) => p.order))
                        )
                      }}
                    >
                      全选
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        setSelectedOrders(new Set([currentOrder]))
                      }}
                    >
                      仅当前
                    </button>
                  </div>
                }
              >
                <div className="preset-group" style={{ marginBottom: 'var(--space-3)' }}>
                  {taylorData.taylor_polynomials.map((poly) => (
                    <button
                      key={poly.order}
                      className={`preset-chip ${displayOrders.has(poly.order) ? 'active' : ''}`}
                      onClick={() => toggleOrder(poly.order)}
                      disabled={isAnimating}
                    >
                      {poly.name}
                    </button>
                  ))}
                </div>

                <div className="slider-container" style={{ marginBottom: 'var(--space-3)' }}>
                  <span>当前阶数</span>
                  <input
                    type="range"
                    min="0"
                    max={taylorData.max_order}
                    value={currentOrder}
                    onChange={(e) => setCurrentOrder(parseInt(e.target.value))}
                    style={{ flex: 1 }}
                    disabled={isAnimating}
                  />
                  <span className="slider-value">T{currentOrder}(x)</span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
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
                      checked={showRemainder}
                      onChange={(e) => setShowRemainder(e.target.checked)}
                    />
                    显示余项
                  </label>
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
                      checked={showTermContributions}
                      onChange={(e) => setShowTermContributions(e.target.checked)}
                    />
                    显示各项贡献
                  </label>
                </div>
              </CollapsibleSection>

              {getCurrentFormula() && (
                <CollapsibleSection title={`T${currentOrder}(x) 多项式`} defaultExpanded={true}>
                  <div className="formula-display">
                    T<sub>{currentOrder}</sub>(x) = {getCurrentFormula()}
                  </div>
                </CollapsibleSection>
              )}

              {evalData && evalData.f_x !== null && (
                <CollapsibleSection
                  title={`单点逼近评估 (x = ${evalData.x.toFixed(3)})`}
                  defaultExpanded={true}
                >
                  <div className="info-grid" style={{ marginBottom: 'var(--space-3)' }}>
                    <div className="info-item">
                      <span>真实值 f(x)</span>
                      <span style={{ fontWeight: 'bold' }}>{evalData.f_x.toFixed(6)}</span>
                    </div>
                    <div className="info-item">
                      <span>最佳逼近阶数</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>
                        T{evalData.best_order}(x)
                      </span>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>阶数</th>
                          <th>Tₙ(x)</th>
                          <th>实际误差</th>
                          <th>余项上界</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evalData.approximations.map((a) => (
                          <tr
                            key={a.order}
                            className={
                              a.order === Math.max(...Array.from(displayOrders)) ? 'highlight' : ''
                            }
                          >
                            <td>T{a.order}(x)</td>
                            <td>{a.value.toFixed(6)}</td>
                            <td
                              style={{
                                color:
                                  a.error !== null && a.error < 0.001
                                    ? 'var(--success)'
                                    : 'var(--warning)',
                              }}
                            >
                              {a.error?.toExponential(3) ?? 'N/A'}
                            </td>
                            <td>{a.remainder_bound?.toExponential(3) ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CollapsibleSection>
              )}

              <CollapsibleSection title="泰勒系数" defaultExpanded={false}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>阶数 n</th>
                        <th>f⁽ⁿ⁾(x₀)</th>
                        <th>n!</th>
                        <th>系数 f⁽ⁿ⁾(x₀)/n!</th>
                        <th>项</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taylorData.coefficients.map((c) => (
                        <tr key={c.order}>
                          <td>{c.order}</td>
                          <td>
                            {c.derivative_value !== null ? c.derivative_value.toFixed(4) : '—'}
                          </td>
                          <td>{c.factorial}</td>
                          <td style={{ fontWeight: 'bold' }}>
                            {c.coefficient !== null ? c.coefficient.toFixed(6) : '—'}
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                            {c.term_str}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="form-helper" style={{ marginTop: 'var(--space-3)' }}>
                  泰勒公式：f(x) = Σₙ₌₀^∞ f⁽ⁿ⁾(x₀)/n! · (x - x₀)ⁿ
                </p>
              </CollapsibleSection>

              <CollapsibleSection title="收敛性分析" defaultExpanded={false}>
                <div className="info-grid">
                  <div className="info-item">
                    <span>收敛半径 R</span>
                    <span style={{ fontWeight: 'bold' }}>
                      {taylorData.convergence.radius_of_convergence !== null
                        ? taylorData.convergence.radius_of_convergence.toFixed(4)
                        : '∞'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span>展开区间</span>
                    <span>
                      {`(${(taylorData.x0 - (taylorData.convergence.radius_of_convergence ?? 0)).toFixed(3)}, ${(taylorData.x0 + (taylorData.convergence.radius_of_convergence ?? 0)).toFixed(3)})`}
                    </span>
                  </div>
                  {taylorData.convergence.nearest_singularity && (
                    <div className="info-item">
                      <span>最近奇点</span>
                      <span style={{ color: 'var(--danger)' }}>
                        x = {taylorData.convergence.nearest_singularity.x.toFixed(4)} (
                        {taylorData.convergence.nearest_singularity.type})
                      </span>
                    </div>
                  )}
                </div>
                <div className="insight-box">{taylorData.convergence.summary}</div>
                <p className="form-helper" style={{ marginTop: 'var(--space-3)' }}>
                  在收敛半径内，泰勒级数收敛到原函数；超出半径通常发散。图中红色虚线标示收敛区间边界。
                </p>
              </CollapsibleSection>
            </>
          ) : null
        }
      />
    </div>
  )
}
