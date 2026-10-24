import { useEffect, useRef } from 'react'
import { startGame } from './engine/loop'
import Intro from './ui/Intro'
import Hud from './ui/Hud'
import Dialog from './ui/Dialog'
import Quiz from './ui/Quiz'
import Training from './ui/Training'
import Codex from './ui/Codex'
import ModuleOverlay from './ui/ModuleOverlay'

/** 微积分大陆 —— 俯视角像素风漫游入口页 */
export default function World2DPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let handle: {
      stop: () => void
      teleport: (x: number, y: number) => void
      mobPositions: () => unknown
      fillMp: () => void
      scene: () => string
    } | null = null
    let cancelled = false
    const win = window as unknown as {
      __world2d?: { teleport: (x: number, y: number) => void; mobPositions: () => unknown; fillMp: () => void; scene: () => string }
    }
    startGame(canvas).then((h) => {
      if (cancelled) {
        h.stop()
      } else {
        handle = h
        // 调试钩子只跟随存活实例（StrictMode 会双挂载，被弃实例不得留钩子）
        win.__world2d = { teleport: h.teleport, mobPositions: h.mobPositions, fillMp: h.fillMp, scene: h.scene }
      }
    })
    return () => {
      cancelled = true
      if (handle && win.__world2d?.teleport === handle.teleport) delete win.__world2d
      handle?.stop()
    }
  }, [])

  return (
    <div className="world-root world2d-root">
      <canvas ref={canvasRef} className="world2d-canvas" />
      <Hud />
      <Intro />
      <Dialog />
      <Quiz />
      <Training />
      <Codex />
      <ModuleOverlay />
    </div>
  )
}
