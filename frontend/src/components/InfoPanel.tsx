import { ReactNode } from 'react'

interface InfoPanelProps {
  title?: string
  children: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error'
  rightAction?: ReactNode
}

export default function InfoPanel({
  title,
  children,
  variant = 'default',
  rightAction,
}: InfoPanelProps) {
  return (
    <div className={`info-panel ${variant}`}>
      {(title || rightAction) && (
        <div className="info-panel-header">
          {title && <h4>{title}</h4>}
          {rightAction}
        </div>
      )}
      {children}
    </div>
  )
}
