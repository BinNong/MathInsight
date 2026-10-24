import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TaskStatus = 'PENDING' | 'GENERATING' | 'RENDERING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'

export interface ManimTask {
  task_id: string
  description: string
  resolution: string
  fps: number
  status: TaskStatus
  created_at: number
  updated_at: number
  iterations: number
  stage_message: string
  progress_percent: number
  cache_hit: boolean
  generated_code?: string
  render_log?: string
  result?: {
    success: boolean
    video_url: string
    iterations: number
    message: string
    resolution: string
    fps: number
    subtitle_url?: string
    estimated_duration?: number
    actual_duration?: number
    subtitle_count?: number
    subtitle_adjusted?: boolean
  }
  error?: string
}

export const TERMINAL_STATUSES: TaskStatus[] = ['SUCCESS', 'FAILED', 'CANCELLED']

export function isTerminalStatus(status: TaskStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

interface ManimTaskState {
  task: ManimTask | null
  error: string | null
  videoUrl: string | null
  subtitleUrl: string | null
  generatedCode: string | null
  renderLog: string | null
  setTask: (task: ManimTask | null) => void
  setError: (error: string | null) => void
  setResult: (result: {
    videoUrl: string | null
    subtitleUrl: string | null
    generatedCode?: string | null
    renderLog?: string | null
  }) => void
  setCodeLog: (code: string | null, log: string | null) => void
  reset: () => void
}

/**
 * 全局唯一的 Manim 任务状态，持久化到 localStorage。
 * 任务创建后在服务端独立运行，切换路由不丢失；
 * 重新进入页面时由 useManimTask 恢复轮询。
 */
export const useManimTaskStore = create<ManimTaskState>()(
  persist(
    (set) => ({
      task: null,
      error: null,
      videoUrl: null,
      subtitleUrl: null,
      generatedCode: null,
      renderLog: null,
      setTask: (task) => set({ task }),
      setError: (error) => set({ error }),
      setResult: ({ videoUrl, subtitleUrl, generatedCode, renderLog }) =>
        set((state) => ({
          videoUrl,
          subtitleUrl,
          generatedCode: generatedCode !== undefined ? generatedCode : state.generatedCode,
          renderLog: renderLog !== undefined ? renderLog : state.renderLog,
        })),
      setCodeLog: (code, log) => set({ generatedCode: code, renderLog: log }),
      reset: () =>
        set({
          task: null,
          error: null,
          videoUrl: null,
          subtitleUrl: null,
          generatedCode: null,
          renderLog: null,
        }),
    }),
    { name: 'mathinsight:manim-task' }
  )
)
