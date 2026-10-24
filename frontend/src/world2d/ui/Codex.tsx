import { useEffect, useMemo } from 'react'
import { useWorld2DStore, useMasteryStore, masteryLevel, MASTERY_LABEL } from '../store'
import { HALLS, TOPICS, QUESTION_BANK } from '../data/questions'

/** 修炼手札：知识点掌握度 + 战绩 + 错题本（Tab 开关） */
export default function Codex() {
  const codex = useWorld2DStore((s) => s.codex)
  const setCodex = useWorld2DStore((s) => s.setCodex)
  const topics = useMasteryStore((s) => s.topics)
  const sessions = useMasteryStore((s) => s.sessions)
  const bestStreak = useMasteryStore((s) => s.bestStreak)
  const maxMpBonus = useMasteryStore((s) => s.maxMpBonus)
  const maxHpBonus = useMasteryStore((s) => s.maxHpBonus)
  const mastered = useMasteryStore((s) => s.mastered)

  useEffect(() => {
    if (!codex) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') setCodex(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [codex, setCodex])

  const { totalAnswered, totalCorrect, wrongList } = useMemo(() => {
    let answered = 0
    let correct = 0
    const wrongs: { topic: string; q: (typeof QUESTION_BANK)[number] }[] = []
    for (const t of TOPICS) {
      const p = topics[t.id]
      if (!p) continue
      answered += p.answered
      correct += p.correct
      for (const id of p.wrong) {
        const q = QUESTION_BANK.find((b) => b.id === id)
        if (q) wrongs.push({ topic: t.name, q })
      }
    }
    return { totalAnswered: answered, totalCorrect: correct, wrongList: wrongs }
  }, [topics])

  if (!codex) return null

  return (
    <div className="world2d-quiz-wrap">
      <div className="world2d-quiz world2d-codex">
        <div className="world2d-quiz-head">
          <span className="world2d-quiz-badge">📖 修炼手札 · 微积分</span>
          <button className="world2d-x" onClick={() => setCodex(false)}>✕</button>
        </div>

        <div className="world2d-codex-stats">
          <span>修炼 {sessions} 组</span>
          <span>答题 {totalAnswered} 道</span>
          <span>正确率 {totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0}%</span>
          <span>最佳连对 {bestStreak}</span>
          <span>精通 {mastered.length}/{TOPICS.length}</span>
          {maxHpBonus > 0 && <span className="world2d-codex-bonus">生命上限 +{maxHpBonus}</span>}
          {maxMpBonus > 0 && <span className="world2d-codex-bonus">灵感上限 +{maxMpBonus}</span>}
        </div>

        <div className="world2d-codex-scroll">
          {(Object.keys(HALLS) as (keyof typeof HALLS)[]).map((hid) => (
            <div key={hid} className="world2d-codex-hall">
              <div className="world2d-codex-hall-name">{HALLS[hid].name}</div>
              {TOPICS.filter((t) => t.hall === hid).map((t) => {
                const p = topics[t.id]
                const lv = masteryLevel(p)
                const pct = p && p.answered > 0 ? (p.correct / p.answered) * 100 : 0
                return (
                  <div key={t.id} className="world2d-codex-topic">
                    <div className="world2d-codex-topic-head">
                      <span>{t.name}</span>
                      <span className={`world2d-topic-lv lv${lv}`}>{MASTERY_LABEL[lv]}</span>
                    </div>
                    <div className="world2d-codex-bar">
                      <div className={`world2d-codex-bar-fill lv${lv}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="world2d-codex-topic-meta">
                      {p ? `${p.correct}/${p.answered} 正确` : '尚未答题'}
                      {p && p.wrong.length > 0 ? ` · ${p.wrong.length} 道错题` : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          <div className="world2d-codex-hall">
            <div className="world2d-codex-hall-name">错题本（{wrongList.length}）</div>
            {wrongList.length === 0 && <div className="world2d-codex-empty">暂无错题，保持！</div>}
            {wrongList.map(({ topic, q }) => (
              <div key={q.id} className="world2d-wrong">
                <div className="world2d-wrong-topic">{topic}</div>
                <div className="world2d-wrong-q">{q.q}</div>
                <div className="world2d-wrong-a">正解：{q.options[q.answer]}</div>
                <div className="world2d-wrong-e">{q.explain}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="world2d-quiz-tip">Tab / Esc 关闭 · 答对曾经的错题会自动将其移出错题本</p>
      </div>
    </div>
  )
}
