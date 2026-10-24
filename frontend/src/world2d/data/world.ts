/**
 * 2D 数学小镇地图数据（Anokolisa 像素包版）。
 * 坐标单位：瓦片（源图 16×16，渲染 ×3）。对象以「底部中心」锚点放置。
 */
import type { AssetKey, Rect } from '../engine/assets'
import { TREES1, TREES2, TREES3, VEG, ROCKS, FARM, BPROPS, FURN, ANVIL } from '../engine/assets'

// ---- 地面类型 ----
export const G = {
  GRASS: 0,
  PATH: 1, // 夯土路/广场（floors 第二组土黄色 blob）
  SOIL: 2, // 农田土壤（floors 第三组橙褐色 blob）
  WATER: 3,
} as const

// ---- 世界对象 ----
export interface AnimDef {
  w: number
  h: number
  count: number
  fps: number
  axis: 'x' | 'y'
}

export interface WorldObject {
  img: AssetKey
  rect?: Rect
  frames?: AnimDef
  /** 底部中心（瓦片坐标，可小数） */
  bx: number
  by: number
  /** 碰撞瓦片（绝对坐标），在 build 时并入 solid 网格 */
  solid?: [number, number][]
  flip?: boolean
  /** y 排序偏移（瓦片）：炊烟等需要压在屋顶上方的对象用 */
  sortBias?: number
}

export interface PortalDef {
  tx: number
  ty: number
  route: string
  title: string
  color: string
}

export interface NpcDef {
  id: string
  name: string
  sprite: 'wizard' | 'knight' | 'peasant' | 'keeper' | 'host' | 'scholar' | 'sage' | 'rogue' | 'barmaid'
  tx: number
  ty: number
  interactDist?: number
  lines: string[]
  links?: { route: string; title: string }[]
  /** 修炼馆导师：对话末尾出现「开始修炼」按钮 */
  training?: 'limit' | 'derivative' | 'integral'
  /** 秘境守关人：对话末尾出现「开始试炼」按钮 */
  trial?: boolean
  /** 纯氛围 NPC：不弹对话、不参与交互与碰撞（如巡逻侍女） */
  noInteract?: boolean
  /** 在 x0↔x1 之间往返巡逻（ty 不变，侧向行走） */
  patrol?: { x0: number; x1: number; speed?: number; pauseSec?: number }
}

/** 混沌兽种类（数值与帧表见 combat.ts 的 MOB_SPECS） */
export type MobKind =
  | 'orc'
  | 'skeleton'
  | 'mage'
  | 'orcWarrior'
  | 'orcRogue'
  | 'orcShaman'
  | 'skelWarrior'
  | 'skelRogue'

/** 混沌兽刷怪点 */
export interface MobSpawnDef {
  kind: MobKind
  tx: number
  ty: number
}

/** 灵草采集点（发光药草，E 采集，90 秒后重生） */
export interface HerbDef {
  tx: number
  ty: number
}

/** 功能站点（炼金台：3 灵草炼 1 灵感药剂） */
export interface StationDef {
  kind: 'alchemy'
  tx: number
  ty: number
}

/** 门：室外建筑入口 / 室内出口门垫，E 交互切换场景 */
export interface DoorDef {
  tx: number
  ty: number
  /** 'outdoor' = 返回小镇 */
  target: 'outdoor' | 'limit' | 'derivative' | 'integral' | 'dungeon'
  title: string
}

export interface WorldData {
  kind: 'outdoor' | 'interior'
  width: number
  height: number
  ground: Uint8Array
  solid: Uint8Array
  objects: WorldObject[]
  portals: PortalDef[]
  npcs: NpcDef[]
  doors: DoorDef[]
  mobSpawns: MobSpawnDef[]
  /** 灵草采集点（仅室外） */
  herbs: HerbDef[]
  /** 功能站点（仅室外炼金台） */
  stations: StationDef[]
  spawn: { x: number; y: number }
  /** 室内整图背景（256×176 PNG） */
  bgImage?: AssetKey
}

