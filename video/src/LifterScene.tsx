import React from 'react'

/**
 * 举重幂律的具象化：三个人（不同体型）举着各自的杠铃，
 * 体型（体积∝L³）增长快于力量（横截面积∝L²）——让 2/3 次方看得见。
 */
export const LifterScene: React.FC<{ frame: number; accent: string; ink: string; soft: string }> = ({
  frame, accent, ink, soft,
}) => {
  const t = frame / 30
  const lift = (Math.sin(t * 2.2) + 1) / 2 // 举起动作

  const lifters = [
    { x: 210, scale: 0.78, label: '55 kg', w: 1.0 },
    { x: 560, scale: 1.0, label: '89 kg', w: 1.4 },
    { x: 930, scale: 1.2, label: '109 kg', w: 1.66 },
  ]

  return (
    <svg width={1160} height={300}>
      {/* 地面 */}
      <line x1={60} y1={272} x2={1100} y2={272} stroke={soft} strokeWidth={2} opacity={0.5} />
      {lifters.map((l, i) => {
        const bodyH = 92 * l.scale
        const headR = 15 * l.scale
        const baseY = 272
        const shoulderY = baseY - bodyH
        const armY = shoulderY - 10 - lift * 26 * l.scale
        const barW = 120 * l.w * 0.9
        return (
          <g key={i}>
            {/* 杠铃：力量 W ∝ M^(2/3)，片数随 w 增长但慢于体型 */}
            <line x1={l.x - barW / 2} y1={armY} x2={l.x + barW / 2} y2={armY}
              stroke={ink} strokeWidth={4} strokeLinecap="round" />
            {[-1, 1].map((s) => (
              <g key={s}>
                <circle cx={l.x + s * barW / 2} cy={armY} r={11 * l.scale + 5}
                  fill={accent} opacity={0.85} />
                <circle cx={l.x + s * (barW / 2 + 13 * l.scale)} cy={armY} r={8 * l.scale + 3}
                  fill={accent} opacity={0.6} />
              </g>
            ))}
            {/* 人：身体宽度∝体型，但肌肉横截面增长慢于体重 */}
            <circle cx={l.x} cy={shoulderY - headR - 4} r={headR} fill={accent} opacity={0.9} />
            <rect x={l.x - 12 * l.scale} y={shoulderY} width={24 * l.scale} height={bodyH * 0.58}
              rx={8 * l.scale} fill={accent} opacity={0.8} />
            {/* 手臂举起杠铃 */}
            <line x1={l.x - 10 * l.scale} y1={shoulderY + 8} x2={l.x - barW / 2 + 14} y2={armY}
              stroke={ink} strokeWidth={5 * l.scale} strokeLinecap="round" />
            <line x1={l.x + 10 * l.scale} y1={shoulderY + 8} x2={l.x + barW / 2 - 14} y2={armY}
              stroke={ink} strokeWidth={5 * l.scale} strokeLinecap="round" />
            {/* 腿 */}
            <line x1={l.x - 6 * l.scale} y1={shoulderY + bodyH * 0.58} x2={l.x - 14 * l.scale} y2={baseY}
              stroke={ink} strokeWidth={6 * l.scale} strokeLinecap="round" />
            <line x1={l.x + 6 * l.scale} y1={shoulderY + bodyH * 0.58} x2={l.x + 14 * l.scale} y2={baseY}
              stroke={ink} strokeWidth={6 * l.scale} strokeLinecap="round" />
            {/* 标签 */}
            <text x={l.x} y={baseY + 22} textAnchor="middle" fontSize={14} fill={ink} fontFamily="sans-serif">
              {l.label}
            </text>
          </g>
        )
      })}
      {/* 幂律标注 */}
      <text x={60} y={36} fontSize={16} fill={soft} fontFamily="serif">
        体型 ↑ 快于 力量 ↑　W ∝ M²⁄³
      </text>
    </svg>
  )
}
