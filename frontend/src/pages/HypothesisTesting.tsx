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
import { advancedApi, HypothesisData } from '../services/api'

const PRESETS = [
  { name: 'IQ 均值检验', sample: 103, hypo: 100, std: 15, n: 100, test: 'z' as const, tail: 'two' as const },
  { name: '产品重量', sample: 498, hypo: 500, std: 10, n: 50, test: 't' as const, tail: 'left' as const },
  { name: '转化率提升', sample: 0.13, hypo: 0.10, std: 0.05, n: 64, test: 'z' as const, tail: 'right' as const },
] as const

export default function HypothesisTesting() {
  const [testType, setTestType] = useState<'z' | 't'>('z')
  const [tail, setTail] = useState<'two' | 'left' | 'right'>('two')
  const [sampleMean, setSampleMean] = useState(103)
  const [hypoMean, setHypoMean] = useState(100)
  const [std, setStd] = useState(15)
  const [n, setN] = useState(100)
  const [alpha, setAlpha] = useState(0.05)
  const [data, setData] = useState<HypothesisData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await advancedApi.hypothesisTest({
        test_type: testType, tail, sample_mean: sampleMean,
        hypothesized_mean: hypoMean, std, n, alpha,
      })
      if (res.success) setData(res.data)
      else setError(res.error || '计算失败')
    } catch {
      setError('无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }, [testType, tail, sampleMean, hypoMean, std, n, alpha])

  useEffect(() => { generate() }, [generate])

  const applyPreset = (p: typeof PRESETS[number]) => {
    setSampleMean(p.sample); setHypoMean(p.hypo); setStd(p.std)
    setN(p.n); setTestType(p.test); setTail(p.tail)
  }

  const plotData: Data[] = data
    ? [
        {
          x: data.distribution.x, y: data.distribution.y,
          type: 'scatter', mode: 'lines',
          name: `H₀ 下的抽样分布`,
          line: { color: '#2f5d62', width: 2 },
          fill: 'tozeroy', fillcolor: 'rgba(47,93,98,0.12)',
        },
        {
          x: [data.sample_mean, data.sample_mean],
          y: [0, Math.max(...data.distribution.y) * 0.9],
          type: 'scatter', mode: 'lines',
          name: `样本均值 ${data.sample_mean}`,
          line: { color: data.reject_null ? '#dc2626' : '#2563eb', width: 3, dash: 'dash' },
        },
        {
          x: [data.hypothesized_mean, data.hypothesized_mean],
          y: [0, Math.max(...data.distribution.y) * 0.9],
          type: 'scatter', mode: 'lines',
          name: `H₀ 均值 ${data.hypothesized_mean}`,
          line: { color: '#8a6d3b', width: 2 },
        },
      ]
    : []

  return (
    <div className="experiment-page">
      <PageHeader title="数理统计 · 假设检验" backTo="/subject/probability" backLabel="返回概率统计" />
      <p className="experiment-lead">
        一个样本均值偏离了假设值，这算不算"显著"？假设检验用抽样分布回答这个问题：如果原假设成立，看到当前结果的概率有多大（p 值）？比 α 还小就拒绝原假设。
      </p>

      <VisualizationWorkspace
        visualizationTitle="抽样分布与拒绝域"
        controls={
          <ControlPanel title="检验设定" subtitle="单样本均值检验">
            <div className="form-section">
              <h4 className="form-section-title">例子</h4>
              <div className="preset-chips">
                {PRESETS.map((p) => (
                  <button key={p.name} type="button" className="preset-chip" onClick={() => applyPreset(p)}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>检验类型</label>
              <select className="form-select" value={testType} onChange={(e) => setTestType(e.target.value as 'z' | 't')}>
                <option value="z">z 检验（总体标准差已知）</option>
                <option value="t">t 检验（小样本 / 标准差估计）</option>
              </select>
            </div>

            <div className="form-group">
              <label>备择假设方向</label>
              <select className="form-select" value={tail} onChange={(e) => setTail(e.target.value as 'two' | 'left' | 'right')}>
                <option value="two">双侧：μ ≠ μ₀</option>
                <option value="left">左侧：μ &lt; μ₀</option>
                <option value="right">右侧：μ &gt; μ₀</option>
              </select>
            </div>

            <div className="form-section">
              <h4 className="form-section-title">参数</h4>
              <div className="form-group"><label>样本均值 x̄</label><input type="number" step="0.01" value={sampleMean} onChange={(e) => setSampleMean(Number(e.target.value))} /></div>
              <div className="form-group"><label>假设均值 μ₀</label><input type="number" step="0.01" value={hypoMean} onChange={(e) => setHypoMean(Number(e.target.value))} /></div>
              <div className="form-group"><label>标准差 σ</label><input type="number" step="0.1" min="0.01" value={std} onChange={(e) => setStd(Number(e.target.value))} /></div>
              <div className="form-group"><label>样本量 n：{n}</label><input type="range" min={2} max={500} value={n} onChange={(e) => setN(Number(e.target.value))} /></div>
              <div className="form-group"><label>显著性水平 α：{alpha}</label><input type="range" min={0.01} max={0.2} step={0.01} value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} /></div>
            </div>
          </ControlPanel>
        }
        visualization={
          <>
            {error && <ErrorState message={error} />}
            {loading && !data && <LoadingState text="正在计算检验..." />}
            {data && (
              <VisualizationCard
                title={`${data.test_type.toUpperCase()} 检验 · ${data.tail === 'two' ? '双侧' : data.tail === 'left' ? '左侧' : '右侧'}`}
                subtitle="曲线是原假设成立时样本均值的分布；红色虚线表示落在拒绝域"
                loading={loading}
                rightAction={
                  <span className={`limit-status-badge ${data.reject_null ? 'warning' : 'success'}`}>
                    {data.reject_null ? '拒绝 H₀' : '不拒绝 H₀'}
                  </span>
                }
              >
                <div className="visualization-plot-wrapper">
                  <Plot
                    data={plotData}
                    layout={{
                      title: { text: `p = ${data.p_value.toFixed(4)} ${data.reject_null ? '<' : '≥'} α = ${data.alpha}`, font: { size: 16 } },
                      xaxis: { title: { text: '样本均值' }, zeroline: false },
                      yaxis: { title: { text: '密度' }, zeroline: false },
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
              <CollapsibleSection title="检验结论" defaultExpanded>
                <p className="info-text conclusion-text">{data.conclusion}</p>
                <div className="info-grid">
                  <div className="info-item"><span>检验统计量</span><span>{data.statistic.toFixed(4)}</span></div>
                  <div className="info-item"><span>p 值</span><span>{data.p_value.toFixed(4)}</span></div>
                  <div className="info-item"><span>显著性水平 α</span><span>{data.alpha}</span></div>
                  <div className="info-item"><span>标准误 SE</span><span>{data.standard_error.toFixed(4)}</span></div>
                  <div className="info-item"><span>置信区间</span><span>[{data.confidence_interval[0].toFixed(3)}, {data.confidence_interval[1].toFixed(3)}]</span></div>
                </div>
              </CollapsibleSection>
              <CollapsibleSection title="如何解读 p 值" defaultExpanded>
                <p className="info-text">
                  p 值不是"原假设为真的概率"，而是**假设原假设成立时**，观察到当前这样极端（或更极端）结果的概率。p 值很小说明当前数据在原假设下很不可能出现，于是我们拒绝原假设。
                </p>
              </CollapsibleSection>
            </>
          ) : null
        }
      />
    </div>
  )
}
