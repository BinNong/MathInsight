/**
 * 微积分秘境（波次试炼场）：整图背景（rooms/dungeon.png）+ 碰撞网格 + 守关人 NPC。
 * 房间 20×13 瓦片（320×208）；怪物不常驻刷点，由 engine/trial.ts 按波次投放。
 */
import type { WorldData } from './world'

const W = 20
const H = 13

function buildDungeon(): WorldData {
  const ground = new Uint8Array(W * H)
  const solid = new Uint8Array(W * H)
  const idx = (x: number, y: number) => y * W + x
  // 后墙三行
  for (let y = 0; y <= 2; y++) for (let x = 0; x < W; x++) solid[idx(x, y)] = 1
  // 左右符文栅栏（红左蓝右，见 build_dungeon.py 摆放）
  for (const [x, y] of [
    [0, 5], [1, 5], [2, 5], [0, 6], [1, 6], [2, 6], [0, 7], [1, 7], [2, 7],
    [17, 5], [18, 5], [19, 5], [17, 6], [18, 6], [19, 6], [17, 7], [18, 7], [19, 7],
  ] as const) {
    solid[idx(x, y)] = 1
  }
  // 守关人
  solid[idx(2, 10)] = 1

  return {
    kind: 'interior',
    width: W,
    height: H,
    ground,
    solid,
    objects: [],
    portals: [],
    npcs: [
      {
        id: 'mijing',
        name: '秘境守关人 · 罗格',
        sprite: 'rogue',
        tx: 2,
        ty: 10,
        interactDist: 2.8,
        trial: true,
        lines: [
          '站住。这座石牢是微积分秘境——混沌兽一波接着一波，没有尽头。',
          '规矩很简单：肃清一波，我考你一道题。答对，伤势尽愈、灵感充盈，还得「顿悟」；答错，只能捡回半条命。',
          '每五波有一位秘境守卫坐镇。撑得越久，手札上的闯关纪录越好看。准备好了就说「开始试炼」。',
        ],
      },
    ],
    doors: [{ tx: 9, ty: 12, target: 'outdoor', title: '返回小镇' }],
    mobSpawns: [],
    herbs: [],
    stations: [],
    spawn: { x: 9.5, y: 11 },
    bgImage: 'roomDungeon',
  }
}

let cached: WorldData | null = null

/** 秘境场景（只建一次） */
export function getDungeon(): WorldData {
  cached ??= buildDungeon()
  return cached
}
