import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { hotspotsApi, BRANCH_LABELS, type HotspotSummary, type HotspotMeta } from '../services/api/hotspots'
import './Hotspots.css'

const BRANCH_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'calculus', label: '微积分' },
  { key: 'linear-algebra', label: '线性代数' },
  { key: 'probability', label: '概率统计' },
  { key: 'statistics', label: '数据统计' },
]

function formatDate(date: string): string {
  const parts = date.split('-')
  return parts.length === 3 ? `${parts[1]}月${parts[2]}日` : date
}

export default function Hotspots() {
  const [items, setItems] = useState<HotspotSummary[]>([])
  const [meta, setMeta] = useState<HotspotMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [branch, setBranch] = useState('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [listRes, metaRes] = await Promise.all([hotspotsApi.list(), hotspotsApi.meta()])
        if (cancelled) return
        if (listRes.success) setItems(listRes.data.items)
        if (metaRes.success) setMeta(metaRes.data)
        setError(null)
      } catch {
        if (!cancelled) setError('加载失败，请稍后重试')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((it) => {
      if (branch !== 'all' && it.branch !== branch) return false
      if (!q) return true
      return (it.headline + it.summary + it.tags.join(' ')).toLowerCase().includes(q)
    })
  }, [items, branch, query])

  return (
    <div className="hotspots-page">
      <header className="hotspots-header">
        <p className="hotspots-eyebrow">MATH MEETS THE MOMENT · 数说热点</p>
        <h1>新闻里藏着数学题</h1>
        <p className="hotspots-lead">
          每周精选真实发生的科技、体育与生活事件，用微积分、线性代数和概率论拆开看一眼。
          每条解读都配一张可交互的图、一个思考试题，还有通往对应实验的入口。
        </p>
        <div className="hotspots-header-meta">
          <span>{meta?.total ?? items.length} 篇解读</span>
          <span aria-hidden="true">·</span>
          <span>每周更新 2–3 篇</span>
          {meta?.latest_date && (
            <>
              <span aria-hidden="true">·</span>
              <span>最新 {formatDate(meta.latest_date)}</span>
            </>
          )}
        </div>
      </header>

      <div className="hotspots-controls">
        <div className="hotspots-filters" role="group" aria-label="按数学分支筛选">
          {BRANCH_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`hotspots-filter ${branch === f.key ? 'active' : ''}`}
              onClick={() => setBranch(f.key)}
              aria-pressed={branch === f.key}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="hotspots-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索标题、话题或标签"
            aria-label="搜索热点解读"
          />
        </label>
      </div>

      {loading && <p className="hotspots-status">正在加载解读…</p>}
      {error && <p className="hotspots-status error" role="alert">{error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <p className="hotspots-status">这个筛选下还没有解读，换个条件试试。</p>
      )}

      {filtered.length > 0 && (
        <div className="hotspots-grid">
          {filtered.map((it, idx) => (
            <Link key={it.id} to={`/hotspots/${it.id}`} className="hotspot-card">
              <div className="hotspot-card-top">
                <span className="hotspot-card-index">{String(idx + 1).padStart(2, '0')}</span>
                <span className="hotspot-card-category">{it.category}</span>
                <span className="hotspot-card-date">{formatDate(it.date)}</span>
              </div>
              <h2>{it.headline}</h2>
              <p className="hotspot-card-summary">{it.summary}</p>
              <div className="hotspot-card-tags">
                <span className="hotspot-card-branch">{BRANCH_LABELS[it.branch] ?? it.branch}</span>
                {it.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="hotspot-card-tag">{tag}</span>
                ))}
              </div>
              <span className="hotspot-card-more">读解读 <span aria-hidden="true">→</span></span>
            </Link>
          ))}
        </div>
      )}

      <footer className="hotspots-footer">
        <p>内容由数学推理驱动，事件描述来自公开报道；图为教学示意，非精确统计数据。</p>
        <Link to="/">← 返回首页</Link>
      </footer>
    </div>
  )
}