/** 简单 LCG 种子随机（确定性布局） */
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

export const MAP_W = 64
export const MAP_H = 44

export function buildWorld(): WorldData {
  const rng = makeRng(20260721)
  const ground = new Uint8Array(MAP_W * MAP_H)
  const solid = new Uint8Array(MAP_W * MAP_H)
  const objects: WorldObject[] = []
  const idx = (x: number, y: number) => y * MAP_W + x
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H
  const groundAt = (x: number, y: number) => (inMap(x, y) ? ground[idx(x, y)] : G.WATER)

  const fillRect = (x0: number, y0: number, w: number, h: number, v: number) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inMap(x, y)) ground[idx(x, y)] = v
  }
  const pathH = (x0: number, x1: number, y: number) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      ground[idx(x, y)] = G.PATH
      if (inMap(x, y + 1)) ground[idx(x, y + 1)] = G.PATH
    }
  }
  const pathV = (y0: number, y1: number, x: number) => {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
      ground[idx(x, y)] = G.PATH
      if (inMap(x + 1, y)) ground[idx(x + 1, y)] = G.PATH
    }
  }

  // ================================================================
  // 1) 地面
  // ================================================================
  // 中央广场（夯土）
  fillRect(25, 20, 14, 10, G.PATH)
  // 道路（2 格宽）
  pathH(8, 24, 23) // 广场 → 酒馆
  pathH(38, 44, 23) // 广场 → 农舍
  pathV(12, 19, 36) // 广场 → 北（骑士岗哨）
  pathV(4, 12, 36) // 北路 → 微积分秘境石门
  pathH(37, 55, 11) // 北路东段
  pathV(30, 32, 31) // 广场 → 南
  pathH(13, 31, 32) // 南路西段（通往池塘）
  pathV(25, 40, 50) // 农舍 → 法师区
  pathH(50, 53, 34) // 拐向法师小屋门
  // 农田（两块，农舍南侧）
  fillRect(42, 26, 7, 5, G.SOIL)
  fillRect(42, 33, 6, 4, G.SOIL)
  // 池塘（西南，不规则椭圆）
  for (let y = 33; y < 43; y++) {
    for (let x = 4; x < 19; x++) {
      const dx = (x - 11) / 5.6
      const dy = (y - 38) / 3.4
      if (dx * dx + dy * dy < 1 + (rng() - 0.5) * 0.3) ground[idx(x, y)] = G.WATER
    }
  }

  // ================================================================
  // 2) 建筑（离线拼贴 PNG）
  // ================================================================
  // 酒馆（西侧）：基座 7×5
  objects.push({
    img: 'buildTavern',
    bx: 8.5,
    by: 23,
    solid: [
      [5, 18], [6, 18], [7, 18], [8, 18], [9, 18], [10, 18], [11, 18],
      [5, 19], [6, 19], [7, 19], [8, 19], [9, 19], [10, 19], [11, 19],
      [5, 20], [6, 20], [7, 20], [8, 20], [9, 20], [10, 20], [11, 20],
      [5, 21], [6, 21], [7, 21], [8, 21], [9, 21], [10, 21], [11, 21],
      [5, 22], [6, 22], [7, 22], [8, 22], [9, 22], [10, 22], [11, 22],
    ],
  })
  // 农舍（东侧）
  objects.push({
    img: 'buildCottage',
    bx: 45.5,
    by: 23,
    solid: [
      [42, 18], [43, 18], [44, 18], [45, 18], [46, 18], [47, 18], [48, 18],
      [42, 19], [43, 19], [44, 19], [45, 19], [46, 19], [47, 19], [48, 19],
      [42, 20], [43, 20], [44, 20], [45, 20], [46, 20], [47, 20], [48, 20],
      [42, 21], [43, 21], [44, 21], [45, 21], [46, 21], [47, 21], [48, 21],
      [42, 22], [43, 22], [44, 22], [45, 22], [46, 22], [47, 22], [48, 22],
    ],
  })
  // 法师小屋（东南）
  objects.push({
    img: 'buildWizard',
    bx: 54.5,
    by: 35,
    solid: [
      [51, 30], [52, 30], [53, 30], [54, 30], [55, 30], [56, 30], [57, 30],
      [51, 31], [52, 31], [53, 31], [54, 31], [55, 31], [56, 31], [57, 31],
      [51, 32], [52, 32], [53, 32], [54, 32], [55, 32], [56, 32], [57, 32],
      [51, 33], [52, 33], [53, 33], [54, 33], [55, 33], [56, 33], [57, 33],
      [51, 34], [52, 34], [53, 34], [54, 34], [55, 34], [56, 34], [57, 34],
    ],
  })
  // 微积分秘境石门（北走廊尽头）：112×96 ≈ 7×6 瓦片，门洞留 2 格可走近
  objects.push({
    img: 'gateDungeon',
    bx: 36.5,
    by: 7,
    solid: [
      [33, 4], [34, 4], [35, 4], [36, 4], [37, 4], [38, 4], [39, 4],
      [33, 5], [34, 5], [35, 5], [36, 5], [37, 5], [38, 5], [39, 5],
      [33, 6], [34, 6], [37, 6], [38, 6], [39, 6],
    ],
  })

  // ================================================================
  // 3) 区域陈设
  // ================================================================
  const add = (o: WorldObject) => objects.push(o)

  // —— 广场：篝火 + 长椅 + 花 ——
  add({ img: 'bonfire', frames: { w: 32, h: 48, count: 8, fps: 8, axis: 'x' }, bx: 32, by: 26, solid: [[31, 25], [32, 25]] })
  add({ img: 'bprops', rect: BPROPS.benchLong, bx: 28.5, by: 28, solid: [[27, 27], [28, 27], [29, 27]] })
  add({ img: 'bprops', rect: BPROPS.benchLong, bx: 36.5, by: 28, solid: [[35, 27], [36, 27], [37, 27]] })
  add({ img: 'furniture', rect: FURN.signpost, bx: 27, by: 21.9, solid: [[26, 21]] })
  add({ img: 'furniture', rect: FURN.signpost, bx: 38, by: 21.9, solid: [[38, 21]], flip: true })
  for (const [fx, fy] of [[25.4, 20.4], [38.6, 20.4], [25.4, 29.6], [38.6, 29.6]] as const) {
    add({ img: 'vegetation', rect: VEG.flowerPurple, bx: fx, by: fy })
    add({ img: 'vegetation', rect: VEG.flowerPurple2, bx: fx + 0.7, by: fy + 0.1 })
  }

  // —— 酒馆院子 ——
  add({ img: 'furniture', rect: FURN.table, bx: 7, by: 26.5, solid: [[6, 26], [7, 26]] })
  add({ img: 'bprops', rect: BPROPS.benchSm, bx: 7, by: 25.6 })
  add({ img: 'furniture', rect: FURN.barrel, bx: 12.4, by: 22.7, solid: [[12, 22]] })
  add({ img: 'furniture', rect: FURN.barrelBig, bx: 13.1, by: 22.7, solid: [[13, 22]] })
  add({ img: 'furniture', rect: FURN.barrel, bx: 12.7, by: 21.9 })
  add({ img: 'bprops', rect: BPROPS.crate, bx: 3.8, by: 22.8, solid: [[3, 22], [4, 22]] })
  add({ img: 'furniture', rect: FURN.pot, bx: 4.5, by: 25.7, solid: [[4, 25]] })
  // 酒馆烟囱炊烟（sortBias 让它画在屋顶之上）
  add({ img: 'smoke', frames: { w: 32, h: 48, count: 4, fps: 3, axis: 'x' }, bx: 10.15, by: 12.9, sortBias: 12 })

  // —— 骑士岗哨（东北）：铁砧 + 篝火 + 岩石 ——
  add({ img: 'anvil', rect: ANVIL, bx: 54, by: 9, solid: [[53, 8], [54, 8]] })
  add({ img: 'bonfire', frames: { w: 32, h: 48, count: 8, fps: 8, axis: 'x' }, bx: 50.5, by: 10, solid: [[50, 9]] })
  add({ img: 'rocks', rect: ROCKS.boulderGray, bx: 58, by: 8, solid: [[57, 7], [58, 7]] })
  add({ img: 'rocks', rect: ROCKS.rockMed2, bx: 60, by: 9.5, solid: [[59, 9]] })
  add({ img: 'rocks', rect: ROCKS.boulderBrown, bx: 47, by: 6.5, solid: [[46, 6], [47, 6]] })
  add({ img: 'rocks', rect: ROCKS.rockSm2, bx: 48.5, by: 12.6 })

  // —— 农田：作物行 + 稻草人 + 干草 ——
  const cropKeys = ['crop1b', 'crop1c', 'crop2b', 'crop2c', 'crop4a', 'crop4c', 'crop5b', 'crop5c', 'crop6b', 'crop6c', 'crop7b', 'crop7c']
  for (let y = 26; y <= 30; y++) {
    for (let x = 42; x <= 48; x++) {
      if (rng() < 0.6) add({ img: 'farm', rect: FARM[cropKeys[Math.floor(rng() * cropKeys.length)]], bx: x + 0.25 + rng() * 0.5, by: y + 0.55 + rng() * 0.35 })
    }
  }
  for (let y = 33; y <= 36; y++) {
    for (let x = 42; x <= 47; x++) {
      if (rng() < 0.55) add({ img: 'farm', rect: FARM[cropKeys[Math.floor(rng() * cropKeys.length)]], bx: x + 0.25 + rng() * 0.5, by: y + 0.55 + rng() * 0.35 })
    }
  }
  add({ img: 'farm', rect: FARM.scarecrow, bx: 48.6, by: 28.5, solid: [[48, 28]] })
  add({ img: 'bprops', rect: BPROPS.crate, bx: 42.3, by: 24.8, solid: [[42, 24]] })
  add({ img: 'furniture', rect: FURN.barrel, bx: 43.2, by: 24.7 })

  // —— 法师区：炼金长台（柜台）+ 水晶 + 红松 ——
  add({ img: 'alchemy', frames: { w: 192, h: 64, count: 11, fps: 7, axis: 'y' }, bx: 54.5, by: 38, solid: [
    [49, 37], [50, 37], [51, 37], [52, 37], [53, 37], [54, 37], [55, 37], [56, 37], [57, 37], [58, 37], [59, 37],
  ] })
  add({ img: 'rocks', rect: ROCKS.crystalBig, bx: 49, by: 40.6, solid: [[48, 40]] })
  add({ img: 'rocks', rect: ROCKS.crystalMed, bx: 50.2, by: 41.2 })
  add({ img: 'rocks', rect: ROCKS.crystalMed2, bx: 59.5, by: 40.4 })
  add({ img: 'rocks', rect: ROCKS.crystalSm, bx: 48.2, by: 39.6 })
  add({ img: 'vegetation', rect: VEG.flowerPurple, bx: 52, by: 41.3 })
  add({ img: 'vegetation', rect: VEG.flowerPurple2, bx: 57.5, by: 41.2 })

  // —— 池塘：睡莲 + 芦苇（烘焙到地面即可，这里用对象好管理）——
  for (let i = 0; i < 14; i++) {
    const x = 6 + rng() * 10
    const y = 35 + rng() * 6
    if (groundAt(Math.floor(x), Math.floor(y)) === G.WATER) {
      add({ img: 'vegetation', rect: [VEG.lily1, VEG.lily2, VEG.lily3][Math.floor(rng() * 3)], bx: x, by: y })
    }
  }
  for (let i = 0; i < 10; i++) {
    const x = 5 + rng() * 12
    const y = 34 + rng() * 8
    const fx = Math.floor(x)
    const fy = Math.floor(y)
    if (groundAt(fx, fy) !== G.WATER) {
      let nearWater = false
      for (let dy = -1; dy <= 1 && !nearWater; dy++)
        for (let dx = -1; dx <= 1; dx++) if (groundAt(fx + dx, fy + dy) === G.WATER) nearWater = true
      if (nearWater) add({ img: 'vegetation', rect: [VEG.reed1, VEG.reed2, VEG.reed3][Math.floor(rng() * 3)], bx: x, by: y })
    }
  }

  // ================================================================
  // 4) 植被散布（种子随机）
  // ================================================================
  const clearAt = (x: number, y: number, r = 0) => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const gx = Math.floor(x) + dx
        const gy = Math.floor(y) + dy
        if (!inMap(gx, gy) || ground[idx(gx, gy)] !== G.GRASS || solid[idx(gx, gy)]) return false
      }
    return true
  }
  const claimed = new Set<string>()
  const claim = (x: number, y: number) => claimed.add(`${Math.floor(x)},${Math.floor(y)}`)
  const isClaimed = (x: number, y: number) => claimed.has(`${Math.floor(x)},${Math.floor(y)}`)

  const addTree = (img: AssetKey, rect: Rect, bx: number, by: number) => {
    add({ img, rect, bx, by, solid: [[Math.floor(bx), Math.floor(by)]] })
    // 树冠宽大：周围 5×5 都标记占用，保证树的间距
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) claim(bx + dx, by + dy)
  }

  // 地标红松（池塘东侧、南路旁），先占位再散布
  addTree('trees3', TREES3.red, 23.5, 41)

  // 预留空地（路口/NPC/传送门/陈设周围）
  const reserved = (x: number, y: number) => {
    if (x >= 24 && x <= 40 && y >= 18 && y <= 31) return true // 广场
    if (x >= 3 && x <= 15 && y >= 10 && y <= 29) return true // 酒馆+院子
    if (x >= 41 && x <= 62 && y >= 16 && y <= 42) return true // 农舍+农田+法师区
    if (x >= 45 && x <= 61 && y >= 4 && y <= 14) return true // 骑士岗哨
    if (x >= 32 && x <= 41 && y >= 1 && y <= 13) return true // 秘境石门 + 北走廊
    if (x >= 4 && x <= 18 && y >= 33 && y <= 42) return true // 池塘
    if (y >= 22 && y <= 25 && x >= 6 && x <= 46) return true // 东西主路
    if (x >= 35 && x <= 56 && y >= 10 && y <= 13) return true // 北路
    if (x >= 30 && x <= 33 && y >= 29 && y <= 34) return true // 南路
    if (y >= 31 && y <= 34 && x >= 12 && x <= 33) return true // 池塘路
    if (x >= 49 && x <= 55 && y >= 24 && y <= 41) return true // 法师区路
    return false
  }

  const scatterTrees = (
    x0: number, y0: number, x1: number, y1: number,
    density: number,
    pick: (r: number) => { img: AssetKey; rect: Rect }
  ) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (rng() >= density || reserved(x, y) || isClaimed(x, y) || !clearAt(x, y, 1)) continue
        const t = pick(rng())
        addTree(t.img, t.rect, x + 0.3 + rng() * 0.4, y + 0.4 + rng() * 0.4)
      }
    }
  }

  const pickPine = (r: number) =>
    r < 0.36 ? { img: 'trees2' as const, rect: TREES2.teal }
    : r < 0.66 ? { img: 'trees2' as const, rect: TREES2.green }
    : r < 0.86 ? { img: 'trees2' as const, rect: TREES2.green2 }
    : { img: 'trees2' as const, rect: TREES2.teal2 }
  const pickBroad = (r: number) =>
    r < 0.4 ? { img: 'trees1' as const, rect: TREES1.green }
    : r < 0.66 ? { img: 'trees1' as const, rect: TREES1.lime }
    : r < 0.84 ? { img: 'trees1' as const, rect: TREES1.orange }
    : { img: 'trees1' as const, rect: TREES1.olive }
  const pickMixed = (r: number) => (r < 0.45 ? pickPine(r / 0.45) : pickBroad((r - 0.45) / 0.55))

  // 边缘密林环带（2 格）
  scatterTrees(0, 0, MAP_W - 1, 2, 0.5, pickMixed)
  scatterTrees(0, MAP_H - 3, MAP_W - 1, MAP_H - 1, 0.5, pickMixed)
  scatterTrees(0, 0, 2, MAP_H - 1, 0.5, pickMixed)
  scatterTrees(MAP_W - 3, 0, MAP_W - 1, MAP_H - 1, 0.5, pickMixed)
  // 西北松林
  scatterTrees(3, 3, 21, 16, 0.13, pickPine)
  // 北侧山坡混交林
  scatterTrees(22, 3, 41, 9, 0.11, pickMixed)
  // 南侧阔叶林
  scatterTrees(17, 33, 40, 42, 0.12, pickBroad)
  // 全图零星
  for (let i = 0; i < 16; i++) {
    const x = 3 + rng() * (MAP_W - 6)
    const y = 3 + rng() * (MAP_H - 6)
    if (reserved(Math.floor(x), Math.floor(y)) || isClaimed(x, y) || !clearAt(x, y, 1)) continue
    const t = pickMixed(rng())
    addTree(t.img, t.rect, x, y)
  }

  // 林下灌木 / 岩石 / 蘑菇（不预留太多，点缀即可）
  const scatterDecor = (count: number, pick: (r: number) => { img: AssetKey; rect: Rect; solid?: boolean }) => {
    for (let i = 0; i < count; i++) {
      const x = 3 + rng() * (MAP_W - 6)
      const y = 3 + rng() * (MAP_H - 6)
      if (reserved(Math.floor(x), Math.floor(y)) || isClaimed(x, y) || !clearAt(x, y)) continue
      const d = pick(rng())
      add({
        img: d.img,
        rect: d.rect,
        bx: x,
        by: y,
        solid: d.solid ? [[Math.floor(x), Math.floor(y)]] : undefined,
      })
      claim(x, y)
    }
  }
  scatterDecor(34, (r) =>
    r < 0.3 ? { img: 'vegetation', rect: VEG.bushRoundG, solid: true }
    : r < 0.5 ? { img: 'vegetation', rect: VEG.bushRoundL, solid: true }
    : r < 0.62 ? { img: 'vegetation', rect: VEG.bushRoundO, solid: true }
    : r < 0.78 ? { img: 'vegetation', rect: [VEG.mushroom1, VEG.mushroom2, VEG.mushroom3, VEG.mushroom4][Math.floor(rng() * 4)] }
    : r < 0.9 ? { img: 'rocks', rect: [ROCKS.rockSm1, ROCKS.rockSm3, ROCKS.rockSm4][Math.floor(rng() * 3)] }
    : { img: 'vegetation', rect: VEG.fern }
  )
  // 紫色花丛点缀村庄周围
  scatterDecor(16, () => ({ img: 'vegetation', rect: rng() < 0.5 ? VEG.flowerPurple : VEG.flowerPurple2 }))

  // ================================================================
  // 5) 传送门
  // ================================================================
  const portals: PortalDef[] = [
    { tx: 15, ty: 26, route: '/matrix', title: '矩阵变换实验室', color: '#a78bfa' },
    { tx: 49, ty: 8, route: '/limit', title: 'ε-δ 极限实验室', color: '#67e8f9' },
    { tx: 58, ty: 11, route: '/derivative', title: '导数与切线实验室', color: '#34d399' },
    { tx: 43, ty: 39, route: '/probability', title: '大数定律实验室', color: '#fcd34d' },
    { tx: 47, ty: 39, route: '/clt', title: '中心极限定理实验室', color: '#fb923c' },
    { tx: 51, ty: 40, route: '/knowledge-map', title: '知识星图', color: '#f0abfc' },
    { tx: 59, ty: 41, route: '/multivariate', title: '多元函数实验室', color: '#22d3ee' },
  ]
  // 每个传送门一圈小水晶
  for (const p of portals) {
    add({ img: 'rocks', rect: ROCKS.crystalSm, bx: p.tx - 0.55, by: p.ty + 0.75 })
    add({ img: 'rocks', rect: ROCKS.crystalMed, bx: p.tx + 1.35, by: p.ty + 0.7 })
  }

  // ================================================================
  // 5.5) 修炼馆大门（建筑正门前，E 进入室内）
  // ================================================================
  const doors: DoorDef[] = [
    { tx: 8, ty: 23, target: 'limit', title: '极限酒馆' },
    { tx: 45, ty: 23, target: 'derivative', title: '导数讲堂' },
    { tx: 54, ty: 35, target: 'integral', title: '积分圣所' },
    { tx: 36, ty: 7, target: 'dungeon', title: '微积分秘境' },
  ]

  // ================================================================
  // 6) NPC
  // ================================================================
  const npcs: NpcDef[] = [
    {
      id: 'shuling',
      name: '数灵 · 数学导师',
      sprite: 'wizard',
      tx: 48,
      ty: 38,
      interactDist: 2.4,
      lines: [
        '欢迎来到数学小镇！我是「数灵」，这里的向导，守着我的炼金长台。',
        '小镇西边的酒馆住着矩阵术士，东边的农庄是蒲丰的田地，东北山岗上骑士柯西正在打磨他的 ε-δ 盾牌。',
        '地上发光的符文圈都是传送门，走过去按 E，就能进入对应的交互实验室。',
        '森林里有一种发光的灵草，采三株来我的炼金台（按 E），我帮你炼一瓶灵感药剂——战斗间隙按 Q 饮下能恢复生命。',
        '北边石路尽头是「微积分秘境」，里面的波次试炼最是磨人，闯关纪录会记进你的手札。先去拜访其他导师吧！',
      ],
      links: [
        { route: '/solver', title: 'AI 解题导师' },
        { route: '/knowledge-map', title: '知识星图' },
      ],
    },
    {
      id: 'jifen',
      name: '微积分导师 · 柯西',
      sprite: 'knight',
      tx: 52,
      ty: 10,
      lines: [
        '嗯？年轻人，爬上这座山岗，你也对极限感兴趣？',
        'ε-δ 语言听起来吓人，其实只是一场「你挑战、我应对」的决斗：无论你把 ε 圈画得多小，我总能找到一个 δ 守住阵地。',
        '我身旁的两个符文圈分别通往极限与导数实验室，去亲手过两招吧。',
      ],
      links: [
        { route: '/limit', title: 'ε-δ 极限实验室' },
        { route: '/derivative', title: '导数与切线实验室' },
      ],
    },
    {
      id: 'juzhen',
      name: '矩阵术士 · 西尔维斯特',
      sprite: 'keeper',
      tx: 10,
      ty: 25,
      lines: [
        '欢迎光临矩阵酒馆！来点喝的，还是来点线性代数？',
        '矩阵不是表格，是动作——拉伸、旋转、剪切。行列式为零时，整个空间会被压扁成一张纸。',
        '院子里的符文圈通往矩阵实验室，喝完这杯就去热热身吧，别被奇异矩阵吞了。',
      ],
      links: [{ route: '/matrix', title: '矩阵变换实验室' }],
    },
    {
      id: 'gailv',
      name: '概率学者 · 蒲丰',
      sprite: 'peasant',
      tx: 49,
      ty: 28,
      lines: [
        '嘘——轻点，秧苗刚冒头，概率正在田里发芽。',
        '每一株苗长多高都是随机的，可成千上万株混在一起，就长出了确定的形状。这就是大数定律的魔法。',
        '田边的两个符文圈，一个看骰子堆成直方图，一个看均值怎样长成钟形曲线。',
      ],
      links: [
        { route: '/probability', title: '大数定律实验室' },
        { route: '/clt', title: '中心极限定理实验室' },
      ],
    },
  ]
  for (const n of npcs) solid[idx(n.tx, n.ty)] = 1

  // ================================================================
  // 7) 混沌兽刷怪点（森林深处，避开镇中心与道路）
  // ================================================================
  const mobSpawns: MobSpawnDef[] = [
    // 西北松林（靠酒馆北侧空地）
    { kind: 'orc', tx: 16, ty: 17 },
    { kind: 'skeleton', tx: 19, ty: 15 },
    { kind: 'orc', tx: 14, ty: 16 },
    // 北侧山坡混交林（沿北路）
    { kind: 'skeleton', tx: 26, ty: 10 },
    { kind: 'mage', tx: 32, ty: 9 },
    { kind: 'skeleton', tx: 39, ty: 9 },
    // 南侧阔叶林（沿池塘路）
    { kind: 'orc', tx: 20, ty: 35 },
    { kind: 'skeleton', tx: 25, ty: 36 },
    { kind: 'orc', tx: 33, ty: 35 },
    { kind: 'mage', tx: 37, ty: 36 },
    // —— 进阶混沌兽（更深的林带与地图边缘）——
    { kind: 'orcShaman', tx: 8, ty: 6 }, // 西北密林深处
    { kind: 'skelWarrior', tx: 13, ty: 5 },
    { kind: 'skelRogue', tx: 29, ty: 6 }, // 北坡
    { kind: 'orcWarrior', tx: 5, ty: 13 }, // 西侧林缘
    { kind: 'skelRogue', tx: 4, ty: 19 },
    { kind: 'orcWarrior', tx: 61, ty: 16 }, // 东侧林缘
  ]

  // ================================================================
  // 7.5) 灵草采集点（路旁林缘，发光药草）与炼金台
  // ================================================================
  const herbs: HerbDef[] = [
    { tx: 16, ty: 21 },
    { tx: 24, ty: 26 },
    { tx: 30, ty: 21 },
    { tx: 38, ty: 26 },
    { tx: 13, ty: 31 },
    { tx: 34, ty: 33 },
    { tx: 42, ty: 12 },
    { tx: 52, ty: 29 },
    { tx: 31, ty: 30 },
  ]
  const stations: StationDef[] = [{ kind: 'alchemy', tx: 54, ty: 38 }]

  // ================================================================
  // 8) 碰撞汇总
  // ================================================================
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (ground[idx(x, y)] === G.WATER) solid[idx(x, y)] = 1
    }
  }
  for (const o of objects) {
    if (!o.solid) continue
    for (const [sx, sy] of o.solid) if (inMap(sx, sy)) solid[idx(sx, sy)] = 1
  }

  return {
    kind: 'outdoor',
    width: MAP_W,
    height: MAP_H,
    ground,
    solid,
    objects,
    portals,
    npcs,
    doors,
    mobSpawns,
    herbs,
    stations,
    spawn: { x: 32, y: 28.6 },
  }
}

let cachedWorld: WorldData | null = null

/** 全局共享的世界数据（确定性生成，只建一次） */
export function getWorld(): WorldData {
  cachedWorld ??= buildWorld()
  return cachedWorld
}
