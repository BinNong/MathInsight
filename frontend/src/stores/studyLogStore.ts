/**
 * 每日学习记录（今日/本周练习量、连续学习天数）
 *
 * 只记录练习行为，不记录具体题目；按本地日期归档，最多保留 60 天。
 * 与掌握度、复习计划一起通过 progressSync 同步到云端。
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface DayStat {
  answered: number
  correct: number
}

interface StudyLogState {
  days: Record<string, DayStat>
  record: (correct: boolean) => void
  reset: () => void
}

/** 每周练习目标（题） */
export const WEEKLY_GOAL = 20
const MAX_DAYS = 60
const DAY_MS = 24 * 60 * 60 * 1000

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** 本地时区下的 YYYY-MM-DD */
export function dayKey(timestamp = Date.now()): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** 本周一 00:00（中国习惯以周一为一周开始） */
function startOfWeek(timestamp: number): number {
  const day = new Date(timestamp).getDay()
  const offset = (day + 6) % 7
  return startOfDay(timestamp) - offset * DAY_MS
}

function trimDays(days: Record<string, DayStat>): Record<string, DayStat> {
  const keys = Object.keys(days).sort()
  if (keys.length <= MAX_DAYS) return days
  const kept = keys.slice(-MAX_DAYS)
  return Object.fromEntries(kept.map((key) => [key, days[key]]))
}

export const useStudyLogStore = create<StudyLogState>()(
  persist(
    (set, get) => ({
      days: {},
      record: (correct) => {
        const key = dayKey()
        const prev = get().days[key] ?? { answered: 0, correct: 0 }
        const next = {
          ...get().days,
          [key]: {
            answered: prev.answered + 1,
            correct: prev.correct + (correct ? 1 : 0),
          },
        }
        set({ days: trimDays(next) })
      },
      reset: () => set({ days: {} }),
    }),
    { name: 'mathinsight-study-log' }
  )
)

/** 今天已练题数 */
export function todayAnswered(days: Record<string, DayStat>, now = Date.now()): number {
  return days[dayKey(now)]?.answered ?? 0
}

/** 本周（周一起）已练题数 */
export function weekAnswered(days: Record<string, DayStat>, now = Date.now()): number {
  const start = startOfWeek(now)
  return Object.entries(days).reduce((sum, [key, stat]) => {
    const dayStart = new Date(`${key}T00:00:00`).getTime()
    return dayStart >= start && dayStart <= now ? sum + stat.answered : sum
  }, 0)
}

/** 连续学习天数：今天没练时从昨天开始算，避免白天显示为 0 */
export function studyStreak(days: Record<string, DayStat>, now = Date.now()): number {
  let cursor = startOfDay(now)
  if ((days[dayKey(cursor)]?.answered ?? 0) === 0) {
    cursor -= DAY_MS
  }
  let streak = 0
  while ((days[dayKey(cursor)]?.answered ?? 0) > 0) {
    streak += 1
    cursor -= DAY_MS
  }
  return streak
}

/** 合并两份日志：同一天取较大值，避免多设备重复上报造成膨胀 */
export function mergeStudyDays(
  local: Record<string, DayStat>,
  remote: Record<string, DayStat>
): Record<string, DayStat> {
  const merged: Record<string, DayStat> = { ...local }
  Object.entries(remote).forEach(([key, stat]) => {
    const current = merged[key]
    merged[key] = {
      answered: Math.max(current?.answered ?? 0, stat.answered ?? 0),
      correct: Math.max(current?.correct ?? 0, stat.correct ?? 0),
    }
  })
  return trimDays(merged)
}

/**
 * 用已有的复习记录补一份历史练习量（仅首次启用学习日志时）。
 * 无法还原每次答题的对错，因此只补 answered，正确数保持 0。
 */
export function studyDaysFromReview(
  entries: Record<string, { lastReviewed?: number }>
): Record<string, DayStat> {
  const days: Record<string, DayStat> = {}
  Object.values(entries).forEach((entry) => {
    if (!entry?.lastReviewed) return
    const key = dayKey(entry.lastReviewed)
    const prev = days[key] ?? { answered: 0, correct: 0 }
    days[key] = { answered: prev.answered + 1, correct: prev.correct }
  })
  return trimDays(days)
}
