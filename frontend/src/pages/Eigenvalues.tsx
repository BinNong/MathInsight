import { useCallback, useEffect, useState } from 'react'
import type { Data } from 'plotly.js'
import Plot from '../components/Plot'
import PageHeader from '../components/PageHeader'
import ControlPanel from '../components/ControlPanel'
import VisualizationCard from '../components/VisualizationCard'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import VisualizationWorkspace from '../components/VisualizationWorkspace'
import CollapsibleSection from '../components/CollapsibleSection'
import './ExperimentShared.css'
import { advancedApi, EigenData } from '../services/api'

const PRESETS = [
  { name: '伸缩变换', m: [[2, 0], [0, 1]] as [[number, number], [number, number]], v: [1, 1] as [number, number] },
  { name: '剪切变换', m: [[1, 1], [0, 1]] as [[number, number], [number, number]], v: [1, 0] as [number, number] },
  { name: '旋转 90°', m: [[0, -1], [1, 0]] as [[number, number], [number, number]], v: [1, 0] as [number, number] },
  { name: '反射 + 伸缩', m: [[2, 1], [1, 2]] as [[number, number], [number, number]], v: [1, 1] as [number, number] },
] as const

export default function Eigenvalues() {
  const [matrix, setMatrix] = useState<[[number, number], [number, number]]>([[2, 1], [1, 2]])
  const [vector, setVector] = useState<[number, number]>([1, 1])
  const [data, setData] = useState<EigenData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await advancedApi.eigenvalues({ matrix, vector })
      if (res.success) setData(res.data)
      else setError(res.error || '计算失败')
    } catch {
      setError('无法连接到服务器')
    } finally {
      setLoading(false)
    }
  }, [matrix, vector])

  useEffect(() => { generate() }, [generate])

  const setM = (r: number, c: number, v: number) => {
    setMatrix((prev) => prev.map((row, i) => i === r ? row.map((x, j) => j === c ? v : x) as [number, number] : row) as [[number, number], [number, number]])
  }

  // 单位圆在变换后的像（用于展示几何效果）
  const circlePoints = (transform: (x: number, y: number) => [number, number]) => {
    const xs: number[] = [], ys: number[] = []
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * 2 * Math.PI
      const [x, y] = transform(Math.cos(t), Math.sin(t))
      xs.push(x); ys.push(y)
    }
    return { xs, ys }
  }

  const plotData: Data[] = data
    ? (() => {
        const [[a, b], [c, d]] = matrix
        const circle = circlePoints((x, y) => [a * x + b * y, c * x + d * y])
        const traces: Data[] = [{
          x: circle.xs, y: circle.ys,
          type: 'scatter', mode: 'lines',
          name: '变换后的单位圆',
          line: { color: '#9c3b2e', width: 2 },
        }]
        data.eigenpairs.forEach((pair, i) => {
          const [vx, vy] = pair.vector
          if (Math.abs(pair.eigenvalue_imag) > 1e-6) return
          const color = ['#2f5d62', '#8a6d3b', '#7c3aed'][i % 3]
          traces.push({
            x: [-2 * vx, 2 * vx], y: [-2 * vy, 2 * vy],
            type: 'scatter', mode: 'lines',
            name: `特征向量 λ=${pair.eigenvalue_real.toFixed(2)}`,
            line: { color, width: 2, dash: 'dash' },
          })
          traces.push({
            x: [2 * pair.eigenvalue_real * vx], y: [2 * pair.eigenvalue_real * vy],
            type: 'scatter', mode: 'markers',
            name: `变换后 λv ${i + 1}`,
            marker: { color, size: 10, symbol: 'diamond' },
            showlegend: false,
          })
        })
        if (data.vector && data.transformed) {
          traces.push({
            x: [0, data.vector[0]], y: [0, data.vector[1]],
            type: 'scatter', mode: 'lines+markers',
            name: '你的向量 v',
            line: { color: '#2563eb', width: 3 },
            marker: { size: 9 },
          })
          traces.push({
            x: [0, data.transformed[0]], y: [0, data.transformed[1]],
            type: 'scatter', mode: 'lines+markers',
            name: 'Av',
            line: { color: '#dc2626', width: 3, dash: 'dot' },
            marker: { size: 9 },
          })
        }
        return traces
      })()
    : []

  return (
    <div className="experiment-page">
      <PageHeader title="线性代数 · 特征值与特征向量" backTo="/subject/linear-algebra" backLabel="返回线性代数" />
      <p className="experiment-lead">
        大多数向量在矩阵变换下会改变方向，但特征向量只被拉伸或压缩：Av = λv。这个实验让你同时看到特征方向、特征值和变换的几何效果。
      </p>

      <VisualizationWorkspace
        visualizationTitle="特征值几何"
        controls={
          <ControlPanel title="矩阵与向量" subtitle="调整 2×2 矩阵，观察特征方向">
            <div className="form-section">
              <h4 className="form-section-title">预设</h4>
              <div className="preset-chips">
                {PRESETS.map((p) => (
                  <button key={p.name} type="button"
                    className={`preset-chip ${matrix[0][0] === p.m[0][0] && matrix[1][1] === p.m[1][1] ? 'active' : ''}`}
                    onClick={() => { setMatrix(p.m); setVector(p.v) }}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-section">
              <h4 className="form-section-title">矩阵 A</h4>
              <div className="matrix-input-grid">
                {[0, 1].map((r) => [0, 1].map((c) => (
                  <input key={`${r}-${c}`} type="number" step="0.1"
                    value={matrix[r][c]}
                    aria-label={`矩阵第${r + 1}行第${c + 1}列`}
                    onChange={(e) => setM(r, c, Number(e.target.value))} />
                )))}
              </div>
            </div>

            <div className="form-section">
              <h4 className="form-section-title">测试向量 v = (x, y)</h4>
              <div className="matrix-input-grid two-col">
                <input type="number" step="0.1" value={vector[0]} aria-label="向量 x" onChange={(e) => setVector([Number(e.target.value), vector[1]])} />
                <input type="number" step="0.1" value={vector[1]} aria-label="向量 y" onChange={(e) => setVector([vector[0], Number(e.target.value)])} />
              </div>
            </div>
          </ControlPanel>
        }
        visualization={
          <>
            {error && <ErrorState message={error} />}
            {loading && !data && <LoadingState text="正在分析矩阵..." />}
            {data && (
              <VisualizationCard
                title="空间变换与特征方向"
                subtitle="虚线是特征向量方向，菱形是特征向量被变换后的位置"
                loading={loading}
              >
                <div className="visualization-plot-wrapper">
                  <Plot
                    data={plotData}
                    layout={{
                      title: { text: `A = [[${matrix[0][0]}, ${matrix[0][1]}], [${matrix[1][0]}, ${matrix[1][1]}]]`, font: { size: 16 } },
                      xaxis: { title: { text: 'x' }, range: [-4, 4], zeroline: true, scaleanchor: 'y' },
                      yaxis: { title: { text: 'y' }, range: [-4, 4], zeroline: true },
                      showlegend: true,
                      legend: { x: 0.02, y: 0.98 },
                      hovermode: 'closest',
                      margin: { t: 60, r: 40, b: 60, l: 60 },
                    }}
                    config={{ responsive: true, scrollZoom: true }}
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              </VisualizationCard>
            )}
          </>
        }
        infoPanels={
          data ? (
            <>
              <CollapsibleSection title="特征值" defaultExpanded>
                <div className="info-grid">
                  <div className="info-item"><span>特征多项式</span><span>{data.characteristic}</span></div>
                  <div className="info-item"><span>行列式 det(A)</span><span>{data.determinant.toFixed(4)}</span></div>
                  <div className="info-item"><span>迹 tr(A)</span><span>{data.trace.toFixed(4)}</span></div>
                  {data.eigenpairs.map((p, i) => (
                    <div className="info-item" key={i}>
                      <span>λ{i + 1}</span>
                      <span>{p.eigenvalue_real.toFixed(4)}{Math.abs(p.eigenvalue_imag) > 1e-6 ? ` + ${p.eigenvalue_imag.toFixed(4)}i` : ''}，v=({p.vector[0].toFixed(2)}, {p.vector[1].toFixed(2)})</span>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
              <CollapsibleSection title="你的向量" defaultExpanded>
                {data.transformed ? (
                  <div className="info-grid">
                    <div className="info-item"><span>v</span><span>({data.vector?.map((x) => x.toFixed(2)).join(', ')})</span></div>
                    <div className="info-item"><span>Av</span><span>({data.transformed.map((x) => x.toFixed(2)).join(', ')})</span></div>
                    <div className="info-item"><span>伸缩倍数</span><span>{data.scaling?.toFixed(4) ?? '方向改变'}</span></div>
                    <div className="info-item"><span>是否为特征向量</span><span>{data.is_eigenvector ? '是 ✓' : '否'}</span></div>
                  </div>
                ) : null}
              </CollapsibleSection>
            </>
          ) : null
        }
      />
    </div>
  )
}
