import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { theme } from './theme'
import type { Caption as CaptionData } from './types'

/** 烧录字幕：从字幕数组按当前帧取当前条，静音播放也能看懂 */
export function CaptionOverlay({ captions }: { captions: CaptionData[] }) {
  const frame = useCurrentFrame()
  const t = frame / 30
  const active = captions.find((c) => t >= c.start && t < c.end)
  if (!active) return null

  const opacity = interpolate(t, [active.start, active.start + 0.15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', justifyContent: 'flex-end', paddingBottom: 42 }}>
      <div style={{ textAlign: 'center' }}>
        <span
          style={{
            display: 'inline-block',
            maxWidth: 1000,
            padding: '12px 28px',
            background: 'rgba(30,26,22,0.86)',
            color: '#F7F4EC',
            fontFamily: theme.fontSans,
            fontSize: 30,
            lineHeight: 1.5,
            borderRadius: 10,
            opacity,
          }}
        >
          {active.text}
        </span>
      </div>
    </AbsoluteFill>
  )
}
