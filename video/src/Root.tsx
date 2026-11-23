import React from 'react'
import { Composition } from 'remotion'
import { HotspotExplainer } from './HotspotExplainer'
import { theme } from './theme'
import type { VideoScript } from './types'
import scriptData from './script.json'

const script = scriptData as VideoScript

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="HotspotExplainer"
      component={HotspotExplainer}
      durationInFrames={Math.round(script.duration * script.fps)}
      fps={script.fps}
      width={theme.width}
      height={theme.height}
      defaultProps={{ script }}
    />
  )
}
