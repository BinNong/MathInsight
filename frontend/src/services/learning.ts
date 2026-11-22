/**
 * 共享学习模型：把 2D 小镇的题库/掌握度与主站知识图谱连接起来。
 *
 * 此前掌握度数据只存在于 `mathinsight-calc-mastery`（2D 游戏内部），
 * 知识图谱与主站页面完全看不到。这里定义主题↔概念映射与聚合查询，
 * 让同一份掌握度数据驱动知识图谱着色、首页诊断与题库练习。
 */
import { QUESTION_BANK, TOPICS, type BankQuestion, type TopicDef } from '../world2d/data/questions'
import { masteryLevel, useMasteryStore, type TopicProgress } from '../world2d/store'
import type { ReviewEntry } from '../stores/reviewStore'

/** 题库主题 → 知识图谱概念 id */
export const TOPIC_CONCEPTS: Record<string, string[]> = {
  'limit-calc': ['limit-sequence', 'limit-function', 'epsilon-delta', 'lhopital'],
  'limit-continuity': ['continuity', 'functions'],
  'deriv-calc': ['derivative-definition', 'derivative-rules', 'higher-derivatives', 'differential'],
  'deriv-app': ['mean-value-theorem', 'function-analysis', 'lhopital'],
  'integral-indef': ['indefinite-integral', 'integration-techniques'],
  'integral-def': ['definite-integral', 'fundamental-theorem', 'riemann-sum', 'numerical-integration', 'improper-integral'],
  series: ['series', 'power-series', 'taylor'],
  'matrix-basics': ['matrices', 'determinants', 'linear-systems'],
  'linear-systems': ['linear-systems', 'vector-spaces', 'matrices'],
  eigenvalues: ['eigenvalues', 'eigenvectors', 'quadratic-forms'],
  'probability-basics': ['probability-basics', 'random-variables'],
  distributions: ['distributions', 'expectation-variance'],
  'central-limit': ['central-limit-theorem', 'law-of-large-numbers'],
  'hypothesis-testing': ['hypothesis-testing', 'parameter-estimation'],
}

/** 知识图谱概念 id → 题库主题（反向索引，自动构建） */
export const CONCEPT_TOPICS: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {}
  for (const [topic, concepts] of Object.entries(TOPIC_CONCEPTS)) {
    for (const concept of concepts) {
      if (!map[concept]) map[concept] = []
      map[concept].push(topic)
    }
  }
  return map
})()

/** 主题 → 主站可视化路由（薄弱点直达对应实验） */
export const TOPIC_ROUTES: Record<string, string> = {
  'limit-calc': '/limit',
  'limit-continuity': '/limit',
  'deriv-calc': '/derivative',
  'deriv-app': '/derivative',
  'integral-indef': '/integration',
  'integral-def': '/integration',
  series: '/taylor',
  'matrix-basics': '/matrix',
  'linear-systems': '/matrix',
  eigenvalues: '/eigenvalues',
  'probability-basics': '/probability',
  distributions: '/distributions',
  'central-limit': '/clt',
  'hypothesis-testing': '/hypothesis-test',
}

export interface ConceptMastery {
  level: 0 | 1 | 2 | 3
  answered: number
  correct: number
  wrong: number
  accuracy: number
}

/** 聚合某概念关联的所有主题掌握度（一个概念可对应多个题库主题） */
export function conceptMastery(
  conceptId: string,
  topics: Record<string, TopicProgress>
): ConceptMastery {
  const topicIds = CONCEPT_TOPICS[conceptId] || []
  let answered = 0
  let correct = 0
  const wrongIds = new Set<string>()
  for (const id of topicIds) {
    const p = topics[id]
    if (!p) continue
    answered += p.answered
    correct += p.correct
    p.wrong.forEach((w) => wrongIds.add(w))
  }
  const level = masteryLevel(
    answered > 0 ? { answered, correct, wrong: [...wrongIds] } : undefined
  )
  return {
    level,
    answered,
    correct,
    wrong: wrongIds.size,
    accuracy: answered > 0 ? correct / answered : 0,
  }
}

/** 主题自身掌握度（带等级与正确率） */
export function topicMastery(topicId: string, topics: Record<string, TopicProgress>): ConceptMastery {
  const p = topics[topicId]
  const answered = p?.answered ?? 0
  const correct = p?.correct ?? 0
  return {
    level: masteryLevel(p),
    answered,
    correct,
    wrong: p?.wrong.length ?? 0,
    accuracy: answered > 0 ? correct / answered : 0,
  }
}

export interface WeakTopic {
  topic: TopicDef
  mastery: ConceptMastery
  route: string
}

/**
 * 薄弱知识点：有作答记录且正确率 < 70% 的主题，按「错题数 × 正确率缺口」排序。
 * 没有数据时返回空数组，调用方据此显示引导。
 */
export function weakTopics(topics: Record<string, TopicProgress>, limit = 3): WeakTopic[] {
  return TOPICS.map((topic) => ({ topic, mastery: topicMastery(topic.id, topics) }))
    .filter((item) => item.mastery.answered >= 2 && item.mastery.accuracy < 0.7)
    .sort(
      (a, b) =>
        b.mastery.wrong * (1 - b.mastery.accuracy) -
        a.mastery.wrong * (1 - a.mastery.accuracy)
    )
    .slice(0, limit)
    .map((item) => ({ ...item, route: TOPIC_ROUTES[item.topic.id] || '/knowledge-map' }))
}

/** 掌握度等级对应的展示色（纸墨风格：暖灰→赭→青→深绿） */
export const MASTERY_COLORS = ['#b4b2a9', '#ba7517', '#1d9e75', '#0f6e56'] as const

export interface ReviewItem {
  q: BankQuestion
  topicId: string
}

/**
 * 今日复习队列：错题 + 已作答且到期的题。
 *
 * 未作答过的新题不算复习，避免新用户一进复习模式就看到整套题库。
 */
export function dueReviewItems(
  topics: Record<string, TopicProgress>,
  entries: Record<string, ReviewEntry>,
  now = Date.now()
): ReviewItem[] {
  return QUESTION_BANK.map((q) => ({ q, topicId: q.topic })).filter(({ q, topicId }) => {
    if ((topics[topicId]?.wrong ?? []).includes(q.id)) return true
    const entry = entries[q.id]
    return Boolean(entry) && (entry.streak === 0 || entry.dueAt <= now)
  })
}

/** 订阅掌握度 topics（供主站组件使用） */
export function useMasteryTopics(): Record<string, TopicProgress> {
  return useMasteryStore((s) => s.topics)
}
