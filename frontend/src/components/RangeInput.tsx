import { useEffect, useId, useState, type KeyboardEvent } from 'react'

interface RangeInputProps {
  value: number[]
  onCommit: (range: [number, number]) => void
  label?: string
}

function formatRange(value: number[]) {
  return `[${value[0]}, ${value[1]}]`
}

export default function RangeInput({ value, onCommit, label = '绘图范围' }: RangeInputProps) {
  const inputId = useId()
  const [draft, setDraft] = useState(() => formatRange(value))
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    setDraft(formatRange(value))
    setInvalid(false)
  }, [value])

  const commit = () => {
    const parts = draft
      .trim()
      .replace(/^\s*\[/, '')
      .replace(/\]\s*$/, '')
      .split(',')
      .map((part) => Number(part.trim()))
    const valid =
      parts.length === 2 && parts.every((part) => Number.isFinite(part)) && parts[0] < parts[1]

    if (!valid) {
      setInvalid(true)
      return
    }

    const range: [number, number] = [parts[0], parts[1]]
    setInvalid(false)
    if (range[0] !== value[0] || range[1] !== value[1]) onCommit(range)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setDraft(formatRange(value))
      setInvalid(false)
    }
  }

  return (
    <div className="range-input-wrapper">
      <input
        id={inputId}
        type="text"
        value={draft}
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${inputId}-error` : `${inputId}-hint`}
        inputMode="decimal"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
      />
      {invalid ? (
        <span id={`${inputId}-error`} className="range-input-error" role="alert">
          请输入两个有限数字，且左端小于右端
        </span>
      ) : (
        <span id={`${inputId}-hint`} className="form-helper">
          例如 [0, 4]，回车或失焦后应用
        </span>
      )}
    </div>
  )
}
