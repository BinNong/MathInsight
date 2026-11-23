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
import { theme, themeFor } from './theme'
import type { Scene as SceneData } from './types'
import { FlowField, ParticleAtmosphere, DotGrid, LightSweep, Vignette } from './fx/backgrounds'
import { StarBall } from './StarBall'
import { LifterScene } from './LifterScene'
import { cameraPath, shake } from './fx/camera'
import { gridMask, iris } from './fx/transitions'
import { unit, clamp01 } from './fx/time'
import { keyedRandom } from './fx/motion-core.mjs'

/** 场景入场：带阻尼的弹簧 */
function useEnter(frame: number, delay = 0) {
  const { fps } = useVideoConfig()
  return spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 18, stiffness: 90, mass: 0.8 },
  })
}

/** 数字滚动：从 0 数到目标 */
function CountUp({ value, frame, delay = 0 }: { value: number; frame: number; delay?: number }) {
  const p = clamp01(interpolate(frame, [delay, delay + 24], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  }))
  const eased = 1 - Math.pow(1 - p, 3)
  const shown = value >= 100 ? Math.round(value * eased) : +(value * eased).toFixed(1)
  return <>{shown}</>
}

/** 活背景：按场景类型选不同运动语义，阅读区压低亮度 */
function LivingBackdrop({ kind, frame, accent, T }: {
  kind: SceneData['kind']; frame: number; accent: string; T: typeof theme
}) {
  const t = frame / 30
  const width = theme.width
  const height = theme.height
  const zones = [{ x: 60, y: 100, width: width - 120, height: height - 220, padding: 20, feather: 120, floor: 0.12 }]
  const color = accent
  const dark = T.paper === '#0B1020'

  return (
    <AbsoluteFill style={{ background: T.paper }}>
      {dark ? (
        // 深空：密集星场 + 缓慢漂移，天文题材的宇宙感
        <>
          <ParticleAtmosphere t={t} width={width} height={height} seed={`star-${kind}`} zones={zones}
            color={T.gold} count={220} radius={1.6} period={24} />
          <FlowField t={t} width={width} height={height} seed={`nebula-${kind}`} zones={zones}
            color={T.blue} lines={45} steps={22} stepLength={8} period={18} />
        </>
      ) : kind === 'formula' || kind === 'steps' ? (
        <FlowField t={t} width={width} height={height} seed={`flow-${kind}`} zones={zones}
          color={color} lines={70} steps={26} stepLength={6} period={14} />
      ) : (
        <ParticleAtmosphere t={t} width={width} height={height} seed={`p-${kind}`} zones={zones}
          color={color} count={110} radius={2} period={16} />
      )}
      {(kind === 'hook' || kind === 'insight') && (
        <DotGrid t={t} width={width} height={height} zones={zones} color={color}
          spacing={48} eventAt={0.3} amplitude={6} focus={[width / 2, height / 2]} />
      )}
      <Vignette strength={dark ? 0.42 : 0.18} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: 8, height: '100%', background: accent }} />
    </AbsoluteFill>
  )
}

/** 页眉 */
function Header({ branch, category, T }: { branch: string; category: string; T: typeof theme }) {
  return (
    <div style={{
      position: 'absolute', top: 36, left: 56, right: 56,
      display: 'flex', justifyContent: 'space-between',
      fontFamily: T.fontSans, fontSize: 18, letterSpacing: 2, color: T.inkSoft,
    }}>
      <span>MATHINSIGHT · 数说热点</span>
      <span>{category} · {branch}</span>
    </div>
  )
}

