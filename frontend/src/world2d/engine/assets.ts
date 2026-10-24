/**
 * 素材清单与加载：Anokolisa 像素包（见 pixel/LICENSE-anokolisa.txt）。
 * 所有图片集中在 public/assets/world2d/pixel/ 下，启动时一次性加载。
 */

const BASE = `${import.meta.env.BASE_URL}assets/world2d/pixel`

/** 需要加载的图片：key -> 相对路径 */
const MANIFEST = {
  // 主角（64×64 帧）
  heroIdleDown: 'hero/idle-down.png',
  heroIdleSide: 'hero/idle-side.png',
  heroIdleUp: 'hero/idle-up.png',
  heroWalkDown: 'hero/walk-down.png',
  heroWalkSide: 'hero/walk-side.png',
  heroWalkUp: 'hero/walk-up.png',
  heroRunDown: 'hero/run-down.png',
  heroRunSide: 'hero/run-side.png',
  heroRunUp: 'hero/run-up.png',
  // 主角战斗动作（64×64 帧）
  heroSliceDown: 'hero/slice-down.png', // 512×64 → 8 帧
  heroSliceSide: 'hero/slice-side.png',
  heroSliceUp: 'hero/slice-up.png',
  heroHitDown: 'hero/hit-down.png', // 256×64 → 4 帧
  heroHitSide: 'hero/hit-side.png',
  heroHitUp: 'hero/hit-up.png',
  heroDeathDown: 'hero/death-down.png', // 512×64 → 8 帧
  heroDeathSide: 'hero/death-side.png',
  heroDeathUp: 'hero/death-up.png',
  // 混沌兽（怪物）
  mobOrcIdle: 'mobs/orc-idle.png', // 128×32 → 4 帧 32×32
  mobOrcRun: 'mobs/orc-run.png', // 384×64 → 6 帧 64×64
  mobOrcDeath: 'mobs/orc-death.png', // 576×80 → 6 帧 96×80
  mobSkelIdle: 'mobs/skeleton-idle.png', // 128×32 → 4 帧 32×32
  mobSkelRun: 'mobs/skeleton-run.png', // 384×64 → 6 帧 64×64
  mobSkelDeath: 'mobs/skeleton-death.png', // 768×64 → 8 帧 96×64
  mobMageIdle: 'mobs/mage-idle.png', // 128×32 → 4 帧 32×32
  mobMageRun: 'mobs/mage-run.png', // 384×64 → 6 帧 64×64
  mobMageDeath: 'mobs/mage-death.png', // 384×64 → 6 帧 64×64
  // 混沌兽·进阶（五种，帧布局同上）
  mobOwarIdle: 'mobs/orcwarrior-idle.png', // 128×32 → 4 帧
  mobOwarRun: 'mobs/orcwarrior-run.png', // 384×64 → 6 帧
  mobOwarDeath: 'mobs/orcwarrior-death.png', // 576×80 → 6 帧 96×80
  mobOrogueIdle: 'mobs/orcrogue-idle.png',
  mobOrogueRun: 'mobs/orcrogue-run.png',
  mobOrogueDeath: 'mobs/orcrogue-death.png', // 384×64 → 6 帧 64×64
  mobShamanIdle: 'mobs/shaman-idle.png',
  mobShamanRun: 'mobs/shaman-run.png',
  mobShamanDeath: 'mobs/shaman-death.png', // 448×64 → 7 帧 64×64
  mobSwarIdle: 'mobs/skelwarrior-idle.png',
  mobSwarRun: 'mobs/skelwarrior-run.png',
  mobSwarDeath: 'mobs/skelwarrior-death.png', // 384×48 → 6 帧 64×48
  mobSrogueIdle: 'mobs/skelrogue-idle.png',
  mobSrogueRun: 'mobs/skelrogue-run.png',
  mobSrogueDeath: 'mobs/skelrogue-death.png', // 384×64 → 6 帧 64×64
  // NPC
  npcWizard: 'npc/wizard-idle.png', // 128×32 → 4 帧 32×32
  npcKnight: 'npc/knight-idle.png', // 128×32 → 4 帧 32×32
  npcPeasant: 'npc/peasant-idle.png', // 256×64 → 4 帧 64×64
  npcKeeper: 'npc/keeper-idle.png', // 256×64 → 4 帧 64×64
  // 修炼馆导师（换色变体，见 tools/build_interiors.py）
  npcHost: 'npc/host-idle.png', // 洛必达 256×64 → 4 帧 64×64
  npcScholar: 'npc/scholar-idle.png', // 牛顿 256×64 → 4 帧 64×64
  npcSage: 'npc/sage-idle.png', // 莱布尼茨 128×32 → 4 帧 32×32
  npcRogue: 'npc/rogue-idle.png', // 秘境守关人 128×32 → 4 帧 32×32
  npcBarmaidIdle: 'npc/barmaid-idle.png', // 酒馆侍女（端盘）256×64 → 4 帧 64×64
  npcBarmaidWalk: 'npc/barmaid-walk.png', // 384×64 → 6 帧 64×64
  // 主角采集动作（512×64 → 8 帧）
  heroCollectDown: 'hero/collect-down.png',
  heroCollectSide: 'hero/collect-side.png',
  heroCollectUp: 'hero/collect-up.png',
  // 微积分秘境（离线拼贴，见 tools/build_dungeon.py）
  roomDungeon: 'rooms/dungeon.png', // 320×208（20×13 瓦片）
  gateDungeon: 'buildings/dungeon-gate.png', // 112×96 室外石门
  // 修炼馆室内（离线拼贴整图，256×176）
  roomLimit: 'rooms/limit.png',
  roomDerivative: 'rooms/derivative.png',
  roomIntegral: 'rooms/integral.png',
  // 地形
  floors: 'tiles/floors.png', // 400×416，16px 瓦片，25×26
  water: 'tiles/water.png', // 400×400
  // 道具图集
  trees1: 'props/trees1.png', // 448×368 阔叶树×8 + 树桩
  trees2: 'props/trees2.png', // 288×320 针叶树×5 + 树桩
  trees3: 'props/trees3.png', // 384×512 高松树×5 + 树桩
  vegetation: 'props/vegetation.png', // 400×432 灌木花草蘑菇
  rocks: 'props/rocks.png', // 208×304 岩石+水晶
  farm: 'props/farm.png', // 400×400 农作物+稻草人
  bprops: 'props/building-props.png', // 400×400 门窗长椅栅栏
  furniture: 'props/furniture.png', // 800×864 家具杂项
  // 建筑（离线拼贴成品）
  buildTavern: 'buildings/tavern.png', // 128×177
  buildWizard: 'buildings/wizard.png', // 128×166
  buildCottage: 'buildings/cottage.png', // 128×172
  // 工作站 / 动态装饰
  bonfire: 'stations/campfire_lit.png', // 256×48 → 8 帧 32×48 石圈篝火（火苗已离线合成对齐）
  smoke: 'stations/smoke.png', // 128×48 → 4 帧 32×48 炊烟
  alchemy: 'stations/alchemy.png', // 192×704 → 11 帧 192×64
  anvil: 'stations/anvil.png', // 272×160 铁砧组合图（取 ANVIL 矩形）
} as const

