import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Network } from 'vis-network'
import { DataSet } from 'vis-data'
import {
  knowledgeGraphApi,
  ConceptNode,
  ConceptDetail,
  LearningPath,
} from '../services/api/knowledgeGraph'
import { renderLatex, createMarkup } from '../utils/latex'

interface GraphData {
  subjects: Record<string, { name: string; color: string }>
  nodes: ConceptNode[]
  edges: { source: string; target: string; reason: string; strength: number }[]
}

const SUBJECT_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'foundation', label: '预备知识' },
  { key: 'calculus', label: '微积分' },
  { key: 'linear-algebra', label: '线性代数' },
  { key: 'probability', label: '概率统计' },
]

const DIFFICULTY_LABELS = ['', '基础', '入门', '进阶', '提高', '挑战']

export default function KnowledgeMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)

  const [graph, setGraph] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [conceptDetail, setConceptDetail] = useState<ConceptDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeSubject, setActiveSubject] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [learningPath, setLearningPath] = useState<LearningPath | null>(null)

  // 加载完整图谱
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const res = await knowledgeGraphApi.getGraph()
        if (cancelled) return
        if (res.success) {
          setGraph(res.data)
        } else {
          setError(res.error || '加载知识图谱失败')
        }
      } catch (e) {
        if (!cancelled) setError('网络错误，请稍后重试')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // 加载选中概念详情
  useEffect(() => {
    if (!selectedId) {
      setConceptDetail(null)
      return
    }
    const conceptId = selectedId
    let cancelled = false
    async function loadDetail() {
      try {
        setDetailLoading(true)
        const res = await knowledgeGraphApi.getConcept(conceptId)
        if (cancelled) return
        if (res.success) {
          setConceptDetail(res.data)
        }
      } catch {
        // 详情加载失败静默处理
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }
    loadDetail()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  // 构建 vis-network 数据
  const { visNodes, visEdges } = useMemo(() => {
    if (!graph) return { visNodes: [], visEdges: [] }

    const subjectFilter = activeSubject === 'all' ? null : activeSubject
    const query = (searchQuery || '').trim().toLowerCase()

    const visibleIds = new Set<string>()

    const nodes = graph.nodes
      .filter((n) => {
        if (subjectFilter && n.subject !== subjectFilter) return false
        if (
          query &&
          !n.name.toLowerCase().includes(query) &&
          !n.tags.some((t) => t.toLowerCase().includes(query))
        ) {
          return false
        }
        return true
      })
      .map((n) => {
        visibleIds.add(n.id)
        const subject = graph.subjects[n.subject]
        return {
          id: n.id,
          label: n.name,
          title: `${n.name}<br/>${n.description.slice(0, 60)}${n.description.length > 60 ? '...' : ''}`,
          color: {
            background: subject?.color || '#6b7280',
            border: subject?.color || '#6b7280',
            highlight: { background: '#4f46e5', border: '#4f46e5' },
            hover: { background: '#4f46e5', border: '#4f46e5' },
          },
          font: { color: '#1f2937', size: 14, face: 'system-ui' },
          shape: 'dot',
          size: 18 + n.difficulty * 2,
          borderWidth: 2,
          shadow: { enabled: true, color: 'rgba(0,0,0,0.15)', size: 8, x: 0, y: 2 },
        }
      })

    const edges = graph.edges
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map((e) => ({
        from: e.source,
        to: e.target,
        title: e.reason,
        width: e.strength,
        color: { color: '#9ca3af', highlight: '#4f46e5', hover: '#4f46e5', opacity: 0.7 },
        arrows: { to: { enabled: true, scaleFactor: 0.6 } },
        smooth: { type: 'continuous' as const },
      }))

    return { visNodes: nodes, visEdges: edges }
  }, [graph, activeSubject, searchQuery])

  // 初始化/更新 vis-network
  useEffect(() => {
    if (!containerRef.current || visNodes.length === 0) return

    if (networkRef.current) {
      networkRef.current.destroy()
      networkRef.current = null
    }

    const network = new Network(
      containerRef.current,
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodes: new DataSet(visNodes as any),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        edges: new DataSet(visEdges as any),
      } as unknown as never,
      {
        nodes: {
          borderWidth: 2,
          shadow: true,
        },
        edges: {
          color: { inherit: false },
          smooth: { enabled: true, type: 'continuous', roundness: 0.5 },
        },
        physics: {
          stabilization: { iterations: 120 },
          barnesHut: {
            gravitationalConstant: -3000,
            centralGravity: 0.25,
            springLength: 120,
            springConstant: 0.04,
            damping: 0.09,
          },
        },
        interaction: {
          hover: true,
          tooltipDelay: 150,
          zoomView: true,
          dragView: true,
          navigationButtons: true,
          keyboard: true,
        },
        layout: {
          improvedLayout: true,
        },
      }
    )

    network.on('click', (params) => {
      if (params.nodes && params.nodes.length > 0) {
        setSelectedId(String(params.nodes[0]))
      } else {
        setSelectedId(null)
      }
    })

    network.on('stabilizationIterationsDone', () => {
      // 延迟 fit，确保容器已完成 flex 布局
      window.setTimeout(() => network.fit(), 100)
    })

    networkRef.current = network

    return () => {
      network.destroy()
      networkRef.current = null
    }
  }, [visNodes, visEdges])

  // 高亮学习路径
  useEffect(() => {
    if (!networkRef.current || !learningPath || !graph) return
    const pathIds = learningPath.path.map((p) => p.id)
    networkRef.current.selectNodes(pathIds, false)
    if (pathIds.length > 0) {
      networkRef.current.focus(pathIds[pathIds.length - 1], {
        scale: 1.1,
        animation: { duration: 500, easingFunction: 'easeInOutQuad' as const },
      })
    }
  }, [learningPath, graph])

  const handleLoadPath = useCallback(async () => {
    if (!selectedId) return
    try {
      const res = await knowledgeGraphApi.getLearningPath(selectedId)
      if (res.success) {
        setLearningPath(res.data)
      }
    } catch {
      // 静默失败
    }
  }, [selectedId])

  const filteredConcepts = useMemo(() => {
    if (!graph) return []
    const query = searchQuery.trim().toLowerCase()
    if (!query) return []
    return graph.nodes
      .filter(
        (n) =>
          n.name.toLowerCase().includes(query) ||
          n.tags.some((t) => t.toLowerCase().includes(query))
      )
      .slice(0, 8)
  }, [graph, searchQuery])

  if (loading) {
    return (
      <div className="knowledge-map-page">
        <div className="knowledge-map-loading">
          <div className="spinner" />
          <p>正在构建知识图谱...</p>
        </div>
      </div>
    )
  }

  if (error || !graph) {
    return (
      <div className="knowledge-map-page">
        <div className="knowledge-map-error">
          <p>{error || '图谱数据不可用'}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            重新加载
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="knowledge-map-page">
      <header className="knowledge-map-header">
        <div className="knowledge-map-header-left">
          <Link to="/" className="back-link">
            ← 返回首页
          </Link>
          <h1>高等数学知识图谱</h1>
          <p>探索概念之间的前置关系，规划你的学习路径</p>
        </div>
        <div className="knowledge-map-header-right">
          <Link to="/solver" className="btn btn-secondary btn-sm">
            解题助手
          </Link>
        </div>
      </header>

      <div className="knowledge-map-toolbar">
        <div className="subject-filters">
          {SUBJECT_FILTERS.map((f) => (
            <button
              key={f.key}
              className={`filter-chip ${activeSubject === f.key ? 'active' : ''}`}
              onClick={() => setActiveSubject(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="search-box">
          <input
            type="text"
            placeholder="搜索概念或标签..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && filteredConcepts.length > 0 && (
            <ul className="search-suggestions">
              {filteredConcepts.map((c) => (
                <li
                  key={c.id}
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedId(c.id)
                    if (networkRef.current) {
                      networkRef.current.focus(c.id, {
                        scale: 1.2,
                        animation: { duration: 400, easingFunction: 'easeInOutQuad' as const },
                      })
                    }
                  }}
                >
                  {c.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="knowledge-map-body">
        <div className="knowledge-map-canvas" ref={containerRef} />

        <aside className={`knowledge-map-sidebar ${selectedId ? 'open' : ''}`}>
          {!selectedId ? (
            <div className="sidebar-empty">
              <div className="sidebar-empty-icon">🗺️</div>
              <p>点击图谱中的节点</p>
              <span>查看概念详情、前置知识与推荐可视化</span>
            </div>
          ) : detailLoading || !conceptDetail ? (
            <div className="sidebar-loading">
              <div className="spinner" />
            </div>
          ) : (
            <div className="sidebar-content">
              <div className="sidebar-header">
                <span
                  className="subject-badge"
                  style={{ background: graph.subjects[conceptDetail.subject]?.color || '#6b7280' }}
                >
                  {graph.subjects[conceptDetail.subject]?.name || conceptDetail.subject}
                </span>
                <span className="difficulty-badge">
                  难度 {conceptDetail.difficulty} · {DIFFICULTY_LABELS[conceptDetail.difficulty]}
                </span>
              </div>

              <h2>{conceptDetail.name}</h2>
              <p className="concept-description">{conceptDetail.description}</p>

              {conceptDetail.formula && (
                <div
                  className="concept-formula"
                  dangerouslySetInnerHTML={createMarkup(
                    renderLatex(conceptDetail.formula, { displayMode: true })
                  )}
                />
              )}

              {conceptDetail.visualizations.length > 0 && (
                <div className="sidebar-section">
                  <h3>关联可视化</h3>
                  <div className="visualization-links">
                    {conceptDetail.visualizations.map((v) => (
                      <Link key={v.path} to={v.path} className="viz-link">
                        {v.label} →
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="sidebar-actions">
                <button className="btn btn-primary btn-sm" onClick={handleLoadPath}>
                  查看学习路径
                </button>
                <Link
                  to="/solver"
                  state={{ topic: conceptDetail.id, name: conceptDetail.name }}
                  className="btn btn-secondary btn-sm"
                >
                  练习题目
                </Link>
              </div>

              {learningPath && selectedId === learningPath.goal_id && (
                <div className="sidebar-section learning-path">
                  <h3>到「{learningPath.goal_name}」的学习路径</h3>
                  <ol>
                    {learningPath.path.map((item, idx) => (
                      <li key={item.id}>
                        <span className="path-index">{idx + 1}</span>
                        <span className="path-name">{item.name}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {conceptDetail.prerequisites.length > 0 && (
                <div className="sidebar-section">
                  <h3>前置知识</h3>
                  <ul className="related-list">
                    {conceptDetail.prerequisites.map((p) => (
                      <li key={p.id}>
                        <button
                          className="related-link"
                          onClick={() => {
                            setSelectedId(p.id)
                            if (networkRef.current) {
                              networkRef.current.focus(p.id, {
                                scale: 1.1,
                                animation: {
                                  duration: 400,
                                  easingFunction: 'easeInOutQuad' as const,
                                },
                              })
                            }
                          }}
                        >
                          {p.name}
                        </button>
                        <span className="related-reason">{p.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {conceptDetail.next_concepts.length > 0 && (
                <div className="sidebar-section">
                  <h3>后续概念</h3>
                  <ul className="related-list">
                    {conceptDetail.next_concepts.map((n) => (
                      <li key={n.id}>
                        <button
                          className="related-link"
                          onClick={() => {
                            setSelectedId(n.id)
                            if (networkRef.current) {
                              networkRef.current.focus(n.id, {
                                scale: 1.1,
                                animation: {
                                  duration: 400,
                                  easingFunction: 'easeInOutQuad' as const,
                                },
                              })
                            }
                          }}
                        >
                          {n.name}
                        </button>
                        <span className="related-reason">{n.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="sidebar-footer">
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedId(null)}>
                  关闭侧边栏
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      <div className="knowledge-map-legend">
        {Object.entries(graph.subjects).map(([key, s]) => (
          <div key={key} className="legend-item">
            <span className="legend-dot" style={{ background: s.color }} />
            <span>{s.name}</span>
          </div>
        ))}
        <div className="legend-hint">拖拽移动 · 滚轮缩放 · 点击节点查看详情</div>
      </div>
    </div>
  )
}
