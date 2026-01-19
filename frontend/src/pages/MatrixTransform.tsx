import { useState, useEffect, useCallback } from 'react'
import Plot from 'react-plotly.js'
import { linearAlgebraApi, MatrixTransformRequest, MatrixTransformData } from '../services/api'


interface MatrixValues {
  a: number
  b: number
  c: number
  d: number
}

const PRESETS: Record<string, MatrixValues> = {
  'identity': { a: 1, b: 0, c: 0, d: 1 },
  'scale_2': { a: 2, b: 0, c: 0, d: 2 },
  'stretch_x': { a: 2, b: 0, c: 0, d: 1 },
  'stretch_y': { a: 1, b: 0, c: 0, d: 2 },
  'shear_x': { a: 1, b: 1, c: 0, d: 1 },
  'shear_y': { a: 1, b: 0, c: 1, d: 1 },
  'reflect_x': { a: 1, b: 0, c: 0, d: -1 },
  'reflect_y': { a: -1, b: 0, c: 0, d: 1 },
  'rotate_30': { a: Math.cos(Math.PI/6), b: -Math.sin(Math.PI/6), c: Math.sin(Math.PI/6), d: Math.cos(Math.PI/6) },
  'rotate_45': { a: Math.cos(Math.PI/4), b: -Math.sin(Math.PI/4), c: Math.sin(Math.PI/4), d: Math.cos(Math.PI/4) },
  'squeeze': { a: 2, b: 0, c: 0, d: 0.5 },
  'scale_nonuniform': { a: 2, b: 0, c: 0, d: 0.5 }
}

const PRESET_LABELS: Record<string, string> = {
  'identity': '单位矩阵',
  'scale_2': '缩放 2x',
  'stretch_x': 'X 轴拉伸',
  'stretch_y': 'Y 轴拉伸',
  'shear_x': 'X 方向剪切',
  'shear_y': 'Y 方向剪切',
  'reflect_x': 'X 轴反射',
  'reflect_y': 'Y 轴反射',
  'rotate_30': '旋转 30°',
  'rotate_45': '旋转 45°',
  'squeeze': '挤压变换',
  'scale_nonuniform': '非均匀缩放'
}

// 特征值类型：可以是数字或 {re, im} 对象
type EigenValue = number | { re: number; im: number }

// 格式化特征值显示
function formatEigenValue(ev: EigenValue): string {
  if (typeof ev === 'number') {
    return ev.toFixed(3)
  }
  // 复数格式
  const sign = ev.im >= 0 ? '+' : ''
  return `${ev.re.toFixed(3)}${sign}${ev.im.toFixed(3)}i`
}

