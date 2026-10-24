/**
 * 粒子与氛围：传送门光点、篝火爆裂火星、法师区漂浮数学符号。
 * 全部在世界空间（源像素）绘制。
 */
import type { WorldData } from '../data/world'
import { TILE } from './ground'

interface Spark {
  /** 相对锚点的偏移相位 */
  seed: number
}

interface Emitter {
  x: number // 源像素
  y: number
  color: string
  kind: 'portal' | 'ember'
  sparks: Spark[]
}

const SYMBOLS = ['π', '∑', '∫', '√', '∞', 'Δ', 'θ', 'λ']

export class Particles {
  private emitters: Emitter[] = []
  /** 符号漂浮锚点（炼金台上方） */
  private symbolAnchor: { x: number; y: number } | null = null

  constructor(world: WorldData) {
    for (const p of world.portals) {
      this.emitters.push({
        x: (p.tx + 0.5) * TILE,
        y: (p.ty + 0.5) * TILE,
        color: p.color,
        kind: 'portal',
        sparks: Array.from({ length: 10 }, (_, i) => ({ seed: i / 10 })),
      })
    }
    for (const o of world.objects) {
      if (o.img === 'bonfire') {
        this.emitters.push({
          x: o.bx * TILE,
          y: o.by * TILE - 30, // 火苗中部（合成图 48 高，火焰在上半）
          color: '#fdba74',
          kind: 'ember',
          sparks: Array.from({ length: 8 }, (_, i) => ({ seed: i / 8 })),
        })
      }
      if (o.img === 'alchemy') {
        this.symbolAnchor = { x: o.bx * TILE, y: (o.by - 4.6) * TILE }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, t: number) {
    for (const e of this.emitters) {
      if (e.kind === 'portal') this.drawPortal(ctx, e, camX, camY, t)
      else this.drawEmber(ctx, e, camX, camY, t)
    }
  }

  private drawPortal(ctx: CanvasRenderingContext2D, e: Emitter, camX: number, camY: number, t: number) {
    for (const s of e.sparks) {
      const life = (t * 0.55 + s.seed) % 1
      const ang = s.seed * Math.PI * 2 + t * 0.7
      const r = 6 + life * 9
      const x = e.x + Math.cos(ang) * r - camX
      const y = e.y + Math.sin(ang) * r * 0.45 - life * 14 - camY
      ctx.globalAlpha = (1 - life) * 0.85
      ctx.fillStyle = e.color
      ctx.fillRect(x - 1, y - 1, 2, 2)
    }
    ctx.globalAlpha = 1
  }

  private drawEmber(ctx: CanvasRenderingContext2D, e: Emitter, camX: number, camY: number, t: number) {
    for (const s of e.sparks) {
      const life = (t * 0.8 + s.seed) % 1
      const wobble = Math.sin(t * 5 + s.seed * 40) * 3
      const x = e.x + wobble + (s.seed - 0.5) * 10 - camX
      const y = e.y - life * 26 - camY
      ctx.globalAlpha = (1 - life) * 0.8
      ctx.fillStyle = life < 0.4 ? '#fde68a' : e.color
      const sz = life < 0.5 ? 1.6 : 1
      ctx.fillRect(x, y, sz, sz)
    }
    ctx.globalAlpha = 1
  }

  /** 数学符号：屏幕空间绘制（文字走屏幕坐标更清晰） */
  drawSymbolsScreen(ctx: CanvasRenderingContext2D, camX: number, camY: number, t: number) {
    if (!this.symbolAnchor) return
    const ax = (this.symbolAnchor.x - camX) * 3
    const ay = (this.symbolAnchor.y - camY) * 3
    ctx.font = '600 22px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    SYMBOLS.forEach((sym, i) => {
      const ph = i / SYMBOLS.length
      const life = (t * 0.14 + ph) % 1
      const x = ax + Math.sin(t * 0.6 + i * 2.4) * 60 + (ph - 0.5) * 120
      const y = ay - life * 90
      ctx.globalAlpha = Math.sin(life * Math.PI) * 0.5
      ctx.fillStyle = '#c4b5fd'
      ctx.fillText(sym, x, y)
    })
    ctx.globalAlpha = 1
  }
}
