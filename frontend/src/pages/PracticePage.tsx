import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import {
  MASTERY_LABEL,
  useMasteryStore,
} from '../world2d/store'
import {
  HALLS,
  QUESTION_BANK,
  TOPICS,
  type HallId,
} from '../world2d/data/questions'
import {
  topicMastery,
  useMasteryTopics,
  type ConceptMastery,
} from '../services/learning'
import './PracticePage.css'

const DIFFICULTY_LABEL = ['', '基础', '进阶', '挑战']

export default function PracticePage() {
  const [params, setParams] = useSearchParams()
  const topicId = params.get('topic') || TOPICS[0].id
  const topics = useMasteryTopics()
  const record = useMasteryStore((s) => s.record)

  const [currentId, setCurrentId] = useState<string | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [session, setSession] = useState({ answered: 0, correct: 0 })

  const topic = TOPICS.find((t) => t.id === topicId) || TOPICS[0]
  const questions = useMemo(
    () => QUESTION_BANK.filter((q) => q.topic === topic.id),
    [topic.id]
  )
  const current = questions.find((q) => q.id === currentId) || questions[0]
  const mastery: ConceptMastery = topicMastery(topic.id, topics)
  const jumpRef = useRef<HTMLInputElement>(null)

  const selectTopic = (id: string) => {
    setParams({ topic: id })
    setCurrentId(null)
    setPicked(null)
    setSession({ answered: 0, correct: 0 })
  }

  const answer = (index: number) => {
    if (picked !== null || !current) return
    const correct = index === current.answer
    record(topic.id, current.id, correct, 0)
    setPicked(index)
    setSession((s) => ({ answered: s.answered + 1, correct: s.correct + (correct ? 1 : 0) }))
  }

  const next = () => {
    if (!current || questions.length === 0) return
    const idx = questions.findIndex((q) => q.id === current.id)
    setCurrentId(questions[(idx + 1) % questions.length].id)
    setPicked(null)
  }

  const handleJump = (event: FormEvent) => {
    event.preventDefault()
    const value = jumpRef.current?.value.trim().toLowerCase() || ''
    const found = questions.find((q) => q.id === value)
    if (found) {
      setCurrentId(found.id)
      setPicked(null)
    }
  }

  return (
    <div className="practice-page">
      <PageHeader
        backTo="/knowledge-map"
        backLabel="返回知识地图"
        title="题库练习"
      />

      <p className="practice-lead">
        57 道结构化题目，覆盖极限、导数、积分与级数。答题结果会写入你的掌握度，并在知识地图与首页诊断中同步体现。
      </p>

      <div className="practice-topics" role="tablist" aria-label="知识点">
        {(Object.keys(HALLS) as HallId[]).flatMap((hall) => (
          <div className="practice-topic-group" key={hall}>
            <span className="practice-hall-name">{HALLS[hall].name}</span>
            {TOPICS.filter((t) => t.hall === hall).map((t) => {
              const m = topicMastery(t.id, topics)
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={t.id === topic.id}
                  className={`practice-topic${t.id === topic.id ? ' active' : ''}`}
                  onClick={() => selectTopic(t.id)}
                >
                  {t.name}
                  <span className={`practice-topic-lv lv${m.level}`}>{MASTERY_LABEL[m.level]}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="practice-layout">
        <section className="practice-card">
          <div className="practice-card-head">
            <div>
              <h2>{topic.name}</h2>
              <p>{topic.desc}</p>
            </div>
            <div className="practice-mastery">
              <span>掌握度</span>
              <strong>{MASTERY_LABEL[mastery.level]}</strong>
              <small>
                {mastery.correct}/{mastery.answered} 正确 · {mastery.wrong} 道错题
              </small>
            </div>
          </div>

          {current ? (
            <>
              <div className="practice-q-meta">
                <span className="practice-q-id">{current.id}</span>
                <span>难度 {DIFFICULTY_LABEL[current.difficulty]}</span>
                <span>
                  第 {questions.findIndex((q) => q.id === current.id) + 1} / {questions.length} 题
                </span>
                <form className="practice-jump" onSubmit={handleJump}>
                  <input ref={jumpRef} name="jump" placeholder="跳到题号，如 lc-3" aria-label="跳转到题目" />
                  <button type="submit">跳转</button>
                </form>
              </div>

              <p className="practice-q-text">{current.q}</p>

              <div className="practice-options">
                {current.options.map((opt, i) => {
                  let cls = 'practice-option'
                  if (picked !== null) {
                    if (i === current.answer) cls += ' right'
                    else if (i === picked) cls += ' wrong'
                  }
                  return (
                    <button
                      key={i}
                      type="button"
                      className={cls}
                      disabled={picked !== null}
                      onClick={() => answer(i)}
                    >
                      <span className="practice-option-key">{i + 1}</span>
                      {opt}
                    </button>
                  )
                })}
              </div>

              {picked !== null && (
                <div className={`practice-feedback ${picked === current.answer ? 'ok' : 'bad'}`} role="status">
                  <strong>{picked === current.answer ? '回答正确' : '回答有误'}</strong>
                  <p>{current.explain}</p>
                  <button type="button" className="practice-next" onClick={next}>
                    下一题 →
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="practice-empty">这个知识点暂时没有题目。</p>
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
            <h3>题目列表</h3>
            <div className="practice-q-list">
              {questions.map((q) => {
                const wrong = topics[topic.id]?.wrong.includes(q.id)
                const active = q.id === current?.id
                return (
                  <button
                    key={q.id}
                    type="button"
                    className={`practice-q-link${active ? ' active' : ''}${wrong ? ' wrong' : ''}`}
                    onClick={() => { setCurrentId(q.id); setPicked(null) }}
                  >
                    <span>{q.id}</span>
                    <small>难度 {q.difficulty}</small>
                  </button>
                )
              })}
            </div>
          </div>
          <p className="practice-note">答题记录保存在当前浏览器，3D/2D 世界与主站共享同一份掌握度。</p>
        </aside>
      </div>
    </div>
  )
}
