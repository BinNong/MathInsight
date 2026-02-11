import { useState, useEffect, useCallback } from 'react'
import Plot from 'react-plotly.js'
import { vectorFieldApi, VectorFieldData, LineIntegralData, GreensTheoremData, StreamlineData, VectorFieldPreset, PathPreset } from '../services/api'
import { Link } from 'react-router-dom'

// ============ 类型定义 ============

type VectorFieldMode = 'field' | 'line_integral' | 'greens_theorem' | 'flux'
type PathType = 'circle' | 'ellipse' | 'line_segment' | 'parabola' | 'square'
type RegionType = 'circle' | 'rectangle'

interface VectorFieldState {
  // 向量场参数
  P: string
  Q: string
  xRange: [number, number]
  yRange: [number, number]
  resolution: number

  // 可视化选项
  showStreamlines: boolean

  // 积分模式
  mode: VectorFieldMode

  // 路径参数
  pathType: PathType

  // 格林公式参数
  regionType: RegionType
  regionRadius: number
  regionXMin: number
  regionXMax: number
  regionYMin: number
  regionYMax: number

  // 流线参数
  streamlineStartPoints: string
  streamlineTimeSpan: number
}

// ============ 默认状态 ============

const DEFAULT_STATE: VectorFieldState = {
  P: '-y',
  Q: 'x',
  xRange: [-3, 3],
  yRange: [-3, 3],
  resolution: 20,
  showStreamlines: false,
  mode: 'field',
  pathType: 'circle',
  regionType: 'circle',
  regionRadius: 1,
  regionXMin: -1,
  regionXMax: 1,
  regionYMin: -1,
  regionYMax: 1,
  streamlineStartPoints: '[[1,0],[0,1],[-1,0],[0,-1]]',
  streamlineTimeSpan: 3
}

// ============ 预设向量场 ============

const VECTOR_FIELD_PRESETS: VectorFieldPreset[] = [
  { id: 'rotational', name: '旋转场', description: 'F = (-y, x)', P: '-y', Q: 'x' },
  { id: 'conservative', name: '保守场', description: 'F = (2x, 2y)', P: '2*x', Q: '2*y' },
  { id: 'radial', name: '辐射场', description: 'F = (x, y)', P: 'x', Q: 'y' },
  { id: 'shear', name: '剪切场', description: 'F = (y, 0)', P: 'y', Q: '0' },
  { id: 'saddle', name: '鞍点场', description: 'F = (x, -y)', P: 'x', Q: '-y' },
  { id: 'vortex', name: '涡旋场', description: 'F = (-y/(x²+y²), x/(x²+y²))', P: '-y/(x**2 + y**2 + 0.1)', Q: 'x/(x**2 + y**2 + 0.1)' }
]

// ============ 路径预设 ============

const PATH_PRESETS: PathPreset[] = [
  { id: 'circle', name: '单位圆', description: 'x=cos(t), y=sin(t)', parametric: { x: 'cos(t)', y: 'sin(t)', t_range: [0, 2 * Math.PI] }, is_closed: true },
  { id: 'ellipse', name: '椭圆', description: 'x=2cos(t), y=sin(t)', parametric: { x: '2*cos(t)', y: 'sin(t)', t_range: [0, 2 * Math.PI] }, is_closed: true },
  { id: 'line_segment', name: '直线段', description: '从(-1,-1)到(1,1)', parametric: { x: 't', y: 't', t_range: [-1, 1] }, is_closed: false },
  { id: 'parabola', name: '抛物线', description: 'y=x²', parametric: { x: 't', y: 't**2', t_range: [-1, 1] }, is_closed: false },
  { id: 'square', name: '正方形', description: '边长为2的正方形', parametric: { segments: [] }, is_closed: true }
]

// ============ 主组件 ============

