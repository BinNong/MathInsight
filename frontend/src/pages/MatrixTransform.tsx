import { useState, useEffect, useCallback } from 'react'
import Plot from 'react-plotly.js'
import { linearAlgebraApi, MatrixTransformData } from '../services/api'
import PageHeader from '../components/PageHeader'
import ControlPanel from '../components/ControlPanel'
import VisualizationCard from '../components/VisualizationCard'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import VisualizationWorkspace from '../components/VisualizationWorkspace'
import CollapsibleSection from '../components/CollapsibleSection'

interface MatrixValues {
  a: number
  b: number
  c: number
  d: number
}

const PRESETS: Record<string, MatrixValues> = {
  identity: { a: 1, b: 0, c: 0, d: 1 },
  scale_2: { a: 2, b: 0, c: 0, d: 2 },
  stretch_x: { a: 2, b: 0, c: 0, d: 1 },
  stretch_y: { a: 1, b: 0, c: 0, d: 2 },
  shear_x: { a: 1, b: 1, c: 0, d: 1 },
  shear_y: { a: 1, b: 0, c: 1, d: 1 },
  reflect_x: { a: 1, b: 0, c: 0, d: -1 },
  reflect_y: { a: -1, b: 0, c: 0, d: 1 },
  rotate_30: {
    a: Math.cos(Math.PI / 6),
    b: -Math.sin(Math.PI / 6),
    c: Math.sin(Math.PI / 6),
    d: Math.cos(Math.PI / 6),
  },
  rotate_45: {
    a: Math.cos(Math.PI / 4),
    b: -Math.sin(Math.PI / 4),
    c: Math.sin(Math.PI / 4),
    d: Math.cos(Math.PI / 4),
  },
  squeeze: { a: 2, b: 0, c: 0, d: 0.5 },
  scale_nonuniform: { a: 2, b: 0, c: 0, d: 0.5 },
}

