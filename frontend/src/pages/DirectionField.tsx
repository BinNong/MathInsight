import { useCallback, useEffect, useState } from 'react'
import type { Data } from 'plotly.js'
import Plot from '../components/Plot'
import PageHeader from '../components/PageHeader'
import ControlPanel from '../components/ControlPanel'
import VisualizationCard from '../components/VisualizationCard'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import VisualizationWorkspace from '../components/VisualizationWorkspace'
import CollapsibleSection from '../components/CollapsibleSection'
import './ExperimentShared.css'
import { advancedApi, ODEFieldData } from '../services/api'

const PRESETS = [
  { expr: 'x - y', name: '衰减型', desc: "y' = x - y", ic: [{ x: 0, y: 1 }, { x: 0, y: -1 }] },
  { expr: 'y', name: '指数增长', desc: "y' = y", ic: [{ x: 0, y: 1 }, { x: 0, y: -1 }] },
  { expr: '-y', name: '指数衰减', desc: "y' = -y", ic: [{ x: 0, y: 2 }, { x: 0, y: -2 }] },
  { expr: 'x', name: '抛物线族', desc: "y' = x", ic: [{ x: 0, y: 0 }, { x: 0, y: 1 }] },
  { expr: 'x**2 + y', name: '非线性', desc: "y' = x² + y", ic: [{ x: 0, y: 0.5 }] },
] as const

