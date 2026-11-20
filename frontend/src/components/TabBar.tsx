import { useRef, type KeyboardEvent } from 'react'

interface Tab {
  key: string
  label: string
}

interface TabBarProps<T extends string> {
  tabs: Tab[]
  active: T
  onChange: (key: T) => void
  label?: string
}

export default function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  label = '内容切换',
}: TabBarProps<T>) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | undefined
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = tabs.length - 1
    if (nextIndex === undefined) return

    event.preventDefault()
    onChange(tabs[nextIndex].key as T)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <div className="nav-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.key}
          ref={(element) => {
            tabRefs.current[index] = element
          }}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          tabIndex={active === tab.key ? 0 : -1}
          className={`nav-tab ${active === tab.key ? 'active' : ''}`}
          onClick={() => onChange(tab.key as T)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
