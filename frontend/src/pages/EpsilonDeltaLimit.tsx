import { useState, useEffect, useCallback, useRef } from 'react'
import Plot from 'react-plotly.js'
import { calculusApi, EpsilonDeltaRequest } from '../services/api'
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
    f_x0: number | null
    defined: boolean
  }
  delta_values: {
    delta: number
    epsilon: number
    f_left: number | null
    f_right: number | null
  }
  verification: {
    valid: boolean
    samples: number
    satisfied: number
    max_deviation: number
    violations: Array<{ x: number; y: number; deviation: number }>
  }
  side_limits: {
    left: number | null
    right: number | null
    two_sided: number | null
    exists: boolean
  }
  approach_points: Array<{ x: number; y: number; side: string }>
  domain_range: number[]
  definition_state: {
    x0: number
    L: number
    epsilon: number
    delta: number
    x0_defined: boolean
  }
}

interface LimitExample {
  name: string
  function: string
  x0: number
  L: number
  description: string
}

const EXAMPLES: LimitExample[] = [
  {
    name: 'x² → 4',
    function: 'x**2',
    x0: 2,
    L: 4,
    description: '连续函数的标准极限',
  },
  {
    name: 'sin(x)/x → 1',
    function: 'sin(x)/x',
    x0: 0,
    L: 1,
    description: '经典可去间断点',
  },
  {
    name: '(x²-4)/(x-2) → 4',
    function: '(x**2-4)/(x-2)',
    x0: 2,
    L: 4,
    description: '约分后极限存在',
  },
  {
    name: '√x → 1',
    function: 'sqrt(x)',
    x0: 1,
    L: 1,
    description: '单侧定义域',
  },
  {
    name: '1/x 不存在',
    function: '1/x',
    x0: 0,
    L: 0,
    description: '左右极限不相等',
  },
]

const defaultRequest: EpsilonDeltaRequest = {
  function: 'x**2',
  x0: 2,
  L: 4,
  epsilon: 0.5,
  domain_range: [-1, 5],
}

const STEPS = [
  {
    title: '极限表达式',
    description: 'lim(x→x₀) f(x) = L 表示：当 x 无限接近 x₀ 时，f(x) 无限接近 L。',
  },
  {
    title: '设定误差 ε',
    description: 'ε 是我们允许的 f(x) 与 L 之间的误差范围。在图上表现为 L 上下方的水平带。',
  },
  {
    title: '找到 δ',
    description:
      '系统自动寻找一个 δ，使得只要 x 落在 x₀ 两侧宽为 2δ 的区间内，f(x) 就落在 ε 带内。',
  },
  {
    title: '动画验证',
    description: '播放动画，观察 x 从两侧趋近 x₀ 时，对应的 f(x) 是否始终落在 ε 带内。',
  },
]