export type AssetKey = keyof typeof MANIFEST
export type Assets = Record<AssetKey, HTMLImageElement>

let cached: Promise<Assets> | null = null

/** 加载全部素材（只加载一次） */
export function loadAssets(): Promise<Assets> {
  if (cached) return cached
  const entries = Object.entries(MANIFEST) as [AssetKey, string][]
  cached = Promise.all(
    entries.map(
      ([key, path]) =>
        new Promise<[AssetKey, HTMLImageElement]>((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve([key, img])
          img.onerror = () => reject(new Error(`素材加载失败: ${path}`))
          img.src = `${BASE}/${path}`
        })
    )
  ).then((loaded) => Object.fromEntries(loaded) as Assets)
  return cached
}

// ------------------------------------------------------------------
// 图集 prop 矩形表（像素坐标，由连通域分析得出）
// ------------------------------------------------------------------

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** 从图集取一块区域画到 canvas（返回 canvas 便于复用/缓存） */
export function cut(img: HTMLImageElement, r: Rect): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = r.w
  c.height = r.h
  c.getContext('2d')!.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h)
  return c
}

/** trees1（Model_01 阔叶树，448×368）：8 树 + 4 树桩 */
export const TREES1: Record<string, Rect> = {
  green: { x: 0, y: 0, w: 109, h: 162 },
  lime: { x: 111, y: 0, w: 110, h: 162 },
  bare: { x: 223, y: 0, w: 104, h: 162 },
  snow: { x: 335, y: 0, w: 104, h: 162 },
  orange: { x: 0, y: 158, w: 109, h: 164 },
  olive: { x: 111, y: 158, w: 110, h: 164 },
  bare2: { x: 223, y: 160, w: 104, h: 162 },
  snow2: { x: 335, y: 160, w: 104, h: 162 },
  stump1: { x: 21, y: 324, w: 65, h: 44 },
  stump2: { x: 133, y: 324, w: 65, h: 44 },
}

