import { useEffect, useMemo, useRef, useState } from 'react'
import { useWorld2DStore, useMasteryStore, masteryLevel, MASTERY_LABEL } from '../store'
import { HALLS, TOPICS, QUESTION_BANK, pickQuestions, pickHallQuestions, topicName, type BankQuestion } from '../data/questions'

const SESSION_COUNT = 5
const QUESTION_SECONDS = 15

interface SessionState {
  qs: BankQuestion[]
  idx: number
  correct: number
  streak: number
  bestStreak: number
  /** normal = 普通修炼；retry = 错题重练（奖励减半、无顿悟） */
  mode: 'normal' | 'retry'
  /** 本组首次熟练/精通的知识点名 */
  adept: string[]
  mastered: string[]
}

interface ResultState {
  total: number
  correct: number
  bestStreak: number
  mp: number
  score: number
  buffSec: number
  mode: 'normal' | 'retry'
  adept: string[]
  mastered: string[]
}

/** 修炼答题：馆内导师处开始，选知识点/综合试炼 → 5 题连答（每题解析）→ 结算奖励 */
export default function Training() {
  const training = useWorld2DStore((s) => s.training)
  const setTraining = useWorld2DStore((s) => s.setTraining)
  const setTrainingReward = useWorld2DStore((s) => s.setTrainingReward)
  const topics = useMasteryStore((s) => s.topics)
  const record = useMasteryStore((s) => s.record)
  const finishSession = useMasteryStore((s) => s.finishSession)

  const [phase, setPhase] = useState<'menu' | 'session' | 'result'>('menu')
  const [sess, setSess] = useState<SessionState | null>(null)
  const [picked, setPicked] = useState<number | null>(null) // -1 = 超时
  const [left, setLeft] = useState(QUESTION_SECONDS)
  const [result, setResult] = useState<ResultState | null>(null)
  const sessRef = useRef(sess)
  sessRef.current = sess

  const hall = training?.hall ?? null

  // 打开时重置到选单
  useEffect(() => {
    setPhase('menu')
    setSess(null)
    setPicked(null)
    setResult(null)
  }, [hall])

  const q: BankQuestion | null = sess ? sess.qs[sess.idx] : null
  const explaining = picked !== null

  // 每题倒计时
  useEffect(() => {
    if (phase !== 'session' || !q || explaining) return
    const t0 = Date.now()
    const timer = setInterval(() => {
      const remain = QUESTION_SECONDS - (Date.now() - t0) / 1000
      setLeft(Math.max(0, remain))
      if (remain <= 0) answer(-1)
    }, 100)
    setLeft(QUESTION_SECONDS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sess?.idx, explaining])

  const startSession = (topicId: string | 'mixed' | 'retry') => {
    if (!hall) return
    let qs: BankQuestion[]
    let mode: 'normal' | 'retry' = 'normal'
    if (topicId === 'retry') {
      mode = 'retry'
      const wrongIds = new Set<string>()
      for (const tid of HALLS[hall].topics) for (const id of topics[tid]?.wrong ?? []) wrongIds.add(id)
      qs = QUESTION_BANK.filter((q) => wrongIds.has(q.id))
        .sort(() => Math.random() - 0.5)
        .slice(0, SESSION_COUNT)
    } else {
      qs = topicId === 'mixed' ? pickHallQuestions(hall, SESSION_COUNT) : pickQuestions(topicId, SESSION_COUNT)
    }
    if (qs.length === 0) return
    setSess({ qs, idx: 0, correct: 0, streak: 0, bestStreak: 0, mode, adept: [], mastered: [] })
    setPicked(null)
    setPhase('session')
  }

  const answer = (optIdx: number) => {
    const s = sessRef.current
    if (!s || picked !== null) return
    const cur = s.qs[s.idx]
    const correct = optIdx === cur.answer
    const streak = correct ? s.streak + 1 : 0
    const bestStreak = Math.max(s.bestStreak, streak)
    const grants = record(cur.topic, cur.id, correct, streak)
    setSess({
      ...s,
      correct: s.correct + (correct ? 1 : 0),
      streak,
      bestStreak,
      adept: grants.newlyAdept ? [...s.adept, cur.topic] : s.adept,
      mastered: grants.newlyMastered ? [...s.mastered, cur.topic] : s.mastered,
    })
    setPicked(optIdx)
  }

  const next = () => {
    const s = sessRef.current
    if (!s || picked === null) return
    if (s.idx + 1 < s.qs.length) {
      setSess({ ...s, idx: s.idx + 1 })
      setPicked(null)
      return
    }
    // 结算（错题重练：奖励减半、不给顿悟）
    const retry = s.mode === 'retry'
    const mp = retry ? s.correct * 6 + s.bestStreak : s.correct * 8 + s.bestStreak * 2
    const score = retry ? s.correct : s.correct * 2 + (s.correct === s.qs.length && s.qs.length > 0 ? 4 : 0)
    const buffSec = !retry && s.correct >= 4 ? 90 : 0
    setTrainingReward({ mp, score, buffSec })
    finishSession()
    setResult({ total: s.qs.length, correct: s.correct, bestStreak: s.bestStreak, mp, score, buffSec, mode: s.mode, adept: s.adept, mastered: s.mastered })
    setPhase('result')
  }

  // 键盘：1-4 作答，Enter/Space 下一题，Esc 关闭
  useEffect(() => {
    if (!hall) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (phase !== 'session') setTraining(null)
        return
      }
      if (phase === 'session') {
        if (!explaining && ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
          answer(Number(e.code.slice(-1)) - 1)
        } else if (explaining && (e.code === 'Enter' || e.code === 'Space')) {
          next()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hall, phase, explaining])

  const topicList = useMemo(() => (hall ? TOPICS.filter((t) => t.hall === hall) : []), [hall])

  const wrongCount = useMemo(() => {
    if (!hall) return 0
    const ids = new Set<string>()
    for (const tid of HALLS[hall].topics) for (const id of topics[tid]?.wrong ?? []) ids.add(id)
    return ids.size
  }, [hall, topics])

  if (!hall) return null
  const def = HALLS[hall]

  return (
    <div className="world2d-quiz-wrap">
      <div className="world2d-quiz world2d-training">
        {phase === 'menu' && (
          <>
            <div className="world2d-quiz-head">
              <span className="world2d-quiz-badge">{def.name} · 答题修炼</span>
              <button className="world2d-x" onClick={() => setTraining(null)}>✕</button>
            </div>
            <p className="world2d-training-desc">选择知识点开始 5 题连答；答对得灵感与知识点，一组答对 ≥4 题获得「顿悟」。知识点首次「熟练」生命上限 +10、首次「精通」生命+10·灵感+10。</p>
            <div className="world2d-topic-list">
              {topicList.map((t) => {
                const lv = masteryLevel(topics[t.id])
                const prog = topics[t.id]
                return (
                  <button key={t.id} className="world2d-topic" onClick={() => startSession(t.id)}>
                    <span className="world2d-topic-name">{t.name}</span>
                    <span className="world2d-topic-desc">{t.desc}</span>
                    <span className={`world2d-topic-lv lv${lv}`}>
                      {MASTERY_LABEL[lv]}
                      {prog ? ` · ${prog.correct}/${prog.answered}` : ''}
                    </span>
                  </button>
                )
              })}
              <button className="world2d-topic mixed" onClick={() => startSession('mixed')}>
                <span className="world2d-topic-name">Σ 综合试炼</span>
                <span className="world2d-topic-desc">本馆全部知识点混合抽题</span>
              </button>
              {wrongCount > 0 && (
                <button className="world2d-topic retry" onClick={() => startSession('retry')}>
                  <span className="world2d-topic-name">✎ 错题重练</span>
                  <span className="world2d-topic-desc">本馆 {wrongCount} 道错题，答对移出错题本（奖励减半、无顿悟）</span>
                </button>
              )}
            </div>
          </>
        )}

        {phase === 'session' && q && (
          <>
            <div className="world2d-quiz-head">
              <span className="world2d-quiz-badge">
                {sess!.mode === 'retry' ? '✎ 错题重练 · ' : ''}
                {topicName(q.topic)} · 第 {sess!.idx + 1}/{sess!.qs.length} 题
              </span>
              <span className={`world2d-quiz-timer${left <= 4 ? ' urgent' : ''}`}>{left.toFixed(1)}s</span>
            </div>
            <div className="world2d-quiz-timer-track">
              <div className="world2d-quiz-timer-fill" style={{ width: `${(left / QUESTION_SECONDS) * 100}%` }} />
            </div>
            <p className="world2d-quiz-q">{q.q}</p>
            <div className="world2d-quiz-options">
              {q.options.map((opt, i) => {
                let cls = 'world2d-quiz-opt'
                if (explaining) {
                  if (i === q.answer) cls += ' right'
                  else if (i === picked) cls += ' wrong'
                }
                return (
                  <button key={i} className={cls} disabled={explaining} onClick={() => answer(i)}>
                    <span className="world2d-quiz-opt-key">{i + 1}</span>
                    {opt}
                  </button>
                )
              })}
            </div>
            {explaining ? (
              <div className="world2d-explain">
                <div className={`world2d-explain-verdict${picked === q.answer ? ' ok' : ' bad'}`}>
                  {picked === q.answer ? '✓ 回答正确' : picked === -1 ? '⏱ 超时未答' : '✗ 回答错误'}
                  {sess!.streak >= 2 ? ` · ${sess!.streak} 连对` : ''}
                </div>
                <p className="world2d-explain-text">{q.explain}</p>
                <button className="world-btn primary world2d-next" onClick={next}>
                  {sess!.idx + 1 < sess!.qs.length ? '下一题 →' : '查看结算 →'}
                </button>
              </div>
            ) : (
              <p className="world2d-quiz-tip">按 1-4 快捷作答 · 每题 {QUESTION_SECONDS} 秒 · 答完显示解析</p>
            )}
          </>
        )}

        {phase === 'result' && result && (
          <>
            <div className="world2d-quiz-head">
              <span className="world2d-quiz-badge">{def.name} · 修炼结算</span>
            </div>
            <div className="world2d-result">
              <div className="world2d-result-score">
                {result.correct}<span>/{result.total}</span>
              </div>
              <div className="world2d-result-lines">
                <div>最佳连对 <strong>{result.bestStreak}</strong></div>
                <div>灵感 <strong className="gain">+{result.mp}</strong></div>
                <div>知识点 <strong className="gain">+{result.score}</strong></div>
                {result.adept.map((t) => (
                  <div key={t} className="world2d-result-master">💪 「{topicName(t)}」首次熟练！生命上限 +10</div>
                ))}
                {result.mastered.map((t) => (
                  <div key={t} className="world2d-result-master">🎓 「{topicName(t)}」首次精通！生命 +10 · 灵感上限 +10</div>
                ))}
                {result.buffSec > 0 && <div className="world2d-result-buff">✨ 顿悟觉醒：{result.buffSec} 秒内伤害 ×1.25</div>}
                {result.mode === 'retry' && <div className="world2d-result-tip">错题重练 · 奖励减半；答对的题已移出错题本</div>}
                {result.mode === 'normal' && result.correct < result.total && <div className="world2d-result-tip">错题已收入手札（Tab 查看），温故而知新</div>}
              </div>
            </div>
            <div className="world2d-result-actions">
              <button className="world-btn primary" onClick={() => setPhase('menu')}>再来一组</button>
              <button className="world-btn" onClick={() => setTraining(null)}>离开修炼馆</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
