import { useState } from 'react'
import './GuessStepper.css'

export interface GuessStep {
  title: string
  description: string
  /** 引导学生先猜测的问题 */
  prompt: string
}

interface Props {
  steps: GuessStep[]
  activeStep: number
  onStepChange: (index: number) => void
  storageKey: string
  className?: string
}

function loadRevealed(key: string): number[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'number') : []
  } catch {
    return []
  }
}

/** 猜想-验证步骤条：每步先让学生写下猜测，提交后才揭示该步内容 */
export default function GuessStepper({
  steps,
  activeStep,
  onStepChange,
  storageKey,
  className = '',
}: Props) {
  const [revealed, setRevealed] = useState<number[]>(() => loadRevealed(storageKey))
  const [guesses, setGuesses] = useState<Record<number, string>>({})

  const reveal = (index: number) => {
    if (revealed.includes(index)) return
    const next = [...revealed, index].sort((a, b) => a - b)
    setRevealed(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      // localStorage 不可用时仅保留本次会话状态
    }
  }

  const base = className.replace(/stepper$/, '')

  return (
    <div className={`${className} guess-stepper`}>
      {steps.map((step, index) => {
        const isRevealed = revealed.includes(index)
        return (
          <div
            key={index}
            className={`${base}step ${index === activeStep ? 'active' : ''} ${isRevealed ? 'revealed' : ''} ${index < activeStep ? 'completed' : ''}`}
            onClick={() => onStepChange(index)}
          >
            <div className={`${base}step-number`}>{index + 1}</div>
            <div className={`${base}step-content`}>
              <div className={`${base}step-title`}>{step.title}</div>
              {isRevealed ? (
                <>
                  <div className={`${base}step-desc`}>{step.description}</div>
                  {guesses[index] && (
                    <div className="guess-result">
                      <span>你的猜想</span>
                      <em>{guesses[index]}</em>
                    </div>
                  )}
                </>
              ) : index === activeStep ? (
                <div className="guess-box" onClick={(e) => e.stopPropagation()}>
                  <p className="guess-prompt">{step.prompt}</p>
                  <div className="guess-row">
                    <input
                      type="text"
                      value={guesses[index] || ''}
                      onChange={(e) => setGuesses((g) => ({ ...g, [index]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && guesses[index]?.trim()) reveal(index)
                      }}
                      placeholder="写下你的猜想（任意文字即可）"
                      aria-label={`第 ${index + 1} 步的猜想`}
                    />
                    <button
                      type="button"
                      onClick={() => reveal(index)}
                      disabled={!guesses[index]?.trim()}
                    >
                      揭示
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`${base}step-desc step-locked`}>先完成上一步，再揭晓这里。</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