export default function DirectionField() {
  const [expr, setExpr] = useState<string>('x - y')
  const [density, setDensity] = useState(15)
  const [ics, setIcs] = useState<Array<{ x: number; y: number }>>([
    { x: 0, y: 1 }, { x: 0, y: -1 },
  ])
  const [data, setData] = useState<ODEFieldData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await advancedApi.directionField({
        function: expr,
        x_range: [-3, 3],
        y_range: [-3, 3],
        density,
        initial_conditions: ics,
      })
      if (res.success) setData(res.data)
      else setError(res.error || '计算失败')
    } catch {
      setError('无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }, [expr, density, ics])

  useEffect(() => { generate() }, [generate])

  const applyPreset = (preset: typeof PRESETS[number]) => {
    setExpr(preset.expr)
    setIcs([...preset.ic])
  }

  const setIC = (index: number, axis: 'x' | 'y', value: number) => {
    setIcs((prev) => prev.map((ic, i) => (i === index ? { ...ic, [axis]: value } : ic)))
  }

  const plotData: Data[] = data
    ? [
        ...data.segments.map((s) => ({
          x: [s.x - s.dx / 2, s.x + s.dx / 2],
          y: [s.y - s.dy / 2, s.y + s.dy / 2],
          type: 'scatter' as const,
          mode: 'lines' as const,
          line: { color: 'rgba(120, 120, 120, 0.55)', width: 1.2 },
          showlegend: false,
          hoverinfo: 'skip' as const,
        })),
        ...data.curves.map((curve, i) => ({
          x: curve.x,
          y: curve.y,
          type: 'scatter' as const,
          mode: 'lines' as const,
          name: `解曲线 ${i + 1}：(${curve.initial.x}, ${curve.initial.y})`,
          line: { color: ['#9c3b2e', '#2f5d62', '#8a6d3b', '#7c3aed'][i % 4], width: 3 },
          hoverinfo: 'x+y+name' as const,
        })),
        ...data.curves.map((curve, i) => ({
          x: [curve.initial.x],
          y: [curve.initial.y],
          type: 'scatter' as const,
          mode: 'markers' as const,
          name: `初值 ${i + 1}`,
          marker: { color: ['#9c3b2e', '#2f5d62', '#8a6d3b', '#7c3aed'][i % 4], size: 11, symbol: 'circle' },
          showlegend: false,
          hoverinfo: 'x+y+name' as const,
        })),
      ]
    : []

  return (
    <div className="experiment-page">
      <PageHeader title="微分方程 · 方向场与解曲线" backTo="/subject/calculus" backLabel="返回微积分" />
      <p className="experiment-lead">
        一阶微分方程 y′ = f(x, y) 在每个点都规定了一个斜率。方向场把这些斜率画成小线段；从任意初值出发，解曲线沿着这些线段流动。这就是"积分"的几何图像。
      </p>

      <VisualizationWorkspace
        visualizationTitle="方向场与解曲线"
        controls={
          <ControlPanel title="方程与初值" subtitle="选择预设或输入你自己的方程">
            <div className="form-section">
              <h4 className="form-section-title">预设方程</h4>
              <div className="preset-chips">
                {PRESETS.map((p) => (
                  <button
                    key={p.expr}
                    type="button"
                    className={`preset-chip ${expr === p.expr ? 'active' : ''}`}
                    onClick={() => applyPreset(p)}
                    title={p.desc}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>y′ = f(x, y)</label>
              <input
                type="text"
                value={expr}
                onChange={(e) => setExpr(e.target.value)}
                placeholder="例如 x - y、y、-y"
              />
              <small>只允许 x、y 与常见数学函数，如 sin(x)、exp(x)、x**2</small>
            </div>

            <div className="form-group">
              <label>方向场密度：{density} × {density}</label>
              <input
                type="range"
                min={8}
                max={28}
                step={2}
                value={density}
                onChange={(e) => setDensity(Number(e.target.value))}
              />
            </div>

            <div className="form-section">
              <h4 className="form-section-title">初值条件 (x₀, y₀)</h4>
              {ics.map((ic, i) => (
                <div className="ic-row" key={i}>
                  <span>初值 {i + 1}</span>
                  <input type="number" step="0.1" value={ic.x} aria-label={`初值${i + 1} x`} onChange={(e) => setIC(i, 'x', Number(e.target.value))} />
                  <input type="number" step="0.1" value={ic.y} aria-label={`初值${i + 1} y`} onChange={(e) => setIC(i, 'y', Number(e.target.value))} />
                  <button type="button" onClick={() => setIcs((prev) => prev.filter((_, j) => j !== i))} disabled={ics.length <= 1}>×</button>
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIcs((prev) => [...prev, { x: 0, y: prev.length }])}>
                + 添加初值
              </button>
            </div>
          </ControlPanel>
        }
        visualization={
          <>
            {error && <ErrorState message={error} />}
            {loading && !data && <LoadingState text="正在绘制方向场..." />}
            {data && (
              <VisualizationCard
                title={`y′ = ${data.function}`}
                subtitle="灰色短线是各点的斜率方向，彩色曲线是从初值出发的解"
                loading={loading}
              >
                <div className="visualization-plot-wrapper">
                  <Plot
                    data={plotData}
                    layout={{
                      title: { text: `方向场：y′ = ${data.function}`, font: { size: 16 } },
                      xaxis: { title: { text: 'x' }, range: [-3, 3], zeroline: true },
                      yaxis: { title: { text: 'y' }, range: [-3, 3], zeroline: true },
                      showlegend: true,
                      legend: { x: 0.02, y: 0.98 },
                      hovermode: 'closest',
                      margin: { t: 60, r: 40, b: 60, l: 60 },
                    }}
                    config={{ responsive: true, scrollZoom: true }}
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              </VisualizationCard>
            )}
          </>
        }
        infoPanels={
          data ? (
            <>
              <CollapsibleSection title="如何读方向场" defaultExpanded>
                <p className="info-text">
                  方向场上每个小线段表示：如果解曲线经过该点，它在此处的切线斜率就是 f(x, y)。把无数个这样的方向连起来，就得到解的走势——即使解不出解析式，也能看出行为。
                </p>
              </CollapsibleSection>
              <CollapsibleSection title="数值方法" defaultExpanded>
                <p className="info-text">
                  解曲线用四阶 Runge-Kutta（RK4）积分生成，步长约 {(6 / 400).toFixed(4)}。初值点用实心圆标出，同色曲线即经过该初值的特解。
                </p>
              </CollapsibleSection>
            </>
          ) : null
        }
      />
    </div>
  )
}
