import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { startGame, type GameHandle } from './engine/loop'
import Intro from './ui/Intro'
import Hud from './ui/Hud'
import Dialog from './ui/Dialog'
import Quiz from './ui/Quiz'
import Training from './ui/Training'
import Codex from './ui/Codex'
import ModuleOverlay from './ui/ModuleOverlay'
import './world2d.css'

export default function World2DPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let handle: GameHandle | null = null
    let cancelled = false
    const win = window as unknown as { __world2d?: GameHandle }
    setLoading(true)
    setError(null)

    startGame(canvas)
      .then((game) => {
        if (cancelled) {
          game.stop()
          return
        }
        handle = game
        if (import.meta.env.DEV) win.__world2d = game
      })
      .catch(() => {
        if (!cancelled) setError('游戏素材加载失败，请检查网络后重试。')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      if (handle && win.__world2d === handle) delete win.__world2d
      handle?.stop()
    }
  }, [attempt])

  return (
    <div className="world-root world2d-root">
      <canvas ref={canvasRef} className="world2d-canvas" aria-label="微积分大陆游戏画布" />
      <Link to="/" className="world2d-home-link">
        ← 学习工作台
      </Link>
      {loading && (
        <div className="world2d-load-status" role="status">
          正在准备数学小镇…
        </div>
      )}
      {error && (
        <div className="world2d-load-error" role="alert">
          <strong>暂时无法进入数学小镇</strong>
          <p>{error}</p>
          <div>
            <button
              type="button"
              className="world-btn primary"
              onClick={() => setAttempt((n) => n + 1)}
            >
              重新加载
            </button>
            <Link to="/" className="world-btn">
              返回首页
            </Link>
          </div>
        </div>
      )}
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
