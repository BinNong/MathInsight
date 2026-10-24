import { client } from './client'

export interface SubjectInfo {
  name: string
  color: string
}

export interface ConceptNode {
  id: string
  name: string
  subject: string
  group: string
  description: string
  difficulty: number
  tags: string[]
  route: string | null
  formula?: string
}

export interface PrerequisiteEdge {
  source: string
  target: string
  reason: string
  strength: number
}

export interface GraphMeta {
  concept_count: number
  edge_count: number
}

export interface KnowledgeGraph {
  subjects: Record<string, SubjectInfo>
  nodes: ConceptNode[]
  edges: PrerequisiteEdge[]
  meta: GraphMeta
}

export interface RelatedConcept {
  id: string
  name: string
  subject: string
  reason: string
}

export interface ConceptDetail extends ConceptNode {
  prerequisites: RelatedConcept[]
  next_concepts: RelatedConcept[]
  visualizations: { label: string; path: string }[]
}

export interface LearningPathItem {
  id: string
  name: string
  subject: string
}

export interface LearningPath {
  goal_id: string
  goal_name: string
  path: LearningPathItem[]
}

const API_BASE = '/knowledge-graph'

export const knowledgeGraphApi = {
  async getGraph(): Promise<{ success: boolean; data: KnowledgeGraph; error?: string }> {
    const response = await client.get(`${API_BASE}`)
    return response.data
  },

  async getConcept(id: string): Promise<{ success: boolean; data: ConceptDetail; error?: string }> {
    const response = await client.get(`${API_BASE}/concepts/${encodeURIComponent(id)}`)
    return response.data
  },

  async getLearningPath(
    goalId: string
  ): Promise<{ success: boolean; data: LearningPath; error?: string }> {
    const response = await client.get(`${API_BASE}/path`, {
      params: { goal: goalId },
    })
    return response.data
  },

  async getRelatedVisualizations(conceptId: string): Promise<{
    success: boolean
    data: { concept_id: string; links: { label: string; path: string }[] }
    error?: string
  }> {
    const response = await client.get(`${API_BASE}/related/${encodeURIComponent(conceptId)}`)
    return response.data
  },
}
