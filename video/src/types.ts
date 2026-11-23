/** 数说热点视频脚本数据结构（由 scripts/build_video.py 生成） */

export interface Caption {
  start: number // 秒
  end: number
  text: string
}

export interface Scene {
  /** 场景类型决定渲染组件 */
  kind: 'hook' | 'story' | 'formula' | 'steps' | 'insight' | 'question' | 'end'
  start: number // 秒
  end: number
  /** 大标题 / 核心句 */
  title: string
  /** 正文（story 场景） */
  body?: string
  /** 公式 LaTeX 源码（简化渲染，见 FormulaScene） */
  formula?: string
  /** 步骤列表（steps 场景） */
  items?: string[]
  /** 数据图表（可选，折线/柱状） */
  chart?: {
    labels: string[]
    values: number[]
    color?: string
  }
}

export interface VideoScript {
  id: string
  headline: string
  branch: string
  category: string
  /** 总时长（秒），由旁白时长决定 */
  duration: number
  fps: number
  /** 旁白音频文件名（位于 public/audio/） */
  audio: string
  captions: Caption[]
  scenes: Scene[]
  /** 站点配色 */
  accent: string
}

export const FPS = 30
