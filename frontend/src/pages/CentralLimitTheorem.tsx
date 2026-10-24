import { useState, useEffect, useRef, useCallback } from 'react'
import Plot from 'react-plotly.js'
import type { Data } from 'plotly.js'
import {
  probabilityApi,
  CLTSimulateRequest,
  CLTResultData,
  DistributionType,
  DistributionPreset,
} from '../services/api'
import PageHeader from '../components/PageHeader'
import ControlPanel from '../components/ControlPanel'
import VisualizationCard from '../components/VisualizationCard'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import VisualizationWorkspace from '../components/VisualizationWorkspace'
import CollapsibleSection from '../components/CollapsibleSection'

const DISTRIBUTION_OPTIONS: { key: DistributionType; label: string }[] = [
  { key: 'bernoulli', label: '伯努利分布' },
  { key: 'uniform_discrete', label: '离散均匀分布' },
  { key: 'uniform_continuous', label: '连续均匀分布' },
  { key: 'exponential', label: '指数分布' },
  { key: 'normal', label: '正态分布' },
  { key: 'poisson', label: '泊松分布' },
  { key: 'binomial', label: '二项分布' },
]

const DEFAULT_PRESETS: Record<DistributionType, Record<string, number>> = {
  bernoulli: { p: 0.5 },
  binomial: { n: 20, p: 0.5 },
  poisson: { lam: 3 },
  uniform_discrete: { min_val: 1, max_val: 6 },
  uniform_continuous: { a: 0, b: 1 },
  exponential: { lam: 1 },
  normal: { mu: 0, sigma: 1 },
}

interface AnimationState {
  running: boolean
  currentIndex: number
  means: number[]
}