export default function MatrixTransform() {
  const [matrix, setMatrix] = useState<MatrixValues>({ a: 1, b: 0, c: 0, d: 1 })
  const [showEigenvectors, setShowEigenvectors] = useState(true)
  const [showDeterminant, setShowDeterminant] = useState(true)
  const [data, setData] = useState<MatrixTransformData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (values: MatrixValues) => {
    setLoading(true)
    setError(null)
    try {
      const response = await linearAlgebraApi.matrixTransform({
        matrix: [values.a, values.b, values.c, values.d],
        show_eigenvectors: showEigenvectors,
        show_determinant: showDeterminant
      })
      if (response.success) {
        setData(response.data)
      } else {
        setError(response.error || '计算失败')
      }
    } catch (err: any) {
      setError('无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }, [showEigenvectors, showDeterminant])

  // 初始加载
  useEffect(() => {
    fetchData(matrix)
  }, [fetchData, matrix.a, matrix.b, matrix.c, matrix.d, showEigenvectors, showDeterminant])

  const handleMatrixChange = (field: keyof MatrixValues, value: number) => {
    setMatrix(prev => ({ ...prev, [field]: value }))
  }

  const applyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey]
    if (preset) {
      setMatrix(preset)
    }
  }

  const formatNumber = (n: number): string => {
    if (Math.abs(n) < 0.001 && n !== 0) return n.toExponential(2)
    return n.toFixed(2)
  }

  // 构建 Plotly 数据
  const buildPlotData = (): any[] => {
    if (!data) return []

    const plots: any[] = []

    // 原始网格 (灰色虚线)
    if (data.unit_grid) {
      // 水平线
      for (let i = 0; i < data.unit_grid.x_horizontal.length; i++) {
        plots.push({
          x: data.unit_grid.x_horizontal[i],
          y: data.unit_grid.y_horizontal[i],
          type: 'scatter',
          mode: 'lines',
          line: { color: '#94a3b8', width: 1, dash: 'dot' },
          showlegend: false,
          hoverinfo: 'skip'
        })
      }
      // 垂直线
      for (let i = 0; i < data.unit_grid.x_vertical.length; i++) {
        plots.push({
          x: data.unit_grid.x_vertical[i],
          y: data.unit_grid.y_vertical[i],
          type: 'scatter',
          mode: 'lines',
          line: { color: '#94a3b8', width: 1, dash: 'dot' },
          showlegend: false,
          hoverinfo: 'skip'
        })
      }
    }

    // 变换后的网格
    if (data.transformed_grid) {
      // 变换后的水平线 (蓝色)
      for (let i = 0; i < data.transformed_grid.x_horizontal.length; i++) {
        plots.push({
          x: data.transformed_grid.x_horizontal[i],
          y: data.transformed_grid.y_horizontal[i],
          type: 'scatter',
          mode: 'lines',
          line: { color: '#3b82f6', width: 2 },
          showlegend: false,
          hoverinfo: 'skip'
        })
      }
      // 变换后的垂直线 (红色)
      for (let i = 0; i < data.transformed_grid.x_vertical.length; i++) {
        plots.push({
          x: data.transformed_grid.x_vertical[i],
          y: data.transformed_grid.y_vertical[i],
          type: 'scatter',
          mode: 'lines',
          line: { color: '#ef4444', width: 2 },
          showlegend: false,
          hoverinfo: 'skip'
        })
      }
    }

    // 原始单位圆 (灰色)
    plots.push({
      x: data.unit_circle.x,
      y: data.unit_circle.y,
      type: 'scatter',
      mode: 'lines',
      fill: 'tozeroy',
      fillcolor: 'rgba(148, 163, 184, 0.1)',
      line: { color: '#94a3b8', width: 1, dash: 'dot' },
      name: '原始单位圆',
      hoverinfo: 'skip'
    })

    // 变换后的椭圆
    plots.push({
      x: data.unit_circle.x,
      y: data.unit_circle.y,
      type: 'scatter',
      mode: 'lines',
      fill: 'tozeroy',
      fillcolor: 'rgba(16, 185, 129, 0.15)',
      line: { color: '#10b981', width: 2 },
      name: '变换后'
    })

    // 基向量标注
    // e1 → [a, c]
    plots.push({
      x: [0, data.matrix.a],
      y: [0, data.matrix.c],
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#ef4444', width: 3 },
      marker: { size: 8, color: '#ef4444' },
      name: 'e₁ →',
      hovertemplate: 'e₁ → %{y:.2f}'
    })

    // e2 → [b, d]
    plots.push({
      x: [0, data.matrix.b],
      y: [0, data.matrix.d],
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#3b82f6', width: 3 },
      marker: { size: 8, color: '#3b82f6' },
      name: 'e₂ →',
      hovertemplate: 'e₂ → %{y:.2f}'
    })

    // 特征向量
    if (showEigenvectors && data.eigenvectors) {
      data.eigenvectors.forEach((ev, idx) => {
        const scale = 3
        plots.push({
          x: [0, ev.v[0] * scale],
          y: [0, ev.v[1] * scale],
          type: 'scatter',
          mode: 'lines+markers',
          line: { color: '#8b5cf6', width: 2, dash: 'dash' },
          marker: { size: 6, color: '#8b5cf6' },
          name: `λ${idx + 1} = ${ev.lambda.toFixed(2)}`,
          showlegend: true
        })
      })
    }

    return plots
  }

  const layout = {
    title: {
      text: `2×2 矩阵变换: [[${formatNumber(matrix.a)}, ${formatNumber(matrix.b)}], [${formatNumber(matrix.c)}, ${formatNumber(matrix.d)}]]`,
      font: { size: 16 }
    },
    xaxis: {
      title: 'x',
      range: [-6, 6],
      zeroline: true,
      showspikes: false,
      scaleanchor: 'y',
      scaleratio: 1
    },
    yaxis: {
      title: 'y',
      range: [-6, 6],
      zeroline: true,
      showspikes: false
    },
    showlegend: true,
    legend: { x: 1.02, y: 1 },
    hovermode: 'closest',
    dragmode: 'pan',
    margin: { t: 60, r: 120, b: 60, l: 60 }
  }

  return (
    <div className="content-card">
      <div className="card-header">
        <h2>2×2 矩阵变换可视化</h2>
        <p>输入矩阵 [[a, b], [c, d]]，观察对单位圆和网格的变换效果，理解线性变换的几何意义</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem' }}>
        {/* 左侧控制面板 */}
        <div>
          {/* 矩阵输入 */}
          <div style={{
            background: 'var(--background)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              矩阵元素
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>a</label>
                <input
                  type="number"
                  step="0.1"
                  value={matrix.a}
                  onChange={(e) => handleMatrixChange('a', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>b</label>
                <input
                  type="number"
                  step="0.1"
                  value={matrix.b}
                  onChange={(e) => handleMatrixChange('b', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>c</label>
                <input
                  type="number"
                  step="0.1"
                  value={matrix.c}
                  onChange={(e) => handleMatrixChange('c', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>d</label>
                <input
                  type="number"
                  step="0.1"
                  value={matrix.d}
                  onChange={(e) => handleMatrixChange('d', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* 滑块 */}
            <div style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem' }}>
              <div className="slider-container">
                <span style={{ fontSize: '0.75rem', width: '20px' }}>a</span>
                <input
                  type="range"
                  min="-3"
                  max="3"
                  step="0.1"
                  value={matrix.a}
                  onChange={(e) => handleMatrixChange('a', parseFloat(e.target.value))}
                />
                <span className="slider-value">{formatNumber(matrix.a)}</span>
              </div>
              <div className="slider-container">
                <span style={{ fontSize: '0.75rem', width: '20px' }}>b</span>
                <input
                  type="range"
                  min="-3"
                  max="3"
                  step="0.1"
                  value={matrix.b}
                  onChange={(e) => handleMatrixChange('b', parseFloat(e.target.value))}
                />
                <span className="slider-value">{formatNumber(matrix.b)}</span>
              </div>
              <div className="slider-container">
                <span style={{ fontSize: '0.75rem', width: '20px' }}>c</span>
                <input
                  type="range"
                  min="-3"
                  max="3"
                  step="0.1"
                  value={matrix.c}
                  onChange={(e) => handleMatrixChange('c', parseFloat(e.target.value))}
                />
                <span className="slider-value">{formatNumber(matrix.c)}</span>
              </div>
              <div className="slider-container">
                <span style={{ fontSize: '0.75rem', width: '20px' }}>d</span>
                <input
                  type="range"
                  min="-3"
                  max="3"
                  step="0.1"
                  value={matrix.d}
                  onChange={(e) => handleMatrixChange('d', parseFloat(e.target.value))}
                />
                <span className="slider-value">{formatNumber(matrix.d)}</span>
              </div>
            </div>
          </div>

          {/* 预设矩阵 */}
          <div style={{
            background: 'var(--background)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              预设矩阵
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {Object.keys(PRESETS).map(key => (
                <button
                  key={key}
                  className="btn btn-secondary"
                  onClick={() => applyPreset(key)}
                  style={{ fontSize: '0.75rem', padding: '0.5rem' }}
                >
                  {PRESET_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          {/* 显示选项 */}
          <div style={{
            background: 'var(--background)',
            borderRadius: '8px',
            padding: '1rem'
          }}>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              显示选项
            </h4>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showEigenvectors}
                onChange={(e) => setShowEigenvectors(e.target.checked)}
              />
              特征向量
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showDeterminant}
                onChange={(e) => setShowDeterminant(e.target.checked)}
              />
              行列式信息
            </label>
          </div>
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

          {data && (
            <>
              <div className="visualization-container">
                <Plot
                  data={buildPlotData()}
                  layout={{ ...layout, width: 700, height: 550 }}
                  config={{ responsive: true, scrollZoom: true }}
                />
              </div>

              {/* 信息面板 */}
              {showDeterminant && data.determinant && (
                <div className="info-panel" style={{ background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                  <h4>行列式信息</h4>
                  <div className="info-item">
                    <span>det(A)</span>
                    <span>{data.determinant.value.toFixed(3)}</span>
                  </div>
                  <div className="info-item">
                    <span>解释</span>
                    <span>{data.determinant.interpretation}</span>
                  </div>
                </div>
              )}

              {showEigenvectors && data.eigenvectors && data.eigenvectors.length > 0 && (
                <div className="info-panel" style={{ background: 'rgba(139, 92, 246, 0.05)', borderColor: 'rgba(139, 92, 246, 0.2)' }}>
                  <h4>特征值与特征向量</h4>
                  {data.eigenvectors.map((ev, idx) => (
                    <div key={idx} className="info-item">
                      <span>λ{idx + 1} = {ev.lambda.toFixed(3)}</span>
                      <span>v{idx + 1} = [{ev.v[0].toFixed(3)}, {ev.v[1].toFixed(3)}]</span>
                    </div>
                  ))}
                </div>
              )}

              {showEigenvectors && (!data.eigenvectors || data.eigenvectors.length === 0) && (
                <div className="info-panel">
                  <h4>特征值</h4>
                  <p style={{ fontSize: '0.875rem' }}>
                    λ₁ = {formatEigenValue(data.eigenvalues[0])}, λ₂ = {formatEigenValue(data.eigenvalues[1])}
                    <br />
                    <span style={{ color: 'var(--text-secondary)' }}>
                      (复特征值，无实特征向量)
                    </span>
                  </p>
                </div>
              )}

              <div className="info-panel">
                <h4>图例说明</h4>
                <p style={{ fontSize: '0.875rem' }}>
                  <span style={{ color: '#94a3b8' }}>···</span> 原始单位圆/网格<br/>
                  <span style={{ color: '#10b981' }}>●</span> 变换后的椭圆<br/>
                  <span style={{ color: '#ef4444' }}>—</span> 变换后 x 方向基向量 (e₁ →)<br/>
                  <span style={{ color: '#3b82f6' }}>—</span> 变换后 y 方向基向量 (e₂ →)<br/>
                  <span style={{ color: '#8b5cf6' }}>--</span> 特征向量方向
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
