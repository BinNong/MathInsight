import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { theme, themeFor } from './theme'
import type { Caption as CaptionData, WordTiming } from './types'

/**
 * 把整句按 TTS 词边界切成片段，用于逐词卡拉OK高亮。
 * words 里的词是按顺序从原文切出的；中间可能夹着标点/空格，作为普通片段保留。
 */
function segmentText(text: string, words: WordTiming[]): Array<{ text: string; word?: WordTiming }> {
  if (!words.length) return [{ text }]
  const out: Array<{ text: string; word?: WordTiming }> = []
  let cursor = 0
  for (const w of words) {
    const idx = text.indexOf(w.text, cursor)
    if (idx < 0) continue
    if (idx > cursor) out.push({ text: text.slice(cursor, idx) })
    out.push({ text: w.text, word: w })
    cursor = idx + w.text.length
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) })
  return out
}

/** 烧录字幕：按 TTS 实测词边界逐词高亮，静音也能看懂，有声时字随声亮 */
export function CaptionOverlay({ captions, visualTheme }: { captions: CaptionData[]; visualTheme?: 'paper' | 'space' }) {
  const frame = useCurrentFrame()
  const T = themeFor(visualTheme || 'paper')
  const isDark = T.paper === '#0B1020'
  const t = frame / 30
  const active = captions.find((c) => t >= c.start && t < c.end)
  if (!active) return null

  const opacity = interpolate(t, [active.start, active.start + 0.12], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  })
  const pieces = segmentText(active.text, active.words || [])

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', justifyContent: 'flex-end', paddingBottom: 42 }}>
      <div style={{ textAlign: 'center' }}>
        <span style={{
          display: 'inline-block',
          maxWidth: 1020,
          padding: '12px 28px',
          background: 'rgba(30,26,22,0.86)',
          color: isDark ? '#FFFFFF' : '#D8D2CA',
          fontFamily: T.fontSans,
          fontSize: 30,
          lineHeight: 1.5,
          borderRadius: 10,
          opacity,
        }}>
          {pieces.map((piece, i) => {
            if (!piece.word) return <React.Fragment key={i}>{piece.text}</React.Fragment>
            // 正在读的词：高亮 + 轻微上浮；读完的词恢复常色
            const reading = t >= piece.word.start && t < piece.word.end
            const done = t >= piece.word.end
            return (
              <span key={i} style={{
                color: reading ? '#FFD9A0' : done ? '#FFFFFF' : (isDark ? '#E6ECF5' : '#D8D2CA'),
                fontWeight: reading ? 700 : 400,
                display: 'inline-block',
                transform: reading ? 'translateY(-2px)' : 'none',
                transition: 'none', // Remotion 逐帧确定性渲染，不用 CSS 过渡
              }}>{piece.text}</span>
            )
          })}
        </span>
      </div>
    </AbsoluteFill>
  )
}
