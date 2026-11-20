import { useEffect, useRef, useCallback } from 'react'
import {
  manimApi,
  GenerateAnimationRequest,
  GenerateAnimationResponse,
} from '../services/api/manim'
import {
  useManimTaskStore,
  getManimTaskScope,
  isTerminalStatus,
  ManimTask,
  ManimTaskSource,
  TaskStatus,
} from '../stores/manimTaskStore'

export type { ManimTask, TaskStatus }

export interface UseManimTaskOptions {
  source: ManimTaskSource
  sessionId?: string
}

export interface CreateManimTaskOptions {
  step?: number | null
}

export interface UseManimTaskState {
  task: ManimTask | null
  activeStep: number | null
  loading: boolean
  error: string | null
  videoUrl: string | null
  subtitleUrl: string | null
  generatedCode: string | null
  renderLog: string | null
  createTask: (data: GenerateAnimationRequest, options?: CreateManimTaskOptions) => Promise<void>
  cancelTask: () => Promise<void>
  reset: () => void
  fetchCodeLog: () => Promise<void>
}

const POLL_INTERVAL_MS = 2000

function isCurrentTask(scope: string, generation: number, taskId?: string): boolean {
  const session = useManimTaskStore.getState().sessions[scope]
  if (!session || session.generation !== generation) return false
  return !taskId || session.task?.task_id === taskId
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

export function useManimTask(
  options: UseManimTaskOptions = { source: 'manim' }
): UseManimTaskState {
  const source = options.source
  const sessionId = options.sessionId || 'default'
  const scope = getManimTaskScope(source, sessionId)
  const session = useManimTaskStore((state) => state.sessions[scope])

  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(false)
  const activeScopeRef = useRef(scope)
  activeScopeRef.current = scope

  const clearPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  const finishPolling = useCallback(
    (targetScope: string, generation: number) => {
      if (!isCurrentTask(targetScope, generation)) return
      useManimTaskStore.getState().setActive(targetScope, generation, false)
      if (activeScopeRef.current === targetScope) clearPolling()
    },
    [clearPolling]
  )

  const loadCodeLog = useCallback(
    async (targetScope: string, generation: number, taskId: string) => {
      try {
        const response = await manimApi.getTaskCode(taskId)
        if (response.success && isCurrentTask(targetScope, generation, taskId)) {
          useManimTaskStore
            .getState()
            .setCodeLog(
              targetScope,
              generation,
              response.generated_code || null,
              response.render_log || null
            )
        }
      } catch {
        // 代码和日志是附加信息，不影响任务结果。
      }
    },
    []
  )

  const fetchCodeLog = useCallback(async () => {
    const current = useManimTaskStore.getState().sessions[scope]
    if (!current?.task) return
    await loadCodeLog(scope, current.generation, current.task.task_id)
  }, [loadCodeLog, scope])

  const startPolling = useCallback(
    (targetScope: string, generation: number, taskId: string) => {
      clearPolling()
      const controller = new AbortController()
      abortControllerRef.current = controller

      const poll = async () => {
        if (controller.signal.aborted || !isCurrentTask(targetScope, generation, taskId)) return

        try {
          const response = await manimApi.getTaskStatus(taskId, controller.signal)
          if (controller.signal.aborted || !isCurrentTask(targetScope, generation, taskId)) return

          const store = useManimTaskStore.getState()
          if (!response.success || !response.task) {
            store.setError(targetScope, generation, response.error || '查询任务状态失败，请重试')
            finishPolling(targetScope, generation)
            return
          }
          if (response.task.task_id !== taskId) {
            store.setError(targetScope, generation, '任务状态不匹配，请重新生成')
            finishPolling(targetScope, generation)
            return
          }

          store.setTask(targetScope, generation, response.task)

          if (response.task.status === 'SUCCESS') {
            if (response.task.result?.video_url) {
              store.setResult(targetScope, generation, {
                videoUrl: response.task.result.video_url,
                subtitleUrl: response.task.result.subtitle_url || null,
              })
            } else {
              store.setError(targetScope, generation, '任务已完成，但未返回视频地址')
            }
            finishPolling(targetScope, generation)
            void loadCodeLog(targetScope, generation, taskId)
            return
          }

          if (response.task.status === 'FAILED' || response.task.status === 'CANCELLED') {
            if (response.task.status === 'FAILED') {
              store.setError(
                targetScope,
                generation,
                response.task.error || response.task.stage_message || '生成失败'
              )
            } else {
              store.setError(targetScope, generation, null)
            }
            finishPolling(targetScope, generation)
            void loadCodeLog(targetScope, generation, taskId)
            return
          }

          if (mountedRef.current && activeScopeRef.current === targetScope) {
            pollTimeoutRef.current = setTimeout(() => void poll(), POLL_INTERVAL_MS)
          }
        } catch (error: unknown) {
          if (controller.signal.aborted) return
          if (!isCurrentTask(targetScope, generation, taskId)) return
          useManimTaskStore
            .getState()
            .setError(targetScope, generation, getErrorMessage(error) || '查询任务状态失败')
          finishPolling(targetScope, generation)
        }
      }

      void poll()
    },
    [clearPolling, finishPolling, loadCodeLog]
  )

  const createTask = useCallback(
    async (data: GenerateAnimationRequest, createOptions?: CreateManimTaskOptions) => {
      const store = useManimTaskStore.getState()
      const previous = store.sessions[scope]
      if (previous?.active) return

      const previousTask = previous?.task
      const generation = store.startTask(scope, {
        source,
        sessionId,
        step: createOptions?.step ?? null,
      })

      if (previousTask && !isTerminalStatus(previousTask.status)) {
        void manimApi.cancelTask(previousTask.task_id).catch(() => undefined)
      }

      try {
        const response: GenerateAnimationResponse = await manimApi.generateAnimation(data)
        if (!isCurrentTask(scope, generation)) return
        if (!response.success || !response.task_id) {
          store.setError(scope, generation, response.error || '创建任务失败')
          store.setActive(scope, generation, false)
          return
        }

        const now = Date.now() / 1000
        store.setTask(scope, generation, {
          task_id: response.task_id,
          description: data.description,
          resolution: data.resolution || '720p',
          fps: data.fps || 30,
          status: 'PENDING',
          created_at: now,
          updated_at: now,
          iterations: 0,
          stage_message: '任务已创建，等待开始',
          progress_percent: 5,
          cache_hit: false,
        })

        if (mountedRef.current && activeScopeRef.current === scope) {
          startPolling(scope, generation, response.task_id)
        }
      } catch (error: unknown) {
        if (!isCurrentTask(scope, generation)) return
        store.setError(scope, generation, getErrorMessage(error) || '创建任务失败')
        store.setActive(scope, generation, false)
      }
    },
    [scope, sessionId, source, startPolling]
  )

  const cancelTask = useCallback(async () => {
    const current = useManimTaskStore.getState().sessions[scope]
    const currentTask = current?.task
    if (!current || !currentTask || !current.active) return
    const { generation } = current

    try {
      const response = await manimApi.cancelTask(currentTask.task_id)
      if (!isCurrentTask(scope, generation, currentTask.task_id)) return
      if (!response.success) {
        useManimTaskStore.getState().setError(scope, generation, response.error || '取消任务失败')
        return
      }

      useManimTaskStore.getState().setTask(scope, generation, {
        ...currentTask,
        status: 'CANCELLED',
        stage_message: '已取消',
        updated_at: Date.now() / 1000,
      })
      useManimTaskStore.getState().setError(scope, generation, null)
      finishPolling(scope, generation)
    } catch (error: unknown) {
      if (!isCurrentTask(scope, generation, currentTask.task_id)) return
      useManimTaskStore
        .getState()
        .setError(scope, generation, getErrorMessage(error) || '取消任务失败')
    }
  }, [finishPolling, scope])

  const reset = useCallback(() => {
    const current = useManimTaskStore.getState().sessions[scope]
    if (current?.task && !isTerminalStatus(current.task.status)) {
      void manimApi.cancelTask(current.task.task_id).catch(() => undefined)
    }
    useManimTaskStore.getState().reset(scope)
    if (activeScopeRef.current === scope) clearPolling()
  }, [clearPolling, scope])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    clearPolling()
    const current = useManimTaskStore.getState().sessions[scope]
    if (current?.active && current.task && !isTerminalStatus(current.task.status)) {
      startPolling(scope, current.generation, current.task.task_id)
    }
    return clearPolling
  }, [clearPolling, scope, startPolling])

  return {
    task: session?.task || null,
    activeStep: session?.step ?? null,
    loading: session?.active || false,
    error: session?.error || null,
    videoUrl: session?.videoUrl || null,
    subtitleUrl: session?.subtitleUrl || null,
    generatedCode: session?.generatedCode || null,
    renderLog: session?.renderLog || null,
    createTask,
    cancelTask,
    reset,
    fetchCodeLog,
  }
}
