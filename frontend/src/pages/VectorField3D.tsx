import { useState, useEffect, useCallback, useMemo } from 'react'
import Plot from 'react-plotly.js'
import { vectorFieldApi, VectorField3DData, Streamline3DData, CurlDivergence3DData, VectorField3DPreset } from '../services/api'
import { Link } from 'react-router-dom'

// ============ 常量定义 ============

const DEFAULT_3D_PRESETS: VectorField3DPreset[] = [
  { id: 'zero_3d', name: '零场', description: 'F = (0, 0, 0)', P: '0', Q: '0', R: '0' },
  { id: 'rotation_z', name: '绕z轴旋转', description: 'F = (-y, x, 0)', P: '-y', Q: 'x', R: '0' },
  { id: 'radial', name: '径向场', description: 'F = (x, y, z)', P: 'x', Q: 'y', R: 'z' },
  { id: 'helix', name: '螺旋场', description: 'F = (-y, x, 1)', P: '-y', Q: 'x', R: '1' },
  { id: 'shear_3d', name: '剪切流', description: 'F = (y, 0, 0)', P: 'y', Q: '0', R: '0' },
  { id: 'saddle_3d', name: '3D鞍点', description: 'F = (x, -y, z)', P: 'x', Q: '-y', R: 'z' },
  { id: 'vortex_3d', name: '涡旋场', description: 'F = (-z, 0, x)', P: '-z', Q: '0', R: 'x' },
  { id: 'constant_3d', name: '恒定场', description: 'F = (1, 1, 1)', P: '1', Q: '1', R: '1' }
]

// ============ 类型定义 ============

interface VectorField3DState {
  P: string
  Q: string
  R: string
  xRange: [number, number]
  yRange: [number, number]
  zRange: [number, number]
  resolution: number

  // 可视化选项
  showField: boolean
  showStreamlines: boolean
  streamlineStartPoints: string
  streamlineTimeSpan: number
  streamlineDirection: 'forward' | 'backward' | 'both'

  // 旋度散度计算点
  curlPointX: number
  curlPointY: number
  curlPointZ: number
  showCurlDivergence: boolean
}

// ============ 默认状态 ============

const DEFAULT_STATE: VectorField3DState = {
  P: '-y',
  Q: 'x',
  R: '1',
  xRange: [-3, 3],
  yRange: [-3, 3],
  zRange: [-3, 3],
  resolution: 8,
  showField: true,
  showStreamlines: false,
  streamlineStartPoints: '[[1,0,0],[0,1,0],[0,0,1]]',
  streamlineTimeSpan: 5,
  streamlineDirection: 'both',
  curlPointX: 0,
  curlPointY: 0,
  curlPointZ: 0,
  showCurlDivergence: true
}

// ============ 主组件 ============