/** trees2（Model_02 针叶树，288×320） */
export const TREES2: Record<string, Rect> = {
  teal: { x: 0, y: 1, w: 95, h: 161 },
  green: { x: 95, y: 1, w: 96, h: 161 },
  bare: { x: 195, y: 6, w: 91, h: 156 },
  teal2: { x: 0, y: 161, w: 95, h: 159 },
  green2: { x: 95, y: 161, w: 96, h: 159 },
  stump: { x: 227, y: 270, w: 23, h: 20 },
}

/** trees3（Model_03 高松 Size_04，400×416） */
export const TREES3: Record<string, Rect> = {
  green: { x: 0, y: 0, w: 98, h: 210 },
  olive: { x: 94, y: 0, w: 100, h: 210 },
  bare: { x: 200, y: 12, w: 69, h: 198 },
  brown: { x: 0, y: 206, w: 98, h: 210 },
  red: { x: 94, y: 206, w: 100, h: 210 },
}

/** vegetation（400×432）：灌木 / 花 / 蘑菇 / 水草 */
export const VEG: Record<string, Rect> = {
  bushGreen: { x: 1, y: 30, w: 46, h: 68 },
  bushLime: { x: 49, y: 30, w: 46, h: 68 },
  bushOlive: { x: 97, y: 30, w: 46, h: 68 },
  bushRust: { x: 145, y: 30, w: 46, h: 68 },
  bushRoundG: { x: 0, y: 97, w: 47, h: 47 },
  bushRoundL: { x: 48, y: 97, w: 47, h: 47 },
  bushRoundO: { x: 96, y: 97, w: 47, h: 47 },
  bushRoundR: { x: 144, y: 97, w: 47, h: 47 },
  branchBig: { x: 194, y: 96, w: 43, h: 50 },
  flowerPurple: { x: 193, y: 159, w: 15, h: 35 },
  flowerPurple2: { x: 143, y: 164, w: 19, h: 30 },
  flowerRed: { x: 210, y: 163, w: 13, h: 31 },
  fern: { x: 62, y: 142, w: 20, h: 20 },
  fern2: { x: 78, y: 145, w: 35, h: 29 },
  tuft1: { x: 4, y: 148, w: 9, h: 12 },
  tuft2: { x: 19, y: 148, w: 12, h: 10 },
  tuft3: { x: 34, y: 147, w: 14, h: 13 },
  tuft4: { x: 49, y: 148, w: 13, h: 10 },
  tuft5: { x: 62, y: 190, w: 20, h: 20 },
  tuft6: { x: 95, y: 175, w: 18, h: 19 },
  sprout: { x: 65, y: 162, w: 15, h: 12 },
  mushroom1: { x: 1, y: 351, w: 15, h: 18 },
  mushroom2: { x: 17, y: 351, w: 15, h: 18 },
  mushroom3: { x: 47, y: 336, w: 18, h: 18 },
  mushroom4: { x: 34, y: 338, w: 12, h: 13 },
  lily1: { x: 51, y: 371, w: 11, h: 10 },
  lily2: { x: 66, y: 358, w: 24, h: 10 },
  lily3: { x: 98, y: 371, w: 12, h: 11 },
  reed1: { x: 51, y: 387, w: 11, h: 10 },
  reed2: { x: 67, y: 387, w: 10, h: 10 },
  reed3: { x: 98, y: 387, w: 12, h: 11 },
}

