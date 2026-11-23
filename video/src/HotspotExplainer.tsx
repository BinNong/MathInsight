import React from 'react'
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion'
import { SceneView } from './Scene'
import { CaptionOverlay } from './Caption'
import { BeatFX } from './BeatFX'
import type { VideoScript, Scene } from './types'

/** 场景内逐句推进：只显示当前场景里已说到的字幕（最多 2 句），不一次性堆满屏幕 */
const SceneWithLiveText: React.FC<{ scene: Scene; script: VideoScript }> = ({ scene, script }) => {
  const frame = useCurrentFrame()
  const t = (frame + Math.round(scene.start * script.fps)) / script.fps
  const inScene = script.captions.filter((c) => c.start >= scene.start - 0.05 && c.start < scene.end)
  const spoken = inScene.filter((c) => c.start <= t)
  const liveLines = spoken.length ? spoken.slice(-2).map((c) => c.text) : undefined
  // 当前这一句里，TTS 正在读到的词（来自实测词边界）——画面高亮与声音严格对齐
  const current = spoken[spoken.length - 1]
  const activeWords = current?.words
    ?.filter((w) => t >= w.start && t < w.end)
    .map((w) => w.text)
  return (
    <SceneView scene={scene} branch={script.branch} category={script.category}
      visualTheme={script.visualTheme} liveLines={liveLines} activeWords={activeWords} />
  )
}

/**
 * 数说热点主合成：场景按脚本时间轴排布，旁白音频铺满全片，字幕烧录在上层。
 * 所有时序来自 props（脚本 JSON），不含 Date.now / 定时器，可逐帧确定性渲染。
 */
export const HotspotExplainer: React.FC<{ script: VideoScript }> = ({ script }) => {
  const frame = useCurrentFrame()
  const fps = script.fps || 30

  return (
    <AbsoluteFill style={{ backgroundColor: '#F7F4EC' }}>
      {/* 旁白音轨：整片一条音频，Remotion 按帧同步 */}
      {script.audio && <Audio src={staticFile(`audio/${script.audio}`)} />}

      {/* 场景序列 */}
      {script.scenes.map((scene, i) => {
        const from = Math.round(scene.start * fps)
        const dur = Math.max(1, Math.round((scene.end - scene.start) * fps))
        return (
          <Sequence key={i} from={from} durationInFrames={dur} premountFor={fps}>
            <SceneWithLiveText scene={scene} script={script} />
          </Sequence>
        )
      })}

      {/* 音乐卡点特效层：与 score.mjs 共用 cues，impact 时闪光/冲击波/粒子爆发 */}
      <BeatFX cues={script.cues} accent={script.accent || '#9C3B2E'} />

      {/* 字幕烧录层 */}
      <CaptionOverlay captions={script.captions} visualTheme={script.visualTheme} />

      {/* 进度条：低调地显示播放进度，增强"视频感" */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 4,
          width: `${Math.min(100, (frame / (script.duration * fps)) * 100)}%`,
          background: script.accent || '#9C3B2E',
        }}
      />
    </AbsoluteFill>
  )
}
