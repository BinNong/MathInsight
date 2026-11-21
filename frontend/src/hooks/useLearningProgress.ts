import { useSyncExternalStore } from 'react'
import { getModuleById } from '../data/subjects'

export const LEARNING_PROGRESS_STORAGE_KEY = 'mathinsight.learning-progress'
export const LEARNING_PROGRESS_VERSION = 1

const MAX_RECENT_MODULES = 6

interface RecentModule {
  id: string
  visitedAt: number
}

interface LearningProgress {
  version: number
  recent: RecentModule[]
  favorites: string[]
}

const EMPTY_PROGRESS: LearningProgress = {
  version: LEARNING_PROGRESS_VERSION,
  recent: [],
  favorites: [],
}

const listeners = new Set<() => void>()
let snapshot: LearningProgress | undefined

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValidModuleId(value: unknown): value is string {
  return typeof value === 'string' && getModuleById(value) !== undefined
}

function parseProgress(serialized: string | null): LearningProgress {
  if (!serialized) return EMPTY_PROGRESS

  try {
    const value: unknown = JSON.parse(serialized)
    if (!isRecord(value) || value.version !== LEARNING_PROGRESS_VERSION) {
      return EMPTY_PROGRESS
    }

    const favorites = Array.isArray(value.favorites)
      ? Array.from(new Set(value.favorites.filter(isValidModuleId)))
      : []

    const recent: RecentModule[] = []
    if (Array.isArray(value.recent)) {
      const validEntries = value.recent
        .filter(
          (entry): entry is Record<string, unknown> =>
            isRecord(entry) &&
            isValidModuleId(entry.id) &&
            typeof entry.visitedAt === 'number' &&
            Number.isFinite(entry.visitedAt) &&
            entry.visitedAt > 0
        )
        .map((entry) => ({ id: entry.id as string, visitedAt: entry.visitedAt as number }))
        .sort((a, b) => b.visitedAt - a.visitedAt)

      const seen = new Set<string>()
      for (const entry of validEntries) {
        if (!seen.has(entry.id)) {
          seen.add(entry.id)
          recent.push(entry)
        }
      }
    }

    return {
      version: LEARNING_PROGRESS_VERSION,
      recent: recent.slice(0, MAX_RECENT_MODULES),
      favorites,
    }
  } catch {
    return EMPTY_PROGRESS
  }
}

function readStoredProgress(): LearningProgress {
  if (typeof window === 'undefined') return EMPTY_PROGRESS

  try {
    return parseProgress(window.localStorage.getItem(LEARNING_PROGRESS_STORAGE_KEY))
  } catch {
    return EMPTY_PROGRESS
  }
}

function getSnapshot(): LearningProgress {
  snapshot ??= readStoredProgress()
  return snapshot
}

function getServerSnapshot(): LearningProgress {
  return EMPTY_PROGRESS
}

function notifyListeners() {
  listeners.forEach((listener) => listener())
}

function handleStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== LEARNING_PROGRESS_STORAGE_KEY) return
  snapshot = parseProgress(event.newValue)
  notifyListeners()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage)
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage)
    }
  }
}

function commitProgress(next: LearningProgress) {
  snapshot = next
  try {
    window.localStorage.setItem(LEARNING_PROGRESS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // In-memory progress still works when storage is unavailable.
  }
  notifyListeners()
  window.dispatchEvent(new Event('mathinsight:progress-changed'))
}

function recordRecent(moduleId: string) {
  if (!isValidModuleId(moduleId)) return

  const current = getSnapshot()
  const recent = [
    { id: moduleId, visitedAt: Date.now() },
    ...current.recent.filter((entry) => entry.id !== moduleId),
  ].slice(0, MAX_RECENT_MODULES)

  commitProgress({ ...current, recent })
}

function toggleFavorite(moduleId: string) {
  if (!isValidModuleId(moduleId)) return

  const current = getSnapshot()
  const favorites = current.favorites.includes(moduleId)
    ? current.favorites.filter((id) => id !== moduleId)
    : [...current.favorites, moduleId]

  commitProgress({ ...current, favorites })
}

function clearProgress() {
  snapshot = EMPTY_PROGRESS
  try {
    window.localStorage.removeItem(LEARNING_PROGRESS_STORAGE_KEY)
  } catch {
    // Clearing the in-memory state is still useful without storage access.
  }
  notifyListeners()
  window.dispatchEvent(new Event('mathinsight:progress-changed'))
}

/** 读取当前进度快照（供云端同步使用） */
export function getLearningProgress(): LearningProgress {
  return getSnapshot()
}

/** 导入服务端进度（先校验），用于登录后合并。返回是否成功。 */
export function importLearningProgress(value: unknown): boolean {
  if (!isRecord(value) || value.version !== LEARNING_PROGRESS_VERSION) return false
  const parsed = parseProgress(JSON.stringify(value))
  snapshot = parsed
  try {
    window.localStorage.setItem(LEARNING_PROGRESS_STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    // 内存态仍可用
  }
  notifyListeners()
  return true
}

export function useLearningProgress() {
  const progress = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return {
    recent: progress.recent,
    favorites: progress.favorites,
    recordRecent,
    toggleFavorite,
    clearProgress,
  }
}
