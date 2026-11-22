/**
 * 微积分题库：三大修炼馆 × 知识点 × 分层小题（含解析）。
 * 修炼答题（Training）与大招「Σ 级数风暴」共用本题库。
 */

import { GENERATED_QUESTION_BANK } from './questionBank.generated'

export type HallId = 'limit' | 'derivative' | 'integral'

export interface HallDef {
  id: HallId
  name: string
  room: string // 房间素材 key
  mentor: string
  mentorName: string
  topics: string[]
}

export interface TopicDef {
  id: string
  /** 分组 id：微积分三馆对应游戏场景；线代/概率为主题分组，不进 2D 游戏 */
  hall: string
  name: string
  desc: string
}

export interface BankQuestion {
  id: string
  topic: string
  difficulty: 1 | 2 | 3
  q: string
  options: string[]
  answer: number
  explain: string
}

export const HALLS: Record<HallId, HallDef> = {
  limit: {
    id: 'limit',
    name: '极限酒馆',
    room: 'roomLimit',
    mentor: 'host',
    mentorName: '极限导师 · 洛必达',
    topics: ['limit-calc', 'limit-continuity'],
  },
  derivative: {
    id: 'derivative',
    name: '导数讲堂',
    room: 'roomDerivative',
    mentor: 'scholar',
    mentorName: '导数导师 · 牛顿',
    topics: ['deriv-calc', 'deriv-app'],
  },
  integral: {
    id: 'integral',
    name: '积分圣所',
    room: 'roomIntegral',
    mentor: 'sage',
    mentorName: '积分导师 · 莱布尼茨',
    topics: ['integral-indef', 'integral-def', 'series'],
  },
}

export const TOPICS: TopicDef[] = [
  { id: 'limit-calc', hall: 'limit', name: '极限计算', desc: '两个重要极限、等价无穷小、运算法则' },
  {
    id: 'limit-continuity',
    hall: 'limit',
    name: '连续与间断',
    desc: '连续性判断、间断点分类、闭区间性质',
  },
  { id: 'deriv-calc', hall: 'derivative', name: '求导法则', desc: '基本公式、四则运算、链式法则' },
  { id: 'deriv-app', hall: 'derivative', name: '导数应用', desc: '切线、单调性、极值、洛必达法则' },
  { id: 'integral-indef', hall: 'integral', name: '不定积分', desc: '基本积分表、凑微分' },
  {
    id: 'integral-def',
    hall: 'integral',
    name: '定积分',
    desc: '牛顿-莱布尼茨公式、对称性、几何意义',
  },
  { id: 'series', hall: 'integral', name: '级数初步', desc: '几何级数、p-级数、收敛必要条件' },
  // 线性代数（主站练习，不进 2D 小镇）
  { id: 'matrix-basics', hall: 'linear-algebra', name: '矩阵与行列式', desc: '行列式计算、矩阵运算、秩与几何意义' },
  { id: 'linear-systems', hall: 'linear-algebra', name: '线性方程组', desc: '高斯消元、解的判定、秩与解的结构' },
  { id: 'eigenvalues', hall: 'linear-algebra', name: '特征值与特征向量', desc: '特征方程、对角化、几何解释' },
  // 概率论与数理统计（主站练习，不进 2D 小镇）
  { id: 'probability-basics', hall: 'probability', name: '概率基础', desc: '古典概型、条件概率、独立与贝叶斯' },
  { id: 'distributions', hall: 'probability', name: '随机变量与分布', desc: '期望方差、二项/泊松/正态/指数分布' },
  { id: 'central-limit', hall: 'probability', name: '中心极限定理', desc: '样本均值、标准误、大数定律' },
  { id: 'hypothesis-testing', hall: 'probability', name: '假设检验', desc: 'p 值、显著性水平、z/t 检验' },
]

// 题库数据由后端 JSON 生成，运行 python3 scripts/sync_question_bank.py 同步。
export const QUESTION_BANK: BankQuestion[] = GENERATED_QUESTION_BANK

/** 按知识点取题；count 道，按难度混排（简单在前，难题压轴） */
export function pickQuestions(topicId: string, count = 5): BankQuestion[] {
  const pool = QUESTION_BANK.filter((q) => q.topic === topicId)
  return pickFrom(pool, count)
}

/** 综合试炼：整馆知识点混合抽题 */
export function pickHallQuestions(hallId: HallId, count = 5): BankQuestion[] {
  const pool = QUESTION_BANK.filter((q) => HALLS[hallId].topics.includes(q.topic))
  return pickFrom(pool, count)
}

function pickFrom(pool: BankQuestion[], count: number): BankQuestion[] {
  const byDiff = (d: number) =>
    pool.filter((q) => q.difficulty === d).sort(() => Math.random() - 0.5)
  const sorted = [...byDiff(1), ...byDiff(2), ...byDiff(3)]
  // 打乱同难度内部顺序，保留由易到难的节奏
  const picked = sorted.slice(0, Math.min(count, sorted.length))
  return picked
}

/** 大招题库接口（与旧 QUIZ_BANK 同构） */
export function randomCalculusQuestion(): { q: string; options: string[]; answer: number } {
  const q = QUESTION_BANK[Math.floor(Math.random() * QUESTION_BANK.length)]
  return { q: q.q, options: q.options, answer: q.answer }
}

export function topicName(id: string): string {
  return TOPICS.find((t) => t.id === id)?.name ?? id
}
