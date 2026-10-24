import { useEffect, useMemo, useState } from 'react'
import { useWorld2DStore } from '../store'
import { getWorld } from '../data/world'
import { getInterior } from '../data/interiors'
import { loadAssets } from '../engine/assets'
import { npcPortrait } from '../engine/sprites'

const NPC_COLORS: Record<string, string> = {
  shuling: '#c4b5fd',
  jifen: '#93c5fd',
  juzhen: '#fdba74',
  gailv: '#6ee7b7',
  luobida: '#fda4af',
  newton: '#93c5fd',
  laibunizi: '#fcd34d',
}

/** 全场景 NPC 查找（小镇 + 三间修炼馆） */
function findNpc(id: string | null) {
  if (!id) return null
  const outdoor = getWorld().npcs.find((n) => n.id === id)
  if (outdoor) return outdoor
  for (const hall of ['limit', 'derivative', 'integral'] as const) {
    const hit = getInterior(hall).npcs.find((n) => n.id === id)
    if (hit) return hit
  }
  return null
}

/** NPC 对话框：打字机效果 + 像素头像；修炼馆导师附带修炼入口 */
export default function Dialog() {
  const npcId = useWorld2DStore((s) => s.dialogNpc)
  const setDialogNpc = useWorld2DStore((s) => s.setDialogNpc)
  const openOverlay = useWorld2DStore((s) => s.openOverlay)
  const setTraining = useWorld2DStore((s) => s.setTraining)
  const setCodex = useWorld2DStore((s) => s.setCodex)
  const [idx, setIdx] = useState(0)
  const [typed, setTyped] = useState(0)
  const [portraits, setPortraits] = useState<Record<string, string>>({})

  const npc = useMemo(() => findNpc(npcId), [npcId])

  useEffect(() => {
    let cancelled = false
    loadAssets().then((a) => {
      if (cancelled) return
      const map: Record<string, string> = {}
      for (const k of ['wizard', 'knight', 'peasant', 'keeper', 'host', 'scholar', 'sage']) map[k] = npcPortrait(a, k)
      setPortraits(map)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setIdx(0)
    setTyped(0)
  }, [npcId])

  const line = npc?.lines[idx] ?? ''
  const done = typed >= line.length

  // 打字机
  useEffect(() => {
    if (!npc || done) return
    const id = setInterval(() => setTyped((t) => Math.min(t + 1, line.length)), 28)
    return () => clearInterval(id)
  }, [npc, line, done])

  useEffect(() => {
    if (!npcId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') setDialogNpc(null)
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') advance()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [npcId, idx, done, line])

  if (!npc) return null

  const advance = () => {
    if (!done) {
      setTyped(line.length)
      return
    }
    if (idx < npc.lines.length - 1) {
      setIdx(idx + 1)
      setTyped(0)
    } else {
      setDialogNpc(null)
    }
  }

  const last = idx === npc.lines.length - 1
  const color = NPC_COLORS[npc.id] ?? '#e0e7ff'

  return (
    <div className="world-dialog-wrap">
      <div className="world-dialog world2d-dialog">
        <div className="world2d-dialog-head">
          {portraits[npc.sprite] && <img className="world2d-portrait" src={portraits[npc.sprite]} alt={npc.name} />}
          <div className="world-dialog-name" style={{ color }}>
            {npc.name}
          </div>
        </div>
        <p className="world-dialog-text" onClick={advance}>
          {line.slice(0, typed)}
          {!done && <span className="world2d-caret">▌</span>}
        </p>
        <div className="world-dialog-actions">
          {!last ? (
            <button className="world-btn primary" onClick={advance}>
              继续 ▾
            </button>
          ) : (
            <>
              {npc.training && (
                <button
                  className="world-btn primary"
                  onClick={() => {
                    setDialogNpc(null)
                    setTraining({ hall: npc.training! })
                  }}
                >
                  ⚔ 开始修炼
                </button>
              )}
              {npc.training && (
                <button
                  className="world-btn"
                  onClick={() => {
                    setDialogNpc(null)
                    setCodex(true)
                  }}
                >
                  📖 修炼手札
                </button>
              )}
              <button className={npc.training ? 'world-btn' : 'world-btn primary'} onClick={() => setDialogNpc(null)}>
                继续探索
              </button>
              {npc.links?.map((l) => (
                <button
                  key={l.route}
                  className="world-btn"
                  onClick={() => {
                    setDialogNpc(null)
                    openOverlay({ route: l.route, title: l.title })
                  }}
                >
                  {l.title}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
