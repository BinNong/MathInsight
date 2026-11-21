/**
 * 认证相关类型与 API
 */
export interface AuthUser {
  id: number
  username: string
  created_at?: string
  is_active?: boolean
  is_admin?: boolean
}

export interface AuthResult {
  token: string
  user: AuthUser
}

export interface RegisterRequest {
  username: string
  password: string
  confirm_password: string
  invite_code: string
}

export interface LoginRequest {
  username: string
  password: string
}

import { client } from './client'

const API_BASE = '/auth'

export interface CloudProgress {
  mastery: string
  progress: string
  updated_at?: string
}

export interface ChangePasswordRequest {
  old_password: string
  new_password: string
}

export const authApi = {
  async register(data: RegisterRequest): Promise<AuthResult> {
    const response = await client.post(`${API_BASE}/register`, data)
    return response.data.data
  },

  async login(data: LoginRequest): Promise<AuthResult> {
    const response = await client.post(`${API_BASE}/login`, data)
    return response.data.data
  },

  async me(): Promise<AuthUser> {
    const response = await client.get(`${API_BASE}/me`)
    return response.data.data
  },

  async logout(): Promise<void> {
    await client.post(`${API_BASE}/logout`)
  },

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await client.post(`${API_BASE}/change-password`, data)
  },

  async getProgress(): Promise<CloudProgress | null> {
    const response = await client.get(`${API_BASE}/progress`)
    return response.data.data
  },

  async saveProgress(mastery: string, progress: string): Promise<CloudProgress> {
    const response = await client.put(`${API_BASE}/progress`, { mastery, progress })
    return response.data.data
  },
}
