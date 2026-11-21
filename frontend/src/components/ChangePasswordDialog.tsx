import { useState, type FormEvent } from 'react'
import { authApi, getApiErrorMessage } from '../services/api'
import './ChangePasswordDialog.css'

interface Props {
  onClose: () => void
}

/** 用户自助修改密码弹窗：必须验证当前密码，新密码需两次输入一致 */
export default function ChangePasswordDialog({ onClose }: Props) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致')
      return
    }
    if (newPassword.length < 8) {
      setError('新密码至少需要 8 位')
      return
    }
    setBusy(true)
    try {
      await authApi.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
      })
      setDone(true)
    } catch (err) {
      setError(getApiErrorMessage(err, '修改密码失败，请稍后重试'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pwd-overlay" role="presentation" onMouseDown={() => { if (!busy) onClose() }}>
      <div
        className="pwd-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="修改密码"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 className="pwd-title">修改密码</h2>
        {done ? (
          <>
            <p className="pwd-done" role="status">密码已更新，下次登录请使用新密码。</p>
            <p className="pwd-hint">当前登录仍然有效，无需重新登录。</p>
            <button type="button" className="pwd-submit" onClick={onClose}>完成</button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <p className="pwd-error" role="alert">{error}</p>}
            <label className="pwd-field">
              <span>当前密码</span>
              <input
                type="password"
                autoComplete="current-password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
            </label>
            <label className="pwd-field">
              <span>新密码（至少 8 位）</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </label>
            <label className="pwd-field">
              <span>确认新密码</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </label>
            <div className="pwd-actions">
              <button type="button" className="pwd-cancel" onClick={onClose} disabled={busy}>取消</button>
              <button type="submit" className="pwd-submit" disabled={busy}>
                {busy ? '提交中…' : '确认修改'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
