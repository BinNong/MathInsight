import { Link, useNavigate } from 'react-router-dom'

export interface BreadcrumbItem {
  label: string
  path?: string
}

interface PageHeaderProps {
  backTo?: string
  backLabel?: string
  breadcrumbs?: BreadcrumbItem[]
  title: string
}

export default function PageHeader({
  backTo,
  backLabel = '返回',
  breadcrumbs = [],
  title,
}: PageHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="detail-header">
      {backTo ? (
        <Link to={backTo} className="detail-back-button">
          ← {backLabel}
        </Link>
      ) : (
        <button className="detail-back-button" onClick={() => navigate(-1)}>
          ← {backLabel}
        </button>
      )}

      {breadcrumbs.length > 0 && (
        <nav className="breadcrumb">
          {breadcrumbs.map((item, index) => (
            <span key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {item.path ? <Link to={item.path}>{item.label}</Link> : <span>{item.label}</span>}
              {index < breadcrumbs.length - 1 && <span className="breadcrumb-separator">/</span>}
            </span>
          ))}
        </nav>
      )}

      <h1 className="detail-title">{title}</h1>
    </header>
  )
}
