import { resolveLearningModule } from '../data/subjects'

const TOPIC_ROUTE_KEYS = [
  'limit',
  'derivative',
  'integral',
  'taylor',
  'multivariate',
  'vector-field',
  'line-integral',
  'surface-integral',
  'matrix',
  'eigenvalue',
  'linear-system',
  'probability',
  'distribution',
  'series',
] as const

export const TOPIC_ROUTE_MAP: Record<string, { path: string; label: string } | undefined> =
  Object.fromEntries(
    TOPIC_ROUTE_KEYS.map((topic) => {
      const module = resolveLearningModule(topic)
      return [
        topic,
        module ? { path: module.path, label: module.topicName ?? module.name } : undefined,
      ]
    })
  )

export function getTopicRoute(topic: string): { path: string; label: string } | undefined {
  return TOPIC_ROUTE_MAP[topic] ?? undefined
}
