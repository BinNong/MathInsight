import { ReactNode, useState } from 'react'

interface CollapsibleSectionProps {
  title: string
  children: ReactNode
  defaultExpanded?: boolean
  variant?: 'default' | 'success' | 'warning' | 'error'
  rightAction?: ReactNode
  className?: string
}

export default function CollapsibleSection({
  title,
  children,
  defaultExpanded = true,
  variant = 'default',
  rightAction,
  className = '',
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div
      className={`collapsible-section ${variant} ${expanded ? 'expanded' : 'collapsed'} ${className}`}
    >
      <button
        className="collapsible-header"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="collapsible-toggle" aria-hidden="true">
          {expanded ? '▼' : '▶'}
        </span>
        <span className="collapsible-title">{title}</span>
        {rightAction && (
          <span className="collapsible-right" onClick={(e) => e.stopPropagation()}>
            {rightAction}
          </span>
        )}
      </button>
      <div className="collapsible-body">
        <div className="collapsible-content">{children}</div>
      </div>
    </div>
  )
}
