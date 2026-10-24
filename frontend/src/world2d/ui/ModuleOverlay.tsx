import { useEffect } from 'react'
import { useWorld2DStore } from '../store'

/** 现有交互实验模块的 iframe 浮层：不离开 2D 世界 */
export default function ModuleOverlay() {
  const overlay = useWorld2DStore((s) => s.overlay)
  const closeOverlay = useWorld2DStore((s) => s.closeOverlay)

  useEffect(() => {
    if (!overlay) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') closeOverlay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlay, closeOverlay])

  if (!overlay) return null

  return (
    <div className="world-overlay">
      <div className="world-overlay-bar">
        <span className="world-overlay-title">◈ {overlay.title}</span>
        <button className="world-btn primary" onClick={closeOverlay}>
          返回小镇（ESC）
        </button>
      </div>
      <iframe
        className="world-overlay-frame"
        src={`/mathinsight${overlay.route}`}
        title={overlay.title}
      />
    </div>
  )
}
