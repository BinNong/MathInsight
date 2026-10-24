import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeTextTexture } from '../lib/textures'
import { addObstacle } from '../lib/collision'
import { playerPosition, useWorldStore } from '../store'

const NPC_POS: [number, number, number] = [3.5, 0, 3]
const NEAR_DIST = 4.5

/** 「数灵」导师：发光多面体精灵，靠近按 E 对话 */
export default function NpcGuide() {
  const bodyRef = useRef<THREE.Mesh>(null)
  const haloRef = useRef<THREE.Mesh>(null)
  const label = useMemo(() => makeTextTexture('数灵 · 数学导师', { fontSize: 44 }), [])

  useEffect(() => {
    addObstacle({ x1: NPC_POS[0] - 0.7, x2: NPC_POS[0] + 0.7, z1: NPC_POS[2] - 0.7, z2: NPC_POS[2] + 0.7 })

    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE') return
      const s = useWorldStore.getState()
      if (!s.started || s.overlay || s.dialogOpen || !document.pointerLockElement) return
      const dist = Math.hypot(playerPosition.x - NPC_POS[0], playerPosition.z - NPC_POS[2])
      if (dist < NEAR_DIST) {
        s.setDialogOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (bodyRef.current) {
      bodyRef.current.position.y = 1.9 + Math.sin(t * 1.3) * 0.25
      bodyRef.current.rotation.y = t * 0.7
      bodyRef.current.rotation.x = Math.sin(t * 0.5) * 0.2
    }
    if (haloRef.current) {
      haloRef.current.rotation.z = t * 0.9
    }
    // 靠近提示
    const s = useWorldStore.getState()
    if (!s.started || s.overlay || s.dialogOpen) return
    const dist = Math.hypot(playerPosition.x - NPC_POS[0], playerPosition.z - NPC_POS[2])
    if (dist < NEAR_DIST) {
      s.setPrompt('按 E 与「数灵」对话')
    } else if (s.prompt === '按 E 与「数灵」对话') {
      s.setPrompt(null)
    }
  })

  return (
    <group position={NPC_POS}>
      <mesh ref={bodyRef} position={[0, 1.9, 0]} castShadow>
        <icosahedronGeometry args={[0.65, 0]} />
        <meshStandardMaterial
          color="#7dd3fc"
          emissive="#38bdf8"
          emissiveIntensity={1.4}
          roughness={0.15}
          flatShading
        />
      </mesh>
      <mesh ref={haloRef} position={[0, 1.9, 0]} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[1.05, 0.05, 8, 48]} />
        <meshBasicMaterial color="#bae6fd" transparent opacity={0.85} />
      </mesh>
      {/* 地面光环 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[0.9, 1.35, 48]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 3.3, 0]}>
        <planeGeometry args={[1.15 * label.aspect, 1.15]} />
        <meshBasicMaterial map={label.texture} transparent side={THREE.DoubleSide} />
      </mesh>
      <pointLight color="#7dd3fc" intensity={10} distance={12} position={[0, 2.2, 0]} />
    </group>
  )
}
