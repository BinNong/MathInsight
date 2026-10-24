import { useState, useEffect, useCallback, useRef } from 'react'
import Plot from 'react-plotly.js'
import type { Data, Layout } from 'plotly.js'
import { integrationApi, RiemannSumRequest, RiemannSumData, ConvergenceData } from '../services/api'

import PageHeader from '../components/PageHeader'
import ControlPanel from '../components/ControlPanel'
import VisualizationCard from '../components/VisualizationCard'
import TabBar from '../components/TabBar'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import VisualizationWorkspace from '../components/VisualizationWorkspace'
import CollapsibleSection from '../components/CollapsibleSection'

import { isValidFunctionExpression } from '../utils/math'

const defaultRequest: RiemannSumRequest = {
  function: 'x**2',
  a: 0,
  b: 1,
  n: 10,
  method: 'midpoint',
}

// 预设函数
const PRESET_FUNCTIONS = [
  { label: 'x²', value: 'x**2', description: '∫₀¹ x² dx = 1/3 ≈ 0.333' },
  { label: 'sin(x)', value: 'sin(x)', description: '∫₀^π sin(x) dx = 2' },
  { label: 'e^x', value: 'exp(x)', description: '∫₀¹ e^x dx = e-1 ≈ 1.718' },
  { label: 'x³', value: 'x**3', description: '∫₀¹ x³ dx = 1/4 = 0.25' },
  { label: '√x', value: 'sqrt(x)', description: '∫₀¹ √x dx = 2/3 ≈ 0.667' },
]

// 分割方法
const METHODS = [
  { key: 'left', label: '左端点', description: '使用每个区间左端点的高度' },
  { key: 'right', label: '右端点', description: '使用每个区间右端点的高度' },
  { key: 'midpoint', label: '中点', description: '使用每个区间中点的高度（推荐）' },
  { key: 'random', label: '随机', description: '在每个区间内随机选点' },
]

const TABS = [
  { key: 'riemann', label: '黎曼和可视化' },
  { key: 'convergence', label: '误差收敛对比' },
]

