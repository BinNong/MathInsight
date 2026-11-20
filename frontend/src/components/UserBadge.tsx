import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import './UserBadge.css'

/** 右上角登录用户标识与退出入口 */
export default function UserBadge() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

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
    <div className="user-badge">
      <span className="user-badge-seal" aria-hidden="true">{user.username.slice(0, 1).toUpperCase()}</span>
      <span className="user-badge-name">{user.username}</span>
      <button type="button" className="user-badge-logout" onClick={handleLogout} disabled={busy}>
        {busy ? '退出中…' : '退出'}
      </button>
    </div>
  )
}
