/**
 * 修炼馆室内场景：整图背景（rooms/*.png）+ 碰撞网格 + 导师 NPC + 出口门垫。
 * 房间统一 16×11 瓦片；家具碰撞 footprint 与 tools/build_interiors.py 的摆放对应。
 */
import type { AssetKey } from '../engine/assets'
import { HALLS, type HallId } from './questions'
import type { DoorDef, NpcDef, WorldData } from './world'

const W = 16
const H = 11

interface InteriorSpec {
  npc: NpcDef
  /** 除后墙三行（y 0-2）以外的家具碰撞瓦片 */
  solids: [number, number][]
  /** 氛围 NPC（无碰撞、无交互，如巡逻侍女） */
  extras?: NpcDef[]
}

const SPECS: Record<HallId, InteriorSpec> = {
  // —— 极限酒馆：吧台(左) + 圆桌长凳(右) + 酒桶 ——
  limit: {
    npc: {
      id: 'luobida',
      name: HALLS.limit.mentorName,
      sprite: 'host',
      tx: 4,
      ty: 4,
      interactDist: 2.6,
      training: 'limit',
      lines: [
        '嘿，冒险者，来一杯「洛必达特调」吗？0/0 型的苦涩，一口求导就能化开。',
        '这间酒馆专修极限：两个重要极限打底，再论连续与间断。',
        '想活动脑子就说「开始修炼」——答得越稳，灵感越旺；答错也不怕，错题我都替你记进手札。',
      ],
    },
    solids: [
      // 吧台 x0-7 × y5-6
      [0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5],
      [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [7, 6],
      // 圆桌 x11-13 × y7-9 + 长凳 y10
      [11, 7], [12, 7], [13, 7], [11, 8], [12, 8], [13, 8], [11, 9], [12, 9], [13, 9],
      [11, 10], [12, 10], [13, 10],
      // 木箱 / 酒桶 / 提灯
      [0, 10], [1, 10], [14, 4], [15, 4], [15, 5], [15, 7],
    ],
    extras: [
      {
        id: 'barmaid',
        name: '酒馆侍女',
        sprite: 'barmaid',
        tx: 6,
        ty: 8,
        noInteract: true,
        patrol: { x0: 2.5, x1: 9.5, speed: 1.1, pauseSec: 1.8 },
        lines: [],
      },
    ],
  },
  // —— 导数讲堂：讲台 + 两排课桌长凳 ——
  derivative: {
    npc: {
      id: 'newton',
      name: HALLS.derivative.mentorName,
      sprite: 'scholar',
      tx: 10,
      ty: 5,
      interactDist: 2.6,
      training: 'derivative',
      lines: [
        '站住！你感受到变化率了吗？每一个瞬间，世界都在求导。',
        '讲堂里只练两件事：把导数算得又快又准，再用它看穿单调性与极值。',
        '准备好就上台答题。一组题连对四题以上，我把「顿悟」祝福借给你。',
      ],
    },
    solids: [
      // 讲台 x6-9 × y5
      [6, 5], [7, 5], [8, 5], [9, 5],
      // 课桌两排 y7 + 长凳 y8
      [2, 7], [3, 7], [4, 7], [5, 7], [6, 7],
      [9, 7], [10, 7], [11, 7], [12, 7], [13, 7],
      [2, 8], [3, 8], [4, 8], [5, 8],
      [10, 8], [11, 8], [12, 8], [13, 8],
      // 绿植
      [0, 9], [15, 9],
    ],
  },
  // —— 积分圣所：炼金长台 + 熔炉 + 水晶 ——
  integral: {
    npc: {
      id: 'laibunizi',
      name: HALLS.integral.mentorName,
      sprite: 'sage',
      tx: 8,
      ty: 4,
      interactDist: 2.8,
      training: 'integral',
      lines: [
        '欢迎来到积分圣所。∫ 这个符号，是我从拉丁文 summa 里拉长的一个 S。',
        '积分是累积的艺术：不定积分寻原函数，定积分量曲边梯形，级数把无穷项一一相加。',
        '开始修炼吧。答错的题会进入错题本，时常温习，方能精进。',
      ],
    },
    solids: [
      // 炼金长台 x6-9 × y6
      [6, 6], [7, 6], [8, 6], [9, 6],
      // 熔炉（左）
      [0, 7], [1, 7], [0, 8], [1, 8],
      // 水晶簇（右）/ 扫帚 / 提灯
      [13, 6], [14, 6], [15, 6], [14, 7], [15, 8], [3, 5],
    ],
  },
}

function buildInterior(hall: HallId): WorldData {
  const def = HALLS[hall]
  const spec = SPECS[hall]
  const ground = new Uint8Array(W * H)
  const solid = new Uint8Array(W * H)
  const idx = (x: number, y: number) => y * W + x
  // 后墙三行（含墙裙）
  for (let y = 0; y <= 2; y++) for (let x = 0; x < W; x++) solid[idx(x, y)] = 1
  for (const [x, y] of spec.solids) solid[idx(x, y)] = 1
  solid[idx(spec.npc.tx, spec.npc.ty)] = 1

  const doors: DoorDef[] = [{ tx: 7, ty: 10, target: 'outdoor', title: '返回小镇' }]

  return {
    kind: 'interior',
    width: W,
    height: H,
    ground,
    solid,
    objects: [],
    portals: [],
    npcs: [spec.npc, ...(spec.extras ?? [])],
    doors,
    mobSpawns: [],
    herbs: [],
    stations: [],
    spawn: { x: 7.5, y: 9.2 },
    bgImage: def.room as AssetKey,
  }
}

const cache = new Map<HallId, WorldData>()

/** 室内场景（每馆一份缓存） */
export function getInterior(hall: HallId): WorldData {
  let w = cache.get(hall)
  if (!w) {
    w = buildInterior(hall)
    cache.set(hall, w)
  }
  return w
}
