import React from 'react'
import { keyedRandom } from './fx/motion-core.mjs'

/**
 * 有体积感的星球（大胆版）：球面光照 + 自转纹理 + 多层辉光 + 日冕喷发 + 星芒。
 * 参数化：红矮星/白矮星/行星不同外观，vr 驱动多普勒红蓝移。
 */
export const StarBall: React.FC<{
  x: number; y: number; r: number
  frame: number
  kind?: 'red-dwarf' | 'white-dwarf' | 'planet'
  vr?: number
  uid: string
  /** 镜头感强度：1 = 正常，>1 = 更夸张的辉光/星芒 */
  drama?: number
}> = ({ x, y, r, frame, kind = 'red-dwarf', vr = 0, uid, drama = 1 }) => {
  const t = frame / 30
  const spin = (t * 34) % 100
  const D = drama

  const palette = kind === 'red-dwarf'
    ? { core: '#FFF0C4', mid: '#F4803F', edge: '#8A2A12', glow: '#FF8A3D', flare: '#FFD27A', texture: '#A83A1C' }
    : kind === 'white-dwarf'
      ? { core: '#FFFFFF', mid: '#DCF0FF', edge: '#4E86BB', glow: '#9FD8FF', flare: '#FFFFFF', texture: '#7FB8E4' }
      : { core: '#D8E6F2', mid: '#7C93AC', edge: '#2A3A50', glow: '#A8C4DE', flare: '#E8F2FF', texture: '#506880' }

  const shift = Math.max(-1, Math.min(1, vr))
  const glow = shift > 0.25 ? '#74B6FF' : shift < -0.25 ? '#FF5A3C' : palette.glow
  const gid = `${uid}-${kind}`

  // 日冕喷发：确定性的尖峰，周期性变化
  const corona = Array.from({ length: 14 }, (_, i) => {
    const angle = keyedRandom(uid, `${i}:a`) * Math.PI * 2
    const base = r * (1.15 + keyedRandom(uid, `${i}:l`) * 0.35)
    const wave = 0.82 + Math.sin(t * 2.4 + i * 0.9) * 0.18
    const len = base * wave * D
    return {
      x1: x + Math.cos(angle) * r * 0.96,
      y1: y + Math.sin(angle) * r * 0.96,
      x2: x + Math.cos(angle) * (r + len),
      y2: y + Math.sin(angle) * (r + len),
      op: 0.16 + keyedRandom(uid, `${i}:o`) * 0.2,
    }
  })

  // 表面耀斑：随机位置闪烁的亮点
  const flares = Array.from({ length: 4 }, (_, i) => {
    const fx = x + (keyedRandom(uid, `f${i}:x`) - 0.5) * r * 1.1
    const fy = y + (keyedRandom(uid, `f${i}:y`) - 0.5) * r * 1.1
    const pulse = Math.max(0, Math.sin(t * 2.6 + i * 1.7)) * 0.8
    return { x: fx, y: fy, pulse, size: r * (0.07 + keyedRandom(uid, `f${i}:s`) * 0.10) }
  })

  return (
    <g>
      <defs>
        <radialGradient id={`${gid}-surf`} cx="32%" cy="28%" r="75%">
          <stop offset="0%" stopColor={palette.core} />
          <stop offset="34%" stopColor={palette.mid} />
          <stop offset="70%" stopColor={palette.edge} />
          <stop offset="100%" stopColor="#060911" />
        </radialGradient>
        <radialGradient id={`${gid}-halo`}>
          <stop offset="40%" stopColor={glow} stopOpacity={0.55 * D} />
          <stop offset="72%" stopColor={glow} stopOpacity={0.20 * D} />
          <stop offset="100%" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${gid}-clip`}>
          <circle cx={x} cy={y} r={r * 0.99} />
        </clipPath>
      </defs>

      {/* 外层辉光（半径受限，避免超出 viewBox 被裁成方块） */}
      <circle cx={x} cy={y} r={r * Math.min(1.75 * D, 2.0)}
        fill={`url(#${gid}-halo)`}
        opacity={0.7 + Math.sin(t * 1.6) * 0.08} />

      {/* 日冕喷发：从球面射出的光芒 */}
      {corona.map((c, i) => (
        <line key={`c${i}`} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
          stroke={glow} strokeWidth={2 + keyedRandom(uid, `${i}:w`) * 3}
          strokeLinecap="round" opacity={c.op} />
      ))}

      {/* 白矮星的十字星芒（衍射尖峰） */}
      {kind === 'white-dwarf' && (
        <g opacity={0.72 * D}>
          <line x1={x - r * 3} y1={y} x2={x + r * 3} y2={y}
            stroke={palette.flare} strokeWidth={1.6} />
          <line x1={x} y1={y - r * 3} x2={x} y2={y + r * 3}
            stroke={palette.flare} strokeWidth={1.6} />
          <circle cx={x} cy={y} r={r * 1.7} fill="none"
            stroke={palette.flare} strokeWidth={1} opacity={0.4} />
        </g>
      )}

      {/* 球体本体 */}
      <circle cx={x} cy={y} r={r} fill={`url(#${gid}-surf)`} />

      {/* 自转纹理：明暗带横移 */}
      <g clipPath={`url(#${gid}-clip)`} opacity={0.5}>
        {[0, 1, 2, 3, 4].map((i) => {
          const bx = x - r * 1.8 + ((spin + i * 22) % 120) / 120 * (r * 3.6)
          const by = y - r * 0.65 + i * r * 0.34
          return (
            <ellipse key={i} cx={bx} cy={by} rx={r * 0.62} ry={r * (0.10 + i * 0.012)}
              fill={palette.texture} opacity={0.42 + (i % 2) * 0.28} />
          )
        })}
      </g>

      {/* 表面耀斑 */}
      <g clipPath={`url(#${gid}-clip)`}>
        {flares.map((f, i) => f.pulse > 0.08 && (
          <circle key={i} cx={f.x} cy={f.y} r={f.size * f.pulse}
            fill={palette.flare} opacity={f.pulse * 0.85}
            style={{ filter: 'blur(2px)' }} />
        ))}
      </g>

      {/* 边缘暗化 + 高光 */}
      <circle cx={x} cy={y} r={r} fill="none"
        stroke="#04070E" strokeWidth={r * 0.10} opacity={0.34} />
      <ellipse cx={x - r * 0.36} cy={y - r * 0.44} rx={r * 0.26} ry={r * 0.17}
        fill="#FFFFFF" opacity={0.42} style={{ filter: 'blur(4px)' }} />
    </g>
  )
}
