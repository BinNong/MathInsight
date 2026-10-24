/**
 * 地面预渲染：草地填充 + 土路/农田 blob 边缘 + 池塘水面与岸线 + 烘焙小草点缀。
 * 输出一张与地图等大的离屏 canvas（源像素：宽 ×16，高 ×16）。
 */
import { G, type WorldData } from '../data/world'
import { VEG, type Assets, type Rect } from './assets'

export const TILE_SRC = 16
export const SCALE = 3
export const TILE = TILE_SRC * SCALE

// floors.png：环状 blob 布局（5 列 × 5 行，中心镂空），各材质的列偏移（瓦片）
// N 边 (1..3,0)，S 边 (1..3,4)，W 边 (0,1..3)，E 边 (4,1..3)
// 角 NW(0,1) NE(4,1) SW(0,3) SE(4,3)；实心填充在 rows 10-11
const BLOB = {
  [G.PATH]: { col: 5, row: 0 }, // 夯土（土黄）
  [G.SOIL]: { col: 10, row: 0 }, // 农田（橙褐）
} as const

// 草填充变体（floors.png 瓦片坐标）
const GRASS_FILLS: [number, number][] = [
  [1, 10], [2, 10], [3, 10],
  [1, 11], [2, 11], [3, 11],
]

// 各材质实心填充（rows 10-11，相对 blob 列偏移 1..3）
const BLOB_FILLS: [number, number][] = [
  [1, 10], [2, 10], [3, 10],
  [1, 11], [2, 11], [3, 11],
]

// water.png：水面填充变体（瓦片坐标，中蓝）
const WATER_FILLS: [number, number][] = [
  [1, 6], [2, 6], [1, 7], [2, 7], [3, 6], [3, 7],
]
// water.png：4 个「草岛」blob（含沙岸），列起点（瓦片），每岛 5×5
const ISLAND_COLS = [0, 6, 12, 18]

type Ctx = CanvasRenderingContext2D

function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

/** blob 掩码 → 环状瓦片相对坐标。位：N=1 E=2 S=4 W=8（同材质邻居） */
function blobTile(mask: number): [number, number] {
  const n = (mask & 1) !== 0
  const e = (mask & 2) !== 0
  const s = (mask & 4) !== 0
  const w = (mask & 8) !== 0
  // 四角（邻角缺失）
  if (!n && !w && e && s) return [0, 1] // 西北角
  if (!n && !e && w && s) return [4, 1] // 东北角
  if (!s && !w && e && n) return [0, 3] // 西南角
  if (!s && !e && w && n) return [4, 3] // 东南角
  // 单边
  if (!n && e && s && w) return [2, 0]
  if (!s && n && e && w) return [2, 4]
  if (!w && n && e && s) return [0, 2]
  if (!e && n && s && w) return [4, 2]
  // 端头 / 窄条等：按缺口方向退化为单边
  if (!n) return [2, 0]
  if (!s) return [2, 4]
  if (!w) return [0, 2]
  return [4, 2]
}

/** 水岸掩码 → 岛瓦片相对坐标（5×5 岛）。位：N=1 E=2 S=4 W=8（水邻居） */
function shoreTile(mask: number): [number, number] | null {
  const n = (mask & 1) !== 0 // 北边是水
  const e = (mask & 2) !== 0
  const s = (mask & 4) !== 0
  const w = (mask & 8) !== 0
  if (n && e && !s && !w) return [4, 0] // 水在东北 → 岛的东北角
  if (n && w && !s && !e) return [0, 0]
  if (s && e && !n && !w) return [4, 4]
  if (s && w && !n && !e) return [0, 4]
  if (n && !e && !s && !w) return [2, 0]
  if (s && !e && !n && !w) return [2, 4]
  if (w && !n && !s && !e) return [0, 2]
  if (e && !n && !s && !w) return [4, 2]
  if (n && !s && !w && !e) return [2, 0]
  // 多面环水等复杂情形：用最常见的边近似
  if (n) return [2, 0]
  if (s) return [2, 4]
  if (w) return [0, 2]
  if (e) return [4, 2]
  return null
}

