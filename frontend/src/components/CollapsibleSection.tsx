import { ReactNode, useId, useState } from 'react'

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
  const contentId = useId()

  return (
    <div
      className={`collapsible-section ${variant} ${expanded ? 'expanded' : 'collapsed'} ${className}`}
    >
      <div className="collapsible-header-row">
        <button
          type="button"
          className="collapsible-header"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-controls={contentId}
        >
          <span className="collapsible-toggle" aria-hidden="true">
            {expanded ? '▼' : '▶'}
          </span>
          <span className="collapsible-title">{title}</span>
        </button>
        {rightAction && <div className="collapsible-right">{rightAction}</div>}
      </div>
      <div id={contentId} className="collapsible-body" hidden={!expanded}>
        <div className="collapsible-content">{children}</div>
      </div>
    </div>
  )
}
