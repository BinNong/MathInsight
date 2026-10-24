import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ISLANDS } from '../lib/terrain'
import { addObstacle } from '../lib/collision'
import { makeTextTexture } from '../lib/textures'
import { playerPosition, useWorldStore } from '../store'

const M = ISLANDS.matrix
const GRID_N = 5
const SPACING = 1.15
const HALF = (GRID_N - 1) / 2
const HOVER_Y = 4.4
const NEAR_DIST = 9

interface Preset {
  name: string
  m: [number, number, number, number] // a, b, c, d
}

const PRESETS: Preset[] = [
  { name: '恒等变换 I', m: [1, 0, 0, 1] },
  { name: '旋转 90°', m: [0, -1, 1, 0] },
  { name: '剪切变换', m: [1, 1, 0, 1] },
  { name: '缩放 ×1.8', m: [1.8, 0, 0, 1.8] },
  { name: '奇异矩阵（det = 0）', m: [1, 1, 1, 1] },
]

function det(m: [number, number, number, number]): number {
  return m[0] * m[3] - m[1] * m[2]
}

/** 矩阵变换装置：5×5×5 立方体点阵实时演示线性变换；尽头是矩阵之门 */
export default function MatrixGate() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const presetIdx = useRef(0)
  const animT = useRef(1)
  const fromM = useRef<[number, number, number, number]>([...PRESETS[0].m])
  const toM = useRef<[number, number, number, number]>([...PRESETS[0].m])

  const label = useMemo(() => makeTextTexture('矩阵变换装置 · 按 E 切换', { fontSize: 44 }), [])

  const basePositions = useMemo(() => {
    const list: [number, number, number][] = []
    for (let i = 0; i < GRID_N; i++)
      for (let j = 0; j < GRID_N; j++)
        for (let k = 0; k < GRID_N; k++)
          list.push([(i - HALF) * SPACING, (j - HALF) * SPACING, (k - HALF) * SPACING])
    return list
  }, [])

  useEffect(() => {
    // 矩阵之门立柱障碍
    addObstacle({ x1: M.cx - 11.6, x2: M.cx - 10.4, z1: -4.4, z2: -2.8 })
    addObstacle({ x1: M.cx - 11.6, x2: M.cx - 10.4, z1: 2.8, z2: 4.4 })

    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE') return
      const s = useWorldStore.getState()
      if (!s.started || s.overlay || s.dialogOpen || !document.pointerLockElement) return
      const dist = Math.hypot(playerPosition.x - M.cx, playerPosition.z - M.cz)
      if (dist >= NEAR_DIST) return
      // 从当前动画状态无缝插值到下一个矩阵
      const cur = currentMatrix()
      fromM.current = cur
      presetIdx.current = (presetIdx.current + 1) % PRESETS.length
      toM.current = [...PRESETS[presetIdx.current].m]
      animT.current = 0
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function currentMatrix(): [number, number, number, number] {
    const t = THREE.MathUtils.smoothstep(animT.current, 0, 1)
    return fromM.current.map((v, i) => v + (toM.current[i] - v) * t) as [
      number,
      number,
      number,
      number,
    ]
  }

  useFrame(({ clock }, dt) => {
    if (animT.current < 1) {
      animT.current = Math.min(1, animT.current + dt / 1.4)
    }
    const m = currentMatrix()
    const mesh = meshRef.current
    if (mesh) {
      for (let i = 0; i < basePositions.length; i++) {
        const [x, y, z] = basePositions[i]
        const tx = m[0] * x + m[1] * z
        const tz = m[2] * x + m[3] * z
        dummy.position.set(tx, y + Math.sin(clock.elapsedTime * 0.8 + i * 0.13) * 0.06, tz)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.15) * 0.35
    }

    // 提示当前矩阵
    const s = useWorldStore.getState()
    if (!s.started || s.overlay || s.dialogOpen) return
    const dist = Math.hypot(playerPosition.x - M.cx, playerPosition.z - M.cz)
    const preset = PRESETS[presetIdx.current]
    const text = `按 E 切换矩阵：${preset.name} · det = ${det(preset.m).toFixed(2)}`
    if (dist < NEAR_DIST) {
      s.setPrompt(text)
    } else if (s.prompt === text || (s.prompt?.startsWith('按 E 切换矩阵') ?? false)) {
      s.setPrompt(null)
    }
  })

  return (
    <group position={[M.cx, 0, M.cz]}>
      {/* 点阵装置 */}
      <group ref={groupRef} position={[0, HOVER_Y, 0]}>
        <instancedMesh ref={meshRef} args={[undefined, undefined, basePositions.length]}>
          <boxGeometry args={[0.34, 0.34, 0.34]} />
          <meshStandardMaterial
            color="#a78bfa"
            emissive="#7c3aed"
            emissiveIntensity={0.7}
            roughness={0.3}
          />
        </instancedMesh>
      </group>
      {/* 装置底座光环 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[3.2, 3.6, 64]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 8.2, 0]}>
        <planeGeometry args={[1.1 * label.aspect, 1.1]} />
        <meshBasicMaterial map={label.texture} transparent side={THREE.DoubleSide} />
      </mesh>
      <pointLight color="#a78bfa" intensity={12} distance={16} position={[0, HOVER_Y, 0]} />

      {/* 矩阵之门 */}
      <group position={[-11, 0, 0]}>
        {[-3.6, 3.6].map((z) => (
          <mesh key={z} position={[0, 2.1, z]}>
            <boxGeometry args={[1.1, 4.2, 1.1]} />
            <meshStandardMaterial color="#312e5c" roughness={0.7} flatShading />
          </mesh>
        ))}
        <mesh position={[0, 4.6, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[8.6, 0.9, 0.9]} />
          <meshStandardMaterial color="#312e5c" roughness={0.7} flatShading />
        </mesh>
        <mesh position={[0, 2.4, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[2.3, 0.14, 12, 64]} />
          <meshBasicMaterial color="#c4b5fd" />
        </mesh>
        <pointLight color="#a78bfa" intensity={8} distance={10} position={[0, 3, 0]} />
      </group>
    </group>
  )
}
