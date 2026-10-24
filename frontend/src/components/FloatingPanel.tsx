import { ReactNode, useState, useRef, useEffect, useCallback } from 'react'

interface FloatingPanelProps {
  title: string
  children: ReactNode
  defaultWidth?: number
  defaultHeight?: number
  defaultX?: number
  defaultY?: number
  onClose?: () => void
  minWidth?: number
  minHeight?: number
}

export default function FloatingPanel({
  title,
  children,
  defaultWidth = 720,
  defaultHeight = 520,
  defaultX,
  defaultY,
  onClose,
  minWidth = 360,
  minHeight = 240,
}: FloatingPanelProps) {
  const [position, setPosition] = useState(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const x = defaultX ?? Math.max(16, (vw - defaultWidth) / 2)
    const y = defaultY ?? Math.max(16, (vh - defaultHeight) / 3)
    return { x, y }
  })
  const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight })
  const [isMinimized, setIsMinimized] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 })
  const resizeStart = useRef({ x: 0, y: 0, width: defaultWidth, height: defaultHeight })
  const panelRef = useRef<HTMLDivElement>(null)

  const clampPosition = useCallback(
    (x: number, y: number) => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const headerHeight = 48
      return {
        x: Math.max(0, Math.min(x, vw - Math.min(size.width, vw))),
        y: Math.max(0, Math.min(y, vh - headerHeight)),
      }
    },
    [size.width]
  )

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStart.current.x
        const dy = e.clientY - dragStart.current.y
        setPosition(clampPosition(dragStart.current.panelX + dx, dragStart.current.panelY + dy))
      } else if (isResizing) {
        const dx = e.clientX - resizeStart.current.x
        const dy = e.clientY - resizeStart.current.y
        setSize({
          width: Math.max(minWidth, resizeStart.current.width + dx),
          height: Math.max(minHeight, resizeStart.current.height + dy),
        })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
    }

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = 'none'
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
    }
  }, [isDragging, isResizing, minWidth, minHeight, clampPosition])

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.floating-panel-action')) return
    setIsDragging(true)
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      panelX: position.x,
      panelY: position.y,
    }
  }

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsResizing(true)
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    }
  }

  const handleMaximize = () => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    setPosition({ x: 16, y: 16 })
    setSize({ width: vw - 32, height: vh - 32 })
    setIsMinimized(false)
  }

  return (
    <div
      ref={panelRef}
      className={`floating-panel ${isMinimized ? 'minimized' : ''}`}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: isMinimized ? 280 : size.width,
        height: isMinimized ? 'auto' : size.height,
        zIndex: 1000,
      }}
    >
      <div className="floating-panel-header" onMouseDown={handleHeaderMouseDown}>
        <span className="floating-panel-title">{title}</span>
        <div className="floating-panel-actions">
          <button
            className="floating-panel-action"
            onClick={() => setIsMinimized((m) => !m)}
            title={isMinimized ? '展开' : '最小化'}
          >
            {isMinimized ? '□' : '—'}
          </button>
          <button className="floating-panel-action" onClick={handleMaximize} title="最大化">
            □
          </button>
          {onClose && (
            <button className="floating-panel-action close" onClick={onClose} title="关闭">
              ×
            </button>
          )}
        </div>
      </div>
      {!isMinimized && (
        <>
          <div className="floating-panel-body">{children}</div>
          <div className="floating-panel-resize" onMouseDown={handleResizeMouseDown} />
        </>
      )}
    </div>
  )
}
