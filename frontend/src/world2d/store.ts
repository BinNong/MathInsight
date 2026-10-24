import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { HudSnapshot, QuizQuestion } from './engine/combat'
import type { HallId } from './data/questions'

export interface OverlayTarget {
  route: string
  title: string
}

export interface QuizState extends QuizQuestion {
  /** 答题回调：correct = 是否答对 */
  resolve: (correct: boolean) => void
}

/** 修炼结算奖励（Training UI → store → loop 应用到 combat） */
export interface TrainingReward {
  mp: number
  score: number
  buffSec: number
}

interface World2DState {
  started: boolean
  overlay: OverlayTarget | null
  dialogNpc: string | null
  prompt: string | null
  objective: string
  quiz: QuizState | null
  combatHud: HudSnapshot | null
  /** 修炼答题（打开时冻结世界） */
  training: { hall: HallId } | null
  /** 修炼奖励待应用（loop 消费后置空） */
  trainingReward: TrainingReward | null
  /** 修炼手札面板 */
  codex: boolean
  setStarted: (v: boolean) => void
  openOverlay: (t: OverlayTarget) => void
  closeOverlay: () => void
  setDialogNpc: (id: string | null) => void
  setPrompt: (p: string | null) => void
  setObjective: (o: string) => void
  setQuiz: (q: QuizState | null) => void
  setCombatHud: (h: HudSnapshot) => void
  setTraining: (t: { hall: HallId } | null) => void
  setTrainingReward: (r: TrainingReward | null) => void
  setCodex: (v: boolean) => void
}

export const useWorld2DStore = create<World2DState>((set) => ({
  started: false,
  overlay: null,
  dialogNpc: null,
  prompt: null,
  objective: '探索微积分大陆：拜访导师、进屋答题修炼，当心森林里的混沌兽',
  quiz: null,
  combatHud: null,
  training: null,
  trainingReward: null,
  codex: false,
  setStarted: (v) => set({ started: v }),
  openOverlay: (t) => set({ overlay: t }),
  closeOverlay: () => set({ overlay: null }),
  setDialogNpc: (id) => set({ dialogNpc: id }),
  setPrompt: (p) => set({ prompt: p }),
  setObjective: (o) => set({ objective: o }),
  setQuiz: (q) => set({ quiz: q }),
  setCombatHud: (h) => set({ combatHud: h }),
  setTraining: (t) => set({ training: t }),
  setTrainingReward: (r) => set({ trainingReward: r }),
  setCodex: (v) => set({ codex: v }),
}))

// ------------------------------------------------------------------
// 修炼掌握度（localStorage 持久化）
// ------------------------------------------------------------------

export interface TopicProgress {
  answered: number
  correct: number
  /** 错题 id 列表（答对后自动移除） */
  wrong: string[]
}

interface MasteryState {
  topics: Record<string, TopicProgress>
  sessions: number
  bestStreak: number
  /** 精通（lv3）奖励：每个知识点首次精通 +10 灵感上限 */
  maxMpBonus: number
  /** 熟练（lv2）+10 / 精通（lv3）再 +10：生命上限加成 */
  maxHpBonus: number
  /** 已发放过精通奖励的知识点 */
  mastered: string[]
  /** 已发放过熟练奖励的知识点 */
  adept: string[]
  /** 记录一题作答；返回该知识点是否「首次熟练/首次精通」 */
  record: (topicId: string, questionId: string, correct: boolean, streak: number) => { newlyAdept: boolean; newlyMastered: boolean }
  finishSession: () => void
  reset: () => void
}

export const useMasteryStore = create<MasteryState>()(
  persist(
    (set, get) => ({
      topics: {},
      sessions: 0,
      bestStreak: 0,
      maxMpBonus: 0,
      maxHpBonus: 0,
      mastered: [],
      adept: [],
      record: (topicId, questionId, correct, streak) => {
        const s = get()
        const prev = s.topics[topicId] ?? { answered: 0, correct: 0, wrong: [] }
        const wrong = correct ? prev.wrong.filter((id) => id !== questionId) : prev.wrong.includes(questionId) ? prev.wrong : [...prev.wrong, questionId]
        const next: TopicProgress = {
          answered: prev.answered + 1,
          correct: prev.correct + (correct ? 1 : 0),
          wrong,
        }
        const lv = masteryLevel(next)
        const newlyMastered = lv === 3 && !s.mastered.includes(topicId)
        const newlyAdept = lv >= 2 && !s.adept.includes(topicId)
        set({
          topics: { ...s.topics, [topicId]: next },
          bestStreak: Math.max(s.bestStreak, streak),
          maxMpBonus: s.maxMpBonus + (newlyMastered ? 10 : 0),
          maxHpBonus: s.maxHpBonus + (newlyAdept ? 10 : 0) + (newlyMastered ? 10 : 0),
          mastered: newlyMastered ? [...s.mastered, topicId] : s.mastered,
          adept: newlyAdept ? [...s.adept, topicId] : s.adept,
        })
        return { newlyAdept, newlyMastered }
      },
      finishSession: () => set((s) => ({ sessions: s.sessions + 1 })),
      reset: () => set({ topics: {}, sessions: 0, bestStreak: 0, maxMpBonus: 0, maxHpBonus: 0, mastered: [], adept: [] }),
    }),
    { name: 'mathinsight-calc-mastery' }
  )
)

/** 掌握度等级：0 未修炼 / 1 初窥 / 2 熟练 / 3 精通 */
export function masteryLevel(p: TopicProgress | undefined): 0 | 1 | 2 | 3 {
  if (!p || p.answered === 0) return 0
  const acc = p.correct / p.answered
  if (p.answered >= 6 && acc >= 0.85) return 3
  if (p.answered >= 4 && acc >= 0.6) return 2
  return 1
}

export const MASTERY_LABEL = ['未修炼', '初窥', '熟练', '精通'] as const
