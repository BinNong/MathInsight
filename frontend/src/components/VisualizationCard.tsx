import { ReactNode } from 'react'

interface VisualizationCardProps {
  title?: string
  subtitle?: string
  children: ReactNode
  loading?: boolean
  loadingText?: string
  rightAction?: ReactNode
}

export default function VisualizationCard({
  title,
  subtitle,
  children,
  loading = false,
  loadingText = '更新中...',
  rightAction,
}: VisualizationCardProps) {
  return (
    <section className="visualization-card" aria-label={title} aria-busy={loading}>
      {(title || subtitle || rightAction) && (
        <div className="visualization-header">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {rightAction && <div>{rightAction}</div>}
        </div>
      )}
      <div className="visualization-body">
        {loading && (
          <div className="updating-overlay" role="status" aria-live="polite">
            <div className="loading-spinner" aria-hidden="true" />
            {loadingText}
          </div>
        )}
        {children}
      </div>
    </section>
  )
}