/** 图表：SVG 逐条生长 + 数值滚动 */
function AnimatedChart({ chart, progress, frame }: {
  chart: NonNullable<SceneData['chart']>; progress: number; frame: number
}) {
  const w = 620, h = 260
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
  const barW = (w / n) * 0.6
  const maxIdx = chart.values.indexOf(max)

  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <line x1={0} y1={h} x2={w} y2={h} stroke={theme.line} strokeWidth={2} />
      <line x1={0} y1={15} x2={0} y2={h} stroke={theme.line} strokeWidth={2} />
      {n <= 16 ? (
        chart.values.map((v, i) => {
          const local = clamp01((progress - (i / n) * 0.5) * 2)
          const bh = ((v - min) / range) * (h - 30) * local
          const x = (i + 0.5) * (w / n) - barW / 2
          return (
            <g key={i}>
              <rect x={x} y={h - bh} width={barW} height={bh}
                fill={i === maxIdx ? color : `${color}88`} rx={4} />
              {i === maxIdx && local > 0.6 && (
                <text x={x + barW / 2} y={h - bh - 12} textAnchor="middle"
                  fontSize={22} fontWeight={700} fill={color} fontFamily={theme.fontSans}>
                  <CountUp value={v} frame={frame} delay={20} />
                </text>
              )}
            </g>
          )
        })
      ) : (
        <>
          <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={5}
            strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={4000} strokeDashoffset={4000 * (1 - progress)} />
          <circle
            cx={n === 1 ? w / 2 : w} cy={h - ((chart.values[n - 1] - min) / range) * (h - 30) - 15}
            r={8} fill={color} opacity={progress > 0.9 ? 1 : 0} />
        </>
      )}
      {chart.labels.slice(0, 8).map((label, i) => (
        <text key={i}
          x={n <= 16 ? (i + 0.5) * (w / n) : (i / Math.max(1, chart.labels.length - 1)) * w}
          y={h + 26} textAnchor="middle" fontSize={16} fontFamily={theme.fontSans} fill={theme.inkSoft}>
          {label}
        </text>
      ))}
    </svg>
  )
}

/** 关键词高亮：文字里的【...】做强调。
 *  activeWords 为当前 TTS 正在读的词（实测词边界），命中时下划线瞬间生长——真正音画同步。
 */
function RichText({ text, frame, size = 30, color, activeWords = [], T }: {
  text: string; frame: number; size?: number; color?: string; activeWords?: string[]; T: typeof theme
}) {
  const bodyColor = color ?? T.inkSoft
  const parts = text.split(/([【】])/)
  let keyIdx = 0
  return (
    <div style={{ fontSize: size, color: bodyColor, fontFamily: T.fontSerif, lineHeight: 1.9 }}>
      {parts.map((part, i) => {
        if (part === '【') { keyIdx++; return null }
        if (part === '】') return null
        const isKey = i > 0 && parts[i - 1] === '【'
        if (!isKey) return <React.Fragment key={i}>{part}</React.Fragment>
        // 优先用词边界命中；没有词数据时退回帧偏移（兼容旧脚本）
        const hitByVoice = activeWords.some((w) => part.includes(w) || w.includes(part))
        const p = hitByVoice ? 1 : clamp01(interpolate(frame, [16 + keyIdx * 6, 30 + keyIdx * 6], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        }))
        return (
          <span key={i} style={{
            color: p > 0 ? T.accent : bodyColor, fontWeight: p > 0 ? 700 : 400,
            background: `linear-gradient(transparent ${75 - p * 62}%, ${T.accent}33 ${75 - p * 62}%)`,
            transform: hitByVoice ? 'translateY(-1px)' : 'none',
            display: 'inline-block',
          }}>{part}</span>
        )
      })}
    </div>
  )
}

/**
 * 双星系统具象动画：真正的立体星球绕质心转动，多普勒红蓝移，
 * 右侧光谱条纹随速度移动 + 径向速度波形实时描绘。
 */
