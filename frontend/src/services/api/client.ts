import axios, { AxiosError } from 'axios'
import { useAuthStore } from '../../stores/authStore'

/**
 * API 基础路径前缀
 */
export const API_PREFIX = '/mathinsight/api'

/**
 * 统一的 axios 实例
 *
 * 所有 API 调用都通过该实例发起，统一 baseURL、超时与错误处理。
 */
export const client = axios.create({
  baseURL: API_PREFIX,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * 归一化后的 API 错误：message 取后端返回的 error 字段，
 * status/cause 保留原始响应信息。
 */
export class ApiError extends Error {
  status?: number
  cause?: unknown

  constructor(message: string, status?: number, cause?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.cause = cause
  }
}

/**
 * 从任意异常中提取用户可读的错误信息（统一入口，替代各处
 * 手写的 `err.response?.data?.error || err.message` 链）。
 */
export function getApiErrorMessage(err: unknown, fallback = '操作失败，请稍后重试'): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err) return err
  return fallback
}

/**
 * 请求拦截器：注入登录令牌。
 * 后端还通过 httpOnly Cookie 兜底，因此媒体资源请求无需此拦截器也能鉴权。
 */
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string }>) => {
    const message = error.response?.data?.error || error.message || '网络请求失败'
    const status = error.response?.status

    // 登录态失效：清除本地令牌并跳转登录页（登录接口自身的 401 不处理）
    if (status === 401 && !error.config?.url?.startsWith('/auth/')) {
      useAuthStore.getState().logout()
      const current = window.location.pathname
      const loginPath = '/mathinsight/login'
      if (!current.startsWith(loginPath)) {
        window.location.assign(`${loginPath}?next=${encodeURIComponent(current + window.location.search)}`)
      }
    }

    return Promise.reject(new ApiError(message, status, error))
  }
)
