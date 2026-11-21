/**
 * 学习进度云端同步
 *
 * - 登录/启动后拉取服务端数据，与本地 localStorage 合并（本地优先保留更"新"的部分）
 * - 本地变更后防抖上报；离线或失败时静默保留本地数据，下次登录再补传
 * - localStorage 仍是离线缓存与首屏数据源，服务端是跨设备真相
 */
import { useAuthStore } from '../stores/authStore'
import { useMasteryStore } from '../world2d/store'
import { authApi, CloudProgress } from './api/auth'
import {
  getLearningProgress,
  importLearningProgress,
  LEARNING_PROGRESS_VERSION,
} from '../hooks/useLearningProgress'

const PUSH_DEBOUNCE_MS = 1200

let pushTimer: ReturnType<typeof setTimeout> | null = null
let pulling = false

type MasteryState = {
  topics: Record<string, { answered: number; correct: number; wrong: string[] }>
  sessions: number
  bestStreak: number
  trialBest: number
  maxMpBonus: number
  maxHpBonus: number
  mastered: string[]
  adept: string[]
}

function readLocalMastery(): MasteryState | null {
  const s = useMasteryStore.getState()
  return {
    topics: s.topics,
    sessions: s.sessions,
    bestStreak: s.bestStreak,
    trialBest: s.trialBest,
    maxMpBonus: s.maxMpBonus,
    maxHpBonus: s.maxHpBonus,
    mastered: s.mastered,
    adept: s.adept,
  }
}

/** 合并两份掌握度：计数取大、列表取并集，避免跨设备丢数据 */
function mergeMastery(local: MasteryState, remote: MasteryState): MasteryState {
  const topics: MasteryState['topics'] = {}
  const keys = new Set([...Object.keys(local.topics || {}), ...Object.keys(remote.topics || {})])
  keys.forEach((k) => {
    const l = local.topics?.[k] ?? { answered: 0, correct: 0, wrong: [] }
    const r = remote.topics?.[k] ?? { answered: 0, correct: 0, wrong: [] }
    topics[k] = {
      answered: Math.max(l.answered || 0, r.answered || 0),
      correct: Math.max(l.correct || 0, r.correct || 0),
      wrong: Array.from(new Set([...(l.wrong || []), ...(r.wrong || [])])),
    }
  })
  const uniq = (a?: string[], b?: string[]) => Array.from(new Set([...(a || []), ...(b || [])]))
  return {
    topics,
    sessions: Math.max(local.sessions || 0, remote.sessions || 0),
    bestStreak: Math.max(local.bestStreak || 0, remote.bestStreak || 0),
    trialBest: Math.max(local.trialBest || 0, remote.trialBest || 0),
    maxMpBonus: Math.max(local.maxMpBonus || 0, remote.maxMpBonus || 0),
    maxHpBonus: Math.max(local.maxHpBonus || 0, remote.maxHpBonus || 0),
    mastered: uniq(local.mastered, remote.mastered),
    adept: uniq(local.adept, remote.adept),
  }
}

function safeParse<T>(raw: string | undefined | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function snapshotPayload(): { mastery: string; progress: string } | null {
  const localMastery = readLocalMastery()
  if (!localMastery) return null
  // Zustand persist 把 state 包在 {state, version} 里
  const mastery = JSON.stringify({ state: localMastery, version: 0 })
  const progress = JSON.stringify(getLearningProgress())
  return { mastery, progress }
}

/** 防抖上报当前本地数据；force 用于拉取合并后跳过 pulling 守卫 */
export function schedulePush(force = false) {
  if (!useAuthStore.getState().token || (pulling && !force)) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(async () => {
    pushTimer = null
    const payload = snapshotPayload()
    if (!payload || !useAuthStore.getState().token) return
    try {
      await authApi.saveProgress(payload.mastery, payload.progress)
    } catch {
      // 离线/失败：保留本地，下次登录或变更会重试
    }
  }, PUSH_DEBOUNCE_MS)
}

/** 拉取并与本地合并；应在登录后调用 */
export async function pullAndMerge(): Promise<void> {
  if (!useAuthStore.getState().token || pulling) return
  pulling = true
  try {
    const cloud: CloudProgress | null = await authApi.getProgress()
    if (!cloud) {
      // 首次使用：把本地已有数据作为初始版本推上去
      schedulePush(true)
      return
    }
    const remoteMastery = safeParse<{ state?: MasteryState }>(cloud.mastery)?.state ?? null
    const localMastery = readLocalMastery()
    if (remoteMastery && localMastery) {
      const merged = mergeMastery(localMastery, remoteMastery)
      useMasteryStore.setState(merged)
    }
    const remoteProgress = safeParse<Record<string, unknown>>(cloud.progress)
    if (remoteProgress && remoteProgress.version === LEARNING_PROGRESS_VERSION) {
      const localProgress = getLearningProgress()
      // 近期访问与时间取并集后按时间排序，收藏取并集
      const mergedProgress = {
        version: LEARNING_PROGRESS_VERSION,
        favorites: Array.from(new Set([...localProgress.favorites, ...((remoteProgress.favorites as string[]) || [])])),
        recent: [...localProgress.recent, ...((remoteProgress.recent as Array<{ id: string; visitedAt: number }>) || [])]
          .sort((a, b) => b.visitedAt - a.visitedAt)
          .slice(0, 6),
      }
      importLearningProgress(mergedProgress)
    }
    // 合并结果再次上报，保证服务端拿到最新全量
    schedulePush(true)
  } catch {
    // 拉取失败不影响本地使用
  } finally {
    pulling = false
  }
}
