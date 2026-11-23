import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { theme } from './theme'
import type { VideoScript } from './types'
import { keyedRandom } from './fx/motion-core.mjs'
import { clamp01 } from './fx/time'

/**
 * 音乐卡点视觉特效层：与 score.mjs 用同一组 cues（场景边界即节拍落点）。
 * 每次 impact 触发：闪光 -> 冲击波环 -> 粒子爆发，全部 frame-driven 可复现。
 */
export const BeatFX: React.FC<{ cues: VideoScript['cues']; accent: string }> = ({ cues = [], accent }) => {
  const frame = useCurrentFrame()
  const fps = 30
  const t = frame / fps

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      {cues.map((cue, idx) => {
        // 每个卡点持续 1.1 秒的特效窗口
        const local = t - cue.t
        if (local < 0 || local > 1.1) return null
        const isBig = cue.kind === 'formula' || cue.kind === 'insight' || cue.kind === 'end'
        const strength = isBig ? 1 : 0.6

        // 1) 闪光：前 0.12 秒
        const flash = interpolate(local, [0, 0.03, 0.18], [0, 0.38 * strength, 0], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        })

        // 2) 冲击波：从中心扩散的圆环
        const ringP = clamp01(local / 0.9)
        const ringR = ringP * 1100
        const ringOpacity = (1 - ringP) * 0.72 * strength

        // 3) 粒子爆发：从中心向外，位置按种子确定性重建
        const burstP = clamp01(local / 0.85)
        const particles = Array.from({ length: isBig ? 44 : 22 }, (_, i) => {
          const angle = keyedRandom(`beat-${idx}`, `${i}:a`) * Math.PI * 2
          const speed = 180 + keyedRandom(`beat-${idx}`, `${i}:s`) * 420
          const dist = burstP * speed
          const x = theme.width / 2 + Math.cos(angle) * dist
          const y = theme.height / 2 + Math.sin(angle) * dist
          const size = (7 - 5 * burstP) * (0.6 + keyedRandom(`beat-${idx}`, `${i}:r`))
          return { x, y, size, opacity: (1 - burstP) * 0.75 * strength }
        })

        return (
          <React.Fragment key={`${cue.t}-${idx}`}>
            <AbsoluteFill style={{ background: accent, opacity: flash, mixBlendMode: 'screen' }} />
            <div style={{
              position: 'absolute', left: theme.width / 2, top: theme.height / 2,
              width: ringR * 2, height: ringR * 2,
              marginLeft: -ringR, marginTop: -ringR,
              border: `${3 * (1 - ringP) + 1}px solid ${accent}`,
              borderRadius: '50%', opacity: ringOpacity,
            }} />
            {particles.map((p, i) => (
              <div key={i} style={{
                position: 'absolute', left: p.x, top: p.y,
                width: p.size, height: p.size, borderRadius: '50%',
                background: i % 3 === 0 ? theme.gold : accent,
                opacity: p.opacity,
              }} />
            ))}
          </React.Fragment>
        )
      })}
    </AbsoluteFill>
  )
}
