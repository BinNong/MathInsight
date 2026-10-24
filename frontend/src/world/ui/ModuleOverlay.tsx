import { useEffect } from 'react'
import { useWorldStore } from '../store'

/** 现有 2D 可视化模块的 iframe 浮层：演示流程不离开 3D 世界 */
export default function ModuleOverlay() {
  const overlay = useWorldStore((s) => s.overlay)
  const closeOverlay = useWorldStore((s) => s.closeOverlay)
  const lockControls = useWorldStore((s) => s.lockControls)

  useEffect(() => {
    if (!overlay) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') closeOverlay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlay, closeOverlay])

  if (!overlay) return null

  const close = () => {
    closeOverlay()
    lockControls?.()
  }

  return (
    <div className="world-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="world-overlay-bar">
        <span className="world-overlay-title">◈ {overlay.title}</span>
        <button className="world-btn primary" onClick={close}>
          返回世界（ESC）
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
