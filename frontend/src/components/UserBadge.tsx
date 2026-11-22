import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import ChangePasswordDialog from './ChangePasswordDialog'
import './UserBadge.css'

/** 右上角登录用户标识与退出入口 */
export default function UserBadge() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const badgeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!badgeRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  if (!user) return null

  const handleLogout = async () => {
    if (busy) return
    setBusy(true)
    try {
      await authApi.logout()
    } catch {
      // 即使服务端登出失败，也清除本地登录态
    } finally {
      logout()
      navigate('/login', { replace: true })
    }
  }

  return (
    <>
      <div className={`user-badge${menuOpen ? ' is-open' : ''}`} ref={badgeRef}>
        <span className="user-badge-seal" aria-hidden="true">{user.username.slice(0, 1).toUpperCase()}</span>
        <span className="user-badge-name">{user.username}</span>
        <div className="user-badge-actions">
          <button
            type="button"
            className="user-badge-password"
            onClick={() => setShowPassword(true)}
            title="修改密码"
          >
            改密
          </button>
          {user.is_admin && (
            <Link to="/admin" className="user-badge-admin">管理</Link>
          )}
          <button type="button" className="user-badge-logout" onClick={handleLogout} disabled={busy}>
            {busy ? '退出中…' : '退出'}
          </button>
        </div>
        <button
          type="button"
          className="user-badge-menu-toggle"
          aria-label="账户菜单"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? '×' : '⋯'}
        </button>
        {menuOpen && (
          <div className="user-badge-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                setShowPassword(true)
              }}
            >
              修改密码
            </button>
            {user.is_admin && (
              <Link to="/admin" role="menuitem" onClick={() => setMenuOpen(false)}>
                管理后台
              </Link>
            )}
            <button type="button" role="menuitem" onClick={handleLogout} disabled={busy}>
              {busy ? '退出中…' : '退出登录'}
            </button>
          </div>
        )}
      </div>
      {showPassword && <ChangePasswordDialog onClose={() => setShowPassword(false)} />}
    </>
  )
}
