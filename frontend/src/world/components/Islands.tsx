import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BRIDGES, ISLANDS, type IslandDef, type Rect } from '../lib/terrain'
import { makeGroundTexture } from '../lib/textures'

/** 与 Crystals 同款的种子随机（LCG），保证每座岛装饰布局稳定 */
function makeRand(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

interface ScatterItem {
  x: number
  z: number
  rot: number
  scale: number
}

/** 在岛上散布位置：避开岛心走廊（传送门/桥口），不越出岛沿 */
function scatter(seed: number, count: number, r: number): ScatterItem[] {
  const rand = makeRand(seed)
  const items: ScatterItem[] = []
  let guard = 0
  while (items.length < count && guard++ < count * 20) {
    const a = rand() * Math.PI * 2
    const d = r * (0.38 + rand() * 0.5)
    if (d < 4.5 || d > r - 2.6) continue
    items.push({
      x: Math.cos(a) * d,
      z: Math.sin(a) * d,
      rot: rand() * Math.PI * 2,
      scale: 0.7 + rand() * 0.6,
    })
  }
  return items
}

/** 低多边形树木：圆柱树干 + 双层锥形树冠 */
function Trees({ seed, count, r, leafColor }: { seed: number; count: number; r: number; leafColor: string }) {
  const items = useMemo(() => scatter(seed, count, r), [seed, count, r])
  const dark = useMemo(() => new THREE.Color(leafColor).multiplyScalar(0.82), [leafColor])
  return (
    <>
      {items.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} rotation={[0, t.rot, 0]} scale={t.scale}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.2, 1, 6]} />
            <meshStandardMaterial color="#6b4a2f" roughness={1} flatShading />
          </mesh>
          <mesh position={[0, 1.45, 0]} castShadow>
            <coneGeometry args={[0.85, 1.4, 7]} />
            <meshStandardMaterial color={leafColor} roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0, 2.35, 0]} castShadow>
            <coneGeometry args={[0.55, 1, 7]} />
            <meshStandardMaterial color={dark} roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}
    </>
  )
}

/** 岩石：随机缩放旋转的十二面体 */
function Rocks({ seed, count, r, color }: { seed: number; count: number; r: number; color: string }) {
  const items = useMemo(() => scatter(seed, count, r), [seed, count, r])
  const bright = useMemo(() => new THREE.Color(color).multiplyScalar(1.35), [color])
  return (
    <>
      {items.map((t, i) => (
        <mesh
          key={i}
          position={[t.x, 0.18 * t.scale, t.z]}
          rotation={[t.rot, t.rot * 1.7, 0]}
          scale={t.scale * 0.55}
          castShadow
        >
          <dodecahedronGeometry args={[0.7, 0]} />
          <meshStandardMaterial color={bright} roughness={1} flatShading />
        </mesh>
      ))}
    </>
  )
}

/** 草丛：四角小锥簇，两色穿插 */
function GrassTufts({ seed, count, r, color }: { seed: number; count: number; r: number; color: string }) {
  const items = useMemo(() => scatter(seed, count, r), [seed, count, r])
  const [light, dark] = useMemo(
    () => [new THREE.Color(color).multiplyScalar(1.25), new THREE.Color(color).multiplyScalar(0.8)],
    [color]
  )
  return (
    <>
      {items.map((t, i) => (
        <mesh key={i} position={[t.x, 0.22 * t.scale, t.z]} rotation={[0, t.rot, 0]} scale={t.scale}>
          <coneGeometry args={[0.16, 0.55, 4]} />
          <meshStandardMaterial color={i % 2 ? light : dark} roughness={1} flatShading />
        </mesh>
      ))}
    </>
  )
}

interface IslandProps {
  def: IslandDef
  grassColor: string
  rockColor: string
  runeColor: string
  leafColor: string
  seed: number
  children?: ReactNode
}

