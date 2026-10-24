import { useState, useEffect, useCallback, useMemo } from 'react'
import Plot from 'react-plotly.js'
import { vectorFieldApi, SurfaceType, SurfacePreset, SurfaceIntegralData } from '../services/api'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'

// ============ 默认预设 ============

const DEFAULT_SURFACE_PRESETS: SurfacePreset[] = [
  {
    id: 'sphere',
    name: '球面',
    description: 'x² + y² + z² = r²',
    parametric: {
      x: 'r*sin(u)*cos(v)',
      y: 'r*sin(u)*sin(v)',
      z: 'r*cos(u)',
      u_range: [0, Math.PI],
      v_range: [0, 2 * Math.PI],
      params: { r: 1 },
    },
  },
  {
    id: 'cylinder',
    name: '圆柱面',
    description: 'x² + y² = r²',
    parametric: {
      x: 'r*cos(u)',
      y: 'r*sin(u)',
      z: 'v',
      u_range: [0, 2 * Math.PI],
      v_range: [-1, 1],
      params: { r: 1 },
    },
  },
  {
    id: 'paraboloid',
    name: '抛物面',
    description: 'z = x² + y²',
    parametric: {
      x: 'r*cos(u)',
      y: 'r*sin(u)',
      z: 'r**2',
      u_range: [0, 2 * Math.PI],
      v_range: [0, 1],
      params: { r: 1 },
    },
  },
  {
    id: 'cone',
    name: '圆锥面',
    description: 'z = √(x² + y²)',
    parametric: {
      x: 'r*cos(u)',
      y: 'r*sin(u)',
      z: 'r',
      u_range: [0, 2 * Math.PI],
      v_range: [0, 1],
      params: { r: 1 },
    },
  },
  {
    id: 'plane',
    name: '平面',
    description: 'z = ax + by',
    parametric: {
      x: 'u',
      y: 'v',
      z: '0.5*u + 0.5*v',
      u_range: [-1, 1],
      v_range: [-1, 1],
      params: { a: 0.5, b: 0.5 },
    },
  },
]

const DEFAULT_VECTOR_FIELD_PRESETS = [
  { id: 'radial_3d', name: '径向场', P: 'x', Q: 'y', R: 'z' },
  { id: 'rotation_z', name: '绕z轴旋转', P: '-y', Q: 'x', R: '0' },
  { id: 'helix', name: '螺旋场', P: '-y', Q: 'x', R: '1' },
  { id: 'constant', name: '恒定场', P: '1', Q: '1', R: '1' },
  { id: 'vortex', name: '涡旋场', P: '-z', Q: '0', R: 'x' },
]

// ============ 类型定义 ============

interface SurfaceIntegralState {
  P: string
  Q: string
  R: string
  surfaceType: SurfaceType
  orientation: 'outward' | 'inward'
  resolution: number
  surfaceRadius: number
  surfaceA: number
  surfaceB: number
  showNormal: boolean
  showField: boolean
}

const DEFAULT_STATE: SurfaceIntegralState = {
  P: 'x',
  Q: 'y',
  R: 'z',
  surfaceType: 'sphere',
  orientation: 'outward',
  resolution: 30,
  surfaceRadius: 1,
  surfaceA: 0.5,
  surfaceB: 0.5,
  showNormal: true,
  showField: true,
}

// ============ 主组件 ============