export default function CentralLimitTheorem() {
  const [distribution, setDistribution] = useState<DistributionType>('bernoulli')
  const [params, setParams] = useState<Record<string, number>>(DEFAULT_PRESETS.bernoulli)
  const [sampleSize, setSampleSize] = useState(30)
  const [numSamples, setNumSamples] = useState(2000)
  const [animationSpeed, setAnimationSpeed] = useState(30)
  const [presets, setPresets] = useState<DistributionPreset[]>([])

  const [data, setData] = useState<CLTResultData | null>(null)
  const [animation, setAnimation] = useState<AnimationState>({
    running: false,
    currentIndex: 0,
    means: [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 加载分布预设
  useEffect(() => {
    probabilityApi.getDistributionPresets().then((response) => {
      if (response.success && response.data?.distributions) {
        setPresets(response.data.distributions)
      }
    })
  }, [])

  // 切换分布时恢复默认参数
  const handleDistributionChange = (key: DistributionType) => {
    setDistribution(key)
    setParams({ ...DEFAULT_PRESETS[key] })
  }

  const updateParam = (key: string, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }))
  }

  const startSimulation = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const request: CLTSimulateRequest = {
        distribution,
        params,
        sample_size: sampleSize,
        num_samples: numSamples,
      }

      const response = await probabilityApi.simulateCLT(request)

      if (response.success) {
        setData(response.data)
        setAnimation({
          running: true,
          currentIndex: 0,
          means: [],
        })
      } else {
        setError(response.error || '模拟失败')
      }
    } catch (err: any) {
      setError('无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }, [distribution, params, sampleSize, numSamples])

  // 动画循环：逐步展示样本均值的累积分布
  useEffect(() => {
    if (!data || !animation.running) return

    const batchSize = Math.max(1, Math.floor(numSamples / 100))

    const animate = () => {
      setAnimation((prev) => {
        const nextIndex = prev.currentIndex + batchSize

        if (nextIndex >= data.sample_means.length) {
          if (timerRef.current) clearInterval(timerRef.current)
          return {
            running: false,
            currentIndex: data.sample_means.length,
            means: data.sample_means,
          }
        }

        return {
          ...prev,
          currentIndex: nextIndex,
          means: data.sample_means.slice(0, nextIndex),
        }
      })
    }

    timerRef.current = setInterval(animate, animationSpeed)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [data, animation.running, animationSpeed, numSamples])

  const stopAnimation = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setAnimation((prev) => ({ ...prev, running: false }))
  }

  const reset = () => {
    stopAnimation()
    setAnimation({ running: false, currentIndex: 0, means: [] })
  }

  // 原始分布直方图
  const buildSingleSampleTrace = (): Partial<Data> | null => {
    if (!data) return null
    return {
      x: data.single_sample.x,
      y: data.single_sample.y,
      type: 'bar',
      name: '单个样本分布',
      marker: { color: '#93c5fd' },
      opacity: 0.8,
    }
  }

  // 样本均值直方图
  const buildMeansHistogram = (): Partial<Data> | null => {
    if (!data || animation.means.length === 0) return null

    const counts: Record<string, number> = {}
    const binCount = 30
    const min = Math.min(...animation.means)
    const max = Math.max(...animation.means)
    const width = (max - min) / binCount || 1

    for (let i = 0; i < binCount; i++) {
      counts[(min + i * width).toFixed(4)] = 0
    }

    animation.means.forEach((m) => {
      const binIdx = Math.min(binCount - 1, Math.floor((m - min) / width))
      const key = (min + binIdx * width).toFixed(4)
      counts[key] = (counts[key] || 0) + 1
    })

    const total = animation.means.length
    const xValues = Object.keys(counts)
      .map(Number)
      .sort((a, b) => a - b)
    const yValues = xValues.map((x) => (counts[x.toFixed(4)] || 0) / total / width)

    return {
      x: xValues,
      y: yValues,
      type: 'bar',
      name: `样本均值分布 (n=${animation.means.length})`,
      marker: { color: '#3b82f6' },
      opacity: 0.7,
    }
  }

  // 理论正态拟合曲线
  const buildNormalCurve = (): Partial<Data> | null => {
    if (!data) return null
    return {
      x: data.normal_curve.x,
      y: data.normal_curve.y,
      type: 'scatter',
      mode: 'lines',
      name: '理论正态近似',
      line: { color: '#ef4444', width: 2 },
    }
  }

  // 渲染参数输入
  const renderParamInputs = () => {
    const preset = presets.find((p) => p.id === distribution)
    if (!preset) return null

    return Object.entries(preset.params).map(([key, config]) => (
      <div className="form-group" key={key}>
        <label>{config.label}</label>
        <input
          type="number"
          min={config.min}
          max={config.max}
          step={config.step}
          value={params[key] ?? config.default}
          onChange={(e) => updateParam(key, parseFloat(e.target.value) || 0)}
        />
        <div className="slider-container">
          <input
            type="range"
            min={config.min}
            max={config.max}
            step={config.step}
            value={params[key] ?? config.default}
            onChange={(e) => updateParam(key, parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
          <span className="slider-value">
            {(params[key] ?? config.default).toFixed(config.step < 1 ? 2 : 0)}
          </span>
        </div>
      </div>
    ))
  }

  const currentPreset = presets.find((p) => p.id === distribution)

  return (
    <div className="detail-page">
      <PageHeader
        backTo="/subject/probability"
        backLabel="返回概率论"
        breadcrumbs={[
          { label: '首页', path: '/' },
          { label: '概率论与数理统计', path: '/subject/probability' },
          { label: '中心极限定理' },
        ]}
        title="中心极限定理"
      />

      <VisualizationWorkspace
        visualizationTitle="样本均值的分布"
        controls={
          <ControlPanel title="实验参数" subtitle="选择基础分布并调整抽样参数">
            <div className="form-section">
              <h4 className="form-section-title">基础分布</h4>
              <select
                className="form-select"
                value={distribution}
                onChange={(e) => handleDistributionChange(e.target.value as DistributionType)}
              >
                {DISTRIBUTION_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {currentPreset && (
                <p
                  className="text-secondary"
                  style={{ fontSize: '0.875rem', marginTop: 'var(--space-2)' }}
                >
                  {currentPreset.description}
                </p>
              )}
            </div>

            <div className="form-section">
              <h4 className="form-section-title">分布参数</h4>
              {renderParamInputs()}
            </div>

            <div className="form-section">
              <h4 className="form-section-title">抽样参数</h4>
              <div className="form-group">
                <label>每样本容量 n</label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  step={1}
                  value={sampleSize}
                  onChange={(e) => setSampleSize(parseInt(e.target.value) || 1)}
                />
                <div className="slider-container">
                  <input
                    type="range"
                    min={1}
                    max={200}
                    step={1}
                    value={sampleSize}
                    onChange={(e) => setSampleSize(parseInt(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span className="slider-value">{sampleSize}</span>
                </div>
              </div>

              <div className="form-group">
                <label>重复抽样次数</label>
                <input
                  type="number"
                  min={100}
                  max={50000}
                  step={100}
                  value={numSamples}
                  onChange={(e) => setNumSamples(parseInt(e.target.value) || 100)}
                />
                <div className="slider-container">
                  <input
                    type="range"
                    min={500}
                    max={10000}
                    step={500}
                    value={numSamples}
                    onChange={(e) => setNumSamples(parseInt(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span className="slider-value">{numSamples}</span>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>动画速度 (ms)</label>
                <div className="slider-container">
                  <input
                    type="range"
                    min={10}
                    max={200}
                    step={10}
                    value={animationSpeed}
                    onChange={(e) => setAnimationSpeed(parseInt(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span className="slider-value">{animationSpeed}ms</span>
                </div>
              </div>
            </div>

            <div className="button-stack">
              {!animation.running && animation.currentIndex === 0 ? (
                <button className="btn btn-primary" onClick={startSimulation} disabled={loading}>
                  {loading ? '计算中...' : '开始模拟'}
                </button>
              ) : animation.running ? (
                <button className="btn btn-secondary" onClick={stopAnimation}>
                  暂停
                </button>
              ) : (
                <button className="btn btn-secondary" onClick={startSimulation}>
                  继续
                </button>
              )}
              <button className="btn btn-secondary" onClick={reset}>
                重置
              </button>
            </div>
          </ControlPanel>
        }
        visualization={
          <>
            {error && <ErrorState message={error} />}
            {loading && !data && <LoadingState text="正在模拟..." />}
            <VisualizationCard title="样本均值分布" subtitle="观察样本均值如何趋近正态分布">
              {data && animation.means.length > 0 ? (
                <div style={{ position: 'absolute', inset: 0, padding: 'var(--space-2)' }}>
                  <Plot
                    data={[buildMeansHistogram(), buildNormalCurve()].filter(Boolean) as any}
                    layout={
                      {
                        autosize: true,
                        xaxis: { title: '样本均值' },
                        yaxis: { title: '频率密度' },
                        showlegend: true,
                        legend: { x: 1, y: 1 },
                        margin: { t: 30, r: 30, b: 40, l: 50 },
                      } as any
                    }
                    config={{ responsive: true, displayModeBar: false }}
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              ) : (
                <div className="empty-state h-full">点击"开始模拟"运行实验</div>
              )}
            </VisualizationCard>
          </>
        }
        infoPanels={
          <>
            <CollapsibleSection title="原始分布" defaultExpanded={true}>
              {data ? (
                <div style={{ position: 'relative', height: '240px' }}>
                  <Plot
                    data={[buildSingleSampleTrace()].filter(Boolean) as any}
                    layout={
                      {
                        autosize: true,
                        xaxis: { title: '取值' },
                        yaxis: { title: '频率密度' },
                        showlegend: false,
                        margin: { t: 20, r: 20, b: 40, l: 50 },
                      } as any
                    }
                    config={{ responsive: true, displayModeBar: false }}
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              ) : (
                <div className="empty-state">等待开始模拟...</div>
              )}
            </CollapsibleSection>

            {data && (
              <CollapsibleSection title="统计量" defaultExpanded={true}>
                <div className="info-grid">
                  <div className="info-item">
                    <span>已完成样本</span>
                    <span>
                      {animation.means.length} / {data.sample_means.length}
                    </span>
                  </div>
                  <div className="info-item">
                    <span>样本均值均值</span>
                    <span>{data.sample_mean_of_means.toFixed(4)}</span>
                  </div>
                  <div className="info-item">
                    <span>样本均值标准差</span>
                    <span>{data.sample_std_of_means.toFixed(4)}</span>
                  </div>
                  <div className="info-item">
                    <span>理论均值</span>
                    <span>{data.theoretical.mean.toFixed(4)}</span>
                  </div>
                  <div className="info-item">
                    <span>理论标准差（CLT）</span>
                    <span>{data.normal_curve.std.toFixed(4)}</span>
                  </div>
                </div>
              </CollapsibleSection>
            )}

            <CollapsibleSection title="中心极限定理说明" defaultExpanded={false}>
              <p style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
                <strong>中心极限定理（CLT）</strong>指出：无论总体服从什么分布，当样本容量
                <em>n</em> 足够大时，样本均值的分布将近似服从正态分布
                <code>N(μ, σ²/n)</code>。
                <br />
                <br />
                调整"每样本容量"和"重复抽样次数"，观察右侧直方图如何逐渐呈现钟形曲线。
              </p>
            </CollapsibleSection>
          </>
        }
      />
    </div>
  )
}