function OrbitScene({ frame, T }: { frame: number; T: typeof theme }) {
  const t = frame / 30
  const cx = 300, cy = 175
  const R = 88
  const omega = 1.5
  const a = omega * t
  const vr = Math.sin(a) // 视向速度

  // 可见红矮星（绕质心）；不可见白矮星伴星（画成半透明虚影）
  const sx = cx + Math.cos(a) * R
  const sy = cy + Math.sin(a) * R * 0.40
  const bx = cx - Math.cos(a) * R * 0.52
  const by = cy - Math.sin(a) * R * 0.21

  const waveX0 = 620, waveW = 500, waveY = 150, waveH = 62
  const drawT = Math.min(t, 8)
  const steps = Math.max(2, Math.floor(drawT * 20))
  const pts = Array.from({ length: steps }, (_, i) => {
    const tt = (i / (steps - 1)) * 8
    return `${waveX0 + (tt / 8) * waveW},${waveY - Math.sin(omega * tt) * waveH}`
  }).join(' ')

  // 光谱条纹：整体随 vr 左右平移（多普勒效应）
  const specShift = vr * 26

  return (
    <div style={{ position: 'relative', width: 1200, height: 310, overflow: 'visible' }}>
      <svg width={1200} height={420} style={{ position: 'absolute', inset: 0, transform: 'scale(0.74)', transformOrigin: 'top left' }}>
        <defs>
          {/* 光谱梯度：红-橙-黄-绿-蓝-紫，模拟恒星光谱 */}
          <linearGradient id="spectrum" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7A3BFF" />
            <stop offset="20%" stopColor="#3B82F6" />
            <stop offset="42%" stopColor="#5FD3C8" />
            <stop offset="58%" stopColor="#E9D46A" />
            <stop offset="78%" stopColor="#E8794A" />
            <stop offset="100%" stopColor="#C93B3B" />
          </linearGradient>
        </defs>

        {/* 轨道虚线 + 质心 */}
        <ellipse cx={cx} cy={cy} rx={R} ry={R * 0.40} fill="none" stroke={T.line} strokeWidth={1.5} strokeDasharray="4 5" />
        <circle cx={cx} cy={cy} r={4} fill={T.gold} />
        <text x={cx} y={cy + 26} textAnchor="middle" fontSize={12} fill={T.inkSoft} fontFamily={T.fontSans}>质心</text>

        {/* 看不见的伴星：半透明的冷色球体虚影 */}
        <g opacity={0.34}>
          <StarBall x={bx} y={by} r={54} frame={frame} kind="white-dwarf" uid="companion" drama={1.3} />
        </g>
        <text x={bx - 44} y={by + 52} fontSize={12} fill={T.blue} fontFamily={T.fontSans}>看不见的伴星</text>

        {/* 运动拖尾：重算过去 8 帧的位置，画淡出的残影 —— 让“绕转”看得见 */}
        {Array.from({ length: 9 }, (_, i) => {
          const tt = t - i * 0.055
          const tx = cx + Math.cos(omega * tt) * R
          const ty = cy + Math.sin(omega * tt) * R * 0.40
          return <circle key={`trail${i}`} cx={tx} cy={ty} r={54 - i * 4.6}
            fill={T.accent} opacity={(1 - i / 9) * 0.12} />
        })}
        {/* 可见红矮星：立体球体 + 多普勒色移 */}
        <StarBall x={sx} y={sy} r={60} frame={frame} kind="red-dwarf" vr={vr} uid="visible" drama={1.25} />
        <text x={sx} y={sy - 44} textAnchor="middle" fontSize={12} fill={T.ink} fontFamily={T.fontSans}>红矮星</text>

        {/* 视线方向：一条从星球指向右侧望远镜的光束 */}
        <line x1={sx + 34} y1={sy} x2={waveX0 - 20} y2={waveY - vr * waveH}
          stroke={T.blue} strokeWidth={1} strokeDasharray="3 6" opacity={0.55} />
        <text x={cx + 130} y={cy - 14} fontSize={11} fill={T.inkSoft} fontFamily={T.fontSans}>视线 →</text>

        {/* 右侧：光谱仪条纹（多普勒红蓝移） */}
        <rect x={waveX0} y={34} width={waveW} height={18} rx={3} fill="url(#spectrum)" opacity={0.85} />
        {/* 吸收线：随 vr 平移，朝我们蓝移（左）、远离红移（右） */}
        {[0.18, 0.42, 0.66, 0.86].map((p, i) => (
          <line key={i}
            x1={waveX0 + p * waveW + specShift} y1={34}
            x2={waveX0 + p * waveW + specShift} y2={52}
            stroke="#0B1020" strokeWidth={3} opacity={0.75} />
        ))}
        <text x={waveX0} y={30} fontSize={12} fill={T.inkSoft} fontFamily={T.fontSans}>
          恒星光谱 {vr > 0.2 ? '← 蓝移' : vr < -0.2 ? '红移 →' : '静止'}
        </text>

        {/* 径向速度波形 */}
        <line x1={waveX0} y1={waveY} x2={waveX0 + waveW} y2={waveY} stroke={T.line} strokeWidth={1.5} />
        <line x1={waveX0} y1={waveY - waveH - 12} x2={waveX0} y2={waveY + waveH + 12} stroke={T.line} strokeWidth={1.5} />
        <polyline points={pts} fill="none" stroke={T.gold} strokeWidth={3} strokeLinecap="round" />
        <circle cx={waveX0 + (drawT / 8) * waveW} cy={waveY - vr * waveH} r={6} fill={T.accent}
          style={{ filter: `drop-shadow(0 0 8px ${T.accent})` }} />
        <text x={waveX0} y={waveY + waveH + 34} fontSize={12} fill={T.inkSoft} fontFamily={T.fontSans}>径向速度 v(t)</text>
        <text x={waveX0 + waveW - 78} y={waveY - waveH - 20} fontSize={12} fill={T.gold} fontFamily={T.fontSans}>K ≈ 16 km/s</text>
      </svg>
    </div>
  )
}

