import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TaskStatus = 'PENDING' | 'GENERATING' | 'RENDERING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'
export type ManimTaskSource = 'manim' | 'solver'

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
  source?: ManimTaskSource
  sessionId?: string
  step?: number | null
  generation?: number
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

export interface ManimTaskSession {
  source: ManimTaskSource
  sessionId: string
  step: number | null
  generation: number
  active: boolean
  task: ManimTask | null
  error: string | null
  videoUrl: string | null
  subtitleUrl: string | null
  generatedCode: string | null
  renderLog: string | null
}

interface ManimTaskMetadata {
  source: ManimTaskSource
  sessionId: string
  step: number | null
}

interface ManimTaskState {
  sessions: Record<string, ManimTaskSession>
  startTask: (scope: string, metadata: ManimTaskMetadata) => number
  setActive: (scope: string, generation: number, active: boolean) => void
  setTask: (scope: string, generation: number, task: ManimTask) => void
  setError: (scope: string, generation: number, error: string | null) => void
  setResult: (
    scope: string,
    generation: number,
    result: {
      videoUrl: string | null
      subtitleUrl: string | null
      generatedCode?: string | null
      renderLog?: string | null
    }
  ) => void
  setCodeLog: (scope: string, generation: number, code: string | null, log: string | null) => void
  reset: (scope: string) => void
}

export const TERMINAL_STATUSES: TaskStatus[] = ['SUCCESS', 'FAILED', 'CANCELLED']

export function isTerminalStatus(status: TaskStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

export function getManimTaskScope(source: ManimTaskSource, sessionId = 'default'): string {
  return `${source}:${encodeURIComponent(sessionId)}`
}

function updateSession(
  state: ManimTaskState,
  scope: string,
  generation: number,
  update: (session: ManimTaskSession) => ManimTaskSession
): ManimTaskState {
  const session = state.sessions[scope]
  if (!session || session.generation !== generation) return state
  return { ...state, sessions: { ...state.sessions, [scope]: update(session) } }
}

function migratePersistedState(persistedState: unknown): Pick<ManimTaskState, 'sessions'> {
  if (!persistedState || typeof persistedState !== 'object') return { sessions: {} }

  const persisted = persistedState as Partial<ManimTaskState> & {
    task?: ManimTask | null
    error?: string | null
    videoUrl?: string | null
    subtitleUrl?: string | null
    generatedCode?: string | null
    renderLog?: string | null
  }

  if (persisted.sessions) return { sessions: persisted.sessions }
  if (!persisted.task) return { sessions: {} }

  const task = persisted.task
  const source: ManimTaskSource = task.source === 'solver' ? 'solver' : 'manim'
  const sessionId = task.sessionId || 'default'
  const generation = task.generation || 1
  const scope = getManimTaskScope(source, sessionId)

  return {
    sessions: {
      [scope]: {
        source,
        sessionId,
        step: typeof task.step === 'number' ? task.step : null,
        generation,
        active: !isTerminalStatus(task.status),
        task: { ...task, source, sessionId, generation },
        error: persisted.error || null,
        videoUrl: persisted.videoUrl || null,
        subtitleUrl: persisted.subtitleUrl || null,
        generatedCode: persisted.generatedCode || null,
        renderLog: persisted.renderLog || null,
      },
    },
  }
}

export const useManimTaskStore = create<ManimTaskState>()(
  persist(
    (set) => ({
      sessions: {},
      startTask: (scope, metadata) => {
        let generation = 1
        set((state) => {
          generation = (state.sessions[scope]?.generation || 0) + 1
          return {
            sessions: {
              ...state.sessions,
              [scope]: {
                ...metadata,
                generation,
                active: true,
                task: null,
                error: null,
                videoUrl: null,
                subtitleUrl: null,
                generatedCode: null,
                renderLog: null,
              },
            },
          }
        })
        return generation
      },
      setActive: (scope, generation, active) =>
        set((state) =>
          updateSession(state, scope, generation, (session) => ({ ...session, active }))
        ),
      setTask: (scope, generation, task) =>
        set((state) =>
          updateSession(state, scope, generation, (session) => {
            if (session.task && session.task.task_id !== task.task_id) return session
            if (session.task && isTerminalStatus(session.task.status)) return session
            return {
              ...session,
              task: {
                ...task,
                source: session.source,
                sessionId: session.sessionId,
                step: session.step,
                generation,
              },
            }
          })
        ),
      setError: (scope, generation, error) =>
        set((state) =>
          updateSession(state, scope, generation, (session) => ({ ...session, error }))
        ),
      setResult: (scope, generation, { videoUrl, subtitleUrl, generatedCode, renderLog }) =>
        set((state) =>
          updateSession(state, scope, generation, (session) => ({
            ...session,
            videoUrl,
            subtitleUrl,
            generatedCode: generatedCode !== undefined ? generatedCode : session.generatedCode,
            renderLog: renderLog !== undefined ? renderLog : session.renderLog,
          }))
        ),
      setCodeLog: (scope, generation, code, log) =>
        set((state) =>
          updateSession(state, scope, generation, (session) => ({
            ...session,
            generatedCode: code,
            renderLog: log,
          }))
        ),
      reset: (scope) =>
        set((state) => {
          const session = state.sessions[scope]
          if (!session) return state
          return {
            ...state,
            sessions: {
              ...state.sessions,
              [scope]: {
                ...session,
                generation: session.generation + 1,
                active: false,
                task: null,
                step: null,
                error: null,
                videoUrl: null,
                subtitleUrl: null,
                generatedCode: null,
                renderLog: null,
              },
            },
          }
        }),
    }),
    {
      name: 'mathinsight:manim-task',
      version: 1,
      migrate: (persistedState) => migratePersistedState(persistedState) as ManimTaskState,
    }
  )
)