export default function VectorFieldLineIntegrals() {
  const [state, setState] = useState<VectorFieldState>(DEFAULT_STATE)
  const [vectorFieldData, setVectorFieldData] = useState<VectorFieldData | null>(null)
  const [lineIntegralData, setLineIntegralData] = useState<LineIntegralData | null>(null)
  const [greensData, setGreensData] = useState<GreensTheoremData | null>(null)
  const [streamlines, setStreamlines] = useState<StreamlineData | null>(null)
  const [presets, setPresets] = useState<{ vector_fields: VectorFieldPreset[]; paths: PathPreset[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 获取预设
  useEffect(() => {
    const fetchPresets = async () => {
      const response = await vectorFieldApi.getPresets()
      if (response.success && response.data) {
        setPresets(response.data)
      }
    }
    fetchPresets()
  }, [])

  // 获取向量场数据
  const fetchVectorField = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await vectorFieldApi.vectorField({
        P: state.P,
        Q: state.Q,
        x_range: state.xRange,
        y_range: state.yRange,
        resolution: state.resolution
      })

      if (response.success) {
        setVectorFieldData(response)
      } else {
        setVectorFieldData(null)
        setError(response.error || '计算失败')
      }
    } catch (err) {
      setError('无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }, [state.P, state.Q, state.xRange, state.yRange, state.resolution])

  // 获取线积分数据
  const fetchLineIntegral = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const pathConfig = buildPathConfig()
      const response = await vectorFieldApi.lineIntegral({
        P: state.P,
        Q: state.Q,
        path: pathConfig,
        num_points: 200
      })

      if (response.success) {
        setLineIntegralData(response)
      } else {
        setError(response.error || '计算失败')
      }
    } catch (err) {
      setError('无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }, [state.P, state.Q, state.pathType, state.xRange, state.yRange])

  // 获取格林公式验证数据
  const fetchGreensTheorem = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const regionParams = state.regionType === 'circle'
        ? { radius: state.regionRadius }
        : { x_min: state.regionXMin, x_max: state.regionXMax, y_min: state.regionYMin, y_max: state.regionYMax }

      const response = await vectorFieldApi.greensTheorem({
        P: state.P,
        Q: state.Q,
        region_type: state.regionType,
        region_params: regionParams
      })

      if (response.success) {
        setGreensData(response)
      } else {
        setError(response.error || '计算失败')
      }
    } catch (err) {
      setError('无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }, [state.P, state.Q, state.regionType, state.regionRadius, state.regionXMin, state.regionXMax, state.regionYMin, state.regionYMax])

  // 获取流线数据
  const fetchStreamlines = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const startPoints = JSON.parse(state.streamlineStartPoints)
      const response = await vectorFieldApi.streamline({
        P: state.P,
        Q: state.Q,
        start_points: startPoints,
        t_span: [-state.streamlineTimeSpan, state.streamlineTimeSpan],
        direction: 'both'
      })

      if (response.success) {
        setStreamlines(response)
      } else {
        setError(response.error || '计算失败')
      }
    } catch (err) {
      setError('无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }, [state.P, state.Q, state.streamlineStartPoints, state.streamlineTimeSpan])

  // 构建路径配置
  const buildPathConfig = () => {
    const preset = presets?.paths.find(p => p.id === state.pathType) || PATH_PRESETS.find(p => p.id === state.pathType)

    if (state.pathType === 'square') {
      // 正方形路径（多段）
      const r = 1
      return {
        type: 'segments' as const,
        segments: [
          { x: 't', y: `${-r}`, t_range: [-r, r] },
          { x: `${r}`, y: 't', t_range: [-r, r] },
          { x: 't', y: `${r}`, t_range: [r, -r] },
          { x: `${-r}`, y: 't', t_range: [r, -r] }
        ]
      }
    }

    if (preset && preset.parametric.x) {
      return {
        type: 'parametric' as const,
        x: preset.parametric.x,
        y: preset.parametric.y,
        t_range: preset.parametric.t_range
      }
    }

    // 默认单位圆
    return {
      type: 'parametric' as const,
      x: 'cos(t)',
      y: 'sin(t)',
      t_range: [0, 2 * Math.PI]
    }
  }

  // 根据模式获取数据
  useEffect(() => {
    switch (state.mode) {
      case 'field':
        fetchVectorField()
        if (state.showStreamlines) {
          fetchStreamlines()
        } else {
          setStreamlines(null)
        }
        break
      case 'line_integral':
        fetchVectorField()
        fetchLineIntegral()
        break
      case 'greens_theorem':
        fetchGreensTheorem()
        // 格林公式也需要向量场数据用于显示
        fetchVectorField()
        break
      case 'flux':
        fetchVectorField()
        fetchLineIntegral()
        break
    }
  }, [state.mode, state.showStreamlines, state.P, state.Q])

  const handleStateChange = <K extends keyof VectorFieldState>(key: K, value: VectorFieldState[K]) => {
    setState(prev => ({ ...prev, [key]: value }))
  }

  const applyPreset = (preset: VectorFieldPreset) => {
    setState(prev => ({ ...prev, P: preset.P, Q: preset.Q }))
  }

  const formatNumber = (n: number): string => {
    if (Math.abs(n) < 0.001 && n !== 0) return n.toExponential(2)
    return n.toFixed(4)
  }

  // ============ 构建 Plotly 数据 ============

  // 构建向量场箭头
  const buildVectorFieldData = (): any[] => {
    if (!vectorFieldData || !vectorFieldData.vector_field) {
      return []
    }

    const plots: any[] = []
    const { x, y, u, v, u_norm, v_norm } = vectorFieldData.vector_field

    // 防御性处理：如果 u_norm/v_norm 无效，使用 u/v
    const uData = Array.isArray(u_norm) ? u_norm : (Array.isArray(u) ? u : [])
    const vData = Array.isArray(v_norm) ? v_norm : (Array.isArray(v) ? v : [])

    // 构建箭头数据
    const lineX: (number | null)[] = []
    const lineY: (number | null)[] = []

    // 防御性检查：确保数组有效
    if (!Array.isArray(x) || !Array.isArray(uData) || !Array.isArray(vData)) {
      return plots
    }

    for (let i = 0; i < x.length; i++) {
      if (!Array.isArray(x[i]) || !Array.isArray(uData[i]) || !Array.isArray(vData[i])) {
        continue
      }
      const rowY = Array.isArray(y) && Array.isArray(y[i]) ? y[i] : null
      for (let j = 0; j < x[i].length; j++) {
        const px = x[i]?.[j]
        const py = rowY?.[j]
        const pu = uData[i]?.[j]
        const pv = vData[i]?.[j]
        if (px === undefined || py === undefined || pu === undefined || pv === undefined) continue
        if (typeof px !== 'number' || typeof py !== 'number' || typeof pu !== 'number' || typeof pv !== 'number') continue

        if (Math.abs(pu) > 0.001 || Math.abs(pv) > 0.001) {
          const scale = 0.5
          const endX = px + pu * scale
          const endY = py + pv * scale

          // 主线段
          lineX.push(px, endX, null)
          lineY.push(py, endY, null)

          // 箭头头部
          const angle = Math.atan2(pv, pu)
          const headSize = 0.03
          const headAngle1 = angle + Math.PI * 0.85
          const headAngle2 = angle - Math.PI * 0.85

          lineX.push(endX, endX + headSize * Math.cos(headAngle1), null)
          lineY.push(endY, endY + headSize * Math.sin(headAngle1), null)
          lineX.push(endX, endX + headSize * Math.cos(headAngle2), null)
          lineY.push(endY, endY + headSize * Math.sin(headAngle2), null)
        }
      }
    }

    plots.push({
      type: 'scatter',
      mode: 'lines',
      x: lineX,
      y: lineY,
      line: { color: '#059669', width: 1.5 },
      name: 'F(x, y)',
      hoverinfo: 'skip'
    })

    return plots
  }

  // 构建流线数据
  const buildStreamlineData = (): any[] => {
    if (!streamlines) return []

    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

    return streamlines.streamlines.map((streamline, idx) => ({
      type: 'scatter',
      mode: 'lines',
      x: streamline.x,
      y: streamline.y,
      line: { color: colors[idx % colors.length], width: 2 },
      name: `流线 ${idx + 1}`,
      hovertemplate: `起点: (${streamline.start_point.x}, ${streamline.start_point.y})<extra></extra>`
    }))
  }

  // 构建路径数据
  const buildPathData = (): any[] => {
    if (!lineIntegralData) return []

    const plots: any[] = []

    // 路径
    plots.push({
      type: 'scatter',
      mode: 'lines',
      x: lineIntegralData.path.x,
      y: lineIntegralData.path.y,
      line: { color: '#ef4444', width: 3 },
      name: '路径 C',
      fill: 'toself'
    })

    // 向量场沿路径的箭头
    if (lineIntegralData.field_data) {
      const { u_field, v_field } = lineIntegralData.field_data
      const pathX = lineIntegralData.path.x
      const pathY = lineIntegralData.path.y

      const arrowSkip = Math.max(1, Math.floor(pathX.length / 20))
      const arrowX: (number | null)[] = []
      const arrowY: (number | null)[] = []

      for (let i = 0; i < pathX.length; i += arrowSkip) {
        const px = pathX[i]
        const py = pathY[i]
        const pu = u_field[i]
        const pv = v_field[i]

        const mag = Math.sqrt(pu * pu + pv * pv)
        if (mag > 0.001) {
          const scale = 0.3
          const endX = px + (pu / mag) * scale
          const endY = py + (pv / mag) * scale

          arrowX.push(px, endX, null)
          arrowY.push(py, endY, null)
        }
      }

      plots.push({
        type: 'scatter',
        mode: 'lines',
        x: arrowX,
        y: arrowY,
        line: { color: '#f59e0b', width: 2 },
        name: 'F 沿路径',
        hoverinfo: 'skip'
      })
    }

    return plots
  }

  // 构建格林公式验证数据
  const buildGreensTheoremData = (): any[] => {
    const plots: any[] = []

    // 向量场
    if (vectorFieldData) {
      plots.push(...buildVectorFieldData())
    }

    // 区域边界
    if (greensData) {
      plots.push({
        type: 'scatter',
        mode: 'lines',
        x: greensData.boundary.x,
        y: greensData.boundary.y,
        line: { color: '#ef4444', width: 3 },
        name: '边界 C',
        fill: 'toself',
        fillcolor: 'rgba(239, 68, 68, 0.1)'
      })
    }

    return plots
  }

  // 构建图表数据
  const buildPlotData = (): any[] => {
    switch (state.mode) {
      case 'field':
        const fieldPlots = buildVectorFieldData()
        if (state.showStreamlines) {
          fieldPlots.push(...buildStreamlineData())
        }
        return fieldPlots
      case 'line_integral':
        return [...buildVectorFieldData(), ...buildPathData()]
      case 'greens_theorem':
        return buildGreensTheoremData()
      case 'flux':
        return [...buildVectorFieldData(), ...buildPathData()]
      default:
        return buildVectorFieldData()
    }
  }

  // 图表布局
  const layout = {
    title: {
      text: `F(x,y) = (${state.P}, ${state.Q})`,
      font: { size: 14 }
    },
    xaxis: {
      title: 'x',
      range: state.xRange,
      scaleanchor: 'y',
      scaleratio: 1
    },
    yaxis: {
      title: 'y',
      range: state.yRange
    },
    hovermode: 'closest',
    margin: { t: 50, r: 50, b: 50, l: 50 },
    showlegend: true,
    legend: { x: 1.02, y: 1 }
  }

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
          <span>向量场与线积分</span>
        </div>
        <h1 className="detail-title">向量场与线积分/面积分</h1>
      </header>

      <div className="content-card" style={{ margin: '2rem', maxWidth: '1600px' }}>
        <div className="card-header">
          <h2>向量场与线积分可视化</h2>
          <p>探索向量场、流线、线积分、格林公式等概念</p>
        </div>

        {/* 模式选择标签 */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            className={`btn ${state.mode === 'field' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleStateChange('mode', 'field')}
          >
            向量场
          </button>
          <button
            className={`btn ${state.mode === 'line_integral' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleStateChange('mode', 'line_integral')}
          >
            线积分
          </button>
          <button
            className={`btn ${state.mode === 'greens_theorem' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleStateChange('mode', 'greens_theorem')}
          >
            格林公式
          </button>
          <button
            className={`btn ${state.mode === 'flux' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleStateChange('mode', 'flux')}
          >
            通量
          </button>
        </div>

        {/* 控制面板 */}
        <div style={{
          background: 'var(--background)',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* 向量场输入 */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>P(x, y) =</label>
              <input
                type="text"
                value={state.P}
                onChange={(e) => handleStateChange('P', e.target.value)}
                placeholder="例如: -y"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Q(x, y) =</label>
              <input
                type="text"
                value={state.Q}
                onChange={(e) => handleStateChange('Q', e.target.value)}
                placeholder="例如: x"
              />
            </div>

            {/* 范围 */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>x 范围</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  step="0.5"
                  value={state.xRange[0]}
                  onChange={(e) => handleStateChange('xRange', [parseFloat(e.target.value) || -3, state.xRange[1]])}
                />
                <span style={{ alignSelf: 'center' }}>~</span>
                <input
                  type="number"
                  step="0.5"
                  value={state.xRange[1]}
                  onChange={(e) => handleStateChange('xRange', [state.xRange[0], parseFloat(e.target.value) || 3])}
                />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>y 范围</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  step="0.5"
                  value={state.yRange[0]}
                  onChange={(e) => handleStateChange('yRange', [parseFloat(e.target.value) || -3, state.yRange[1]])}
                />
                <span style={{ alignSelf: 'center' }}>~</span>
                <input
                  type="number"
                  step="0.5"
                  value={state.yRange[1]}
                  onChange={(e) => handleStateChange('yRange', [state.yRange[0], parseFloat(e.target.value) || 3])}
                />
              </div>
            </div>
          </div>

          {/* 预设向量场 */}
          <div style={{ marginTop: '1rem' }}>
            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
              预设向量场
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {VECTOR_FIELD_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className="btn btn-secondary"
                  onClick={() => applyPreset(preset)}
                  style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                  title={preset.description}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* 根据模式显示额外控制 */}
          {(state.mode === 'line_integral' || state.mode === 'flux') && (
            <div style={{ marginTop: '1rem' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                积分路径
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {PATH_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    className={`btn ${state.pathType === preset.id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleStateChange('pathType', preset.id as PathType)}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {state.mode === 'greens_theorem' && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>区域类型</label>
                <select
                  value={state.regionType}
                  onChange={(e) => handleStateChange('regionType', e.target.value as RegionType)}
                >
                  <option value="circle">圆形</option>
                  <option value="rectangle">矩形</option>
                </select>
              </div>
              {state.regionType === 'circle' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>半径</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={state.regionRadius}
                    onChange={(e) => handleStateChange('regionRadius', parseFloat(e.target.value) || 1)}
                  />
                </div>
              )}
            </div>
          )}

          {/* 流线选项 */}
          {state.mode === 'field' && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={state.showStreamlines}
                  onChange={(e) => handleStateChange('showStreamlines', e.target.checked)}
                />
                显示流线
              </label>
            </div>
          )}
        </div>

        {/* 错误信息 */}
        {error && (
          <div className="error-message" style={{ marginBottom: '1rem' }}>
            <span style={{ marginRight: '8px' }}>⚠️</span>
            {error}
          </div>
        )}

        {/* 可视化区域 */}
        {loading && !vectorFieldData && !greensData && (
          <div className="loading">加载中...</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
          {/* Plotly 图表 */}
          <div style={{ background: '#fff', borderRadius: '8px', padding: '0.5rem' }}>
            <Plot
              data={buildPlotData()}
              layout={layout as any}
              config={{ responsive: true, scrollZoom: true, displayModeBar: true }}
              style={{ width: '100%', height: '600px' }}
            />
          </div>

          {/* 信息面板 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* 旋度和散度信息 */}
            {vectorFieldData && (
              <div className="info-panel">
                <h4>向量场性质</h4>
                <div className="info-item">
                  <span>旋度 curl(F)</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{vectorFieldData.curl.expression}</span>
                </div>
                <div className="info-item">
                  <span>散度 div(F)</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{vectorFieldData.divergence.expression}</span>
                </div>
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                  curl(F) = ∂Q/∂x - ∂P/∂y<br />
                  div(F) = ∂P/∂x + ∂Q/∂y
                </p>
              </div>
            )}

            {/* 线积分结果 */}
            {lineIntegralData && (state.mode === 'line_integral' || state.mode === 'flux') && (
              <>
                <div className="info-panel" style={{ background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                  <h4>线积分结果</h4>
                  <div className="info-item">
                    <span>∫_C F·dr</span>
                    <span>{formatNumber(lineIntegralData.integral_value)}</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                    ∫_C P dx + Q dy = {formatNumber(lineIntegralData.integral_value)}
                  </p>
                </div>

                <div className="info-panel" style={{ background: 'rgba(139, 92, 246, 0.05)', borderColor: 'rgba(139, 92, 246, 0.2)' }}>
                  <h4>通量计算结果</h4>
                  <div className="info-item">
                    <span>∫_C F·n ds</span>
                    <span>{formatNumber(lineIntegralData.flux_value)}</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                    穿过曲线的通量 = {formatNumber(lineIntegralData.flux_value)}
                  </p>
                </div>
              </>
            )}

            {/* 格林公式验证结果 */}
            {greensData && state.mode === 'greens_theorem' && (
              <div className="info-panel" style={{ background: greensData.greens_theorem.is_verified ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)', borderColor: greensData.greens_theorem.is_verified ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' }}>
                <h4>格林公式验证</h4>
                <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  ∮_C P dx + Q dy = ∬_D (∂Q/∂x - ∂P/∂y) dA
                </div>
                <div className="info-item">
                  <span>左边（线积分）</span>
                  <span>{formatNumber(greensData.greens_theorem.left_side.value)}</span>
                </div>
                <div className="info-item">
                  <span>右边（面积分）</span>
                  <span>{formatNumber(greensData.greens_theorem.right_side.value)}</span>
                </div>
                <div className="info-item">
                  <span>差异</span>
                  <span>{formatNumber(greensData.greens_theorem.difference)}</span>
                </div>
                <div className="info-item">
                  <span>相对误差</span>
                  <span>{(greensData.greens_theorem.relative_error * 100).toFixed(2)}%</span>
                </div>
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', fontWeight: 'bold', color: greensData.greens_theorem.is_verified ? '#10b981' : '#ef4444' }}>
                  {greensData.greens_theorem.is_verified ? '✓ 格林公式验证通过' : '✗ 验证失败（可能由于数值误差）'}
                </p>
              </div>
            )}

            {/* 图例说明 */}
            <div className="info-panel">
              <h4>图例说明</h4>
              <div style={{ fontSize: '0.875rem' }}>
                <p>
                  <span style={{ color: '#059669' }}>—</span> 向量场 F(x, y)<br />
                  <span style={{ color: '#ef4444' }}>—</span> 积分路径 C<br />
                  <span style={{ color: '#f59e0b' }}>—</span> F 沿路径的向量
                </p>
              </div>
            </div>

            {/* 数学公式说明 */}
            <div className="info-panel">
              <h4>数学公式</h4>
              <div style={{ fontSize: '0.875rem', fontFamily: 'monospace' }}>
                <p><strong>线积分：</strong> ∫_C F·dr</p>
                <p><strong>通量：</strong> ∫_C F·n ds</p>
                <p><strong>格林公式：</strong><br />
                ∮_C P dx + Q dy = ∬_D (∂Q/∂x - ∂P/∂y) dA</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
