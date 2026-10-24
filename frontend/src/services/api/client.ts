import axios, { AxiosError } from 'axios'

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

client.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string }>) => {
    const message = error.response?.data?.error || error.message || '网络请求失败'
    return Promise.reject(new ApiError(message, error.response?.status, error))
  }
)
