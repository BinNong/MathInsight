import { client } from './client'

export interface GenerateAnimationRequest {
  description: string
  resolution?: string
  fps?: number
}

export interface GenerateAnimationResponse {
  success: boolean
  task_id?: string
  status?: string
  message?: string
  error?: string
  detail?: string
}

export interface TaskStatusResponse {
  success: boolean
  task?: {
    task_id: string
    description: string
    resolution: string
    fps: number
    status: 'PENDING' | 'GENERATING' | 'RENDERING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'
    created_at: number
    updated_at: number
    iterations: number
    stage_message: string
    progress_percent: number
    cache_hit: boolean
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
  error?: string
}

export interface TaskCodeResponse {
  success: boolean
  task_id: string
  generated_code?: string
  render_log?: string
  status: string
  error?: string
}

export const manimApi = {
  async generateAnimation(data: GenerateAnimationRequest): Promise<GenerateAnimationResponse> {
    const response = await client.post('/manim/generate', data)
    return response.data
  },

  async getTaskStatus(taskId: string, signal?: AbortSignal): Promise<TaskStatusResponse> {
    const response = await client.get(`/manim/tasks/${taskId}`, { signal })
    return response.data
  },

  async cancelTask(taskId: string): Promise<{
    success: boolean
    task_id?: string
    status?: string
    message?: string
    error?: string
  }> {
    const response = await client.post(`/manim/tasks/${taskId}/cancel`)
    return response.data
  },

  async getTaskCode(taskId: string): Promise<TaskCodeResponse> {
    const response = await client.get(`/manim/tasks/${taskId}/code`)
    return response.data
  },

  getDownloadUrl(filename: string): string {
    return `/mathinsight/api/manim/download/${filename}`
  },

  getVideoFilenameFromUrl(url: string): string {
    return url.split('/').pop() || ''
  },
}
