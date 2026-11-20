import type { Rect } from './terrain'

const obstacles = new Map<number, Rect>()
let nextObstacleId = 0

export function addObstacle(rect: Rect): () => void {
  const id = nextObstacleId++
  obstacles.set(id, {
    x1: Math.min(rect.x1, rect.x2),
    x2: Math.max(rect.x1, rect.x2),
    z1: Math.min(rect.z1, rect.z2),
    z2: Math.max(rect.z1, rect.z2),
  })

  let active = true
  return () => {
    if (!active) return
    active = false
    obstacles.delete(id)
  }
}

export function resolveObstacles(x: number, z: number, radius: number): [number, number] {
  if (obstacles.size === 0) return [x, z]

  let resolvedX = x
  let resolvedZ = z
  const safeRadius = Math.max(0, radius)

  for (let pass = 0; pass < 4; pass++) {
    let changed = false

    for (const obstacle of obstacles.values()) {
      const nearestX = Math.max(obstacle.x1, Math.min(resolvedX, obstacle.x2))
      const nearestZ = Math.max(obstacle.z1, Math.min(resolvedZ, obstacle.z2))
      const dx = resolvedX - nearestX
      const dz = resolvedZ - nearestZ
      const distanceSq = dx * dx + dz * dz
      const inside =
        resolvedX >= obstacle.x1 &&
        resolvedX <= obstacle.x2 &&
        resolvedZ >= obstacle.z1 &&
        resolvedZ <= obstacle.z2

      if (!inside && distanceSq >= safeRadius * safeRadius) continue

      if (!inside && distanceSq > 0) {
        const distance = Math.sqrt(distanceSq)
        const push = (safeRadius - distance) / distance
        resolvedX += dx * push
        resolvedZ += dz * push
      } else {
        const sides = [
          {
            distance: resolvedX - (obstacle.x1 - safeRadius),
            axis: 'x' as const,
            value: obstacle.x1 - safeRadius,
          },
          {
            distance: obstacle.x2 + safeRadius - resolvedX,
            axis: 'x' as const,
            value: obstacle.x2 + safeRadius,
          },
          {
            distance: resolvedZ - (obstacle.z1 - safeRadius),
            axis: 'z' as const,
            value: obstacle.z1 - safeRadius,
          },
          {
            distance: obstacle.z2 + safeRadius - resolvedZ,
            axis: 'z' as const,
            value: obstacle.z2 + safeRadius,
          },
        ]
        const nearestSide = sides.reduce((nearest, side) =>
          side.distance < nearest.distance ? side : nearest
        )
        if (nearestSide.axis === 'x') resolvedX = nearestSide.value
        else resolvedZ = nearestSide.value
      }
      changed = true
    }

    if (!changed) break
  }

  return [resolvedX, resolvedZ]
}
