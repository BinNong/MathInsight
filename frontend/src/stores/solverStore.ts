import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SolverResult, SolverSubject, SimilarProblem } from '../services/api/solver'

export interface FollowUpMessage {
  role: 'user' | 'assistant'
  text: string
}

interface SolverState {
  problem: string
  subject: SolverSubject
  result: SolverResult | null
  expandedSteps: number[]
  hints: Record<string, string>
  hintLevels: Record<number, 1 | 2 | 3>
  similarProblems: SimilarProblem[]
  followUpHistory: FollowUpMessage[]
  setProblem: (problem: string) => void
  setSubject: (subject: SolverSubject) => void
  setResult: (result: SolverResult | null) => void
  toggleStep: (index: number) => void
  setHint: (key: string, hint: string) => void
  setHintLevel: (stepIndex: number, level: 1 | 2 | 3) => void
  setSimilarProblems: (problems: SimilarProblem[]) => void
  addFollowUp: (message: FollowUpMessage) => void
  clearSession: (keepProblem?: boolean) => void
}

/**
 * 解题会话状态，持久化到 localStorage：
 * 切换路由后再回来，分析结果、提示、追问记录不丢失。
 */
export const useSolverStore = create<SolverState>()(
  persist(
    (set) => ({
      problem: '',
      subject: 'auto',
      result: null,
      expandedSteps: [],
      hints: {},
      hintLevels: {},
      similarProblems: [],
      followUpHistory: [],
      setProblem: (problem) => set({ problem }),
      setSubject: (subject) => set({ subject }),
      setResult: (result) => set({ result }),
      toggleStep: (index) =>
        set((state) => ({
          expandedSteps: state.expandedSteps.includes(index)
            ? state.expandedSteps.filter((i) => i !== index)
            : [...state.expandedSteps, index],
        })),
      setHint: (key, hint) => set((state) => ({ hints: { ...state.hints, [key]: hint } })),
      setHintLevel: (stepIndex, level) =>
        set((state) => ({ hintLevels: { ...state.hintLevels, [stepIndex]: level } })),
      setSimilarProblems: (similarProblems) => set({ similarProblems }),
      addFollowUp: (message) =>
        set((state) => ({ followUpHistory: [...state.followUpHistory, message] })),
      clearSession: (keepProblem = false) =>
        set((state) => ({
          problem: keepProblem ? state.problem : '',
          result: null,
          expandedSteps: [],
          hints: {},
          hintLevels: {},
          similarProblems: [],
          followUpHistory: [],
        })),
    }),
    { name: 'mathinsight:solver' }
  )
)
