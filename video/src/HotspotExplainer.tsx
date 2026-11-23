import React from 'react'
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion'
import { SceneView } from './Scene'
import { CaptionOverlay } from './Caption'
import type { VideoScript } from './types'

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
            <SceneView scene={scene} branch={script.branch} category={script.category} />
          </Sequence>
        )
      })}

      {/* 字幕烧录层 */}
      <CaptionOverlay captions={script.captions} />

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
