/** 数说热点视频脚本数据结构（由 scripts/build_video.py 生成） */

export interface WordTiming {
  text: string
  start: number // 秒，全片绝对时间（来自 TTS WordBoundary 实测）
  end: number
}

export interface Caption {
  start: number // 秒
  end: number
  text: string
  segment?: number
  words?: WordTiming[]
}

export interface Scene {
  /** 场景类型决定渲染组件 */
  kind: 'hook' | 'story' | 'formula' | 'steps' | 'sync' | 'lifting' | 'cosmic-intro' | 'orbit' | 'wavefit' | 'insight' | 'question' | 'end'
  start: number // 秒
  end: number
  /** 大标题 / 核心句 */
  title: string
  /** 正文（story 场景） */
  body?: string
  /** 当前场景内逐句显示的文本（按旁白推进，由渲染时从 captions 计算） */
  bodyLines?: string[]
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
  /** 最终音轨（BGM + 旁白混音）文件名，优先于 narration */
  audio?: string
  /** 纯旁白音频文件名（兼容旧脚本） */
  narration?: string
  /** 音乐/画面共用的卡点（秒），与 score.mjs 的 timeline.json 同源 */
  cues?: { t: number; kind: string }[]
  captions: Caption[]
  scenes: Scene[]
  /** 站点配色 */
  accent: string
  /** 视觉主题：space=深空（天文题材），默认纸张风 */
  visualTheme?: 'paper' | 'space'
}

export const FPS = 30
