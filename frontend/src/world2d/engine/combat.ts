/**
 * 数学咒术战斗系统：混沌兽 AI、数学技能、伤害飘字与符号特效。
 * 坐标约定与 loop 一致：瓦片为单位（1 瓦片 = TILE_SRC 源像素），mob.x/y 为脚底中心。
 */
import type { Assets, AssetKey } from './assets'
import { TILE_SRC } from './ground'
import type { WorldData, MobSpawnDef, MobKind } from '../data/world'
import { randomCalculusQuestion } from '../data/questions'

export type { MobKind }

interface SheetDef {
  img: AssetKey
  fw: number
  fh: number
  count: number
  fps: number
}

interface MobSpec {
  name: string
  hp: number
  speed: number // 瓦片/秒
  dmg: [number, number]
  score: number // 击杀掉落知识点
  attackRange: number
  aggroR: number
  idle: SheetDef
  run: SheetDef
  death: SheetDef
}

const MOB_SPECS: Record<MobKind, MobSpec> = {
  orc: {
    name: '兽人混沌兽',
    hp: 45,
    speed: 3.2,
    dmg: [7, 12],
    score: 2,
    attackRange: 0.95,
    aggroR: 5,
    idle: { img: 'mobOrcIdle', fw: 32, fh: 32, count: 4, fps: 4 },
    run: { img: 'mobOrcRun', fw: 64, fh: 64, count: 6, fps: 9 },
    death: { img: 'mobOrcDeath', fw: 96, fh: 80, count: 6, fps: 8 },
  },
  skeleton: {
    name: '骷髅游魂',
    hp: 30,
    speed: 4.4,
    dmg: [5, 9],
    score: 2,
    attackRange: 0.9,
    aggroR: 5.5,
    idle: { img: 'mobSkelIdle', fw: 32, fh: 32, count: 4, fps: 5 },
    run: { img: 'mobSkelRun', fw: 64, fh: 64, count: 6, fps: 10 },
    death: { img: 'mobSkelDeath', fw: 96, fh: 64, count: 8, fps: 9 },
  },
  mage: {
    name: '骷髅祭司',
    hp: 65,
    speed: 2.5,
    dmg: [10, 16],
    score: 4,
    attackRange: 1.15,
    aggroR: 6,
    idle: { img: 'mobMageIdle', fw: 32, fh: 32, count: 4, fps: 4 },
    run: { img: 'mobMageRun', fw: 64, fh: 64, count: 6, fps: 8 },
    death: { img: 'mobMageDeath', fw: 64, fh: 64, count: 6, fps: 7 },
  },
  // —— 进阶混沌兽 ——
  orcWarrior: {
    name: '兽人督军', // 坦克：高血低速重击
    hp: 95,
    speed: 2.6,
    dmg: [12, 18],
    score: 5,
    attackRange: 1.0,
    aggroR: 5,
    idle: { img: 'mobOwarIdle', fw: 32, fh: 32, count: 4, fps: 4 },
    run: { img: 'mobOwarRun', fw: 64, fh: 64, count: 6, fps: 8 },
    death: { img: 'mobOwarDeath', fw: 96, fh: 80, count: 6, fps: 8 },
  },
  orcRogue: {
    name: '兽人刺客', // 快速：低血高攻速
    hp: 32,
    speed: 5.2,
    dmg: [6, 10],
    score: 3,
    attackRange: 0.9,
    aggroR: 6,
    idle: { img: 'mobOrogueIdle', fw: 32, fh: 32, count: 4, fps: 5 },
    run: { img: 'mobOrogueRun', fw: 64, fh: 64, count: 6, fps: 11 },
    death: { img: 'mobOrogueDeath', fw: 64, fh: 64, count: 6, fps: 9 },
  },
  orcShaman: {
    name: '兽人萨满', // 重击：中血高伤
    hp: 55,
    speed: 2.9,
    dmg: [11, 17],
    score: 5,
    attackRange: 1.2,
    aggroR: 6,
    idle: { img: 'mobShamanIdle', fw: 32, fh: 32, count: 4, fps: 4 },
    run: { img: 'mobShamanRun', fw: 64, fh: 64, count: 6, fps: 8 },
    death: { img: 'mobShamanDeath', fw: 64, fh: 64, count: 7, fps: 8 },
  },
  skelWarrior: {
    name: '骷髅武士', // 均衡
    hp: 70,
    speed: 3.4,
    dmg: [8, 13],
    score: 4,
    attackRange: 0.95,
    aggroR: 5.5,
    idle: { img: 'mobSwarIdle', fw: 32, fh: 32, count: 4, fps: 4 },
    run: { img: 'mobSwarRun', fw: 64, fh: 64, count: 6, fps: 9 },
    death: { img: 'mobSwarDeath', fw: 64, fh: 48, count: 6, fps: 8 },
  },
  skelRogue: {
    name: '骷髅刺客', // 最快最脆
    hp: 26,
    speed: 5.6,
    dmg: [5, 8],
    score: 3,
    attackRange: 0.85,
    aggroR: 6,
    idle: { img: 'mobSrogueIdle', fw: 32, fh: 32, count: 4, fps: 5 },
    run: { img: 'mobSrogueRun', fw: 64, fh: 64, count: 6, fps: 11 },
    death: { img: 'mobSrogueDeath', fw: 64, fh: 64, count: 6, fps: 9 },
  },
}

