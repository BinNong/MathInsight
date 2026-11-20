import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'

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

interface Point {
  x: number
  y: number
}

interface Size {
  width: number
  height: number
}

interface DragStart extends Point {
  pointerId: number
  panelX: number
  panelY: number
}

interface ResizeStart extends Point {
  pointerId: number
  width: number
  height: number
}

function initialSize(width: number, height: number, minWidth: number, minHeight: number): Size {
  const viewportWidth = typeof window === 'undefined' ? width : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? height : window.innerHeight
  return {
    width: Math.min(width, Math.max(Math.min(minWidth, 180), viewportWidth - 32)),
    height: Math.min(height, Math.max(Math.min(minHeight, 160), viewportHeight - 32)),
  }
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
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef<DragStart | null>(null)
  const resizeStart = useRef<ResizeStart | null>(null)
  const restoreRef = useRef<{ position: Point; size: Size } | null>(null)
  const [size, setSize] = useState<Size>(() =>
    initialSize(defaultWidth, defaultHeight, minWidth, minHeight)
  )
  const [position, setPosition] = useState<Point>(() => {
    const viewportWidth = typeof window === 'undefined' ? defaultWidth : window.innerWidth
    const viewportHeight = typeof window === 'undefined' ? defaultHeight : window.innerHeight
    const preferredX = defaultX ?? (viewportWidth - size.width) / 2
    const preferredY = defaultY ?? (viewportHeight - size.height) / 3
    return {
      x: Math.max(8, Math.min(preferredX, viewportWidth - size.width - 8)),
      y: Math.max(8, Math.min(preferredY, viewportHeight - 56)),
    }
  })
  const [isMinimized, setIsMinimized] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)

  const clampPosition = useCallback(
    (x: number, y: number, width = size.width) => {
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      return {
        x: Math.max(8, Math.min(x, viewportWidth - Math.min(width, viewportWidth - 16) - 8)),
        y: Math.max(8, Math.min(y, viewportHeight - 56)),
      }
    },
    [size.width]
  )

  const boundedSize = useCallback(
    (width: number, height: number): Size => {
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const effectiveMinWidth = Math.min(minWidth, Math.max(180, viewportWidth - 16))
      const effectiveMinHeight = Math.min(minHeight, Math.max(160, viewportHeight - 16))
      const maxWidth = Math.max(effectiveMinWidth, viewportWidth - position.x - 8)
      const maxHeight = Math.max(effectiveMinHeight, viewportHeight - position.y - 8)
      return {
        width: Math.min(Math.max(width, effectiveMinWidth), maxWidth),
        height: Math.min(Math.max(height, effectiveMinHeight), maxHeight),
      }
    },
    [minWidth, minHeight, position.x, position.y]
  )

  useEffect(() => {
    const handleViewportResize = () => {
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      setSize((current) => ({
        width: Math.min(current.width, Math.max(180, viewportWidth - 16)),
        height: Math.min(current.height, Math.max(160, viewportHeight - 16)),
      }))
      setPosition((current) => clampPosition(current.x, current.y))
    }
    window.addEventListener('resize', handleViewportResize)
    return () => window.removeEventListener('resize', handleViewportResize)
  }, [clampPosition])

  useEffect(() => {
    if (!isDragging && !isResizing) return
    const previousUserSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.userSelect = previousUserSelect
    }
  }, [isDragging, isResizing])

  const handleHeaderPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panelX: position.x,
      panelY: position.y,
    }
    setIsDragging(true)
  }

  const handleHeaderPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current
    if (!start || start.pointerId !== event.pointerId) return
    setPosition(
      clampPosition(start.panelX + event.clientX - start.x, start.panelY + event.clientY - start.y)
    )
  }

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current?.pointerId !== event.pointerId) return
    dragStart.current = null
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleResizePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width: size.width,
      height: size.height,
    }
    setIsResizing(true)
  }

  const handleResizePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const start = resizeStart.current
    if (!start || start.pointerId !== event.pointerId) return
    setSize(
      boundedSize(start.width + event.clientX - start.x, start.height + event.clientY - start.y)
    )
  }

  const stopResizing = (event: PointerEvent<HTMLButtonElement>) => {
    if (resizeStart.current?.pointerId !== event.pointerId) return
    resizeStart.current = null
    setIsResizing(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleResizeKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const deltas: Record<string, Point> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    }
    const delta = deltas[event.key]
    if (!delta) return
    event.preventDefault()
    const step = event.shiftKey ? 64 : 16
    setSize((current) =>
      boundedSize(current.width + delta.x * step, current.height + delta.y * step)
    )
  }

  const handleMaximize = () => {
    if (isMaximized && restoreRef.current) {
      setPosition(restoreRef.current.position)
      setSize(restoreRef.current.size)
      restoreRef.current = null
      setIsMaximized(false)
      return
    }
    restoreRef.current = { position, size }
    setPosition({ x: 8, y: 8 })
    setSize({ width: window.innerWidth - 16, height: window.innerHeight - 16 })
    setIsMinimized(false)
    setIsMaximized(true)
  }

  return (
    <div
      ref={panelRef}
      className={`floating-panel ${isMinimized ? 'minimized' : ''}`}
      role="dialog"
      aria-modal={false}
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && onClose) {
          event.stopPropagation()
          onClose()
        }
      }}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: isMinimized ? Math.min(280, window.innerWidth - 16) : size.width,
        height: isMinimized ? 'auto' : size.height,
        zIndex: 1000,
      }}
    >
      <div
        className="floating-panel-header"
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
      >
        <span id={titleId} className="floating-panel-title">
          {title}
        </span>
        <div className="floating-panel-actions">
          <button
            type="button"
            className="floating-panel-action"
            onClick={() => setIsMinimized((current) => !current)}
            title={isMinimized ? '展开' : '最小化'}
            aria-label={isMinimized ? '展开浮动图表' : '最小化浮动图表'}
          >
            {isMinimized ? '□' : '—'}
          </button>
          <button
            type="button"
            className="floating-panel-action"
            onClick={handleMaximize}
            title={isMaximized ? '还原' : '最大化'}
            aria-label={isMaximized ? '还原浮动图表' : '最大化浮动图表'}
          >
            {isMaximized ? '❐' : '□'}
          </button>
          {onClose && (
            <button
              type="button"
              className="floating-panel-action close"
              onClick={onClose}
              title="关闭"
              aria-label="关闭浮动图表并嵌入页面"
            >
              ×
            </button>
          )}
        </div>
      </div>
      {!isMinimized && (
        <>
          <div className="floating-panel-body">{children}</div>
          <button
            type="button"
            className="floating-panel-resize"
            aria-label="调整浮动图表大小，也可使用方向键"
            title="拖动调整大小，或使用方向键"
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={stopResizing}
            onPointerCancel={stopResizing}
            onKeyDown={handleResizeKeyDown}
          />
        </>
      )}
    </div>
  )
}
