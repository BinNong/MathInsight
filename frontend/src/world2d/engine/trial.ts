/**
 * 微积分秘境·波次试炼：倒计时 → 投放波次 → 肃清判定 → 答题回血 → 下一波。
 * 每 5 波一位秘境守卫（巨大化 Boss）；最佳闯关纪录持久化。
 * 试炼期间世界被答题冻结时，本管理器同样暂停（update 的 active=false）。
 */
import type { Combat, MobMult, QuizQuestion } from './combat'
import type { MobKind } from '../data/world'
import { randomCalculusQuestion } from '../data/questions'

export type TrialPhase = 'countdown' | 'fighting' | 'cleared'

export interface TrialStatus {
  wave: number
  phase: TrialPhase
  best: number
}

interface TrialHooks {
  combat: Combat
  /** 世界是否未冻结（答题/对话打开时暂停倒计时） */
  isActive: () => boolean
  onQuiz: (q: QuizQuestion, resolve: (correct: boolean) => void) => void
  setStatus: (s: TrialStatus | null) => void
  setObjective: (t: string) => void
  /** 持久化最佳纪录 */
  recordBest: (wave: number) => number
}

/** 波次出怪点（秘境 20×13 瓦片，竞技场区域） */
const PTS: Record<string, [number, number]> = {
  A: [3.5, 4.5],
  B: [15.5, 4.5],
  C: [9.5, 4.5],
  D: [3.5, 8.5],
  E: [15.5, 8.5],
  F: [6.5, 6],
  G: [12.5, 6],
  H: [9.5, 8],
}

interface WaveDef {
  kind: MobKind
  at: keyof typeof PTS
  mult?: MobMult
  name?: string
}

const BOSS_SHAMAN: Pick<WaveDef, 'mult' | 'name'> = {
  mult: { hp: 5, dmg: 1.6, score: 8, scale: 1.65 },
  name: '秘境守卫 · 萨满领主',
}
const BOSS_WARRIOR: Pick<WaveDef, 'mult' | 'name'> = {
  mult: { hp: 6, dmg: 1.7, score: 10, scale: 1.7 },
  name: '秘境守卫 · 督军',
}

/** 第 n 波出怪表（n 从 1 开始；每 5 波 Boss；8 波后血量渐增） */
function makeWave(n: number): WaveDef[] {
  const hpMult = n > 8 ? 1 + (n - 8) * 0.12 : 1
  const m = (k: MobKind, at: keyof typeof PTS): WaveDef => ({ kind: k, at, mult: hpMult > 1 ? { hp: hpMult } : undefined })
  if (n % 5 === 0) {
    const boss = n % 10 === 0 ? BOSS_WARRIOR : BOSS_SHAMAN
    const bossMult = hpMult > 1 ? { ...boss.mult, hp: (boss.mult?.hp ?? 1) * hpMult } : boss.mult
    return [
      { kind: n % 10 === 0 ? 'orcWarrior' : 'orcShaman', at: 'C', mult: bossMult, name: boss.name },
      m('skelRogue', 'D'),
      m('skelRogue', 'E'),
    ]
  }
  const table: Record<number, WaveDef[]> = {
    1: [m('skeleton', 'A'), m('skeleton', 'B'), m('skeleton', 'C')],
    2: [m('skeleton', 'A'), m('skeleton', 'B'), m('orc', 'F')],
    3: [m('orcRogue', 'D'), m('orcRogue', 'E'), m('skeleton', 'A'), m('skeleton', 'B')],
    4: [m('skelRogue', 'D'), m('skelRogue', 'E'), m('orc', 'F'), m('orc', 'G')],
    6: [m('orcWarrior', 'F'), m('mage', 'G'), m('skelRogue', 'D'), m('skelRogue', 'E')],
    7: [m('orcShaman', 'G'), m('orcRogue', 'D'), m('orcRogue', 'E'), m('skeleton', 'A'), m('skeleton', 'B')],
    8: [m('skelWarrior', 'F'), m('skelWarrior', 'G'), m('mage', 'C'), m('orcRogue', 'D')],
    9: [m('orcWarrior', 'F'), m('orcWarrior', 'G'), m('orcShaman', 'C'), m('skelRogue', 'D'), m('skelRogue', 'E')],
  }
  if (table[n]) return table[n]
  // 10 波以后：循环组合并持续强化
  const pool: [MobKind, keyof typeof PTS][] = [
    ['orcWarrior', 'F'], ['skelWarrior', 'G'], ['orcShaman', 'C'],
    ['orcRogue', 'D'], ['skelRogue', 'E'], ['mage', 'H'],
  ]
  const count = Math.min(4 + Math.floor((n - 11) / 2), 6)
  return Array.from({ length: count }, (_, i) => {
    const [kind, at] = pool[(n + i) % pool.length]
    return m(kind, at)
  })
}

