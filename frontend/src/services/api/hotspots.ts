import { client } from './client'

export interface HotspotSummary {
  id: string
  date: string
  category: string
  branch: string
  topic: string
  headline: string
  summary: string
  concepts: string[]
  modules: string[]
  tags: string[]
}

export interface HotspotMeta {
  total: number
  branches: string[]
  categories: string[]
  latest_date: string
}

export interface HotspotStep {
  title: string
  body: string
}

export interface HotspotDetail extends HotspotSummary {
  question: string
  concept: string
  formula: string
  formula_note: string
  steps: HotspotStep[]
  insight: string
  figure: { data: Record<string, unknown>[]; layout: Record<string, unknown> }
  figure_caption: string
  try_it: { text: string; answer: string }
  source: string
  source_url: string
}

interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
}

export const hotspotsApi = {
  async list(params: { branch?: string; category?: string; search?: string; limit?: number } = {}) {
    const response = await client.get<ApiResponse<{ items: HotspotSummary[]; total: number }>>('/hotspots', { params })
    return response.data
  },

  async meta() {
    const response = await client.get<ApiResponse<HotspotMeta>>('/hotspots/meta')
    return response.data
  },

  async get(id: string) {
    const response = await client.get<ApiResponse<HotspotDetail>>(`/hotspots/${encodeURIComponent(id)}`)
    return response.data
  },
}

export const BRANCH_LABELS: Record<string, string> = {
  calculus: '微积分',
  'linear-algebra': '线性代数',
  probability: '概率统计',
  statistics: '数据统计',
}
