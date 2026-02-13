import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import Plot from 'react-plotly.js'
import { vectorFieldApi, SolidType, GaussSolidPreset, GaussTheoremData } from '../services/api'

// ============ 默认预设 ============

const DEFAULT_GAUSS_SOLIDS: GaussSolidPreset[] = [
  {
    id: 'unit_sphere',
    name: '单位球体',
    description: 'x² + y² + z² ≤ 1',
    type: 'sphere',
    params: { r: 1 }
  },
  {
    id: 'cube',
    name: '立方体',
    description: '|x| ≤ 1, |y| ≤ 1, |z| ≤ 1',
    type: 'cube',
    params: { half: 1 }
  },
  {
    id: 'cylinder_solid',
    name: '圆柱体',
    description: 'x² + y² ≤ 1, 0 ≤ z ≤ 2',
    type: 'cylinder',
    params: { r: 1, h: 2 }
  }
]

const DEFAULT_VECTOR_FIELD_PRESETS = [
  { id: 'radial_3d', name: '径向场 F=(x,y,z)', P: 'x', Q: 'y', R: 'z' },
  { id: 'constant', name: '恒定场 F=(1,1,1)', P: '1', Q: '1', R: '1' },
  { id: 'rotation_z', name: '旋转场 F=(-y,x,0)', P: '-y', Q: 'x', R: '0' },
  { id: 'source', name: '源场 F=(x,y,0)', P: 'x', Q: 'y', R: '0' },
  { id: 'vortex', name: '涡旋场 F=(-z,0,x)', P: '-z', Q: '0', R: 'x' }
]

// ============ 类型定义 ============

interface GaussTheoremState {
  P: string
  Q: string
  R: string
  solidType: SolidType
  resolution: number
  solidRadius: number
  solidHalf: number
  solidHeight: number
  showSurface: boolean
  showVolume: boolean
}

const DEFAULT_STATE: GaussTheoremState = {
  P: 'x',
  Q: 'y',
  R: 'z',
  solidType: 'sphere',
  resolution: 25,
  solidRadius: 1,
  solidHalf: 1,
  solidHeight: 2,
  showSurface: true,
  showVolume: false
}

// ============ 主组件 ============