/** 悬浮岛：噪点草地台 + 植被岩石装饰 + 岩石锥底座 + 旋转符文环 */
function FloatingIsland({ def, grassColor, rockColor, runeColor, leafColor, seed, children }: IslandProps) {
  const runeRef = useRef<THREE.Mesh>(null)
  const groundTex = useMemo(() => makeGroundTexture(grassColor), [grassColor])
  useFrame(({ clock }) => {
    if (runeRef.current) {
      runeRef.current.rotation.z = clock.elapsedTime * 0.08
    }
  })
  return (
    <group position={[def.cx, 0, def.cz]}>
      <mesh position={[0, -0.6, 0]} receiveShadow>
        <cylinderGeometry args={[def.r, def.r * 0.96, 1.2, 48]} />
        <meshStandardMaterial color={grassColor} roughness={0.95} flatShading />
      </mesh>
      {/* 岛面噪点草地（盖在圆柱顶面上） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <circleGeometry args={[def.r, 48]} />
        <meshStandardMaterial map={groundTex} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0, -1.2 - def.r * 0.42, 0]}>
        <cylinderGeometry args={[def.r * 0.96, def.r * 0.1, def.r * 0.85, 24, 4]} />
        <meshStandardMaterial color={rockColor} roughness={1} flatShading />
      </mesh>
      <mesh ref={runeRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.18, 0]}>
        <torusGeometry args={[def.r + 1.1, 0.1, 8, 72]} />
        <meshBasicMaterial color={runeColor} transparent opacity={0.75} />
      </mesh>
      <Trees seed={seed + 1} count={Math.round(def.r * 0.28)} r={def.r} leafColor={leafColor} />
      <Rocks seed={seed + 2} count={4} r={def.r} color={rockColor} />
      <GrassTufts seed={seed + 3} count={Math.round(def.r * 0.9)} r={def.r} color={grassColor} />
      {children}
    </group>
  )
}

/** 发光水晶装饰 */
function Crystals({ seed, count, r }: { seed: number; count: number; r: number }) {
  const items = useMemo(() => {
    let s = seed
    const rand = () => {
      s = (s * 16807) % 2147483647
      return s / 2147483647
    }
    return Array.from({ length: count }, () => {
      const a = rand() * Math.PI * 2
      const d = r * (0.45 + rand() * 0.45)
      return {
        x: Math.cos(a) * d,
        z: Math.sin(a) * d,
        h: 0.7 + rand() * 1.6,
        rot: rand() * Math.PI,
        color: ['#7dd3fc', '#f0abfc', '#6ee7b7'][Math.floor(rand() * 3)],
      }
    })
  }, [seed, count, r])
  return (
    <>
      {items.map((c, i) => (
        <mesh
          key={i}
          position={[c.x, c.h / 2 - 0.1, c.z]}
          rotation={[0, c.rot, 0]}
          scale={[1, c.h / 0.7, 1]}
          castShadow
        >
          <octahedronGeometry args={[0.35, 0]} />
          <meshStandardMaterial
            color={c.color}
            emissive={c.color}
            emissiveIntensity={0.9}
            roughness={0.2}
          />
        </mesh>
      ))}
    </>
  )
}

/** 光桥：木板 + 两侧发光灯带 */
function Bridge({ rect }: { rect: Rect }) {
  const { x1, x2, z1, z2 } = rect
  const alongX = x2 - x1 > z2 - z1
  const length = alongX ? x2 - x1 : z2 - z1
  const cx = (x1 + x2) / 2
  const cz = (z1 + z2) / 2
  const planks = Math.floor(length / 2)
  return (
    <group>
      {Array.from({ length: planks }, (_, i) => {
        const offset = -length / 2 + 1 + i * 2
        return (
          <mesh
            key={i}
            position={alongX ? [cx + offset, -0.12, cz] : [cx, -0.12, cz + offset]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={alongX ? [1.7, 0.24, 3.4] : [3.4, 0.24, 1.7]} />
            <meshStandardMaterial color="#6d4c2f" roughness={0.9} />
          </mesh>
        )
      })}
      {/* 两侧发光灯带 */}
      {[-1.7, 1.7].map((side) => (
        <mesh
          key={side}
          position={alongX ? [cx, 0.06, cz + side] : [cx + side, 0.06, cz]}
        >
          <boxGeometry args={alongX ? [length, 0.08, 0.1] : [0.1, 0.08, length]} />
          <meshBasicMaterial color="#7dd3fc" transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  )
}

/** 4 座平岛（梯度山脉的地形在 GradientMountain 中单独渲染）+ 全部光桥 */
export default function Islands() {
  return (
    <>
      <FloatingIsland
        def={ISLANDS.spawn}
        grassColor="#2f9e6e"
        rockColor="#4a3b5c"
        runeColor="#f0abfc"
        leafColor="#1f8a5c"
        seed={11}
      >
        <Crystals seed={11} count={5} r={ISLANDS.spawn.r} />
      </FloatingIsland>

      <FloatingIsland
        def={ISLANDS.matrix}
        grassColor="#3b4a8a"
        rockColor="#3d3355"
        runeColor="#a78bfa"
        leafColor="#6d5fd3"
        seed={23}
      >
        <Crystals seed={23} count={6} r={ISLANDS.matrix.r} />
      </FloatingIsland>

      <FloatingIsland
        def={ISLANDS.calculus}
        grassColor="#2f7e8a"
        rockColor="#3d3355"
        runeColor="#67e8f9"
        leafColor="#1f9e8f"
        seed={37}
      >
        <Crystals seed={37} count={5} r={ISLANDS.calculus.r} />
      </FloatingIsland>

      <FloatingIsland
        def={ISLANDS.probability}
        grassColor="#8a6d3b"
        rockColor="#4a3b5c"
        runeColor="#fcd34d"
        leafColor="#d97706"
        seed={53}
      >
        <Crystals seed={53} count={6} r={ISLANDS.probability.r} />
      </FloatingIsland>

      {BRIDGES.map((b, i) => (
        <Bridge key={i} rect={b} />
      ))}
    </>
  )
}
