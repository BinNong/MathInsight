import { client } from './client'

// 大数定律模拟 API
export interface LLNSimulateRequest {
  experiment_type: 'coin' | 'dice'
  p?: number // 硬币正面概率（仅 coin）
  min_val?: number // 最小值（仅 dice）
  max_val?: number // 最大值（仅 dice）
  sample_size: number
  seed?: number
}

export interface LLNResultData {
  experiment_type: string
  expected_value: number
  total_samples: number
  cumulative_means: number[]
  samples: number[]
  final_mean: number
}

export type DistributionType =
  | 'bernoulli'
  | 'binomial'
  | 'poisson'
  | 'uniform_discrete'
  | 'uniform_continuous'
  | 'exponential'
  | 'normal'

export interface CLTSimulateRequest {
  distribution: DistributionType
  params: Record<string, number>
  sample_size: number
  num_samples: number
  seed?: number
}

export interface CLTResultData {
  distribution: DistributionType
  params: Record<string, number>
  sample_size: number
  num_samples: number
  sample_means: number[]
  histogram: { x: number[]; y: number[] }
  normal_curve: { x: number[]; y: number[]; mean: number; std: number }
  single_sample: { x: number[]; y: number[] }
  theoretical: { mean: number; variance: number }
  sample_mean_of_means: number
  sample_std_of_means: number
}

export interface DistributionSimulateRequest {
  distribution: DistributionType
  params: Record<string, number>
  sample_size: number
  seed?: number
}

export interface DistributionResultData {
  distribution: DistributionType
  params: Record<string, number>
  sample_size: number
  samples: number[]
  histogram: { x: number[]; y: number[] }
  theoretical_curve: { x: number[]; y: number[] }
  theoretical: { mean: number; variance: number }
  statistics: {
    mean: number
    variance: number
    median: number
    min: number
    max: number
  }
}

export interface DistributionParamConfig {
  label: string
  default: number
  min: number
  max: number
  step: number
}

export interface DistributionPreset {
  id: DistributionType
  name: string
  type: 'discrete' | 'continuous'
  params: Record<string, DistributionParamConfig>
  description: string
}

export interface DistributionPresetsData {
  distributions: DistributionPreset[]
}

export const probabilityApi = {
  async simulateLLN(data: LLNSimulateRequest) {
    const response = await client.post('/probability/lln/simulate', data)
    return response.data
  },

  async getPresets() {
    const response = await client.get('/probability/lln/presets')
    return response.data
  },

  async simulateCLT(data: CLTSimulateRequest) {
    const response = await client.post('/probability/clt/simulate', data)
    return response.data
  },

  async simulateDistribution(data: DistributionSimulateRequest) {
    const response = await client.post('/probability/distribution/simulate', data)
    return response.data
  },

  async getDistributionPresets() {
    const response = await client.get('/probability/distribution/presets')
    return response.data
  },
}
