import { useState, useEffect, useCallback, useRef } from 'react'
import Plot from 'react-plotly.js'
import type { Data } from 'plotly.js'
import {
  probabilityApi,
  DistributionSimulateRequest,
  DistributionResultData,
  DistributionPreset,
} from '../services/api'
import PageHeader from '../components/PageHeader'
import ControlPanel from '../components/ControlPanel'
import VisualizationCard from '../components/VisualizationCard'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import VisualizationWorkspace from '../components/VisualizationWorkspace'
import CollapsibleSection from '../components/CollapsibleSection'

export default function ProbabilityDistributions() {
  const [presets, setPresets] = useState<DistributionPreset[]>([])
  const [currentPreset, setCurrentPreset] = useState<DistributionPreset | null>(null)
  const [params, setParams] = useState<Record<string, number>>({})
  const [sampleSize, setSampleSize] = useState(5000)

  const [data, setData] = useState<DistributionResultData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasInitializedRef = useRef(false)

  const handlePresetChange = useCallback((preset: DistributionPreset) => {
    setCurrentPreset(preset)
    const defaults: Record<string, number> = {}
    Object.entries(preset.params).forEach(([key, config]) => {
      defaults[key] = config.default
    })
    setParams(defaults)
  }, [])

  // 加载分布预设
  useEffect(() => {
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true

    probabilityApi.getDistributionPresets().then((response) => {
      if (response.success && response.data?.distributions) {
        const list = response.data.distributions
        setPresets(list)
        if (list.length > 0 && !currentPreset) {
          handlePresetChange(list[0])
        }
      }
    })
  }, [currentPreset, handlePresetChange])

  const updateParam = (key: string, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }))
  }

  const generate = useCallback(async () => {
    if (!currentPreset) return

    setLoading(true)
    setError(null)

    try {
      const request: DistributionSimulateRequest = {
        distribution: currentPreset.id,
        params,
        sample_size: sampleSize,
      }

      const response = await probabilityApi.simulateDistribution(request)

      if (response.success) {
        setData(response.data)
      } else {
        setError(response.error || '模拟失败')
      }
    } catch (err: any) {
      setError('无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }, [currentPreset, params, sampleSize])

  // 初始自动生成一次
  useEffect(() => {
    if (currentPreset && !data && !loading) {
      generate()
    }
  }, [currentPreset, generate, data, loading])

  const buildHistogramTrace = (): Partial<Data> | null => {
    if (!data) return null
    return {
      x: data.histogram.x,
      y: data.histogram.y,
      type: 'bar',
      name: '样本直方图',
      marker: { color: '#3b82f6' },
      opacity: 0.7,
    }
  }

  const buildTheoreticalTrace = (): Partial<Data> | null => {
    if (!data) return null
    return {
      x: data.theoretical_curve.x,
      y: data.theoretical_curve.y,
      type: 'scatter',
      mode: 'lines',
      name: '理论分布',
      line: { color: '#ef4444', width: 2 },
    }
  }

  const formatNumber = (value: number) => {
    if (Number.isInteger(value)) return value.toString()
    return value.toFixed(4)
  }

  return (
    <div className="detail-page">
      <PageHeader
        backTo="/subject/probability"
        backLabel="返回概率论"
        breadcrumbs={[
          { label: '首页', path: '/' },
          { label: '概率论与数理统计', path: '/subject/probability' },
          { label: '常见概率分布' },
        ]}
        title="常见概率分布"
      />

      <VisualizationWorkspace
        visualizationTitle="概率分布可视化"
        controls={
          <ControlPanel title="分布参数" subtitle="选择分布并调整参数">
            <div className="form-section">
              <h4 className="form-section-title">分布类型</h4>
              <select
                className="form-select"
                value={currentPreset?.id || ''}
                onChange={(e) => {
                  const preset = presets.find((p) => p.id === e.target.value)
                  if (preset) handlePresetChange(preset)
                }}
              >
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
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

            {currentPreset && (
              <div className="form-section">
                <h4 className="form-section-title">参数</h4>
                {Object.entries(currentPreset.params).map(([key, config]) => (
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
                ))}
              </div>
            )}

            <div className="form-section">
              <h4 className="form-section-title">样本设置</h4>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>样本容量</label>
                <input
                  type="number"
                  min={100}
                  max={50000}
                  step={100}
                  value={sampleSize}
                  onChange={(e) => setSampleSize(parseInt(e.target.value) || 100)}
                />
                <div className="slider-container">
                  <input
                    type="range"
                    min={1000}
                    max={20000}
                    step={1000}
                    value={sampleSize}
                    onChange={(e) => setSampleSize(parseInt(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span className="slider-value">{sampleSize}</span>
                </div>
              </div>
            </div>

            <div className="button-stack">
              <button
                className="btn btn-primary"
                onClick={generate}
                disabled={loading || !currentPreset}
              >
                {loading ? '计算中...' : '生成样本'}
              </button>
            </div>
          </ControlPanel>
        }
        visualization={
          <>
            {error && <ErrorState message={error} />}
            {loading && !data && <LoadingState text="正在生成..." />}
            <VisualizationCard title="分布图" subtitle="样本直方图与理论概率密度/质量函数">
              {data ? (
                <div style={{ position: 'absolute', inset: 0, padding: 'var(--space-2)' }}>
                  <Plot
                    data={[buildHistogramTrace(), buildTheoreticalTrace()].filter(Boolean) as any}
                    layout={
                      {
                        autosize: true,
                        xaxis: { title: '取值' },
                        yaxis: { title: '概率密度 / 质量' },
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
                <div className="empty-state h-full">选择分布并点击"生成样本"</div>
              )}
            </VisualizationCard>
          </>
        }
        infoPanels={
          <>
            {data && (
              <CollapsibleSection title="样本统计量" defaultExpanded={true}>
                <div className="info-grid">
                  <div className="info-item">
                    <span>样本均值</span>
                    <span>{formatNumber(data.statistics.mean)}</span>
                  </div>
                  <div className="info-item">
                    <span>样本方差</span>
                    <span>{formatNumber(data.statistics.variance)}</span>
                  </div>
                  <div className="info-item">
                    <span>中位数</span>
                    <span>{formatNumber(data.statistics.median)}</span>
                  </div>
                  <div className="info-item">
                    <span>最小值</span>
                    <span>{formatNumber(data.statistics.min)}</span>
                  </div>
                  <div className="info-item">
                    <span>最大值</span>
                    <span>{formatNumber(data.statistics.max)}</span>
                  </div>
                </div>
              </CollapsibleSection>
            )}

            {data && (
              <CollapsibleSection title="理论值" defaultExpanded={true}>
                <div className="info-grid">
                  <div className="info-item">
                    <span>理论期望 E[X]</span>
                    <span>{formatNumber(data.theoretical.mean)}</span>
                  </div>
                  <div className="info-item">
                    <span>理论方差 Var(X)</span>
                    <span>{formatNumber(data.theoretical.variance)}</span>
                  </div>
                </div>
              </CollapsibleSection>
            )}

            <CollapsibleSection title="分布说明" defaultExpanded={false}>
              {currentPreset ? (
                <p style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
                  <strong>{currentPreset.name}</strong>
                  <br />
                  {currentPreset.description}
                  <br />
                  <br />
                  类型：{currentPreset.type === 'discrete' ? '离散分布' : '连续分布'}
                </p>
              ) : (
                <p className="text-secondary">选择一种分布查看说明</p>
              )}
            </CollapsibleSection>
          </>
        }
      />
    </div>
  )
}
