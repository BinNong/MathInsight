import { useEffect, useRef, useState, useCallback } from 'react'
import {
  manimApi,
  GenerateAnimationRequest,
  GenerateAnimationResponse,
} from '../services/api/manim'
import {
  useManimTaskStore,
  isTerminalStatus,
  ManimTask,
  TaskStatus,
} from '../stores/manimTaskStore'

export type { ManimTask, TaskStatus }

export interface UseManimTaskState {
  task: ManimTask | null
  loading: boolean
  error: string | null
  videoUrl: string | null
  subtitleUrl: string | null
  generatedCode: string | null
  renderLog: string | null
  createTask: (data: GenerateAnimationRequest) => Promise<void>
  cancelTask: () => Promise<void>
  reset: () => void
  fetchCodeLog: () => Promise<void>
}

const POLL_INTERVAL_MS = 2000

/**
 * Manim 任务 hook：状态存于全局持久化 store（见 stores/manimTaskStore），
 * 本 hook 只负责轮询生命周期。组件卸载仅停止本地轮询，
 * 服务端任务继续运行；重新挂载时若任务未结束则自动恢复轮询。
 */
export function useManimTask(): UseManimTaskState {
  const task = useManimTaskStore((s) => s.task)
  const error = useManimTaskStore((s) => s.error)
  const videoUrl = useManimTaskStore((s) => s.videoUrl)
  const subtitleUrl = useManimTaskStore((s) => s.subtitleUrl)
  const generatedCode = useManimTaskStore((s) => s.generatedCode)
  const renderLog = useManimTaskStore((s) => s.renderLog)

  const [loading, setLoading] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const clearPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  const fetchCodeLog = useCallback(async () => {
    const currentTask = useManimTaskStore.getState().task
    if (!currentTask) return
    try {
      const response = await manimApi.getTaskCode(currentTask.task_id)
      if (response.success) {
        useManimTaskStore.getState().setCodeLog(
          response.generated_code || null,
          response.render_log || null
        )
      }
    } catch (err: any) {
      // 获取代码/日志失败不阻断主流程
      console.warn('获取任务代码/日志失败:', err)
    }
  }, [])

  const startPolling = useCallback(
    (taskId: string) => {
      clearPolling()
      abortControllerRef.current = new AbortController()

      const poll = async () => {
        try {
          const response = await manimApi.getTaskStatus(taskId, abortControllerRef.current?.signal)
          if (response.success && response.task) {
            const store = useManimTaskStore.getState()
            store.setTask(response.task)

            if (response.task.status === 'SUCCESS' && response.task.result?.video_url) {
              store.setResult({
                videoUrl: response.task.result.video_url,
                subtitleUrl: response.task.result.subtitle_url || null,
              })
              setLoading(false)
              clearPolling()
              // 成功后拉取代码（成功时日志通常为空）
              try {
                const codeResponse = await manimApi.getTaskCode(taskId)
                if (codeResponse.success) {
                  store.setCodeLog(codeResponse.generated_code || null, null)
                }
              } catch {
                // ignore
              }
            } else if (response.task.status === 'FAILED' || response.task.status === 'CANCELLED') {
              store.setError(response.task.error || response.task.stage_message || '任务失败')
              setLoading(false)
              clearPolling()
              // 失败/取消后拉取代码与日志，便于排查
              try {
                const codeResponse = await manimApi.getTaskCode(taskId)
                if (codeResponse.success) {
                  store.setCodeLog(
                    codeResponse.generated_code || null,
                    codeResponse.render_log || null
                  )
                }
              } catch {
                // ignore
              }
            }
          }
        } catch (err: any) {
          // 忽略取消请求导致的错误
          if (err.name === 'AbortError' || err.message === 'canceled') {
            return
          }
          useManimTaskStore.getState().setError(err.message || '查询任务状态失败')
          setLoading(false)
          clearPolling()
        }
      }

      poll()
      intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)
    },
    [clearPolling]
  )

  const createTask = useCallback(
    async (data: GenerateAnimationRequest) => {
      const store = useManimTaskStore.getState()
      store.reset()
      setLoading(true)

      try {
        const response: GenerateAnimationResponse = await manimApi.generateAnimation(data)
        if (!response.success || !response.task_id) {
          store.setError(response.error || '创建任务失败')
          setLoading(false)
          return
        }

        // 立即设置一个初始任务对象，避免 UI 闪烁
        store.setTask({
          task_id: response.task_id,
          description: data.description,
          resolution: data.resolution || '720p',
          fps: data.fps || 30,
          status: 'PENDING',
          created_at: Date.now() / 1000,
          updated_at: Date.now() / 1000,
          iterations: 0,
          stage_message: '任务已创建，等待开始',
          progress_percent: 5,
          cache_hit: false,
        })

        startPolling(response.task_id)
      } catch (err: any) {
        store.setError(err.message || '创建任务失败')
        setLoading(false)
      }
    },
    [startPolling]
  )

  const cancelTask = useCallback(async () => {
    const currentTask = useManimTaskStore.getState().task
    if (!currentTask) return
    try {
      await manimApi.cancelTask(currentTask.task_id)
      // 轮询会自动更新最终状态
    } catch (err: any) {
      useManimTaskStore.getState().setError(err.message || '取消任务失败')
    }
  }, [])

  const reset = useCallback(() => {
    clearPolling()
    setLoading(false)
    useManimTaskStore.getState().reset()
  }, [clearPolling])

  // 挂载时：若 store 中存在未结束的任务（例如从其他页面返回），恢复轮询；
  // 卸载时仅停止本地轮询，服务端任务继续运行。
  useEffect(() => {
    const currentTask = useManimTaskStore.getState().task
    if (currentTask && !isTerminalStatus(currentTask.status) && !intervalRef.current) {
      setLoading(true)
      startPolling(currentTask.task_id)
    }
    return () => {
      clearPolling()
      setLoading(false)
    }
  }, [clearPolling, startPolling])

  return {
    task,
    loading,
    error,
    videoUrl,
    subtitleUrl,
    generatedCode,
    renderLog,
    createTask,
    cancelTask,
    reset,
    fetchCodeLog,
  }
}
