import React, { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { theme } from './theme'
import type { Scene as SceneData } from './types'

/** 场景通用入场动画：frame-driven，不用定时器 */
function useEnter(frame: number, delay = 0) {
  const { fps } = useVideoConfig()
  return spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 18, stiffness: 90, mass: 0.8 },
  })
}

/** 背景网格 + 纸张 */
function Backdrop({ accent }: { accent: string }) {
  return (
    <AbsoluteFill style={{ background: theme.paper }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${theme.line}33 1px, transparent 1px), linear-gradient(90deg, ${theme.line}33 1px, transparent 1px)`,
          backgroundSize: '56px 56px',
          opacity: 0.5,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 8,
          height: '100%',
          background: accent,
        }}
      />
    </AbsoluteFill>
  )
}

/** 页眉：栏目名 + 数学分支 */
function Header({ branch, category }: { branch: string; category: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 36,
        left: 56,
        right: 56,
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: theme.fontSans,
        fontSize: 18,
        letterSpacing: 2,
        color: theme.inkSoft,
      }}
    >
      <span>MATHINSIGHT · 数说热点</span>
      <span>{category} · {branch}</span>
    </div>
  )
}

/** 图表场景组件：用 SVG 画折线/柱状，数据来自脚本 */
function MiniChart({ chart, progress }: {
  chart: NonNullable<SceneData['chart']>
  progress: number
}) {
  const w = 620
  const h = 260
  const n = chart.values.length
  const max = Math.max(...chart.values, 1)
  const min = Math.min(...chart.values, 0)
  const range = max - min || 1
  const color = chart.color || theme.accent
  const pts = chart.values.map((v, i) => {
    const x = n === 1 ? w / 2 : (i / (n - 1)) * w
    const y = h - ((v - min) / range) * (h - 30) - 15
    return `${x},${y}`
  })
  const barW = w / n * 0.6
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <line x1={0} y1={h} x2={w} y2={h} stroke={theme.line} strokeWidth={2} />
      <line x1={0} y1={15} x2={0} y2={h} stroke={theme.line} strokeWidth={2} />
      {n <= 16 ? (
        chart.values.map((v, i) => {
          const bh = ((v - min) / range) * (h - 30) * progress
          const x = (i + 0.5) * (w / n) - barW / 2
          return (
            <rect
              key={i}
              x={x}
              y={h - bh}
              width={barW}
              height={bh}
              fill={i === chart.values.indexOf(max) ? color : `${color}88`}
              rx={4}
            />
          )
        })
      ) : (
        <polyline
          points={pts.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={3000}
          strokeDashoffset={3000 * (1 - progress)}
        />
      )}
      {chart.labels.slice(0, 8).map((label, i) => (
        <text
          key={i}
          x={n <= 16 ? (i + 0.5) * (w / n) : (i / Math.max(1, chart.labels.length - 1)) * w}
          y={h + 26}
          textAnchor="middle"
          fontSize={16}
          fontFamily={theme.fontSans}
          fill={theme.inkSoft}
        >
          {label}
        </text>
      ))}
    </svg>
  )
}

/** 单个场景渲染 */
export function SceneView({
  scene,
  branch,
  category,
}: {
  scene: SceneData
  branch: string
  category: string
}) {
  const frame = useCurrentFrame()
  const enter = useEnter(frame)
  const chartProgress = interpolate(frame, [10, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const accent = theme.accent

  // 公式用 KaTeX 渲染成 HTML（与站点一致），避免粗糙文本替换
  const formulaHtml = useMemo(() => {
    if (!scene.formula) return ''
    try {
      return katex.renderToString(scene.formula, {
        displayMode: true,
        throwOnError: false,
        strict: 'ignore',
      })
    } catch {
      return ''
    }
  }, [scene.formula])

  return (
    <AbsoluteFill>
      <Backdrop accent={accent} />
      <Header branch={branch} category={category} />

      <div
        style={{
          position: 'absolute',
          top: 110,
          left: 72,
          right: 72,
          bottom: 130,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 28,
          opacity: enter,
          transform: `translateY(${(1 - enter) * 28}px)`,
        }}
      >
        {/* 钩子场景：大标题 */}
        {scene.kind === 'hook' && (
          <>
            <div style={{ fontSize: 22, color: accent, letterSpacing: 4, fontFamily: theme.fontSans }}>
              一个真实发生的问题
            </div>
            <div
              style={{
                fontFamily: theme.fontSerif,
                fontSize: 58,
                lineHeight: 1.35,
                fontWeight: 600,
                color: theme.ink,
                maxWidth: 1000,
              }}
            >
              {scene.title}
            </div>
            {scene.body && (
              <div style={{ fontSize: 30, color: theme.inkSoft, fontFamily: theme.fontSerif, lineHeight: 1.7 }}>
                {scene.body}
              </div>
            )}
          </>
        )}

        {/* 叙事场景：标题 + 正文 + 可选图表 */}
        {scene.kind === 'story' && (
          <>
            <div style={{ fontFamily: theme.fontSerif, fontSize: 44, fontWeight: 600, color: theme.ink }}>
              {scene.title}
            </div>
            <div style={{ display: 'flex', gap: 48, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: theme.fontSerif, fontSize: 30, color: theme.inkSoft, lineHeight: 1.9 }}>
                  {scene.body}
                </div>
              </div>
              {scene.chart && <MiniChart chart={scene.chart} progress={chartProgress} />}
            </div>
          </>
        )}

        {/* 公式场景 */}
        {scene.kind === 'formula' && (
          <>
            <div style={{ fontFamily: theme.fontSerif, fontSize: 42, color: theme.ink, fontWeight: 600 }}>
              {scene.title}
            </div>
            <div
              style={{
                color: accent,
                background: theme.paperAlt,
                padding: '30px 48px',
                borderRadius: 16,
                borderLeft: `6px solid ${accent}`,
                lineHeight: 1.5,
                fontSize: 38,
              }}
              dangerouslySetInnerHTML={{ __html: formulaHtml }}
            />
            {scene.body && (
              <div style={{ fontFamily: theme.fontSerif, fontSize: 28, color: theme.inkSoft, lineHeight: 1.8 }}>
                {scene.body}
              </div>
            )}
          </>
        )}

        {/* 步骤场景：逐条浮现 */}
        {scene.kind === 'steps' && (
          <>
            <div style={{ fontFamily: theme.fontSerif, fontSize: 42, color: theme.ink, fontWeight: 600 }}>
              {scene.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {(scene.items || []).map((item, i) => {
                const itemEnter = spring({
                  frame: Math.max(0, frame - 12 - i * 18),
                  fps: 30,
                  config: { damping: 20, stiffness: 100 },
                })
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 20,
                      alignItems: 'flex-start',
                      opacity: itemEnter,
                      transform: `translateX(${(1 - itemEnter) * 30}px)`,
                    }}
                  >
                    <div
                      style={{
                        minWidth: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: accent,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: theme.fontSans,
                        fontSize: 22,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div style={{ fontFamily: theme.fontSerif, fontSize: 29, color: theme.ink, lineHeight: 1.7 }}>
                      {item}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* 结论场景 */}
        {scene.kind === 'insight' && (
          <div style={{ background: `${accent}12`, padding: '48px 56px', borderRadius: 20, borderLeft: `8px solid ${accent}` }}>
            <div style={{ fontSize: 26, color: accent, letterSpacing: 3, fontFamily: theme.fontSans, marginBottom: 20 }}>
              一句话记住
            </div>
            <div style={{ fontFamily: theme.fontSerif, fontSize: 42, lineHeight: 1.6, color: theme.ink }}>
              {scene.title}
            </div>
          </div>
        )}

        {/* 思考题场景 */}
        {scene.kind === 'question' && (
          <>
            <div style={{ fontSize: 24, color: accent, letterSpacing: 4, fontFamily: theme.fontSans }}>
              轮到你了
            </div>
            <div style={{ fontFamily: theme.fontSerif, fontSize: 46, lineHeight: 1.6, color: theme.ink, maxWidth: 1000 }}>
              {scene.title}
            </div>
          </>
        )}

        {/* 片尾 */}
        {scene.kind === 'end' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: theme.fontSerif, fontSize: 52, color: theme.ink, marginBottom: 24 }}>
              {scene.title}
            </div>
            <div style={{ fontFamily: theme.fontSans, fontSize: 28, color: accent, letterSpacing: 3 }}>
              MathInsight · 让公式成为可探索的世界
            </div>
            <div style={{ fontFamily: theme.fontSans, fontSize: 22, color: theme.inkSoft, marginTop: 32 }}>
              去平台看完整解读与交互图 →
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  )
}
