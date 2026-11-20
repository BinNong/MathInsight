/**
 * 认证相关类型与 API
 */
export interface AuthUser {
  id: number
  username: string
  created_at?: string
}

export interface AuthResult {
  token: string
  user: AuthUser
}

export interface RegisterRequest {
  username: string
  password: string
  invite_code: string
}

export interface LoginRequest {
  username: string
  password: string
}

import { client } from './client'

const API_BASE = '/auth'

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
}