export default function RiemannIntegral() {
  const [activeTab, setActiveTab] = useState<'riemann' | 'convergence'>('riemann')
  const [request, setRequest] = useState<RiemannSumRequest>(defaultRequest)
  const [riemannData, setRiemannData] = useState<RiemannSumData | null>(null)
  const [convergenceData, setConvergenceData] = useState<ConvergenceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const plotRef = useRef<any>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [animationProgress, setAnimationProgress] = useState(0)
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 获取黎曼和数据
  const fetchRiemannData = useCallback(
    async (isManual = false) => {
      if (!isValidFunctionExpression(request.function)) {
        if (isManual) {
          setError('请输入有效的函数表达式（包含变量 x）')
        }
        setIsUpdating(false)
        return
      }

      setIsUpdating(true)
      setError(null)

      // 计算绘图域
      const rangePadding = (request.b - request.a) * 0.2
      const domainRange = [
        Math.min(request.a, request.b) - rangePadding,
        Math.max(request.a, request.b) + rangePadding,
      ]

      try {
        const response = await integrationApi.riemannSum({
          ...request,
          domain_range: domainRange,
        })
        if (response.success) {
          setRiemannData(response.data)
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

  // 获取收敛数据
  const fetchConvergenceData = useCallback(
    async (isManual = false) => {
      if (!isValidFunctionExpression(request.function)) {
        if (isManual) {
          setError('请输入有效的函数表达式（包含变量 x）')
        }
        setIsUpdating(false)
        return
      }

      setIsUpdating(true)
      setError(null)

      const rangePadding = (request.b - request.a) * 0.2
      const domainRange = [
        Math.min(request.a, request.b) - rangePadding,
        Math.max(request.a, request.b) + rangePadding,
      ]

      try {
        const response = await integrationApi.convergence({
          function: request.function,
          a: request.a,
          b: request.b,
          n_values: [4, 8, 16, 32, 64, 128, 256],
          domain_range: domainRange,
        })
        if (response.success) {
          setConvergenceData(response.data)
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

  // 初始加载
  useEffect(() => {
    setLoading(true)
    if (activeTab === 'riemann') {
      fetchRiemannData(true)
    } else {
      fetchConvergenceData(true)
    }
  }, [])

  // 参数变化时重新获取
  useEffect(() => {
    setLoading(true)
    if (activeTab === 'riemann') {
      fetchRiemannData(true)
    } else {
      fetchConvergenceData(true)
    }
  }, [request.function, request.a, request.b, request.n, request.method, activeTab])

  const handleInputChange = (field: keyof RiemannSumRequest, value: any) => {
    setRequest((prev) => ({ ...prev, [field]: value }))
  }

  const handlePresetClick = (func: string) => {
    // 根据预设设置合适的积分区间
    let a = 0,
      b = 1
    if (func === 'sin(x)') {
      a = 0
      b = Math.PI
    }
    setRequest((prev) => ({ ...prev, function: func, a, b }))
  }

  // 获取方法名称
  const getMethodLabel = (method: string) => {
    const m = METHODS.find((m) => m.key === method)
    return m ? m.label : method
  }

  // 开始动画
  const startAnimation = () => {
    if (!riemannData || riemannData.n <= 0) return

    setIsAnimating(true)
    setAnimationProgress(0)

    // 根据分割数调整动画速度
    const totalRects = riemannData.n
    const duration = Math.min(2000, Math.max(500, totalRects * 30)) // 500ms-2s
    const interval = duration / totalRects // 每个矩形的间隔

    if (animationRef.current) clearInterval(animationRef.current)

    let current = 0
    animationRef.current = setInterval(() => {
      current++
      setAnimationProgress(current)
      if (current >= totalRects) {
        stopAnimation()
      }
    }, interval)
  }

  // 停止动画
  const stopAnimation = () => {
    if (animationRef.current) {
      clearInterval(animationRef.current)
      animationRef.current = null
    }
    setIsAnimating(false)
    setAnimationProgress(riemannData?.n || 0)
  }

  // 清理动画
  useEffect(() => {
    return () => {
      if (animationRef.current) clearInterval(animationRef.current)
    }
  }, [])

  // 参数变化时停止动画
  useEffect(() => {
    stopAnimation()
  }, [request.function, request.a, request.b, request.n, request.method])

  // 计算当前已显示矩形的累加面积
  const getAnimatedArea = () => {
    if (!riemannData) return 0
    const visibleCount = isAnimating ? animationProgress : riemannData.n
    const dx = (request.b - request.a) / riemannData.n
    let sum = 0
    for (let i = 0; i < Math.min(visibleCount, riemannData.rectangles.height.length); i++) {
      sum += riemannData.rectangles.height[i] * dx
    }
    return sum
  }

  const rectWidth = riemannData ? ((request.b - request.a) / riemannData.n) * 0.85 : 0

  // 黎曼和绘图数据（支持动画）
  const riemannPlotData: Data[] = riemannData
    ? [
        // 主函数曲线
        {
          x: riemannData.function_curve.x,
          y: riemannData.function_curve.y,
          type: 'scatter',
          mode: 'lines',
          name: 'f(x)',
          line: { color: '#4f46e5', width: 3 },
        },
        // 黎曼矩形（根据动画进度显示）
        ...(riemannData.rectangles.x_left.length > 0
          ? [
              {
                x: riemannData.rectangles.x_left.slice(0, animationProgress),
                y: riemannData.rectangles.height.slice(0, animationProgress),
                type: 'bar',
                name: '已绘制矩形',
                marker: {
                  color: 'rgba(239, 68, 68, 0.4)',
                  line: { color: 'rgba(239, 68, 68, 1)', width: 1 },
                },
                width: rectWidth,
                hovertemplate: '高度: %{y:.4f}<extra>面积: %{customdata:.6f}</extra>',
                customdata: riemannData.rectangles.height
                  .slice(0, animationProgress)
                  .map((h) => (h * (request.b - request.a)) / riemannData.n),
              } as Data,
            ]
          : []),
        // 下一个待绘制矩形（高亮提示）
        ...(isAnimating && animationProgress < riemannData.n
          ? [
              {
                x: [riemannData.rectangles.x_left[animationProgress]],
                y: [riemannData.rectangles.height[animationProgress]],
                type: 'bar',
                name: '正在绘制',
                marker: {
                  color: 'rgba(251, 191, 36, 0.6)',
                  line: { color: '#fbbf24', width: 2 },
                },
                width: rectWidth,
              } as Data,
            ]
          : []),
        // 剩余矩形（虚线轮廓）
        ...(!isAnimating && riemannData.n > 0
          ? [
              {
                x: riemannData.rectangles.x_left.slice(animationProgress),
                y: riemannData.rectangles.height.slice(animationProgress),
                type: 'bar',
                name: '待绘制',
                marker: {
                  color: 'rgba(156, 163, 175, 0.15)',
                  line: { color: 'rgba(156, 163, 175, 0.5)', width: 1, dash: 'dash' },
                },
                width: rectWidth,
              } as Data,
            ]
          : []),
        // 矩形边界线
        {
          x: riemannData.rect_lines.x,
          y: riemannData.rect_lines.y,
          type: 'scatter',
          mode: 'lines',
          name: '分区边界',
          line: { color: '#9ca3af', width: 1 },
          opacity: 0.5,
        },
      ]
    : []

  // 黎曼和布局
  const riemannLayout: Partial<Layout> = riemannData
    ? {
        title: {
          text: `黎曼和 (${getMethodLabel(riemannData.method)}, n=${riemannData.n})`,
          font: { size: 16 },
        },
        xaxis: {
          title: { text: 'x' },
          autorange: true,
          zeroline: true,
          showspikes: false,
        },
        yaxis: {
          title: { text: 'f(x)' },
          autorange: true,
          zeroline: true,
          showspikes: false,
        },
        showlegend: true,
        legend: { x: 0.02, y: 0.98 },
        dragmode: 'pan',
        margin: { t: 60, r: 40, b: 60, l: 60 },
        barmode: 'overlay',
        autosize: true,
      }
    : {}

  // 收敛图绘图数据
  const convergencePlotData: { data: Data[]; layout: Partial<Layout> } = convergenceData
    ? {
        data: [
          // 左端点法
          {
            x: convergenceData.methods.left?.errors.map((e) => e.n) || [],
            y: convergenceData.methods.left?.errors.map((e) => e.error) || [],
            type: 'scatter',
            mode: 'lines+markers',
            name: '左端点',
            line: { color: '#ef4444', width: 2 },
          },
          // 右端点法
          {
            x: convergenceData.methods.right?.errors.map((e) => e.n) || [],
            y: convergenceData.methods.right?.errors.map((e) => e.error) || [],
            type: 'scatter',
            mode: 'lines+markers',
            name: '右端点',
            line: { color: '#f59e0b', width: 2 },
          },
          // 中点法
          {
            x: convergenceData.methods.midpoint?.errors.map((e) => e.n) || [],
            y: convergenceData.methods.midpoint?.errors.map((e) => e.error) || [],
            type: 'scatter',
            mode: 'lines+markers',
            name: '中点',
            line: { color: '#10b981', width: 2 },
          },
          // 梯形法
          {
            x: convergenceData.methods.trapezoid?.errors.map((e) => e.n) || [],
            y: convergenceData.methods.trapezoid?.errors.map((e) => e.error) || [],
            type: 'scatter',
            mode: 'lines+markers',
            name: '梯形法',
            line: { color: '#8b5cf6', width: 2 },
          },
          // 辛普森法
          {
            x: convergenceData.methods.simpson?.errors.map((e) => e.n) || [],
            y: convergenceData.methods.simpson?.errors.map((e) => e.error) || [],
            type: 'scatter',
            mode: 'lines+markers',
            name: '辛普森法',
            line: { color: '#06b6d4', width: 2 },
          },
        ],
        layout: {
          title: {
            text: '数值积分误差收敛（对数坐标）',
            font: { size: 16 },
          },
          xaxis: {
            title: { text: '分割数 n' },
            type: 'log',
            zeroline: true,
            showspikes: false,
          },
          yaxis: {
            title: { text: '误差 |近似值 - 精确值|' },
            type: 'log',
            zeroline: true,
            showspikes: false,
          },
          showlegend: true,
          legend: { x: 0.02, y: 0.98 },
          margin: { t: 60, r: 40, b: 60, l: 60 },
          autosize: true,
        },
      }
    : { data: [], layout: {} }

  return (
    <div className="detail-page">
      <PageHeader
        backTo="/subject/calculus"
        backLabel="返回微积分"
        breadcrumbs={[
          { label: '首页', path: '/' },
          { label: '微积分', path: '/subject/calculus' },
          { label: '黎曼积分' },
        ]}
        title="黎曼积分可视化"
      />

      <VisualizationWorkspace
        visualizationTitle={activeTab === 'riemann' ? '黎曼和可视化' : '误差收敛对比'}
        controls={
          <ControlPanel title="参数设置" subtitle="调整函数、区间与分割方式">
            <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

            <div className="form-section">
              <div className="form-group">
                <label>被积函数 f(x)</label>
                <input
                  type="text"
                  value={request.function}
                  onChange={(e) => handleInputChange('function', e.target.value)}
                  placeholder="例如: x**2, sin(x), exp(x)"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>积分下限 a</label>
                  <input
                    type="number"
                    step="0.1"
                    value={request.a}
                    onChange={(e) => handleInputChange('a', parseFloat(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>积分上限 b</label>
                  <input
                    type="number"
                    step="0.1"
                    value={request.b}
                    onChange={(e) => handleInputChange('b', parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <label className="form-label">预设函数</label>
              <div className="preset-group">
                {PRESET_FUNCTIONS.map((preset) => (
                  <button
                    key={preset.value}
                    className={`preset-chip ${request.function === preset.value ? 'active' : ''}`}
                    onClick={() => handlePresetClick(preset.value)}
                    title={preset.description}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'riemann' && (
              <div className="form-section">
                <div className="form-row">
                  <div className="form-group">
                    <label>分割方法</label>
                    <select
                      value={request.method}
                      onChange={(e) => handleInputChange('method', e.target.value)}
                    >
                      {METHODS.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>分割数 n: {request.n}</label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={request.n}
                      onChange={(e) => handleInputChange('n', parseInt(e.target.value))}
                    />
                    <div
                      className="form-helper"
                      style={{ display: 'flex', justifyContent: 'space-between' }}
                    >
                      <span>1</span>
                      <span>50</span>
                      <span>100</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>动画</label>
                    <button
                      className="btn btn-primary"
                      onClick={isAnimating ? stopAnimation : startAnimation}
                      disabled={!riemannData}
                      style={{
                        width: '100%',
                        background: isAnimating ? 'var(--warning)' : undefined,
                      }}
                    >
                      {isAnimating ? '停止' : '播放动画'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </ControlPanel>
        }
        visualization={
          <>
            {error && <ErrorState message={error} />}
            {loading && !riemannData && !convergenceData && (
              <LoadingState text="正在计算可视化数据..." />
            )}
            {(riemannData || convergenceData) && (
              <VisualizationCard
                title={activeTab === 'riemann' ? '黎曼和可视化' : '误差收敛对比'}
                subtitle={
                  activeTab === 'riemann'
                    ? '理解定积分的定义：分割、求和、取极限近似曲线下面积'
                    : '对数坐标图中，曲线的斜率表示收敛阶数'
                }
                loading={isUpdating}
              >
                <div style={{ position: 'absolute', inset: 0, padding: 'var(--space-2)' }}>
                  {activeTab === 'riemann' && riemannData && (
                    <Plot
                      ref={plotRef}
                      data={riemannPlotData}
                      layout={riemannLayout}
                      config={{ responsive: true, scrollZoom: true }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  )}
                  {activeTab === 'convergence' && convergenceData && (
                    <Plot
                      ref={plotRef}
                      data={convergencePlotData.data}
                      layout={convergencePlotData.layout}
                      config={{ responsive: true, scrollZoom: true }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  )}
                </div>
              </VisualizationCard>
            )}
            {!riemannData && !convergenceData && !loading && (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <p>输入被积函数并调整参数，开始探索黎曼积分</p>
              </div>
            )}
          </>
        }
        infoPanels={
          riemannData || convergenceData ? (
            <>
              {activeTab === 'riemann' && riemannData && (
                <>
                  <CollapsibleSection title="动画进度" defaultExpanded={true}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 'var(--space-1)',
                        fontSize: '0.85rem',
                      }}
                    >
                      <span>
                        {isAnimating ? '绘制中' : '已绘制'}{' '}
                        {Math.min(animationProgress, riemannData.n)} / {riemannData.n} 个矩形
                      </span>
                      <span className="slider-value">累加面积: {getAnimatedArea().toFixed(6)}</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className={`progress-bar-fill ${isAnimating ? 'animated' : ''}`}
                        style={{ width: `${(animationProgress / riemannData.n) * 100}%` }}
                      />
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="积分结果" defaultExpanded={true}>
                    <div className="info-grid">
                      <div className="info-item">
                        <span>函数</span>
                        <span>f(x) = {request.function}</span>
                      </div>
                      <div className="info-item">
                        <span>积分区间</span>
                        <span>
                          [{riemannData.interval.a}, {riemannData.interval.b}]
                        </span>
                      </div>
                      <div className="info-item">
                        <span>分割数</span>
                        <span>n = {riemannData.n}</span>
                      </div>
                      <div
                        className="info-item"
                        style={{
                          background: isAnimating ? 'rgba(251, 191, 36, 0.1)' : undefined,
                          borderRadius: isAnimating ? 'var(--radius-md)' : undefined,
                        }}
                      >
                        <span>{isAnimating ? '当前累加' : '矩形总面积'}</span>
                        <span
                          style={{
                            fontWeight: 'bold',
                            color: isAnimating ? 'var(--warning)' : 'var(--primary)',
                          }}
                        >
                          {getAnimatedArea().toFixed(6)}
                        </span>
                      </div>
                      {riemannData.exact_value !== null && !isAnimating && (
                        <>
                          <div className="info-item">
                            <span>精确值</span>
                            <span style={{ fontWeight: 'bold' }}>
                              {riemannData.exact_value.toFixed(6)}
                            </span>
                          </div>
                          <div className="info-item">
                            <span>绝对误差</span>
                            <span
                              style={{
                                color:
                                  riemannData.error! < 0.001 ? 'var(--success)' : 'var(--warning)',
                              }}
                            >
                              {riemannData.error?.toExponential(4) || 'N/A'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                    <div
                      style={{
                        marginTop: 'var(--space-4)',
                        padding: 'var(--space-3)',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.85rem',
                      }}
                    >
                      <strong>分割方法说明：</strong>
                      {METHODS.find((m) => m.key === request.method)?.description}
                      <br />
                      <span style={{ color: 'var(--text-secondary)' }}>
                        步长 Δx = {(Math.abs(request.b - request.a) / request.n).toFixed(4)}
                      </span>
                      {isAnimating && (
                        <div style={{ marginTop: 'var(--space-2)', color: 'var(--warning)' }}>
                          点击"停止"可查看当前累加结果
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                </>
              )}

              {activeTab === 'convergence' && convergenceData && (
                <CollapsibleSection title="误差收敛分析" defaultExpanded={true}>
                  <div className="info-grid">
                    <div className="info-item">
                      <span>函数</span>
                      <span>f(x) = {request.function}</span>
                    </div>
                    <div className="info-item">
                      <span>积分区间</span>
                      <span>
                        [{convergenceData.interval.a}, {convergenceData.interval.b}]
                      </span>
                    </div>
                    {convergenceData.exact_value !== null && (
                      <div className="info-item">
                        <span>精确值</span>
                        <span>{convergenceData.exact_value.toFixed(6)}</span>
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: 'var(--space-4)',
                      padding: 'var(--space-3)',
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <strong>收敛速度对比：</strong>
                    <ul style={{ margin: 'var(--space-2) 0 0 var(--space-4)' }}>
                      <li>中点法、梯形法：误差 O(1/n²)（二阶收敛）</li>
                      <li>辛普森法：误差 O(1/n⁴)（四阶收敛，最快）</li>
                      <li>左/右端点法：误差 O(1/n)（一阶收敛，最慢）</li>
                    </ul>
                    <span
                      style={{
                        color: 'var(--text-secondary)',
                        display: 'block',
                        marginTop: 'var(--space-2)',
                      }}
                    >
                      对数坐标图中，曲线的斜率表示收敛阶数
                    </span>
                  </div>
                </CollapsibleSection>
              )}
            </>
          ) : null
        }
      />
    </div>
  )
}
