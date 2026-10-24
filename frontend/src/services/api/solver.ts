import { client } from './client'
import { manimApi, GenerateAnimationRequest } from './manim'

export type SolverSubject = 'auto' | 'calculus' | 'linear-algebra' | 'probability'

export type StepVerification = 'verified' | 'failed' | 'unchecked'

export interface StepCheck {
  lhs: string
  rhs: string
}

export interface SolverStep {
  index: number
  title: string
  explanation: string
  formula?: string | null
  insight: string
  common_pitfall?: string | null
  check?: StepCheck | null
  verification?: StepVerification
}

export interface VisualizationSuggestion {
  title: string
  description: string
}

export interface SolverResult {
  topic: string
  difficulty: number
  restatement: string
  prerequisites: string[]
  steps: SolverStep[]
  final_answer: string
  follow_up_questions: string[]
  visualization_suggestions: VisualizationSuggestion[]
  answer_check?: StepCheck | null
  answer_verification?: StepVerification
}

export interface AnalyzeProblemRequest {
  problem: string
  subject?: SolverSubject
}

export interface HintRequest {
  problem: string
  current_step: number
  level: 1 | 2 | 3
}

export interface HintResponse {
  hint: string
  current_step: number
  level: number
}

export interface SimilarProblem {
  problem: string
  topic: string
  difficulty: number
  hint?: string | null
}

export interface SimilarRequest {
  problem: string
  topic: string
  count?: number
}

export interface SimilarResponse {
  problems: SimilarProblem[]
  count: number
}

const API_BASE = '/solver'

export const solverApi = {
  async analyze(
    data: AnalyzeProblemRequest
  ): Promise<{ success: boolean; data: SolverResult; error?: string }> {
    const response = await client.post(`${API_BASE}/analyze`, data)
    return response.data
  },

  async hint(data: HintRequest): Promise<{ success: boolean; data: HintResponse; error?: string }> {
    const response = await client.post(`${API_BASE}/hint`, data)
    return response.data
  },

  async similar(
    data: SimilarRequest
  ): Promise<{ success: boolean; data: SimilarResponse; error?: string }> {
    const response = await client.post(`${API_BASE}/similar`, data)
    return response.data
  },

  async visualize(data: GenerateAnimationRequest) {
    return manimApi.generateAnimation(data)
  },
}
