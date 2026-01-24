import { useState, useEffect, useCallback } from 'react'
import Plot from 'react-plotly.js'
import { multivariateApi, ComputeSurfaceData, Preset } from '../services/api'
import { Link } from 'react-router-dom'

interface MultivariateState {
  function: string
  xRange: [number, number]
  yRange: [number, number]
  pointX: number
  pointY: number
  resolution: number
  contourLevels: number
  showGradient: boolean
  showTangentPlane: boolean
}

const DEFAULT_STATE: MultivariateState = {
  function: 'x**2 + y**2',
  xRange: [-3, 3],
  yRange: [-3, 3],
  pointX: 1,
  pointY: 1,
  resolution: 50,
  contourLevels: 20,
  showGradient: true,
  showTangentPlane: true
}

export default function MultivariateFunction() {
  const [state, setState] = useState<MultivariateState>(DEFAULT_STATE)
  const [data, setData] = useState<ComputeSurfaceData | null>(null)
  const [presets, setPresets] = useState<Preset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 获取预设函数
  useEffect(() => {
    const fetchPresets = async () => {
      const response = await multivariateApi.getPresets()
      if (response.success) {
        setPresets(response.presets)
      }
    }
    fetchPresets()
  }, [])

  // 获取可视化数据
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await multivariateApi.compute({
        function: state.function,
        x_range: state.xRange,
        y_range: state.yRange,
        point_x: state.pointX,
        point_y: state.pointY,
        resolution: state.resolution,
        contour_levels: state.contourLevels,
        show_gradient: state.showGradient,
        show_tangent_plane: state.showTangentPlane
      })
      if (response.success) {
        setData(response)
      } else {
        setError(response.error || '计算失败')
      }
    } catch (err: any) {
      setError('无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }, [state])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleStateChange = <K extends keyof MultivariateState>(key: K, value: MultivariateState[K]) => {
    setState(prev => ({ ...prev, [key]: value }))
  }

  const applyPreset = (func: string) => {
    setState(prev => ({ ...prev, function: func }))
  }

  const formatNumber = (n: number): string => {
    if (Math.abs(n) < 0.001 && n !== 0) return n.toExponential(2)
    return n.toFixed(3)
  }

  // 构建 3D 曲面图数据
  const build3DData = (): any[] => {
    if (!data || !data.surface) return []

    const plots: any[] = []

    // 3D 曲面
    plots.push({
      type: 'surface',
      x: data.surface.x,
      y: data.surface.y,
      z: data.surface.z,
      colorscale: 'Viridis',
      colorbar: { title: 'z', len: 0.5 },
      hovertemplate: 'x: %{x:.2f}<br>y: %{y:.2f}<br>z: %{z:.2f}<extra></extra>',
      showscale: true
    })

    // 梯度场（3D 箭头网格）
    if (state.showGradient && data.gradient) {
      const { x, y, u, v, magnitude } = data.gradient
      const coneX: number[] = []
      const coneY: number[] = []
      const coneZ: number[] = []
      const coneU: number[] = []
      const coneV: number[] = []
      const coneW: number[] = []

      for (let i = 0; i < x.length; i++) {
        for (let j = 0; j < x[i].length; j++) {
          const px = x[i][j]
          const py = y[i][j]
          const pu = u[i][j]
          const pv = v[i][j]
          const mag = magnitude[i][j]

          // 计算对应的 z 值
          const pz = data.surface.z[i]?.[j] ?? 0

          if (mag > 0.001) {
            // 归一化方向
            const scale = 0.3 / Math.sqrt(mag)
            coneX.push(px)
            coneY.push(py)
            coneZ.push(pz)
            coneU.push(pu * scale)
            coneV.push(pv * scale)
            coneW.push(0.3) // z方向分量
          }
        }
      }

      if (coneX.length > 0) {
        plots.push({
          type: 'cone',
          x: coneX,
          y: coneY,
          z: coneZ,
          u: coneU,
          v: coneV,
          w: coneW,
          colorscale: [[0, '#dc2626'], [1, '#dc2626']],
          showscale: false,
          sizemode: 'absolute',
          sizeref: 0.5,
          name: '梯度场',
          hoverinfo: 'skip'
        })
      }
    }

    // 观察点
    if (data.point) {
      plots.push({
        type: 'scatter3d',
        mode: 'markers',
        x: [data.point.x],
        y: [data.point.y],
        z: [data.point.z],
        marker: { size: 8, color: '#ef4444' },
        name: '观察点',
        hovertemplate: `x: ${formatNumber(data.point.x)}<br>y: ${formatNumber(data.point.y)}<br>z: ${formatNumber(data.point.z)}<extra></extra>`
      })

      // 梯度向量 (3D) - 观察点处
      if (data.partial_derivatives) {
        const { df_dx, df_dy } = data.partial_derivatives
        const mag = Math.sqrt(df_dx * df_dx + df_dy * df_dy)
        if (mag > 0) {
          const scale = 0.5
          plots.push({
            type: 'scatter3d',
            mode: 'lines',
            x: [data.point.x, data.point.x + df_dx / mag * scale],
            y: [data.point.y, data.point.y + df_dy / mag * scale],
            z: [data.point.z, data.point.z + scale],
            line: { color: '#3b82f6', width: 4 },
            name: '梯度方向',
            hovertemplate: '梯度方向（函数增长最快）<extra></extra>'
          })
        }
      }
    }

    // 切平面
    if (state.showTangentPlane && data.tangent_plane) {
      plots.push({
        type: 'surface',
        x: data.tangent_plane.x,
        y: data.tangent_plane.y,
        z: data.tangent_plane.z,
        colorscale: [[0, 'rgba(239, 68, 68, 0.3)'], [1, 'rgba(239, 68, 68, 0.3)']],
        showscale: false,
        opacity: 0.5,
        name: '切平面',
        hovertemplate: '切平面<extra></extra>'
      })
    }

    return plots
  }

  // 构建等高线图数据
  const buildContourData = (): any[] => {
    if (!data || !data.contour) return []

    const plots: any[] = []

    // 等高线
    plots.push({
      type: 'contour',
      x: data.contour.x[0],
      y: data.contour.y.map(row => row[0]),
      z: data.contour.z,
      ncontours: state.contourLevels,
      colorscale: 'Viridis',
      colorbar: { title: 'z', len: 0.5 },
      hovertemplate: 'x: %{x:.2f}<br>y: %{y:.2f}<br>z: %{z:.2f}<extra></extra>'
    })

    // 梯度场（线段）
    if (state.showGradient && data.gradient) {
      const { x, y, u, v, magnitude } = data.gradient

      const arrowX: number[] = []
      const arrowY: number[] = []

      for (let i = 0; i < x.length; i++) {
        for (let j = 0; j < x[i].length; j++) {
          const px = x[i][j]
          const py = y[i][j]
          const pu = u[i][j]
          const pv = v[i][j]
          const mag = magnitude[i][j]

          if (mag > 0.001) {
            const scale = 0.15 / Math.sqrt(mag)
            arrowX.push(px, px + pu * scale, null)
            arrowY.push(py, py + pv * scale, null)
          }
        }
      }

      plots.push({
        type: 'scatter',
        mode: 'lines',
        x: arrowX,
        y: arrowY,
        line: { color: '#dc2626', width: 1.5 },
        name: '梯度场',
        hoverinfo: 'skip'
      })
    }

    // 观察点
    if (data.point) {
      plots.push({
        type: 'scatter',
        mode: 'markers',
        x: [data.point.x],
        y: [data.point.y],
        marker: { size: 12, color: '#ef4444', symbol: 'circle-open', line: { width: 3 } },
        name: '观察点',
        hovertemplate: `x: ${formatNumber(data.point.x)}<br>y: ${formatNumber(data.point.y)}<extra></extra>`
      })

      // 梯度向量 (2D) - 观察点处
      if (data.gradient_2d && data.partial_derivatives) {
        const { df_dx, df_dy } = data.partial_derivatives
        const mag = Math.sqrt(df_dx * df_dx + df_dy * df_dy)
        if (mag > 0) {
          const scale = 0.3
          plots.push({
            type: 'scatter',
            mode: 'lines+markers',
            x: [data.point.x, data.point.x + df_dx / mag * scale],
            y: [data.point.y, data.point.y + df_dy / mag * scale],
            line: { color: '#3b82f6', width: 3 },
            marker: { size: 8, color: '#3b82f6' },
            name: '梯度',
            hovertemplate: '梯度方向<br>dx: ' + formatNumber(df_dx) + '<br>dy: ' + formatNumber(df_dy) + '<extra></extra>'
          })
        }
      }
    }

    return plots
  }

  // 3D 布局
  const layout3D = {
    title: {
      text: `3D 曲面图: z = ${state.function}`,
      font: { size: 14 }
    },
    scene: {
      xaxis: { title: 'x', range: state.xRange },
      yaxis: { title: 'y', range: state.yRange },
      zaxis: { title: 'z' },
      camera: {
        eye: { x: 1.5, y: 1.5, z: 1.2 }
      }
    },
    margin: { t: 50, r: 20, b: 50, l: 50 },
    showlegend: true,
    legend: { x: 0, y: 1 }
  }

  // 2D 等高线布局
  const layout2D = {
    title: {
      text: `等高线图: z = ${state.function}`,
      font: { size: 14 },
      y: 0.98,
      x: 0.02,
      xanchor: 'left'
    },
    xaxis: { title: 'x', range: state.xRange },
    yaxis: { title: 'y', range: state.yRange, scaleanchor: 'x' as const, scaleratio: 1 },
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
          <span>多元函数可视化</span>
        </div>
        <h1 className="detail-title">多元函数可视化</h1>
      </header>

      <div className="content-card" style={{ margin: '2rem', maxWidth: '1600px' }}>
        <div className="card-header">
          <h2>多元函数可视化</h2>
          <p>输入二元函数 z = f(x, y)，观察 3D 曲面图和等高线图</p>
        </div>

        {/* 控制面板 */}
        <div style={{
          background: 'var(--background)',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* 函数输入 */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>f(x, y) =</label>
              <input
                type="text"
                value={state.function}
                onChange={(e) => handleStateChange('function', e.target.value)}
                placeholder="例如: x**2 + y**2"
              />
            </div>

            {/* 观察点坐标 */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>观察点 x</label>
              <input
                type="number"
                step="0.1"
                value={state.pointX}
                onChange={(e) => handleStateChange('pointX', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>观察点 y</label>
              <input
                type="number"
                step="0.1"
                value={state.pointY}
                onChange={(e) => handleStateChange('pointY', parseFloat(e.target.value) || 0)}
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

            {/* y 范围 */}
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

          {/* 预设函数 */}
          <div style={{ marginTop: '1rem' }}>
            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
              预设函数
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  className="btn btn-secondary"
                  onClick={() => applyPreset(preset.function)}
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
                checked={state.showGradient}
                onChange={(e) => handleStateChange('showGradient', e.target.checked)}
              />
              显示梯度场
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={state.showTangentPlane}
                onChange={(e) => handleStateChange('showTangentPlane', e.target.checked)}
              />
              显示切平面
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

        {/* 可视化区域 - 左右分区 */}
        {loading && !data && (
          <div className="loading">加载中...</div>
        )}

        {data && data.success && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
            {/* 3D 曲面图 */}
            <div style={{ background: '#fff', borderRadius: '8px', padding: '0.5rem' }}>
              <Plot
                data={build3DData()}
                layout={layout3D as any}
                config={{ responsive: true, scrollZoom: true, displayModeBar: true }}
                style={{ width: '100%', height: '600px' }}
              />
            </div>

            {/* 等高线图 */}
            <div style={{ background: '#fff', borderRadius: '8px', padding: '0.5rem' }}>
              <Plot
                data={buildContourData()}
                layout={layout2D as any}
                config={{ responsive: true, scrollZoom: true, displayModeBar: true }}
                style={{ width: '100%', height: '600px' }}
              />
            </div>
          </div>
        )}

        {/* 偏导数信息 */}
        {data && data.partial_derivatives && (
          <div className="info-panel" style={{
            marginTop: '1rem',
            background: 'rgba(59, 130, 246, 0.05)',
            borderColor: 'rgba(59, 130, 246, 0.2)'
          }}>
            <h4>偏导数信息（观察点）</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="info-item">
                <span>∂f/∂x</span>
                <span>{formatNumber(data.partial_derivatives.df_dx)}</span>
              </div>
              <div className="info-item">
                <span>∂f/∂y</span>
                <span>{formatNumber(data.partial_derivatives.df_dy)}</span>
              </div>
              <div className="info-item">
                <span>函数值 f(x,y)</span>
                <span>{data.point ? formatNumber(data.point.z) : '-'}</span>
              </div>
              <div className="info-item">
                <span>梯度模长</span>
                <span>{formatNumber(Math.sqrt(
                  data.partial_derivatives.df_dx ** 2 +
                  data.partial_derivatives.df_dy ** 2
                ))}</span>
              </div>
            </div>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
              偏导数表达式: ∂f/∂x = {data.partial_derivatives.df_dx_expr}, ∂f/∂y = {data.partial_derivatives.df_dy_expr}
            </p>
          </div>
        )}

        {/* 切平面方程 */}
        {data && data.tangent_plane && (
          <div className="info-panel" style={{
            marginTop: '1rem',
            background: 'rgba(239, 68, 68, 0.05)',
            borderColor: 'rgba(239, 68, 68, 0.2)'
          }}>
            <h4>切平面方程</h4>
            <p style={{ fontFamily: 'monospace', fontSize: '1rem' }}>
              {data.tangent_plane.equation}
            </p>
          </div>
        )}

        {/* 图例说明 */}
        <div className="info-panel" style={{ marginTop: '1rem' }}>
          <h4>图例说明</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.875rem' }}>
            <p>
              <span style={{ color: '#10b981' }}>●</span> 3D 曲面: 函数 z = f(x,y)<br/>
              <span style={{ color: '#ef4444' }}>●</span> 观察点位置<br/>
              <span style={{ color: '#3b82f6' }}>—</span> 梯度方向（函数增长最快）<br/>
              <span style={{ color: 'rgba(239, 68, 68, 0.5)' }}>■</span> 切平面
            </p>
            <p>
              <span style={{ color: '#9333ea' }}>●</span> 等高线: z 值相等的点连线<br/>
              <span style={{ color: '#ef4444' }}>○</span> 等高线上的观察点<br/>
              <span style={{ color: '#3b82f6' }}>—</span> 梯度向量在 xy 平面投影
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
