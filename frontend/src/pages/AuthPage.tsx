import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi, getApiErrorMessage } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { pullAndMerge } from '../services/progressSync'
import './AuthPage.css'

type Mode = 'login' | 'register'

function AuthOrnament() {
  return (
    <svg className="auth-ornament" viewBox="0 0 240 240" fill="none" aria-hidden="true">
      <circle cx="120" cy="120" r="104" />
      <circle cx="120" cy="120" r="80" strokeDasharray="2 6" />
      <circle cx="120" cy="120" r="52" />
      <circle cx="120" cy="120" r="14" />
      <path d="M120 16V224M16 120H224" strokeDasharray="1 7" />
      <path d="M49 49 191 191M191 49 49 191" strokeDasharray="1 9" />
      <text x="120" y="26" textAnchor="middle">ℵ</text>
      <text x="216" y="124" textAnchor="middle">∞</text>
      <text x="120" y="228" textAnchor="middle">∂</text>
      <text x="24" y="124" textAnchor="middle">∇</text>
    </svg>
  )
}

export default function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isRegister = mode === 'register'
  const next = params.get('next') || '/'

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setError('')
    if (isRegister && password !== confirmPassword) {
      setError('两次输入的密码不一致，请检查后重试')
      setSubmitting(false)
      return
    }
    setSubmitting(true)
    try {
      const result = isRegister
        ? await authApi.register({ username, password, confirm_password: confirmPassword, invite_code: inviteCode.trim() })
        : await authApi.login({ username, password })
      setAuth(result.token, result.user)
      // 登录后拉取云端进度并与本地合并（失败不影响进入）
      pullAndMerge().catch(() => {})
      navigate(next, { replace: true })
    } catch (err) {
      setError(getApiErrorMessage(err, isRegister ? '注册失败，请稍后重试' : '登录失败，请稍后重试'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-ambient" aria-hidden="true">
        <AuthOrnament />
        <span className="auth-symbol auth-symbol-int">∫</span>
        <span className="auth-symbol auth-symbol-sum">Σ</span>
        <span className="auth-euler">eⁱπ + 1 = 0</span>
      </div>

      <main className="auth-main">
        <div className="auth-brand">
          <span className="auth-brand-mark">ƒ</span>
          <span>MathInsight</span>
        </div>

        <div className="auth-card">
          <p className="auth-eyebrow">
            <span aria-hidden="true" /> {isRegister ? 'REGISTRATION' : 'AUTHENTICATION'}
          </p>
          <h1 className="auth-title">{isRegister ? '创建你的席位' : '欢迎回来'}</h1>
          <p className="auth-lead">
            {isRegister
              ? '数学殿堂的大门向少数求知者敞开。请出示你的邀请函。'
              : '继续你未完成的探索，从上次停下的地方出发。'}
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>用户名</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="3-32 位字母、数字或中文"
                autoComplete="username"
                required
                disabled={submitting}
              />
            </label>

            <label className="auth-field">
              <span>密码</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? '至少 8 位' : '输入你的密码'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                disabled={submitting}
              />
            </label>

            {isRegister && (
              <label className="auth-field">
                <span>确认密码</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再输入一次密码"
                  autoComplete="new-password"
                  required
                  disabled={submitting}
                />
              </label>
            )}

            {isRegister && (
              <label className="auth-field">
                <span>邀请码</span>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="MI-XXXXXXXXXX"
                  autoComplete="off"
                  required
                  disabled={submitting}
                />
                <small>每位求知者需持有一枚有效且未使用的邀请码。</small>
              </label>
            )}

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting
                ? isRegister ? '正在创建…' : '正在进入…'
                : isRegister ? '创建账号 →' : '进入学习工作台 →'}
            </button>
          </form>

          <p className="auth-switch">
            {isRegister ? (
              <>
                已有账号？<Link to={`/login?next=${encodeURIComponent(next)}`}>返回登录</Link>
              </>
            ) : (
              <>
                尚未拥有邀请码？<Link to="/register">查看注册说明</Link>
              </>
            )}
          </p>
        </div>

        <p className="auth-footer-note">
          <em>Mathematics, the queen of the sciences.</em>
          <br />
          本站点仅限受邀用户使用 · 学习进度保存在本机
        </p>
      </main>
    </div>
  )
}