/** 预渲染地面（室外：草地/道路/水面；室内：黑底 + 整图背景） */
export function prerenderGround(assets: Assets, world: WorldData): HTMLCanvasElement {
  const { width: W, height: H, ground } = world
  const cv = document.createElement('canvas')
  cv.width = W * TILE_SRC
  cv.height = H * TILE_SRC
  const ctx = cv.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  if (world.kind === 'interior') {
    ctx.fillStyle = '#06050c'
    ctx.fillRect(0, 0, cv.width, cv.height)
    if (world.bgImage) ctx.drawImage(assets[world.bgImage], 0, 0)
    return cv
  }

  const rng = makeRng(998877)
  const floors = assets.floors
  const water = assets.water

  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? G.GRASS : ground[y * W + x])
  const tile = (img: HTMLImageElement, tx: number, ty: number, dx: number, dy: number) =>
    ctx.drawImage(img, tx * TILE_SRC, ty * TILE_SRC, TILE_SRC, TILE_SRC, dx * TILE_SRC, dy * TILE_SRC, TILE_SRC, TILE_SRC)

  // 1) 草地基底（2×2 块级哈希取变体，避免逐瓦片棋盘感）
  const grassVar = (x: number, y: number): [number, number] => {
    let h = (Math.floor(x / 2) * 374761393 + Math.floor(y / 2) * 668265263) >>> 0
    h = ((h ^ (h >> 13)) * 1274126177) >>> 0
    return GRASS_FILLS[(h >>> 8) % GRASS_FILLS.length]
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = grassVar(x, y)
      tile(floors, v[0], v[1], x, y)
    }
  }

  // 2) 土路 / 农田（环状 blob 边缘 + 实心填充中心）
  for (const type of [G.PATH, G.SOIL] as const) {
    const blob = BLOB[type]
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (ground[y * W + x] !== type) continue
        let mask = 0
        if (at(x, y - 1) === type) mask |= 1
        if (at(x + 1, y) === type) mask |= 2
        if (at(x, y + 1) === type) mask |= 4
        if (at(x - 1, y) === type) mask |= 8
        if (mask === 15) {
          const v = BLOB_FILLS[Math.floor(rng() * BLOB_FILLS.length)]
          tile(floors, blob.col + v[0], v[1], x, y)
        } else {
          const [bx, by] = blobTile(mask)
          tile(floors, blob.col + bx, blob.row + by, x, y)
        }
      }
    }
  }

  // 3) 水面 + 岸线
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (ground[y * W + x] !== G.WATER) continue
      const v = WATER_FILLS[Math.floor(rng() * WATER_FILLS.length)]
      tile(water, v[0], v[1], x, y)
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (ground[y * W + x] === G.WATER) continue
      let mask = 0
      if (at(x, y - 1) === G.WATER) mask |= 1
      if (at(x + 1, y) === G.WATER) mask |= 2
      if (at(x, y + 1) === G.WATER) mask |= 4
      if (at(x - 1, y) === G.WATER) mask |= 8
      if (mask === 0) continue
      const st = shoreTile(mask)
      if (!st) continue
      const col = ISLAND_COLS[(x + y * 7) % ISLAND_COLS.length]
      tile(water, col + st[0], st[1], x, y)
    }
  }

  // 4) 烘焙小草 / 小花 / 蘑菇（不打乱对象层的确定性，用独立种子）
  const tufts: Rect[] = [VEG.tuft1, VEG.tuft2, VEG.tuft3, VEG.tuft4, VEG.sprout]
  const isClear = (x: number, y: number) => ground[y * W + x] === G.GRASS
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(rng() * W)
    const y = Math.floor(rng() * H)
    if (!isClear(x, y)) continue
    const t = tufts[Math.floor(rng() * tufts.length)]
    ctx.drawImage(
      assets.vegetation,
      t.x, t.y, t.w, t.h,
      x * TILE_SRC + Math.floor(rng() * (TILE_SRC - t.w)),
      (y + 1) * TILE_SRC - t.h,
      t.w, t.h
    )
  }
  return cv
}

/** 水面涟漪（随时间漂移的高光短线），在主循环中绘制 */
export function drawWaterRipples(
  ctx: Ctx,
  world: WorldData,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
  t: number
) {
  const { width: W, height: H, ground } = world
  const x0 = Math.max(0, Math.floor(camX / TILE) - 1)
  const y0 = Math.max(0, Math.floor(camY / TILE) - 1)
  const x1 = Math.min(W - 1, Math.ceil((camX + vw) / TILE) + 1)
  const y1 = Math.min(H - 1, Math.ceil((camY + vh) / TILE) + 1)
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (ground[y * W + x] !== G.WATER) continue
      const phase = (x * 0.7 + y * 1.3 + t * 0.9) % 3
      if (phase > 1) continue
      const sx = x * TILE - camX + ((t * 6 + x * 13) % TILE)
      const sy = y * TILE - camY + TILE * (0.35 + 0.3 * Math.sin(t * 1.2 + x + y))
      ctx.globalAlpha = 0.16 + 0.1 * Math.sin(t * 2 + x * 2 + y)
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(sx + TILE * 0.45, sy)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}
