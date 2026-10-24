import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ISLANDS } from '../lib/terrain'
import { makeTextTexture } from '../lib/textures'

const P = ISLANDS.probability
const MAX_DICE = 900
const BIN_COUNT = 11 // 两枚骰子点数之和 2..12
const SLOTS_PER_LAYER = 16 // 每个直方柱每层 4×4
const DIE_SIZE = 0.52
const LAYER_H = 0.58
const HIST_Z = -7 // 直方图相对岛心后移

const SLOT_OFFSETS = [-0.58, -0.19, 0.19, 0.58]

/** 两枚骰子之和的理论概率 */
const EXPECTED = [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1].map((v) => v / 36)

interface Die {
  active: boolean
  settled: boolean
  x: number
  y: number
  z: number
  targetY: number
  vy: number
  rx: number
  rz: number
  spinX: number
  spinZ: number
}

/** 概率之岛：天空中落下骰子，堆积成「两枚骰子之和」的真实直方图（大数定律） */
export default function ProbabilityRain() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const spawnTimer = useRef(0)
  const spawned = useRef(0)
  const binCounts = useRef(new Array(BIN_COUNT).fill(0))

  const dice = useMemo<Die[]>(
    () =>
      Array.from({ length: MAX_DICE }, () => ({
        active: false,
        settled: false,
        x: 0,
        y: 0,
        z: 0,
        targetY: 0,
        vy: 0,
        rx: 0,
        rz: 0,
        spinX: 0,
        spinZ: 0,
      })),
    []
  )

  const title = useMemo(
    () => makeTextTexture('概率之岛 · 两枚骰子点数之和', { fontSize: 46 }),
    []
  )
  const doneLabel = useMemo(
    () => makeTextTexture('直方图正收敛到理论分布 —— 大数定律', { fontSize: 36 }),
    []
  )

  // 每个骰子的颜色：按所属直方柱从粉到紫渐变
  const binColors = useMemo(() => {
    const from = new THREE.Color('#f472b6')
    const to = new THREE.Color('#8b5cf6')
    return Array.from({ length: BIN_COUNT }, (_, i) =>
      from.clone().lerp(to, i / (BIN_COUNT - 1))
    )
  }, [])

  const binLabels = useMemo(
    () => Array.from({ length: BIN_COUNT }, (_, i) => makeTextTexture(String(i + 2), { fontSize: 40, bg: '' })),
    []
  )

  function spawnDie(): void {
    const idx = spawned.current
    if (idx >= MAX_DICE) return
    const bin = Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) // 0..10，天然呈三角分布
    const count = binCounts.current[bin]
    binCounts.current[bin] = count + 1
    const layer = Math.floor(count / SLOTS_PER_LAYER)
    const slot = count % SLOTS_PER_LAYER
    const die = dice[idx]
    die.active = true
    die.settled = false
    die.x = (bin - 5) * 1.5 + SLOT_OFFSETS[slot % 4]
    die.z = HIST_Z + SLOT_OFFSETS[Math.floor(slot / 4)]
    die.y = 20 + Math.random() * 6
    die.targetY = 0.32 + layer * LAYER_H
    die.vy = -2 - Math.random() * 2
    die.rx = Math.random() * Math.PI
    die.rz = Math.random() * Math.PI
    die.spinX = 3 + Math.random() * 5
    die.spinZ = 3 + Math.random() * 5
    spawned.current = idx + 1
    meshRef.current?.setColorAt(idx, binColors[bin])
    if (meshRef.current?.instanceColor) meshRef.current.instanceColor.needsUpdate = true
  }

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    // 开场先来一阵「骰子雨」，之后稳定下落
    spawnTimer.current += dt
    const interval = spawned.current < 120 ? 0.02 : 0.08
    while (spawnTimer.current > interval && spawned.current < MAX_DICE) {
      spawnTimer.current -= interval
      spawnDie()
    }

    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < spawned.current; i++) {
      const die = dice[i]
      if (!die.settled) {
        die.vy -= 20 * dt
        die.y += die.vy * dt
        die.rx += die.spinX * dt
        die.rz += die.spinZ * dt
        if (die.y <= die.targetY) {
          die.y = die.targetY
          die.settled = true
        }
      }
      dummy.position.set(die.x, die.y, die.z)
      dummy.rotation.set(die.settled ? 0 : die.rx, 0, die.settled ? 0 : die.rz)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group position={[P.cx, 0, P.cz]}>
      {/* 骰子雨（instanced） */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_DICE]} frustumCulled={false}>
        <boxGeometry args={[DIE_SIZE, DIE_SIZE, DIE_SIZE]} />
        <meshStandardMaterial roughness={0.35} metalness={0.1} />
      </instancedMesh>

      {/* 理论分布参照（半透明幽灵柱） */}
      {EXPECTED.map((p, i) => {
        const h = Math.max(0.15, (p * MAX_DICE * LAYER_H) / SLOTS_PER_LAYER)
        return (
          <mesh key={i} position={[(i - 5) * 1.5, h / 2, HIST_Z + 1.9]}>
            <boxGeometry args={[1.1, h, 0.3]} />
            <meshBasicMaterial color="#e2e8f0" transparent opacity={0.13} depthWrite={false} />
          </mesh>
        )
      })}

      {/* 直方柱编号 2..12 */}
      {binLabels.map((l, i) => (
        <mesh key={i} position={[(i - 5) * 1.5, 0.35, HIST_Z + 3.2]}>
          <planeGeometry args={[0.55 * l.aspect, 0.55]} />
          <meshBasicMaterial map={l.texture} transparent side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* 标题与结论 */}
      <mesh position={[0, 8.6, HIST_Z]}>
        <planeGeometry args={[1.3 * title.aspect, 1.3]} />
        <meshBasicMaterial map={title.texture} transparent side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 7.1, HIST_Z]}>
        <planeGeometry args={[0.85 * doneLabel.aspect, 0.85]} />
        <meshBasicMaterial map={doneLabel.texture} transparent side={THREE.DoubleSide} />
      </mesh>

      {/* 两颗装饰巨骰 */}
      {[
        { pos: [-6, 5.5, 6] as const, color: '#f472b6', speed: 0.5 },
        { pos: [6, 6.5, 5] as const, color: '#8b5cf6', speed: 0.35 },
      ].map((d, i) => (
        <DecorDie key={i} position={d.pos} color={d.color} speed={d.speed} />
      ))}

      <pointLight color="#fcd34d" intensity={10} distance={18} position={[0, 6, HIST_Z]} />
    </group>
  )
}

function DecorDie({
  position,
  color,
  speed,
}: {
  position: readonly [number, number, number]
  color: string
  speed: number
}) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    ref.current.rotation.x = t * speed
    ref.current.rotation.y = t * speed * 0.7
    ref.current.position.y = position[1] + Math.sin(t * speed + position[0]) * 0.5
  })
  return (
    <mesh ref={ref} position={[position[0], position[1], position[2]]}>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5}
        roughness={0.3}
      />
    </mesh>
  )
}
