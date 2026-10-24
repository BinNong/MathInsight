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
    <div className="visualization-card">
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
          <div className="updating-overlay">
            <div className="loading-spinner" />
            {loadingText}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