/** 噪声数据点 + 正弦拟合曲线浮现：从观测反推模型 */
function WaveFitScene({ frame, T }: { frame: number; T: typeof theme }) {
  const t = frame / 30
  const w = 1060, h = 300
  const x0 = 40, y0 = h / 2
  const K = 100, period = 300
  // 固定种子的"观测点"（确定性）
  const pts = Array.from({ length: 26 }, (_, i) => {
    const x = x0 + (i / 25) * (w - 80)
    const jitter = (Math.sin(i * 91.7) * 0.5 + 0.5 - 0.5) * 18
    const y = y0 - Math.sin((x / period) * Math.PI * 2) * K + jitter
    return { x, y, i }
  })
  const reveal = clamp01((frame - 10) / 50)
  const fitProgress = clamp01((frame - 40) / 60)

  return (
    <div style={{ position: 'relative', width: w, height: h * 0.8, overflow: 'visible' }}>
      <svg width={w} height={h} style={{ transform: 'scale(0.8)', transformOrigin: 'top left' }}>
        <line x1={x0} y1={y0} x2={w - 40} y2={y0} stroke={T.line} strokeWidth={1.5} />
        {/* 观测散点逐个出现 */}
        {pts.filter((p) => p.i / pts.length <= reveal).map((p) => (
          <circle key={p.i} cx={p.x} cy={p.y} r={5} fill={T.accent} opacity={0.8} />
        ))}
        {/* 拟合正弦曲线随后生长 */}
        {fitProgress > 0 && Array.from({ length: Math.floor(fitProgress * 160) }, (_, i) => {
          const x = x0 + (i / 160) * (w - 80)
          const y = y0 - Math.sin((x / period) * Math.PI * 2) * K
          return <circle key={`f${i}`} cx={x} cy={y} r={2.2} fill={T.gold} opacity={0.9} />
        })}
        <text x={x0} y={h - 8} fontSize={13} fill={T.inkSoft} fontFamily={T.fontSans}>望远镜观测点</text>
        <text x={w - 150} y={h - 8} fontSize={13} fill={T.gold} fontFamily={T.fontSans}>拟合的正弦波</text>
      </svg>
    </div>
  )
}

