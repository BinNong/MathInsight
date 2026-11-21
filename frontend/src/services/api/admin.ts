/**
 * 管理员接口：用户管理、邀请码管理与概览数据。
 * 后端会二次校验 is_admin，前端隐藏入口只是体验优化，不是安全边界。
 */
import { client } from './client'

export interface AdminSummary {
  users: number
  active_users: number
  admins: number
  invites: number
  used_invites: number
}

export interface AdminUser {
  id: number
  username: string
  created_at?: string
  is_active: boolean
  is_admin: boolean
  invite?: {
    code: string
    note: string | null
    created_at: string
    used_at: string | null
  } | null
}

export interface AdminInvite {
  code: string
  note: string | null
  created_at: string
  used_at: string | null
  used_by_username: string | null
  is_used: boolean
}

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export const adminApi = {
  async summary(): Promise<AdminSummary> {
    const response = await client.get('/admin/summary')
    return response.data.data
  },

  async users(params: {
    q?: string
    page?: number
    page_size?: number
    include_inactive?: boolean
  } = {}): Promise<PagedResult<AdminUser>> {
    const response = await client.get('/admin/users', { params })
    return response.data.data
  },

  async updateUser(id: number, payload: Partial<Pick<AdminUser, 'is_active' | 'is_admin'>>): Promise<AdminUser> {
    const response = await client.patch(`/admin/users/${id}`, payload)
    return response.data.data
  },

  async deleteUser(id: number): Promise<void> {
    await client.delete(`/admin/users/${id}`)
  },

  async resetUserPassword(id: number, newPassword: string): Promise<void> {
    await client.post(`/admin/users/${id}/reset-password`, { new_password: newPassword })
  },

  async invites(params: {
    q?: string
    page?: number
    page_size?: number
  } = {}): Promise<PagedResult<AdminInvite>> {
    const response = await client.get('/admin/invites', { params })
    return response.data.data
  },

  async createInvites(count: number, note?: string): Promise<{ codes: string[]; count: number }> {
    const response = await client.post('/admin/invites', { count, note })
    return response.data.data
  },

  async revokeInvite(code: string): Promise<void> {
    await client.delete(`/admin/invites/${encodeURIComponent(code)}`)
  },
}
