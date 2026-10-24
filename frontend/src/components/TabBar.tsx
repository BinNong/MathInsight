interface Tab {
  key: string
  label: string
}

interface TabBarProps<T extends string> {
  tabs: Tab[]
  active: T
  onChange: (key: T) => void
}

export default function TabBar<T extends string>({ tabs, active, onChange }: TabBarProps<T>) {
  return (
    <div className="nav-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`nav-tab ${active === tab.key ? 'active' : ''}`}
          onClick={() => onChange(tab.key as T)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
