import { ReactNode } from 'react'

interface ControlPanelProps {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

export default function ControlPanel({ title, subtitle, children, footer }: ControlPanelProps) {
  return (
    <aside className="control-panel">
      <div className="control-panel-header">
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="control-panel-body">{children}</div>
      {footer && <div className="control-panel-footer">{footer}</div>}
    </aside>
  )
}
