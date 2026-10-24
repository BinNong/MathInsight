import { useWorldStore } from '../store'

/** 开场标题屏 */
export default function Intro() {
  const started = useWorldStore((s) => s.started)
  const setStarted = useWorldStore((s) => s.setStarted)
  const lockControls = useWorldStore((s) => s.lockControls)

  if (started) return null

  const enter = () => {
    setStarted(true)
    lockControls?.()
  }

  return (
    <div className="world-intro" onClick={(e) => e.stopPropagation()}>
      <div className="world-intro-card">
        <div className="world-intro-badge">MathInsight</div>
        <h1 className="world-intro-title">数学宇宙群岛</h1>
        <p className="world-intro-sub">第一人称漫游 · 让抽象数学成为可以行走的风景</p>
        <div className="world-intro-controls">
          <span>WASD 移动</span>
          <span>鼠标 视角</span>
          <span>Shift 冲刺</span>
          <span>空格 跳跃</span>
          <span>E 交互</span>
        </div>
        <button className="world-intro-btn" onClick={enter}>
          进入世界 →
        </button>
        <p className="world-intro-tip">建议佩戴耳机般的沉浸心态 · 点击后锁定鼠标开始探索</p>
      </div>
    </div>
  )
}
