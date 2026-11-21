import { useState, type FormEvent } from 'react'
import { getApiErrorMessage } from '../services/api'
import { adminApi } from '../services/api/admin'
import './ResetPasswordDialog.css'

interface Props {
  userId: number
  username: string
  onClose: () => void
  onSuccess: () => void
}

/** 管理员重置指定用户密码：无需旧密码，需两次输入一致 */
export default function ResetPasswordDialog({ userId, username, onClose, onSuccess }: Props) {
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
      await adminApi.resetUserPassword(userId, newPassword)
      setDone(true)
      onSuccess()
    } catch (err) {
      setError(getApiErrorMessage(err, '重置密码失败，请稍后重试'))
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
        aria-label="重置用户密码"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 className="pwd-title">重置「{username}」的密码</h2>
        {done ? (
          <>
            <p className="pwd-done" role="status">密码已重置，请告知该用户使用新密码登录。</p>
            <p className="pwd-hint">该用户原有的登录令牌仍然有效，直到过期或被停用。</p>
            <button type="button" className="pwd-submit" onClick={onClose}>完成</button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <p className="pwd-error" role="alert">{error}</p>}
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
                {busy ? '重置中…' : '确认重置'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