const PRESET_LABELS: Record<string, string> = {
  identity: '单位矩阵',
  scale_2: '缩放 2x',
  stretch_x: 'X 轴拉伸',
  stretch_y: 'Y 轴拉伸',
  shear_x: 'X 方向剪切',
  shear_y: 'Y 方向剪切',
  reflect_x: 'X 轴反射',
  reflect_y: 'Y 轴反射',
  rotate_30: '旋转 30°',
  rotate_45: '旋转 45°',
  squeeze: '挤压变换',
  scale_nonuniform: '非均匀缩放',
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

  const fetchData = useCallback(
    async (values: MatrixValues) => {
      setLoading(true)
      setError(null)
      try {
        const response = await linearAlgebraApi.matrixTransform({
          matrix: [values.a, values.b, values.c, values.d],
          show_eigenvectors: showEigenvectors,
          show_determinant: showDeterminant,
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
    },
    [showEigenvectors, showDeterminant]
  )

  // 初始加载
  useEffect(() => {
    fetchData(matrix)
  }, [fetchData, matrix.a, matrix.b, matrix.c, matrix.d, showEigenvectors, showDeterminant])

  const handleMatrixChange = (field: keyof MatrixValues, value: number) => {
    setMatrix((prev) => ({ ...prev, [field]: value }))
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
          hoverinfo: 'skip',
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
          hoverinfo: 'skip',
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
          hoverinfo: 'skip',
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
          hoverinfo: 'skip',
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
      hoverinfo: 'skip',
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
      name: '变换后',
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
      hovertemplate: 'e₁ → %{y:.2f}',
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
      hovertemplate: 'e₂ → %{y:.2f}',
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
          showlegend: true,
        })
      })
    }

    return plots
  }

  const layout: any = {
    title: {
      text: `2×2 矩阵变换: [[${formatNumber(matrix.a)}, ${formatNumber(matrix.b)}], [${formatNumber(matrix.c)}, ${formatNumber(matrix.d)}]]`,
      font: { size: 16 },
    },
    xaxis: {
      title: 'x',
      range: [-6, 6],
      zeroline: true,
      showspikes: false,
      scaleanchor: 'y',
      scaleratio: 1,
    },
    yaxis: {
      title: 'y',
      range: [-6, 6],
      zeroline: true,
      showspikes: false,
    },
    showlegend: true,
    legend: { x: 1.02, y: 1 },
    hovermode: 'closest',
    dragmode: 'pan',
    margin: { t: 60, r: 120, b: 60, l: 60 },
    autosize: true,
  }

  return (
    <div className="detail-page">
      <PageHeader
        backTo="/subject/linear-algebra"
        backLabel="返回线性代数"
        breadcrumbs={[
          { label: '首页', path: '/' },
          { label: '线性代数', path: '/subject/linear-algebra' },
          { label: '2×2 矩阵变换可视化' },
        ]}
        title="2×2 矩阵变换可视化"
      />

      <VisualizationWorkspace
        visualizationTitle="2×2 矩阵变换可视化"
        controls={
          <ControlPanel title="参数设置" subtitle="输入矩阵 [[a, b], [c, d]]">
            <div className="form-section">
              <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <label className="form-label">a</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.1"
                    value={matrix.a}
                    onChange={(e) => handleMatrixChange('a', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="form-label">b</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.1"
                    value={matrix.b}
                    onChange={(e) => handleMatrixChange('b', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="form-label">c</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.1"
                    value={matrix.c}
                    onChange={(e) => handleMatrixChange('c', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="form-label">d</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.1"
                    value={matrix.d}
                    onChange={(e) => handleMatrixChange('d', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="slider-container">
                <span>a</span>
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
                <span>b</span>
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
                <span>c</span>
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
                <span>d</span>
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

            <div className="form-section">
              <h4 className="form-section-title">预设矩阵</h4>
              <div className="preset-group">
                {Object.keys(PRESETS).map((key) => (
                  <button key={key} className="preset-chip" onClick={() => applyPreset(key)}>
                    {PRESET_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-section">
              <h4 className="form-section-title">显示选项</h4>
              <label className="form-label">
                <input
                  type="checkbox"
                  checked={showEigenvectors}
                  onChange={(e) => setShowEigenvectors(e.target.checked)}
                />
                特征向量
              </label>
              <label className="form-label">
                <input
                  type="checkbox"
                  checked={showDeterminant}
                  onChange={(e) => setShowDeterminant(e.target.checked)}
                />
                行列式信息
              </label>
            </div>
          </ControlPanel>
        }
        visualization={
          <>
            {error && <ErrorState message={error} />}
            {loading && !data && <LoadingState text="正在计算可视化数据..." />}
            {data && (
              <VisualizationCard
                title="2×2 矩阵变换可视化"
                subtitle="拖动图表可平移，滚轮可缩放"
                loading={loading}
              >
                <div style={{ position: 'absolute', inset: 0, padding: 'var(--space-2)' }}>
                  <Plot
                    data={buildPlotData()}
                    layout={layout}
                    config={{ responsive: true, scrollZoom: true }}
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              </VisualizationCard>
            )}
            {!data && !loading && (
              <div className="empty-state">
                <div className="empty-state-icon">🔢</div>
                <p>输入矩阵参数或选择预设，开始探索线性变换</p>
              </div>
            )}
          </>
        }
        infoPanels={
          data ? (
            <>
              {showDeterminant && data.determinant && (
                <CollapsibleSection title="行列式信息" defaultExpanded={true} variant="success">
                  <div className="info-item">
                    <span>det(A)</span>
                    <span>{data.determinant.value.toFixed(3)}</span>
                  </div>
                  <div className="info-item">
                    <span>解释</span>
                    <span>{data.determinant.interpretation}</span>
                  </div>
                </CollapsibleSection>
              )}

              {showEigenvectors && data.eigenvectors && data.eigenvectors.length > 0 && (
                <CollapsibleSection title="特征值与特征向量" defaultExpanded={true}>
                  {data.eigenvectors.map((ev, idx) => (
                    <div key={idx} className="info-item">
                      <span>
                        λ{idx + 1} = {ev.lambda.toFixed(3)}
                      </span>
                      <span>
                        v{idx + 1} = [{ev.v[0].toFixed(3)}, {ev.v[1].toFixed(3)}]
                      </span>
                    </div>
                  ))}
                </CollapsibleSection>
              )}

              {showEigenvectors && (!data.eigenvectors || data.eigenvectors.length === 0) && (
                <CollapsibleSection title="特征值" defaultExpanded={true}>
                  <p>
                    λ₁ = {formatEigenValue(data.eigenvalues[0])}, λ₂ ={' '}
                    {formatEigenValue(data.eigenvalues[1])}
                    <br />
                    <span style={{ color: 'var(--text-secondary)' }}>(复特征值，无实特征向量)</span>
                  </p>
                </CollapsibleSection>
              )}

              <CollapsibleSection title="图例说明" defaultExpanded={false}>
                <p>
                  <span style={{ color: '#94a3b8' }}>···</span> 原始单位圆/网格
                  <br />
                  <span style={{ color: '#10b981' }}>●</span> 变换后的椭圆
                  <br />
                  <span style={{ color: '#ef4444' }}>—</span> 变换后 x 方向基向量 (e₁ →)
                  <br />
                  <span style={{ color: '#3b82f6' }}>—</span> 变换后 y 方向基向量 (e₂ →)
                  <br />
                  <span style={{ color: '#8b5cf6' }}>--</span> 特征向量方向
                </p>
              </CollapsibleSection>
            </>
          ) : null
        }
      />
    </div>
  )
}