/** rocks（208×304）：巨石 / 碎石 / 蓝水晶 */
export const ROCKS: Record<string, Rect> = {
  boulderBrown: { x: 0, y: 17, w: 32, h: 47 },
  boulderGray: { x: 96, y: 17, w: 32, h: 47 },
  boulderMoss: { x: 0, y: 113, w: 32, h: 47 },
  rockMed1: { x: 33, y: 17, w: 30, h: 31 },
  rockMed2: { x: 129, y: 17, w: 30, h: 31 },
  rockMed3: { x: 33, y: 113, w: 30, h: 31 },
  rockSm1: { x: 63, y: 17, w: 18, h: 15 },
  rockSm2: { x: 78, y: 15, w: 20, h: 18 },
  rockSm3: { x: 63, y: 98, w: 15, h: 13 },
  rockSm4: { x: 78, y: 111, w: 20, h: 18 },
  crystalBig: { x: 144, y: 277, w: 16, h: 27 },
  crystalMed: { x: 162, y: 287, w: 12, h: 17 },
  crystalMed2: { x: 177, y: 287, w: 14, h: 17 },
  crystalSm: { x: 195, y: 294, w: 10, h: 10 },
}

/** farm（400×400）：作物行（每行 4-7 个生长阶段）+ 稻草人 + 干草 */
export const FARM: Record<string, Rect> = {
  // 作物行（取每行最成熟的一两棵）
  crop1a: { x: 66, y: 18, w: 13, h: 16 },
  crop1b: { x: 80, y: 13, w: 14, h: 21 },
  crop1c: { x: 97, y: 15, w: 13, h: 19 },
  crop2a: { x: 65, y: 48, w: 15, h: 18 },
  crop2b: { x: 78, y: 44, w: 20, h: 22 },
  crop2c: { x: 94, y: 44, w: 20, h: 22 },
  crop3a: { x: 63, y: 85, w: 16, h: 13 },
  crop3b: { x: 78, y: 81, w: 36, h: 17 },
  crop4a: { x: 64, y: 114, w: 16, h: 16 },
  crop4b: { x: 78, y: 110, w: 36, h: 20 },
  crop4c: { x: 126, y: 110, w: 20, h: 20 },
  crop5a: { x: 64, y: 146, w: 17, h: 16 },
  crop5b: { x: 78, y: 143, w: 20, h: 19 },
  crop5c: { x: 94, y: 143, w: 20, h: 19 },
  crop6a: { x: 63, y: 181, w: 17, h: 13 },
  crop6b: { x: 78, y: 176, w: 20, h: 18 },
  crop6c: { x: 94, y: 176, w: 20, h: 18 },
  crop7a: { x: 67, y: 206, w: 11, h: 20 },
  crop7b: { x: 82, y: 199, w: 14, h: 27 },
  crop7c: { x: 97, y: 203, w: 17, h: 23 },
  scarecrow: { x: 195, y: 5, w: 36, h: 47 },
  haycart: { x: 271, y: 0, w: 129, h: 82 },
  haystack: { x: 286, y: 85, w: 49, h: 93 },
}

/** bprops（building-props.png 400×400）：长椅 / 栅栏 / 木箱 */
export const BPROPS: Record<string, Rect> = {
  benchLong: { x: 78, y: 158, w: 62, h: 36 },
  benchSm: { x: 15, y: 130, w: 34, h: 16 },
  crate: { x: 143, y: 126, w: 34, h: 36 },
  fenceA: { x: 4, y: 174, w: 18, h: 21 },
  fenceB: { x: 26, y: 174, w: 18, h: 21 },
  signArrow: { x: 28, y: 128, w: 18, h: 16 },
}

/** furniture（800×864）：桌子 / 标牌等 */
export const FURN: Record<string, Rect> = {
  table: { x: 81, y: 430, w: 62, h: 36 },
  tableLong: { x: 177, y: 420, w: 62, h: 27 },
  signpost: { x: 55, y: 510, w: 11, h: 26 },
  barrel: { x: 736, y: 47, w: 16, h: 19 },
  barrelBig: { x: 752, y: 46, w: 16, h: 20 },
  pot: { x: 767, y: 11, w: 18, h: 23 },
}

/** anvil.png（272×160）中可用的铁砧组合 */
export const ANVIL: Rect = { x: 4, y: 35, w: 57, h: 38 }
