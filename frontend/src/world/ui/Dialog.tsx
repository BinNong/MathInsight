import { useEffect, useState } from 'react'
import { useWorldStore } from '../store'

const LINES = [
  '欢迎来到数学宇宙群岛。我是「数灵」，你的数学向导。',
  '东方是梯度山脉——那里的地面本身就是函数 z = f(x, y)。跟着发光的最速下降流线，走到谷底的光柱吧。',
  '西方是矩阵岛。站上装置按 E 切换矩阵，你会看到整个空间被拉伸、旋转，甚至坍缩成平面（那就是奇异矩阵）。',
  '南方的概率之岛正在下骰子雨。落在地上的每一枚骰子，都会堆成真实的分布直方图。',
  '每座岛上的光环通往对应的交互实验室，随时可以深入探索。祝你在数学宇宙里玩得开心。',
]

/** 「数灵」对话面板 */
export default function Dialog() {
  const open = useWorldStore((s) => s.dialogOpen)
  const setDialogOpen = useWorldStore((s) => s.setDialogOpen)
  const openOverlay = useWorldStore((s) => s.openOverlay)
  const lockControls = useWorldStore((s) => s.lockControls)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (open) setIdx(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') setDialogOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setDialogOpen])

  if (!open) return null

  const close = () => {
    setDialogOpen(false)
    lockControls?.()
  }
  const goto = (route: string, title: string) => {
    setDialogOpen(false)
    openOverlay({ route, title })
  }

  const last = idx === LINES.length - 1

  return (
    <div className="world-dialog-wrap" onClick={(e) => e.stopPropagation()}>
      <div className="world-dialog">
        <div className="world-dialog-name">✦ 数灵 · 数学导师</div>
        <p className="world-dialog-text">{LINES[idx]}</p>
        <div className="world-dialog-actions">
          {!last ? (
            <button className="world-btn primary" onClick={() => setIdx(idx + 1)}>
              继续 ▾
            </button>
          ) : (
            <>
              <button className="world-btn primary" onClick={close}>
                继续探索
              </button>
              <button className="world-btn" onClick={() => goto('/solver', 'AI 解题导师')}>
                向 AI 解题导师提问
              </button>
              <button className="world-btn" onClick={() => goto('/knowledge-map', '知识星图')}>
                查看知识星图
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
