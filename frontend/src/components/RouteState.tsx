import { Link } from 'react-router-dom'
import '../pages/Home.css'

interface RouteStateProps {
  code: string
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export default function RouteState({
  code,
  title,
  description,
  actionLabel,
  onAction,
}: RouteStateProps) {
  return (
    <main className="route-state">
      <div className="route-state-card">
        <span className="route-state-code">{code}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="route-state-actions">
          <Link to="/" className="route-state-primary">
            返回学习工作台
          </Link>
          {onAction && actionLabel && (
            <button type="button" className="route-state-secondary" onClick={onAction}>
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