// ------------------------------------------------------------------
// 技能常量
// ------------------------------------------------------------------

export const MAX_HP = 100
export const MAX_MP = 100
export const SKILL_META = {
  slash: { name: '剑斩', key: 'J', icon: '⚔', cost: 0, cd: 0.5 },
  integral: { name: '积分冲击波', key: 'K', icon: '∫', cost: 30, cd: 6 },
  matrix: { name: '矩阵牢笼', key: 'L', icon: '⟦M⟧', cost: 40, cd: 10 },
  ult: { name: '级数风暴', key: 'U', icon: 'Σ', cost: 100, cd: 0 },
} as const
export type SkillKey = keyof typeof SKILL_META

export interface HudSnapshot {
  hp: number
  /** 生命上限（基础 100 + 熟练/精通奖励） */
  maxHp: number
  mp: number
  /** 灵感上限（基础 100 + 精通奖励） */
  maxMp: number
  score: number
  kills: number
  /** 灵草数量（采集） */
  herbs: number
  /** 灵感药剂数量（Q 饮用回血 40） */
  potions: number
  cds: Record<SkillKey, number>
  /** 「顿悟」buff 剩余秒数（0 = 无 buff），期间伤害 ×1.25 */
  buff: number
}

export interface QuizQuestion {
  q: string
  options: string[]
  answer: number
}

// ------------------------------------------------------------------
// 特效与飘字
// ------------------------------------------------------------------

type Fx =
  | { kind: 'ring'; t: number; dur: number; x: number; y: number; r: number; color: string }
  | { kind: 'glyphs'; t: number; dur: number; x: number; y: number; symbols: string[]; color: string; spread: number }
  | { kind: 'matrix'; t: number; dur: number; cx: number; cy: number; size: number; tickT: number }
  | { kind: 'storm'; t: number; dur: number; x: number; y: number; full: boolean }

interface Floater {
  x: number // 瓦片
  y: number
  text: string
  color: string
  t: number
  dur: number
  size: number
}

const GLYPH_SET = ['∑', '∫', 'π', '√', '∞', 'Δ', 'θ', 'λ']

interface PlayerLike {
  x: number
  y: number
  dir: 'down' | 'up' | 'left' | 'right'
}

export interface CombatHooks {
  isSolid: (tx: number, ty: number) => boolean
  /** 怪物对玩家造成实际伤害时调用（玩家动画/红闪由 loop 处理） */
  damagePlayer: (dmg: number) => void
  /** 大招答题：loop 转发给 store，Quiz UI 答完后调用 resolve */
  onQuiz: (q: QuizQuestion, resolve: (correct: boolean) => void) => void
  /** HUD 数据同步（仅在数值变化时调用） */
  syncHud: (snap: HudSnapshot) => void
}

// ------------------------------------------------------------------
// 怪物
// ------------------------------------------------------------------

type MobState = 'idle' | 'chase' | 'return' | 'dying'

/** 波次投放的倍率（Boss/高波强化用） */
export interface MobMult {
  hp?: number
  dmg?: number
  score?: number
  /** 绘制缩放（Boss 巨大化） */
  scale?: number
}

class Mob {
  spec: MobSpec
  x: number
  y: number
  hp: number
  readonly maxHp: number
  readonly dmgMult: number
  readonly scoreMult: number
  readonly scale: number
  readonly displayName?: string
  state: MobState = 'idle'
  dirX = 1
  animT = Math.random() * 2
  attackCd = 0
  hitFlash = 0
  lungeT = 0
  slowUntil = 0
  moving = false
  wx: number // 游荡目标
  wy: number
  wanderT = 0

  constructor(
    public kind: MobKind,
    public spawnX: number,
    public spawnY: number,
    mult: MobMult = {},
    displayName?: string,
  ) {
    this.spec = MOB_SPECS[kind]
    this.x = spawnX
    this.y = spawnY
    this.maxHp = Math.round(this.spec.hp * (mult.hp ?? 1))
    this.hp = this.maxHp
    this.dmgMult = mult.dmg ?? 1
    this.scoreMult = mult.score ?? 1
    this.scale = mult.scale ?? 1
    this.displayName = displayName
    this.wx = spawnX
    this.wy = spawnY
  }

  get dying() {
    return this.state === 'dying'
  }

  deathDur() {
    const d = this.spec.death
    return d.count / d.fps
  }
}

interface Respawn {
  def: MobSpawnDef
  t: number
}

// ------------------------------------------------------------------
// 战斗管理器
// ------------------------------------------------------------------

