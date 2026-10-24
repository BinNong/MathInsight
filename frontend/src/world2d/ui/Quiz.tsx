import { useEffect, useRef, useState } from 'react'
import { useWorld2DStore } from '../store'

const QUIZ_SECONDS = 10

/** 大招「Σ 级数风暴」答题蓄力：答对完美施法，答错/超时威力减半 */
export default function Quiz() {
  const quiz = useWorld2DStore((s) => s.quiz)
  const setQuiz = useWorld2DStore((s) => s.setQuiz)
  const [left, setLeft] = useState(QUIZ_SECONDS)
  const [picked, setPicked] = useState<number | null>(null)
  const doneRef = useRef(false)
  const finishRef = useRef<(idx: number) => void>(() => {})

  useEffect(() => {
    if (!quiz) return
    setLeft(QUIZ_SECONDS)
    setPicked(null)
    doneRef.current = false
    finishRef.current = (idx: number) => {
      if (doneRef.current) return
      doneRef.current = true
      setPicked(idx)
      // 稍作停顿展示对错，再关闭并结算
      setTimeout(() => {
        quiz.resolve(idx === quiz.answer)
        setQuiz(null)
      }, 450)
    }
    const t0 = Date.now()
    const timer = setInterval(() => {
      const remain = QUIZ_SECONDS - (Date.now() - t0) / 1000
      setLeft(Math.max(0, remain))
      if (remain <= 0) finishRef.current(-1)
    }, 100)
    const onKey = (e: KeyboardEvent) => {
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code)
      if (n >= 0) finishRef.current(n)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearInterval(timer)
      window.removeEventListener('keydown', onKey)
    }
  }, [quiz, setQuiz])

  if (!quiz) return null

  return (
    <div className="world2d-quiz-wrap">
      <div className="world2d-quiz">
        <div className="world2d-quiz-head">
          <span className="world2d-quiz-badge">Σ 级数风暴 · 灵感凝聚</span>
          <span className={`world2d-quiz-timer${left <= 3 ? ' urgent' : ''}`}>{left.toFixed(1)}s</span>
        </div>
        <div className="world2d-quiz-timer-track">
          <div className="world2d-quiz-timer-fill" style={{ width: `${(left / QUIZ_SECONDS) * 100}%` }} />
        </div>
        <p className="world2d-quiz-q">{quiz.q}</p>
        <div className="world2d-quiz-options">
          {quiz.options.map((opt, i) => {
            let cls = 'world2d-quiz-opt'
            if (picked !== null) {
              if (i === quiz.answer) cls += ' right'
              else if (i === picked) cls += ' wrong'
            }
            return (
              <button key={i} className={cls} disabled={picked !== null} onClick={() => finishRef.current(i)}>
                <span className="world2d-quiz-opt-key">{i + 1}</span>
                {opt}
              </button>
            )
          })}
        </div>
        <p className="world2d-quiz-tip">答对：满威力风暴 · 答错/超时：威力减半（按 1-4 快捷作答）</p>
      </div>
    </div>
  )
}