export default function VectorField3D() {
  const [state, setState] = useState<VectorField3DState>(DEFAULT_STATE)
  const [vectorFieldData, setVectorFieldData] = useState<VectorField3DData | null>(null)
  const [streamlineData, setStreamlineData] = useState<Streamline3DData | null>(null)
  const [curlDivergenceData, setCurlDivergenceData] = useState<CurlDivergence3DData | null>(null)
  const [presets, setPresets] = useState<VectorField3DPreset[]>(DEFAULT_3D_PRESETS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 获取预设
  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const response = await vectorFieldApi.getPresets3d()
        if (response.success && response.vector_fields) {
          setPresets(response.vector_fields)
        }
      } catch {
        // 使用默认预设
      }
    }
    fetchPresets()
  }, [])

  // 解析起始点
  const parseStartPoints = useCallback((str: string): number[][] => {
    try {
      const parsed = JSON.parse(str)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(p => {
          if (Array.isArray(p) && p.length === 3) {
            return [Number(p[0]), Number(p[1]), Number(p[2])]
          }
          return [0, 0, 0]
        })
      }
    } catch {
      // 解析失败
    }
    return [[1, 0, 0]]
  }, [])

  // 获取向量场数据
  const fetchVectorField = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await vectorFieldApi.vectorField3d({
        P: state.P,
        Q: state.Q,
        R: state.R,
        x_range: state.xRange,
        y_range: state.yRange,
        z_range: state.zRange,
        resolution: state.resolution
      })

      if (response.success) {
        setVectorFieldData(response)
      } else {
        setVectorFieldData(null)
        setError(response.error || '计算失败')
      }
    } catch {
      setError('无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }, [state.P, state.Q, state.R, state.xRange, state.yRange, state.zRange, state.resolution])

  // 获取流线数据
  const fetchStreamlines = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const startPoints = parseStartPoints(state.streamlineStartPoints)
      const response = await vectorFieldApi.streamline3d({
        P: state.P,
        Q: state.Q,
        R: state.R,
        start_points: startPoints,
        t_span: [0, state.streamlineTimeSpan],
        direction: state.streamlineDirection
      })

      if (response.success) {
        setStreamlineData(response)
      } else {
        setStreamlineData(null)
        setError(response.error || '流线计算失败')
      }
    } catch {
      setError('无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }, [state.P, state.Q, state.R, state.streamlineStartPoints, state.streamlineTimeSpan, state.streamlineDirection, parseStartPoints])

  // 获取旋度散度数据
  const fetchCurlDivergence = useCallback(async () => {
    try {
      const response = await vectorFieldApi.curlDivergence3d({
        P: state.P,
        Q: state.Q,
        R: state.R,
        x: state.curlPointX,
        y: state.curlPointY,
        z: state.curlPointZ
      })

      if (response.success) {
        setCurlDivergenceData(response)
      } else {
        setCurlDivergenceData(null)
      }
    } catch {
      setCurlDivergenceData(null)
    }
  }, [state.P, state.Q, state.R, state.curlPointX, state.curlPointY, state.curlPointZ])

  // 加载预设
  const loadPreset = useCallback((preset: VectorField3DPreset) => {
    setState(prev => ({
      ...prev,
      P: preset.P,
      Q: preset.Q,
      R: preset.R
    }))
  }, [])

  // 初始化加载数据
  useEffect(() => {
    fetchVectorField()
    fetchCurlDivergence()
  }, [fetchVectorField, fetchCurlDivergence])

  // 构建Plotly数据
  const plotData = useMemo((): any[] => {
    const plots: any[] = []

    // 3D向量场 - 使用 scatter3d 线条表示向量（因为 cone 需要完整版 plotly）
    if (state.showField && vectorFieldData?.vector_field) {
      const vf = vectorFieldData.vector_field

      // 采样以避免过多线条
      const sampleRate = Math.max(1, Math.floor(vf.x.length / 100))

      // 收集所有线条数据
      const lineX: number[] = []
      const lineY: number[] = []
      const lineZ: number[] = []
      const colors: number[] = []
      const lineText: string[] = []

      // 归一化向量用于颜色映射
      const maxMag = Math.max(...vf.magnitude.filter(m => !isNaN(m) && isFinite(m)), 0.001)

      for (let i = 0; i < vf.x.length; i += sampleRate) {
        // 安全获取数据，处理 undefined 和 NaN
        const rawX = vf.x[i]
        const rawY = vf.y[i]
        const rawZ = vf.z[i]
        const rawU = vf.u[i]
        const rawV = vf.v[i]
        const rawW = vf.w[i]
        const rawMag = vf.magnitude[i]

        // 转换为数字，无效值默认为0
        const x = Number(rawX) || 0
        const y = Number(rawY) || 0
        const z = Number(rawZ) || 0
        const u = Number(rawU) || 0
        const v = Number(rawV) || 0
        const w = Number(rawW) || 0
        const mag = Number(rawMag) || 0

        // 跳过无效数据点
        if (!isFinite(x) || !isFinite(y) || !isFinite(z) ||
            !isFinite(u) || !isFinite(v) || !isFinite(w)) {
          continue
        }

        // 线条从 (x,y,z) 到 (x+u*scale, y+v*scale, z+w*scale)
        const scale = 0.3 // 向量长度缩放因子
        lineX.push(x, x + u * scale, null as any)
        lineY.push(y, y + v * scale, null as any)
        lineZ.push(z, z + w * scale, null as any)
        colors.push(mag / maxMag)
        lineText.push(`${u.toFixed(2)}, ${v.toFixed(2)}, ${w.toFixed(2)}`)
      }

      // 添加向量线条
      plots.push({
        type: 'scatter3d',
        mode: 'lines',
        name: '向量',
        x: lineX,
        y: lineY,
        z: lineZ,
        line: {
          color: colors,
          colorscale: 'Viridis',
          width: 3,
          cmin: 0,
          cmax: 1
        },
        hovertemplate: '位置: (%{x:.2f}, %{y:.2f}, %{z:.2f})<br>向量: (%{text})<extra></extra>',
        text: lineText
      } as any)

      // 添加向量起点（用于指示位置）
      const markerX: number[] = []
      const markerY: number[] = []
      const markerZ: number[] = []
      const markerColors: number[] = []

      for (let i = 0; i < vf.x.length; i += sampleRate) {
        const x = Number(vf.x[i]) || 0
        const y = Number(vf.y[i]) || 0
        const z = Number(vf.z[i]) || 0
        const mag = Number(vf.magnitude[i]) || 0

        if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
          continue
        }

        markerX.push(x)
        markerY.push(y)
        markerZ.push(z)
        markerColors.push(mag / maxMag)
      }

      plots.push({
        type: 'scatter3d',
        mode: 'markers',
        name: '位置点',
        x: markerX,
        y: markerY,
        z: markerZ,
        marker: {
          size: 3,
          color: markerColors,
          colorscale: 'Viridis',
          cmin: 0,
          cmax: 1
        },
        hovertemplate: 'x: %{x:.2f}<br>y: %{y:.2f}<br>z: %{z:.2f}<extra></extra>'
      } as any)
    }

    // 3D流线
    if (state.showStreamlines && streamlineData?.streamlines) {
      streamlineData.streamlines.forEach((streamline, index) => {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9']
        plots.push({
          type: 'scatter3d',
          mode: 'lines',
          name: `流线 ${index + 1}`,
          x: streamline.x,
          y: streamline.y,
          z: streamline.z,
          line: {
            color: colors[index % colors.length],
            width: 4
          },
          hovertemplate: `流线 ${index + 1}<br>t: %{text:.2f}<extra></extra>`,
          text: streamline.x.map((_, i) => i)
        })

        // 起点标记
        plots.push({
          type: 'scatter3d',
          mode: 'markers',
          name: `起点 ${index + 1}`,
          x: [streamline.start_point.x],
          y: [streamline.start_point.y],
          z: [streamline.start_point.z],
          marker: {
            size: 8,
            color: colors[index % colors.length],
            symbol: 'circle'
          },
          hovertemplate: `起点 ${index + 1}<br>x: %{x:.2f}<br>y: %{y:.2f}<br>z: %{z:.2f}<extra></extra>`
        })
      })
    }

    return plots
  }, [state.showField, state.showStreamlines, vectorFieldData, streamlineData])

  // 布局配置
  const layout = useMemo((): any => {
    return {
      title: {
        text: `3D向量场: F(x,y,z) = (${state.P}, ${state.Q}, ${state.R})`,
        font: { size: 16 }
      },
      scene: {
        xaxis: {
          title: 'x',
          range: state.xRange,
          gridcolor: '#ddd'
        },
        yaxis: {
          title: 'y',
          range: state.yRange,
          gridcolor: '#ddd'
        },
        zaxis: {
          title: 'z',
          range: state.zRange,
          gridcolor: '#ddd'
        },
        aspectmode: 'cube',
        camera: {
          eye: { x: 1.5, y: 1.5, z: 1.2 }
        }
      },
      margin: { t: 60, r: 20, b: 60, l: 60 },
      showlegend: true,
      legend: {
        x: 0.02,
        y: 0.98,
        bgcolor: 'rgba(255,255,255,0.8)'
      }
    }
  }, [state.P, state.Q, state.R, state.xRange, state.yRange, state.zRange])

  const formatNumber = (n: number): string => {
    if (Math.abs(n) < 0.001 && n !== 0) return n.toExponential(2)
    return n.toFixed(4)
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
          <span>3D向量场</span>
        </div>
        <h1 className="detail-title">3D向量场可视化</h1>
      </header>

      <div className="content-card" style={{ margin: '2rem', maxWidth: '1600px' }}>
        <div className="card-header">
          <h2>3D向量场可视化</h2>
          <p>探索三维空间中的向量场分布，计算旋度和散度</p>
        </div>

        {/* 控制面板 */}
        <div style={{
          background: 'var(--background)',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* 向量场表达式 P */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>P(x,y,z) =</label>
              <input
                type="text"
                value={state.P}
                onChange={(e) => setState(s => ({ ...s, P: e.target.value }))}
                placeholder="-y"
              />
            </div>

            {/* 向量场表达式 Q */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Q(x,y,z) =</label>
              <input
                type="text"
                value={state.Q}
                onChange={(e) => setState(s => ({ ...s, Q: e.target.value }))}
                placeholder="x"
              />
            </div>

            {/* 向量场表达式 R */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>R(x,y,z) =</label>
              <input
                type="text"
                value={state.R}
                onChange={(e) => setState(s => ({ ...s, R: e.target.value }))}
                placeholder="1"
              />
            </div>

            {/* x 范围 */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>x 范围</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  step="0.5"
                  value={state.xRange[0]}
                  onChange={(e) => setState(s => ({ ...s, xRange: [parseFloat(e.target.value) || -3, s.xRange[1]] }))}
                />
                <span style={{ alignSelf: 'center' }}>~</span>
                <input
                  type="number"
                  step="0.5"
                  value={state.xRange[1]}
                  onChange={(e) => setState(s => ({ ...s, xRange: [s.xRange[0], parseFloat(e.target.value) || 3] }))}
                />
              </div>
            </div>

            {/* y 范围 */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>y 范围</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  step="0.5"
                  value={state.yRange[0]}
                  onChange={(e) => setState(s => ({ ...s, yRange: [parseFloat(e.target.value) || -3, s.yRange[1]] }))}
                />
                <span style={{ alignSelf: 'center' }}>~</span>
                <input
                  type="number"
                  step="0.5"
                  value={state.yRange[1]}
                  onChange={(e) => setState(s => ({ ...s, yRange: [s.yRange[0], parseFloat(e.target.value) || 3] }))}
                />
              </div>
            </div>

            {/* z 范围 */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>z 范围</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  step="0.5"
                  value={state.zRange[0]}
                  onChange={(e) => setState(s => ({ ...s, zRange: [parseFloat(e.target.value) || -3, s.zRange[1]] }))}
                />
                <span style={{ alignSelf: 'center' }}>~</span>
                <input
                  type="number"
                  step="0.5"
                  value={state.zRange[1]}
                  onChange={(e) => setState(s => ({ ...s, zRange: [s.zRange[0], parseFloat(e.target.value) || 3] }))}
                />
              </div>
            </div>

            {/* 分辨率 */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>分辨率 ({state.resolution})</label>
              <input
                type="range"
                min="3"
                max="12"
                value={state.resolution}
                onChange={(e) => setState(s => ({ ...s, resolution: parseInt(e.target.value) }))}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>3</span>
                <span>12</span>
              </div>
            </div>
          </div>

          {/* 预设函数 */}
          <div style={{ marginTop: '1rem' }}>
            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
              预设向量场
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  className="btn btn-secondary"
                  onClick={() => loadPreset(preset)}
                  style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                  title={preset.description}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* 显示选项 */}
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={state.showField}
                onChange={(e) => setState(s => ({ ...s, showField: e.target.checked }))}
              />
              显示向量场
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={state.showStreamlines}
                onChange={(e) => setState(s => ({ ...s, showStreamlines: e.target.checked }))}
              />
              显示流线
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={state.showCurlDivergence}
                onChange={(e) => setState(s => ({ ...s, showCurlDivergence: e.target.checked }))}
              />
              显示旋度/散度
            </label>
          </div>

          {/* 流线设置 */}
          {state.showStreamlines && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>起始点 [[x,y,z], ...]</label>
                  <textarea
                    value={state.streamlineStartPoints}
                    onChange={(e) => setState(s => ({ ...s, streamlineStartPoints: e.target.value }))}
                    rows={3}
                    style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>时间范围 ({state.streamlineTimeSpan})</label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.5"
                    value={state.streamlineTimeSpan}
                    onChange={(e) => setState(s => ({ ...s, streamlineTimeSpan: parseFloat(e.target.value) }))}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>1</span>
                    <span>20</span>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>方向</label>
                  <select
                    value={state.streamlineDirection}
                    onChange={(e) => setState(s => ({ ...s, streamlineDirection: e.target.value as any }))}
                  >
                    <option value="forward">前向</option>
                    <option value="backward">后向</option>
                    <option value="both">双向</option>
                  </select>
                </div>
              </div>

              <button
                className="btn btn-secondary"
                onClick={fetchStreamlines}
                disabled={loading}
                style={{ marginTop: '1rem' }}
              >
                {loading ? '计算中...' : '计算流线'}
              </button>
            </div>
          )}

          {/* 旋度散度计算点 */}
          {state.showCurlDivergence && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                旋度/散度计算点
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.5rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>x</label>
                  <input
                    type="number"
                    step="0.1"
                    value={state.curlPointX}
                    onChange={(e) => setState(s => ({ ...s, curlPointX: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>y</label>
                  <input
                    type="number"
                    step="0.1"
                    value={state.curlPointY}
                    onChange={(e) => setState(s => ({ ...s, curlPointY: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>z</label>
                  <input
                    type="number"
                    step="0.1"
                    value={state.curlPointZ}
                    onChange={(e) => setState(s => ({ ...s, curlPointZ: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
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

        {/* 加载状态 */}
        {loading && !vectorFieldData && (
          <div className="loading">加载中...</div>
        )}

        {/* 3D图表 */}
        {vectorFieldData && vectorFieldData.success && (
          <div style={{ background: '#fff', borderRadius: '8px', padding: '0.5rem' }}>
            <Plot
              data={plotData}
              layout={layout}
              config={{ responsive: true, scrollZoom: true, displayModeBar: true }}
              style={{ width: '100%', height: '600px' }}
            />
          </div>
        )}

        {/* 旋度散度信息 */}
        {state.showCurlDivergence && curlDivergenceData && curlDivergenceData.success && (
          <div className="info-panel" style={{
            marginTop: '1rem',
            background: 'rgba(59, 130, 246, 0.05)',
            borderColor: 'rgba(59, 130, 246, 0.2)'
          }}>
            <h4>旋度 curl(F) 和散度 div(F)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              {/* 旋度信息 */}
              <div className="info-item">
                <span>curl(F) =</span>
                <span style={{ fontFamily: 'monospace' }}>
                  ({formatNumber(curlDivergenceData.curl.value.x)}, {formatNumber(curlDivergenceData.curl.value.y)}, {formatNumber(curlDivergenceData.curl.value.z)})
                </span>
              </div>
              {/* 散度信息 */}
              <div className="info-item">
                <span>div(F) =</span>
                <span style={{ fontFamily: 'monospace', color: curlDivergenceData.divergence.value > 0 ? '#10b981' : curlDivergenceData.divergence.value < 0 ? '#ef4444' : 'inherit' }}>
                  {formatNumber(curlDivergenceData.divergence.value)}
                </span>
              </div>
              {/* 计算点 */}
              <div className="info-item">
                <span>计算点</span>
                <span style={{ fontFamily: 'monospace' }}>
                  ({formatNumber(curlDivergenceData.point.x)}, {formatNumber(curlDivergenceData.point.y)}, {formatNumber(curlDivergenceData.point.z)})
                </span>
              </div>
            </div>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
              旋度表达式: curl(F) = ({curlDivergenceData.curl.expression.x}, {curlDivergenceData.curl.expression.y}, {curlDivergenceData.curl.expression.z})
            </p>
          </div>
        )}

        {/* 数学概念说明 */}
        <div className="info-panel" style={{ marginTop: '1rem' }}>
          <h4>数学概念</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', fontSize: '0.875rem' }}>
            <div>
              <p style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>旋度 curl(F)</p>
              <p style={{ color: 'var(--text-secondary)' }}>
                衡量向量场绕某点的"旋转程度"。旋度为零 = 无旋场；旋度不为零 = 有旋场（如流体涡旋）。
              </p>
            </div>
            <div>
              <p style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>散度 div(F)</p>
              <p style={{ color: 'var(--text-secondary)' }}>
                衡量向量场从某点的"发散程度"。散度为零 = 无源场；散度为正 = 源（向外发散）；散度为负 = 汇（向内汇聚）。
              </p>
            </div>
            <div>
              <p style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>流线 Streamline</p>
              <p style={{ color: 'var(--text-secondary)' }}>
                向量场的积分曲线，曲线每一点的切线方向与向量场方向一致。
              </p>
            </div>
          </div>
        </div>

        {/* 图例说明 */}
        <div className="info-panel" style={{ marginTop: '1rem' }}>
          <h4>图例说明</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.875rem' }}>
            <p>
              <span style={{ color: '#3b82f6' }}>●</span> 向量：从点 (x,y,z) 指向 (x+u,y+v,z+w)<br/>
              <span style={{ color: '#10b981' }}>●</span> 颜色深浅表示向量模长大小<br/>
              <span style={{ color: '#ef4444' }}>●</span> 流线：沿向量场方向的积分曲线
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
