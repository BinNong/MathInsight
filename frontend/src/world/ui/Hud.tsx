import { useEffect, useState } from 'react'
import { playerStats, useWorldStore } from '../store'

/** 游戏 HUD：准星、目标、交互提示、梯度读数、通关横幅 */
export default function Hud() {
  const started = useWorldStore((s) => s.started)
  const overlay = useWorldStore((s) => s.overlay)
  const dialogOpen = useWorldStore((s) => s.dialogOpen)
  const prompt = useWorldStore((s) => s.prompt)
  const objective = useWorldStore((s) => s.objective)
  const goalReached = useWorldStore((s) => s.goalReached)
  const [stats, setStats] = useState({ onMountain: false, height: 0, gradMag: 0 })

  useEffect(() => {
    const id = setInterval(() => {
      setStats({
        onMountain: playerStats.onMountain,
        height: playerStats.height,
        gradMag: playerStats.gradMag,
      })
    }, 150)
    return () => clearInterval(id)
  }, [])

  if (!started || overlay || dialogOpen) return null

  return (
    <div className="world-hud">
      <div className="world-crosshair">+</div>
      <div className="world-objective">{objective}</div>
      {prompt && <div className="world-prompt">{prompt}</div>}
      {stats.onMountain && (
        <div className="world-stats">
          <div>f(x, y) = {stats.height.toFixed(2)}</div>
          <div>|∇f| = {stats.gradMag.toFixed(2)}</div>
        </div>
      )}
      {goalReached && <div className="world-banner">🏆 梯度山脉 · 已通关</div>}
      <div className="world-hint">WASD 移动 · Shift 冲刺 · 空格跳跃 · ESC 释放鼠标</div>
    </div>
  )
}
