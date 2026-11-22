import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { MASTERY_LABEL, useMasteryStore } from '../world2d/store'
import { QUESTION_BANK, TOPICS, type BankQuestion } from '../world2d/data/questions'
import { formatDueAt, useReviewStore } from '../stores/reviewStore'
import {
  topicMastery,
  useMasteryTopics,
  type ConceptMastery,
} from '../services/learning'
import './PracticePage.css'

const DIFFICULTY_LABEL = ['', '基础', '进阶', '挑战']

const SUBJECT_GROUPS = [
  { id: 'calculus', name: '微积分', halls: ['limit', 'derivative', 'integral'] },
  { id: 'linear-algebra', name: '线性代数', halls: ['linear-algebra'] },
  { id: 'probability', name: '概率统计', halls: ['probability'] },
] as const

export default function PracticePage() {
  const [params, setParams] = useSearchParams()
  const mode = params.get('mode') === 'review' ? 'review' : 'normal'
  const topicId = params.get('topic') || TOPICS[0].id
  const topics = useMasteryTopics()
  const record = useMasteryStore((s) => s.record)
  const reviewEntries = useReviewStore((s) => s.entries)
  const reviewRecord = useReviewStore((s) => s.record)

  const [currentId, setCurrentId] = useState<string | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  // 答过的题冻结显示：复习模式下答对会立刻移出队列，避免反馈跳到别的题
  const [answered, setAnswered] = useState<{ q: BankQuestion; topicId: string } | null>(null)
  const [session, setSession] = useState({ answered: 0, correct: 0 })

  const topic = TOPICS.find((t) => t.id === topicId) || TOPICS[0]

  // 复习模式：错题 + 到期题，跨全部知识点
  const reviewQueue = useMemo(() => {
    const withTopic = QUESTION_BANK.map((q) => ({ q, topicId: q.topic }))
    return withTopic.filter(({ q, topicId: tid }) => {
      const inWrong = (topics[tid]?.wrong ?? []).includes(q.id)
      const entry = reviewEntries[q.id]
      const due = !entry || entry.streak === 0 || entry.dueAt <= Date.now()
      return inWrong || due
    })
  }, [topics, reviewEntries])

  const questions: Array<{ q: BankQuestion; topicId: string }> = useMemo(
    () => (mode === 'review'
      ? reviewQueue
      : QUESTION_BANK.filter((q) => q.topic === topic.id).map((q) => ({ q, topicId: q.topic }))),
    [mode, reviewQueue, topic.id]
  )
  const queueCurrent = questions.find((it) => it.q.id === currentId) || questions[0]
  // 答题后冻结题目，防止复习模式下该题移出队列导致反馈错位
  const current = picked !== null && answered ? answered : queueCurrent
  const mastery: ConceptMastery = topicMastery(topic.id, topics)
  const jumpRef = useRef<HTMLInputElement>(null)

  const selectTopic = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('topic', id)
    next.delete('mode')
    setParams(next)
    setCurrentId(null)
    setPicked(null)
    setAnswered(null)
    setSession({ answered: 0, correct: 0 })
  }

  const switchMode = (nextMode: 'normal' | 'review') => {
    const next = new URLSearchParams(params)
    if (nextMode === 'review') next.set('mode', 'review')
    else next.delete('mode')
    setParams(next)
    setCurrentId(null)
    setPicked(null)
    setAnswered(null)
    setSession({ answered: 0, correct: 0 })
  }

  const answer = (index: number) => {
    if (picked !== null || !current) return
    const correct = index === current.q.answer
    record(current.topicId, current.q.id, correct, 0)
    reviewRecord(current.q.id, correct)
    setAnswered(current)
    setPicked(index)
    setSession((s) => ({ answered: s.answered + 1, correct: s.correct + (correct ? 1 : 0) }))
  }

  const next = () => {
    if (!current || questions.length === 0) return
    const idx = questions.findIndex((it) => it.q.id === current.q.id)
    const nextItem = questions[(idx + 1) % questions.length]
    setCurrentId(nextItem?.q.id ?? null)
    setPicked(null)
    setAnswered(null)
  }

  const handleJump = (event: FormEvent) => {
    event.preventDefault()
    const value = jumpRef.current?.value.trim().toLowerCase() || ''
    const found = questions.find((it) => it.q.id === value)
    if (found) { setCurrentId(found.q.id); setPicked(null); setAnswered(null) }
  }

  const totalQuestions = QUESTION_BANK.length
  const reviewDue = reviewQueue.length
  const wrongCount = useMemo(
    () => Object.values(topics).reduce((sum, p) => sum + p.wrong.length, 0),
    [topics]
  )

  return (
    <div className="practice-page">
      <PageHeader backTo="/knowledge-map" backLabel="返回知识地图" title="题库练习" />

      <p className="practice-lead">
        {totalQuestions} 道结构化题目，覆盖微积分、线性代数与概率统计。答题结果写入掌握度并云端同步；错题会自动进入复习队列，按间隔重复安排下次复习。
      </p>

      <div className="practice-mode-switch" role="tablist" aria-label="练习模式">
        <button type="button" role="tab" aria-selected={mode === 'normal'}
          className={`practice-mode-btn${mode === 'normal' ? ' active' : ''}`}
          onClick={() => switchMode('normal')}>
          知识点练习
        </button>
        <button type="button" role="tab" aria-selected={mode === 'review'}
          className={`practice-mode-btn${mode === 'review' ? ' active' : ''}`}
          onClick={() => switchMode('review')}>
          错题复习 {reviewDue > 0 && <span className="practice-mode-badge">{reviewDue}</span>}
        </button>
      </div>

      {mode === 'normal' ? (
        <div className="practice-topics" role="tablist" aria-label="知识点">
          {SUBJECT_GROUPS.map((group) => (
            <div className="practice-topic-group" key={group.id}>
              <span className="practice-hall-name">{group.name}</span>
              {TOPICS.filter((t) => group.halls.includes(t.hall as never)).map((t) => {
                const m = topicMastery(t.id, topics)
                return (
                  <button key={t.id} type="button" role="tab" aria-selected={t.id === topic.id}
                    className={`practice-topic${t.id === topic.id ? ' active' : ''}`}
                    onClick={() => selectTopic(t.id)}>
                    {t.name}
                    <span className={`practice-topic-lv lv${m.level}`}>{MASTERY_LABEL[m.level]}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      ) : (
        <p className="practice-review-hint">
          以下是你的错题与到期复习题（共 {reviewDue} 道），按间隔重复算法安排。答对后间隔逐次拉长，答错则当天重新排队。
        </p>
      )}

      <div className="practice-layout">
        <section className="practice-card">
          <div className="practice-card-head">
            <div>
              <h2>{mode === 'review' ? '错题复习' : topic.name}</h2>
              <p>{mode === 'review' ? '温故而知新，把错题变成真正掌握的知识' : topic.desc}</p>
            </div>
            <div className="practice-mastery">
              <span>{mode === 'review' ? '待复习' : '掌握度'}</span>
              <strong>{mode === 'review' ? `${reviewDue} 题` : MASTERY_LABEL[mastery.level]}</strong>
              <small>
                {mode === 'review'
                  ? `累计错题 ${wrongCount} 道`
                  : `${mastery.correct}/${mastery.answered} 正确 · ${mastery.wrong} 道错题`}
              </small>
            </div>
          </div>

          {current ? (
            <>
              <div className="practice-q-meta">
                <span className="practice-q-id">{current.q.id}</span>
                <span>难度 {DIFFICULTY_LABEL[current.q.difficulty]}</span>
                <span>{mode === 'review' ? TOPICS.find((t) => t.id === current.topicId)?.name : ''}</span>
                <span>第 {questions.findIndex((it) => it.q.id === current.q.id) + 1} / {questions.length} 题</span>
                <form className="practice-jump" onSubmit={handleJump}>
                  <input ref={jumpRef} name="jump" placeholder="跳到题号" aria-label="跳转到题目" />
                  <button type="submit">跳转</button>
                </form>
              </div>

              <p className="practice-q-text">{current.q.q}</p>

              <div className="practice-options">
                {current.q.options.map((opt, i) => {
                  let cls = 'practice-option'
                  if (picked !== null) {
                    if (i === current.q.answer) cls += ' right'
                    else if (i === picked) cls += ' wrong'
                  }
                  return (
                    <button key={i} type="button" className={cls} disabled={picked !== null}
                      onClick={() => answer(i)}>
                      <span className="practice-option-key">{i + 1}</span>
                      {opt}
                    </button>
                  )
                })}
              </div>

              {picked !== null && (
                <div className={`practice-feedback ${picked === current.q.answer ? 'ok' : 'bad'}`} role="status">
                  <strong>{picked === current.q.answer ? '回答正确' : '回答有误'}</strong>
                  <p>{current.q.explain}</p>
                  {picked === current.q.answer && (
                    <p className="practice-next-due">
                      下次复习：{formatDueAt(reviewEntries[current.q.id]?.dueAt ?? Date.now())}
                    </p>
                  )}
                  <button type="button" className="practice-next" onClick={next}>下一题 →</button>
                </div>
              )}
            </>
          ) : (
            <div className="practice-empty">
              <p>{mode === 'review' ? '太棒了，当前没有需要复习的题目！' : '这个知识点暂时没有题目。'}</p>
              {mode === 'review' && <button type="button" className="btn btn-secondary" onClick={() => switchMode('normal')}>去做知识点练习</button>}
            </div>
          )}
        </section>

        <aside className="practice-side">
          <div className="practice-side-card">
            <h3>本次练习</h3>
            <p className="practice-session">
              已答 <strong>{session.answered}</strong> 题 · 正确 <strong>{session.correct}</strong> 题
            </p>
            {session.answered > 0 && (
              <p className="practice-session-rate">
                正确率 {Math.round((session.correct / session.answered) * 100)}%
              </p>
            )}
          </div>
          <div className="practice-side-card">
            <h3>{mode === 'review' ? '复习队列' : '题目列表'}</h3>
            <div className="practice-q-list">
              {questions.map(({ q }) => {
                const wrong = Object.values(topics).some((p) => p.wrong.includes(q.id))
                const active = q.id === current?.q.id
                const entry = reviewEntries[q.id]
                return (
                  <button key={q.id} type="button"
                    className={`practice-q-link${active ? ' active' : ''}${wrong ? ' wrong' : ''}`}
                    onClick={() => { setCurrentId(q.id); setPicked(null); setAnswered(null) }}>
                    <span>{q.id}</span>
                    <small>{entry ? `Lv${entry.streak} · ${formatDueAt(entry.dueAt)}` : `难度 ${q.difficulty}`}</small>
                  </button>
                )
              })}
            </div>
          </div>
          <p className="practice-note">答题记录与复习计划已云端同步，换设备也能继续学习。</p>
        </aside>
      </div>
    </div>
  )
}