export default function GaussTheorem() {
  const [state, setState] = useState<GaussTheoremState>(DEFAULT_STATE)
  const [gaussData, setGaussData] = useState<GaussTheoremData | null>(null)
  const [presets, setPresets] = useState<{ solids: GaussSolidPreset[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 获取预设
  useEffect(() => {
    const fetchPresets = async () => {
      const response = await vectorFieldApi.getGaussPresets()
      if (response.success && response.solids) {
        setPresets({ solids: response.solids })
      }
    }
    fetchPresets()
  }, [])

  // 预设数据
  const solidPresets = useMemo((): GaussSolidPreset[] => {
    return presets?.solids || DEFAULT_GAUSS_SOLIDS
  }, [presets])

  // 获取高斯定理数据
  const fetchGaussTheorem = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const solidParams: Record<string, number> = {}
      if (state.solidType === 'sphere') {
        solidParams.r = state.solidRadius
      } else if (state.solidType === 'cube') {
        solidParams.half = state.solidHalf
      } else if (state.solidType === 'cylinder') {
        solidParams.r = state.solidRadius
        solidParams.h = state.solidHeight
      }

      const response = await vectorFieldApi.gaussTheorem({
        P: state.P,
        Q: state.Q,
        R: state.R,
        solid_type: state.solidType,
        solid_params: solidParams,
        resolution: state.resolution
      })

      if (response.success) {
        setGaussData(response)
      } else {
        setGaussData(null)
        setError(response.error || '计算失败')
      }
    } catch (err) {
      setError('无法连接到服务器')
      setGaussData(null)
    } finally {
      setLoading(false)
    }
  }, [state.P, state.Q, state.R, state.solidType, state.solidRadius, state.solidHalf, state.solidHeight, state.resolution])

  // 当参数变化时重新计算
  useEffect(() => {
    fetchGaussTheorem()
  }, [fetchGaussTheorem])

  const handleStateChange = <K extends keyof GaussTheoremState>(key: K, value: GaussTheoremState[K]) => {
    setState(prev => ({ ...prev, [key]: value }))
  }

  const applyVectorField = (preset: typeof DEFAULT_VECTOR_FIELD_PRESETS[0]) => {
    setState(prev => ({ ...prev, P: preset.P, Q: preset.Q, R: preset.R }))
  }

  const applySolid = (preset: GaussSolidPreset) => {
    setState(prev => {
      const newState = { ...prev, solidType: preset.type }
      if (preset.type === 'sphere') {
        newState.solidRadius = preset.params.r || 1
      } else if (preset.type === 'cube') {
        newState.solidHalf = preset.params.half || 1
      } else if (preset.type === 'cylinder') {
        newState.solidRadius = preset.params.r || 1
        newState.solidHeight = preset.params.h || 2
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
    if (!gaussData || !gaussData.success) return []

    const plots: any[] = []
    const { solid } = gaussData

    // 绘制立体表面
    if (state.showSurface) {
      if (solid.type === 'sphere' && Array.isArray(solid.x) && Array.isArray(solid.x[0])) {
        plots.push({
          type: 'surface',
          x: solid.x as number[][],
          y: solid.y as number[][],
          z: solid.z as number[][],
          colorscale: 'Blues',
          showscale: false,
          opacity: 0.5,
          name: '闭合曲面 S',
          hoverongaps: false
        })
      } else if (solid.type === 'cylinder' && Array.isArray(solid.x) && Array.isArray(solid.x[0])) {
        plots.push({
          type: 'surface',
          x: solid.x as number[][],
          y: solid.y as number[][],
          z: solid.z as number[][],
          colorscale: 'Blues',
          showscale: false,
          opacity: 0.5,
          name: '圆柱侧面',
          hoverongaps: false
        })
      } else if (solid.type === 'cube' && Array.isArray(solid.x)) {
        // 绘制立方体的6个面
        const cubeColors = ['rgba(100,149,237,0.3)', 'rgba(100,149,237,0.3)', 'rgba(100,149,237,0.3)',
                          'rgba(100,149,237,0.3)', 'rgba(100,149,237,0.3)', 'rgba(100,149,237,0.3)']
        for (let i = 0; i < 6; i++) {
          if (solid.x[i] && solid.y[i] && solid.z[i]) {
            plots.push({
              type: 'mesh3d',
              x: solid.x[i] as number[],
              y: solid.y[i] as number[],
              z: solid.z[i] as number[],
              color: cubeColors[i],
              opacity: 0.5,
              name: i === 0 ? '立方体表面' : undefined,
              i: [0, 1, 2, 3],
              j: [1, 2, 3, 0],
              k: [2, 3, 0, 1]
            })
          }
        }
      }
    }

    // 显示法向量（在球面上）
    if (state.showSurface && gaussData.gauss_theorem && solid.type === 'sphere') {
      const r = state.solidRadius
      const skip = 8
      const arrowX: number[] = []
      const arrowY: number[] = []
      const arrowZ: number[] = []
      const arrowU: number[] = []
      const arrowV: number[] = []
      const arrowW: number[] = []

      for (let i = 0; i < 180; i += skip) {
        for (let j = 0; j < 360; j += skip) {
          const phi = i * Math.PI / 180
          const theta = j * Math.PI / 180

          const px = r * Math.sin(phi) * Math.cos(theta)
          const py = r * Math.sin(phi) * Math.sin(theta)
          const pz = r * Math.cos(phi)

          // 法向量向外
          arrowX.push(px)
          arrowY.push(py)
          arrowZ.push(pz)
          arrowU.push(px * 0.15)
          arrowV.push(py * 0.15)
          arrowW.push(pz * 0.15)
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
        sizemode: 'absolute',
        sizeref: 0.5,
        colorscale: [[0, 'rgb(255,0,0)'], [1, 'rgb(255,0,0)']],
        showscale: false,
        name: '外法向量'
      })
    }

    return plots
  }, [gaussData, state.showSurface, state.solidRadius])

  // 图表布局
  const layout = useMemo((): any => ({
    title: {
      text: `高斯散度定理验证: ${gaussData?.solid.name || '立体'}`,
      font: { size: 14 }
    },
    scene: {
      xaxis: { title: 'x', range: [-2, 2] },
      yaxis: { title: 'y', range: [-2, 2] },
      zaxis: { title: 'z', range: [-2, 2] },
      aspectmode: 'cube'
    },
    margin: { t: 50, r: 50, b: 50, l: 50 },
    showlegend: true,
    legend: { x: 1.02, y: 1 }
  }), [gaussData])

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
          <span>高斯定理</span>
        </div>
        <h1 className="detail-title">高斯散度定理验证</h1>
      </header>

      <div className="content-card" style={{ margin: '2rem', maxWidth: '1600px' }}>
        <div className="card-header">
          <h2>高斯散度定理可视化</h2>
          <p>验证 ∬_S F·dS = ∭_V div(F) dV</p>
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

            {/* 立体选择 */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>立体类型</label>
              <select
                value={state.solidType}
                onChange={(e) => handleStateChange('solidType', e.target.value as SolidType)}
              >
                {solidPresets.map(p => (
                  <option key={p.id} value={p.type}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 立体参数 */}
          {state.solidType === 'sphere' && (
            <div style={{ marginTop: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0, display: 'inline-block', marginRight: '1rem' }}>
                <label>半径 r =</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="3"
                  value={state.solidRadius}
                  onChange={(e) => handleStateChange('solidRadius', parseFloat(e.target.value) || 1)}
                />
              </div>
            </div>
          )}

          {state.solidType === 'cube' && (
            <div style={{ marginTop: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0, display: 'inline-block', marginRight: '1rem' }}>
                <label>半边长 =</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="2"
                  value={state.solidHalf}
                  onChange={(e) => handleStateChange('solidHalf', parseFloat(e.target.value) || 1)}
                />
              </div>
            </div>
          )}

          {state.solidType === 'cylinder' && (
            <div style={{ marginTop: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0, display: 'inline-block', marginRight: '1rem' }}>
                <label>半径 r =</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="2"
                  value={state.solidRadius}
                  onChange={(e) => handleStateChange('solidRadius', parseFloat(e.target.value) || 1)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0, display: 'inline-block' }}>
                <label>高度 h =</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="4"
                  value={state.solidHeight}
                  onChange={(e) => handleStateChange('solidHeight', parseFloat(e.target.value) || 2)}
                />
              </div>
            </div>
          )}

          {/* 预设向量场 */}
          <div style={{ marginTop: '1rem' }}>
            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
              预设向量场
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {DEFAULT_VECTOR_FIELD_PRESETS.map(preset => (
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

          {/* 预设立体 */}
          <div style={{ marginTop: '1rem' }}>
            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
              预设立体
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {solidPresets.map(preset => (
                <button
                  key={preset.id}
                  className={`btn ${state.solidType === preset.type ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => applySolid(preset)}
                  style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* 显示选项 */}
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={state.showSurface}
                onChange={(e) => handleStateChange('showSurface', e.target.checked)}
              />
              显示闭合曲面
            </label>
          </div>
        </div>

        {/* 错误信息 */}
        {error && (
          <div className="error-message" style={{ marginBottom: '1rem' }}>
            <span style={{ marginRight: '8px' }}>⚠️</span>
            {error}
          </div>
        )}

        {/* 可视化区域 */}
        {loading && !gaussData && (
          <div className="loading">加载中...</div>
        )}

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
            {/* 高斯定理验证结果 */}
            {gaussData && gaussData.success && (
              <div className="info-panel" style={{
                background: gaussData.gauss_theorem.is_verified
                  ? 'rgba(16, 185, 129, 0.05)'
                  : 'rgba(245, 158, 11, 0.05)',
                borderColor: gaussData.gauss_theorem.is_verified
                  ? 'rgba(16, 185, 129, 0.2)'
                  : 'rgba(245, 158, 11, 0.2)'
              }}>
                <h4>高斯散度定理验证</h4>
                <div style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                  ∬_S F·dS = ∭_V div(F) dV
                </div>

                <div className="info-item">
                  <span>左边（曲面积分）</span>
                  <span style={{ fontWeight: 'bold' }}>{formatNumber(gaussData.gauss_theorem.surface_integral.value)}</span>
                </div>
                <div className="info-item">
                  <span>右边（体积分）</span>
                  <span style={{ fontWeight: 'bold' }}>{formatNumber(gaussData.gauss_theorem.volume_integral.value)}</span>
                </div>
                <div className="info-item">
                  <span>差异</span>
                  <span>{formatNumber(gaussData.gauss_theorem.difference)}</span>
                </div>
                <div className="info-item">
                  <span>相对误差</span>
                  <span>{(gaussData.gauss_theorem.relative_error * 100).toFixed(2)}%</span>
                </div>

                <p style={{
                  fontSize: '0.875rem',
                  marginTop: '0.75rem',
                  fontWeight: 'bold',
                  color: gaussData.gauss_theorem.is_verified ? '#10b981' : '#f59e0b'
                }}>
                  {gaussData.gauss_theorem.is_verified
                    ? '✓ 高斯定理验证通过'
                    : '⚠ 验证中（存在数值误差）'}
                </p>
              </div>
            )}

            {/* 散度信息 */}
            {gaussData && gaussData.success && (
              <div className="info-panel">
                <h4>散度表达式</h4>
                <div className="info-item">
                  <span>div(F) =</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {gaussData.gauss_theorem.divergence_expression}
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  div(F) = ∂P/∂x + ∂Q/∂y + ∂R/∂z
                </p>
              </div>
            )}

            {/* 立体信息 */}
            {gaussData && gaussData.success && (
              <div className="info-panel">
                <h4>立体信息</h4>
                <div className="info-item">
                  <span>类型</span>
                  <span>{gaussData.solid.name}</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  闭合曲面 S 包围体积 V
                </p>
              </div>
            )}

            {/* 数学公式 */}
            <div className="info-panel">
              <h4>高斯散度定理</h4>
              <div style={{ fontSize: '0.875rem', fontFamily: 'monospace' }}>
                <p style={{ marginBottom: '0.5rem' }}>∬_S F·dS = ∭_V div(F) dV</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  其中 div(F) = ∂P/∂x + ∂Q/∂y + ∂R/∂z
                </p>
              </div>
            </div>

            {/* 公式说明 */}
            <div className="info-panel">
              <h4>物理解释</h4>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <p>• 左边：向量场穿过闭合曲面的净通量</p>
                <p style={{ marginTop: '0.25rem' }}>• 右边：向量场在体积内的"源"强度总和</p>
                <p style={{ marginTop: '0.25rem' }}>• 若 div(F) {'>'} 0，该点为"源"</p>
                <p style={{ marginTop: '0.25rem' }}>• 若 div(F) &lt; 0，该点为"汇"</p>
                <p style={{ marginTop: '0.25rem' }}>• 若 div(F) = 0，则无源无汇</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}