import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Plot from '../components/Plot'
import { hotspotsApi, BRANCH_LABELS, type HotspotDetail as Detail } from '../services/api/hotspots'
import { getApiErrorMessage } from '../services/api/client'
import { renderLatex, createMarkup } from '../utils/latex'
import './Hotspots.css'

export default function HotspotDetail() {
  const { id } = useParams<{ id: string }>()
  const [item, setItem] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setShowAnswer(false)
    hotspotsApi.get(id)
      .then((res) => {
        if (cancelled) return
        if (res.success) { setItem(res.data); setError(null) }
        else setError(res.error || '未找到这篇解读')
      })
      .catch((err) => {
        if (cancelled) return
        const msg = getApiErrorMessage(err, '加载失败，请稍后重试')
        setError(msg.includes('未找到') ? msg : '加载失败，请稍后重试')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  if (loading) return <div className="hotspots-page"><p className="hotspots-status">正在加载解读…</p></div>
  if (error || !item) {
    return (
      <div className="hotspots-page">
        <p className="hotspots-status error" role="alert">{error || '未找到内容'}</p>
        <Link to="/hotspots" className="hotspot-back">← 返回数说热点</Link>
      </div>
    )
  }

  return (
    <article className="hotspots-page hotspot-detail">
      <Link to="/hotspots" className="hotspot-back">← 返回数说热点</Link>

      <header className="hotspot-detail-header">
        <div className="hotspot-detail-meta">
          <span className="hotspot-card-category">{item.category}</span>
          <span>{item.date}</span>
          <span aria-hidden="true">·</span>
          <span>{BRANCH_LABELS[item.branch] ?? item.branch}</span>
          <span aria-hidden="true">·</span>
          <span>{item.topic}</span>
        </div>
        <h1>{item.headline}</h1>
        <p className="hotspot-detail-question">“{item.question}”</p>
        <p className="hotspot-detail-summary">{item.summary}</p>
      </header>

      <section className="hotspot-section" aria-labelledby="math-link">
        <h2 id="math-link">数学从哪里进来</h2>
        <p className="hotspot-concept-line">核心概念：<strong>{item.concept}</strong></p>
        <div
          className="hotspot-formula"
          dangerouslySetInnerHTML={createMarkup(renderLatex(item.formula, { displayMode: true }))}
        />
        <p className="hotspot-formula-note">{item.formula_note}</p>
      </section>

      <section className="hotspot-section" aria-labelledby="steps-title">
        <h2 id="steps-title">一步步看明白</h2>
        <div className="hotspot-steps">
          {item.steps.map((step) => (
            <div key={step.title} className="hotspot-step">
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="hotspot-section" aria-labelledby="figure-title">
        <h2 id="figure-title">亲眼看一下</h2>
        <div className="hotspot-figure">
          <Plot
            data={item.figure.data as never}
            layout={item.figure.layout as never}
            config={{ responsive: true, displayModeBar: false }}
            exportName={`数说热点-${item.topic}`}
          />
        </div>
        <p className="hotspot-figure-caption">图：{item.figure_caption}</p>
      </section>

      <section className="hotspot-insight" aria-label="一句话结论">
        <span aria-hidden="true">✦</span>
        <p>{item.insight}</p>
      </section>

      <section className="hotspot-section" aria-labelledby="try-title">
        <h2 id="try-title">轮到你了</h2>
        <p className="hotspot-try-question">{item.try_it.text}</p>
        <button
          type="button"
          className="hotspot-answer-toggle"
          onClick={() => setShowAnswer((v) => !v)}
          aria-expanded={showAnswer}
        >
          {showAnswer ? '收起参考答案' : '看看参考答案'}
        </button>
        {showAnswer && <div className="hotspot-answer">{item.try_it.answer}</div>}
      </section>

      {(item.modules.length > 0 || item.concepts.length > 0) && (
        <section className="hotspot-section" aria-labelledby="go-title">
          <h2 id="go-title">接着往下探索</h2>
          <div className="hotspot-links">
            {item.modules.map((path) => (
              <Link key={path} to={path} className="hotspot-link">
                打开对应实验 <span aria-hidden="true">→</span> <code>{path}</code>
              </Link>
            ))}
            <Link to="/knowledge-map" className="hotspot-link">
              在知识图谱中查看相关概念 <span aria-hidden="true">→</span>
            </Link>
          </div>
          <p className="hotspot-concepts">关联概念：{item.concepts.join(' · ')}</p>
        </section>
      )}

      <footer className="hotspot-detail-footer">
        <p>事件来源：{item.source}</p>
        <p>内容说明：事件描述来自公开报道，数学解释与图为教学演示用途。</p>
      </footer>
    </article>
  )
}