/** 振子同步可视化：16 个个体从相位混乱逐渐对齐（本篇的核心数学） */
function OscillatorSync({ frame, accent }: { frame: number; accent: string }) {
  const n = 16
  const width = 920
  const t = frame / 30
  // 耦合强度随时间增强：0 -> 1
  const coupling = clamp01(interpolate(frame, [12, 100], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  }))
  return (
    <div style={{ position: 'relative', width, height: 220, margin: '8px 0' }}>
      {/* 基线与耦合强度标注 */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 110, height: 1, background: theme.line }} />
      {Array.from({ length: n }, (_, i) => {
        const x = 30 + (i / (n - 1)) * (width - 60)
        // 未耦合时每人自己的频率/相位；耦合后收敛到共同节奏
        const ownFreq = 0.8 + ((i * 7) % 5) * 0.22
        const ownPhase = ((i * 13) % 17) / 17 * Math.PI * 2
        const common = t * 2.2
        // 未耦合：各走各的（自身相位+频率）；完全耦合：收敛到共同节奏
        const phase = (ownPhase + ownFreq * t) * (1 - coupling) + common * coupling
        const y = 110 + Math.sin(phase) * (58 - coupling * 18)
        const hue = coupling > 0.7 ? accent : `${accent}AA`
        return (
          <div key={i} style={{ position: 'absolute', left: x - 9, top: y - 9, width: 18, height: 18 }}>
            {/* 机器人身体 */}
            <div style={{
              width: 18, height: 18, borderRadius: 5, background: hue,
              boxShadow: coupling > 0.7 ? `0 0 14px ${accent}88` : 'none',
              transition: 'none',
            }} />
            {/* 相位指示线（像手臂/朝向） */}
            <div style={{
              position: 'absolute', left: 8, top: 8, width: 14, height: 2,
              background: '#fff', transformOrigin: '0 50%',
              transform: `rotate(${phase * 180 / Math.PI}deg)`,
            }} />
          </div>
        )
      })}
      {/* 同步度进度条 */}
      <div style={{ position: 'absolute', right: 0, bottom: 0, fontFamily: theme.fontSans, fontSize: 13, color: theme.inkSoft }}>
        同步度 {(coupling * 100).toFixed(0)}%
      </div>
      <div style={{ position: 'absolute', right: 0, bottom: 20, width: 160, height: 4, background: theme.line, borderRadius: 2 }}>
        <div style={{ width: `${coupling * 100}%`, height: 4, background: accent, borderRadius: 2 }} />
      </div>
    </div>
  )
}