export default function SurfaceIntegrals() {
  const [state, setState] = useState<SurfaceIntegralState>(DEFAULT_STATE)
  const [surfaceData, setSurfaceData] = useState<SurfaceIntegralData | null>(null)
  const [presets, setPresets] = useState<{ surfaces: SurfacePreset[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 获取预设
  useEffect(() => {
    const fetchPresets = async () => {
      const response = await vectorFieldApi.getSurfacePresets()
      if (response.success && response.surfaces) {
        setPresets({ surfaces: response.surfaces })
      }
    }
    fetchPresets()
  }, [])

  // 预设数据
  const surfacePresets = useMemo((): SurfacePreset[] => {
    return presets?.surfaces || DEFAULT_SURFACE_PRESETS
  }, [presets])

  // 获取曲面积分数据
  const fetchSurfaceIntegral = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const surfaceParams: Record<string, number> = {}
      if (state.surfaceType === 'sphere' || state.surfaceType === 'cylinder') {
        surfaceParams.r = state.surfaceRadius
      } else if (state.surfaceType === 'plane') {
        surfaceParams.a = state.surfaceA
        surfaceParams.b = state.surfaceB
      }

      const response = await vectorFieldApi.surfaceIntegral({
        P: state.P,
        Q: state.Q,
        R: state.R,
        surface_type: state.surfaceType,
        surface_params: surfaceParams,
        orientation: state.orientation,
        resolution: state.resolution,
      })

      if (response.success) {
        setSurfaceData(response)
      } else {
        setSurfaceData(null)
        setError(response.error || '计算失败')
      }
    } catch (err) {
      setError('无法连接到服务器')
      setSurfaceData(null)
    } finally {
      setLoading(false)
    }
  }, [
    state.P,
    state.Q,
    state.R,
    state.surfaceType,
    state.surfaceRadius,
    state.surfaceA,
    state.surfaceB,
    state.orientation,
    state.resolution,
  ])

  // 当参数变化时重新计算
  useEffect(() => {
    fetchSurfaceIntegral()
  }, [fetchSurfaceIntegral])

  const handleStateChange = <K extends keyof SurfaceIntegralState>(
    key: K,
    value: SurfaceIntegralState[K]
  ) => {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  const applyVectorField = (preset: (typeof DEFAULT_VECTOR_FIELD_PRESETS)[0]) => {
    setState((prev) => ({ ...prev, P: preset.P, Q: preset.Q, R: preset.R }))
  }

  const applySurface = (preset: SurfacePreset) => {
    setState((prev) => {
      const newState = { ...prev, surfaceType: preset.id as SurfaceType }
      if (preset.id === 'sphere' || preset.id === 'cylinder') {
        newState.surfaceRadius = preset.parametric.params.r || 1
      } else if (preset.id === 'plane') {
        newState.surfaceA = preset.parametric.params.a || 0.5
        newState.surfaceB = preset.parametric.params.b || 0.5
      }
      return newState
    })
  }

  const formatNumber = (n: number): string => {
    if (Math.abs(n) < 0.001 && n !== 0) return n.toExponential(2)
    return n.toFixed(4)
  }

  // ============ 构建 Plotly 数据 ============

  const buildPlotData = useMemo((): any[] => {
    if (!surfaceData || !surfaceData.success) return []

    const plots: any[] = []
    const { surface, normal, field_on_surface } = surfaceData

    // 曲面数据
    const xData = surface.x
    const yData = surface.y
    const zData = surface.z

    // 防御性处理
    if (!Array.isArray(xData) || !Array.isArray(yData) || !Array.isArray(zData)) {
      return plots
    }

    // 绘制曲面
    plots.push({
      type: 'surface',
      x: xData as number[][],
      y: yData as number[][],
      z: zData as number[][],
      colorscale: 'Viridis',
      showscale: false,
      opacity: 0.7,
      name: '曲面 S',
      hoverongaps: false,
    })

    // 显示法向量
    if (state.showNormal && normal) {
      // 采样法向量箭头
      const skip = Math.max(1, Math.floor(xData.length / 20))
      const arrowX: number[] = []
      const arrowY: number[] = []
      const arrowZ: number[] = []
      const arrowU: number[] = []
      const arrowV: number[] = []
      const arrowW: number[] = []

      for (let i = 0; i < xData.length; i += skip) {
        for (let j = 0; j < xData[i].length; j += skip) {
          const px = xData[i]?.[j]
          const py = yData[i]?.[j]
          const pz = zData[i]?.[j]
          const nx = normal.x?.[i]?.[j]
          const ny = normal.y?.[i]?.[j]
          const nz = normal.z?.[i]?.[j]

          if (
            typeof px === 'number' &&
            typeof py === 'number' &&
            typeof pz === 'number' &&
            typeof nx === 'number' &&
            typeof ny === 'number' &&
            typeof nz === 'number' &&
            !isNaN(px) &&
            !isNaN(py) &&
            !isNaN(pz) &&
            !isNaN(nx) &&
            !isNaN(ny) &&
            !isNaN(nz)
          ) {
            const scale = 0.15
            arrowX.push(px)
            arrowY.push(py)
            arrowZ.push(pz)
            arrowU.push(nx * scale)
            arrowV.push(ny * scale)
            arrowW.push(nz * scale)
          }
        }
      }

      plots.push({
        type: 'cone',
        x: arrowX,
        y: arrowY,
        z: arrowZ,
        u: arrowU,
        v: arrowV,
        w: arrowW,
        sizemode: 'scaled',
        sizeref: 0.5,
        anchor: 'tip',
        colorscale: [
          [0, 'rgb(255,0,0)'],
          [1, 'rgb(255,0,0)'],
        ],
        showscale: false,
        name: '法向量 n',
      })
    }

    // 显示曲面上的向量场
    if (state.showField && field_on_surface) {
      // 减少箭头密度
      const skip = Math.max(1, Math.floor(xData.length / 15))
      const fieldX: number[] = []
      const fieldY: number[] = []
      const fieldZ: number[] = []
      const fieldU: number[] = []
      const fieldV: number[] = []
      const fieldW: number[] = []

      for (let i = 0; i < xData.length; i += skip) {
        for (let j = 0; j < xData[i].length; j += skip) {
          const px = xData[i]?.[j]
          const py = yData[i]?.[j]
          const pz = zData[i]?.[j]
          const pu = field_on_surface.P?.[i]?.[j]
          const pv = field_on_surface.Q?.[i]?.[j]
          const pw = field_on_surface.R?.[i]?.[j]

          if (
            typeof px === 'number' &&
            typeof py === 'number' &&
            typeof pz === 'number' &&
            typeof pu === 'number' &&
            typeof pv === 'number' &&
            typeof pw === 'number' &&
            !isNaN(px) &&
            !isNaN(py) &&
            !isNaN(pz) &&
            !isNaN(pu) &&
            !isNaN(pv) &&
            !isNaN(pw)
          ) {
            // 归一化向量
            const mag = Math.sqrt(pu * pu + pv * pv + pw * pw)
            const scale = 0.1
            if (mag > 0.01) {
              fieldX.push(px)
              fieldY.push(py)
              fieldZ.push(pz)
              fieldU.push((pu / mag) * scale)
              fieldV.push((pv / mag) * scale)
              fieldW.push((pw / mag) * scale)
            }
          }
        }
      }

      plots.push({
        type: 'cone',
        x: fieldX,
        y: fieldY,
        z: fieldZ,
        u: fieldU,
        v: fieldV,
        w: fieldW,
        sizemode: 'scaled',
        sizeref: 0.5,
        anchor: 'tip',
        colorscale: [
          [0, 'rgb(0,100,0)'],
          [1, 'rgb(0,200,0)'],
        ],
        showscale: false,
        name: 'F',
      })
    }

    return plots
  }, [surfaceData, state.showNormal, state.showField])

  // 图表布局
  const layout = useMemo(
    (): any => ({
      title: {
        text: `曲面积分: F·dS, S = ${surfaceData?.surface.name || '曲面'}`,
        font: { size: 14 },
      },
      scene: {
        xaxis: { title: 'x', range: [-2, 2] },
        yaxis: { title: 'y', range: [-2, 2] },
        zaxis: { title: 'z', range: [-2, 2] },
        aspectmode: 'cube',
      },
      margin: { t: 50, r: 50, b: 50, l: 50 },
      showlegend: true,
      legend: { x: 1.02, y: 1 },
    }),
    [surfaceData]
  )

  return (
    <div className="detail-page">
      <PageHeader
        backTo="/subject/calculus"
        backLabel="返回微积分"
        breadcrumbs={[
          { label: '首页', path: '/' },
          { label: '微积分', path: '/subject/calculus' },
          { label: '曲面积分' },
        ]}
        title="曲面积分可视化"
      />

      <div className="content-card" style={{ margin: '2rem auto', maxWidth: '1600px' }}>
        <div className="card-header">
          <h2>曲面积分计算</h2>
          <p>计算向量场穿过曲面的通量 ∬_S F·dS</p>
        </div>

        {/* 控制面板 */}
        <div
          style={{
            background: 'var(--background)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
            }}
          >
            {/* 向量场输入 */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>P(x, y, z) =</label>
              <input
                type="text"
                value={state.P}
                onChange={(e) => handleStateChange('P', e.target.value)}
                placeholder="例如: x"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Q(x, y, z) =</label>
              <input
                type="text"
                value={state.Q}
                onChange={(e) => handleStateChange('Q', e.target.value)}
                placeholder="例如: y"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>R(x, y, z) =</label>
              <input
                type="text"
                value={state.R}
                onChange={(e) => handleStateChange('R', e.target.value)}
                placeholder="例如: z"
              />
            </div>

            {/* 曲面选择 */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>曲面类型</label>
              <select
                value={state.surfaceType}
                onChange={(e) => handleStateChange('surfaceType', e.target.value as SurfaceType)}
              >
                {surfacePresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 法向量方向 */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>法向量方向</label>
              <select
                value={state.orientation}
                onChange={(e) =>
                  handleStateChange('orientation', e.target.value as 'outward' | 'inward')
                }
              >
                <option value="outward">向外</option>
                <option value="inward">向内</option>
              </select>
            </div>
          </div>

          {/* 曲面参数 */}
          {(state.surfaceType === 'sphere' || state.surfaceType === 'cylinder') && (
            <div style={{ marginTop: '1rem' }}>
              <label
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.5rem',
                  display: 'block',
                }}
              >
                曲面参数
              </label>
              <div
                className="form-group"
                style={{ marginBottom: 0, display: 'inline-block', marginRight: '1rem' }}
              >
                <label>半径 r =</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="3"
                  value={state.surfaceRadius}
                  onChange={(e) =>
                    handleStateChange('surfaceRadius', parseFloat(e.target.value) || 1)
                  }
                />
              </div>
            </div>
          )}

          {state.surfaceType === 'plane' && (
            <div style={{ marginTop: '1rem' }}>
              <label
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.5rem',
                  display: 'block',
                }}
              >
                平面参数 z = ax + by
              </label>
              <div
                className="form-group"
                style={{ marginBottom: 0, display: 'inline-block', marginRight: '1rem' }}
              >
                <label>a =</label>
                <input
                  type="number"
                  step="0.1"
                  value={state.surfaceA}
                  onChange={(e) => handleStateChange('surfaceA', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0, display: 'inline-block' }}>
                <label>b =</label>
                <input
                  type="number"
                  step="0.1"
                  value={state.surfaceB}
                  onChange={(e) => handleStateChange('surfaceB', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          )}

          {/* 预设向量场 */}
          <div style={{ marginTop: '1rem' }}>
            <label
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.5rem',
                display: 'block',
              }}
            >
              预设向量场
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {DEFAULT_VECTOR_FIELD_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className="btn btn-secondary"
                  onClick={() => applyVectorField(preset)}
                  style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                  title={`P=${preset.P}, Q=${preset.Q}, R=${preset.R}`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* 预设曲面 */}
          <div style={{ marginTop: '1rem' }}>
            <label
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.5rem',
                display: 'block',
              }}
            >
              预设曲面
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {surfacePresets.map((preset) => (
                <button
                  key={preset.id}
                  className={`btn ${state.surfaceType === preset.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => applySurface(preset)}
                  style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* 显示选项 */}
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <label
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={state.showNormal}
                onChange={(e) => handleStateChange('showNormal', e.target.checked)}
              />
              显示法向量
            </label>
            <label
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={state.showField}
                onChange={(e) => handleStateChange('showField', e.target.checked)}
              />
              显示向量场
            </label>
          </div>
        </div>

        {/* 错误信息 */}
        {error && (
          <div style={{ marginBottom: '1rem' }}>
            <ErrorState message={error} />
          </div>
        )}

        {/* 可视化区域 */}
        {loading && !surfaceData && <LoadingState text="正在计算曲面积分..." />}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
          {/* Plotly 图表 */}
          <div style={{ background: '#fff', borderRadius: '8px', padding: '0.5rem' }}>
            <Plot
              data={buildPlotData as any[]}
              layout={layout}
              config={{ responsive: true, scrollZoom: true, displayModeBar: true }}
              style={{ width: '100%', height: '600px' }}
            />
          </div>

          {/* 信息面板 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* 曲面积分结果 */}
            {surfaceData && surfaceData.success && (
              <div
                className="info-panel"
                style={{
                  background: 'rgba(139, 92, 246, 0.05)',
                  borderColor: 'rgba(139, 92, 246, 0.2)',
                }}
              >
                <h4>曲面积分结果</h4>
                <div className="info-item">
                  <span>∬_S F·dS</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                    {formatNumber(surfaceData.surface_integral)}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: '0.875rem',
                    marginTop: '0.5rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {state.orientation === 'outward' ? '法向量向外' : '法向量向内'}
                </p>
                <p
                  style={{
                    fontSize: '0.875rem',
                    marginTop: '0.5rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  曲面: {surfaceData.surface.name}
                </p>
              </div>
            )}

            {/* 散度信息 */}
            {surfaceData && surfaceData.success && (
              <div className="info-panel">
                <h4>散度</h4>
                <div className="info-item">
                  <span>div(F)</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {(() => {
                      const P = state.P
                      const Q = state.Q
                      const R = state.R
                      // 简化的散度表达式
                      const divParts: string[] = []
                      if (P.includes('x')) divParts.push('∂P/∂x')
                      if (Q.includes('y')) divParts.push('∂Q/∂y')
                      if (R.includes('z')) divParts.push('∂R/∂z')
                      return divParts.length > 0 ? divParts.join(' + ') : '0'
                    })()}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginTop: '0.25rem',
                  }}
                >
                  div(F) = ∂P/∂x + ∂Q/∂y + ∂R/∂z
                </p>
                <p
                  style={{
                    fontSize: '0.875rem',
                    marginTop: '0.5rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  当 div(F) {'>'} 0 时，该点为"源"；
                </p>
                <p
                  style={{
                    fontSize: '0.875rem',
                    marginTop: '0.25rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  当 div(F) {'<'} 0 时，该点为"汇"。
                </p>
              </div>
            )}

            {/* 数学公式 */}
            <div className="info-panel">
              <h4>数学公式</h4>
              <div style={{ fontSize: '0.875rem', fontFamily: 'monospace' }}>
                <p>
                  <strong>曲面积分（通量）:</strong>
                </p>
                <p>∬_S F·dS</p>
                <p style={{ marginTop: '0.5rem' }}>= ∬_S (P dydz + Q dzdx + R dxdy)</p>
                <p
                  style={{
                    marginTop: '0.5rem',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  dS = |r_u × r_v| du dv
                </p>
              </div>
            </div>

            {/* 公式说明 */}
            <div className="info-panel">
              <h4>公式说明</h4>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <p>曲面积分计算向量场穿过曲面的通量。</p>
                <p style={{ marginTop: '0.5rem' }}>当 div(F) {'>'} 0 时，该点为"源"；</p>
                <p>当 div(F) &lt; 0 时，该点为"汇"。</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
