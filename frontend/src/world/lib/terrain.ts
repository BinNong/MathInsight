export interface IslandDef {
  cx: number
  cz: number
  r: number
}

export interface Rect {
  x1: number
  x2: number
  z1: number
  z2: number
}

export const ISLANDS = {
  spawn: { cx: 0, cz: 0, r: 14 },
  gradient: { cx: 43, cz: 0, r: 20 },
  matrix: { cx: -49, cz: 0, r: 18 },
  calculus: { cx: 0, cz: -59, r: 16 },
  probability: { cx: 0, cz: 44, r: 16 },
} satisfies Record<string, IslandDef>

export const BRIDGES: Rect[] = [
  { x1: 12, x2: 25, z1: -1.8, z2: 1.8 },
  { x1: -33, x2: -12, z1: -1.8, z2: 1.8 },
  { x1: -1.8, x2: 1.8, z1: 12, z2: 30 },
  { x1: -1.8, x2: 1.8, z1: -45, z2: -12 },
]

export function inIsland(x: number, z: number, island: IslandDef, padding = 0): boolean {
  const radius = island.r + padding
  if (radius < 0) return false
  const dx = x - island.cx
  const dz = z - island.cz
  return dx * dx + dz * dz <= radius * radius
}

export function inRect(x: number, z: number, rect: Rect, padding = 0): boolean {
  return (
    x >= rect.x1 - padding &&
    x <= rect.x2 + padding &&
    z >= rect.z1 - padding &&
    z <= rect.z2 + padding
  )
}

export function gradientHeight(x: number, z: number): number {
  const island = ISLANDS.gradient
  const dx = x - island.cx
  const dz = z - island.cz
  const q = Math.min(1, (dx * dx + dz * dz) / (island.r * island.r))
  return (1 - q) * (1 - q) * (-8 + 70 * q)
}

export function gradientAt(x: number, z: number): { gx: number; gz: number; mag: number } {
  const island = ISLANDS.gradient
  const dx = x - island.cx
  const dz = z - island.cz
  const radiusSq = island.r * island.r
  const distanceSq = dx * dx + dz * dz
  if (distanceSq >= radiusSq || distanceSq === 0) return { gx: 0, gz: 0, mag: 0 }

  const q = distanceSq / radiusSq
  const derivative = ((1 - q) * (86 - 210 * q) * 2) / radiusSq
  const gx = derivative * dx
  const gz = derivative * dz
  return { gx, gz, mag: Math.hypot(gx, gz) }
}

export const GRADIENT_GOAL = {
  x: ISLANDS.gradient.cx,
  z: ISLANDS.gradient.cz,
  h: gradientHeight(ISLANDS.gradient.cx, ISLANDS.gradient.cz),
}

export function heightAt(x: number, z: number): number | null {
  if (inIsland(x, z, ISLANDS.gradient)) return gradientHeight(x, z)

  const flatIslands = [ISLANDS.spawn, ISLANDS.matrix, ISLANDS.calculus, ISLANDS.probability]
  if (flatIslands.some((island) => inIsland(x, z, island))) return 0
  if (BRIDGES.some((bridge) => inRect(x, z, bridge))) return 0
  return null
}
