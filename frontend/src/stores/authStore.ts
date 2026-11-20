import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser } from '../services/api/auth'

interface AuthState {
  token: string | null
  user: AuthUser | null
  setAuth: (token: string, user: AuthUser) => void
  setUser: (user: AuthUser) => void
  logout: () => void
}

/**
 * 登录态。token 持久化到 localStorage，供 axios 请求拦截器注入。
 * 后端同时设置了 httpOnly Cookie，媒体资源（<video>）依赖它自动鉴权。
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'mathinsight:auth' }
  )
)
