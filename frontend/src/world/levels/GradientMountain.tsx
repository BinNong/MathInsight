import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import {
  ISLANDS,
  GRADIENT_GOAL,
  gradientAt,
  gradientHeight,
  inIsland,
} from '../lib/terrain'
import { playerPosition, playerStats, useWorldStore } from '../store'

const G = ISLANDS.gradient

/** 高度配色：深谷青 -> 草甸绿 -> 山腰赭 -> 雪顶白 */
const STOPS: [number, string][] = [
  [0.0, '#155e75'],
  [0.3, '#059669'],
  [0.55, '#65a30d'],
  [0.78, '#a16207'],
  [1.0, '#e2e8f0'],
]

function heightColor(h: number): THREE.Color {
  const t = THREE.MathUtils.clamp((h + 8) / 18, 0, 1)
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1]
      const [t1, c1] = STOPS[i]
      const k = (t - t0) / (t1 - t0)
      return new THREE.Color(c0).lerp(new THREE.Color(c1), k)
    }
  }
  return new THREE.Color(STOPS[STOPS.length - 1][1])
}

/** 极坐标网格地形，顶点按 z = f(x, y) 位移 */
function buildTerrain(radius: number, rings: number, segs: number): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= rings; i++) {
    const rho = (i / rings) * radius
    for (let j = 0; j <= segs; j++) {
      const theta = (j / segs) * Math.PI * 2
      const lx = rho * Math.cos(theta)
      const lz = rho * Math.sin(theta)
      const h = gradientHeight(lx + G.cx, lz + G.cz)
      positions.push(lx, h, lz)
      const c = heightColor(h)
      colors.push(c.r, c.g, c.b)
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j
      const b = a + segs + 1
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/** 沿 -∇f 方向积分出最速下降流线 */
function buildFlowLines(): THREE.Vector3[][] {
  const lines: THREE.Vector3[][] = []
  const startRho = G.r * 0.62
  for (let n = 0; n < 12; n++) {
    const theta = (n / 12) * Math.PI * 2 + 0.26
    let x = G.cx + Math.cos(theta) * startRho
    let z = G.cz + Math.sin(theta) * startRho
    const pts: THREE.Vector3[] = []
    for (let step = 0; step < 400; step++) {
      if (!inIsland(x, z, G, -0.5)) break
      const h = gradientHeight(x, z)
      pts.push(new THREE.Vector3(x - G.cx, h + 0.25, z - G.cz))
      const { gx, gz, mag } = gradientAt(x, z)
      if (mag < 1e-3) break
      x -= (gx / mag) * 0.5
      z -= (gz / mag) * 0.5
      if (Math.hypot(x - GRADIENT_GOAL.x, z - GRADIENT_GOAL.z) < 1.2) break
    }
    if (pts.length > 4) lines.push(pts)
  }
  return lines
}

/** 旗舰关卡：梯度山脉 —— 行走在多元函数曲面上，沿最速下降流线抵达谷底 */
export default function GradientMountain() {
  const beaconRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const enteredRef = useRef(false)

  const terrainGeo = useMemo(() => buildTerrain(G.r, 56, 128), [])
  const flowLines = useMemo(() => buildFlowLines(), [])
  const goalLocal = useMemo(
    () =>
      new THREE.Vector3(
        GRADIENT_GOAL.x - G.cx,
        GRADIENT_GOAL.h,
        GRADIENT_GOAL.z - G.cz
      ),
    []
  )

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const s = useWorldStore.getState()

    // 谷底光柱脉动；通关后变为金色庆典
    if (beaconRef.current) {
      const mat = beaconRef.current.material as THREE.MeshBasicMaterial
      if (s.goalReached) {
        mat.color.set('#fcd34d')
        mat.opacity = 0.3 + Math.sin(t * 5) * 0.15
        beaconRef.current.scale.set(1.6 + Math.sin(t * 5) * 0.25, 1, 1.6 + Math.sin(t * 5) * 0.25)
      } else {
        mat.opacity = 0.22 + Math.sin(t * 2.4) * 0.08
      }
    }
    if (ringRef.current) {
      const k = 1 + ((t * 0.7) % 1) * 1.6
      ringRef.current.scale.setScalar(k)
      ;(ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - ((t * 0.7) % 1))
    }

    // 玩家读数 + 目标引导 + 通关判定
    const px = playerPosition.x
    const pz = playerPosition.z
    const onM = inIsland(px, pz, G)
    playerStats.onMountain = onM
    if (onM) {
      playerStats.height = gradientHeight(px, pz)
      playerStats.gradMag = gradientAt(px, pz).mag
      if (!enteredRef.current) {
        enteredRef.current = true
        if (!s.goalReached) s.setObjective('这座山就是函数 z = f(x, y)：沿发光流线走到谷底光柱')
      }
      if (!s.goalReached) {
        const dist = Math.hypot(px - GRADIENT_GOAL.x, pz - GRADIENT_GOAL.z)
        if (dist < 2.5) {
          s.setGoalReached(true)
          s.setObjective('🎉 抵达谷底！沿 −∇f 方向永远是最快下降路径 —— 这就是梯度下降')
        }
      }
    }
  })

  return (
    <group position={[G.cx, 0, G.cz]}>
      {/* 地形曲面 */}
      <mesh geometry={terrainGeo} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.9} flatShading />
      </mesh>
      {/* 悬崖裙边 + 岩石底座 */}
      <mesh position={[0, -5, 0]}>
        <cylinderGeometry args={[G.r * 0.985, G.r * 0.97, 10, 48, 1, true]} />
        <meshStandardMaterial color="#4a3b5c" roughness={1} flatShading side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -17.5, 0]}>
        <cylinderGeometry args={[G.r * 0.97, G.r * 0.06, 15, 24, 4]} />
        <meshStandardMaterial color="#413351" roughness={1} flatShading />
      </mesh>

      {/* 最速下降流线 */}
      {flowLines.map((pts, i) => (
        <Line key={i} points={pts} color="#22d3ee" lineWidth={2} transparent opacity={0.85} />
      ))}

      {/* 谷底光柱目标 */}
      <mesh ref={beaconRef} position={[goalLocal.x, goalLocal.y + 13, goalLocal.z]}>
        <cylinderGeometry args={[0.55, 0.55, 26, 16, 1, true]} />
        <meshBasicMaterial
          color="#67e8f9"
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh
        ref={ringRef}
        position={[goalLocal.x, goalLocal.y + 0.25, goalLocal.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.8, 1.05, 48]} />
        <meshBasicMaterial color="#a5f3fc" transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <pointLight
        color="#22d3ee"
        intensity={16}
        distance={18}
        position={[goalLocal.x, goalLocal.y + 3, goalLocal.z]}
      />
    </group>
  )
}