/** 单场景渲染（增强版） */
export function SceneView({ scene, branch, category, liveLines, activeWords, visualTheme }: {
  scene: SceneData; branch: string; category: string; liveLines?: string[];
  activeWords?: string[]; visualTheme?: 'paper' | 'space'
}) {
  const frame = useCurrentFrame()
  const enter = useEnter(frame)
  const chartProgress = clamp01(interpolate(frame, [10, 50], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  }))

  const camera = useMemo(() => cameraPath([
    { at: 0, center: [theme.width / 2, theme.height / 2], zoom: scene.kind === 'hook' || scene.kind === 'insight' ? 1.02 : 1, rotation: 0, stop: true },
    { at: 6, center: [theme.width / 2, theme.height / 2], zoom: scene.kind === 'hook' || scene.kind === 'insight' ? 1.07 : 1, rotation: 0, stop: true },
  ]), [scene.kind])
  const cam = camera(frame / 30)
  // 场景开头 0.4 秒的镜头震动，配合音乐 impact（大场景更明显）
  const [shakeX, shakeY] = shake(frame / 30, {
    start: 0, duration: 0.4,
    amplitude: scene.kind === 'formula' || scene.kind === 'insight' ? 7 : 4,
    frequency: 20, seed: `shake-${scene.kind}`,
  })
  const T = themeFor(visualTheme || 'paper')
  const t = frame / 30
  const accent = T.accent

  // 长公式按 \qquad / ,\qquad 拆成多行；每行单独 KaTeX 渲染并按长度自适应字号，
  // 避免 displayMode 单行公式超出 1280px 画幅被截断（实测会溢出右侧）。
  const formulaLines = useMemo(() => {
    if (!scene.formula) return []
    const raw = scene.formula
      .replace(/\\qquad/g, '|SPLIT|')
      .replace(/\\,/g, ' ')
    return raw.split('|SPLIT|').map((s) => s.trim().replace(/^,|,$/g, '').trim()).filter(Boolean)
  }, [scene.formula])

  const formulaHtmls = useMemo(() => formulaLines.map((line) => {
    try {
      return katex.renderToString(line, { displayMode: true, throwOnError: false, strict: 'ignore' })
    } catch { return '' }
  }), [formulaLines])

  // 按"可见字符数"估算字号：去掉 LaTeX 命令名与花括号，避免命令长度误导。
  // 每行独立字号，让短行更大、长行收缩，整体更饱满。
  const visibleLen = (s: string) => s
    .replace(/\\[a-zA-Z]+/g, '')      // \frac \left 等命令
    .replace(/[{}_^]/g, '')           // 排版符号
    .replace(/\s/g, '').length || 1
  const formulaFonts = useMemo(() => formulaLines.map((line) => {
    const n = visibleLen(line)
    return Math.max(24, Math.min(40, Math.floor(900 / n)))
  }), [formulaLines])

  // 场景转场：不同场景用不同入场遮罩，制造"镜头切换"感
  const transition = useMemo(() => {
    const t = frame / 30
    if (scene.kind === 'hook') return iris(theme.width, theme.height, [0.5, 0.5])(unit(t, 0, 0.7)).inStyle
    if (scene.kind === 'formula' || scene.kind === 'steps')
      return gridMask(12, 7, `grid-${scene.kind}`, 'diagonal')(unit(t, 0, 0.75)).inStyle
    return undefined
  }, [frame, scene.kind])

  return (
    <AbsoluteFill style={transition}>
      <AbsoluteFill style={{ transformOrigin: '50% 50%',
        transform: `translate(${shakeX}px, ${shakeY}px) scale(${cam.zoom})` }}>
        <LivingBackdrop kind={scene.kind} frame={frame} accent={accent} T={T} />
      </AbsoluteFill>

      <Header branch={branch} category={category} T={T} />

      {(scene.kind === 'formula' || scene.kind === 'insight') && (
        <LightSweep progress={unit(frame / 30, 0.6, 2.0)} opacity={0.10} angle={-18} color={accent} />
      )}

      <div style={{
        position: 'absolute', top: 110, left: 72, right: 72, bottom: 130,
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28,
        opacity: enter, transform: `translateY(${(1 - enter) * 28}px)`,
      }}>
        {scene.kind === 'hook' && (
          <>
            <div style={{ fontSize: 22, color: accent, letterSpacing: 4, fontFamily: T.fontSans }}>
              一个真实发生的问题
            </div>
            {/* 标题逐字解码入场：错位+模糊 -> 归位清晰，配合开场的 impact */}
            <div style={{ fontFamily: T.fontSerif, fontSize: 58, lineHeight: 1.35,
              fontWeight: 600, color: T.ink, maxWidth: 1000, display: 'flex', flexWrap: 'wrap' }}>
              {Array.from(scene.title).map((ch, i) => {
                const p = clamp01(interpolate(frame, [6 + i * 1.6, 20 + i * 1.6], [0, 1], {
                  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                }))
                return (
                  <span key={i} style={{
                    display: 'inline-block',
                    opacity: p,
                    transform: `translateY(${(1 - p) * 22}px) scale(${0.86 + p * 0.14})`,
                    filter: `blur(${(1 - p) * 5}px)`,
                    color: p < 0.6 ? accent : T.ink,
                  }}>{ch}</span>
                )
              })}
            </div>
            {(liveLines || (scene.body ? [scene.body] : [])).map((line, i) => (
              <RichText key={i} text={line} frame={frame - i * 8} size={30} activeWords={activeWords} T={T} />
            ))}
          </>
        )}

        {scene.kind === 'story' && (
          <>
            <div style={{ fontFamily: T.fontSerif, fontSize: 44, fontWeight: 600, color: T.ink }}>
              {scene.title}
            </div>
            <div style={{ display: 'flex', gap: 48, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                {(liveLines || (scene.body ? [scene.body] : [])).map((line, i) => (
                  <RichText key={i} text={line} frame={frame - i * 8} size={29} activeWords={activeWords} T={T} />
                ))}
              </div>
              {scene.chart && <AnimatedChart chart={scene.chart} progress={chartProgress} frame={frame} />}
            </div>
          </>
        )}

        {scene.kind === 'formula' && (
          <>
            <div style={{ fontFamily: T.fontSerif, fontSize: 42, color: T.ink, fontWeight: 600 }}>
              {scene.title}
            </div>
            <div style={{
              color: accent, background: `${T.paperAlt}E8`, padding: '20px 36px',
              borderRadius: 16, borderLeft: `6px solid ${accent}`,
              boxShadow: '0 12px 40px rgba(80,40,25,0.08)',
              maxWidth: '100%', overflow: 'visible',
            }}>
              {formulaHtmls.map((html, i) => (
                <div key={i} style={{
                  fontSize: formulaFonts[i], lineHeight: 1.15,
                  whiteSpace: 'nowrap', overflow: 'visible',
                  textAlign: 'center',
                }} dangerouslySetInnerHTML={{ __html: html }} />
              ))}
            </div>
            {/* 公式场景不放正文：字幕条已承担讲解，避免卡片变高后与字幕重叠 */}
          </>
        )}

        {scene.kind === 'steps' && (
          <>
            <div style={{ fontFamily: T.fontSerif, fontSize: 42, color: T.ink, fontWeight: 600 }}>
              {scene.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {(scene.items || []).map((item, i) => {
                const itemEnter = spring({ frame: Math.max(0, frame - 12 - i * 18), fps: 30,
                  config: { damping: 20, stiffness: 100 } })
                const lineP = clamp01(interpolate(frame, [12 + i * 18, 30 + i * 18], [0, 1], {
                  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                }))
                return (
                  <div key={i} style={{ display: 'flex', gap: 20, alignItems: 'flex-start',
                    opacity: itemEnter, transform: `translateX(${(1 - itemEnter) * 30}px)` }}>
                    <div style={{
                      minWidth: 44, height: 44, borderRadius: '50%', background: accent, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: T.fontSans, fontSize: 22,
                      boxShadow: `0 0 0 ${lineP * 8}px ${accent}22`,
                    }}>{i + 1}</div>
                    <div style={{ fontFamily: T.fontSerif, fontSize: 29, color: T.ink,
                      lineHeight: 1.7, paddingTop: 4 }}>{item}</div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* 专属场景：振子同步动画——多个个体从相位混乱逐渐对齐，正是本篇讲的数学 */}
        {scene.kind === 'sync' && (
          <>
            <div style={{ fontFamily: T.fontSerif, fontSize: 44, fontWeight: 600, color: T.ink }}>
              {scene.title}
            </div>
            <OscillatorSync frame={frame} accent={accent} />
            {(liveLines || []).map((line, i) => (
              <RichText key={i} text={line} frame={frame - i * 8} size={25} activeWords={activeWords} T={T} />
            ))}
          </>
        )}

        {/* 体育/幂律：举重动画，体型与力量的 2/3 次方关系可视化 */}
        {scene.kind === 'lifting' && (
          <>
            <div style={{ fontFamily: T.fontSerif, fontSize: 42, fontWeight: 600, color: T.ink }}>
              {scene.title}
            </div>
            <LifterScene frame={frame} accent={T.accent} ink={T.ink} soft={T.inkSoft} />
            {(liveLines || []).map((line, i) => (
              <RichText key={i} text={line} frame={frame - i * 8} size={25} activeWords={activeWords} T={T} />
            ))}
          </>
        )}

        {/* 天文开场镜头：巨大星球占据画面 + 镜头推近 + 透镜光晕 */}
        {scene.kind === 'cosmic-intro' && (
          <>
            <div style={{ position: 'relative', height: 400, overflow: 'visible', marginTop: -34 }}>
              {/* 大范围星云辉光：CSS 渐变铺满，不受 SVG viewBox 裁切 */}
              <div style={{
                position: 'absolute', inset: -40,
                background: `radial-gradient(ellipse 46% 72% at 74% 48%, ${T.accent}4D 0%, ${T.accent}18 38%, transparent 72%),
                             radial-gradient(ellipse 30% 60% at 20% 34%, ${T.blue}33 0%, transparent 70%)`,
                pointerEvents: 'none',
              }} />
              <svg width={1140} height={400}
                style={{ position: 'absolute', inset: 0,
                  transform: `scale(${1 + clamp01(frame / 90) * 0.16})`,
                  transformOrigin: '72% 48%' }}>
                {/* 浓密星场 */}
                {Array.from({ length: 46 }, (_, i) => {
                  const px = (keyedRandom('intro-stars', `${i}:x`) * 1140)
                  const py = (keyedRandom('intro-stars', `${i}:y`) * 340)
                  const tw = 0.3 + Math.abs(Math.sin(t * 1.4 + i * 0.8)) * 0.5
                  return <circle key={i} cx={px} cy={py}
                    r={0.7 + keyedRandom('intro-stars', `${i}:r`) * 1.4}
                    fill="#FFFFFF" opacity={tw} />
                })}
                {/* 引力涟漪：从质心扩散的同心圆 */}
                {[0, 1, 2].map((i) => {
                  const p = ((t * 0.35 + i / 3) % 1)
                  return <circle key={`r${i}`} cx={470} cy={190} r={40 + p * 300}
                    fill="none" stroke={T.blue} strokeWidth={1} opacity={(1 - p) * 0.25} />
                })}
                {/* 主星：巨大的红矮星，日冕喷发 */}
                <g transform={`translate(0 ${(1 - clamp01(frame / 36)) * 80})`}>
                  <StarBall x={790} y={190} r={178} frame={frame}
                    kind="red-dwarf" uid="intro-main" drama={1.35} />
                </g>
                {/* 远处白矮星：十字星芒 */}
                <g opacity={0.88}>
                  <StarBall x={248} y={118} r={54} frame={frame}
                    kind="white-dwarf" uid="intro-comp" drama={1.5} />
                </g>
                {/* 引力连线 */}
                <line x1={305} y1={128} x2={612} y2={180}
                  stroke={T.blue} strokeWidth={1.2} strokeDasharray="3 9" opacity={0.5} />
                <text x={300} y={100} fontSize={14} fill={T.blue} fontFamily={T.fontSans}>看不见的伴星</text>
                {/* 透镜光晕：从主星中心横向拉出的光带 */}
                <rect x={560} y={188} width={580} height={2} fill={T.accent} opacity={0.18}
                  style={{ filter: 'blur(1px)' }} />
              </svg>
            </div>
            <div style={{ fontFamily: T.fontSerif, fontSize: 44, fontWeight: 700,
              color: T.ink, textAlign: 'center', letterSpacing: 1 }}>
              {scene.title}
            </div>
            {(liveLines || []).map((line, i) => (
              <RichText key={i} text={line} frame={frame - i * 8} size={24} activeWords={activeWords} T={T} />
            ))}
          </>
        )}

        {/* 天文专属：双星轨道 + 径向速度实时描绘 */}
        {scene.kind === 'orbit' && (
          <>
            <div style={{ fontFamily: T.fontSerif, fontSize: 40, fontWeight: 600, color: T.ink, marginBottom: 4 }}>
              {scene.title}
            </div>
            <OrbitScene frame={frame} T={T} />
            {(liveLines || []).map((line, i) => (
              <RichText key={i} text={line} frame={frame - i * 8} size={23} activeWords={activeWords} T={T} />
            ))}
          </>
        )}

        {/* 天文专属：从噪声观测里拟合出正弦波 */}
        {scene.kind === 'wavefit' && (
          <>
            <div style={{ fontFamily: T.fontSerif, fontSize: 40, fontWeight: 600, color: T.ink }}>
              {scene.title}
            </div>
            <WaveFitScene frame={frame} T={T} />
            {(liveLines || []).map((line, i) => (
              <RichText key={i} text={line} frame={frame - i * 8} size={23} activeWords={activeWords} T={T} />
            ))}
          </>
        )}

        {scene.kind === 'insight' && (
          <div style={{ background: `${accent}12`, padding: '48px 56px', borderRadius: 20,
            borderLeft: `8px solid ${accent}`, boxShadow: '0 16px 48px rgba(80,40,25,0.10)' }}>
            <div style={{ fontSize: 26, color: accent, letterSpacing: 3, fontFamily: T.fontSans,
              marginBottom: 20 }}>一句话记住</div>
            <div style={{ fontFamily: T.fontSerif, fontSize: 42, lineHeight: 1.6, color: T.ink }}>
              {scene.title}
            </div>
          </div>
        )}

        {scene.kind === 'question' && (
          <>
            <div style={{ fontSize: 24, color: accent, letterSpacing: 4, fontFamily: T.fontSans }}>
              轮到你了
            </div>
            <div style={{ fontFamily: T.fontSerif, fontSize: 46, lineHeight: 1.6,
              color: T.ink, maxWidth: 1000 }}>{scene.title}</div>
          </>
        )}

        {scene.kind === 'end' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: T.fontSerif, fontSize: 52, color: T.ink, marginBottom: 24 }}>
              {scene.title}
            </div>
            <div style={{ fontFamily: T.fontSans, fontSize: 28, color: accent, letterSpacing: 3 }}>
              MathInsight · 让公式成为可探索的世界
            </div>
            <div style={{ fontFamily: T.fontSans, fontSize: 22, color: T.inkSoft, marginTop: 32 }}>
              去平台看完整解读与交互图 →
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  )
}