export class Trial {
  wave = 0
  phase: TrialPhase = 'countdown'
  private t = 0
  private lastTick = -1
  private running = false

  constructor(private hooks: TrialHooks) {}

  get active() {
    return this.running
  }

  /** 守关人对话「开始试炼」触发 */
  start() {
    if (this.running) return
    this.running = true
    this.wave = 0
    this.beginCountdown(3)
    this.hooks.setObjective('秘境试炼：肃清每一波混沌兽；波间答题可恢复伤势')
  }

  /** 玩家死亡或离开秘境：结算并复位 */
  stop() {
    if (!this.running) return
    this.running = false
    if (this.wave > 0) this.hooks.recordBest(this.wave)
    this.hooks.setStatus(null)
  }

  private best() {
    return this.hooks.recordBest(0) // recordBest(0) 只读不改（实现保证 0 不覆盖）
  }

  private push() {
    this.hooks.setStatus({ wave: Math.max(this.wave, 1), phase: this.phase, best: this.best() })
  }

  private beginCountdown(sec: number) {
    this.phase = 'countdown'
    this.t = sec
    this.lastTick = -1
    this.push()
  }

  private spawnWave() {
    this.phase = 'fighting'
    const defs = makeWave(this.wave)
    this.hooks.combat.spawnWave(defs.map((d) => ({ kind: d.kind, x: PTS[d.at][0], y: PTS[d.at][1], mult: d.mult, name: d.name })))
    const boss = defs.find((d) => d.name)
    this.hooks.combat.notify(9.5, 6.4, boss ? `⚠ ${boss.name} 降临！` : `第 ${this.wave} 波来袭！`, boss ? '#fca5a5' : '#fdba74', 16)
    this.push()
  }

  private cleared() {
    this.phase = 'cleared'
    this.push()
    const c = this.hooks.combat
    c.grantReward({ mp: 15, score: this.wave, buffSec: 0 })
    c.notify(9.5, 6.4, `第 ${this.wave} 波已肃清！`, '#6ee7b7', 15)
    this.hooks.recordBest(this.wave)
    // 波间答题：答对全愈 + 顿悟，答错半愈
    this.hooks.onQuiz(randomCalculusQuestion(), (correct) => {
      if (!this.running) return
      if (correct) {
        c.healFull()
        c.grantReward({ mp: 0, score: 3, buffSec: 25 })
        c.notify(9.5, 7, '✨ 答对！伤势尽愈，顿悟加身', '#fcd34d', 14)
      } else {
        c.heal(Math.round(c.maxHp * 0.5))
        c.notify(9.5, 7, '答错…守关人替你稳住了一半伤势', '#94a3b8', 13)
      }
      if (this.running) this.beginCountdown(4)
    })
  }

  update(dt: number, active: boolean) {
    if (!this.running || !active) return
    if (this.hooks.combat.hp <= 0) {
      this.stop()
      return
    }
    if (this.phase === 'countdown') {
      this.t -= dt
      const tick = Math.ceil(this.t)
      if (tick !== this.lastTick && tick > 0 && tick <= 3) {
        this.lastTick = tick
        this.hooks.combat.notify(9.5, 6.4, this.wave === 0 ? `试炼开始 · ${tick}` : `${tick}`, '#fdba74', 18)
      }
      if (this.t <= 0) {
        this.wave++
        this.spawnWave()
      }
    } else if (this.phase === 'fighting') {
      if (this.hooks.combat.aliveCount() === 0) this.cleared()
    }
  }
}