export default function EpsilonDeltaLimit() {
  const [request, setRequest] = useState<EpsilonDeltaRequest>(defaultRequest)
  const [data, setData] = useState<EpsilonDeltaData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentRange, setCurrentRange] = useState<[number, number]>([-1, 5])
  const plotRef = useRef<any>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isComputingLimit, setIsComputingLimit] = useState(false)
  const isManualLRef = useRef(false)

  // 教学交互状态
  const [activeStep, setActiveStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [animationIndex, setAnimationIndex] = useState(0)
  const [animationSpeed, setAnimationSpeed] = useState(1)
  const animationRef = useRef<NodeJS.Timeout | null>(null)

  const fetchData = useCallback(
    async (range?: [number, number], isManual = false) => {
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
      const extendedRange = extendDomain(activeRange as [number, number])
      try {
        const response = await calculusApi.epsilonDelta({
          ...request,
          domain_range: extendedRange,
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
    },
    [request]
  )

  const autoComputeLimit = useCallback(
    debounce(async () => {
      if (!isValidFunctionExpression(request.function)) return
      if (isManualLRef.current) return

      setIsComputingLimit(true)
      try {
        const response = await calculusApi.computeLimit(request.function, request.x0)
        if (response.success) {
          setRequest((prev) => ({ ...prev, L: response.data.L }))
        }
      } catch (err) {
        // 计算失败时忽略，不显示错误
      } finally {
        setIsComputingLimit(false)
      }
    }, 500),
    [request.function, request.x0]
  )

  useEffect(() => {
    setLoading(true)
    autoComputeLimit()
  }, [])

  useEffect(() => {
    autoComputeLimit()
  }, [request.function, request.x0])

  useEffect(() => {
    setLoading(true)
    fetchData(undefined, true)
  }, [request.function, request.x0, request.L, request.epsilon])

  // 动画控制
  useEffect(() => {
    if (!isPlaying || !data) return

    // 将左右趋近点交错，使两侧同时向 x₀ 移动
    const left = data.approach_points.filter((p) => p.side === 'left')
    const right = data.approach_points.filter((p) => p.side === 'right')
    const combined: Array<{ x: number; y: number; side: string }> = []
    const len = Math.max(left.length, right.length)
    for (let i = 0; i < len; i++) {
      if (left[i]) combined.push(left[i])
      if (right[i]) combined.push(right[i])
    }
    if (combined.length === 0) return

    const total = combined.length
    const interval = Math.max(50, 300 / animationSpeed)

    animationRef.current = setInterval(() => {
      setAnimationIndex((prev) => {
        if (prev >= total - 1) {
          setIsPlaying(false)
          return total - 1
        }
        return prev + 1
      })
    }, interval)

    return () => {
      if (animationRef.current) clearInterval(animationRef.current)
    }
  }, [isPlaying, data, animationSpeed])

  // 数据更新时重置动画
  useEffect(() => {
    setAnimationIndex(0)
    setIsPlaying(false)
  }, [data])

  const handleRelayoutCore = useCallback(
    (newXRange: [number, number]) => {
      const currentWidth = currentRange[1] - currentRange[0]
      const newWidth = newXRange[1] - newXRange[0]
      const centerDiff = Math.abs(
        (currentRange[0] + currentRange[1]) / 2 - (newXRange[0] + newXRange[1]) / 2
      )

      if (newWidth > currentWidth * 1.2 || centerDiff > currentWidth * 0.3) {
        fetchData(newXRange)
      }
    },
    [currentRange, fetchData]
  )

  const handleRelayout = useCallback(
    debounce((event: any) => {
      if (!event['xaxis.range[0]'] || !event['xaxis.range[1]']) return
      const newXRange: [number, number] = [event['xaxis.range[0]'], event['xaxis.range[1]']]
      handleRelayoutCore(newXRange)
    }, 300),
    [handleRelayoutCore]
  )

  const handleInputChange = (field: keyof EpsilonDeltaRequest, value: any) => {
    if (field === 'L') {
      isManualLRef.current = true
    }
    setRequest((prev) => ({ ...prev, [field]: value }))
  }

  const resetToAutoCompute = () => {
    isManualLRef.current = false
    autoComputeLimit()
  }

  const applyExample = (example: LimitExample) => {
    isManualLRef.current = true
    setRequest((prev) => ({
      ...prev,
      function: example.function,
      x0: example.x0,
      L: example.L,
      domain_range: [example.x0 - 2, example.x0 + 2],
    }))
  }

  const togglePlay = () => {
    if (!data || data.approach_points.length === 0) return
    if (animationIndex >= data.approach_points.length - 1) {
      setAnimationIndex(0)
    }
    setIsPlaying((prev) => !prev)
  }

  const resetAnimation = () => {
    setIsPlaying(false)
    setAnimationIndex(0)
  }

  // 将左右两侧趋近点交错，实现两侧同时向 x₀ 移动的效果
  const interleavedApproachPoints = data
    ? (() => {
        const left = data.approach_points.filter((p) => p.side === 'left')
        const right = data.approach_points.filter((p) => p.side === 'right')
        const combined: Array<{ x: number; y: number; side: string }> = []
        const len = Math.max(left.length, right.length)
        for (let i = 0; i < len; i++) {
          if (left[i]) combined.push(left[i])
          if (right[i]) combined.push(right[i])
        }
        return combined
      })()
    : []

  // 计算当前动画点
  const currentApproachPoints = interleavedApproachPoints.slice(0, animationIndex + 1)
  const latestPoint = currentApproachPoints[currentApproachPoints.length - 1] || null

  // 分割函数曲线：δ 区间内/外
  const functionCurveSegments: {
    inBand: { x: number[]; y: number[] }
    outBand: { x: number[]; y: number[] }
  } | null = data
    ? (() => {
        const inBandX: number[] = []
        const inBandY: number[] = []
        const outBandX: number[] = []
        const outBandY: number[] = []
        const { x_left, x_right } = data.delta_band
        data.function_curve.x.forEach((xv, i) => {
          const yv = data.function_curve.y[i]
          if (yv === null || yv === undefined) return
          if (xv >= x_left && xv <= x_right) {
            inBandX.push(xv)
            inBandY.push(yv)
            outBandX.push(NaN)
            outBandY.push(NaN)
          } else {
            outBandX.push(xv)
            outBandY.push(yv)
            inBandX.push(NaN)
            inBandY.push(NaN)
          }
        })
        return { inBand: { x: inBandX, y: inBandY }, outBand: { x: outBandX, y: outBandY } }
      })()
    : null

  const plotData: any[] = data
    ? [
        // δ 区间外函数曲线
        {
          x: functionCurveSegments?.outBand.x,
          y: functionCurveSegments?.outBand.y,
          type: 'scatter',
          mode: 'lines',
          name: 'f(x)',
          line: { color: '#4f46e5', width: 2 },
          hoverinfo: 'name+x+y',
        },
        // δ 区间内函数曲线（高亮）
        {
          x: functionCurveSegments?.inBand.x,
          y: functionCurveSegments?.inBand.y,
          type: 'scatter',
          mode: 'lines',
          name: 'δ 区间内 f(x)',
          line: { color: '#4f46e5', width: 4 },
          hoverinfo: 'name+x+y',
          showlegend: false,
        },
        // ε 带上限
        {
          x: data.epsilon_band.x,
          y: data.epsilon_band.upper_y,
          type: 'scatter',
          mode: 'lines',
          name: 'L + ε',
          line: { color: '#f59e0b', width: 2, dash: 'dash' },
          hoverinfo: 'y',
        },
        // ε 带下限
        {
          x: data.epsilon_band.x,
          y: data.epsilon_band.lower_y,
          type: 'scatter',
          mode: 'lines',
          name: 'L - ε',
          line: { color: '#f59e0b', width: 2, dash: 'dash' },
          hoverinfo: 'y',
        },
        // 极限点
        {
          x: [data.limit_point.x0],
          y: data.limit_point.defined ? [data.limit_point.f_x0] : [data.limit_point.L],
          type: 'scatter',
          mode: 'markers',
          name: data.limit_point.defined ? '极限点 (x₀, f(x₀))' : '极限点 (x₀ 无定义)',
          marker: {
            color: data.limit_point.defined ? '#ef4444' : '#ffffff',
            size: 14,
            symbol: 'circle',
            line: data.limit_point.defined ? undefined : { color: '#ef4444', width: 2 },
          },
          hoverinfo: 'name+x+y',
        },
        // δ 区间左边界
        {
          x: [data.delta_band.x_left, data.delta_band.x_left],
          y: data.delta_band.y_range,
          type: 'scatter',
          mode: 'lines',
          name: 'x₀ - δ',
          line: { color: '#10b981', width: 2, dash: 'dot' },
          showlegend: false,
          hoverinfo: 'x',
        },
        // δ 区间右边界
        {
          x: [data.delta_band.x_right, data.delta_band.x_right],
          y: data.delta_band.y_range,
          type: 'scatter',
          mode: 'lines',
          name: 'x₀ + δ',
          line: { color: '#10b981', width: 2, dash: 'dot' },
          showlegend: false,
          hoverinfo: 'x',
        },
        // 趋近动画轨迹点
        {
          x: currentApproachPoints.map((p) => p.x),
          y: currentApproachPoints.map((p) => p.y),
          type: 'scatter',
          mode: 'markers',
          name: '趋近过程',
          marker: {
            color: currentApproachPoints.map((p) => (p.side === 'left' ? '#8b5cf6' : '#06b6d4')),
            size: 6,
            opacity: currentApproachPoints.map(
              (_, i) => 0.3 + 0.7 * (i / (currentApproachPoints.length || 1))
            ),
          },
          showlegend: false,
          hoverinfo: 'x+y',
        },
        // 当前趋近点
        ...(latestPoint
          ? [
              {
                x: [latestPoint.x],
                y: [latestPoint.y],
                type: 'scatter',
                mode: 'markers',
                name: '当前点',
                marker: {
                  color: latestPoint.side === 'left' ? '#8b5cf6' : '#06b6d4',
                  size: 14,
                  symbol: 'diamond',
                  line: { color: '#ffffff', width: 2 },
                },
                showlegend: false,
                hoverinfo: 'name+x+y',
              },
            ]
          : []),
      ]
    : []

  const layout: any = data
    ? {
        title: {
          text: `ε-δ 极限可视化：lim(x→${data.limit_point.x0}) ${request.function} = ${data.limit_point.L}`,
          font: { size: 16 },
        },
        xaxis: {
          title: 'x',
          autorange: true,
          zeroline: true,
          showspikes: false,
        },
        yaxis: {
          title: 'f(x)',
          autorange: true,
          zeroline: true,
          showspikes: false,
        },
        showlegend: true,
        legend: { x: 0.02, y: 0.98 },
        hovermode: 'closest',
        dragmode: 'pan',
        autosize: true,
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
            line: { width: 0 },
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
            fillcolor: 'rgba(16, 185, 129, 0.08)',
            line: { width: 0 },
          },
        ],
        margin: { t: 60, r: 40, b: 60, l: 60 },
      }
    : {}

  const renderStepper = () => (
    <div className="limit-stepper">
      {STEPS.map((step, index) => (
        <div
          key={index}
          className={`limit-step ${index === activeStep ? 'active' : ''} ${index < activeStep ? 'completed' : ''}`}
          onClick={() => setActiveStep(index)}
        >
          <div className="limit-step-number">{index + 1}</div>
          <div className="limit-step-content">
            <div className="limit-step-title">{step.title}</div>
            <div className="limit-step-desc">{step.description}</div>
          </div>
        </div>
      ))}
    </div>
  )

  const renderDefinitionBox = () => (
    <div className="limit-definition-box">
      <div className="limit-definition-title">ε-δ 极限定义</div>
      <p>
        若 <strong>lim(x→x₀) f(x) = L</strong>，则对任意 ε &gt; 0，存在 δ &gt; 0，使得
      </p>
      <div className="limit-definition-formula">
        0 &lt; |x - x₀| &lt; δ {'\u21d2'} |f(x) - L| &lt; ε
      </div>
      <p className="limit-definition-hint">
        几何意义：只要 x 足够靠近 x₀（在绿色 δ 带内），f(x) 就会落在黄色 ε 带内。
      </p>
    </div>
  )

  return (
    <div className="detail-page">
      <PageHeader
        backTo="/subject/calculus"
        backLabel="返回微积分"
        breadcrumbs={[
          { label: '首页', path: '/' },
          { label: '微积分', path: '/subject/calculus' },
          { label: 'ε-δ 极限可视化' },
        ]}
        title="ε-δ 极限可视化"
      />

      <VisualizationWorkspace
        visualizationTitle="ε-δ 极限定义可视化"
        controls={
          <ControlPanel
            title="参数设置"
            subtitle="调整函数、极限点与 ε 值"
            footer={
              <div className="limit-animation-controls">
                <button
                  className={`btn btn-primary btn-sm ${isPlaying ? 'btn-active' : ''}`}
                  onClick={togglePlay}
                  disabled={!data || data.approach_points.length === 0}
                >
                  {isPlaying ? '暂停' : '播放趋近动画'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={resetAnimation}
                  disabled={!data}
                >
                  重置
                </button>
                <div className="limit-speed-control">
                  <label>速度</label>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.5"
                    value={animationSpeed}
                    onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
                  />
                </div>
              </div>
            }
          >
            <div className="form-section">
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
                  {isComputingLimit && (
                    <span
                      className="form-helper"
                      style={{ display: 'inline', marginLeft: '0.5rem' }}
                    >
                      (计算中...)
                    </span>
                  )}
                </label>
                <div className="slider-container">
                  <input
                    type="number"
                    step="0.1"
                    value={request.L}
                    onChange={(e) => handleInputChange('L', parseFloat(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  {isManualLRef.current && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={resetToAutoCompute}
                      title="恢复自动计算"
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
                    min="0.05"
                    max="2"
                    step="0.05"
                    value={request.epsilon}
                    onChange={(e) => handleInputChange('epsilon', parseFloat(e.target.value))}
                  />
                  <span className="slider-value">{request.epsilon}</span>
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">预设示例</div>
              <div className="limit-example-chips">
                {EXAMPLES.map((example) => (
                  <button
                    key={example.name}
                    className={`limit-example-chip ${
                      request.function === example.function && request.x0 === example.x0
                        ? 'active'
                        : ''
                    }`}
                    onClick={() => applyExample(example)}
                    title={example.description}
                  >
                    <span className="limit-example-name">{example.name}</span>
                    <span className="limit-example-desc">{example.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </ControlPanel>
        }
        visualization={
          <>
            {error && <ErrorState message={error} />}
            {loading && !data && <LoadingState text="正在计算可视化数据..." />}
            {data && (
              <VisualizationCard
                title="ε-δ 极限定义可视化"
                subtitle="拖动图表可平移，滚轮可缩放；点击播放观察 x→x₀ 时 f(x)→L"
                loading={isUpdating}
                rightAction={
                  <div className="limit-status-badge-wrapper">
                    <span
                      className={`limit-status-badge ${data.verification.valid ? 'success' : 'warning'}`}
                    >
                      {data.verification.valid ? 'δ 验证通过' : 'δ 验证未通过'}
                    </span>
                  </div>
                }
              >
                <div className="visualization-plot-wrapper">
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
            {!data && !loading && (
              <div className="empty-state">
                <div className="empty-state-icon">📈</div>
                <p>输入函数并调整参数，开始探索 ε-δ 极限</p>
              </div>
            )}
          </>
        }
        infoPanels={
          data ? (
            <>
              <CollapsibleSection title="ε-δ 定义" defaultExpanded={true}>
                {renderDefinitionBox()}
              </CollapsibleSection>

              <CollapsibleSection title="探索步骤" defaultExpanded={true}>
                {renderStepper()}
              </CollapsibleSection>

              <CollapsibleSection title="当前参数与验证" defaultExpanded={true}>
                <div className="info-grid">
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
                  <div className="info-item">
                    <span>计算得到的 δ</span>
                    <span>{data.delta_values.delta.toFixed(4)}</span>
                  </div>
                  <div className="info-item">
                    <span>验证采样</span>
                    <span>
                      {data.verification.satisfied}/{data.verification.samples} 满足 |f(x)-L|&lt;ε
                    </span>
                  </div>
                  <div className="info-item">
                    <span>最大偏差</span>
                    <span>{data.verification.max_deviation.toFixed(4)}</span>
                  </div>
                  <div className="info-item">
                    <span>f(x₀)</span>
                    <span>
                      {data.limit_point.defined ? data.limit_point.f_x0?.toFixed(4) : '无定义'}
                    </span>
                  </div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                title="极限分析"
                defaultExpanded={true}
                variant={data.side_limits.exists ? 'success' : 'warning'}
              >
                <div className="info-grid">
                  <div className="info-item">
                    <span>左极限</span>
                    <span>
                      {data.side_limits.left !== null ? data.side_limits.left.toFixed(4) : '不存在'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span>右极限</span>
                    <span>
                      {data.side_limits.right !== null
                        ? data.side_limits.right.toFixed(4)
                        : '不存在'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span>双侧极限</span>
                    <span>
                      {data.side_limits.exists && data.side_limits.two_sided !== null
                        ? data.side_limits.two_sided.toFixed(4)
                        : '不存在'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span>x₀ 处定义</span>
                    <span>{data.limit_point.defined ? '有定义' : '无定义'}</span>
                  </div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="图例说明" defaultExpanded={false} variant="success">
                <p>
                  <span style={{ color: '#4f46e5' }}>●</span> 主函数曲线 f(x)，δ 区间内加粗显示
                  <br />
                  <span style={{ color: '#f59e0b' }}>--</span> ε 带：y = L ± ε 范围内的水平带
                  <br />
                  <span style={{ color: '#10b981' }}>|</span> δ 带：x = x₀ ± δ 范围内的垂直带
                  <br />
                  <span style={{ color: '#ef4444' }}>●</span> 极限点（空心表示 x₀ 处无定义）
                  <br />
                  <span style={{ color: '#8b5cf6' }}>◆</span> 左侧趋近点 &nbsp;
                  <span style={{ color: '#06b6d4' }}>◆</span> 右侧趋近点
                </p>
              </CollapsibleSection>
            </>
          ) : null
        }
      />
    </div>
  )
}
