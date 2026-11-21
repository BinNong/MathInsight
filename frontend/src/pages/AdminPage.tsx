import { useCallback, useEffect, useState, type FormEvent } from 'react'
import PageHeader from '../components/PageHeader'
import ResetPasswordDialog from '../components/ResetPasswordDialog'
import { getApiErrorMessage } from '../services/api'
import {
  adminApi,
  type AdminInvite,
  type AdminSummary,
  type AdminUser,
  type PagedResult,
} from '../services/api/admin'
import { useAuthStore } from '../stores/authStore'
import './AdminPage.css'

type Tab = 'users' | 'invites'

const emptyUsers: PagedResult<AdminUser> = { items: [], total: 0, page: 1, page_size: 20 }
const emptyInvites: PagedResult<AdminInvite> = { items: [], total: 0, page: 1, page_size: 20 }

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

export default function AdminPage() {
  const currentUserId = useAuthStore((s) => s.user?.id)
  const [tab, setTab] = useState<Tab>('users')
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [users, setUsers] = useState<PagedResult<AdminUser>>(emptyUsers)
  const [invites, setInvites] = useState<PagedResult<AdminInvite>>(emptyInvites)
  const [userQuery, setUserQuery] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [inviteQuery, setInviteQuery] = useState('')
  const [inviteSearch, setInviteSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(true)
  const [userPage, setUserPage] = useState(1)
  const [invitePage, setInvitePage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [newCodes, setNewCodes] = useState<string[]>([])
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null)
  const [inviteCount, setInviteCount] = useState(5)
  const [inviteNote, setInviteNote] = useState('')

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await adminApi.summary())
    } catch (err) {
      setError(getApiErrorMessage(err, '加载概览失败'))
    }
  }, [])

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await adminApi.users({
        q: userSearch,
        page: userPage,
        page_size: 20,
        include_inactive: includeInactive,
      }))
    } catch (err) {
      setError(getApiErrorMessage(err, '加载用户列表失败'))
    }
  }, [userSearch, userPage, includeInactive])

  const loadInvites = useCallback(async () => {
    try {
      setInvites(await adminApi.invites({ q: inviteSearch, page: invitePage, page_size: 20 }))
    } catch (err) {
      setError(getApiErrorMessage(err, '加载邀请码失败'))
    }
  }, [inviteSearch, invitePage])

  useEffect(() => { void loadSummary() }, [loadSummary])
  useEffect(() => { void loadUsers() }, [loadUsers])
  useEffect(() => {
    if (tab === 'invites') void loadInvites()
  }, [tab, loadInvites])

  const refreshAll = async () => {
    await Promise.all([loadSummary(), loadUsers(), loadInvites()])
  }

  const runAction = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(message)
      await refreshAll()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleToggleRole = (user: AdminUser) => {
    const next = !user.is_admin
    void runAction(
      () => adminApi.updateUser(user.id, { is_admin: next }),
      `已将 ${user.username} ${next ? '设为管理员' : '改为普通用户'}。`,
    )
  }

  const handleToggleActive = (user: AdminUser) => {
    const next = !user.is_active
    void runAction(
      () => adminApi.updateUser(user.id, { is_active: next }),
      `已${next ? '启用' : '停用'} ${user.username} 的账号。`,
    )
  }

  const handleDeleteUser = (user: AdminUser) => {
    if (!window.confirm(`确定删除用户「${user.username}」吗？此操作不可撤销。`)) return
    void runAction(() => adminApi.deleteUser(user.id), `已删除用户 ${user.username}。`)
  }

  const handleCreateInvites = async (event: FormEvent) => {
    event.preventDefault()
    if (inviteCount < 1 || inviteCount > 100) {
      setError('生成数量需在 1 到 100 之间')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await adminApi.createInvites(inviteCount, inviteNote.trim() || undefined)
      setNewCodes(result.codes)
      setNotice(`已生成 ${result.count} 个邀请码。`)
      setInviteNote('')
      await refreshAll()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleRevokeInvite = (invite: AdminInvite) => {
    if (!window.confirm(`确定作废邀请码「${invite.code}」吗？`)) return
    void runAction(() => adminApi.revokeInvite(invite.code), `已作废邀请码 ${invite.code}。`)
  }

  const summaryCards = [
    { label: '用户总数', value: summary?.users ?? '—' },
    { label: '启用中', value: summary?.active_users ?? '—' },
    { label: '管理员', value: summary?.admins ?? '—' },
    {
      label: '邀请码',
      value: summary ? `${summary.used_invites} / ${summary.invites}` : '—',
      hint: '已用 / 总数',
    },
  ]

  return (
    <div className="admin-page">
      <PageHeader backTo="/" backLabel="返回工作台" title="管理后台" />

      {error && <div className="admin-alert admin-alert-error" role="alert">{error}</div>}
      {notice && <div className="admin-alert admin-alert-ok" role="status">{notice}</div>}

      <section className="admin-summary" aria-label="后台概览">
        {summaryCards.map((card) => (
          <div className="admin-summary-card" key={card.label}>
            <span className="admin-summary-label">{card.label}</span>
            <strong className="admin-summary-value">{card.value}</strong>
            {card.hint && <span className="admin-summary-hint">{card.hint}</span>}
          </div>
        ))}
      </section>

      <div className="admin-tabs" role="tablist" aria-label="管理功能">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'users'}
          className={tab === 'users' ? 'active' : ''}
          onClick={() => setTab('users')}
        >
          用户管理
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'invites'}
          className={tab === 'invites' ? 'active' : ''}
          onClick={() => setTab('invites')}
        >
          邀请码
        </button>
      </div>

      {tab === 'users' ? (
        <section className="admin-panel" role="tabpanel">
          <form
            className="admin-toolbar"
            onSubmit={(event) => {
              event.preventDefault()
              setUserPage(1)
              setUserSearch(userQuery.trim())
            }}
          >
            <input
              type="search"
              value={userQuery}
              onChange={(event) => setUserQuery(event.target.value)}
              placeholder="搜索用户名或 ID"
              aria-label="搜索用户"
            />
            <button type="submit" className="admin-button">搜索</button>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(event) => {
                  setIncludeInactive(event.target.checked)
                  setUserPage(1)
                }}
              />
              包含已停用
            </label>
            <span className="admin-total">共 {users.total} 个用户</span>
          </form>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>用户名</th>
                  <th>角色</th>
                  <th>状态</th>
                  <th>注册时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.items.length === 0 && (
                  <tr><td colSpan={6} className="admin-empty">没有符合条件的用户</td></tr>
                )}
                {users.items.map((user) => {
                  const isSelf = user.id === currentUserId
                  return (
                    <tr key={user.id}>
                      <td className="admin-id">{user.id}</td>
                      <td>
                        <strong>{user.username}</strong>
                        {isSelf && <span className="admin-self">当前账号</span>}
                      </td>
                      <td>
                        <span className={`admin-tag ${user.is_admin ? 'tag-admin' : ''}`}>
                          {user.is_admin ? '管理员' : '普通用户'}
                        </span>
                      </td>
                      <td>
                        <span className={`admin-tag ${user.is_active ? 'tag-active' : 'tag-inactive'}`}>
                          {user.is_active ? '启用' : '停用'}
                        </span>
                      </td>
                      <td className="admin-muted">{formatDate(user.created_at)}</td>
                      <td>
                        <div className="admin-actions">
                          <button
                            type="button"
                            className="admin-button admin-button-small"
                            disabled={busy || isSelf}
                            title={isSelf ? '不能操作自己的账号' : undefined}
                            onClick={() => handleToggleRole(user)}
                          >
                            {user.is_admin ? '取消管理员' : '设为管理员'}
                          </button>
                          <button
                            type="button"
                            className="admin-button admin-button-small"
                            disabled={busy || isSelf}
                            title={isSelf ? '不能操作自己的账号' : undefined}
                            onClick={() => handleToggleActive(user)}
                          >
                            {user.is_active ? '停用' : '启用'}
                          </button>
                          <button
                            type="button"
                            className="admin-button admin-button-small"
                            disabled={busy || isSelf}
                            title={isSelf ? '请用右上角「改密」修改自己的密码' : undefined}
                            onClick={() => setResetTarget(user)}
                          >
                            重置密码
                          </button>
                          <button
                            type="button"
                            className="admin-button admin-button-small admin-button-danger"
                            disabled={busy || isSelf}
                            title={isSelf ? '不能删除自己的账号' : undefined}
                            onClick={() => handleDeleteUser(user)}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="admin-pagination">
            <button
              type="button"
              className="admin-button admin-button-small"
              disabled={userPage <= 1}
              onClick={() => setUserPage((page) => page - 1)}
            >
              上一页
            </button>
            <span>第 {users.page} 页</span>
            <button
              type="button"
              className="admin-button admin-button-small"
              disabled={users.page * users.page_size >= users.total}
              onClick={() => setUserPage((page) => page + 1)}
            >
              下一页
            </button>
          </div>
        </section>
      ) : (
        <section className="admin-panel" role="tabpanel">
          <form className="admin-invite-form" onSubmit={handleCreateInvites}>
            <label>
              生成数量
              <input
                type="number"
                min={1}
                max={100}
                value={inviteCount}
                onChange={(event) => setInviteCount(Number(event.target.value))}
              />
            </label>
            <label className="admin-invite-note">
              备注（可选）
              <input
                type="text"
                value={inviteNote}
                maxLength={200}
                onChange={(event) => setInviteNote(event.target.value)}
                placeholder="例如：给 2026 级新生"
              />
            </label>
            <button type="submit" className="admin-button" disabled={busy}>生成邀请码</button>
          </form>

          {newCodes.length > 0 && (
            <div className="admin-new-codes" role="status">
              <strong>本次生成的邀请码（请立即复制保存）：</strong>
              <ul>
                {newCodes.map((code) => <li key={code}>{code}</li>)}
              </ul>
              <button type="button" className="admin-button admin-button-small" onClick={() => setNewCodes([])}>
                收起
              </button>
            </div>
          )}

          <form
            className="admin-toolbar"
            onSubmit={(event) => {
              event.preventDefault()
              setInvitePage(1)
              setInviteSearch(inviteQuery.trim())
            }}
          >
            <input
              type="search"
              value={inviteQuery}
              onChange={(event) => setInviteQuery(event.target.value)}
              placeholder="搜索邀请码、备注或使用人"
              aria-label="搜索邀请码"
            />
            <button type="submit" className="admin-button">搜索</button>
            <span className="admin-total">共 {invites.total} 个邀请码</span>
          </form>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>邀请码</th>
                  <th>备注</th>
                  <th>状态</th>
                  <th>使用人</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {invites.items.length === 0 && (
                  <tr><td colSpan={6} className="admin-empty">没有符合条件的邀请码</td></tr>
                )}
                {invites.items.map((invite) => (
                  <tr key={invite.code}>
                    <td className="admin-code">{invite.code}</td>
                    <td className="admin-muted">{invite.note || '—'}</td>
                    <td>
                      <span className={`admin-tag ${invite.is_used ? 'tag-inactive' : 'tag-active'}`}>
                        {invite.is_used ? '已使用' : '未使用'}
                      </span>
                    </td>
                    <td className="admin-muted">{invite.used_by_username || '—'}</td>
                    <td className="admin-muted">{formatDate(invite.created_at)}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-button admin-button-small admin-button-danger"
                        disabled={busy || invite.is_used}
                        onClick={() => handleRevokeInvite(invite)}
                      >
                        作废
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-pagination">
            <button
              type="button"
              className="admin-button admin-button-small"
              disabled={invitePage <= 1}
              onClick={() => setInvitePage((page) => page - 1)}
            >
              上一页
            </button>
            <span>第 {invites.page} 页</span>
            <button
              type="button"
              className="admin-button admin-button-small"
              disabled={invites.page * invites.page_size >= invites.total}
              onClick={() => setInvitePage((page) => page + 1)}
            >
              下一页
            </button>
          </div>
        </section>
      )}

      {resetTarget && (
        <ResetPasswordDialog
          userId={resetTarget.id}
          username={resetTarget.username}
          onClose={() => setResetTarget(null)}
          onSuccess={() => setNotice(`已重置 ${resetTarget.username} 的密码。`)}
        />
      )}
    </div>
  )
}