export class Combat {
  hp = MAX_HP
  mp = MAX_MP / 2
  score = 0
  kills = 0
  /** 灵草（采集）与灵感药剂（炼金，Q 饮用回血） */
  herbs = 0
  potions = 0
  cds: Record<SkillKey, number> = { slash: 0, integral: 0, matrix: 0, ult: 0 }
  shakeT = 0

  private mobs: Mob[] = []
  private respawns: Respawn[] = []
  private fxs: Fx[] = []
  private floaters: Floater[] = []
  private pendingSlash = 0 // 剑斩命中判定延迟（等挥剑动作到位）
  private sinceHurt = 99 // 距上次受击的秒数（脱战回血用）
  private lastSnap = ''
  private time = 0 // 战斗内累计秒（buff 计时用）
  private dmgBuffUntil = 0 // 「顿悟」伤害增益截止时刻
  private maxMpBonus = 0 // 精通奖励的灵感上限加成
  private maxHpBonus = 0 // 熟练/精通奖励的生命上限加成
  private respawnOn = true // 野外自动重生（秘境波次模式关闭）

  /** 当前灵感上限（基础 + 精通奖励） */
  get maxMp() {
    return MAX_MP + this.maxMpBonus
  }

  /** 当前生命上限（基础 + 熟练/精通奖励） */
  get maxHp() {
    return MAX_HP + this.maxHpBonus
  }

  /** 同步精通奖励的灵感上限加成（来自 mastery 持久化，幂等） */
  setMaxMpBonus(bonus: number) {
    if (bonus === this.maxMpBonus) return
    this.maxMpBonus = bonus
    this.mp = Math.min(this.mp, this.maxMp)
    this.pushHud()
  }

  /** 同步熟练/精通奖励的生命上限加成（来自 mastery 持久化，幂等） */
  setMaxHpBonus(bonus: number) {
    if (bonus === this.maxHpBonus) return
    this.maxHpBonus = bonus
    this.hp = Math.min(this.hp, this.maxHp)
    this.pushHud()
  }

  constructor(
    private assets: Assets,
    world: WorldData,
    private hooks: CombatHooks,
  ) {
    for (const def of world.mobSpawns) this.spawnMob(def)
  }

  /** 场景切换：重建怪物、清特效，保留 HP/灵感/战绩/CD/buff；respawn=false 关闭自动重生（秘境） */
  setWorld(world: WorldData, respawn = true) {
    this.mobs = []
    this.respawns = []
    this.fxs = []
    this.floaters = []
    this.pendingSlash = 0
    this.respawnOn = respawn
    for (const def of world.mobSpawns) this.spawnMob(def)
    this.pushHud()
  }

  /** 顿悟 buff 是否生效 */
  private get dmgMult() {
    return this.time < this.dmgBuffUntil ? 1.25 : 1
  }

  /** 修炼结算奖励：灵感 / 知识点 / 顿悟 buff（秒） */
  grantReward(rw: { mp: number; score: number; buffSec: number }) {
    this.mp = Math.min(this.maxMp, this.mp + rw.mp)
    this.score += rw.score
    if (rw.buffSec > 0) this.dmgBuffUntil = this.time + rw.buffSec
    this.pushHud()
  }

