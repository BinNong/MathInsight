import { useState, useEffect, useRef, useCallback } from 'react'
import Plot from 'react-plotly.js'
import type { Data } from 'plotly.js'
import { probabilityApi, LLNSimulateRequest, LLNResultData } from '../services/api'
import { Link } from 'react-router-dom'

// 预设配置
interface Preset {
  key: string
  label: string
  type: 'coin' | 'dice'
  params: {
    p?: number
    minVal?: number
    maxVal?: number
    sampleSize: number
  }
}

const PRESETS: Preset[] = [
  { key: 'coin_fair', label: '公平硬币', type: 'coin', params: { p: 0.5, sampleSize: 1000 } },
  { key: 'coin_biased', label: '偏心硬币', type: 'coin', params: { p: 0.7, sampleSize: 1000 } },
  { key: 'dice_std', label: '标准骰子', type: 'dice', params: { minVal: 1, maxVal: 6, sampleSize: 1000 } },
  { key: 'dice_custom', label: '自定义骰子', type: 'dice', params: { minVal: 1, maxVal: 4, sampleSize: 1000 } }
]

interface ExperimentState {
  running: boolean
  currentIndex: number
  samples: number[]
  cumulativeMeans: number[]
}

export default function ProbabilitySim() {
  // 实验配置
  const [experimentType, setExperimentType] = useState<'coin' | 'dice'>('coin')
  const [p, setP] = useState(0.5)
  const [minVal, setMinVal] = useState(1)
  const [maxVal, setMaxVal] = useState(6)
  const [sampleSize, setSampleSize] = useState(1000)
  const [animationSpeed, setAnimationSpeed] = useState(50)

  // 实验状态
  const [data, setData] = useState<LLNResultData | null>(null)
  const [experimentState, setExperimentState] = useState<ExperimentState>({
    running: false,
    currentIndex: 0,
    samples: [],
    cumulativeMeans: []
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // 加载预设
  const applyPreset = (preset: Preset) => {
    setExperimentType(preset.type)
    if (preset.type === 'coin') {
      setP(preset.params.p ?? 0.5)
      setMinVal(1)
      setMaxVal(1)
    } else {
      setMinVal(preset.params.minVal ?? 1)
      setMaxVal(preset.params.maxVal ?? 6)
      setP(0.5)
    }
    setSampleSize(preset.params.sampleSize)
  }

  // 开始模拟
  const startSimulation = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const request: LLNSimulateRequest = {
        experiment_type: experimentType,
        sample_size: sampleSize
        // 不传 seed，让后端使用系统时间作为种子
      }

      if (experimentType === 'coin') {
        request.p = p
      } else {
        request.min_val = minVal
        request.max_val = maxVal
      }

      const response = await probabilityApi.simulateLLN(request)

      if (response.success) {
        setData(response.data)
        // 初始化实验状态
        setExperimentState({
          running: true,
          currentIndex: 0,
          samples: [],
          cumulativeMeans: []
        })
      } else {
        setError(response.error || '模拟失败')
      }
    } catch (err: any) {
      setError('无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }, [experimentType, p, minVal, maxVal, sampleSize])

  // 动画循环
  useEffect(() => {
    if (!data || !experimentState.running) return

    const batchSize = Math.max(1, Math.floor(sampleSize / 100))

    const animate = () => {
      setExperimentState(prev => {
        const nextIndex = prev.currentIndex + batchSize

        if (nextIndex >= data.samples.length) {
          // 动画结束
          if (timerRef.current) clearInterval(timerRef.current)
          return {
            ...prev,
            running: false,
            currentIndex: data.samples.length,
            samples: data.samples,
            cumulativeMeans: data.cumulative_means
          }
        }

        // 添加新批次的数据
        const newSamples = [...data.samples.slice(0, nextIndex)]
        const newMeans = [...data.cumulative_means.slice(0, nextIndex)]

        return {
          ...prev,
          currentIndex: nextIndex,
          samples: newSamples,
          cumulativeMeans: newMeans
        }
      })
    }

    timerRef.current = setInterval(animate, animationSpeed)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [data, experimentState.running, animationSpeed, sampleSize])

  // 停止动画
  const stopAnimation = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setExperimentState(prev => ({ ...prev, running: false }))
  }

  // 重置
  const reset = () => {
    stopAnimation()
    setExperimentState({
      running: false,
      currentIndex: 0,
      samples: [],
      cumulativeMeans: []
    })
  }

  // 构建收敛曲线图数据
  const buildConvergenceTrace = (): Partial<Data> => {
    const x = experimentState.cumulativeMeans.map((_, i) => i + 1)
    const y = experimentState.cumulativeMeans

    return {
      x,
      y,
      type: 'scatter',
      mode: 'lines',
      line: { color: '#3b82f6', width: 2 },
      name: '样本均值'
    }
  }

  // 构建期望值线
  const buildExpectedLine = (): Partial<Data> => {
    const expected = data?.expected_value || p
    const maxIndex = experimentState.cumulativeMeans.length || sampleSize

    return {
      x: [0, maxIndex],
      y: [expected, expected],
      type: 'scatter',
      mode: 'lines',
      line: { color: '#ef4444', width: 2, dash: 'dash' },
      name: `期望值 ${expected.toFixed(2)}`
    }
  }

  // 构建样本分布直方图
  const buildHistogramTrace = (): Partial<Data> | null => {
    const samples = experimentState.samples
    if (samples.length === 0) return null

    // 计算频率
    const counts: Record<number, number> = {}
    if (experimentType === 'coin') {
      counts[0] = 0
      counts[1] = 0
    } else {
      for (let i = minVal; i <= maxVal; i++) counts[i] = 0
    }

    samples.forEach(s => {
      counts[s] = (counts[s] || 0) + 1
    })

    const xValues = Object.keys(counts).map(Number)
    const yValues = Object.values(counts).map(c => c / samples.length)

    return {
      x: xValues,
      y: yValues,
      type: 'bar',
      marker: {
        color: xValues.map(v =>
          experimentType === 'coin'
            ? (v === 0 ? '#ef4444' : '#10b981')
            : '#3b82f6'
        )
      },
      name: '频率'
    }
  }

  // 构建理论概率线（如果是硬币）
  const buildTheoryLines = (): Partial<Data>[] => {
    if (experimentType !== 'coin' || !data) return []

    return [{
      x: [0, 1],
      y: [1 - p, p],
      type: 'scatter',
      mode: 'markers',
      marker: { size: 12, color: '#ef4444', symbol: 'diamond' },
      name: '理论概率'
    }]
  }

  // 当前统计
  const currentStats = () => {
    const n = experimentState.samples.length
    const mean = n > 0 ? experimentState.cumulativeMeans[n - 1] : 0
    const expected = data?.expected_value || (experimentType === 'coin' ? p : (minVal + maxVal) / 2)
    const diff = n > 0 ? Math.abs(mean - expected) : 0

    return { n, mean, expected, diff }
  }

  const stats = currentStats()

  // 计算收敛曲线 Y 轴范围
  const getYAxisRange = (): [number, number] => {
    if (experimentType === 'coin') {
      return [0, 1]
    } else {
      // 骰子：期望值在 (minVal+maxVal)/2 附近，设置合适的范围
      const padding = (maxVal - minVal) * 0.2
      return [minVal - padding, maxVal + padding]
    }
  }

  const yAxisRange = getYAxisRange()

  return (
    <div className="detail-page">
      <header className="detail-header">
        <Link to="/subject/probability" className="detail-back-button">
          ← 返回概率论
        </Link>
        <div className="breadcrumb">
          <Link to="/">首页</Link>
          <span className="breadcrumb-separator">/</span>
          <Link to="/subject/probability">概率论与数理统计</Link>
          <span className="breadcrumb-separator">/</span>
          <span>大数定律</span>
        </div>
        <h1 className="detail-title">大数定律可视化</h1>
      </header>

      <div className="content-card" style={{ margin: '2rem', maxWidth: '1400px' }}>
        <div className="card-header">
          <h2>大数定律可视化</h2>
          <p>通过蒙特卡洛模拟直观理解大数定律</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem' }}>
        {/* 左侧控制面板 */}
        <div>
          {/* 快速预设 */}
          <div style={{
            background: 'var(--background)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              快速预设
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {PRESETS.map(preset => (
                <button
                  key={preset.key}
                  className="btn btn-secondary"
                  onClick={() => applyPreset(preset)}
                  style={{ fontSize: '0.75rem', padding: '0.5rem' }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* 实验类型 */}
          <div style={{
            background: 'var(--background)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              实验类型
            </h4>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                className={`btn ${experimentType === 'coin' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setExperimentType('coin')}
                style={{ flex: 1 }}
              >
                抛硬币
              </button>
              <button
                className={`btn ${experimentType === 'dice' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setExperimentType('dice')}
                style={{ flex: 1 }}
              >
                掷骰子
              </button>
            </div>

            {experimentType === 'coin' ? (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>正面概率 p</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={p}
                  onChange={(e) => setP(parseFloat(e.target.value) || 0)}
                />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={p}
                  onChange={(e) => setP(parseFloat(e.target.value))}
                />
                <span className="slider-value">{p.toFixed(2)}</span>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>最小值</label>
                  <input
                    type="number"
                    value={minVal}
                    onChange={(e) => setMinVal(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>最大值</label>
                  <input
                    type="number"
                    value={maxVal}
                    onChange={(e) => setMaxVal(parseInt(e.target.value) || 6)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 高级选项 */}
          <div style={{
            background: 'var(--background)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                width: '100%',
                textAlign: 'left'
              }}
            >
              {showAdvanced ? '收起' : '展开'}高级选项 ▾
            </button>

            {showAdvanced && (
              <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>样本数量</label>
                  <input
                    type="number"
                    min="100"
                    max="10000"
                    step="100"
                    value={sampleSize}
                    onChange={(e) => setSampleSize(parseInt(e.target.value) || 1000)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>动画速度 (ms)</label>
                  <input
                    type="range"
                    min="10"
                    max="500"
                    step="10"
                    value={animationSpeed}
                    onChange={(e) => setAnimationSpeed(parseInt(e.target.value))}
                  />
                  <span className="slider-value">{animationSpeed}ms</span>
                </div>
              </div>
            )}
          </div>

          {/* 控制按钮 */}
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {!experimentState.running && experimentState.currentIndex === 0 ? (
              <button
                className="btn btn-primary"
                onClick={startSimulation}
                disabled={loading}
              >
                {loading ? '加载中...' : '开始模拟'}
              </button>
            ) : experimentState.running ? (
              <button className="btn btn-secondary" onClick={stopAnimation}>
                暂停
              </button>
            ) : (
              <button className="btn btn-secondary" onClick={startSimulation}>
                继续
              </button>
            )}
            <button className="btn btn-outline" onClick={reset}>
              重置
            </button>
          </div>

          {/* 统计面板 */}
          {data && (
            <div className="info-panel" style={{ marginTop: '1rem' }}>
              <h4>当前统计</h4>
              <div className="info-item">
                <span>样本数</span>
                <span>{stats.n} / {sampleSize}</span>
              </div>
              <div className="info-item">
                <span>当前均值</span>
                <span>{stats.mean.toFixed(4)}</span>
              </div>
              <div className="info-item">
                <span>理论期望</span>
                <span>{stats.expected.toFixed(4)}</span>
              </div>
              <div className="info-item">
                <span>偏差</span>
                <span style={{ color: stats.diff < 0.01 ? '#10b981' : '#ef4444' }}>
                  {stats.diff.toFixed(4)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 右侧可视化区域 */}
        <div>
          {error && (
            <div className="error-message">
              <span style={{ marginRight: '8px' }}>⚠️</span>
              {error}
            </div>
          )}

          {loading && !data && (
            <div className="loading">加载中...</div>
          )}

          {/* 左侧：实验动画 */}
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>实验过程</h4>
            <div className="visualization-container" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '120px',
              background: 'var(--background)',
              borderRadius: '8px'
            }}>
              {experimentState.samples.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>点击"开始模拟"运行实验</p>
              ) : experimentType === 'coin' ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: experimentState.samples[experimentState.samples.length - 1] === 1
                      ? 'linear-gradient(135deg, #10b981, #059669)'
                      : 'linear-gradient(135deg, #ef4444, #dc2626)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem',
                    fontSize: '2rem',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}>
                    {experimentState.samples[experimentState.samples.length - 1] === 1 ? '正' : '反'}
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    第 {experimentState.samples.length} 次抛掷
                  </p>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem',
                    fontSize: '2.5rem',
                    fontWeight: 'bold',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}>
                    {experimentState.samples[experimentState.samples.length - 1]}
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    第 {experimentState.samples.length} 次掷骰子
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 右侧：收敛曲线 */}
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>收敛曲线</h4>
            <div className="visualization-container">
              {experimentState.cumulativeMeans.length > 0 ? (
                <Plot
                  data={[buildConvergenceTrace(), buildExpectedLine()] as any}
                  layout={{
                    width: 650,
                    height: 300,
                    xaxis: { title: '样本数量', range: [0, sampleSize] },
                    yaxis: { title: '累积均值', range: yAxisRange },
                    showlegend: true,
                    legend: { x: 1, y: 1 },
                    margin: { t: 30, r: 30, b: 40, l: 50 }
                  } as any}
                  config={{ responsive: true, displayModeBar: false }}
                />
              ) : (
                <div style={{
                  height: '300px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)'
                }}>
                  等待开始模拟...
                </div>
              )}
            </div>
          </div>

          {/* 底部：分布直方图 */}
          <div>
            <h4 style={{ marginBottom: '0.5rem' }}>样本分布</h4>
            <div className="visualization-container">
              {experimentState.samples.length > 0 ? (
                <Plot
                  data={[
                    buildHistogramTrace()!,
                    ...buildTheoryLines()
                  ] as any}
                  layout={{
                    width: 650,
                    height: 250,
                    xaxis: {
                      title: experimentType === 'coin' ? '结果 (0=反面, 1=正面)' : '点数',
                      tickvals: experimentType === 'coin' ? [0, 1] : Array.from({ length: maxVal - minVal + 1 }, (_, i) => minVal + i)
                    },
                    yaxis: { title: '频率', range: [0, 1] },
                    showlegend: true,
                    legend: { x: 1, y: 1 },
                    margin: { t: 30, r: 30, b: 40, l: 50 }
                  } as any}
                  config={{ responsive: true, displayModeBar: false }}
                />
              ) : (
                <div style={{
                  height: '250px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)'
                }}>
                  等待开始模拟...
                </div>
              )}
            </div>
          </div>

          {/* 图例说明 */}
          <div className="info-panel">
            <h4>大数定律说明</h4>
            <p style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
              <strong>大数定律</strong>指出：当独立重复试验的次数足够多时，样本均值会
              越来越接近理论期望值。<br /><br />
              <span style={{ color: '#3b82f6' }}>—</span> 蓝色曲线：样本均值随试验次数的变化<br />
              <span style={{ color: '#ef4444' }}>--</span> 红色虚线：理论期望值 E[X]
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
