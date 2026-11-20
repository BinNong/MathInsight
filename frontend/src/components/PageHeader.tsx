import { Link, useLocation, useNavigate } from 'react-router-dom'

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
  const location = useLocation()
  const quickLinks = [
    { to: '/knowledge-map', label: '知识地图' },
    { to: '/solver', label: '解题助手' },
  ].filter((item) => item.to !== location.pathname)

  return (
    <header className="detail-header">
      {backTo ? (
        <Link to={backTo} className="detail-back-button">
          ← {backLabel}
        </Link>
      ) : (
        <button type="button" className="detail-back-button" onClick={() => navigate(-1)}>
          ← {backLabel}
        </button>
      )}

      {breadcrumbs.length > 0 && (
        <nav className="breadcrumb" aria-label="面包屑">
          {breadcrumbs.map((item, index) => (
            <span
              key={`${item.label}-${index}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {item.path ? (
                <Link to={item.path}>{item.label}</Link>
              ) : (
                <span aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
              {index < breadcrumbs.length - 1 && (
                <span className="breadcrumb-separator" aria-hidden="true">
                  /
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="detail-header-main">
        <h1 className="detail-title">{title}</h1>
        {quickLinks.length > 0 && (
          <nav className="detail-quick-nav" aria-label="学习工具">
            {quickLinks.map((item) => (
              <Link key={item.to} to={item.to}>
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  )
}