  /** 刷怪：落点若在固体上，螺旋找最近的非固体瓦片 */
  private spawnMob(def: MobSpawnDef) {
    let { tx, ty } = def
    if (this.hooks.isSolid(tx, ty)) {
      outer: for (let r = 1; r <= 4; r++)
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            if (!this.hooks.isSolid(def.tx + dx, def.ty + dy)) {
              tx = def.tx + dx
              ty = def.ty + dy
              break outer
            }
          }
    }
    this.mobs.push(new Mob(def.kind, tx + 0.5, ty + 0.7))
  }

  /** 测试/调试：存活怪物位置 */
  mobPositions(): { x: number; y: number; kind: MobKind; hp: number }[] {
    return this.mobs.filter((m) => !m.dying).map((m) => ({ x: m.x, y: m.y, kind: m.kind, hp: m.hp }))
  }

  /** 存活怪物数（秘境波次判定） */
  aliveCount(): number {
    return this.mobs.filter((m) => !m.dying).length
  }

  /** 秘境：投放一波怪物（不进入自动重生队列） */
  spawnWave(defs: { kind: MobKind; x: number; y: number; mult?: MobMult; name?: string }[]) {
    for (const d of defs) {
      let { x, y } = d
      if (this.hooks.isSolid(Math.floor(x), Math.floor(y))) {
        outer: for (let r = 1; r <= 4; r++)
          for (let dy = -r; dy <= r; dy++)
            for (let dx = -r; dx <= r; dx++) {
              if (!this.hooks.isSolid(Math.floor(x) + dx, Math.floor(y) + dy)) {
                x += dx
                y += dy
                break outer
              }
            }
      }
      this.mobs.push(new Mob(d.kind, x, y, d.mult, d.name))
    }
  }

  /** 调试/测试：清空存活怪物（直接致死，走正常掉落） */
  killAll() {
    for (const m of this.mobs) {
      if (!m.dying) this.hurtMob(m, 99999, '#ffffff')
    }
  }

  /** 世界坐标飘字（loop/trial 共用） */
  notify(x: number, y: number, text: string, color: string, size = 13) {
    this.addFloater(x, y, text, color, size)
  }

  // ================================================================
  // 玩家技能
  // ================================================================

  /** J 剑斩：能否施放由 loop 判断动画状态，这里只管 CD 与命中 */
  trySlash(player: PlayerLike): boolean {
    if (this.cds.slash > 0 || this.hp <= 0) return false
    this.cds.slash = SKILL_META.slash.cd
    this.pendingSlash = 0.16 // 挥剑前摇后判定
    void player
    return true
  }

  private applySlash(player: PlayerLike) {
    const dirV = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[player.dir]
    let hits = 0
    for (const m of this.mobs) {
      if (m.dying) continue
      const dx = m.x - player.x
      const dy = m.y - player.y
      const d = Math.hypot(dx, dy)
      if (d > 1.55) continue
      if (d > 0.15 && (dx * dirV[0] + dy * dirV[1]) / d < 0.35) continue // 约 ±70° 扇形
      this.hurtMob(m, Math.round((10 + Math.floor(Math.random() * 6)) * this.dmgMult), '#fde68a')
      hits++
    }
    if (hits > 0) {
      this.mp = Math.min(this.maxMp, this.mp + 6 * hits)
      this.shakeT = Math.max(this.shakeT, 0.12)
    }
  }

  /** K ∫ 积分冲击波：命中越多、单个伤害越高（积分 = 累积） */
  castIntegral(player: PlayerLike): boolean {
    if (!this.canCast('integral', player)) return false
    this.mp -= SKILL_META.integral.cost
    this.cds.integral = SKILL_META.integral.cd
    const inRange = this.mobs.filter((m) => !m.dying && Math.hypot(m.x - player.x, m.y - player.y) <= 3.2)
    for (const m of inRange) {
      const dmg = Math.round((20 + 6 * inRange.length) * this.dmgMult)
      this.hurtMob(m, dmg, '#7dd3fc')
    }
    this.fxs.push({ kind: 'ring', t: 0, dur: 0.55, x: player.x, y: player.y, r: 3.2, color: '#7dd3fc' })
    this.fxs.push({
      kind: 'glyphs', t: 0, dur: 0.9, x: player.x, y: player.y - 0.6,
      symbols: Array.from({ length: 12 }, () => '∫'), color: '#93c5fd', spread: 3.2,
    })
    if (inRange.length > 0) this.shakeT = Math.max(this.shakeT, 0.18)
    this.addFloater(player.x, player.y - 1.6, `∫ 命中 ${inRange.length} 只`, '#7dd3fc', 13)
    return true
  }

  /** L ⟦M⟧ 矩阵牢笼：区域减速 + 持续伤害 */
  castMatrix(player: PlayerLike): boolean {
    if (!this.canCast('matrix', player)) return false
    this.mp -= SKILL_META.matrix.cost
    this.cds.matrix = SKILL_META.matrix.cd
    // 优先罩住最近的怪，否则放在玩家面前
    let cx = player.x
    let cy = player.y
    let best: Mob | null = null
    let bestD = 6
    for (const m of this.mobs) {
      if (m.dying) continue
      const d = Math.hypot(m.x - player.x, m.y - player.y)
      if (d < bestD) {
        bestD = d
        best = m
      }
    }
    if (best) {
      cx = best.x
      cy = best.y
    } else {
      const dirV = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[player.dir]
      cx = player.x + dirV[0] * 2.2
      cy = player.y + dirV[1] * 2.2
    }
    this.fxs.push({ kind: 'matrix', t: 0, dur: 4, cx, cy, size: 4, tickT: 0 })
    this.addFloater(cx, cy - 2.2, '⟦M⟧ 矩阵牢笼', '#fdba74', 13)
    return true
  }

  /** U Σ 级数风暴：攒满灵感，答题定威力 */
  castUlt(player: PlayerLike): boolean {
    if (this.hp <= 0) return false
    if (this.mp < SKILL_META.ult.cost) {
      this.addFloater(player.x, player.y - 1.6, '灵感不足（需 100）', '#94a3b8', 12)
      return false
    }
    const q = randomCalculusQuestion()
    this.hooks.onQuiz(q, (correct) => {
      this.mp = 0
      const r = correct ? 12 : 6.5
      const dmg = Math.round((correct ? 80 : 32) * this.dmgMult)
      for (const m of this.mobs) {
        if (m.dying) continue
        const d = Math.hypot(m.x - player.x, m.y - player.y)
        if (d > r) continue
        if (correct && d > 0.2) {
          // 击退
          const kx = ((m.x - player.x) / d) * 1.4
          const ky = ((m.y - player.y) / d) * 1.4
          this.moveMob(m, m.x + kx, m.y + ky, 99, 1)
        }
        this.hurtMob(m, dmg, correct ? '#fcd34d' : '#94a3b8')
      }
      this.fxs.push({ kind: 'storm', t: 0, dur: 1.5, x: player.x, y: player.y, full: correct })
      this.shakeT = Math.max(this.shakeT, correct ? 0.5 : 0.25)
      this.addFloater(player.x, player.y - 2, correct ? 'Σ 完美施法！' : 'Σ 施法瑕疵…', correct ? '#fcd34d' : '#94a3b8', 15)
    })
    return true
  }

  private canCast(skill: SkillKey, player: PlayerLike): boolean {
    if (this.hp <= 0) return false
    if (this.cds[skill] > 0) return false
    if (this.mp < SKILL_META[skill].cost) {
      this.addFloater(player.x, player.y - 1.6, '灵感不足', '#94a3b8', 12)
      return false
    }
    return true
  }

  private hurtMob(m: Mob, dmg: number, color: string) {
    if (m.dying) return
    m.hp -= dmg
    m.hitFlash = 0.15
    this.addFloater(m.x, m.y - 1.2, `-${dmg}`, color, 12)
    if (m.hp <= 0) {
      m.state = 'dying'
      m.animT = 0
      this.kills++
      const gained = Math.round(m.spec.score * m.scoreMult)
      this.score += gained
      this.addFloater(m.x, m.y - 1.8, `+${gained} 知识点`, '#6ee7b7', 12)
      this.fxs.push({
        kind: 'glyphs', t: 0, dur: 0.8, x: m.x, y: m.y - 0.5,
        symbols: Array.from({ length: 7 }, () => GLYPH_SET[Math.floor(Math.random() * GLYPH_SET.length)]),
        color: '#c4b5fd', spread: 1.6,
      })
      if (this.respawnOn) {
        this.respawns.push({ def: { kind: m.kind, tx: Math.floor(m.spawnX), ty: Math.floor(m.spawnY) }, t: 18 })
      }
    } else if (m.state === 'idle') {
      m.state = 'chase' // 被打醒
    }
  }

  // ================================================================
  // 灵草 / 药剂
  // ================================================================

  /** 采集灵草 +n */
  addHerb(n: number) {
    this.herbs += n
    this.pushHud()
  }

  /** 炼金台：3 灵草 → 1 灵感药剂；材料不足返回 false */
  brew(): boolean {
    if (this.herbs < 3) return false
    this.herbs -= 3
    this.potions += 1
    this.pushHud()
    return true
  }

  /** Q 饮用灵感药剂：回复 40 点生命；无药剂或满血返回 false */
  drink(): boolean {
    if (this.potions <= 0 || this.hp <= 0 || this.hp >= this.maxHp) return false
    this.potions -= 1
    this.hp = Math.min(this.maxHp, this.hp + 40)
    this.pushHud()
    return true
  }

  /** 直接治疗（秘境波间奖励） */
  heal(amount: number) {
    this.hp = Math.min(this.maxHp, this.hp + amount)
    this.pushHud()
  }

  /** 回满生命与灵感（秘境答题满分奖励） */
  healFull() {
    this.hp = this.maxHp
    this.mp = this.maxMp
    this.pushHud()
  }

  /** 玩家复活 */
  respawn() {
    this.hp = this.maxHp
    this.mp = Math.max(this.mp, this.maxMp / 2)
  }

  /** 调试/测试：灵感拉满（验证大招） */
  fillMp() {
    this.mp = this.maxMp
    this.pushHud()
  }

  // ================================================================
  // 更新
  // ================================================================

  update(dt: number, player: PlayerLike & { state: string }, frozen: boolean) {
    if (frozen) {
      this.pushHud()
      return
    }
    this.time += dt
    // CD / 灵感回复
    for (const k of Object.keys(this.cds) as SkillKey[]) this.cds[k] = Math.max(0, this.cds[k] - dt)
    this.mp = Math.min(this.maxMp, this.mp + 3 * dt)
    this.shakeT = Math.max(0, this.shakeT - dt)
    // 脱战回血（4 秒未受击后缓慢恢复）
    this.sinceHurt += dt
    if (this.sinceHurt > 4 && this.hp > 0) this.hp = Math.min(this.maxHp, this.hp + 3 * dt)

    // 剑斩延迟判定
    if (this.pendingSlash > 0) {
      this.pendingSlash -= dt
      if (this.pendingSlash <= 0) this.applySlash(player)
    }

    const playerAlive = this.hp > 0 && player.state !== 'dead'

    // 特效推进
    for (const fx of this.fxs) {
      fx.t += dt
      if (fx.kind === 'matrix') {
        fx.tickT -= dt
        if (fx.tickT <= 0) {
          fx.tickT = 0.5
          for (const m of this.mobs) {
            if (m.dying) continue
            if (Math.abs(m.x - fx.cx) < fx.size / 2 && Math.abs(m.y - fx.cy) < fx.size / 2) {
              m.slowUntil = 0.7
              this.hurtMob(m, Math.round(4 * this.dmgMult), '#fdba74')
            }
          }
        }
      }
    }
    this.fxs = this.fxs.filter((f) => f.t < f.dur)
    for (const f of this.floaters) f.t += dt
    this.floaters = this.floaters.filter((f) => f.t < f.dur)

    // 重生
    for (const r of this.respawns) {
      r.t -= dt
      if (r.t <= 0) this.spawnMob(r.def)
    }
    this.respawns = this.respawns.filter((r) => r.t > 0)

    // 怪物 AI
    for (const m of this.mobs) {
      m.animT += dt
      m.hitFlash = Math.max(0, m.hitFlash - dt)
      m.lungeT = Math.max(0, m.lungeT - dt)
      if (m.dying) continue
      m.attackCd = Math.max(0, m.attackCd - dt)
      const slowed = m.slowUntil > 0
      m.slowUntil = Math.max(0, m.slowUntil - dt)

      const dx = player.x - m.x
      const dy = player.y - m.y
      const dist = Math.hypot(dx, dy)
      const distSpawn = Math.hypot(m.spawnX - m.x, m.spawnY - m.y)

      if (playerAlive && dist < m.spec.aggroR && distSpawn < 11) {
        m.state = 'chase'
      } else if (m.state === 'chase') {
        m.state = 'return'
      }

      m.moving = false
      if (m.state === 'chase') {
        if (!playerAlive) {
          m.state = 'return'
        } else if (dist < m.spec.attackRange) {
          if (m.attackCd <= 0) {
            m.attackCd = 1.3
            m.lungeT = 0.24
            const base = m.spec.dmg[0] + Math.floor(Math.random() * (m.spec.dmg[1] - m.spec.dmg[0] + 1))
            const dmg = Math.round(base * m.dmgMult)
            this.hp = Math.max(0, this.hp - dmg)
            this.sinceHurt = 0
            this.hooks.damagePlayer(dmg)
          }
          m.dirX = dx >= 0 ? 1 : -1
        } else {
          const sp = slowed ? m.spec.speed * 0.4 : m.spec.speed
          this.moveMob(m, player.x, player.y, sp, dt)
          m.moving = true
        }
      } else if (m.state === 'return') {
        if (distSpawn < 0.4) {
          m.state = 'idle'
          m.hp = m.maxHp
        } else {
          this.moveMob(m, m.spawnX, m.spawnY, m.spec.speed * 0.6, dt)
          m.moving = true
        }
      } else {
        // 游荡
        m.wanderT -= dt
        if (m.wanderT <= 0) {
          m.wanderT = 2 + Math.random() * 3
          const a = Math.random() * Math.PI * 2
          const r = Math.random() * 3
          m.wx = m.spawnX + Math.cos(a) * r
          m.wy = m.spawnY + Math.sin(a) * r
        }
        const wdx = m.wx - m.x
        const wdy = m.wy - m.y
        if (Math.hypot(wdx, wdy) > 0.3) {
          this.moveMob(m, m.wx, m.wy, m.spec.speed * 0.4, dt)
          m.moving = true
        }
      }
    }
    // 移除死亡动画播完的怪
    this.mobs = this.mobs.filter((m) => !m.dying || m.animT < m.deathDur() + 0.35)

    this.pushHud()
  }

  /** 轴向分离的移动碰撞（与玩家同一套手感） */
  private moveMob(m: Mob, tx: number, ty: number, speed: number, dt: number) {
    const dx = tx - m.x
    const dy = ty - m.y
    const len = Math.hypot(dx, dy)
    if (len < 1e-4) return
    const step = Math.min(speed * dt, len)
    const vx = (dx / len) * step
    const vy = (dy / len) * step
    if (speed < 90) m.dirX = dx >= 0 ? 1 : -1
    const blocked = (x: number, y: number) => {
      const hw = 0.22
      const hh = 0.15
      for (let ty2 = Math.floor(y - hh); ty2 <= Math.floor(y + hh); ty2++)
        for (let tx2 = Math.floor(x - hw); tx2 <= Math.floor(x + hw); tx2++)
          if (this.hooks.isSolid(tx2, ty2)) return true
      return false
    }
    if (!blocked(m.x + vx, m.y)) m.x += vx
    if (!blocked(m.x, m.y + vy)) m.y += vy
  }

  private pushHud() {
    const snap: HudSnapshot = {
      hp: Math.ceil(this.hp),
      maxHp: this.maxHp,
      mp: Math.floor(this.mp),
      maxMp: this.maxMp,
      score: this.score,
      kills: this.kills,
      herbs: this.herbs,
      potions: this.potions,
      cds: {
        slash: Math.round(this.cds.slash * 10) / 10,
        integral: Math.round(this.cds.integral * 10) / 10,
        matrix: Math.round(this.cds.matrix * 10) / 10,
        ult: Math.round(this.cds.ult * 10) / 10,
      },
      buff: Math.max(0, Math.ceil(this.dmgBuffUntil - this.time)),
    }
    const key = JSON.stringify(snap)
    if (key !== this.lastSnap) {
      this.lastSnap = key
      this.hooks.syncHud(snap)
    }
  }

  private addFloater(x: number, y: number, text: string, color: string, size: number) {
    this.floaters.push({ x, y, text, color, t: 0, dur: 1, size })
  }

  // ================================================================
  // 渲染
  // ================================================================

  /** 地面层特效：冲击波环 / 矩阵牢笼（在 y 排序对象之前画） */
  drawGroundFx(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const fx of this.fxs) {
      if (fx.kind === 'ring') {
        const p = fx.t / fx.dur
        const r = fx.r * TILE_SRC * (0.25 + 0.75 * p)
        const cx = fx.x * TILE_SRC - camX
        const cy = fx.y * TILE_SRC - camY
        ctx.save()
        ctx.globalAlpha = (1 - p) * 0.9
        ctx.strokeStyle = fx.color
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.ellipse(cx, cy, r, r * 0.55, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = (1 - p) * 0.4
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.ellipse(cx, cy, r * 0.7, r * 0.38, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      } else if (fx.kind === 'matrix') {
        const half = (fx.size / 2) * TILE_SRC
        const x0 = fx.cx * TILE_SRC - half - camX
        const y0 = fx.cy * TILE_SRC - half - camY
        const side = half * 2
        const pulse = 0.55 + Math.sin(fx.t * 6) * 0.2
        const fade = fx.dur - fx.t < 0.5 ? (fx.dur - fx.t) / 0.5 : 1
        ctx.save()
        ctx.globalAlpha = pulse * fade
        ctx.fillStyle = 'rgba(251, 191, 36, 0.10)'
        ctx.fillRect(x0, y0, side, side)
        ctx.strokeStyle = '#fbbf24'
        ctx.lineWidth = 1.2
        ctx.strokeRect(x0, y0, side, side)
        // 四角矩阵括号
        ctx.lineWidth = 2.5
        const b = 7
        for (const [bx, by, sx, sy] of [
          [x0, y0, 1, 1],
          [x0 + side, y0, -1, 1],
          [x0, y0 + side, 1, -1],
          [x0 + side, y0 + side, -1, -1],
        ] as const) {
          ctx.beginPath()
          ctx.moveTo(bx + b * sx, by)
          ctx.lineTo(bx, by)
          ctx.lineTo(bx, by + b * sy)
          ctx.stroke()
        }
        // 内部漂浮数字矩阵
        ctx.font = '600 8px Georgia, serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#fde68a'
        for (let r = 0; r < 3; r++)
          for (let c = 0; c < 3; c++) {
            const gx = x0 + ((c + 1) / 4) * side
            const gy = y0 + ((r + 1) / 4) * side + Math.sin(fx.t * 3 + r * 2 + c) * 2
            const digit = Math.abs(Math.floor(Math.sin(fx.t * 0.8 + r * 3.1 + c * 7.7) * 9))
            ctx.fillText(String(digit), gx, gy)
          }
        ctx.restore()
      }
    }
  }

  /** 怪物绘制项（交给 loop 的 y 排序列表，闭包捕获 ctx/cam） */
  mobDrawItems(ctx: CanvasRenderingContext2D, camX: number, camY: number): { sortY: number; draw: () => void }[] {
    const items: { sortY: number; draw: () => void }[] = []
    for (const m of this.mobs) {
      const sheet = m.dying ? m.spec.death : m.moving ? m.spec.run : m.spec.idle
      const img = this.assets[sheet.img]
      const idx = m.dying
        ? Math.min(Math.floor(m.animT * sheet.fps), sheet.count - 1)
        : Math.floor(m.animT * sheet.fps) % sheet.count
      const sc = m.scale
      const dw = sheet.fw * sc
      const dh = sheet.fh * sc
      // 攻击前扑：朝玩家方向偏移
      const lunge = m.lungeT > 0 ? Math.sin((m.lungeT / 0.24) * Math.PI) * 4 * sc : 0
      const wx = m.x * TILE_SRC + lunge * m.dirX
      const wy = m.y * TILE_SRC
      const dx = Math.round(wx - dw / 2 - camX)
      const dy = Math.round(wy - dh - camY)
      const flash = m.hitFlash > 0
      const slow = m.slowUntil > 0
      items.push({
        sortY: wy,
        draw: () => {
          // 阴影
          ctx.fillStyle = 'rgba(8,10,20,0.2)'
          ctx.beginPath()
          ctx.ellipse(wx - camX, wy - 1 - camY, 7 * sc, 2.6 * sc, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.save()
          if (flash) ctx.filter = 'brightness(2.6)'
          if (m.dirX < 0) {
            ctx.translate(Math.round(wx - camX), 0)
            ctx.scale(-1, 1)
            ctx.drawImage(img, idx * sheet.fw, 0, sheet.fw, sheet.fh, -dw / 2, dy, dw, dh)
          } else {
            ctx.drawImage(img, idx * sheet.fw, 0, sheet.fw, sheet.fh, dx, dy, dw, dh)
          }
          ctx.restore()
          // 减速标记（被矩阵束缚）
          if (slow && !m.dying) {
            ctx.fillStyle = '#fbbf24'
            ctx.font = '700 9px Georgia, serif'
            ctx.textAlign = 'center'
            ctx.fillText('⟦⟧', wx - camX, dy - 10)
          }
          // Boss 名签
          if (m.displayName && !m.dying) {
            ctx.font = '600 8px "PingFang SC", sans-serif'
            ctx.textAlign = 'center'
            const ny = dy - (m.hp < m.maxHp ? 14 : 6)
            const nw = ctx.measureText(m.displayName).width + 8
            ctx.fillStyle = 'rgba(30, 8, 12, 0.72)'
            ctx.beginPath()
            ctx.roundRect(wx - camX - nw / 2, ny - 7, nw, 11, 5)
            ctx.fill()
            ctx.fillStyle = '#fca5a5'
            ctx.fillText(m.displayName, wx - camX, ny - 1)
          }
          // 血条（受伤后显示；Boss 更宽）
          if (!m.dying && m.hp < m.maxHp) {
            const bw = m.scale > 1.2 ? 34 : 22
            const bx = wx - camX - bw / 2
            const by = dy - 6
            ctx.fillStyle = 'rgba(8,10,20,0.7)'
            ctx.fillRect(bx - 0.5, by - 0.5, bw + 1, 4)
            ctx.fillStyle = '#7f1d1d'
            ctx.fillRect(bx, by, bw, 3)
            ctx.fillStyle = m.scale > 1.2 ? '#f87171' : '#4ade80'
            ctx.fillRect(bx, by, (bw * Math.max(0, m.hp)) / m.maxHp, 3)
          }
        },
      })
    }
    return items
  }

  /** 屏幕空间特效：符号喷发 / 级数风暴 / 伤害飘字（在 vignette 前调用） */
  drawScreenFx(ctx: CanvasRenderingContext2D, camX: number, camY: number, scale: number, vw: number, vh: number) {
    const toSX = (wx: number) => (wx * TILE_SRC - camX) * scale
    const toSY = (wy: number) => (wy * TILE_SRC - camY) * scale
    for (const fx of this.fxs) {
      if (fx.kind === 'glyphs') {
        const p = fx.t / fx.dur
        const ox = toSX(fx.x)
        const oy = toSY(fx.y)
        ctx.save()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        fx.symbols.forEach((sym, i) => {
          const ang = (i / fx.symbols.length) * Math.PI * 2 + fx.t * 2.2
          const r = (8 + p * fx.spread * TILE_SRC) * scale * 0.55
          ctx.globalAlpha = Math.sin(Math.min(p, 1) * Math.PI) * 0.95
          ctx.fillStyle = fx.color
          ctx.font = `700 ${Math.round(13 * (1 - p * 0.3))}px Georgia, serif`
          ctx.fillText(sym, ox + Math.cos(ang) * r, oy + Math.sin(ang) * r * 0.7 - p * 26)
        })
        ctx.restore()
      } else if (fx.kind === 'storm') {
        const p = fx.t / fx.dur
        const ox = toSX(fx.x)
        const oy = toSY(fx.y)
        const colors = fx.full ? ['#fcd34d', '#f0abfc', '#7dd3fc', '#ffffff'] : ['#94a3b8', '#cbd5e1']
        ctx.save()
        // 开场白闪
        if (p < 0.22) {
          ctx.globalAlpha = (0.22 - p) * (fx.full ? 2.4 : 1.2)
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, vw, vh)
        }
        // 扩散环
        ctx.globalAlpha = (1 - p) * 0.85
        ctx.strokeStyle = colors[0]
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(ox, oy, p * Math.max(vw, vh) * 0.75, 0, Math.PI * 2)
        ctx.stroke()
        // 符号风暴
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const n = fx.full ? 30 : 14
        for (let i = 0; i < n; i++) {
          const seed = i * 2.399963 // 黄金角散布
          const ang = seed + fx.t * 1.5
          const rr = (12 + p * (fx.full ? 12 : 7) * TILE_SRC) * scale * (0.35 + ((i * 37) % 10) / 14)
          const alpha = Math.sin(Math.min(p, 1) * Math.PI)
          ctx.globalAlpha = alpha * 0.95
          ctx.fillStyle = colors[i % colors.length]
          ctx.font = `700 ${16 + ((i * 13) % 14)}px Georgia, serif`
          ctx.fillText(GLYPH_SET[i % GLYPH_SET.length], ox + Math.cos(ang) * rr, oy + Math.sin(ang) * rr * 0.72)
        }
        ctx.restore()
      }
    }
    // 伤害/提示飘字
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const f of this.floaters) {
      const p = f.t / f.dur
      ctx.globalAlpha = p < 0.15 ? p / 0.15 : 1 - Math.max(0, (p - 0.6) / 0.4)
      ctx.font = `700 ${f.size}px "PingFang SC", Georgia, serif`
      ctx.strokeStyle = 'rgba(8,6,18,0.85)'
      ctx.lineWidth = 3
      const x = toSX(f.x)
      const y = toSY(f.y) - p * 30
      ctx.strokeText(f.text, x, y)
      ctx.fillStyle = f.color
      ctx.fillText(f.text, x, y)
    }
    ctx.restore()
  }
}
