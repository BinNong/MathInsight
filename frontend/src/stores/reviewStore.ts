/**
 * 错题复习状态（间隔重复 / SM-2 简化版）
 *
 * 每道题记录：复习次数、熟练档位、下次到期时间。
 * - 答对：档位 +1，间隔按 1天 → 3天 → 7天 → 16天 → 35天 递增
 * - 答错：档位归 0，间隔重置为 10 分钟后（当天可再练）
 *
 * 与掌握度一样用 localStorage 持久化，并通过 progressSync 上报云端，
 * 换设备也能继续复习计划。
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ReviewEntry {
  /** 连续答对次数（档位） */
  streak: number
  /** 下次到期时间戳（毫秒） */
  dueAt: number
  /** 累计答对 / 答错 */
  correct: number
  wrong: number
  /** 最近一次复习时间 */
  lastReviewed: number
}

interface ReviewState {
  entries: Record<string, ReviewEntry>
  /** 记录一次作答，返回新的复习条目 */
  record: (questionId: string, correct: boolean) => ReviewEntry
  /** 只把错题/到期题纳入复习；由页面筛选 */
  dueQuestions: (ids: string[], now?: number) => string[]
  resetQuestion: (questionId: string) => void
  reset: () => void
}

const DAY = 24 * 60 * 60 * 1000
/** 各档位对应的复习间隔；超出时用最后一档 */
const INTERVALS_MS = [10 * 60 * 1000, DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY]
const MAX_LEVEL = INTERVALS_MS.length - 1

function nextEntry(prev: ReviewEntry | undefined, correct: boolean): ReviewEntry {
  const now = Date.now()
  const streak = correct ? Math.min(MAX_LEVEL, (prev?.streak ?? 0) + 1) : 0
  return {
    streak,
    dueAt: now + INTERVALS_MS[streak],
    correct: (prev?.correct ?? 0) + (correct ? 1 : 0),
    wrong: (prev?.wrong ?? 0) + (correct ? 0 : 1),
    lastReviewed: now,
  }
}

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      entries: {},
      record: (questionId, correct) => {
        const next = nextEntry(get().entries[questionId], correct)
        set((s) => ({ entries: { ...s.entries, [questionId]: next } }))
        return next
      },
      dueQuestions: (ids, now = Date.now()) =>
        ids.filter((id) => {
          const e = get().entries[id]
          return !e || e.streak === 0 || e.dueAt <= now
        }),
      resetQuestion: (questionId) =>
        set((s) => {
          const entries = { ...s.entries }
          delete entries[questionId]
          return { entries }
        }),
      reset: () => set({ entries: {} }),
    }),
    { name: 'mathinsight-review' }
  )
)

/** 人类可读的下次复习时间 */
export function formatDueAt(dueAt: number): string {
  const diff = dueAt - Date.now()
  if (diff <= 0) return '现在该复习'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} 分钟后`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时后`
  const days = Math.floor(hours / 24)
  return `${days} 天后`
}
