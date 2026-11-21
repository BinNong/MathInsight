import { useState } from 'react'
import type { SimilarProblem } from '../services/api/solver'
import { renderLatex, createMarkup } from '../utils/latex'
import './SimilarQuestionCard.css'

interface Props {
  problem: SimilarProblem
  onAnalyze: (problem: string) => void
}

function TextBlock({ latex }: { latex: string }) {
  const html = renderLatex(latex)
  return html ? <span dangerouslySetInnerHTML={createMarkup(html)} /> : <>{latex}</>
}

/** 相似题卡片：题库题可直接在卡片内作答并查看解析 */
export default function SimilarQuestionCard({ problem, onAnalyze }: Props) {
  const [picked, setPicked] = useState<number | null>(null)
  const isBank = problem.source === 'bank' && !!problem.options?.length

  return (
    <div className="similar-q-card">
      <div className="similar-q-head">
        <span className="similar-q-id">{problem.id || 'AI 生成'}</span>
        <span className="similar-q-topic">{problem.topic}</span>
        <span className="similar-q-diff">难度 {problem.difficulty}</span>
        {isBank && <span className="similar-q-bank">题库</span>}
      </div>

      <div className="similar-q-text">
        <TextBlock latex={problem.problem} />
      </div>

      {isBank ? (
        <>
          <div className="similar-q-options">
            {problem.options!.map((opt, i) => {
              let cls = 'similar-q-option'
              if (picked !== null) {
                if (i === problem.answer) cls += ' right'
                else if (i === picked) cls += ' wrong'
              }
              return (
                <button
                  key={i}
                  type="button"
                  className={cls}
                  disabled={picked !== null}
                  onClick={() => setPicked(i)}
                >
                  <span>{i + 1}</span>
                  {opt}
                </button>
              )
            })}
          </div>
          {picked !== null && (
            <div className={`similar-q-feedback ${picked === problem.answer ? 'ok' : 'bad'}`}>
              <strong>{picked === problem.answer ? '回答正确' : '回答有误'}</strong>
              {problem.explanation && <p>{problem.explanation}</p>}
            </div>
          )}
        </>
      ) : (
        <>
          {problem.hint && (
            <div className="similar-problem-hint">
              <strong>提示：</strong>{problem.hint}
            </div>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAnalyze(problem.problem)}>
            让 AI 讲解这道题 →
          </button>
        </>
      )}
    </div>
  )
}
